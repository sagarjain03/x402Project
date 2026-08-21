"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface DecisionMixRow {
  name: string;
  allow: number;
  hold: number;
  block: number;
}

/** OWNER: UI · Recharts bar chart: ALLOW / HOLD / BLOCK counts per agent, as recorded. */
export function DecisionBar({
  data,
  windowLabel = "all recorded decisions",
}: {
  data: DecisionMixRow[];
  windowLabel?: string;
}) {
  const total = data.reduce((acc, row) => acc + row.allow + row.hold + row.block, 0);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Decision Mix by Agent
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {total} {total === 1 ? "decision" : "decisions"} · {windowLabel}.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            ALLOW
          </span>
          <span className="flex items-center gap-1 text-amber-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            HOLD
          </span>
          <span className="flex items-center gap-1 text-rose-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            BLOCK
          </span>
        </div>
      </div>

      {total === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          No decisions recorded yet. Run a task from the agent console and this fills in.
        </p>
      ) : (
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#f4f4f5" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                borderColor: "#27272a",
                borderRadius: "8px",
                color: "#f4f4f5",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="allow" fill="#10b981" radius={[4, 4, 0, 0]} name="ALLOW" />
            <Bar dataKey="hold" fill="#f59e0b" radius={[4, 4, 0, 0]} name="HOLD" />
            <Bar dataKey="block" fill="#f43f5e" radius={[4, 4, 0, 0]} name="BLOCK" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
