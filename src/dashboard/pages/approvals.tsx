"use client";

import { ApprovalCard } from "@/dashboard/components/approval-card";
import {
  formatCountdown,
  secondsLeft,
  usePendingApprovals,
} from "@/dashboard/hooks/usePendingApprovals";
import { CheckCircle2, Clock, Hourglass, RefreshCw, ShieldAlert, Timer } from "lucide-react";

/**
 * OWNER: UI · The HOLD queue.
 *
 * Every figure here is derived from the rows the server returned. There are no placeholder cards
 * and no assumed TTL: an empty queue says so, and a hold whose window has closed says that too
 * rather than showing a countdown that was never real.
 */

/** Cents as integers — a queue total must not drift by a float. */
function sumUsd(rows: { amountUsd: string }[]): string {
  const cents = rows.reduce((acc, row) => acc + Math.round(Number(row.amountUsd) * 100), 0);
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
  hint?: string;
  tone?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200/90 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className={`mt-3 font-sans text-3xl font-extrabold tracking-tight ${tone}`}>{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ApprovalsPage() {
  const { approvals, live, expired, loading, error, nowMs, soonestSeconds, refresh, resolve } =
    usePendingApprovals();

  // Oldest first is how the server returns them, so the head of the list is the longest wait.
  const oldest = approvals[0];
  const waitedSeconds = oldest
    ? Math.max(0, Math.round((nowMs - new Date(oldest.createdAt).getTime()) / 1000))
    : 0;
  const waited =
    waitedSeconds < 3600
      ? `${Math.floor(waitedSeconds / 60)}m`
      : waitedSeconds < 86400
      ? `${Math.floor(waitedSeconds / 3600)}h`
      : `${Math.floor(waitedSeconds / 86400)}d`;

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-3 font-sans text-3xl font-bold tracking-tight text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            Approval inbox
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Payments the engine held for a human. Nothing here has been signed, and nothing here
            settles until a reviewer releases it.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* The number the operator is actually working against */}
          {soonestSeconds !== null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-xs font-bold ${
                soonestSeconds < 60
                  ? "animate-pulse border-rose-200 bg-rose-50 text-rose-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              next expiry in {formatCountdown(soonestSeconds)}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Awaiting review"
          value={loading ? "…" : String(live.length)}
          hint={live.length === 1 ? "1 payment on hold" : `${live.length} payments on hold`}
          tone="text-amber-600"
          icon={<Clock className="h-4 w-4" />}
        />
        <Stat
          label="Value held"
          value={loading ? "…" : `$${sumUsd(live)}`}
          hint="Reserved, not spent"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat
          label="Longest wait"
          value={loading || !oldest ? "—" : waited}
          hint={oldest ? `since ${new Date(oldest.createdAt).toLocaleTimeString()}` : "queue is empty"}
          icon={<Hourglass className="h-4 w-4" />}
        />
        <Stat
          label="Window closed"
          value={loading ? "…" : String(expired)}
          hint={expired > 0 ? "can no longer be released" : "none expired"}
          tone={expired > 0 ? "text-rose-600" : "text-slate-900"}
          icon={<Timer className="h-4 w-4" />}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {loading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-100" />
          ))
        ) : approvals.length === 0 ? (
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
            Nothing is waiting on a human. Holds appear here the moment the engine raises one — run
            a payment in the $0.10–$1.00 band from the agent console to see it arrive.
          </div>
        ) : (
          approvals
            // Live holds first, then the closed ones; within each group the oldest is on top.
            .slice()
            .sort((a, b) => Number((secondsLeft(b, nowMs) ?? 1) > 0) - Number((secondsLeft(a, nowMs) ?? 1) > 0))
            .map((item) => (
              <ApprovalCard
                key={item.intentId || item.id}
                item={item}
                nowMs={nowMs}
                onResolved={(id) => resolve(id)}
              />
            ))
        )}
      </div>
    </div>
  );
}
