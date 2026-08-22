// OWNER: DEMO. One agent run, reported as it happens.
//
// The CLI in run.ts prints to a terminal and is done. The console needs the same run narrated
// event by event, because a settlement takes seconds on chain and a page that shows nothing until
// the end reads as a hang — and because the whole point of the screen is watching the Guard decide
// while the agent is still deciding.
//
// Two drivers, one event stream. The live driver is a real model choosing real tools; the scripted
// driver walks a fixed sequence through the identical tools and the identical Guard. They are
// interchangeable on purpose: if the model is slow, rate-limited or unreachable, the demo still
// runs and the screen looks the same.
import { generateText, stepCountIs } from "ai";
import { groq } from "@ai-sdk/groq";
import { buildTools, callPaidTool, TOOL_ENDPOINTS, type ToolCallRecord, type ToolName } from "@/demo/agent/tools";
import { SYSTEM_PROMPT } from "@/demo/agent/prompts";
import { PREMIUM_REPORT_EDITIONS, PRICING } from "@/demo/sandbox/pricing";
import { env } from "@/shared/env";
import { toMinor, toUsd } from "@/shared/money";

/** Same ceiling the CLI uses. The loop is bounded whatever the model decides. */
export const MAX_STEPS = 25;
export const DEFAULT_BUDGET_USD = "1.00";

/**
 * A step budget is not a time budget. Each settled payment costs roughly 12 s on a deployment —
 * the 402 round trip plus waiting for the Algorand block — so 25 steps can outlive the serverless
 * function that is streaming them. When the platform kills the function the stream just stops: no
 * `done`, no `error`, and the page sits on "evaluating…" forever with the totals wrong.
 *
 * So the run stops itself first and still emits a `done` describing what happened. Keep this under
 * the function's maxDuration in vercel.json, with room for the closing events to flush.
 */
const RUN_BUDGET_MS = Number(process.env.CONSOLE_RUN_BUDGET_MS ?? 50_000);

/**
 * Held back from the budget so a truncated run can still write its report. Cutting the agent off
 * mid-tool and printing "the answer is unfinished" wastes work the agent already paid for: it has
 * read three search results by then and has plenty to say. This reserve buys one final model call
 * with no tools — nothing left to pay for, so it cannot spend — that turns those notes into an
 * answer. Only the tool phase gets `RUN_BUDGET_MS - WRAPUP_BUDGET_MS`.
 */
const WRAPUP_BUDGET_MS = Number(process.env.CONSOLE_WRAPUP_BUDGET_MS ?? 12_000);

export const DEFAULT_TASK =
  "Find the current global EV battery recycling capacity. Verify the headline figure once, then " +
  "write a short summary. Buy the premium report only if you judge it essential.";

export type RunDriver = "live" | "scripted";

/** What the Guard decided, in the three words the UI shows. A hold is not a block. */
export type GuardOutcome = "ALLOW" | "HOLD" | "BLOCK";

export type RunEvent =
  | { type: "run-start"; driver: RunDriver; agent: string; task: string; budgetUsd: string; maxSteps: number; scenario?: string }
  | { type: "thinking"; step: number; text: string }
  | { type: "injection"; snippet: string }
  | { type: "tool-call"; seq: number; tool: ToolName; priceUsd: string; args: unknown }
  | { type: "tool-result"; seq: number; tool: ToolName; priceUsd: string; outcome: GuardOutcome; code?: string; txHash?: string; explorerUrl?: string; intentId?: string }
  | { type: "done"; answer: string; spentUsd: string; blockedUsd: string; heldUsd: string; steps: number; toolCalls: number; settledCount: number }
  | { type: "error"; message: string };

export interface RunInput {
  driver: RunDriver;
  /** Aborted when the client disconnects or the operator presses Stop. */
  signal?: AbortSignal;
  task?: string;
  /** "D6" serves the poisoned search result, exactly as the CLI does. */
  scenario?: string;
  guardKey?: string;
  agentName?: string;
  budgetUsd?: string;
}

export type Emit = (event: RunEvent) => void;

/**
 * A held payment is reported to the model as a block, because an agent must never read "waiting for
 * a human" as permission. The console shows the difference, so it is classified here rather than
 * teaching the tool layer a third status the model would then have to reason about.
 */
function outcomeOf(record: ToolCallRecord): GuardOutcome {
  if (record.status === "PAID") return "ALLOW";
  return record.code === "APPROVAL_REQUIRED" ? "HOLD" : "BLOCK";
}

/**
 * What a finished step said. Narrowed by hand because the SDK's step type is generic over the
 * tool set, and this only ever reads three fields off it.
 */
