import type { Criterion, DimensionResult, ScoreBand, ScoreResult } from "./types";

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Converte um valor para 0..1 interpolando entre `worst` e `best`.
 * Aceita escala invertida (quando menor e melhor, `worst` > `best`).
 */
export function scaleLinear(value: number, worst: number, best: number): number {
  if (worst === best) return value >= best ? 1 : 0;
  return clamp((value - worst) / (best - worst));
}

/** Criterio binario: passou ou nao. Dado ausente vira `null`. */
export function binary(
  id: string,
  label: string,
  value: boolean | null,
  detail: string,
): Criterion {
  return { id, label, score: value === null ? null : value ? 1 : 0, value, detail };
}

/** Criterio graduado entre um piso e um teto. */
export function graded(
  id: string,
  label: string,
  value: number | null,
  worst: number,
  best: number,
  detail: string,
): Criterion {
  return {
    id,
    label,
    score: value === null ? null : scaleLinear(value, worst, best),
    value,
    detail,
  };
}

/**
 * Agrega criterios numa dimensao. Criterio sem dado sai da media em vez de
 * entrar como zero — e o que separa "empresa ruim" de "dado faltando".
 */
export function buildDimension(
  id: string,
  label: string,
  methodology: string,
  weight: number,
  criteria: Criterion[],
): DimensionResult {
  const withData = criteria.filter((c) => c.score !== null);
  const coverage = criteria.length === 0 ? 0 : withData.length / criteria.length;
  const score =
    withData.length === 0
      ? null
      : (withData.reduce((acc, c) => acc + (c.score as number), 0) / withData.length) * 100;

  return { id, label, methodology, score, coverage, weight, criteria };
}

/**
 * Media ponderada das dimensoes, renormalizando pelo peso que de fato tinha
 * dado. A cobertura final e a fracao do peso total coberta.
 */
export function aggregate(
  assetId: string,
  assetClass: ScoreResult["assetClass"],
  dimensions: DimensionResult[],
  referenceDate: string,
): ScoreResult {
  const totalWeight = dimensions.reduce((acc, d) => acc + d.weight, 0);
  const scored = dimensions.filter((d) => d.score !== null);
  const usableWeight = scored.reduce((acc, d) => acc + d.weight, 0);

  const score =
    usableWeight === 0
      ? null
      : scored.reduce((acc, d) => acc + (d.score as number) * d.weight, 0) / usableWeight;

  const coverage =
    totalWeight === 0
      ? 0
      : dimensions.reduce((acc, d) => acc + d.coverage * d.weight, 0) / totalWeight;

  return {
    assetId,
    assetClass,
    score: score === null ? null : round(score, 1),
    coverage: round(coverage, 3),
    dimensions,
    referenceDate,
  };
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return "neutro";
  if (score >= 80) return "otimo";
  if (score >= 65) return "bom";
  if (score >= 50) return "neutro";
  if (score >= 35) return "fraco";
  return "ruim";
}

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = {
  otimo: "Ótimo",
  bom: "Bom",
  neutro: "Neutro",
  fraco: "Fraco",
  ruim: "Ruim",
};

/**
 * Ranking percentil de uma lista de valores (maior valor = percentil maior).
 * Base da Magic Formula, que e comparativa por natureza. Empate recebe a media
 * das posicoes. Itens sem valor ficam de fora e recebem `null`.
 */
export function percentileRank<T>(
  items: T[],
  getValue: (item: T) => number | null,
): Map<T, number | null> {
  const result = new Map<T, number | null>();
  const withValue = items
    .map((item) => ({ item, value: getValue(item) }))
    .filter((entry): entry is { item: T; value: number } => entry.value !== null);

  for (const item of items) result.set(item, null);
  if (withValue.length === 0) return result;
  if (withValue.length === 1) {
    result.set(withValue[0].item, 1);
    return result;
  }

  const sorted = [...withValue].sort((a, b) => a.value - b.value);
  const positions = new Map<number, number[]>();
  sorted.forEach((entry, index) => {
    const list = positions.get(entry.value) ?? [];
    list.push(index);
    positions.set(entry.value, list);
  });

  for (const entry of withValue) {
    const tied = positions.get(entry.value) as number[];
    const avgIndex = tied.reduce((a, b) => a + b, 0) / tied.length;
    result.set(entry.item, avgIndex / (sorted.length - 1));
  }

  return result;
}
