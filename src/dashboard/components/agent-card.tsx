"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Gauge,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";

export interface AgentItem {
  id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "FROZEN";
  /** Null until a wallet is attached. A freshly registered agent has none. */
  walletAddress: string | null;
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
export function AgentCard({ agent }: { agent: AgentItem }) {
  const isFrozen = agent.status === "FROZEN";

  // Spent and reserved together, because that is what the budget rule compares to the ceiling.
  const spent = agent.spentUsd === null ? null : Number(agent.spentUsd) || 0;
  const reserved = agent.reservedUsd === null ? 0 : Number(agent.reservedUsd) || 0;
  const budget = agent.monthBudgetUsd === null ? null : Number(agent.monthBudgetUsd) || 0;
  const percent =
    spent === null || budget === null || budget === 0
      ? null
      : Math.min(100, Math.round(((spent + reserved) / budget) * 100));

  return (
    <div
      className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-white transition-all hover:shadow-md ${
        isFrozen ? "border-rose-300 bg-rose-50/10" : "border-zinc-200"
      }`}
    >
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isFrozen
                  ? "border border-rose-200 bg-rose-100 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {isFrozen ? <Lock className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </div>
            <h3 className="text-base font-bold text-zinc-900">{agent.name}</h3>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
              isFrozen
                ? "border border-rose-300 bg-rose-100 text-rose-800"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
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
            <span>Wallet allowance cap</span>
            <span className="font-mono font-medium text-zinc-800">${agent.walletAllowanceCapUsd}</span>
          </div>

          <div className="flex items-center justify-between text-zinc-500">
            <span>Active policy</span>
            <span className="font-mono font-bold text-zinc-800">
              {agent.activePolicyVersion > 0 ? `v${agent.activePolicyVersion}` : "none"}
            </span>
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
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            {percent !== null && (
              <div
                className={`h-full transition-all ${
                  isFrozen || percent >= 100
                    ? "bg-rose-500"
                    : percent >= 75
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${percent}%` }}
              />
            )}
          </div>
          {reserved > 0 && (
            <p className="font-mono text-[11px] text-zinc-400">
              includes ${reserved.toFixed(2)} reserved and not yet settled
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-3 text-xs">
        <span className="font-mono text-sm font-semibold text-slate-700">Funded: ${agent.walletFundedUsd} USDC</span>
        <Link
          href={`/agents/${agent.id}`}
          className="inline-flex items-center gap-1 font-medium text-emerald-700 transition-colors hover:text-emerald-800"
        >
          <span>View details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
