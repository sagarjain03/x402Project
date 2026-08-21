"use client";

/** OWNER: UI · 🟢 ALLOW / 🟡 HOLD / 🔴 BLOCK chip. */
import type { Decision } from "@/shared/types";
import { CheckCircle2, AlertTriangle, ShieldBan } from "lucide-react";
import { Badge } from "@/dashboard/components/ui/badge";
import { cn } from "@/lib/utils";

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
        <Badge
          variant="success"
          className={cn("gap-1.5 font-mono text-xs font-semibold", className)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          ALLOW
        </Badge>
      );
    case "HOLD":
      return (
        <Badge
          variant="warning"
          className={cn("gap-1.5 font-mono text-xs font-semibold", className)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          HOLD
        </Badge>
      );
    case "BLOCK":
      return (
        <Badge
          variant="destructive"
          className={cn("gap-1.5 font-mono text-xs font-semibold", className)}
        >
          <ShieldBan className="h-3.5 w-3.5" />
          BLOCK
        </Badge>
      );
    default:
      return (
        <Badge
          variant="secondary"
          className={cn("gap-1.5 font-mono text-xs font-semibold", className)}
        >
          {decision}
        </Badge>
      );
  }
}

