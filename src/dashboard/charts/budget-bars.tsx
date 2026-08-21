"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * OWNER: UI · How much of each agent's budget is gone, in the window the budget rule reads.
 *
 * Spent and reserved are stacked because the engine adds them together before comparing against
 * the ceiling: an agent at 90% spent with a live reservation is out of room, and a chart that drew
 * only the spent half would show it as safe.
 */

export interface BudgetBarRow {
  name: string;
  spent: number;
  reserved: number;
  remaining: number;
  budget: number;
  usedPercent: number;
}

const barColour = (percent: number) =>
  percent >= 100 ? "#f43f5e" : percent >= 75 ? "#f59e0b" : "#10b981";

export function BudgetBars({
  data,
  windowLabel = "30 days",
}: {
  data: BudgetBarRow[];
  windowLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
            Budget used by agent ({windowLabel})
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">
            Committed spend plus live reservations, against the ceiling in each agent&apos;s policy.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 font-medium text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            used
          </span>
          <span className="flex items-center gap-1 font-medium text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-zinc-200" />
            remaining
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          No agent has an active policy with a budget yet.
        </p>
      ) : (
        <div className="w-full" style={{ height: Math.max(160, data.length * 46) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#f4f4f5" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
                tick={{ fontSize: 11, fill: "#71717a" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={96}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#3f3f46" }}
              />
              <Tooltip
                cursor={{ fill: "#fafafa" }}
                formatter={(value: number | string, key) => [`$${Number(value).toFixed(2)}`, String(key)]}
                contentStyle={{
                  backgroundColor: "#18181b",
                  borderColor: "#27272a",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="spent" stackId="b" name="spent" radius={[4, 0, 0, 4]}>
                {data.map((row) => (
                  <Cell key={row.name} fill={barColour(row.usedPercent)} />
                ))}
              </Bar>
              <Bar dataKey="reserved" stackId="b" name="reserved" fill="#a7f3d0" />
              <Bar dataKey="remaining" stackId="b" name="remaining" fill="#e4e4e7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
