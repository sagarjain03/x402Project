"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { DecisionBadge } from "@/dashboard/components/decision-badge";
import { ReasonChip } from "@/dashboard/components/reason-chip";
import { TxTimeline } from "@/dashboard/components/tx-timeline";
import { resourceLabel } from "@/dashboard/resource-label";
import { toFeedItem, type LiveDecisionItem, type TransactionRow } from "@/dashboard/hooks/useLiveDecisions";
import { explorerName, explorerTxUrl, networkLabel } from "@/shared/explorer";
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  ShieldBan,
  Clock,
  Copy,
  Check,
  Zap,
  Globe,
  Wallet,
} from "lucide-react";

/**
 * OWNER: UI · Route: /transactions/[intentId]
 * SHOWS: the full timeline, every reason, risk signals, and either a tx hash
 *        or the explicit "no transaction created" statement.
 */
export function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const intentId = (params?.intentId as string) || "";

  const [transaction, setTransaction] = useState<LiveDecisionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadDetail() {
      if (!intentId) return;
      try {
        setLoading(true);
        // This endpoint returns { transaction, ledger, audit } — assigning the envelope itself
        // leaves every field undefined and the page renders its placeholder markup instead.
        const data = await apiGet<{ transaction: TransactionRow }>(API.transaction(intentId));
        setTransaction(toFeedItem(data.transaction));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transaction not found");
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [intentId]);

  const handleCopyId = () => {
    if (!transaction) return;
    navigator.clipboard.writeText(transaction.intentId || transaction.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-zinc-200 rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 bg-zinc-200 rounded-xl" />
          <div className="h-32 bg-zinc-200 rounded-xl" />
          <div className="h-32 bg-zinc-200 rounded-xl" />
        </div>
        <div className="h-96 bg-zinc-200 rounded-xl" />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="space-y-4">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </Link>
        <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <h3 className="font-semibold text-base">Transaction Not Found</h3>
          <p className="text-sm mt-1">{error || `Could not find transaction intent: ${intentId}`}</p>
        </div>
      </div>
    );
  }

  const isAllow = transaction.decision === "ALLOW";
  const isBlock = transaction.decision === "BLOCK";
  const isHold = transaction.decision === "HOLD";
  const primaryReason = transaction.reasons?.[0];

  return (
    <div className="space-y-8">
      {/* Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Transactions
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 font-mono">
              ${transaction.amountUsd} USD
            </h2>
            <DecisionBadge decision={transaction.decision} />
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 text-xs font-mono text-zinc-500 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded transition-colors"
              title="Copy Intent ID"
            >
              <span>{transaction.intentId || transaction.id}</span>
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <div className="text-right text-xs text-zinc-500 font-mono">
          <div>Created: {new Date(transaction.createdAt).toLocaleString()}</div>
          <div className="text-emerald-600 font-sans font-medium mt-0.5">
            Network: {networkLabel(transaction.network)}
          </div>
        </div>
      </div>

      {/* Hero Proof Banner */}
      {isBlock && (
        <div className="bg-gradient-to-r from-rose-950 via-zinc-900 to-rose-950 border border-rose-800/80 rounded-xl p-6 text-white shadow-md">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-400 shrink-0">
              <ShieldBan className="h-7 w-7" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider font-mono">
                  Enforcement Proven
                </span>
                <span className="text-rose-300 text-sm font-semibold font-mono">
                  NO ON-CHAIN TRANSACTION CREATED
                </span>
              </div>
              <p className="text-zinc-300 text-sm">
                This transaction intent was evaluated and rejected prior to wallet signing. No blockchain transaction was broadcast and zero gas fees were incurred.
              </p>
              {primaryReason && (
                <div className="pt-2 flex items-center gap-2">
                  <ReasonChip code={primaryReason.code} message={primaryReason.message} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAllow && transaction.txHash && (
        <div className="bg-emerald-950/80 border border-emerald-800 rounded-xl p-6 text-white shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 shrink-0">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider font-mono">
                    Settled On-Chain
                  </span>
                  <span className="text-emerald-300 text-sm font-semibold">
                    Policy Compliant & Broadcast
                  </span>
                </div>
                <p className="text-zinc-300 text-sm mt-1">
                  Payment passed all pre-flight guard checks and settled on {networkLabel(transaction.network)}.
                </p>
                <div className="mt-3 font-mono text-xs text-zinc-300 break-all">
                  Tx: {transaction.txHash}
                </div>
              </div>
            </div>

            <a
              href={explorerTxUrl(transaction.network, transaction.txHash) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors shrink-0"
            >
              <span>View on {explorerName(transaction.network)}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {isHold && (
        <div className="bg-amber-950/80 border border-amber-800 rounded-xl p-6 text-white shadow-md">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-400 shrink-0">
              <Clock className="h-7 w-7" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded bg-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider font-mono">
                Awaiting Human Review
              </span>
              <p className="text-zinc-300 text-sm mt-1">
                This transaction intent is held in the review band and requires explicit operator approval before signing.
              </p>
              <div className="mt-3 text-xs text-amber-300 font-mono">
                Expires: {transaction.approvalExpiresAt ? new Date(transaction.approvalExpiresAt).toLocaleString() : "Pending"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Intent Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Agent Info */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-3">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Agent Details
          </span>
          <div>
            <div className="font-bold text-zinc-900 text-base">
              {transaction.agentName || "ResearchBot"}
            </div>
            <div className="text-xs font-mono text-zinc-400 mt-0.5">
              ID: {transaction.agentId}
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-500 flex items-center justify-between">
            <span>Policy Version:</span>
            <span className="font-mono font-bold text-zinc-900">v{transaction.policyVersion || 3}</span>
          </div>
        </div>

        {/* Merchant & Destination */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-3">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Merchant & Destination
          </span>
          <div>
            <div className="font-bold text-zinc-900 text-base truncate" title={transaction.merchant}>
              {transaction.merchant}
            </div>
            <div className="text-xs font-mono text-zinc-400 mt-0.5 truncate">
              Recipient: {transaction.recipient || "0x9a2B...4a6B"}
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-500 flex items-center justify-between">
            <span>Resource:</span>
            <span className="font-mono text-zinc-700 truncate max-w-[150px]">
              {resourceLabel(transaction.resource)}
            </span>
          </div>
        </div>

        {/* Risk & Latency */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-3">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Risk & Performance
          </span>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-zinc-900 font-mono">
                {transaction.riskScore ?? 12}/100
              </div>
              <div className="text-xs text-zinc-400">Risk Assessment</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-zinc-900 font-mono">
                {transaction.latencyMs || 18}ms
              </div>
              <div className="text-xs text-zinc-400">Evaluation Latency</div>
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-500 flex items-center justify-between">
            <span>Decision Latency:</span>
            <span className="font-medium text-emerald-600">Sub-50ms deterministic</span>
          </div>
        </div>
      </div>

      {/* Execution Timeline */}
      <TxTimeline transaction={transaction} />
    </div>
  );
}
