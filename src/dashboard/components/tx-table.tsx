"use client";

import { useState } from "react";
import type { LiveDecisionItem } from "@/dashboard/hooks/useLiveDecisions";
import { TxDetailDrawer } from "@/dashboard/components/tx-detail-drawer";
import { ReasonChip } from "@/dashboard/components/reason-chip";
import { resourceLabel } from "@/dashboard/resource-label";
import {
  Search,
  Clock,
  ChevronRight,
  Bot,
  ChevronLeft,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/dashboard/components/ui/table";
import { Button } from "@/dashboard/components/ui/button";
import { Input } from "@/dashboard/components/ui/input";

function formatRelativeTime(dateStr: string, nowMs = Date.now()): string {
  const diffMs = Math.max(0, nowMs - new Date(dateStr).getTime());
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
        (r) => r.code.toLowerCase().includes(q) || r.message.toLowerCase().includes(q),
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
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col font-sans">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by merchant, intent ID, or reason..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-4 py-2 text-xs bg-slate-50/70 border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-50 p-1 text-xs font-semibold">
              {[
                { id: "ALL", label: "All" },
                { id: "ALLOW", label: "Allowed" },
                { id: "HOLD", label: "Held" },
                { id: "BLOCK", label: "Blocked" },
              ].map((tab) => {
                const isActive = selectedDecision === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedDecision(tab.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-slate-900 shadow-xs font-bold border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Table>
          <TableHeader className="bg-slate-50/70 border-b border-slate-100">
            <TableRow>
              <TableHead className="py-3.5 px-5 text-slate-500 uppercase tracking-wider font-bold text-[11px]">DECISION</TableHead>
              <TableHead className="py-3.5 px-5 text-slate-500 uppercase tracking-wider font-bold text-[11px]">AMOUNT</TableHead>
              <TableHead className="py-3.5 px-5 text-slate-500 uppercase tracking-wider font-bold text-[11px]">MERCHANT & RESOURCE</TableHead>
              <TableHead className="py-3.5 px-5 text-slate-500 uppercase tracking-wider font-bold text-[11px]">AGENT</TableHead>
              <TableHead className="py-3.5 px-5 text-slate-500 uppercase tracking-wider font-bold text-[11px]">REASON / RULE</TableHead>
              <TableHead className="py-3.5 px-5 text-slate-500 uppercase tracking-wider font-bold text-[11px]">TIME</TableHead>
              <TableHead className="py-3.5 px-5 text-right w-10"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell colSpan={7} className="py-4 px-5">
                    <div className="h-6 bg-slate-100 rounded-lg w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-14 text-center text-slate-400">
                  No transactions match the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((t) => {
                const targetId = t.intentId || t.id;
                const isAllow = t.decision === "ALLOW";
                const isBlock = t.decision === "BLOCK";
                const isHold = t.decision === "HOLD";
                const primaryReason = t.reasons?.[0];

                return (
                  <TableRow
                    key={targetId}
                    tabIndex={0}
                    role="button"
                    aria-label={`View transaction ${targetId}, decision ${t.decision}, amount $${t.amountUsd}`}
                    onClick={() => handleRowClick(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(t);
                      }
                    }}
                    className={`hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:bg-slate-50 transition-all cursor-pointer group select-none border-b border-gray-100 last:border-b-0 ${
                      isBlock ? "border-l-2 border-l-red-500" : ""
                    }`}
                  >
                    <TableCell className="py-3.5 px-5 whitespace-nowrap">
                      {/* Ultra-minimalist status: SVG icon + tracking-widest uppercase text */}
                      {isAllow ? (
                        <span className="inline-flex items-center gap-1.5">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-500 shrink-0">
                            <polyline points="2.5,8.5 6.5,12.5 13.5,3.5" />
                          </svg>
                          <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Allowed</span>
                        </span>
                      ) : isBlock ? (
                        <span className="inline-flex items-center gap-1.5">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-3.5 w-3.5 text-red-500 shrink-0">
                            <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
                          </svg>
                          <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Blocked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-amber-400 shrink-0">
                            <rect x="3" y="2" width="3.5" height="12" rx="1" />
                            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
                          </svg>
                          <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Held</span>
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="py-3.5 px-5 whitespace-nowrap">
                      <div className="font-extrabold text-slate-900 text-sm font-sans">${t.amountUsd}</div>
                      <div className="text-[11px] font-mono text-slate-400 font-medium">USDC</div>
                    </TableCell>

                    <TableCell className="py-3.5 px-5 max-w-[240px]">
                      <div className="font-bold text-slate-900 text-xs truncate" title={t.merchant}>
                        {t.merchant}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{resourceLabel(t.resource)}</div>
                    </TableCell>

                    <TableCell className="py-3.5 px-5 whitespace-nowrap">
                      {/* Bare agent name: Bot icon + plain text, no pill */}
                      <span className="inline-flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="text-xs text-gray-600 font-medium">{t.agentName || t.agentId}</span>
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5 px-5 max-w-[260px]">
                      {isAllow ? (
                        <span className="text-xs text-gray-500 font-mono">Policy compliant</span>
                      ) : primaryReason ? (
                        <ReasonChip code={primaryReason.code} message={primaryReason.message} />
                      ) : t.reason ? (
                        <span className="text-xs text-gray-600 font-mono truncate block" title={t.reason}>
                          {t.reason}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3.5 px-5 whitespace-nowrap">
                      <div className="font-medium text-slate-700 text-xs">
                        {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{formatRelativeTime(t.createdAt, renderedAt)}</div>
                    </TableCell>

                    <TableCell className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-200/80 transition-all ml-auto">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 px-5">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="icon"
                onClick={() => setCurrentPage(page)}
                className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                  currentPage === page
                    ? "bg-blue-600 text-white font-bold shadow-xs"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </Button>
            ))}

            {totalPages > 5 && (
              <>
                <span className="px-1 text-slate-400">...</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(totalPages)}
                  className="h-8 w-8 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {totalPages}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <span className="font-medium text-slate-500">
            Showing {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filtered.length, currentPage * pageSize)} of {filtered.length}
          </span>
        </div>
      </div>

      <TxDetailDrawer
        tx={selectedTx}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
