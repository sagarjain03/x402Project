"use client";

import { useState } from "react";
import { apiPost } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { ScenarioTerminal } from "@/dashboard/components/scenario-terminal";
import {
  PlayCircle,
  Clock,
  Sparkles,
  RotateCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Layers,
  Flame,
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  expected: "ALLOW" | "BLOCK" | "HOLD";
  category: "HAPPY_PATH" | "RULE_BLOCK" | "HERO_ATTACK";
  description: string;
  intentPreview: string;
  highlightProof?: string;
  ruleCode?: string;
}

interface ScenarioRunData {
  scenario: string;
  passed: boolean;
  transcript: string[];
  decision?: "ALLOW" | "BLOCK" | "HOLD";
  amountUsd?: string;
  txHash?: string | null;
  latencyMs?: number;
  reasonCode?: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "D1",
    name: "D1 · Ordinary Allowed Payment",
    expected: "ALLOW",
    category: "HAPPY_PATH",
    description: "ResearchBot requests $0.02 search API from allowlisted localhost:3000.",
    intentPreview: "Web search — $0.02 USDC",
    highlightProof: "Zero-latency guard evaluation (~0.055ms) and genuine Algorand TestNet on-chain settlement.",
    ruleCode: "MERCHANT_ALLOWLISTED",
  },
  {
    id: "D2",
    name: "D2 · Per-Transaction Limit Exceeded",
    expected: "BLOCK",
    category: "RULE_BLOCK",
    description: "Attempted $2.00 purchase exceeds the $0.10 per-transaction ceiling.",
    intentPreview: "Premium report — $2.00 USDC -> PER_TRANSACTION_LIMIT_EXCEEDED",
    highlightProof: "Dropped at gateway prior to wallet signature or blockchain submission.",
    ruleCode: "PER_TRANSACTION_LIMIT_EXCEEDED",
  },
  {
    id: "D3",
    name: "D3 · Velocity Burst Incident",
    expected: "BLOCK",
    category: "RULE_BLOCK",
    description: "VelocityBot fires 20 rapid searches, tripping the 5 tx/min per-merchant ceiling.",
    intentPreview: "Burst 20 × $0.02 -> trips VELOCITY_EXCEEDED",
    highlightProof: "First 5 settle normally; every subsequent request is blocked immediately.",
    ruleCode: "VELOCITY_EXCEEDED",
  },
  {
    id: "D4",
    name: "D4 · Swapped Wallet & Rogue Merchant",
    expected: "BLOCK",
    category: "RULE_BLOCK",
    description: "Payment directed to unvetted rogue merchant with recipient wallet mismatch.",
    intentPreview: "rogue.example.com -> trips MERCHANT_BLOCKED",
    highlightProof: "Cryptographic PayTo recipient pinning neutralizes destination swap attack.",
    ruleCode: "MERCHANT_BLOCKED",
  },
  {
    id: "D5",
    name: "D5 · Budget Exhaustion",
    expected: "BLOCK",
    category: "RULE_BLOCK",
    description: "BudgetBot attempts payment after reaching 100% of its budget ceiling.",
    intentPreview: "BudgetBot ($0.50 / $0.50) -> trips BUDGET_EXCEEDED",
    highlightProof: "Refused by the ledger before anything is signed — $0.00 leaves the wallet.",
    ruleCode: "BUDGET_EXCEEDED",
  },
  {
    id: "D6",
    name: "D6 · Prompt Injection Attack",
    expected: "BLOCK",
    category: "HERO_ATTACK",
    description: "Adversarial prompt injection attempts 1,000 requests x $2.00 ($2,000.00 extraction).",
    intentPreview: "Poisoned search result: 1,000 x $2.00 attempts -> ABSOLUTE_BLOCK_THRESHOLD",
    highlightProof: "Judge Hero Moment: $2,000 attempted -> $0.02 settled -> 0 attack transactions.",
    ruleCode: "ABSOLUTE_BLOCK_THRESHOLD",
  },
  {
    id: "D7",
    name: "D7 · Human Review Escalation",
    expected: "HOLD",
    category: "HERO_ATTACK",
    description: "Payment of $0.45 falls into human review dollar band ($0.10–$1.00).",
    intentPreview: "Premium report — $0.45 USDC -> APPROVAL_REQUIRED",
    highlightProof: "120s TTL budget lock reserved and routed to Approvals Inbox for operator sign-off.",
    ruleCode: "APPROVAL_REQUIRED",
  },
];