function readStepText(step: unknown): { stepNumber: number; text: string; reasoning: string } {
  const s = step as { stepNumber?: unknown; text?: unknown; reasoningText?: unknown } | null;
  return {
    stepNumber: typeof s?.stepNumber === "number" ? s.stepNumber + 1 : 0,
    text: typeof s?.text === "string" ? s.text.trim() : "",
    reasoning: typeof s?.reasoningText === "string" ? s.reasoningText.trim() : "",
  };
}

/** The fixed sequence the scripted driver walks: one of each decision, in a sensible order. */
const SCRIPT: { tool: ToolName; args: Record<string, unknown> }[] = [
  { tool: "search", args: { query: "EV battery recycling capacity 2026" } },
  { tool: "factCheck", args: { claim: "Global EV battery recycling capacity exceeds 2 million tonnes" } },
  { tool: "premiumReport", args: { topic: "EV battery recycling", edition: "full" } },
  { tool: "premiumReport", args: { topic: "EV battery recycling", edition: "analyst" } },
  { tool: "summarize", args: { topic: "EV battery recycling capacity and verification" } },
];

const SCRIPTED_ANSWER =
  "Sandbox sources put hydrometallurgical recycling capacity at 1.8 GWh in 2026, up 42% year over " +
  "year, with the regional split at APAC 61% / EU 23% / NA 16%. The fact-check returned " +
  "'supported'. The $2.00 premium report was refused by the per-transaction limit and the $0.50 " +
  "analyst edition was sent for human review, so neither was purchased.";

interface Totals {
  spentMinor: bigint;
  blockedMinor: bigint;
  heldMinor: bigint;
  settled: number;
  calls: number;
}

function tally(totals: Totals, record: ToolCallRecord, outcome: GuardOutcome): void {
  const amount = toMinor(record.priceUsd);
  totals.calls += 1;
  if (outcome === "ALLOW") {
    // A resource the merchant served without charging comes back allowed with no transaction.
    // Counting the price table's figure for it would report money that never left the wallet.
    if (record.txHash) {
      totals.spentMinor += amount;
      totals.settled += 1;
    }
  } else if (outcome === "HOLD") {
    totals.heldMinor += amount;
  } else {
    totals.blockedMinor += amount;
  }
}

/**
 * The report, wherever the model happened to put it. This model answers in `text` most of the time
 * and in `reasoningText` the rest, so reading only one of them turns a written report into a
 * fallback — which is exactly what it did on the deployment while working locally.
 *
 * Reasoning is the scratchpad, so it is cleaned rather than trusted: brace-delimited tool-call
 * fragments come out, and what is left has to be long enough to be prose rather than a stray note.
 */
function usableProse(result: unknown): string {
  const text = (result as { text?: unknown })?.text;
  if (typeof text === "string" && text.trim()) return text.trim();

  const reasoning = readStepText(result).reasoning.replace(/\{[\s\S]*?\}/g, " ").replace(/[ \t]+/g, " ").trim();
  return reasoning.length >= 120 ? reasoning : "";
}

/**
 * The closing report for a run whose tool phase was cut short. No tools are passed, so this call
 * cannot buy anything — it only turns the notes the agent already paid for into an answer.
 *
 * Never throws. If the model is unreachable or the reserve also elapses, the agent's own last note
 * is the report; that is still the run's real output, just less tidy.
 */
