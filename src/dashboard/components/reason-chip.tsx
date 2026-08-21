"use client";

/** OWNER: UI · Turns an error code into a sentence a judge understands. */
import { ERROR_CODES, type ErrorCode } from "@/shared/errors";
import { AlertCircle } from "lucide-react";

export function ReasonChip({
  code,
  message,
  className = "",
}: {
  code: string;
  message?: string;
  className?: string;
}) {
  const isKnownCode = code in ERROR_CODES;
  const standardMessage = isKnownCode
    ? ERROR_CODES[code as ErrorCode]?.message
    : code;
  const displayMessage = message || standardMessage;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200/80 ${className}`}
      title={`Error Code: ${code}`}
    >
      <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
      <span className="truncate">{displayMessage}</span>
    </span>
  );
}
