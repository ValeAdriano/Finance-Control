"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BenchmarkPoint } from "@/types/domain";
import { decimal, monthLabel } from "@/lib/format";
import { ChartLegend, ChartTooltip } from "./chart-tooltip";

const SERIES = [
  { key: "carteira", label: "Carteira", color: "var(--chart-1)" },
  { key: "cdi", label: "CDI", color: "var(--chart-2)" },
  { key: "ibov", label: "IBOV", color: "var(--chart-3)" },
  { key: "ipca", label: "IPCA", color: "var(--chart-4)" },
] as const;

/**
 * Carteira contra CDI, IBOV e IPCA. Todos indexados em base 100 no mesmo eixo:
 * comparar retorno acumulado exige base comum — dois eixos y seria enganoso.
 */
export function BenchmarkChart({ data }: { data: BenchmarkPoint[] }) {
  const series = data.map((point) => ({ ...point, month: point.date.slice(0, 7) }));

  return (
    <div className="flex flex-col gap-3">
      <ChartLegend items={SERIES.map(({ label, color }) => ({ label, color }))} />
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fill: "var(--content-tertiary)", fontSize: 12 }}
            />
            <YAxis
              width={44}
              domain={["dataMin - 5", "dataMax + 5"]}
              tickFormatter={(value: number) => decimal(value, 0)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--content-tertiary)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={`${monthLabel(String(label))} · base 100`}
                    rows={SERIES.map((s) => ({
                      label: s.label,
                      value: decimal(
                        Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0),
                        1,
                      ),
                      color: s.color,
                    }))}
                  />
                ) : null
              }
            />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-raised)" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