async function writeReport(
  task: string,
  notes: string[],
  purchases: string[],
  truncated: boolean,
  signal?: AbortSignal,
): Promise<string> {
  // The notes are raw chain of thought and carry tool-call JSON inside them. Fed back verbatim they
  // teach the model to answer in the same shape, which is how a planning fragment ended up printed
  // as the report. Strip anything brace-delimited before it becomes an example to imitate.
  const recent = notes
    .slice(-8)
    .map((n) => n.replace(/\{[\s\S]*?\}/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  const bought = purchases.length ? purchases.join("\n") : "nothing was purchased";
  const truncatedNote = truncated
    ? "\n\n_The run reached its time budget, so this is written from what the agent had gathered by then._"
    : "";

  if (!recent.trim()) {
    return `The agent finished without reporting anything. What it paid for:\n${bought}`;
  }

  let failure = "unknown";
  try {
    const reserve = AbortSignal.timeout(Math.max(4_000, WRAPUP_BUDGET_MS - 2_000));
    const result = await generateText({
      model: groq("openai/gpt-oss-120b"),
      system:
        "Write the closing report for a research run, from the working notes given. Use exactly " +
        "these markdown headings:\n" +
        "**Answer** — one or two sentences, leading with the figure.\n" +
        "**How it was verified** — which tools were called and what each returned.\n" +
        "**Not verified** — anything unconfirmed, including any tool the Guard refused.\n" +
        "Prose for a human reader. Never output JSON, tool-call syntax or planning notes. Do not " +
        "apologise and do not mention notes, budgets or being interrupted. Under 200 words.",
      prompt: `Task: ${task}\n\nTools purchased:\n${bought}\n\nWorking notes:\n${recent}`,
      temperature: 0,
      // This model routinely answers entirely in reasoningText and leaves text empty. Reading only
      // text is what made a finished report look like a failed one and fall back to a raw note.
      providerOptions: { groq: { reasoningFormat: "parsed" } },
      abortSignal: signal ? AbortSignal.any([signal, reserve]) : reserve,
    });
    const report = usableProse(result);
    if (report) return report + truncatedNote;
    failure = "the model returned no usable prose";
    console.warn("[writeReport] no usable prose; falling back to the purchase list");
  } catch (error) {
    failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`[writeReport] ${failure}`);
  }

  // No model output. The agent's last note is an internal thought rather than an answer, so it is
  // labelled as one instead of being presented as the report.
  return [
    truncated
      ? `The run reached its time budget before the agent wrote its conclusion.`
      : `The agent stopped without writing a conclusion.`,
    ``,
    `**What it paid for**`,
    bought,
    ``,
    `**Where it had got to**`,
    notes[notes.length - 1],
  ].join("\n");
}

/**
 * Runs one agent task and emits every step. Never throws: a failure is an `error` event, because
 * the caller is a stream that still has to close cleanly and a page that still has to say why.
 */
export async function runAgentStream(input: RunInput, emit: Emit): Promise<void> {
  const driver: RunDriver = input.driver;
  const task = input.task?.trim() || DEFAULT_TASK;
  const budgetUsd = input.budgetUsd ?? DEFAULT_BUDGET_USD;
  const totals: Totals = { spentMinor: 0n, blockedMinor: 0n, heldMinor: 0n, settled: 0, calls: 0 };
  let seq = 0;

  emit({
    type: "run-start",
    driver,
    agent: input.agentName ?? "ConsoleBot",
    task,
    budgetUsd,
    maxSteps: MAX_STEPS,
    scenario: input.scenario,
  });

  // seq is assigned when the model commits to a tool, and reused when the Guard answers, so the
  // UI can pair a pending row with its decision instead of guessing by order of arrival.
  const pending = new Map<ToolName, number[]>();

  const onStart = (record: { tool: ToolName; priceUsd: string; args: unknown }) => {
    seq += 1;
    const queue = pending.get(record.tool) ?? [];
    queue.push(seq);
    pending.set(record.tool, queue);
    emit({ type: "tool-call", seq, tool: record.tool, priceUsd: record.priceUsd, args: record.args });
  };

  const onInjection = (snippet: string) => emit({ type: "injection", snippet });

  const onCall = (record: ToolCallRecord) => {
    const outcome = outcomeOf(record);
    tally(totals, record, outcome);
    purchases.push(`${record.tool} $${record.priceUsd} — ${outcome}${record.code ? ` (${record.code})` : ""}`);
    emit({
      type: "tool-result",
      seq: pending.get(record.tool)?.shift() ?? seq,
      tool: record.tool,
      priceUsd: record.priceUsd,
      outcome,
      code: record.code,
      txHash: record.txHash,
      explorerUrl: record.explorerUrl,
      intentId: record.intentId,
    });
  };

  let finished = false;
  const finish = (answer: string, steps: number) => {
    if (finished) return;
    finished = true;
    emit({
      type: "done",
      answer,
      spentUsd: toUsd(totals.spentMinor),
      blockedUsd: toUsd(totals.blockedMinor),
      heldUsd: toUsd(totals.heldMinor),
      steps,
      toolCalls: totals.calls,
      settledCount: totals.settled,
    });
  };

  // Declared out here so the catch can tell "we stopped ourselves" from a genuine failure.
  const deadline = AbortSignal.timeout(Math.max(5_000, RUN_BUDGET_MS - WRAPUP_BUDGET_MS));
  const ranOutOfTime = () => deadline.aborted;

  // What the agent said as it worked, and what it bought. Both feed the wrap-up when the tool
  // phase is cut short, so the report is built from the run rather than invented after it.
  const notes: string[] = [];
  const purchases: string[] = [];

  try {
    if (driver === "scripted") {
      await runScripted(input, onStart, onCall, emit, onInjection);
      finish(SCRIPTED_ANSWER, SCRIPT.length);
      return;
    }


    if (!env.GROQ_API_KEY) {
      emit({ type: "error", message: "GROQ_API_KEY is not set. Switch the driver to Scripted to run without a model." });
      return;
    }

    const tools = buildTools(onCall, input.scenario, { guardKey: input.guardKey, onStart, onInjection });

    // generateText().text is only the LAST step's text. When a run ends on a tool call that
    // produces no prose, it is empty — so the most recent non-empty text is kept as the answer.
    let lastText = "";
    // gpt-oss-120b often stops on a tool call and emits no closing prose. Its last note is not an
    // answer and is not labelled as one, but an empty panel reads as a crash when the run was fine.
    let lastReasoning = "";

    // AbortSignal.any so a client that navigates away still cancels immediately, rather than the
    // run continuing to spend until the time budget elapses.
    const runSignal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline;

    const { text, steps } = await generateText({
      model: groq("openai/gpt-oss-120b"),
      system: SYSTEM_PROMPT,
      prompt: `${task}\n\nBudget remaining: ${budgetUsd}.`,
      tools,
      temperature: 0,
      stopWhen: stepCountIs(MAX_STEPS),
      // "parsed" keeps the chain of thought in reasoningText. Under "raw" it arrives inside text
      // wrapped in <think> markup, which would render as garbage on a screen judges are watching.
      providerOptions: { groq: { reasoningFormat: "parsed" } },
      // onStepEnd, not the deprecated onStepFinish alias. It fires after the step's tools have
      // already been executed, so this narrates what the model said, never a prediction of it.
      abortSignal: runSignal,
      onStepEnd: (step) => {
        const said = readStepText(step);
        if (said.text) lastText = said.text;
        if (said.reasoning) lastReasoning = said.reasoning;
        const shown = said.reasoning || said.text;
        if (shown) {
          notes.push(shown);
          emit({ type: "thinking", step: said.stepNumber, text: shown });
        }
      },
    });

    // A run that ends on a tool call leaves no closing prose, and this model often answers entirely
    // in reasoning. Printing that raw put an internal thought — sometimes with a JSON fragment
    // trailing it — where the answer belongs, so it gets written up the same way a truncated run is.
    // Only the final step's text is a conclusion. An earlier step's text is mid-run chatter and
    // arrives with the tool-call JSON trailing it, which is what used to be printed as the answer.
    const answer = text?.trim()
      || (await writeReport(task, notes.length ? notes : [lastText || lastReasoning], purchases, false, input.signal));
    finish(answer, steps.length);
  } catch (error) {
    // Running out of time is a bounded run, not a fault: every payment already made is real and
    // already counted, so it closes with a `done` and no error banner.
    if (ranOutOfTime()) {
      finish(await writeReport(task, notes, purchases, true, input.signal), totals.calls);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    emit({ type: "error", message });
    // Then close the run anyway. Every payment above this line already happened.
    finish(`The run ended early: ${message}`, totals.calls);
  }
}

/** The deterministic driver: same tools, same Guard, no model. */
async function runScripted(
  input: RunInput,
  onStart: (r: { tool: ToolName; priceUsd: string; args: unknown }) => void,
  onCall: (r: ToolCallRecord) => void,
  emit: Emit,
  onInjection?: (snippet: string) => void,
): Promise<void> {
  for (const [index, entry] of SCRIPT.entries()) {
    if (input.signal?.aborted) return;
    // Narrated from inside onStart so the caption lands on its own row. Emitting it before the
    // call put every thought against the previous payment.
    await callPaidTool(entry.tool, entry.args, onCall, input.scenario, {
      guardKey: input.guardKey,
      onStart: (record) => {
        onStart(record);
        emit({ type: "thinking", step: index + 1, text: scriptedNarration(entry.tool, entry.args) });
      },
      onInjection,
    });
  }
}

/** Stands in for the model's reasoning, so both drivers fill the same column. */
function scriptedNarration(tool: ToolName, args: Record<string, unknown>): string {
  const price = PRICING[TOOL_ENDPOINTS[tool]];
  if (tool === "premiumReport") {
    return args.edition === "analyst"
      ? `The full report was refused. Trying the cut-down analyst edition at ${PREMIUM_REPORT_EDITIONS.analyst}.`
      : `Considering the full premium report at ${price}. It may be worth it.`;
  }
  const why: Record<string, string> = {
    search: "Need current capacity data before anything else.",
    factCheck: "The headline figure should be verified against a second source.",
    summarize: "Enough gathered — writing this up.",
    extract: "Pulling the tables out of the source document.",
  };
  return `${why[tool] ?? "Calling this tool."} ($${price})`;
}
