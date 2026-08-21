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
import { ExternalLink, Clock, ShieldX } from "lucide-react";
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
      <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
          <div className="h-5 bg-zinc-200 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-zinc-200 rounded w-16 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-zinc-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header with Live Status */}
      <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
        <div>
          <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            Live Decision Stream
            <span className="text-xs font-normal text-zinc-500 font-mono">
              ({decisions.length} total)
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time pre-flight policy evaluations across all active agent wallets.
          </p>
        </div>

        {/* Rule 2: Connected status — dot indicator, no pill background */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
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
      <div className="divide-y divide-zinc-100 overflow-y-auto max-h-[600px]">
        {displayedDecisions.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
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
    <div className="p-4 transition-colors hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 last:border-b-0">
      {/* Left: Badge, Agent, Merchant, Amount */}
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <DecisionBadge decision={item.decision} className="shrink-0 mt-0.5 sm:mt-0" />

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-zinc-900 font-mono">
              ${item.amountUsd}
            </span>
            <span className="text-xs text-zinc-400">to</span>
            <span className="text-sm font-medium text-zinc-700 truncate max-w-[200px]" title={item.merchant}>
              {item.merchant}
            </span>
            {item.agentName && (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">
                {item.agentName}
              </span>
            )}
          </div>

          <div className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
            <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
            {item.resource && (
              <>
                <span>•</span>
                <span className="truncate max-w-[220px] text-zinc-500">
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
            className="inline-flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <span>{item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        )}

        {/* Rule 2: HOLD — clock icon + neutral text, no amber pill */}
        {isHold && (
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-medium">
              {item.approvalExpiresAt
                ? `Expires ${new Date(item.approvalExpiresAt).toLocaleTimeString()}`
                : "Awaiting Review"}
            </span>
          </div>
        )}

        {/* Rule 1+2: BLOCK — red icon + neutral text, no rose pill */}
        {isBlock && (
          <div className="flex flex-col sm:items-end gap-1">
            <div className="flex items-center gap-1.5">
              <ShieldX className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-xs font-semibold text-gray-700">No transaction created</span>
            </div>
            {primaryReason && (
              <ReasonChip code={primaryReason.code} message={primaryReason.message} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
