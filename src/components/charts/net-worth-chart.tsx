"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NetWorthPoint } from "@/types/domain";
import { brl, monthLabel } from "@/lib/format";
import { ChartLegend, ChartTooltip } from "./chart-tooltip";

/**
 * Evolucao do patrimonio. A area e o total; a linha e quanto disso foi aporte.
 * A distancia entre as duas e a rentabilidade — que e a leitura que interessa,
 * e some num grafico que mostre so o total.
 */
export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const series = data.map((point) => ({
    month: point.date.slice(0, 7),
    total: point.total,
    contributed: point.contributed,
  }));

  return (
    <div className="flex flex-col gap-3">
      <ChartLegend
        items={[
          { label: "Patrimônio", color: "var(--chart-1)" },
          { label: "Total aportado", color: "var(--chart-2)" },
        ]}
      />
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fill: "var(--content-tertiary)", fontSize: 12 }}
            />
            <YAxis
              width={64}
              tickFormatter={(value: number) => brl(value, true)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--content-tertiary)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={monthLabel(String(label))}
                    rows={[
                      {
                        label: "Patrimônio",
                        value: brl(Number(payload[0]?.value ?? 0)),
                        color: "var(--chart-1)",
                      },
                      {
                        label: "Total aportado",
                        value: brl(Number(payload[1]?.value ?? 0)),
                        color: "var(--chart-2)",
                      },
                    ]}
                  />
                ) : null
              }
            />

            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#netWorthFill)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-raised)" }}
            />
            <Line
              type="monotone"
              dataKey="contributed"
              stroke="var(--chart-2)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-raised)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
