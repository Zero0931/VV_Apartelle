"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeso, formatPesoCompact } from "@/lib/format";
import type { SeriesPoint } from "@/lib/analytics";

const SERIES = "#a86b1c"; // brand accent — single-series magnitude
const GRID = "#ebe7df";
const AXIS = "#9a948a";

function TooltipBox({ active, payload }: { active?: boolean; payload?: { payload: SeriesPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-muted">{p.detail}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{formatPeso(p.value)}</p>
    </div>
  );
}

export function RevenueChart({ data }: { data: SeriesPoint[] }) {
  const dense = data.length > 14;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={dense ? 2 : "22%"}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: AXIS, fontSize: 11 }}
            interval={dense ? 4 : 0}
            minTickGap={4}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickFormatter={(v: number) => formatPesoCompact(v)}
            width={48}
          />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(20,20,20,0.05)" }} />
          <Bar dataKey="value" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal meter rows: label, bar, value. Used for occupancy by room & payment mix. */
export function MeterList({
  rows,
}: {
  rows: { key: string; label: string; value: number; max: number; display: string; sub?: string }[];
}) {
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${r.display}${r.sub ? ` · ${r.sub}` : ""}`}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="tabular-nums">
              <b>{r.display}</b>
              {r.sub && <span className="ml-1.5 text-xs text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full"
              style={{ width: `${r.max ? Math.max(1.5, (r.value / r.max) * 100) : 0}%`, background: SERIES }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
