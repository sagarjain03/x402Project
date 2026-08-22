"use client";

/**
 * OWNER: UI
 * ⭐ The most important component in the project. Live SSE stream of decisions.
 * A BLOCK row must show the reason AND the words "no transaction created".
 */
import { useLiveDecisions, type LiveDecisionItem } from "@/dashboard/hooks/useLiveDecisions";
import { DecisionBadge } from "@/dashboard/components/decision-badge";
import { ReasonChip } from "@/dashboard/components/reason-chip";
import { resourceLabel } from "@/dashboard/resource-label";
import { ExternalLink, Clock } from "lucide-react";
import { explorerTxUrl } from "@/shared/explorer";

export function DecisionFeed({
  agentId,
  limit = 20,
}: {
  agentId?: string;
  limit?: number;
}) {
  const { decisions, isConnected, loading } = useLiveDecisions(agentId);

  const displayedDecisions = decisions.slice(0, limit);

  if (loading && decisions.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 p-6">
        <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4">
          <div className="h-5 bg-white/15 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-white/15 rounded w-16 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/15 overflow-hidden flex flex-col">
      {/* Header with Live Status */}
      <div className="p-5 border-b border-white/15 flex items-center justify-between bg-white/5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Live Decision Stream
            <span className="text-xs font-normal text-slate-300 font-mono">
              ({decisions.length} total)
            </span>
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Real-time pre-flight policy evaluations across all active agent wallets.
          </p>
        </div>

        {/* Rule 2: Connected status — dot indicator, no pill background */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
            {isConnected ? "Live" : "Reconnecting"}
          </span>
        </div>
      </div>

      {/* Decision List */}
      <div className="divide-y divide-white/10 overflow-y-auto max-h-[600px]">
        {displayedDecisions.length === 0 ? (
          <div className="p-8 text-center text-slate-300 text-sm">
            No decisions logged yet. Run a simulator scenario or trigger an agent payment.
          </div>
        ) : (
          displayedDecisions.map((decision) => (
            <DecisionRow key={decision.id || decision.intentId} item={decision} />
          ))
        )}
      </div>
    </div>
  );
}

function DecisionRow({ item }: { item: LiveDecisionItem }) {
  const isAllow = item.decision === "ALLOW";
  const isHold = item.decision === "HOLD";
  const isBlock = item.decision === "BLOCK";

  const primaryReason = item.reasons?.[0];

  return (
    <div className={`pl-4 pr-4 pt-4 pb-4 transition-colors hover:bg-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 last:border-b-0 ${
      isBlock ? "border-l-2 border-l-red-500" : "border-l-2 border-l-transparent"
    }`}>
      {/* Left: Badge, Agent, Merchant, Amount */}
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <DecisionBadge decision={item.decision} className="shrink-0 mt-0.5 sm:mt-0" />

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-white font-mono">
              ${item.amountUsd}
            </span>
            <span className="text-xs text-slate-300">to</span>
            <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]" title={item.merchant}>
              {item.merchant}
            </span>
            {item.agentName && (
              <span className="text-[11px] font-mono text-slate-400">
                {item.agentName}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
            {item.resource && (
              <>
                <span>•</span>
                <span className="truncate max-w-[220px] text-slate-300">
                  {resourceLabel(item.resource)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Specific Visual Enforcement Rule Proof */}
      <div className="shrink-0 flex items-center gap-2 sm:text-right">
        {/* Rule 3: ALLOW hash — plain monospace text, no pill background */}
        {isAllow && item.txHash && explorerTxUrl(item.network, item.txHash) && (
          <a
            href={explorerTxUrl(item.network, item.txHash)!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <span>{item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        )}

        {/* Rule 2: HOLD — clock icon + neutral text, no amber pill */}
        {isHold && (
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-300">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium">
              {item.approvalExpiresAt
                ? `Expires ${new Date(item.approvalExpiresAt).toLocaleTimeString()}`
                : "Awaiting Review"}
            </span>
          </div>
        )}

        {/* BLOCK: bare red text, no box — left-border is on the row itself */}
        {isBlock && (
          <div className="flex flex-col sm:items-end gap-1">
            <span className="text-xs font-bold text-red-600 tracking-widest uppercase">No transaction created</span>
            {primaryReason && (
              <ReasonChip code={primaryReason.code} message={primaryReason.message} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
