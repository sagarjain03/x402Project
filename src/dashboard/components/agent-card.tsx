import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import {
  ArrowRight,
  Bot,
  Gauge,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/dashboard/components/ui/card";
import { Badge } from "@/dashboard/components/ui/badge";
import { Progress } from "@/dashboard/components/ui/progress";
import { cn } from "@/lib/utils";
import { networkLabel } from "@/shared/explorer";

export interface AgentItem {
  id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "FROZEN";
  /** Null until a wallet is attached. A freshly registered agent has none. */
  walletAddress: string | null;
  /** The rail this agent's wallet is funded on, so a card never implies the wrong chain. */
  walletNetwork: string | null;
  walletAllowanceCapUsd: string;
  walletFundedUsd: string;
  /**
   * Spend in the month window, and the ceiling it is measured against. Both null until the budgets
   * endpoint answers — rendering "0.00" for "not known yet" reads as "this agent has spent
   * nothing", which is the opposite claim.
   */
  spentUsd: string | null;
  monthBudgetUsd: string | null;
  reservedUsd: string | null;
  activePolicyId: string;
  activePolicyVersion: number;
  frozenAt?: string;
  frozenReason?: string;
  createdAt: string;
}

/** What CORE actually serves — see toAgentDto in src/core/handlers/serialize.ts. */
export interface AgentRow {
  agentId: string;
  name: string;
  description: string;
  status: "ACTIVE" | "FROZEN";
  activePolicyId: string;
  wallet: { address: string; network: string; allowanceCapUsd: string; fundedUsd: string };
  frozenAt?: string | null;
  frozenReason?: string | null;
  createdAt: string;
}

// The cards want a flat shape; CORE groups the wallet. Reading agent.walletAddress off the raw row
// throws on .slice and takes the whole page down, so the flattening happens on the way in.
// Spend has no source on the agents endpoints — it lives on /api/v1/budgets/:agentId, so it stays
// null here and the caller fills it in once that request answers.
export function toAgentItem(row: AgentRow, activePolicyVersion = 0): AgentItem {
  return {
    id: row.agentId,
    name: row.name,
    description: row.description,
    status: row.status,
    walletAddress: row.wallet.address ?? null,
    walletNetwork: row.wallet.network ?? null,
    walletAllowanceCapUsd: row.wallet.allowanceCapUsd,
    walletFundedUsd: row.wallet.fundedUsd,
    spentUsd: null,
    monthBudgetUsd: null,
    reservedUsd: null,
    activePolicyId: row.activePolicyId,
    activePolicyVersion,
    frozenAt: row.frozenAt ?? undefined,
    frozenReason: row.frozenReason ?? undefined,
    createdAt: row.createdAt,
  };
}

/** OWNER: UI · Agent summary card: status, wallet, and how much of its month budget is gone. */
export function AgentCard({ agent, onStatusChange }: { agent: AgentItem; onStatusChange?: () => void }) {
  const [currentStatus, setCurrentStatus] = useState<"ACTIVE" | "FROZEN">(agent.status);
  const [toggling, setToggling] = useState(false);
  const isFrozen = currentStatus === "FROZEN";

  const handleToggleFreeze = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setToggling(true);
      if (isFrozen) {
        await apiPost(API.unfreeze(agent.id), {});
        setCurrentStatus("ACTIVE");
      } else {
        await apiPost(API.freeze(agent.id), { reason: "Operator dashboard manual freeze" });
        setCurrentStatus("FROZEN");
      }
      onStatusChange?.();
    } catch (err) {
      console.error("[AgentCard] Freeze toggle failed:", err);
    } finally {
      setToggling(false);
    }
  };

  // Spent and reserved together, because that is what the budget rule compares to the ceiling.
  const spent = agent.spentUsd === null ? null : Number(agent.spentUsd) || 0;
  const reserved = agent.reservedUsd === null ? 0 : Number(agent.reservedUsd) || 0;
  const budget = agent.monthBudgetUsd === null ? null : Number(agent.monthBudgetUsd) || 0;
  const percent =
    spent === null || budget === null || budget === 0
      ? null
      : Math.min(100, Math.round(((spent + reserved) / budget) * 100));

  return (
    <Card
      className={cn(
        "flex flex-col justify-between overflow-hidden transition-all hover:shadow-md",
        isFrozen ? "border-rose-300 bg-rose-50/10" : "border-zinc-200 bg-white"
      )}
    >
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                isFrozen
                  ? "border border-rose-200 bg-rose-100 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              )}
            >
              {isFrozen ? <Lock className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </div>
            <h3 className="text-base font-bold text-zinc-900">{agent.name}</h3>
          </div>

          <Badge
            variant={isFrozen ? "destructive" : "success"}
            className="gap-1.5 font-mono text-xs font-semibold"
          >
            {isFrozen ? (
              <>
                <ShieldAlert className="h-3.5 w-3.5" />
                FROZEN
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                ACTIVE
              </>
            )}
          </Badge>
        </div>

        <p className="line-clamp-2 text-xs text-zinc-600">{agent.description}</p>

        {isFrozen && agent.frozenReason && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <span className="font-semibold">Frozen reason:</span> {agent.frozenReason}
          </div>
        )}

        <div className="space-y-2 border-t border-zinc-100 pt-2 text-xs">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-zinc-400" />
              Wallet
            </span>
            <span className="font-mono font-medium text-zinc-800">
              {agent.walletAddress
                ? `${agent.walletAddress.slice(0, 6)}…${agent.walletAddress.slice(-4)}`
                : "not attached"}
            </span>
          </div>

          <div className="flex items-center justify-between text-zinc-500">
            <span>Network</span>
            <span className="font-mono font-medium text-zinc-800">
              {networkLabel(agent.walletNetwork)}
            </span>
          </div>

          <div className="flex items-center justify-between text-zinc-500">
            <span>Wallet allowance cap</span>
            <span className="font-mono font-medium text-zinc-800">${agent.walletAllowanceCapUsd}</span>
          </div>

          <div className="flex items-center justify-between text-zinc-500">
            <span>Active policy</span>
            <Link
              href={`/policies/${agent.id}`}
              className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
            >
              <span>{agent.activePolicyVersion > 0 ? `v${agent.activePolicyVersion}` : "Configure"}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Month budget utilisation — the window the engine actually enforces */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-zinc-500">
              <Gauge className="h-3.5 w-3.5 text-zinc-400" />
              Month budget used
            </span>
            <span className="font-mono font-bold text-zinc-900">
              {spent === null || budget === null
                ? "not available"
                : `$${spent.toFixed(2)} / $${budget.toFixed(2)} (${percent}%)`}
            </span>
          </div>
          {percent !== null ? (
            <Progress
              value={percent}
              indicatorClassName={
                isFrozen || percent >= 100
                  ? "bg-rose-500"
                  : percent >= 75
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }
            />
          ) : (
            <div className="h-2 w-full rounded-full bg-zinc-100" />
          )}
          {reserved > 0 && (
            <p className="font-mono text-[11px] text-zinc-400">
              includes ${reserved.toFixed(2)} reserved and not yet settled
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-3 text-xs">
        <span className="font-mono text-zinc-400">Funded: ${agent.walletFundedUsd} USDC</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleFreeze}
            disabled={toggling}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer",
              isFrozen
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
            )}
          >
            {toggling ? "…" : isFrozen ? "Unfreeze" : "Freeze"}
          </button>
          <Link
            href={`/agents/${agent.id}`}
            className="inline-flex items-center gap-1 font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
          >
            <span>View details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
