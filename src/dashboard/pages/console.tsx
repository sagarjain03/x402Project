"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { explorerTxUrl, explorerName } from "@/shared/explorer";
import { ERROR_CODES, type ErrorCode } from "@/shared/errors";
import {
  Bot,
  Brain,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Loader2,
  Play,
  AlertOctagon,
  Square,
  Syringe,
  UserCheck,
  Zap,
} from "lucide-react";

function humanErrorMessage(code?: string): string | null {
  if (!code) return null;
  if (code in ERROR_CODES) {
    return ERROR_CODES[code as ErrorCode].message;
  }
  return code;
}

/**
 * OWNER: UI · The Agent Console.
 *
 * Left column is what the agent decided, right column is what the Guard decided about it. That
 * split is the whole product argument on one screen: the model chooses freely and still cannot
 * move money the policy refuses.
 *
 * The run arrives as NDJSON over a POST, so this reads the body itself — apiGet/apiPost buffer to
 * EOF and would hang until the run finished, which is exactly the silence the page exists to avoid.
 */

type GuardOutcome = "ALLOW" | "HOLD" | "BLOCK";
type RunDriver = "live" | "scripted";

type RunEvent =
  | { type: "run-start"; driver: RunDriver; agent: string; task: string; budgetUsd: string; maxSteps: number; scenario?: string }
  | { type: "thinking"; step: number; text: string }
  | { type: "injection"; snippet: string }
  | { type: "tool-call"; seq: number; tool: string; priceUsd: string; args: unknown }
  | { type: "tool-result"; seq: number; tool: string; priceUsd: string; outcome: GuardOutcome; code?: string; txHash?: string; explorerUrl?: string; intentId?: string }
  | { type: "done"; answer: string; spentUsd: string; blockedUsd: string; heldUsd: string; steps: number; toolCalls: number; settledCount: number }
  | { type: "error"; message: string };

interface AgentOption {
  agentId: string;
  name: string;
  status: string;
}

/** One tool call and whatever the Guard said about it. Paired by seq, not by arrival order. */
interface CallRow {
  seq: number;
  tool: string;
  priceUsd: string;
  args: unknown;
  outcome?: GuardOutcome;
  code?: string;
  txHash?: string;
  explorerUrl?: string;
  intentId?: string;
  approvedAt?: string;
  network?: string;
}

interface Thought {
  step: number;
  text: string;
  /** Where this thought sits relative to the calls, so the two columns stay in step. */
  afterSeq: number;
}

const DEFAULT_TASK =
  "Find the current global EV battery recycling capacity. Verify the headline figure once, then " +
  "write a short summary. Buy the premium report only if you judge it essential.";

/** Guard keys are seeded per agent; the console needs the key, not the id, to pay as that agent. */
const GUARD_KEYS: Record<string, string> = {
  ConsoleBot: "gk_live_consolebot_demo",
  ResearchBot: "gk_live_researchbot_demo",
  VelocityBot: "gk_live_velocitybot_demo",
  BudgetBot: "gk_live_budgetbot_demo",
};

const OUTCOME_STYLES: Record<GuardOutcome, { chip: string; icon: typeof CheckCircle2; label: string }> = {
  ALLOW: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "ALLOW" },
  HOLD: { chip: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, label: "HOLD" },
  BLOCK: { chip: "bg-red-50 text-red-700 border-red-200", icon: AlertOctagon, label: "BLOCK" },
};

