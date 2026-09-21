"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProjectionPoint } from "@/lib/finance";
import { brl } from "@/lib/format";
import { ChartLegend, ChartTooltip } from "./chart-tooltip";

/**
 * Projecao empilhada: aporte embaixo, rendimento em cima. Empilhar deixa ver
 * o momento em que o rendimento passa a crescer mais que o proprio aporte —
 * que e a coisa que a projecao existe pra mostrar.
 */
export function ProjectionChart({ data }: { data: ProjectionPoint[] }) {
  // Um ponto por ano: 120 pontos mensais viram ruído visual num gráfico de 10 anos.
  const yearly = data.filter((point) => point.month % 12 === 0);

  return (
    <div className="flex flex-col gap-3">
      <ChartLegend
        items={[
          { label: "Aportado", color: "var(--chart-2)" },
          { label: "Rendimento", color: "var(--chart-1)" },
        ]}
      />
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={yearly} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={(value: number) => `${value}a`}
              tickLine={false}
              axisLine={false}
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
                    title={`Ano ${label}`}
                    rows={[
                      {
                        label: "Aportado",
                        value: brl(Number(payload[0]?.value ?? 0)),
                        color: "var(--chart-2)",
                      },
                      {
                        label: "Rendimento",
                        value: brl(Number(payload[1]?.value ?? 0)),
                        color: "var(--chart-1)",
                      },
                      {
                        label: "Total",
                        value: brl(Number(payload[0]?.value ?? 0) + Number(payload[1]?.value ?? 0)),
                        color: "var(--content-tertiary)",
                      },
                    ]}
                  />
                ) : null
              }
            />
            {/* 2px de respiro entre as faixas empilhadas, na cor da superfície. */}
            <Area
              type="monotone"
              dataKey="contributed"
              stackId="total"
              stroke="var(--surface-raised)"
              strokeWidth={2}
              fill="var(--chart-2)"
              fillOpacity={0.85}
            />
            <Area
              type="monotone"
              dataKey="earnings"
              stackId="total"
              stroke="var(--surface-raised)"
              strokeWidth={2}
              fill="var(--chart-1)"
              fillOpacity={0.85}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
