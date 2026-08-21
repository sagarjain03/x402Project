"use client";

/** OWNER: UI · 🟢 ALLOW / 🟡 HOLD / 🔴 BLOCK chip. */
import type { Decision } from "@/shared/types";
import { CheckCircle2, AlertTriangle, ShieldBan } from "lucide-react";

export function DecisionBadge({
  decision,
  className = "",
}: {
  decision: Decision;
  className?: string;
}) {
  switch (decision) {
    case "ALLOW":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ALLOW
        </span>
      );
    case "HOLD":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-amber-50 text-amber-700 border border-amber-200 ${className}`}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          HOLD
        </span>
      );
    case "BLOCK":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-rose-50 text-rose-700 border border-rose-200 ${className}`}
        >
          <ShieldBan className="h-3.5 w-3.5 text-rose-600" />
          BLOCK
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-zinc-100 text-zinc-700 border border-zinc-200 ${className}`}
        >
          {decision}
        </span>
      );
  }
}
