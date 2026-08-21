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
import { Card } from "@/dashboard/components/ui/card";
import { Badge } from "@/dashboard/components/ui/badge";
import { Button } from "@/dashboard/components/ui/button";
import { Alert, AlertDescription } from "@/dashboard/components/ui/alert";
import { cn } from "@/lib/utils";

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
  const [reviewerEmail, setReviewerEmail] = useState("operator@aspg.dev");
  const [reviewerNote, setReviewerNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
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
      const result = await apiPost<ApproveResponse>(path, {
        reviewerEmail: reviewerEmail.trim() || "operator@aspg.dev",
        note: reviewerNote.trim() || undefined,
        reason: kind === "reject" ? (reviewerNote.trim() || "Rejected by reviewer in Approvals Queue") : undefined,
      });
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
    <Card
      className={cn(
        "relative overflow-hidden p-6 shadow-xs space-y-4 transition-all hover:shadow-md",
        expired ? "border-slate-200 bg-slate-50/50 opacity-90" : "border-amber-200 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-2xl font-extrabold text-zinc-900">${item.amountUsd}</div>
          <span className="font-mono text-xs text-zinc-400">USDC</span>
          <DecisionBadge decision="HOLD" />
        </div>

        <Badge
          variant={expired ? "secondary" : urgent ? "destructive" : "warning"}
          className={cn("gap-1.5 font-mono text-xs font-semibold", urgent && "animate-pulse")}
        >
          {expired ? <Hourglass className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          <span>
            {remaining === null ? "no expiry" : expired ? "EXPIRED" : formatCountdown(remaining)}
          </span>
        </Badge>
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
        {item.recipient && (
          <div className="flex items-center justify-between text-zinc-600">
            <span>Payee Address</span>
            <span className="font-mono font-medium text-zinc-900 truncate max-w-[220px]" title={item.recipient}>
              {item.recipient}
            </span>
          </div>
        )}
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

      {/* Reviewer Note Input */}
      {!expired && !outcome && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowNoteInput((v) => !v)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              {showNoteInput ? "− Hide Reviewer Metadata" : "+ Add Reviewer Note / Email"}
            </button>
            <span className="text-[10px] font-mono text-slate-400">audit-logged</span>
          </div>

          {showNoteInput && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <input
                type="email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                placeholder="Reviewer Email"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 font-mono"
              />
              <input
                type="text"
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                placeholder="Approval / Rejection Note"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="p-3 text-xs">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
          <Button
            onClick={() => act("approve")}
            disabled={loading !== null}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {loading === "approve" ? "Approving..." : "Approve"}
          </Button>

          <Button
            variant="outline"
            onClick={() => act("reject")}
            disabled={loading !== null}
            className="flex-1 border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <XCircle className="h-3.5 w-3.5" />
            {loading === "reject" ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      )}

      <Link
        href={`/transactions/${id}`}
        className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-blue-600 hover:text-blue-700"
      >
        full decision trace
        <ArrowRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}
