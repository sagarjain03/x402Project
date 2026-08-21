"use client";

/** OWNER: UI · ALLOW / HOLD / BLOCK label — icon + tracking-widest uppercase, no pill. */
import type { Decision } from "@/shared/types";
import { cn } from "@/lib/utils";

/** Inline SVGs keep this dependency-free and let color be set via className. */
const CheckIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="2.5,8.5 6.5,12.5 13.5,3.5" />
  </svg>
);

const PauseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
    <rect x="3" y="2" width="3.5" height="12" rx="1" />
    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={className}>
    <line x1="3" y1="3" x2="13" y2="13" />
    <line x1="13" y1="3" x2="3" y2="13" />
  </svg>
);

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
        <span className={cn("inline-flex items-center gap-1.5", className)}>
          <CheckIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Allow</span>
        </span>
      );
    case "HOLD":
      return (
        <span className={cn("inline-flex items-center gap-1.5", className)}>
          <PauseIcon className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Hold</span>
        </span>
      );
    case "BLOCK":
      return (
        <span className={cn("inline-flex items-center gap-1.5", className)}>
          <XIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Block</span>
        </span>
      );
    default:
      return (
        <span className={cn("text-xs font-bold text-gray-400 tracking-widest uppercase", className)}>
          {decision}
        </span>
      );
  }
}