export function ConsolePage() {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentName, setAgentName] = useState("ConsoleBot");
  const [driver, setDriver] = useState<RunDriver>("live");
  const [task, setTask] = useState(DEFAULT_TASK);
  const [injected, setInjected] = useState(false);

  const [running, setRunning] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [summary, setSummary] = useState<Extract<RunEvent, { type: "done" }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [injection, setInjection] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Read inside the stream loop, which closes over state that would otherwise be stale.
  const seqRef = useRef(0);

  useEffect(() => {
    apiGet<{ agents: AgentOption[] }>(API.agents)
      .then((data) => setAgents((data?.agents ?? []).filter((a) => a.status === "ACTIVE")))
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const applyEvent = useCallback((event: RunEvent) => {
    switch (event.type) {
      case "tool-call":
        seqRef.current = event.seq;
        setCalls((prev) => [...prev, { seq: event.seq, tool: event.tool, priceUsd: event.priceUsd, args: event.args }]);
        break;
      case "tool-result":
        setCalls((prev) =>
          prev.map((row) =>
            row.seq === event.seq
              ? { ...row, outcome: event.outcome, code: event.code, txHash: event.txHash, explorerUrl: event.explorerUrl, intentId: event.intentId }
              : row,
          ),
        );
        break;
      case "thinking":
        setThoughts((prev) => [...prev, { step: event.step, text: event.text, afterSeq: seqRef.current }]);
        break;
      case "done":
        setSummary(event);
        break;
      case "injection":
        setInjection(event.snippet);
        break;
      case "error":
        setError(event.message);
        break;
      default:
        break;
    }
  }, []);

  const run = useCallback(async () => {
    setCalls([]);
    setThoughts([]);
    setSummary(null);
    setError(null);
    setInjection(null);
    seqRef.current = 0;
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(API.consoleRun, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          driver,
          task,
          agentName,
          guardKey,
          ...(injected ? { scenario: "D6" } : {}),
        }),
      });

      if (!response.ok || !response.body) {
        setError(`The run could not be started (HTTP ${response.status}).`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let closed = false;

      // NDJSON: one event per line. A chunk can split a line in half, so the tail is kept.
      for (; ;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as RunEvent;
            if (event.type === "done" || event.type === "error") closed = true;
            applyEvent(event);
          } catch {
            // A malformed frame must not kill the run that is still streaming behind it.
          }
        }
      }
      if (!closed) {
        setError("The run stream ended before the agent finished. Anything above this line still happened; the totals are incomplete.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : "The run stream failed.");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [agentName, applyEvent, driver, injected, task]);

  const approve = useCallback(async (intentId: string) => {
    setApproving(intentId);
    try {
      await apiPost(API.approve(intentId), { note: "approved from the agent console", reviewerEmail: "operator@aspg.dev" });
      setCalls((prev) => prev.map((row) => (row.intentId === intentId ? { ...row, approvedAt: new Date().toISOString() } : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setApproving(null);
    }
  }, []);

  const settled = calls.filter((c) => c.outcome === "ALLOW").length;
  const blocked = calls.filter((c) => c.outcome === "BLOCK").length;
  const held = calls.filter((c) => c.outcome === "HOLD").length;

  // Cents, summed as integers. Rows are the source until the run closes and the server sends its
  // own totals; showing $0.00 next to a settled payment is worse than showing nothing.
  const sumCents = (outcome: GuardOutcome) =>
    calls
      .filter((c) => c.outcome === outcome)
      .reduce((acc, c) => acc + Math.round(Number(c.priceUsd) * 100), 0);
  const runningUsd = (outcome: GuardOutcome) => (sumCents(outcome) / 100).toFixed(2);
  const spentUsd = summary?.spentUsd ?? runningUsd("ALLOW");
  const blockedUsd = summary?.blockedUsd ?? runningUsd("BLOCK");
  const heldUsd = summary?.heldUsd ?? runningUsd("HOLD");

  // A guard key is only handed out once, at registration. An agent whose key this page does not
  // hold cannot be paid as — and silently falling back to ResearchBot's key would label every row
  // with one agent's name while charging another agent's budget.
  const guardKey = GUARD_KEYS[agentName];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="h-6 w-6 text-blue-600" />
          Agent Console
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          The agent decides what to buy. The Guard decides whether it may. Both, live.
        </p>
      </header>

      {/* Above-the-fold Live Enforcement Counters */}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Settled Spend" value={`$${spentUsd}`} tone="text-emerald-700" icon={<CircleDollarSign className="h-4 w-4" />} />
        <Stat label="Money Refused" value={`$${blockedUsd}`} tone="text-red-700" icon={<AlertOctagon className="h-4 w-4" />} />
        <Stat label="Held in Review" value={`$${heldUsd}`} tone="text-amber-700" icon={<Clock className="h-4 w-4" />} />
        <Stat label="Decisions" value={`${settled} allow · ${held} hold · ${blocked} block`} tone="text-slate-700" icon={<CheckCircle2 className="h-4 w-4" />} />
      </dl>

      {/* ---------------------------------------------------------------- controls */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        {!guardKey && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No stored Guard key for <span className="font-semibold">{agentName}</span>. A key is shown
            once at registration and never again, so this console cannot pay as that agent. Pick a
            seeded agent to run.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent</span>
            <select
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              disabled={running}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
            >
              {(agents.length ? agents.map((a) => a.name) : ["ConsoleBot"]).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</span>
            <select
              value={driver}
              onChange={(e) => setDriver(e.target.value as RunDriver)}
              disabled={running}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
            >
              <option value="live">Live AI (Groq)</option>
              <option value="scripted">Scripted (no model)</option>
            </select>
          </label>

          <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={injected}
              onChange={(e) => setInjected(e.target.checked)}
              disabled={running}
              className="h-4 w-4 rounded border-slate-300 accent-red-600"
            />
            <span className="text-sm text-slate-700 flex items-center gap-1.5">
              <Syringe className="h-4 w-4 text-red-600" />
              Poison a search result <span className="text-slate-400">(D6)</span>
            </span>
          </label>

          <div className="ml-auto flex items-center gap-2">
            {running ? (
              <button
                onClick={stop}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                <Square className="h-4 w-4" /> Stop
              </button>
            ) : (
              <button
                onClick={run}
                disabled={!guardKey}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> Run task
              </button>
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task</span>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            disabled={running}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:opacity-60"
          />
        </label>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* The instruction the agent is about to obey. Without it on screen, the rest of the run
          looks like the agent malfunctioning rather than being taken over. */}
      {injection && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-red-800">
            <Syringe className="h-4 w-4" />
            Prompt injection detected in a merchant response
          </h2>
          <p className="mt-2 rounded-lg bg-white/70 p-3 font-mono text-xs leading-relaxed text-red-900">
            {injection}
          </p>
          <p className="mt-2 text-xs text-red-700">
            The agent received this as ordinary search data. Watch what it does next — and what the
            Guard does about it.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- two columns */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ColumnShell
          title="What the agent decided"
          icon={<Brain className="h-4 w-4 text-blue-600" />}
          empty={!running && calls.length === 0 ? "Run a task to watch the agent choose." : null}
        >
          {calls.map((call) => (
            <div key={`call-${call.seq}`}>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-mono text-xs text-slate-400">#{call.seq}</span>
                <span className="font-semibold text-sm text-slate-800">{call.tool}</span>
                <span className="ml-auto font-mono text-sm font-semibold text-slate-700">${call.priceUsd}</span>
              </div>
              {thoughts
                .filter((t) => t.afterSeq === call.seq)
                .map((t, i) => (
                  <p key={`t-${call.seq}-${i}`} className="mt-1 pl-3 border-l-2 border-slate-200 text-xs leading-relaxed text-slate-600">
                    {t.text}
                  </p>
                ))}
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> thinking…
            </div>
          )}
        </ColumnShell>

        <ColumnShell
          title="What the Guard decided"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          empty={!running && calls.length === 0 ? "Every payment is evaluated before it is signed." : null}
        >
          {calls.map((call) => (
            <GuardRow key={`guard-${call.seq}`} call={call} onApprove={approve} approving={approving === call.intentId} />
          ))}
        </ColumnShell>
      </section>

      {/* ---------------------------------------------------------------- footer */}
      {(summary || calls.length > 0) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          {summary?.answer && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Answer</h2>
              <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{summary.answer}</p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Spent" value={`${spentUsd}`} tone="text-emerald-700" icon={<CircleDollarSign className="h-4 w-4" />} />
            <Stat label="Blocked" value={`${blockedUsd}`} tone="text-red-700" icon={<AlertOctagon className="h-4 w-4" />} />
            <Stat label="Held" value={`${heldUsd}`} tone="text-amber-700" icon={<Clock className="h-4 w-4" />} />
            <Stat label="Decisions" value={`${settled} allow · ${held} hold · ${blocked} block`} tone="text-slate-700" icon={<CheckCircle2 className="h-4 w-4" />} />
          </dl>
        </section>
      )}
    </div>
  );
}

function ColumnShell({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string | null; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        {icon}
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="space-y-3 p-4 min-h-[220px]">
        {empty ? <p className="text-sm text-slate-400">{empty}</p> : children}
      </div>
    </div>
  );
}

function GuardRow({ call, onApprove, approving }: { call: CallRow; onApprove: (id: string) => void; approving: boolean }) {
  if (!call.outcome) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="font-mono text-xs text-slate-400">#{call.seq}</span>
        evaluating…
      </div>
    );
  }

  const style = OUTCOME_STYLES[call.outcome];
  const Icon = style.icon;
  // Falls back to the network the whole demo settles on; a wrong link is worse than none, and
  // explorerTxUrl returns null rather than guessing when it cannot tell.
  const href = call.explorerUrl || explorerTxUrl("algorand:testnet", call.txHash);

  return (
    <div className={`rounded-lg border px-3 py-2 ${style.chip}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-mono text-xs opacity-60">#{call.seq}</span>
        <span className="text-sm font-bold">{style.label}</span>
        <span className="ml-auto font-mono text-sm">${call.priceUsd}</span>
      </div>

      {call.code && (
        <div className="mt-1 space-y-0.5">
          <p className="font-mono text-xs font-semibold opacity-90">{call.code}</p>
          {humanErrorMessage(call.code) && (
            <p className="text-[11px] opacity-80">{humanErrorMessage(call.code)}</p>
          )}
        </div>
      )}

      {call.intentId && (
        <a href={`/transactions/${call.intentId}`} className="mt-1 block text-xs underline underline-offset-2 opacity-80 hover:opacity-100">
          full decision trace →
        </a>
      )}

      {call.outcome === "ALLOW" && href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-mono text-xs underline underline-offset-2">
          settled · view on {explorerName("algorand:testnet")} ↗
        </a>
      )}

      {call.outcome === "BLOCK" && <p className="mt-1 text-xs opacity-80">Nothing was signed. No transaction exists.</p>}

      {call.outcome === "HOLD" && call.intentId && (
        <div className="mt-2">
          {call.approvedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <UserCheck className="h-3.5 w-3.5" /> approved — the agent may retry this payment
            </span>
          ) : (
            <button
              onClick={() => onApprove(call.intentId!)}
              disabled={approving}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
              Approve as operator
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon} {label}
      </dt>
      <dd className={`mt-0.5 font-mono text-sm font-bold ${tone}`}>{value}</dd>
    </div>
  );
}
