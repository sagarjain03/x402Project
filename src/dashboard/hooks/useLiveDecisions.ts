"use client";

import { useEffect, useState, useRef } from "react";
import type { Decision } from "@/shared/types";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";

/**
 * OWNER: UI
 * WHAT: EventSource subscription to /api/v1/events/stream with fallback to initial transaction load.
 * EVENTS: decision | settlement | budget | approval (API_DOCS 5.7)
 */

export interface LiveDecisionItem {
  id: string;
  intentId: string;
  agentId: string;
  agentName?: string;
  merchant: string;
  resource?: string;
  reason?: string;
  amountUsd: string;
  asset?: string;
  network?: string;
  recipient?: string;
  decision: Decision;
  state?: string;
  policyVersion?: number;
  matchedRules?: string[];
  riskScore?: number;
  riskSignals?: { signal: string; points: number }[];
  latencyMs?: number;
  reasons?: { code: string; rule?: string; message: string }[];
  txHash?: string | null;
  approvalStatus?: string;
  approvalExpiresAt?: string;
  createdAt: string;
  settledAt?: string;
}

/** CORE groups these; the feed reads them flat. See toIntentDto in src/core/handlers/serialize.ts. */
export type TransactionRow = LiveDecisionItem & {
  settlement?: { txHash: string | null; explorerUrl: string | null; settledAt: string | null };
  approval?: { status: string | null; expiresAt: string | null };
};

interface TransactionsApiResponse {
  transactions: TransactionRow[];
  total: number;
}

// Normalised at the one place rows enter, so every consumer of the hook sees one shape. Without
// this a settled payment renders with no explorer link — the proof the whole demo rests on.
export function toFeedItem(row: TransactionRow): LiveDecisionItem {
  return {
    ...row,
    txHash: row.settlement?.txHash ?? row.txHash ?? null,
    settledAt: row.settlement?.settledAt ?? row.settledAt ?? undefined,
    approvalStatus: row.approval?.status ?? row.approvalStatus ?? undefined,
    approvalExpiresAt: row.approval?.expiresAt ?? row.approvalExpiresAt ?? undefined,
  };
}

export function useLiveDecisions(agentId?: string) {
  const [decisions, setDecisions] = useState<LiveDecisionItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      try {
        setLoading(true);
        const path = agentId ? `${API.transactions}?agentId=${agentId}` : API.transactions;
        const res = await apiGet<TransactionsApiResponse>(path);
        if (isMounted && res?.transactions) {
          setDecisions(res.transactions.map(toFeedItem));
        }
      } catch (err) {
        console.warn("[useLiveDecisions] Failed to load initial decisions:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitial();

    // Setup SSE connection
    function connectSSE() {
      if (typeof window === "undefined" || !window.EventSource) return;

      const sseUrl = agentId ? `${API.events}?agentId=${agentId}` : API.events;
      try {
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isMounted) setIsConnected(true);
        };

        const handleEvent = (event: MessageEvent) => {
          try {
            const raw = JSON.parse(event.data);
            const data = raw?.payload ? { ...raw.payload, agentId: raw.agentId, intentId: raw.intentId, eventType: raw.eventType } : raw;
            if (data?.type === "DECISION" || data?.decision || raw?.eventType === "DECISION" || event.type === "decision") {
              const amountUsd = data.amountUsd
                || (data.amountMinor ? (Number(data.amountMinor) / 1_000_000).toFixed(2) : "0.00");
              const newDecision: LiveDecisionItem = {
                id: data.id || raw.intentId || `tx_${Date.now()}`,
                intentId: data.intentId || raw.intentId || `intent_${Date.now()}`,
                agentId: data.agentId || raw.agentId || "agent",
                agentName: data.agentName || (data.agentId ? String(data.agentId).replace(/^agent_/, "") : "Agent"),
                merchant: data.merchant || data.merchantDomain || "merchant",
                amountUsd,
                decision: data.decision || "BLOCK",
                policyVersion: data.policyVersion || 1,
                matchedRules: data.matchedRules || [],
                riskScore: data.riskScore ?? 0,
                latencyMs: data.latencyMs || 0,
                reasons: Array.isArray(data.reasons) ? data.reasons.map((r: any) => typeof r === "string" ? r : r.code || r.message || JSON.stringify(r)) : [],
                txHash: data.txHash || null,
                createdAt: data.createdAt || new Date().toISOString(),
              };

              if (isMounted) {
                setDecisions((prev) => [newDecision, ...prev]);
              }
            }
          } catch (e) {
            console.error("[useLiveDecisions] Error parsing event:", e);
          }
        };

        es.onmessage = handleEvent;
        es.addEventListener("decision", handleEvent);
        es.addEventListener("settlement", handleEvent);

        es.onerror = () => {
          if (isMounted) setIsConnected(false);
          es.close();
          // Auto-reconnect after 3 seconds
          setTimeout(() => {
            if (isMounted) connectSSE();
          }, 3000);
        };
      } catch (e) {
        console.warn("[useLiveDecisions] SSE setup error:", e);
      }
    }

    connectSSE();

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [agentId]);

  return {
    decisions,
    isConnected,
    loading,
  };
}
