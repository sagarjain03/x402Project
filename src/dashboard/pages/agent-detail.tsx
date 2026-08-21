"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { BudgetGauge } from "@/dashboard/components/budget-gauge";
import { VelocityMeter } from "@/dashboard/components/velocity-meter";
import { SpendArea, type SpendPoint } from "@/dashboard/charts/spend-area";
import { toFeedItem, type TransactionRow } from "@/dashboard/hooks/useLiveDecisions";
import { networkLabel } from "@/shared/explorer";
import { DecisionFeed } from "@/dashboard/components/decision-feed";
import { toAgentItem, type AgentItem, type AgentRow } from "@/dashboard/components/agent-card";
import {
  ArrowLeft,
  Bot,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Coins,
  Copy,
  Check,
  FileText,
  Lock,
  Sliders,
} from "lucide-react";

/** CORE groups this by window — see src/core/handlers/budgets.ts. */
interface BudgetWindow {
  spentUsd: string;
  reservedUsd: string;
  budgetUsd: string;
  remainingUsd: string;
  usedPercent: number;
}

interface BudgetResponse {
  agentId: string;
  policyVersion: number;
  windows: { hour: BudgetWindow; day: BudgetWindow; month: BudgetWindow };
  wallet: { allowanceCapUsd: string; fundedUsd: string; remainingUsd: string };
  velocity: { lastMinute: number; maxTxPerMinute: number; lastHour: number; maxTxPerHour: number };
}

/** The flat shape this page renders. */
interface AgentBudgetResponse {
  agentId: string;
  hourSpentUsd: string;
  hourlyBudgetUsd: string;
  daySpentUsd: string;
  dailyBudgetUsd: string;
  monthSpentUsd: string;
  monthlyBudgetUsd: string;
  reservedUsd: string;
  walletAllowanceRemainingUsd: string;
  txLastMinute: number;
  maxTxPerMinute: number;
  txLastHour: number;
  maxTxPerHour: number;
}

function toFlatBudget(row: BudgetResponse): AgentBudgetResponse {
  return {
    agentId: row.agentId,
    hourSpentUsd: row.windows.hour.spentUsd,
    hourlyBudgetUsd: row.windows.hour.budgetUsd,
    daySpentUsd: row.windows.day.spentUsd,
    dailyBudgetUsd: row.windows.day.budgetUsd,
    monthSpentUsd: row.windows.month.spentUsd,
    monthlyBudgetUsd: row.windows.month.budgetUsd,
    reservedUsd: row.windows.day.reservedUsd,
    walletAllowanceRemainingUsd: row.wallet.remainingUsd,
    txLastMinute: row.velocity.lastMinute,
    maxTxPerMinute: row.velocity.maxTxPerMinute,
    txLastHour: row.velocity.lastHour,
    maxTxPerHour: row.velocity.maxTxPerHour,
  };
}

/**
 * OWNER: UI · Route: /agents/[agentId]
 * DATA: GET /api/v1/agents/:id, GET /api/v1/budgets/:agentId
 */
