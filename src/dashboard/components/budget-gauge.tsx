"use client";

/** OWNER: UI · Hour / day / month utilisation. Shows reserved separately from spent. */
export function BudgetGauge({
  spent,
  budget,
  reserved = "0.00",
  label = "Budget Utilisation",
}: {
  spent: string;
  budget: string;
  reserved?: string;
  label?: string;
}) {
  const spentNum = parseFloat(spent) || 0;
  const budgetNum = parseFloat(budget) || 1;
  const reservedNum = parseFloat(reserved) || 0;

  const spentPercent = Math.min(100, Math.round((spentNum / budgetNum) * 100));
  const reservedPercent = Math.min(
    100 - spentPercent,
    Math.round((reservedNum / budgetNum) * 100)
  );

  const totalUtilized = spentPercent + reservedPercent;
  const isExhausted = totalUtilized >= 100;
  const isWarning = totalUtilized >= 75 && !isExhausted;

  return (
    <div className="space-y-2 bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-700 uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-center gap-1.5 font-mono">
          <span className={`font-bold ${isExhausted ? "text-rose-600" : isWarning ? "text-amber-600" : "text-zinc-900"}`}>
            ${spent}
          </span>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-600">${budget}</span>
          <span
            className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isExhausted
                ? "bg-rose-100 text-rose-700 border border-rose-200"
                : isWarning
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {totalUtilized}%
          </span>
        </div>
      </div>

      {/* Segmented Bar */}
      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden flex">
        {/* Spent bar */}
        <div
          className={`h-full transition-all ${
            isExhausted ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${spentPercent}%` }}
        />
        {/* Reserved bar (in flight) */}
        {reservedPercent > 0 && (
          <div
            className="h-full bg-blue-400 transition-all opacity-80"
            style={{ width: `${reservedPercent}%` }}
            title={`Reserved: $${reserved}`}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5 font-mono">
        <span>Headroom: ${(Math.max(0, budgetNum - spentNum - reservedNum)).toFixed(2)}</span>
        {reservedNum > 0 && <span className="text-blue-600 font-medium">In Flight: ${reserved}</span>}
      </div>
    </div>
  );
}
