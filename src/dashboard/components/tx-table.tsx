"use client";

import { useState } from "react";
import type { LiveDecisionItem } from "@/dashboard/hooks/useLiveDecisions";
import { TxDetailDrawer } from "@/dashboard/components/tx-detail-drawer";
import { resourceLabel } from "@/dashboard/resource-label";
import {
  Search,
  ShieldCheck,
  ShieldBan,
  Clock,
  ChevronRight,
  Bot,
  SlidersHorizontal,
  ChevronLeft,
} from "lucide-react";

/** OWNER: UI · Payment Activity table with Right-Side Detail Drawer */
export function TxTable({
  transactions,
  loading = false,
}: {
  transactions: LiveDecisionItem[];
  loading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedDecision, setSelectedDecision] = useState<string>("ALL");
  const [selectedTx, setSelectedTx] = useState<LiveDecisionItem | null>(null);
  // Read once per mount rather than on every render: Date.now() during render is impure, and the
  // "Nm ago" column only needs to be right as of the fetch that produced these rows.
  const [renderedAt] = useState(() => Date.now());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const handleRowClick = (tx: LiveDecisionItem) => {
    setSelectedTx(tx);
    setIsDrawerOpen(true);
  };

  const filtered = transactions.filter((t) => {
    if (selectedDecision !== "ALL" && t.decision !== selectedDecision) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchMerchant = t.merchant.toLowerCase().includes(q);
      const matchId = t.intentId?.toLowerCase().includes(q) || t.id?.toLowerCase().includes(q);
      const matchReason = t.reasons?.some(
        (r) => r.code.toLowerCase().includes(q) || r.message.toLowerCase().includes(q)
      );
      const matchResource = t.resource?.toLowerCase().includes(q);
      const matchAgent = t.agentName?.toLowerCase().includes(q) || t.agentId.toLowerCase().includes(q);
      if (!matchMerchant && !matchId && !matchReason && !matchResource && !matchAgent) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <div className="bg-white rounded-[24px] border border-slate-200/90 shadow-xs overflow-hidden flex flex-col font-sans">
        {/* Filters Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by merchant, intent ID, or reason..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
            />
          </div>

          {/* Filter Pills & Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Decision Filter Tabs */}
            <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-50 p-1 text-xs font-semibold">
              {[
                { id: "ALL", label: "All" },
                { id: "ALLOW", label: "Allowed" },
                { id: "HOLD", label: "Held" },
                { id: "BLOCK", label: "Blocked" },
              ].map((tab) => {
                const isActive = selectedDecision === tab.id;
                let activeStyle = "bg-white text-slate-900 shadow-xs font-bold";
                if (isActive && tab.id === "BLOCK") activeStyle = "bg-rose-50 text-rose-700 shadow-xs border border-rose-200 font-bold";
                if (isActive && tab.id === "ALLOW") activeStyle = "bg-emerald-50 text-emerald-700 shadow-xs border border-emerald-200 font-bold";
                if (isActive && tab.id === "HOLD") activeStyle = "bg-amber-50 text-amber-700 shadow-xs border border-amber-200 font-bold";
                if (isActive && tab.id === "ALL") activeStyle = "bg-blue-50 text-blue-700 shadow-xs border border-blue-200 font-bold";

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedDecision(tab.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      isActive ? activeStyle : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* More Filters Action */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>More filters</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
              <tr>
                <th className="py-3.5 px-5">DECISION</th>
                <th className="py-3.5 px-5">AMOUNT</th>
                <th className="py-3.5 px-5">MERCHANT & RESOURCE</th>
                <th className="py-3.5 px-5">AGENT</th>
                <th className="py-3.5 px-5">TIME</th>
                <th className="py-3.5 px-5 text-right w-10"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="py-4 px-5">
                      <div className="h-6 bg-slate-100 rounded-lg w-full" />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                paginated.map((t) => {
                  const targetId = t.intentId || t.id;
                  const isAllow = t.decision === "ALLOW";
                  const isBlock = t.decision === "BLOCK";
                  const isHold = t.decision === "HOLD";

                  return (
                    <tr
                      key={targetId}
                      onClick={() => handleRowClick(t)}
                      className={`hover:bg-slate-50/80 active:bg-slate-100/70 transition-all cursor-pointer group select-none ${
                        isBlock ? "hover:bg-rose-50/20" : isHold ? "hover:bg-amber-50/20" : "hover:bg-blue-50/20"
                      }`}
                    >
                      {/* Decision Status Pill */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wide shadow-2xs ${
                            isAllow
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isBlock
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isAllow ? (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>ALLOWED</span>
                            </>
                          ) : isBlock ? (
                            <>
                              <ShieldBan className="h-3.5 w-3.5 text-rose-600" />
                              <span>BLOCKED</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              <span>HELD</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Amount & Asset */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 text-sm font-sans">
                          ${t.amountUsd}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 font-medium">
                          USDC
                        </div>
                      </td>

                      {/* Merchant & Resource */}
                      <td className="py-3.5 px-5 max-w-[280px]">
                        <div className="font-bold text-slate-900 text-xs truncate" title={t.merchant}>
                          {t.merchant}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {resourceLabel(t.resource)}
                        </div>
                      </td>

                      {/* Agent Badge */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs">
                          <Bot className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{t.agentName || t.agentId}</span>
                        </span>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="font-medium text-slate-700 text-xs">
                          {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {Math.max(1, Math.round((renderedAt - new Date(t.createdAt).getTime()) / 60000))}m ago
                        </div>
                      </td>

                      {/* Chevron Right */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-200/80 transition-all ml-auto">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination & Counter */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 px-5">
          {/* Page Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`h-8 w-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentPage === page
                    ? "bg-blue-600 text-white font-bold shadow-xs"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}

            {totalPages > 5 && (
              <>
                <span className="px-1 text-slate-400">...</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer`}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Counter */}
          <span className="font-medium text-slate-500">
            Showing {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filtered.length, currentPage * pageSize)} of {filtered.length}
          </span>
        </div>
      </div>

      {/* Right-Side Transaction Detail Drawer */}
      <TxDetailDrawer
        tx={selectedTx}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
