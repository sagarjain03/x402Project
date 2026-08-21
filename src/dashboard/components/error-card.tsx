"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/dashboard/components/ui/button";

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
      className={`p-5 rounded-xl border border-gray-200 bg-white shadow-xs space-y-3 border-l-4 border-l-red-500 ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <h4 className="font-bold text-sm text-gray-800 font-sans">{title}</h4>
          <p className="text-xs text-gray-600 leading-relaxed font-mono">{message}</p>
        </div>
      </div>

      {onRetry && (
        <div className="pt-1 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5 bg-white border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </div>
  );
}
