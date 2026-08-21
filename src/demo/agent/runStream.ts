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
      abortSignal: input.signal,
      onStepEnd: (step) => {
        const said = readStepText(step);
        if (said.text) lastText = said.text;
        if (said.reasoning) lastReasoning = said.reasoning;
        const shown = said.reasoning || said.text;
        if (shown) emit({ type: "thinking", step: said.stepNumber, text: shown });
      },
    });

    const answer = (text?.trim() || lastText).trim()
      || (lastReasoning ? `The model stopped without writing a conclusion. Its last note: ${lastReasoning}` : "")
      || "The model stopped without writing a conclusion.";
    finish(answer, steps.length);
  } catch (error) {
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
