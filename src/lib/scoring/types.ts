import type { AssetClass } from "@/types/domain";

/**
 * Um criterio isolado dentro de uma dimensao. Guarda o valor bruto e o texto
 * explicativo porque a interface mostra *por que* o ativo recebeu a nota — o
 * score nunca e uma caixa-preta.
 */
export interface Criterion {
  id: string;
  label: string;
  /** 0..1. `null` quando faltou dado — nao conta como reprovado. */
  score: number | null;
  /** Valor bruto usado, para exibir na tabela de detalhe. */
  value: number | boolean | null;
  detail: string;
}

export interface DimensionResult {
  id: string;
  label: string;
  /** Metodologia de origem, citada na interface. */
  methodology: string;
  /** 0..100. `null` quando nenhum criterio tinha dado. */
  score: number | null;
  /** Fracao dos criterios que tinham dado disponivel (0..1). */
  coverage: number;
  weight: number;
  criteria: Criterion[];
}

export interface ScoreResult {
  assetId: string;
  assetClass: AssetClass;
  /** 0..100, media ponderada das dimensoes com dado. `null` se nao ha dado. */
  score: number | null;
  /**
   * Confianca no score: fracao do peso total que tinha dado disponivel.
   * Score 80 com cobertura 0.4 vale muito menos que 80 com cobertura 1.
   */
  coverage: number;
  dimensions: DimensionResult[];
  referenceDate: string;
}

/** Faixas usadas na interface para rotular o score. */
export type ScoreBand = "otimo" | "bom" | "neutro" | "fraco" | "ruim";
