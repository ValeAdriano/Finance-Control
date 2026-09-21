"use client";

import type { ReactNode } from "react";

/**
 * Tooltip compartilhado dos graficos. O texto usa token de tinta, nunca a cor
 * da serie — a cor mora no marcador ao lado, que e quem carrega a identidade.
 */
export function ChartTooltip({
  title,
  rows,
}: {
  title: ReactNode;
  rows: { label: string; value: string; color: string }[];
}) {
  return (
    <div className="border-line bg-raised rounded-[12px] border px-3 py-2 shadow-[var(--shadow-raised)]">
      <p className="text-muted mb-1.5 text-[12px] font-medium">{title}</p>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-[13px]">
            <span className="text-muted flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              {row.label}
            </span>
            <span className="tabular text-content font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legenda em linha. Presente sempre que o grafico tem 2 ou mais series. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="text-muted flex items-center gap-1.5 text-[13px]">
          <span
            aria-hidden
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
