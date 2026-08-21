"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { TxTable } from "@/dashboard/components/tx-table";
import { FundFlow } from "@/dashboard/components/fund-flow";
import { toFeedItem, type LiveDecisionItem, type TransactionRow } from "@/dashboard/hooks/useLiveDecisions";
import {
  ArrowLeftRight,
  ShieldCheck,
  ShieldBan,
  Shield,
  FileText,
  Calendar,
  Filter,
} from "lucide-react";

interface MetricsSummary {
  windowHours: number;
  blockedUsd: string;
}

interface TransactionsApiResponse {
  transactions: TransactionRow[];
  total: number;
}

interface AgentsApiResponse {
  agents: { agentId: string; name: string }[];
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<LiveDecisionItem[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
      try {
        setLoading(true);
        // Money protected is measured over the guard's window by CORE, so it comes from the
        // metrics endpoint rather than being derived from whichever page of rows loaded here.
        // The transactions endpoint returns agentId, not the name, so the roster is fetched once
        // and joined here. A failure leaves agentName undefined and the table falls back to the id,
        // which is the point: a row must never display an agent it cannot actually identify.
        const [data, summary, roster] = await Promise.all([
          apiGet<TransactionsApiResponse>(`${API.transactions}?limit=200`),
          apiGet<MetricsSummary>(API.metrics).catch(() => null),
          apiGet<AgentsApiResponse>(API.agents).catch(() => null),
        ]);
        const names = new Map((roster?.agents ?? []).map((agent) => [agent.agentId, agent.name]));
        setTransactions((data?.transactions ?? []).map((row) => ({
          ...toFeedItem(row),
          agentName: names.get(row.agentId),
        })));
        setMetrics(summary);
      } catch (err) {
        console.error("[transactions] load failed:", err);
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

  const blockedUsd = metrics?.blockedUsd ?? "0.00";
  const windowHours = metrics?.windowHours ?? 24;

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

        {/* Right Header Buttons: Date Pill & Filter */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>Last 24 hours</span>
            <span className="text-slate-400">∨</span>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* 4 Redesigned Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Total Intents */}
        <div className="bg-white rounded-[22px] border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between relative overflow-hidden group">
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
                <span>Last {windowHours}h</span>
              </p>
            </div>
          </div>

          {/* Blue Wave Sparkline */}
          <div className="mt-4 -mx-5 -mb-5 h-11 w-[calc(100%+40px)] overflow-hidden pointer-events-none opacity-85">
            <svg viewBox="0 0 300 60" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="tx-blue-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0,45 C 50,55 90,30 140,40 C 190,50 240,15 300,20 L 300,60 L 0,60 Z"
                fill="url(#tx-blue-grad)"
              />
              <path
                d="M 0,45 C 50,55 90,30 140,40 C 190,50 240,15 300,20"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="300" cy="20" r="3.5" fill="#3b82f6" />
            </svg>
          </div>
        </div>

        {/* 2. Money Protected (Strongest Card) */}
        <div className="bg-white rounded-[22px] border border-emerald-200/80 p-5 shadow-sm hover:shadow transition-all flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/40">
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

          {/* Emerald Wave Sparkline */}
          <div className="mt-4 -mx-5 -mb-5 h-11 w-[calc(100%+40px)] overflow-hidden pointer-events-none">
            <svg viewBox="0 0 300 60" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="tx-emerald-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0,55 C 50,52 90,40 140,45 C 190,50 240,20 300,25 L 300,60 L 0,60 Z"
                fill="url(#tx-emerald-grad)"
              />
              <path
                d="M 0,55 C 50,52 90,40 140,45 C 190,50 240,20 300,25"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="300" cy="25" r="3.5" fill="#10b981" />
            </svg>
          </div>
        </div>

        {/* 3. Allowed */}
        <div className="bg-white rounded-[22px] border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
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
          <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${allowPct}%` }}
            />
          </div>
        </div>

        {/* 4. Blocked / Held */}
        <div className="bg-white rounded-[22px] border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
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
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, blockPct * 2)}%` }}
              />
            </div>
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, holdPct * 4)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sender -> merchant balances and the settled transfers between them */}
      <FundFlow transactions={transactions} loading={loading} onRefresh={loadTransactions} />

      {/* Payment Activity Table */}
      <TxTable transactions={transactions} loading={loading} />
    </div>
  );
}

export default TransactionsPage;