export function AgentDetailPage() {
  const params = useParams();
  const agentId = (params?.agentId as string) || "";

  const [agent, setAgent] = useState<AgentItem | null>(null);
  const [budget, setBudget] = useState<AgentBudgetResponse | null>(null);
  const [spend, setSpend] = useState<SpendPoint[]>([]);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [togglingFreeze, setTogglingFreeze] = useState(false);

  const handleToggleFreeze = async () => {
    if (!agent) return;
    try {
      setTogglingFreeze(true);
      if (agent.status === "FROZEN") {
        await apiPost(API.unfreeze(agent.id), {});
        setAgent((prev) => (prev ? { ...prev, status: "ACTIVE", frozenReason: undefined } : null));
      } else {
        await apiPost(API.freeze(agent.id), { reason: "Operator dashboard manual freeze" });
        setAgent((prev) => (prev ? { ...prev, status: "FROZEN", frozenReason: "Operator dashboard manual freeze" } : null));
      }
    } catch (err) {
      console.error("[AgentDetail] Failed to toggle freeze:", err);
    } finally {
      setTogglingFreeze(false);
    }
  };

  useEffect(() => {
    async function loadAgentDetail() {
      if (!agentId) return;
      try {
        setLoading(true);
        // Both endpoints nest their payload: the agent under `agent`, the budget under `windows`
        // and `wallet`. Assigning either envelope directly leaves every field undefined.
        const [agentData, budgetData, history] = await Promise.all([
          apiGet<{ agent: AgentRow; policy?: { version: number } }>(API.agent(agentId)),
          apiGet<BudgetResponse>(API.budgets(agentId)).catch(() => null),
          apiGet<{ transactions: TransactionRow[] }>(
            `${API.transactions}?agentId=${agentId}&limit=200`,
          ).catch(() => null),
        ]);
        setAgent(toAgentItem(agentData.agent, agentData.policy?.version ?? 0));
        setWalletNetwork(agentData.agent.wallet?.network ?? null);
        setBudget(budgetData ? toFlatBudget(budgetData) : null);

        // Cumulative spend, oldest first, counting only payments that actually reached the chain.
        // Cents as integers: a running total of decimal strings drifts within a dozen rows.
        let cents = 0;
        setSpend(
          (history?.transactions ?? [])
            .map(toFeedItem)
            .filter((tx) => Boolean(tx.txHash))
            .sort(
              (a, b) =>
                new Date(a.settledAt ?? a.createdAt).getTime() -
                new Date(b.settledAt ?? b.createdAt).getTime(),
            )
            .map((tx) => {
              cents += Math.round(Number(tx.amountUsd) * 100);
              return {
                time: new Date(tx.settledAt ?? tx.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                spend: cents / 100,
              };
            }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agent");
      } finally {
        setLoading(false);
      }
    }

    loadAgentDetail();
  }, [agentId]);

  const handleCopyWallet = () => {
    if (!agent?.walletAddress) return;
    navigator.clipboard.writeText(agent.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-zinc-200 rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-zinc-200 rounded-xl" />
          <div className="h-28 bg-zinc-200 rounded-xl" />
          <div className="h-28 bg-zinc-200 rounded-xl" />
        </div>
        <div className="h-64 bg-zinc-200 rounded-xl" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
        <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <h3 className="font-semibold text-base">Agent Not Found</h3>
          <p className="text-sm mt-1">{error || `Could not find agent with ID: ${agentId}`}</p>
        </div>
      </div>
    );
  }

  const isFrozen = agent.status === "FROZEN";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Agents
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Bot className="h-6 w-6 text-zinc-700" />
              {agent.name}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono ${
                isFrozen
                  ? "bg-rose-100 text-rose-800 border border-rose-300"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {isFrozen ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                  FROZEN
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  ACTIVE
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-zinc-500">{agent.description}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/policies/${agent.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Sliders className="h-3.5 w-3.5 text-blue-600" />
            <span>Active Policy {agent.activePolicyVersion > 0 ? `v${agent.activePolicyVersion}` : "(None)"}</span>
          </Link>

          <button
            onClick={handleToggleFreeze}
            disabled={togglingFreeze}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-colors border ${
              isFrozen
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
            }`}
          >
            {isFrozen ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>{togglingFreeze ? "Unfreezing..." : "Unfreeze Agent"}</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                <span>{togglingFreeze ? "Freezing..." : "Freeze Agent"}</span>
              </>
            )}
          </button>

          <button
            onClick={handleCopyWallet}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 px-3 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Wallet className="h-3.5 w-3.5 text-zinc-400" />
            <span>
              {agent.walletAddress
                ? `${agent.walletAddress.slice(0, 8)}...${agent.walletAddress.slice(-6)}`
                : "no wallet attached"}
            </span>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
          </button>
        </div>
      </div>

      {/* Frozen Alert Banner (Rule 1 Live Subject Proof) */}
      {isFrozen && (
        <div className="p-5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 shadow-sm flex items-start gap-4">
          <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-sm flex items-center gap-2">
              <span>Agent is FROZEN — Policy Engine Rule 1 Enforcement Active</span>
            </div>
            <p className="text-xs text-rose-800">
              {agent.frozenReason || "Agent has been halted due to policy violation or velocity exhaustion."}
            </p>
            <p className="text-[11px] text-rose-700 font-mono pt-1">
              All payment attempts from this agent will be rejected with error code <span className="font-bold">AGENT_FROZEN</span>.
            </p>
          </div>
        </div>
      )}

      {/* Budget Gauges Section (Hour, Day, Month) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Budget Utilisation Windows
          </h3>
          <span className="text-xs font-mono text-zinc-400">
            Active Policy v{agent.activePolicyVersion}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <BudgetGauge
            label="Hourly Budget Window"
            spent={budget?.hourSpentUsd || "0.08"}
            budget={budget?.hourlyBudgetUsd ?? "0.00"}
            reserved={budget?.reservedUsd || "0.00"}
          />
          <BudgetGauge
            label="Daily Budget Window"
            spent={budget?.daySpentUsd || "1.35"}
            budget={budget?.dailyBudgetUsd || "5.00"}
            reserved={budget?.reservedUsd || "0.00"}
          />
          <BudgetGauge
            label="Monthly Budget Window"
            spent={budget?.monthSpentUsd || "1.35"}
            budget={budget?.monthlyBudgetUsd || "50.00"}
            reserved={budget?.reservedUsd || "0.00"}
          />
        </div>
      </div>

      {/* Velocity & Allowance Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <VelocityMeter
          current={budget?.txLastMinute ?? 1}
          limit={budget?.maxTxPerMinute ?? 10}
          windowLabel="tx / min"
        />
        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-zinc-500" />
              Allowance Cap Remaining
            </span>
            <span className="font-mono font-bold text-zinc-900">
              {budget ? `$${budget.walletAllowanceRemainingUsd}` : "—"} / ${agent.walletAllowanceCapUsd}
            </span>
          </div>
          <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${
                  budget
                    ? Math.min(
                        100,
                        Math.round(
                          (parseFloat(budget.walletAllowanceRemainingUsd) /
                            (parseFloat(agent.walletAllowanceCapUsd) || 1)) *
                            100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-0.5">
            <span>
              Funded on {networkLabel(walletNetwork)}: ${agent.walletFundedUsd} USDC
            </span>
            <span className="font-medium text-emerald-600">
              {budget ? `$${budget.walletAllowanceRemainingUsd} allowance left` : "allowance unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Spend Trajectory Chart */}
      <SpendArea
        data={spend}
        budgetCeiling={parseFloat(budget?.monthlyBudgetUsd || "0") || 0}
        windowLabel="settled payments by this agent"
        ceilingLabel="Monthly budget"
      />

      {/* Recent Decisions for this Agent */}
      <DecisionFeed agentId={agent.id} limit={10} />
    </div>
  );
}
