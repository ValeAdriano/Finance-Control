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
import type { PricePoint } from "@/types/domain";
import { money, shortDate } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

/**
 * Serie de cotacao de um ativo. Serie unica: o titulo do card ja diz qual e o
 * ativo, entao nao ha legenda a acrescentar.
 */
export function PriceChart({
  data,
  currency,
  height = 220,
}: {
  data: PricePoint[];
  currency: "BRL" | "USD";
  height?: number;
}) {
  const rising = data.length > 1 && data[data.length - 1].close >= data[0].close;
  const color = rising ? "var(--positive)" : "var(--negative)";

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={false}
            minTickGap={36}
            tick={{ fill: "var(--content-tertiary)", fontSize: 12 }}
          />
          <YAxis
            width={60}
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value: number) => money(value, currency, true)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--content-tertiary)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltip
                  title={shortDate(String(label))}
                  rows={[
                    {
                      label: "Fechamento",
                      value: money(Number(payload[0]?.value ?? 0), currency),
                      color,
                    },
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={2}
            fill="url(#priceFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-raised)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
