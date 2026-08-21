"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { Hero } from "@/dashboard/components/ui/Hero";
import { CloudShader } from "@/dashboard/components/ui/cloud-shader";
import { DecisionFeed } from "@/dashboard/components/decision-feed";
import { ErrorCard } from "@/dashboard/components/error-card";
import {
  DollarSign,
  Ban,
  CheckCircle2,
  Zap,
  TrendingDown,
  ChevronRight,
} from "lucide-react";

interface MetricsSummary {
  windowHours: number;
  decisions: {
    allow: number;
    hold: number;
    block: number;
  };
  spentUsd: string;
  blockedUsd: string;
  onChainTxCount: number;
  blockedOnChainTxCount: number;
  topBlockReasons: { code: string; count: number }[];
  p95GuardLatencyMs: number;
}

const HUMAN_REASONS: Record<string, string> = {
  ABSOLUTE_BLOCK_THRESHOLD: "Exceeded absolute limit / prompt injection",
  PER_TRANSACTION_LIMIT_EXCEEDED: "Exceeded per-transaction limit",
  MERCHANT_NOT_ALLOWLISTED: "Merchant domain not on allowlist",
  MERCHANT_BLOCKED: "Merchant domain is explicitly blocked",
  RECIPIENT_MISMATCH: "Recipient address mismatch (pinned recipient)",
  VELOCITY_EXCEEDED: "Velocity limit exceeded (tx/min)",
  BUDGET_EXCEEDED: "Hourly budget ceiling exceeded",
};

/** Donut Chart Component drawing precise percentage arcs */
function DonutChart({
  allow,
  hold,
  block,
  total,
}: {
  allow: number;
  hold: number;
  block: number;
  total: number;
}) {
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Fractions
  const safeTotal = total > 0 ? total : 1;
  const allowPct = allow / safeTotal;
  const holdPct = hold / safeTotal;
  const blockPct = block / safeTotal;

  // Stroke Dasharrays
  const allowDash = allowPct * circumference;
  const holdDash = holdPct * circumference;
  const blockDash = blockPct * circumference;

  // Offsets (starting from top -90deg)
  const allowOffset = 0;
  const holdOffset = -allowDash;
  const blockOffset = -(allowDash + holdDash);

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />

        {/* ALLOW Segment (Green) */}
        {allow > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${allowDash} ${circumference}`}
            strokeDashoffset={allowOffset}
            strokeLinecap="round"
          />
        )}

        {/* HOLD Segment (Amber) */}
        {hold > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${holdDash} ${circumference}`}
            strokeDashoffset={holdOffset}
          />
        )}

        {/* BLOCK Segment (Red) */}
        {block > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ef4444"
            strokeWidth={strokeWidth}
            strokeDasharray={`${blockDash} ${circumference}`}
            strokeDashoffset={blockOffset}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
          {total}
        </span>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Total
        </span>
      </div>
    </div>
  );
}

