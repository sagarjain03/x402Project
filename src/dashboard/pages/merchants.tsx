"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { Store, CheckCircle2, Ban, ExternalLink, Globe } from "lucide-react";

interface MerchantItem {
  domain: string;
  name: string;
  status: string;
  pinnedRecipient: string;
  trustLevel: string;
  txCount24h: number;
  volumeUsd24h: string;
}

/** CORE has no merchants table yet, so it derives this from each agent's policy allowlist. */
interface PolicyMerchantGroup {
  agentId: string;
  policyVersion: number;
  allowed: { domain: string; pinnedRecipient: string | null }[];
  blocked: string[];
  unknownMerchantAction: string;
}

interface MerchantsResponse {
  merchants: PolicyMerchantGroup[];
  total: number;
}

function toMerchantItems(groupsOrList: (PolicyMerchantGroup | MerchantItem)[]): MerchantItem[] {
  if (!Array.isArray(groupsOrList)) return [];
  const byDomain = new Map<string, MerchantItem>();

  for (const item of groupsOrList) {
    if (!item) continue;

    // Shape 1: PolicyMerchantGroup { agentId, allowed: [{domain, pinnedRecipient}], blocked: [...] }
    if ("allowed" in item) {
      if (Array.isArray(item.allowed)) {
        for (const entry of item.allowed) {
          if (!entry || !entry.domain) continue;
          byDomain.set(entry.domain, {
            domain: entry.domain,
            name: entry.domain === "localhost:3000" ? "Sandbox Local API" : entry.domain,
            status: "ALLOWED",
            pinnedRecipient: entry.pinnedRecipient ?? "",
            trustLevel: entry.pinnedRecipient ? "PINNED" : "UNPINNED",
            txCount24h: 0,
            volumeUsd24h: "0.00",
          });
        }
      }
      if (Array.isArray(item.blocked)) {
        for (const domain of item.blocked) {
          if (!domain) continue;
          byDomain.set(domain, {
            domain,
            name: domain === "rogue.example.com" ? "Rogue Merchant" : domain,
            status: "BLOCKED",
            pinnedRecipient: "",
            trustLevel: "BLOCKED",
            txCount24h: 0,
            volumeUsd24h: "0.00",
          });
        }
      }
    } else if ("domain" in item && item.domain) {
      // Shape 2: Flat MerchantItem { domain, name, status, pinnedRecipient, ... }
      byDomain.set(item.domain, {
        domain: item.domain,
        name: item.name || item.domain,
        status: item.status || "ALLOWED",
        pinnedRecipient: item.pinnedRecipient ?? "",
        trustLevel: item.trustLevel || (item.pinnedRecipient ? "PINNED" : "UNPINNED"),
        txCount24h: item.txCount24h ?? 0,
        volumeUsd24h: item.volumeUsd24h ?? "0.00",
      });
    }
  }

  return [...byDomain.values()];
}

export function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMerchants() {
      try {
        setLoading(true);
        const data = await apiGet<MerchantsResponse>(API.merchants);
        if (data?.merchants) {
          setMerchants(toMerchantItems(data.merchants));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load merchants");
      } finally {
        setLoading(false);
      }
    }

    loadMerchants();
  }, []);

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3 font-sans">
          <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Store className="h-5 w-5" />
          </div>
          Merchant Controls & Recipient Pinning
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Allowlisted service providers, pinned settlement recipients, and domain-level blocklists.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Merchants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
          ))
        ) : (
          merchants.map((m) => {
            const isAllowed = m.status === "ALLOWED";
            return (
              <div
                key={m.domain}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${isAllowed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                    >
                      {isAllowed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      {m.status}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      24h Vol: ${m.volumeUsd24h}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-slate-900">{m.name}</h3>
                    <p className="text-xs font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                      <Globe className="h-3 w-3 text-slate-400" />
                      {m.domain}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs space-y-1 font-mono">
                  <span className="text-slate-400 text-[11px]">Pinned PayTo Recipient:</span>
                  <div className="text-[11px] text-slate-700 truncate bg-slate-50 p-2 rounded-lg border border-slate-200" title={m.pinnedRecipient}>
                    {m.pinnedRecipient || "None (Open Recipient)"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
