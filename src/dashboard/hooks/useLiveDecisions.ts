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

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type === "DECISION" || data?.decision) {
              const newDecision: LiveDecisionItem = {
                id: data.id || `tx_${Date.now()}`,
                intentId: data.intentId || `intent_${Date.now()}`,
                agentId: data.agentId || "agent_researchbot",
                agentName: data.agentName || "ResearchBot",
                merchant: data.merchant || "localhost:3000",
                amountUsd: data.amountUsd || "0.05",
                decision: data.decision,
                policyVersion: data.policyVersion || 3,
                matchedRules: data.matchedRules || [],
                riskScore: data.riskScore ?? 10,
                latencyMs: data.latencyMs || 20,
                reasons: data.reasons || [],
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