export function OverviewPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        const data = await apiGet<MetricsSummary>(`${API.metrics}?window=720`);
        if (data) {
          setMetrics(data);
        }
      } catch (err) {
        // No invented figures on failure: a fabricated "money protected" number is the one thing
        // on this page nobody can afford to have made up.
        console.error("[overview] metrics unavailable:", err);
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, []);

  // Zero, not a plausible-looking number. Every figure on this page is either measured or absent.
  const allow = metrics?.decisions.allow ?? 0;
  const hold = metrics?.decisions.hold ?? 0;
  const block = metrics?.decisions.block ?? 0;
  const totalDecisions = allow + hold + block;

  const allowPct = totalDecisions > 0 ? Math.round((allow / totalDecisions) * 100) : 0;
  const holdPct = totalDecisions > 0 ? Math.round((hold / totalDecisions) * 100) : 0;
  const blockPct = totalDecisions > 0 ? Math.round((block / totalDecisions) * 100) : 0;

  const displayBlockReasons = metrics?.topBlockReasons ?? [];

  return (
    <div className="relative w-full min-h-screen selection:bg-blue-600 selection:text-white bg-gradient-to-b from-[#1d64c2] via-[#488de8] to-[#7fb5f7] overflow-x-hidden">
      {/* Whole-Page Fixed CloudShader Animated Sky Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        <CloudShader
          className="w-full h-full"
          speed={0.7}
          count={6}
          cloudColor="#ffffff"
          skyTopColor="#1d64c2"
          skyBottomColor="#7fb5f7"
        />
      </div>

      {/* Foreground Interactive Content Layer */}
      <div className="relative z-10 flex flex-col w-full min-h-screen justify-between">
        {/* 1. Hero Section */}
        <Hero />

        {/* 2. Embedded Floating Dashboard Card */}
        <div
          id="overview-section"
          className="relative z-20 -mt-6 px-3 sm:px-6 lg:px-8 pb-28 max-w-[1400px] w-full mx-auto"
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-white/80 shadow-2xl p-6 sm:p-10 space-y-8 min-h-[700px]">
            {/* Top Bar inside Card (Title + Subtitle, No buttons) */}
            <div className="pb-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">
                Overview
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Policy guard decisions and on-chain prevention metrics over the last 30 days.
              </p>
            </div>

            {loading ? (
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-44 bg-slate-100 rounded-2xl" />
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-72 bg-slate-100 rounded-2xl" />
                  <div className="h-72 bg-slate-100 rounded-2xl" />
                </div>
              </div>
            ) : error && !metrics ? (
              <ErrorCard
                title="Overview Metrics Unavailable"
                message={error || "Failed to communicate with the policy engine metrics endpoint."}
                onRetry={() => {
                  setLoading(true);
                  apiGet<MetricsSummary>(`${API.metrics}?window=720`)
                    .then((data) => {
                      if (data) setMetrics(data);
                    })
                    .catch((err) => setError(err instanceof Error ? err.message : "Error"))
                    .finally(() => setLoading(false));
                }}
              />
            ) : (
              <>
                {/* ========================================================================= */}
                {/* 4 CORE METRIC CARDS */}
                {/* ========================================================================= */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* 1. Spend Today */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between relative overflow-hidden group">
                    <div className="space-y-3">
                      {/* Header Eyebrow + Icon */}
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                          <DollarSign className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Spend Settled
                        </span>
                      </div>

                      {/* Number */}
                      <div>
                        <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight font-sans">
                          ${metrics?.spentUsd ?? "0.00"}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <span className="text-emerald-600 font-bold">
                            {metrics?.onChainTxCount ?? 0} payments
                          </span>{" "}
                          settled on-chain
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Money Refused (STAR PRODUCT TILE - DARK NAVY/BLACK WITH RED GLOW) */}
                  <div className="bg-[#0f1424] rounded-2xl border border-rose-950/60 p-5 shadow-lg relative overflow-hidden flex flex-col justify-between text-white group">
                    {/* Crimson Ambient Glow */}
                    <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 h-36 w-36 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 space-y-3">
                      {/* Header Eyebrow + Badge */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-rose-950/80 border border-rose-800/40 text-rose-400 flex items-center justify-center">
                            <Ban className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold tracking-wide text-rose-200">
                            Money Refused
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/30 font-bold">
                          Protected
                        </span>
                      </div>

                      {/* Number */}
                      <div>
                        <div className="text-3xl sm:text-[34px] font-extrabold text-white tracking-tight font-sans">
                          ${metrics?.blockedUsd ?? "0.00"}
                        </div>
                        <p className="text-xs text-rose-200 mt-1 flex items-center gap-1">
                          Unauthorized spend intercepted before blockchain
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Blocked On-Chain Count */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between relative overflow-hidden group">
                    <div className="space-y-3">
                      {/* Header Eyebrow + Icon */}
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Blocked, Yet On-Chain
                        </span>
                      </div>

                      {/* Number */}
                      <div>
                        <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight font-sans">
                          {metrics?.blockedOnChainTxCount ?? 0}
                        </div>
                        <p className="text-xs text-emerald-600 font-semibold mt-1">
                          No blocked transactions submitted to chain
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4. Engine Latency (P95) */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between relative overflow-hidden group">
                    <div className="space-y-3">
                      {/* Header Eyebrow + Icon */}
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                          <Zap className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold tracking-wide text-slate-600">
                          Engine Latency (P95)
                        </span>
                      </div>

                      {/* Number */}
                      <div>
                        <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight font-sans">
                          {metrics?.p95GuardLatencyMs !== undefined && metrics?.p95GuardLatencyMs !== null
                            ? `${metrics.p95GuardLatencyMs} ms`
                            : "—"}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          P95 end-to-end evaluation latency
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* 2-COLUMN SECTION: DECISION DISTRIBUTION DONUT & TOP BLOCKED RULES */}
                {/* ========================================================================= */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Decision Distribution Card with Donut Chart */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-7 shadow-xs space-y-6 flex flex-col justify-between">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider font-sans">
                        Decision Distribution ({metrics ? Math.round(metrics.windowHours / 24) : "—"}D)
                      </h3>
                      <span className="text-xs font-semibold text-slate-500">
                        Total: {totalDecisions}
                      </span>
                    </div>

                    {/* Donut Chart + Status Breakdown */}
                    <div className="flex flex-col sm:flex-row items-center gap-8 py-2">
                      {/* Donut Component */}
                      <DonutChart
                        allow={allow}
                        hold={hold}
                        block={block}
                        total={totalDecisions}
                      />

                      {/* 3 Categories with Colored Indicators & Progress Bars */}
                      <div className="flex-1 w-full space-y-4 font-sans text-xs">
                        {/* 1. ALLOW */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                              <span className="font-semibold text-slate-800">
                                ALLOW (Settled)
                              </span>
                            </div>
                            <span className="font-bold text-slate-900 font-mono">
                              {allow} ({allowPct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${allowPct}%` }}
                            />
                          </div>
                        </div>

                        {/* 2. HOLD */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                              <span className="font-semibold text-slate-800">
                                HOLD (Review Required)
                              </span>
                            </div>
                            <span className="font-bold text-slate-900 font-mono">
                              {hold} ({holdPct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${holdPct}%` }}
                            />
                          </div>
                        </div>

                        {/* 3. BLOCK */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                              <span className="font-semibold text-slate-800">
                                BLOCK (Intercepted)
                              </span>
                            </div>
                            <span className="font-bold text-slate-900 font-mono">
                              {block} ({blockPct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${blockPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Top Blocked Rules Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-7 shadow-xs space-y-4 flex flex-col justify-between">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider font-sans">
                        Top Blocked Rules ({metrics ? Math.round(metrics.windowHours / 24) : "—"}D)
                      </h3>
                      <span className="text-xs text-slate-500">Ranked by frequency</span>
                    </div>

                    {/* Rule Rows 1..6 */}
                    {displayBlockReasons.length === 0 ? (
                      <div className="flex-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center flex items-center justify-center">
                        <p className="text-sm text-slate-600" role="status" aria-live="polite">
                          No rules blocked in the last {metrics?.windowHours ?? 24} hours.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {displayBlockReasons.slice(0, 6).map((item, idx) => (
                          <div
                            key={item.code}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs hover:bg-slate-100/80 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-slate-200/80 text-slate-700 font-mono text-[11px] flex items-center justify-center font-bold shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 block truncate">
                                  {HUMAN_REASONS[item.code] || item.code}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500 truncate block">
                                  {item.code}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100 shrink-0 ml-3 text-[11px]">
                              {item.count} {item.count === 1 ? "hit" : "hits"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                </div>

                {/* Real-time Decision Feed via SSE */}
                <div className="pt-2">
                  <DecisionFeed />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