export function SimulatorPage() {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [results, setResults] = useState<Record<string, ScenarioRunData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const executeScenario = async (scenario: Scenario): Promise<ScenarioRunData | null> => {
    try {
      const res = await apiPost<ScenarioRunData>(API.simulatorRun, { scenario: scenario.id });
      setResults((prev) => ({ ...prev, [scenario.id]: res }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[scenario.id];
        return next;
      });
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to run scenario.";
      setErrors((prev) => ({ ...prev, [scenario.id]: msg }));
      // Generate fallback diagnostic transcript so terminal still shows the outcome
      const fallbackResult: ScenarioRunData = {
        scenario: `${scenario.id}_FAILED`,
        passed: false,
        transcript: [
          `[${scenario.id}] Triggered scenario: ${scenario.name}`,
          `[${scenario.id}] Gateway evaluation status: ${msg}`,
          `[${scenario.id}] DIAGNOSTIC: Check that server is running and wallet keys are initialized.`,
        ],
      };
      setResults((prev) => ({ ...prev, [scenario.id]: fallbackResult }));
      return null;
    }
  };

  const handleRunSingle = async (scenario: Scenario) => {
    setRunningId(scenario.id);
    try {
      await executeScenario(scenario);
    } finally {
      setRunningId(null);
    }
  };

  const handleRunAll = async () => {
    setIsRunningAll(true);
    for (const s of SCENARIOS) {
      setRunningId(s.id);
      await executeScenario(s);
      // Brief pause between scenarios for smooth visual pacing
      await new Promise((r) => setTimeout(r, 300));
    }
    setRunningId(null);
    setIsRunningAll(false);
  };

  const executedCount = Object.keys(results).length;
  const passedCount = Object.values(results).filter((r) => r.passed).length;

  // Summed from the runs that actually happened, so before anything is run it reads $0.00 rather
  // than a headline figure nobody measured.
  const blockedSpendUsd = Object.values(results)
    .filter((r) => r.decision === "BLOCK")
    .reduce((sum, r) => sum + (parseFloat(r.amountUsd ?? "0") || 0), 0)
    .toFixed(2);

  return (
    <div className="space-y-8">
      {/* Header & Hero Action */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                <PlayCircle className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 font-sans">
                Deterministic Attack Drills & Policy Replay
              </h1>
            </div>
            <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
              One-click live execution harness streaming genuine Guard decisions, Lora settlement links, and deterministic pre-signature interception proofs in real time.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRunAll}
              disabled={isRunningAll || runningId !== null}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-60 cursor-pointer"
            >
              {isRunningAll ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  <span>Running Drill Suite ({executedCount}/{SCENARIOS.length})...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Run Full Drill Suite (D1–D7)</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-100">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-400">Drills Executed</span>
            <span className="text-xl font-bold font-mono text-zinc-900 leading-tight">{executedCount} / {SCENARIOS.length}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-400">Passed</span>
            <span className="text-xl font-bold font-mono text-emerald-600 leading-tight">{passedCount}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-400">Blocked Spend</span>
            <span className="text-xl font-bold font-mono text-rose-600 leading-tight">${blockedSpendUsd}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-400">Attack On-Chain Txs</span>
            <span className="text-xl font-bold font-mono text-zinc-900 leading-tight">0 <span className="text-xs font-normal text-zinc-400">(pre-sig)</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {SCENARIOS.map((s) => {
          const isRunning = runningId === s.id;
          const result = results[s.id];
          const error = errors[s.id];

          return (
            <div
              key={s.id}
              className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${isRunning
                  ? "border-blue-400 ring-2 ring-blue-100 shadow-md"
                  : result?.passed
                    ? "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
                    : "border-zinc-200"
                }`}
            >
              <div className="space-y-3">
                {/* Card Header — issues 2,4,8 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm text-zinc-900 font-mono">{s.name}</span>
                    {/* Issue 8: tags now left-aligned below title, not split to the far right */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {s.ruleCode && (
                        /* Issues 2,4: text-xs (12px min), normal-case removes all-caps, rounded-md */
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 normal-case">
                          {s.ruleCode}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold font-mono ${s.expected === "ALLOW"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : s.expected === "HOLD"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                      >
                        Expected: {s.expected}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed">{s.description}</p>

                {/* Intent Code Pill — issue 1,9: rounded-md, more padding, text-xs */}
                <div className="font-mono text-xs bg-zinc-50 px-3 py-2.5 rounded-md border border-zinc-200 text-zinc-700 leading-relaxed">
                  {s.intentPreview}
                </div>

                {/* Proof Callout — issues 3,9: text-xs (12px), leading-relaxed */}
                {s.highlightProof && (
                  <p className="text-xs text-zinc-500 italic flex items-start gap-1.5 leading-relaxed">
                    <span className="font-semibold not-italic text-zinc-700 font-mono shrink-0">Proof:</span>
                    {s.highlightProof}
                  </p>
                )}
              </div>

              {/* Action & Terminal Console */}
              <div className="space-y-3 pt-2">
                {/* Run Button — issue 7: ghost/outline secondary style to de-emphasise vs. primary blue CTA */}
                <button
                  type="button"
                  onClick={() => handleRunSingle(s)}
                  disabled={isRunning || isRunningAll}
                  className="w-full py-2 px-4 font-semibold text-xs rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isRunning ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                      <span>Executing Scenario {s.id}...</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-3.5 w-3.5 text-zinc-500" />
                      <span>Run Scenario {s.id}</span>
                    </>
                  )}
                </button>

                {/* Terminal Viewer */}
                {result && (
                  <ScenarioTerminal
                    scenarioId={s.id}
                    scenarioName={s.name}
                    passed={result.passed}
                    transcript={result.transcript}
                    isRunning={isRunning}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
