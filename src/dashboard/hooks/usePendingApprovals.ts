"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { toFeedItem, type LiveDecisionItem, type TransactionRow } from "@/dashboard/hooks/useLiveDecisions";

/**
 * OWNER: UI · The HOLD queue, shared by the approvals page and the header badge.
 *
 * The server sends the seconds remaining as IT sees them; that is turned into an absolute deadline
 * once, at fetch time, and the countdown ticks against the clock from there. Decrementing a local
 * counter instead — which is what the old card did — drifts on a backgrounded tab and starts from
 * a made-up 300 whatever the row's real TTL was.
 */

export interface ApprovalItem extends LiveDecisionItem {
  /** Server-computed, at the moment of the fetch. Null when the row carries no expiry. */
  expiresInSeconds: number | null;
  /** The same instant as an epoch ms, so the countdown survives a slow render. */
  expiresAtMs: number | null;
}

type ApprovalRow = TransactionRow & { expiresInSeconds?: number | null };

interface ApprovalsResponse {
  approvals: ApprovalRow[];
  total: number;
}

interface AgentsResponse {
  agents: { agentId: string; name: string }[];
}

/** Seconds until this hold expires. Null means "no deadline", 0 means "already expired". */
export function secondsLeft(item: ApprovalItem, nowMs: number): number | null {
  if (item.expiresAtMs === null) return null;
  return Math.max(0, Math.round((item.expiresAtMs - nowMs) / 1000));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function usePendingApprovals(
  { pollMs = 20_000, enabled = true }: { pollMs?: number; enabled?: boolean } = {},
) {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setError(null);
      // The approvals endpoint returns agentId, not the name. The roster is joined here so a card
      // can never display an agent it has not actually identified — a failed roster fetch leaves
      // agentName undefined and the card falls back to the id.
      const [data, roster] = await Promise.all([
        apiGet<ApprovalsResponse>(API.approvals),
        apiGet<AgentsResponse>(API.agents).catch(() => null),
      ]);
      const names = new Map((roster?.agents ?? []).map((agent) => [agent.agentId, agent.name]));
      const fetchedAt = Date.now();

      setApprovals(
        (data?.approvals ?? []).map((row) => {
          const remaining = row.expiresInSeconds ?? null;
          const expiresAt = row.approval?.expiresAt ?? row.approvalExpiresAt ?? null;
          return {
            ...toFeedItem(row),
            agentName: names.get(row.agentId),
            expiresInSeconds: remaining,
            expiresAtMs:
              remaining !== null ? fetchedAt + remaining * 1000
              : expiresAt ? new Date(expiresAt).getTime()
              : null,
          };
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the approval queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Kicked off in a microtask: the loader sets state before its first await, and doing that
    // synchronously inside an effect updates state mid-commit.
    void Promise.resolve().then(load);
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs, enabled]);

  useEffect(() => {
    // Only tick countdown when there are active items with deadlines
    const hasActiveDeadlines = approvals.some(
      (item) => item.expiresAtMs !== null && item.expiresAtMs > Date.now()
    );
    if (!hasActiveDeadlines) return;

    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [approvals]);

  // Dropped locally the moment a reviewer acts, so the card disappears without waiting for the
  // next poll. The next poll is what confirms it: if the write failed, the row comes straight back.
  const resolve = useCallback((id: string) => {
    setApprovals((prev) => prev.filter((item) => (item.intentId || item.id) !== id));
  }, []);

  const live = approvals.filter((item) => (secondsLeft(item, nowMs) ?? 1) > 0);
  const expired = approvals.length - live.length;
  const soonestSeconds = live.reduce<number | null>((best, item) => {
    const left = secondsLeft(item, nowMs);
    if (left === null) return best;
    return best === null || left < best ? left : best;
  }, null);

  return { approvals, live, expired, loading, error, nowMs, soonestSeconds, refresh: load, resolve };
}
