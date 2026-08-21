"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

export interface SimulationItem {
  intentId: string;
  amountUsd: string;
  merchant: string;
  was: "ALLOW" | "HOLD" | "BLOCK";
  wouldBe: "ALLOW" | "HOLD" | "BLOCK";
  changed: boolean;
  reasons: (string | { code?: string; rule?: string; message?: string })[];
}

export interface PolicySimulationData {
  simulated: number;
  changedCount: number;
  newlyAllowed: number;
  newlyBlocked: number;
  results: SimulationItem[];
}

interface PolicySimulationResultsProps {
  data: PolicySimulationData;
}

export function PolicySimulationResults({ data }: PolicySimulationResultsProps) {
  const [activeFilter, setActiveFilter] = useState<"ALL" | "CHANGED" | "NEWLY_BLOCKED" | "NEWLY_ALLOWED">("CHANGED");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredResults = data.results.filter((item) => {
    // Filter by category
    if (activeFilter === "CHANGED" && !item.changed) return false;
    if (activeFilter === "NEWLY_BLOCKED" && !(item.changed && item.wouldBe === "BLOCK")) return false;
    if (activeFilter === "NEWLY_ALLOWED" && !(item.changed && item.wouldBe === "ALLOW")) return false;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.intentId.toLowerCase().includes(q) ||
        item.merchant.toLowerCase().includes(q) ||
        item.reasons.some((r) =>
          (typeof r === "string" ? r : r.message || r.code || r.rule || "").toLowerCase().includes(q)
        )
      );
    }
    return true;
  });

  const getDecisionBadge = (decision: "ALLOW" | "HOLD" | "BLOCK") => {
    switch (decision) {
      case "ALLOW":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
            ALLOW
          </span>
        );
      case "HOLD":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono bg-amber-50 text-amber-700 border border-amber-200">
            HOLD
          </span>
        );
      case "BLOCK":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono bg-rose-50 text-rose-700 border border-rose-200">
            BLOCK
          </span>
        );
    }
  };

  const getDeltaChip = (item: SimulationItem) => {
    if (!item.changed) {
      return (
        <span className="inline-flex items-center text-[10px] text-zinc-400 font-mono">
          Unchanged
        </span>
      );
    }

    if (item.was === "ALLOW" && item.wouldBe === "BLOCK") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300">
          <ShieldAlert className="h-3 w-3 text-rose-700" />
          Tightened (Now Blocked)
        </span>
      );
    }

    if (item.was === "BLOCK" && item.wouldBe === "ALLOW") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
          <AlertTriangle className="h-3 w-3 text-amber-700" />
          Loosened (Now Allowed)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200">
        {item.was} → {item.wouldBe}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 1. Loosened Security Risk Warning Banner */}
      {data.newlyAllowed > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-amber-950 font-mono">
              Security Boundary Warning — {data.newlyAllowed} Payment{data.newlyAllowed > 1 ? "s" : ""} Newly Allowed
            </h4>
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              These draft rules would permit {data.newlyAllowed} payment intent{data.newlyAllowed > 1 ? "s" : ""} that were previously blocked under the active policy. Please inspect the diff table below to ensure this policy loosening is intentional before saving.
            </p>
          </div>
        </div>
      )}

      {/* 2. Metric Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Simulated Intents</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-zinc-900">{data.simulated}</span>
            <span className="text-xs text-zinc-400 font-mono">historical</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Decision Changes</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-blue-600">{data.changedCount}</span>
            <span className="text-xs text-zinc-400 font-mono">({data.simulated > 0 ? Math.round((data.changedCount / data.simulated) * 100) : 0}%)</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
            Newly Blocked
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-700">{data.newlyBlocked}</span>
            <span className="text-xs text-rose-500 font-mono">tightened</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Newly Allowed
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-700">{data.newlyAllowed}</span>
            <span className="text-xs text-amber-600 font-mono">loosened</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
        {/* Filter Pills */}
        <div className="inline-flex rounded-lg bg-white p-1 border border-zinc-200 shadow-xs text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveFilter("CHANGED")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeFilter === "CHANGED"
                ? "bg-zinc-900 text-white font-bold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Changed Only ({data.changedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("NEWLY_BLOCKED")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeFilter === "NEWLY_BLOCKED"
                ? "bg-rose-600 text-white font-bold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Newly Blocked ({data.newlyBlocked})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("NEWLY_ALLOWED")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeFilter === "NEWLY_ALLOWED"
                ? "bg-amber-600 text-white font-bold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Newly Allowed ({data.newlyAllowed})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeFilter === "ALL"
                ? "bg-zinc-900 text-white font-bold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            All Simulated ({data.simulated})
          </button>
        </div>

        {/* Search */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search by intent, merchant, rule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>
      </div>

      {/* 4. Results Diff Table */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4">Intent / Merchant</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-center">Previous</th>
                <th className="py-3 px-4 text-center"></th>
                <th className="py-3 px-4 text-center">Simulated</th>
                <th className="py-3 px-4">Delta Status</th>
                <th className="py-3 px-4">Tripped Reasons / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 font-sans text-xs">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredResults.map((item) => (
                  <tr
                    key={item.intentId}
                    className={`hover:bg-zinc-50/80 transition-colors ${
                      item.changed
                        ? item.wouldBe === "BLOCK"
                          ? "bg-rose-50/20"
                          : item.wouldBe === "ALLOW"
                          ? "bg-amber-50/20"
                          : "bg-blue-50/20"
                        : ""
                    }`}
                  >
                    {/* Intent / Merchant */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-900">{item.merchant}</div>
                      <div className="text-[10px] text-zinc-400 truncate max-w-[140px] font-mono">
                        {item.intentId}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 font-bold text-zinc-900">
                      ${item.amountUsd}
                    </td>

                    {/* Previous Decision */}
                    <td className="py-3 px-4 text-center">
                      {getDecisionBadge(item.was)}
                    </td>

                    {/* Arrow */}
                    <td className="py-3 px-1 text-center text-zinc-300">
                      <ArrowRight className="h-3.5 w-3.5 inline" />
                    </td>

                    {/* Simulated Decision */}
                    <td className="py-3 px-4 text-center">
                      {getDecisionBadge(item.wouldBe)}
                    </td>

                    {/* Delta Status */}
                    <td className="py-3 px-4">
                      {getDeltaChip(item)}
                    </td>

                    {/* Tripped Reasons */}
                    <td className="py-3 px-4">
                      {item.reasons && item.reasons.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.reasons.map((r, i) => {
                            const label = typeof r === "string" ? r : r.code || r.rule || r.message || JSON.stringify(r);
                            return (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 text-zinc-800 border border-zinc-200"
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-sans">
                          {item.wouldBe === "ALLOW" ? "All rules passed" : "None"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
