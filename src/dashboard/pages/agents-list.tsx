"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { AgentCard, toAgentItem, type AgentItem, type AgentRow } from "@/dashboard/components/agent-card";
import { CreateAgentModal } from "@/dashboard/components/create-agent-modal";
import { DecisionBar, type DecisionMixRow } from "@/dashboard/charts/decision-bar";
import { BudgetBars, type BudgetBarRow } from "@/dashboard/charts/budget-bars";
import type { TransactionRow } from "@/dashboard/hooks/useLiveDecisions";
import { Bot, Coins, Plus, ShieldAlert, ShieldCheck, TrendingDown, Zap } from "lucide-react";
import { Card } from "@/dashboard/components/ui/card";
import { Button } from "@/dashboard/components/ui/button";
import { Alert, AlertDescription } from "@/dashboard/components/ui/alert";
import { Progress } from "@/dashboard/components/ui/progress";

interface AgentsApiResponse {
  agents: AgentRow[];
  total: number;
}

interface TransactionsApiResponse {
  transactions: TransactionRow[];
}

/** The slice of /api/v1/budgets/:agentId this page reads. */
interface BudgetResponse {
  agentId: string;
  policyVersion: number;
  windows: {
    month: { spentUsd: string; reservedUsd: string; budgetUsd: string; usedPercent: number };
  };
  velocity: { lastMinute: number; maxTxPerMinute: number; lastHour: number; maxTxPerHour: number };
}

/** Cents as integers. A page total must not drift by a float. */
function sumUsd(values: (string | null)[]): string {
  const cents = values.reduce<number>((acc, v) => acc + (v ? Math.round(Number(v) * 100) : 0), 0);
  return (cents / 100).toFixed(2);
}

function Stat({
  label,
  value,
  hint,
  tone = "text-slate-900",
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
  icon: React.ReactNode;
}) {
  return (
  <Card className="rounded-2xl p-5 shadow-xs transition-all hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        {icon}
      </div>
      <div className={`mt-2 font-sans text-3xl font-extrabold tracking-tight sm:text-[34px] ${tone}`}>
        {value}
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </Card>
  );
}

