"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import type { LiveDecisionItem } from "@/dashboard/hooks/useLiveDecisions";
import {
  X,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ExternalLink,
  Bot,
  Store,
  Wallet,
  Zap,
  Sliders,
  FileCode,
  ArrowRight,
} from "lucide-react";
import { resourceLabel } from "@/dashboard/resource-label";
import { explorerName, explorerTxUrl, networkLabel } from "@/shared/explorer";

interface TxDetailDrawerProps {
  tx: LiveDecisionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TxDetailDrawer({ tx, isOpen, onClose }: TxDetailDrawerProps) {
  // Close drawer on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !tx) return null;

  const isAllow = tx.decision === "ALLOW";
  const isBlock = tx.decision === "BLOCK";
  const isHold = tx.decision === "HOLD";
  const targetId = tx.intentId || tx.id;
  const primaryReason = tx.reasons?.[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-in Drawer Container */}
      <div className="relative z-10 w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-slate-200/90 font-sans">
        {/* Top Header */}
        <div>
          <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
            <div className="flex items-center gap-3">
              {/* Plain icon — no coloured container */}
              {isAllow ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : isBlock ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-5 w-5 text-red-500">
                  <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
                </svg>
              ) : (
                <Clock className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  Transaction Detail
                </h3>
                <p className="text-xs font-mono text-gray-400">
                  {targetId}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6">
            {/* Amount Banner */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Payment Intent Amount
                </span>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-baseline gap-2">
                  <span>${tx.amountUsd}</span>
                  <span className="text-sm font-semibold text-slate-500 font-mono">
                    USDC
                  </span>
                </div>
              </div>

              {/* Rule 2: Minimal status indicator — dot + neutral text, no coloured pill */}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold font-mono text-gray-700">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    isAllow ? "bg-emerald-500" : isBlock ? "bg-red-500" : "bg-amber-400"
                  }`}
                />
                {isAllow ? "ALLOWED" : isBlock ? "BLOCKED" : "HELD"}
              </span>
            </div>

            {/* BLOCKED: bare text, border-l-2 on container — no coloured box */}
            {isBlock && (
              <div className="border-l-2 border-l-red-500 pl-3 space-y-0.5">
                <p className="text-xs font-bold text-red-600 tracking-widest uppercase">Blocked Before Signing</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Intercepted before any signature or submission. No funds moved.
                </p>
              </div>
            )}

            {/* SETTLED: bare text, border-l-2 — no coloured box; hash as raw gray-400 mono */}
            {isAllow && tx.txHash && (
              <div className="border-l-2 border-l-emerald-400 pl-3 space-y-1">
                <p className="text-xs font-bold text-gray-600 tracking-widest uppercase">Settled On-Chain ({networkLabel(tx.network)})</p>
                {/* Raw monospace hash — text-gray-400, no background */}
                <p className="font-mono text-xs text-gray-400 truncate" title={tx.txHash}>
                  {tx.txHash}
                </p>
                <a
                  href={explorerTxUrl(tx.network, tx.txHash) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <span>View on {explorerName(tx.network)}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Policy Evaluation Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Policy Enforcement Breakdown
              </h4>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Evaluation Decision</span>
                  <span className="font-bold text-slate-900 font-mono">{tx.decision}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Triggered Rule</span>
                  <span className={`font-semibold font-mono ${isBlock ? "text-rose-600" : "text-slate-700"}`}>
                    {primaryReason?.code || (isAllow ? "—" : "PENDING_REVIEW")}
                  </span>
                </div>

                <div className="py-1 border-b border-slate-100 space-y-1">
                  <span className="text-slate-500 font-medium">Reason Description</span>
                  <p className="text-slate-800 font-medium">
                    {primaryReason?.message || tx.reason || "All transaction parameters satisfied active policy bounds."}
                  </p>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-medium">Engine Latency</span>
                  <span className="font-mono font-semibold text-amber-600">
                    {tx.latencyMs !== undefined && tx.latencyMs !== null ? `${tx.latencyMs.toFixed(3)} ms` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Context & Metadata Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Context & Parameters
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Agent Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                    <Bot className="h-3.5 w-3.5 text-blue-600" />
                    <span>Originating Agent</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {tx.agentName || tx.agentId}
                  </div>
                </div>

                {/* Merchant Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                    <Store className="h-3.5 w-3.5 text-blue-600" />
                    <span>Target Merchant</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm truncate" title={tx.merchant}>
                    {tx.merchant}
                  </div>
                </div>

                {/* Resource Endpoint */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 sm:col-span-2">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                    <FileCode className="h-3.5 w-3.5 text-slate-400" />
                    <span>Resource</span>
                  </div>
                  <div className="text-slate-800 text-xs truncate">
                    {resourceLabel(tx.resource)}
                  </div>
                </div>
              </div>
            </div>

            {/* Decision Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Decision Lifecycle Timeline
              </h4>
              <div className="rounded-2xl border border-slate-200/80 p-4 bg-white space-y-3 font-mono text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">1. Payment Intent Ingested</div>
                    <div className="text-[11px] text-slate-400">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">2. Deterministic Rule Evaluation</div>
                    <div className="text-[11px] text-slate-400">Pure rule engine checked limits, merchants, and velocity</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      isAllow ? "bg-emerald-500" : isBlock ? "bg-rose-500" : "bg-amber-500"
                    }`}
                  />
                  <div>
                    <div className="font-bold text-slate-900">
                      3. Gateway Decision: {tx.decision}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isAllow
                        ? `Signed and broadcast to ${networkLabel(tx.network)}`
                        : isBlock
                        ? "Request rejected before anything was signed"
                        : "Escalated to human reviewer HOLD queue"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between sticky bottom-0 z-20">
          <Link
            href={`/transactions/${targetId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            <span>Open Dedicated Transaction Page</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}

export default TxDetailDrawer;
