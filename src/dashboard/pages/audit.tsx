"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import {
  ScrollText,
  ShieldCheck,
  RotateCw,
  Search,
  ChevronDown,
  ChevronUp,
  Bot,
  FileText,
  User,
} from "lucide-react";
import { Button } from "@/dashboard/components/ui/button";
import { Input } from "@/dashboard/components/ui/input";

interface AuditEntry {
  id?: string;
  auditId?: string;
  seq: number | string;
  agentId?: string;
  intentId?: string;
  eventType: string;
  actor: string;
  prevHash: string;
  rowHash: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Enough of the digest to follow a link by eye; the full value stays in the title attribute. */
function shortHash(hash?: string | null): string {
  if (!hash) return "—";
  return hash.length <= 20 ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
}

/** Matches verifyChain in src/core/audit/chain.ts. */
interface AuditVerifyResponse {
  valid: boolean;
  rowsChecked: number;
  brokenAt: string | null;
}

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verify, setVerify] = useState<AuditVerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [agentFilter, setAgentFilter] = useState("");
  const [intentFilter, setIntentFilter] = useState("");
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  const loadAudit = async (agent = agentFilter, intent = intentFilter) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (agent.trim()) params.set("agentId", agent.trim());
      if (intent.trim()) params.set("intentId", intent.trim());

      const url = params.toString() ? `${API.audit}?${params.toString()}` : API.audit;
      const [auditData, verifyData] = await Promise.all([
        apiGet<AuditResponse>(url),
        apiGet<AuditVerifyResponse>(API.auditVerify),
      ]);
      if (auditData?.entries) setEntries(auditData.entries);
      if (verifyData) setVerify(verifyData);
    } catch (err) {
      console.error("Failed to load audit trail:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Kicked off in a microtask: the loader sets state before its first await, and doing that
    // synchronously inside an effect updates state mid-commit.
    void Promise.resolve().then(() => loadAudit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerifyNow = async () => {
    try {
      setVerifying(true);
      const verifyData = await apiGet<AuditVerifyResponse>(API.auditVerify);
      setVerify(verifyData);
    } catch (err) {
      console.error("Audit verification failed:", err);
    } finally {
      setVerifying(false);
    }
  };

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div>
        {/* Issue 5: promoted to h1 so the page has a proper primary heading */}
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3 font-sans">
          <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <ScrollText className="h-5 w-5" />
          </div>
          Cryptographic Audit Trail
        </h1>
        {/* Issue 1: text-slate-500 → text-zinc-500 to consolidate grey ramp */}
        <p className="text-sm text-zinc-500 mt-1">
          Tamper-evident hash chain linking all decisions, payment reservations, and settlements.
        </p>
      </div>

      {/* Verification Banner — issues 2, 3, 7 */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800/40 text-white shadow-md">
        {/* Issue 7: button placed directly beside the status text, not pushed to the far right */}
        <div className="flex flex-wrap items-center gap-3.5">
          <div
            className={`p-2.5 rounded-xl border ${
              verify?.valid !== false
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-rose-500/20 text-rose-400 border-rose-500/30"
            }`}
          >
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-white flex items-center gap-2 font-mono flex-wrap">
              <span>Audit Hash Chain</span>
              {/* Issue 3: removed 'uppercase' so the badge text reads in sentence case */}
              {verify?.valid !== false ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified · Intact
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Broken at Seq #{String(verify?.brokenAt)}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-300 mt-0.5 font-mono">
              Verified {verify?.rowsChecked ?? entries.length} entries · SHA-256 Chained
            </p>
          </div>
          {/* Issue 7: 'Verify Chain Now' grouped with the status block it acts on */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden md:block text-right font-mono text-xs text-zinc-400">
              <div title={entries[0]?.rowHash}>Head: {shortHash(entries[0]?.rowHash)}</div>
            </div>
            <Button
              type="button"
              onClick={handleVerifyNow}
              disabled={verifying}
              className="gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shrink-0 cursor-pointer"
            >
              <RotateCw className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`} />
              <span>{verifying ? "Verifying..." : "Verify Chain Now"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar — issue 1: slate→zinc for icon colours */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            placeholder="Filter by Agent ID (e.g. agent_researchbot)..."
            className="pl-9 bg-white rounded-xl border-zinc-200 text-xs text-zinc-900"
          />
        </div>
        <div className="relative flex-1 w-full">
          <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            placeholder="Filter by Intent ID..."
            className="pl-9 bg-white rounded-xl border-zinc-200 text-xs text-zinc-900"
          />
        </div>
        <Button
          type="button"
          onClick={() => loadAudit(agentFilter, intentFilter)}
          className="rounded-xl text-xs px-4 bg-zinc-900 hover:bg-zinc-800 text-white shrink-0 w-full sm:w-auto"
        >
          Apply Filters
        </Button>
      </div>

      {/* Audit Log Entries — issue 1: slate→zinc; issue 2: rounded-2xl→rounded-xl for consistency */}
      <div className="bg-white rounded-xl border border-zinc-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-400 animate-pulse">
            Loading audit entries and checking SHA-256 chain integrity...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            No audit records match the given filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 font-mono text-xs">
            {entries.map((entry) => {
              const entryKey = entry.auditId || entry.id || String(entry.seq);
              const isExpanded = !!expandedPayloads[entryKey];

              return (
                <div key={entryKey} className="p-4 hover:bg-blue-50/20 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Issue 8: neutral zinc badge — no longer looks like a clickable link */}
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-bold">
                        Seq #{entry.seq}
                      </span>
                      {/* Issue 8: eventType was text-blue-600 (link colour) → text-zinc-800 */}
                      <span className="font-bold text-zinc-800">{entry.eventType}</span>
                      {/* Issue 1: text-slate-400 → text-zinc-400 */}
                      <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{entry.actor}</span>
                      </span>
                    </div>
                    {/* Issue 4: text-[11px] → text-xs (12px) for readability */}
                    <span className="text-zinc-400 text-xs">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Context IDs — issue 1: slate→zinc */}
                  <div className="flex items-center gap-4 text-xs text-zinc-600">
                    {entry.agentId && (
                      <span className="flex items-center gap-1 truncate" title={entry.agentId}>
                        <Bot className="h-3 w-3 text-blue-500" />
                        <span className="text-zinc-400">Agent:</span>
                        <span className="font-semibold text-zinc-800">{entry.agentId}</span>
                      </span>
                    )}
                    {entry.intentId && (
                      <span className="flex items-center gap-1 truncate" title={entry.intentId}>
                        <FileText className="h-3 w-3 text-amber-500" />
                        <span className="text-zinc-400">Intent:</span>
                        <span className="font-semibold text-zinc-800">{entry.intentId}</span>
                      </span>
                    )}
                  </div>

                  {/* Hash Chain Values — issue 1: slate→zinc */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-500 pt-0.5">
                    <div className="truncate">
                      <span className="text-zinc-400">Row Hash: </span>
                      <span className="text-zinc-800 font-semibold" title={entry.rowHash}>
                        {shortHash(entry.rowHash)}
                      </span>
                    </div>
                    <div className="truncate">
                      <span className="text-zinc-400">Prev Hash: </span>
                      <span className="text-zinc-600" title={entry.prevHash}>
                        {shortHash(entry.prevHash)}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible Payload — issue 6: taller hit target via py-1.5 px-2, min-h via inline style */}
                  {entry.payload && Object.keys(entry.payload).length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => togglePayload(entryKey)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer px-2 py-1.5 rounded-md hover:bg-zinc-100 transition-colors min-h-[32px]"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span>{isExpanded ? "Hide Payload Data" : "View Payload Data"}</span>
                      </button>
                      {isExpanded && (
                        <pre className="mt-2 p-3 rounded-lg bg-zinc-900 text-zinc-100 text-xs overflow-x-auto">
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
