import { cn } from "@/lib/cn";
import { SCORE_BAND_LABEL, scoreBand, type ScoreResult } from "@/lib/scoring";
import { percent } from "@/lib/format";

const BAND_STYLE = {
  otimo: "bg-positive-soft text-positive",
  bom: "bg-positive-soft text-positive",
  neutro: "bg-sunken text-muted",
  fraco: "bg-warning-soft text-warning",
  ruim: "bg-negative-soft text-negative",
} as const;

/**
 * Nota do ativo. Mostra a cobertura junto quando ela e baixa: score 82 com
 * metade dos dados faltando nao vale o mesmo que score 82 completo, e esconder
 * isso seria o tipo de caixa-preta que o motor foi feito pra evitar.
 */
export function ScoreBadge({
  result,
  size = "md",
  className,
}: {
  result: Pick<ScoreResult, "score" | "coverage"> | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (!result || result.score === null) {
    return (
      <span
        className={cn(
          "bg-sunken text-faint inline-flex items-center rounded-full px-2.5 py-1 text-[12px]",
          className,
        )}
      >
        sem dado
      </span>
    );
  }

  const band = scoreBand(result.score);
  const lowCoverage = result.coverage < 0.7;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "tabular inline-flex items-center justify-center rounded-full font-semibold",
          BAND_STYLE[band],
          size === "sm" && "min-w-9 px-2 py-0.5 text-[12px]",
          size === "md" && "min-w-11 px-2.5 py-1 text-[14px]",
          size === "lg" && "min-w-14 px-3 py-1.5 text-[17px]",
        )}
        title={`${SCORE_BAND_LABEL[band]} — cobertura de dados: ${percent(result.coverage, 0)}`}
      >
        {Math.round(result.score)}
      </span>
      {lowCoverage ? (
        <span
          className="text-faint text-[11px]"
          title="Parte dos indicadores não estava disponível"
        >
          {percent(result.coverage, 0)} dos dados
        </span>
      ) : null}
    </span>
  );
}
