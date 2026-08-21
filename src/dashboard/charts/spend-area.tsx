"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface SpendPoint {
  time: string;
  spend: number;
}

/** OWNER: UI · Recharts area chart: cumulative settled spend against a policy ceiling. */
export function SpendArea({
  data,
  budgetCeiling = 1.0,
  windowLabel = "settled payments",
  ceilingLabel = "Limit",
}: {
  data: SpendPoint[];
  budgetCeiling?: number;
  windowLabel?: string;
  ceilingLabel?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Cumulative spend
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {data.length} {windowLabel}, summed in order of settlement.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Actual Spend ($)
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            {ceilingLabel} (${budgetCeiling.toFixed(2)})
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-400">
          This agent has not settled a payment yet. Blocked and held payments never reach the chain,
          so nothing is plotted for them.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#71717a" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
                tick={{ fontSize: 11, fill: "#71717a" }}
              />
              <Tooltip
                formatter={(val: number | string) => [`$${Number(val).toFixed(2)}`, "Cumulative Spend"]}
                labelFormatter={(label) => `Time: ${label}`}
                contentStyle={{
                  backgroundColor: "#18181b",
                  borderColor: "#27272a",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                  fontSize: "12px",
                }}
              />
              <ReferenceLine
                y={budgetCeiling}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: `${ceilingLabel}: $${budgetCeiling.toFixed(2)}`,
                  fill: "#ef4444",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#spendGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
