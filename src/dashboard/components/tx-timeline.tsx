"use client";

import type { LiveDecisionItem } from "@/dashboard/hooks/useLiveDecisions";
import {
  FileCode,
  ShieldCheck,
  ShieldAlert,
  ShieldBan,
  CheckCircle2,
  Lock,
  ExternalLink,
  Clock,
} from "lucide-react";
import { resourceLabel } from "@/dashboard/resource-label";
import { explorerTxUrl, networkLabel } from "@/shared/explorer";

/** OWNER: UI · INTENT_CREATED -> EVALUATED -> RESERVED -> SIGNED -> SETTLED, with timestamps. */
export function TxTimeline({ transaction }: { transaction: LiveDecisionItem }) {
  const isAllow = transaction.decision === "ALLOW";
  const isHold = transaction.decision === "HOLD";
  const isBlock = transaction.decision === "BLOCK";

  const primaryReason = transaction.reasons?.[0];

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
      <h3 className="text-base font-bold text-zinc-900 mb-6 flex items-center justify-between">
        <span>Execution & Audit Timeline</span>
        <span className="text-xs font-mono text-zinc-400 font-normal">
          Latency: {transaction.latencyMs ?? "—"}ms
        </span>
      </h3>

      <ol className="relative border-l border-zinc-200 ml-4 space-y-8">
        {/* Step 1: Intent Created */}
        <li className="mb-6 ml-6">
          <span className="absolute -left-3.5 flex items-center justify-center w-7 h-7 bg-zinc-100 rounded-full ring-4 ring-white border border-zinc-300 text-zinc-600">
            <FileCode className="h-3.5 w-3.5" />
          </span>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-zinc-900">
              1. Payment Intent Created (402 Handshake)
            </h4>
            <time className="text-xs text-zinc-400 font-mono">
              {new Date(transaction.createdAt).toLocaleTimeString()}
            </time>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            Agent <span className="font-mono font-medium">{transaction.agentName || transaction.agentId}</span> generated intent for <span className="font-mono font-bold">${transaction.amountUsd} USDC</span> to <span className="font-medium">{transaction.merchant}</span>.
          </p>
          <div className="mt-2 text-[11px] font-mono text-zinc-400 bg-zinc-50 p-2 rounded border border-zinc-200 truncate">
            Resource: {resourceLabel(transaction.resource)}
          </div>
        </li>

        {/* Step 2: Policy Evaluation */}
        <li className="mb-6 ml-6">
          <span className="absolute -left-3.5 flex items-center justify-center w-7 h-7 bg-blue-50 rounded-full ring-4 ring-white border border-blue-200 text-blue-600">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-zinc-900">
              2. Pre-Flight Policy Evaluation
            </h4>
            <span className="text-xs font-mono text-zinc-400">
              {transaction.policyVersion ? `v${transaction.policyVersion} Policy` : "Policy version unknown"}
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            Checked financial limits, merchant allowlist, recipient pinning, velocity counters, and risk score.
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="px-2 py-0.5 rounded bg-zinc-100 font-mono text-zinc-700">
              Risk Score: <span className="font-bold">{transaction.riskScore ?? "—"}/100</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-100 font-mono text-zinc-700">
              Latency: <span className="font-bold">{transaction.latencyMs ?? "—"}ms</span>
            </span>
          </div>
        </li>

        {/* Step 3: Decision Rendered */}
        <li className="mb-6 ml-6">
          <span
            className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-white border ${
              isAllow
                ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                : isHold
                ? "bg-amber-50 border-amber-200 text-amber-600"
                : "bg-rose-50 border-rose-200 text-rose-600"
            }`}
          >
            {isAllow ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : isHold ? (
              <ShieldAlert className="h-3.5 w-3.5" />
            ) : (
              <ShieldBan className="h-3.5 w-3.5" />
            )}
          </span>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-zinc-900">
              3. Decision Rendered: <span className={`font-mono font-bold ${isAllow ? "text-emerald-600" : isHold ? "text-amber-600" : "text-rose-600"}`}>{transaction.decision}</span>
            </h4>
            <time className="text-xs text-zinc-400 font-mono">
              {new Date(transaction.createdAt).toLocaleTimeString()}
            </time>
          </div>

          {isBlock && (
            <div className="mt-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <p className="font-semibold flex items-center gap-1.5 text-rose-900">
                <ShieldBan className="h-4 w-4 text-rose-600" />
                Interception Rule: {primaryReason?.rule || "Policy Violation"}
              </p>
              <p className="mt-1 text-rose-700 font-mono">
                Code: {primaryReason?.code || "BLOCKED"}
              </p>
              <p className="mt-1 text-rose-800">
                {primaryReason?.message || "Payment intent was rejected before on-chain execution."}
              </p>
            </div>
          )}

          {isHold && (
            <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">Human Approval Required</p>
                <p className="text-amber-700 mt-0.5">
                  {primaryReason?.message || "Amount is in the human review band. Awaiting signature approval."}
                </p>
              </div>
            </div>
          )}
        </li>

        {/* Step 4: Settlement or Interception Proof */}
        <li className="ml-6">
          <span
            className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-white border ${
              isAllow
                ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                : isHold
                ? "bg-amber-50 border-amber-200 text-amber-600"
                : "bg-rose-900 text-white border-rose-950"
            }`}
          >
            {isAllow ? (
              <Lock className="h-3.5 w-3.5" />
            ) : isHold ? (
              <Clock className="h-3.5 w-3.5" />
            ) : (
              <ShieldBan className="h-3.5 w-3.5" />
            )}
          </span>

          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-zinc-900">
              {isAllow
                ? `4. On-Chain Settlement (${networkLabel(transaction.network)})`
                : isHold
                ? "4. Approval Inbox Queue"
                : "4. Policy Guard Interception (no transaction submitted)"}
            </h4>
          </div>

          {isAllow && transaction.txHash && explorerTxUrl(transaction.network, transaction.txHash) && (
            <div className="mt-2 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-emerald-900 font-medium">Tx Hash:</span>
                <a
                  href={explorerTxUrl(transaction.network, transaction.txHash)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>{transaction.txHash}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            </div>
          )}

          {isBlock && (
            <div className="mt-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold uppercase tracking-wider font-mono text-[10px]">
                  Enforcement Result
                </span>
                <span className="font-bold text-rose-400 font-mono">
                  NO TRANSACTION CREATED
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-1.5">
                The agent wallet was never authorized to sign. Zero on-chain gas fees were expended.
              </p>
            </div>
          )}

          {isHold && (
            <div className="mt-2 p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
              Hold expires at: <span className="font-mono font-medium text-zinc-900">{transaction.approvalExpiresAt ? new Date(transaction.approvalExpiresAt).toLocaleString() : "15 minutes from creation"}</span>
            </div>
          )}
        </li>
      </ol>
    </div>
  );
}
