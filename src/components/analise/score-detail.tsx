import { Check, Minus, X } from "lucide-react";
import type { Criterion, ScoreResult } from "@/lib/scoring";
import { SCORE_BAND_LABEL, scoreBand } from "@/lib/scoring";
import { decimal, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Abertura do score. Cada dimensao mostra a metodologia de onde veio e cada
 * criterio mostra se passou e por que — o motor e deterministico justamente
 * para poder ser auditado assim, criterio por criterio.
 *
 * Usa `<details>` nativo: o detalhe fica disponivel sem poluir a leitura e sem
 * custar JavaScript no cliente.
 */
export function ScoreDetail({ result }: { result: ScoreResult }) {
  const band = scoreBand(result.score);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          <span
            className={cn(
              "tabular text-[44px] leading-none font-semibold tracking-tight",
              band === "otimo" || band === "bom"
                ? "text-positive"
                : band === "fraco"
                  ? "text-warning"
                  : band === "ruim"
                    ? "text-negative"
                    : "text-content",
            )}
          >
            {result.score === null ? "—" : Math.round(result.score)}
          </span>
          <span className="text-muted pb-1 text-[14px]">/ 100 · {SCORE_BAND_LABEL[band]}</span>
        </div>
        <p className="text-muted text-[13px]">
          Cobertura de dados: <span className="tabular">{percent(result.coverage, 0)}</span>
          {result.coverage < 1 ? " — indicadores sem dado ficam fora da média" : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {result.dimensions.map((dimension) => (
          <details
            key={dimension.id}
            className="group border-line bg-base/50 rounded-[14px] border px-4 py-3"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-content text-[14px] font-medium">
                  {dimension.label}
                  <span className="text-faint ml-2 text-[12px] font-normal">
                    peso {percent(dimension.weight, 0)}
                  </span>
                </span>
                <span className="tabular text-[14px] font-medium">
                  {dimension.score === null ? (
                    <span className="text-faint">sem dado</span>
                  ) : (
                    decimal(dimension.score, 0)
                  )}
                </span>
              </div>
              <div className="bg-sunken h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-accent h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${dimension.score ?? 0}%` }}
                />
              </div>
              <span className="text-faint text-[12px]">
                {dimension.methodology} · {dimension.criteria.length} critérios
              </span>
            </summary>

            <ul className="border-line mt-3 flex flex-col gap-2 border-t pt-3">
              {dimension.criteria.map((criterion) => (
                <CriterionRow key={criterion.id} criterion={criterion} />
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

function CriterionRow({ criterion }: { criterion: Criterion }) {
  const state =
    criterion.score === null
      ? "unknown"
      : criterion.score >= 0.7
        ? "pass"
        : criterion.score >= 0.35
          ? "partial"
          : "fail";

  const Icon = state === "pass" ? Check : state === "fail" ? X : Minus;

  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
          state === "pass" && "bg-positive-soft text-positive",
          state === "fail" && "bg-negative-soft text-negative",
          state === "partial" && "bg-warning-soft text-warning",
          state === "unknown" && "bg-sunken text-faint",
        )}
      >
        <Icon className="size-3" strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-content text-[13px] font-medium">{criterion.label}</span>
          <span className="tabular text-faint text-[12px]">
            {criterion.score === null ? "sem dado" : percent(criterion.score, 0)}
          </span>
        </span>
        <span className="text-muted block text-[12px] leading-snug">{criterion.detail}</span>
      </span>
    </li>
  );
}
