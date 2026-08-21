"use client";

import Link from "next/link";
import { formatCountdown, usePendingApprovals } from "@/dashboard/hooks/usePendingApprovals";
import { Hourglass, Timer } from "lucide-react";

/**
 * OWNER: UI · The queue, visible from wherever you are.
 *
 * A hold expires whether or not anyone is looking at the approvals page, so the countdown to the
 * nearest expiry lives in the header. It renders nothing at all when nothing needs a human —
 * a permanently-lit badge teaches people to stop reading it.
 */
export function ApprovalsBell() {
  const { live, expired, soonestSeconds } = usePendingApprovals();

  if (live.length === 0 && expired === 0) return null;

  const urgent = soonestSeconds !== null && soonestSeconds < 60;

  return (
    <Link
      href="/approvals"
      title={`${live.length} payment(s) awaiting review${expired > 0 ? `, ${expired} expired` : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold transition-colors ${
        urgent
          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          : live.length > 0
          ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : "border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-100"
      }`}
    >
      {live.length > 0 ? (
        <>
          <Timer className="h-3 w-3" />
          <span>{live.length} to review</span>
          {soonestSeconds !== null && (
            <span className="opacity-80">· {formatCountdown(soonestSeconds)}</span>
          )}
        </>
      ) : (
        <>
          <Hourglass className="h-3 w-3" />
          <span>{expired} expired</span>
        </>
      )}
    </Link>
  );
}
