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

/** The stream may carry a reason as a bare code or as the full object. Normalise to the object. */
function toReason(value: unknown): { code: string; rule?: string; message: string } {
  if (typeof value === "string") return { code: value, message: value };
  const r = value as { code?: unknown; rule?: unknown; message?: unknown };
  const code = typeof r?.code === "string" ? r.code : "UNKNOWN";
  return {
    code,
    rule: typeof r?.rule === "string" ? r.rule : undefined,
    message: typeof r?.message === "string" ? r.message : code,
  };
}

/**
 * The event bus behind /events/stream is in-process, so on a multi-instance deploy the payment is
 * evaluated in one instance and the stream is held by another — the connection opens, sends
 * `ready`, and then delivers nothing forever. Polling the transactions endpoint is what actually
 * keeps the feed live there; SSE stays as the instant path when one process serves both.
 */
const REFRESH_MS = 10_000;

export function useLiveDecisions(agentId?: string) {
  const [decisions, setDecisions] = useState<LiveDecisionItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let isMounted = true;

    // The server is the source of truth: a refresh replaces the list rather than merging, so an
    // optimistic row from SSE that never landed in Postgres disappears instead of lingering.
    async function fetchRows(): Promise<boolean> {
      const path = agentId ? `${API.transactions}?agentId=${agentId}` : API.transactions;
      try {
        const res = await apiGet<TransactionsApiResponse>(path);
        if (isMounted && res?.transactions) setDecisions(res.transactions.map(toFeedItem));
        return true;
      } catch (err) {
        console.warn("[useLiveDecisions] Failed to load decisions:", err);
        return false;
      }
    }

    async function loadInitial() {
      setLoading(true);
      const ok = await fetchRows();
      if (isMounted) {
        setIsConnected(ok);
        setLoading(false);
      }
    }

    loadInitial();

    // "Live" has to mean data actually arrived. A stream that is open but silent is not live, and
    // a background tab polling every 10s is just wasted requests.
    const poll = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchRows().then((ok) => {
        if (isMounted) setIsConnected(ok);
      });
    }, REFRESH_MS);

    // Setup SSE connection
    function connectSSE() {
      if (typeof window === "undefined" || !window.EventSource) return;

      const sseUrl = agentId ? `${API.events}?agentId=${agentId}` : API.events;
      try {
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        // Deliberately does not touch isConnected: an open stream proves the route answered, not
        // that any decision will ever come down it. The poll owns that flag.

        const handleEvent = (event: MessageEvent) => {
          try {
            const raw = JSON.parse(event.data);
            const data = raw?.payload ? { ...raw.payload, agentId: raw.agentId, intentId: raw.intentId, eventType: raw.eventType } : raw;
            if (data?.type === "DECISION" || data?.decision || raw?.eventType === "DECISION" || event.type === "decision") {
              const intentId = data.intentId || raw.intentId;
              const decision = data.decision;
              const amountUsd = data.amountUsd
                || (data.amountMinor ? (Number(data.amountMinor) / 1_000_000).toFixed(2) : undefined);
              const merchant = data.merchant || data.merchantDomain;

              // An event missing any of these is dropped rather than completed with invented
              // values. A row that names an agent, a merchant or a decision the server never sent
              // is worse than a row that never appears.
              if (!intentId || !decision || !amountUsd || !merchant) return;

              const newDecision: LiveDecisionItem = {
                id: data.id || intentId,
                intentId,
                agentId: data.agentId || raw.agentId,
                agentName: data.agentName,
                merchant,
                amountUsd,
                decision,
                policyVersion: data.policyVersion,
                matchedRules: data.matchedRules || [],
                riskScore: data.riskScore,
                latencyMs: data.latencyMs,
                // Kept as objects. Flattening them to strings here is what made reason.message
                // undefined for every consumer downstream.
                reasons: Array.isArray(data.reasons) ? data.reasons.map(toReason) : [],
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
          es.close();
          // Auto-reconnect after 3 seconds. The poll keeps the feed current meanwhile, so a stream
          // that never comes back is a lost optimisation, not a broken page.
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
      clearInterval(poll);
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
