"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { TxTable } from "@/dashboard/components/tx-table";
import { FundFlow } from "@/dashboard/components/fund-flow";
import { ErrorCard } from "@/dashboard/components/error-card";
import { toFeedItem, type LiveDecisionItem, type TransactionRow } from "@/dashboard/hooks/useLiveDecisions";
import {
  ArrowLeftRight,
  ShieldCheck,
  ShieldBan,
  Shield,
  FileText,
} from "lucide-react";
import { Card } from "@/dashboard/components/ui/card";
import { Progress } from "@/dashboard/components/ui/progress";

interface TransactionsApiResponse {
  transactions: TransactionRow[];
  total: number;
}

interface AgentsApiResponse {
  agents: { agentId: string; name: string }[];
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<LiveDecisionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
      try {
        setLoading(true);
        // The transactions endpoint returns agentId, not the name, so the roster is fetched once
        // and joined here. A failure leaves agentName undefined and the table falls back to the id,
        // which is the point: a row must never display an agent it cannot actually identify.
        const [data, roster] = await Promise.all([
          apiGet<TransactionsApiResponse>(`${API.transactions}?limit=200`),
          apiGet<AgentsApiResponse>(API.agents).catch(() => null),
        ]);
        const names = new Map((roster?.agents ?? []).map((agent) => [agent.agentId, agent.name]));
        setTransactions((data?.transactions ?? []).map((row) => ({
          ...toFeedItem(row),
          agentName: names.get(row.agentId),
        })));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load transactions.");
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    // Kicked off in a microtask: the loader sets state before its first await, and doing that
    // synchronously inside an effect updates state mid-commit.
    void Promise.resolve().then(loadTransactions);
  }, [loadTransactions]);

  // `|| 30` here used to fire whenever a real count was legitimately zero, which is how "allowed 30"
  // ended up sitting next to "total 50". Counts are now exactly what the rows say.
  const total = transactions.length;
  const allowCount = transactions.filter((t) => t.decision === "ALLOW").length;
  const blockCount = transactions.filter((t) => t.decision === "BLOCK").length;
  const holdCount = transactions.filter((t) => t.decision === "HOLD").length;

  const allowPct = total > 0 ? Math.round((allowCount / total) * 100) : 0;
  const blockPct = total > 0 ? Math.round((blockCount / total) * 100) : 0;
  const holdPct = total > 0 ? Math.round((holdCount / total) * 100) : 0;

  // Cents as integers, from the rows the table is showing. The metrics endpoint measures a
  // 24-hour window while this table has none, so reading blockedUsd from it put "$0.00" directly
  // above ten visible BLOCKED rows.
  const blockedUsd = (
    transactions
      .filter((t) => t.decision === "BLOCK")
      .reduce((acc, t) => acc + Math.round(Number(t.amountUsd) * 100), 0) / 100
  ).toFixed(2);

  return (
    <div className="space-y-8 font-sans">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3 font-sans">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            Transactions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Every payment intent evaluated, enforced, and recorded by WARDEN.
          </p>
        </div>
      </div>

      {/* 4 Redesigned Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Total Intents */}
        <Card className="rounded-[22px] p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="space-y-3">
            {/* Icon + Eyebrow */}
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                TOTAL INTENTS
              </span>
            </div>

            {/* Metric */}
            <div>
              <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight font-sans">
                {total}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span>All recorded</span>
              </p>
            </div>
          </div>
        </Card>

        {/* 2. Money Protected (Strongest Card) */}
        <Card className="rounded-[22px] border-emerald-200/80 p-5 shadow-sm hover:shadow transition-all flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/40">
          <div className="space-y-3">
            {/* Icon + Eyebrow */}
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                MONEY PROTECTED
              </span>
            </div>

            {/* Metric */}
            <div>
              <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight font-sans">
                ${blockedUsd}
              </div>
              <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <span>Prevented</span>
              </p>
            </div>
          </div>
        </Card>

        {/* 3. Allowed */}
        <Card className="rounded-[22px] p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="space-y-3">
            {/* Icon + Eyebrow */}
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                ALLOWED
              </span>
            </div>

            {/* Metric */}
            <div>
              <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight font-sans">
                {allowCount}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {allowPct}% of total
              </p>
            </div>
          </div>

          {/* Green Progress Bar */}
          <div className="mt-4">
            <Progress value={allowPct} indicatorClassName="bg-emerald-500" />
          </div>
        </Card>

        {/* 4. Blocked / Held */}
        <Card className="rounded-[22px] p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="space-y-3">
            {/* Icon + Eyebrow */}
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ShieldBan className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                BLOCKED / HELD
              </span>
            </div>

            {/* Metric */}
            <div>
              <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight font-sans">
                {blockCount} / {holdCount}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {blockPct}% / {holdPct}% of total
              </p>
            </div>
          </div>

          {/* Red & Amber Split Progress Bars */}
          <div className="mt-4 flex gap-1.5 w-full">
            <div className="flex-1">
              <Progress value={blockPct} indicatorClassName="bg-rose-500" />
            </div>
            <div className="flex-1">
              <Progress value={holdPct} indicatorClassName="bg-amber-500" />
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <ErrorCard
          title="Could not load transactions"
          message={error}
          onRetry={() => void loadTransactions()}
        />
      )}

      {/* Sender -> merchant balances and the settled transfers between them */}
      <FundFlow transactions={transactions} loading={loading} onRefresh={loadTransactions} />

      {/* Payment Activity Table */}
      <TxTable transactions={transactions} loading={loading} />
    </div>
  );
}

export default TransactionsPage;