export function AgentsListPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [mix, setMix] = useState<DecisionMixRow[]>([]);
  const [velocity, setVelocity] = useState<{ name: string; lastHour: number; maxPerHour: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Bumped after a create so the list refetches without a page reload.
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Decisions come from the transaction history rather than being assumed. A failure here
      // leaves the chart empty, which is honest; it must never fall back to a made-up series.
      const [roster, history] = await Promise.all([
        apiGet<AgentsApiResponse>(API.agents),
        apiGet<TransactionsApiResponse>(`${API.transactions}?limit=200`).catch(() => null),
      ]);
      const rows = roster?.agents ?? [];

      // One budget call per agent. An agent with no active policy answers NO_ACTIVE_POLICY, which
      // is a real state, not an error to surface — its card then says the spend is not available.
      const budgets = await Promise.all(
        rows.map((row) => apiGet<BudgetResponse>(API.budgets(row.agentId)).catch(() => null)),
      );

      setAgents(
        rows.map((row, i) => {
          const budget = budgets[i];
          return {
            ...toAgentItem(row, budget?.policyVersion ?? 0),
            spentUsd: budget?.windows.month.spentUsd ?? null,
            monthBudgetUsd: budget?.windows.month.budgetUsd ?? null,
            reservedUsd: budget?.windows.month.reservedUsd ?? null,
          };
        }),
      );

      setVelocity(
        rows
          .map((row, i) => ({
            name: row.name,
            lastHour: budgets[i]?.velocity.lastHour ?? 0,
            maxPerHour: budgets[i]?.velocity.maxTxPerHour ?? 0,
          }))
          .filter((row) => row.maxPerHour > 0),
      );

      const names = new Map(rows.map((row) => [row.agentId, row.name]));
      const counts = new Map<string, DecisionMixRow>();
      for (const tx of history?.transactions ?? []) {
        // An agent the roster does not know is shown by its id rather than dropped: the decision
        // happened, and hiding it would make the chart disagree with the transactions page.
        const name = names.get(tx.agentId) ?? tx.agentId;
        const row = counts.get(name) ?? { name, allow: 0, hold: 0, block: 0 };
        if (tx.decision === "ALLOW") row.allow += 1;
        else if (tx.decision === "HOLD") row.hold += 1;
        else if (tx.decision === "BLOCK") row.block += 1;
        counts.set(name, row);
      }
      setMix([...counts.values()].sort((a, b) => b.allow + b.hold + b.block - (a.allow + a.hold + a.block)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Kicked off in a microtask: the loader sets state before its first await, and doing that
    // synchronously inside an effect updates state mid-commit.
    void Promise.resolve().then(load);
  }, [load, reloadToken]);

  const total = agents.length;
  const activeCount = agents.filter((a) => a.status === "ACTIVE").length;
  const frozenCount = agents.filter((a) => a.status === "FROZEN").length;
  const totalAllowance = sumUsd(agents.map((a) => a.walletAllowanceCapUsd));
  const monthSpend = sumUsd(agents.map((a) => a.spentUsd));

  const budgetRows: BudgetBarRow[] = agents
    .filter((a) => a.monthBudgetUsd !== null && Number(a.monthBudgetUsd) > 0)
    .map((a) => {
      const spent = Number(a.spentUsd ?? 0);
      const reserved = Number(a.reservedUsd ?? 0);
      const budget = Number(a.monthBudgetUsd);
      return {
        name: a.name,
        spent,
        reserved,
        remaining: Math.max(0, budget - spent - reserved),
        budget,
        usedPercent: budget === 0 ? 100 : Math.round(((spent + reserved) / budget) * 100),
      };
    })
    .sort((a, b) => b.usedPercent - a.usedPercent);

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-sans text-3xl font-bold tracking-tight text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600">
              <Bot className="h-5 w-5" />
            </div>
            Autonomous agents
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registered spenders, each with its own policy, budget windows and velocity limits.
            Everything below is read from the guard&apos;s records.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
        >
          <Plus className="h-4 w-4" /> Register agent
        </Button>
      </div>

      {creating && (
        <CreateAgentModal
          onClose={() => setCreating(false)}
          onCreated={() => setReloadToken((n) => n + 1)}
        />
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat
          label="Registered"
          value={loading ? "…" : String(total)}
          hint="Managed by the gateway"
          icon={<Bot className="h-4 w-4 text-slate-500" />}
        />
        <Stat
          label="Active"
          value={loading ? "…" : String(activeCount)}
          hint="Operating within policy"
          tone="text-emerald-600"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
        />
        <Stat
          label="Frozen"
          value={loading ? "…" : String(frozenCount)}
          hint={frozenCount > 0 ? "Blocked before any rule runs" : "None frozen"}
          tone="text-rose-600"
          icon={<ShieldAlert className="h-4 w-4 text-rose-600" />}
        />
        <Stat
          label="Spent (30d)"
          value={loading ? "…" : `$${monthSpend}`}
          hint="Settled, across all agents"
          icon={<TrendingDown className="h-4 w-4 text-slate-500" />}
        />
        <Stat
          label="Allowance pool"
          value={loading ? "…" : `$${totalAllowance}`}
          hint="Combined wallet ceilings"
          icon={<Coins className="h-4 w-4 text-slate-500" />}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="p-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {loading
          ? [...Array(2)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
            ))
          : agents.map((agent) => <AgentCard key={agent.id} agent={agent} onStatusChange={load} />)}
      </div>

      <BudgetBars data={budgetRows} />

      <DecisionBar data={mix} windowLabel="every decision on record" />

      {/* Velocity headroom — the other ceiling the engine enforces, and the one no chart showed */}
      {velocity.length > 0 && (
        <Card className="p-5 shadow-sm">
          <h3 className="text-sm font-bold tracking-wide text-zinc-900">
            Velocity headroom (last hour)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Payments in the trailing hour against each agent&apos;s <code>maxTxPerHour</code>.
          </p>
          <ul className="mt-4 space-y-3 max-w-3xl">
            {velocity.map((row) => {
              const percent = Math.min(100, Math.round((row.lastHour / row.maxPerHour) * 100));
              return (
                <li key={row.name} className="space-y-1">
                  <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                    <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                      <Zap className="h-3.5 w-3.5 text-zinc-400" />
                      {row.name}
                    </span>
                    <span className="font-mono font-bold text-zinc-900">
                      {row.lastHour} / {row.maxPerHour}
                    </span>
                  </div>
                  <Progress
                    value={percent}
                    indicatorClassName={
                      percent >= 100 ? "bg-rose-500" : percent >= 80 ? "bg-amber-500" : "bg-emerald-500"
                    }
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
