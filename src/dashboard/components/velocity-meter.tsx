"use client";

/** OWNER: UI · Transactions this minute vs the limit. Fills up during demo D3. */
import { Zap, AlertTriangle } from "lucide-react";

export function VelocityMeter({
  current,
  limit,
  windowLabel = "tx / min",
}: {
  current: number;
  limit: number;
  windowLabel?: string;
}) {
  const percentage = Math.min(100, Math.round((current / limit) * 100));
  const isTripped = current >= limit;
  const isWarning = current >= limit * 0.8 && !isTripped;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-zinc-500" />
          Velocity ({windowLabel})
        </span>
        <div className="flex items-center gap-1.5 font-mono">
          <span
            className={`font-bold ${
              isTripped ? "text-rose-600" : isWarning ? "text-amber-600" : "text-zinc-900"
            }`}
          >
            {current}
          </span>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-600">{limit}</span>
          <span
            className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isTripped
                ? "bg-rose-100 text-rose-700 border border-rose-200"
                : isWarning
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {percentage}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isTripped ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
        <span>Headroom: {Math.max(0, limit - current)} payments remaining</span>
        {isTripped && (
          <span className="text-rose-600 font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Trip Limit Exceeded
          </span>
        )}
      </div>
    </div>
  );
}
