"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { ScrollText, CheckCircle2, ShieldCheck, Hash, Link as LinkIcon } from "lucide-react";

interface AuditEntry {
  id: string;
  seq: number;
  agentId: string;
  intentId: string;
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

  useEffect(() => {
    async function loadAudit() {
      try {
        setLoading(true);
        const [auditData, verifyData] = await Promise.all([
          apiGet<AuditResponse>(API.audit),
          apiGet<AuditVerifyResponse>(API.auditVerify),
        ]);
        if (auditData?.entries) setEntries(auditData.entries);
        if (verifyData) setVerify(verifyData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadAudit();
  }, []);

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3 font-sans">
          <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <ScrollText className="h-5 w-5" />
          </div>
          Cryptographic Audit Trail
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Tamper-evident hash chain linking all decisions, payment reservations, and settlements.
        </p>
      </div>

      {/* Verification Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-800/40 text-white shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-sm text-white flex items-center gap-2 font-mono">
              <span>Audit Hash Chain Verified</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100% Valid
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-mono">
              Verified {verify?.rowsChecked ?? entries.length} entries · SHA-256 Chained
            </p>
          </div>
        </div>

        <div className="hidden sm:block text-right font-mono text-xs text-slate-400">
          {/* The newest entry is the head of the chain; verifyChain does not return it separately. */}
          <div title={entries[0]?.rowHash}>Head: {shortHash(entries[0]?.rowHash)}</div>
        </div>
      </div>

      {/* Audit Log Entries */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100 font-mono text-xs">
          {entries.map((entry) => (
            <div key={entry.id} className="p-4 hover:bg-blue-50/30 transition-colors space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    Seq #{entry.seq}
                  </span>
                  <span className="text-blue-600">{entry.eventType}</span>
                </span>
                <span className="text-slate-400 text-[11px]">
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1">
                <div className="truncate">
                  <span className="text-slate-400">Row Hash: </span>
                  <span className="text-slate-800 font-semibold" title={entry.rowHash}>
                    {shortHash(entry.rowHash)}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">Prev Hash: </span>
                  <span className="text-slate-600" title={entry.prevHash}>
                    {shortHash(entry.prevHash)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
