"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { DecisionBadge } from "@/dashboard/components/decision-badge";
import { formatCountdown, secondsLeft, type ApprovalItem } from "@/dashboard/hooks/usePendingApprovals";
import { resourceLabel } from "@/dashboard/resource-label";
import { networkLabel } from "@/shared/explorer";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Hourglass, XCircle } from "lucide-react";

/**
 * OWNER: UI · One 🟡 HOLD, with the times it actually carries.
 *
 * Everything on this card comes off the row. There is no fallback agent name and no invented review
 * band: a card that cannot name the agent shows the agent id, because a plausible wrong name on a
 * screen where someone is about to release money is the worst failure this component can have.
 */

interface ApproveResponse {
  reevaluation?: { decision: string; reasons?: { code: string; message: string }[] };
}

const clockOf = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

export function ApprovalCard({
  item,
  nowMs,
  onResolved,
}: {
  item: ApprovalItem;
  nowMs: number;
  onResolved?: (id: string, status: "APPROVED" | "REJECTED") => void;
}) {
  const id = item.intentId || item.id;
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = secondsLeft(item, nowMs);
  const expired = remaining !== null && remaining <= 0;
  const urgent = remaining !== null && remaining > 0 && remaining < 60;
  const reasons = item.reasons ?? [];

  const act = async (kind: "approve" | "reject") => {
    try {
      setLoading(kind);
      setError(null);
      const path = kind === "approve" ? API.approve(id) : API.reject(id);
      const result = await apiPost<ApproveResponse>(path);
      // Approving does not broadcast anything. It records the decision and re-runs the engine, so
      // what the reviewer needs to read back is the verdict of that second evaluation.
      setOutcome(
        kind === "approve"
          ? `Approved. Re-evaluated: ${result?.reevaluation?.decision ?? "recorded"}.`
          : "Rejected. Nothing was signed.",
      );
      onResolved?.(id, kind === "approve" ? "APPROVED" : "REJECTED");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${kind}.`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <article
      className={`relative overflow-hidden rounded-xl border bg-white p-6 shadow-sm space-y-4 ${
        expired ? "border-slate-200 opacity-90" : "border-amber-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-2xl font-extrabold text-zinc-900">${item.amountUsd}</div>
          <span className="font-mono text-xs text-zinc-400">USDC</span>
          <DecisionBadge decision="HOLD" />
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold ${
            expired
              ? "border-slate-200 bg-slate-100 text-slate-600"
              : urgent
              ? "animate-pulse border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {expired ? <Hourglass className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          <span>
            {remaining === null ? "no expiry" : expired ? "EXPIRED" : formatCountdown(remaining)}
          </span>
        </div>
      </div>

      {/* Times — the whole point of a queue worked by urgency */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3 font-mono text-[11px]">
        <div>
          <div className="text-slate-400">Held at</div>
          <div className="font-semibold text-slate-700">{clockOf(item.createdAt)}</div>
        </div>
        <div>
          <div className="text-slate-400">Expires</div>
          <div className={`font-semibold ${expired ? "text-rose-600" : "text-slate-700"}`}>
            {clockOf(item.approvalExpiresAt)}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-zinc-600">
          <span>Agent</span>
          <span className="font-mono font-medium text-zinc-900">{item.agentName ?? item.agentId}</span>
        </div>
        <div className="flex items-center justify-between text-zinc-600">
          <span>Merchant</span>
          <span className="font-medium text-zinc-900">{item.merchant}</span>
        </div>
        {item.resource && (
          <div className="flex items-center justify-between gap-3 text-zinc-600">
            <span>Resource</span>
            <span className="truncate font-medium text-zinc-900">{resourceLabel(item.resource)}</span>
          </div>
        )}
        {item.network && (
          <div className="flex items-center justify-between text-zinc-600">
            <span>Network</span>
            <span className="font-mono text-zinc-900">{networkLabel(item.network)}</span>
          </div>
        )}
        {typeof item.riskScore === "number" && (
          <div className="flex items-center justify-between text-zinc-600">
            <span>Risk score</span>
            <span className="font-mono font-semibold text-amber-800">{item.riskScore}</span>
          </div>
        )}
      </div>

      {/* Why the engine held it, in the engine's own words */}
      {reasons.length > 0 && (
        <ul className="space-y-1.5">
          {reasons.map((reason, i) => (
            <li key={`${reason.code}-${i}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
              <span className="font-mono font-bold">{reason.code}</span>
              {reason.rule && <span className="font-mono text-amber-700"> · {reason.rule}</span>}
              <div className="mt-0.5">{reason.message}</div>
            </li>
          ))}
        </ul>
      )}

      {item.reason && (
        <p className="text-[11px] italic text-zinc-500">Agent&apos;s stated reason: {item.reason}</p>
      )}

      {error && (
        <div className="flex items-center gap-1.5 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {outcome ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center font-mono text-xs font-bold text-slate-700">
          {outcome}
        </div>
      ) : expired ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-600">
          The review window closed. The guard will not sign this payment; the agent must request it
          again.
        </div>
      ) : (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => act("approve")}
            disabled={loading !== null}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {loading === "approve" ? "Approving..." : "Approve"}
          </button>

          <button
            onClick={() => act("reject")}
            disabled={loading !== null}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
          >
            <XCircle className="h-3.5 w-3.5" />
            {loading === "reject" ? "Rejecting..." : "Reject"}
          </button>
        </div>
      )}

      <Link
        href={`/transactions/${id}`}
        className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-blue-600 hover:text-blue-700"
      >
        full decision trace
        <ArrowRight className="h-3 w-3" />
      </Link>
    </article>
  );
}
