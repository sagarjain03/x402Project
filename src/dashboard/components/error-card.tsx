"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorCardProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorCard({
  title = "Failed to load data",
  message = "An unexpected error occurred while communicating with the ASPG policy engine.",
  onRetry,
  className = "",
}: ErrorCardProps) {
  return (
    <div
      className={`p-6 rounded-2xl border border-rose-200 bg-rose-50/70 text-rose-900 shadow-xs space-y-3 ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="font-bold text-sm text-rose-950 font-sans">{title}</h4>
          <p className="text-xs text-rose-800/90 leading-relaxed font-mono">{message}</p>
        </div>
      </div>

      {onRetry && (
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5 bg-white border-rose-200 text-xs font-semibold text-rose-800 hover:bg-rose-100 hover:text-rose-950 rounded-xl cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </div>
  );
}
