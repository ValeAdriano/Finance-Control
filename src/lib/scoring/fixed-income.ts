import type { FixedIncomeTerms } from "@/types/domain";
import type { ScoreResult } from "./types";
import { aggregate, binary, buildDimension, graded } from "./utils";
import type { MarketContext, ScoringSettings } from "./weights";

/**
 * Renda fixa e agro sao avaliados pela rentabilidade contratada contra CDI e
 * IPCA, pelo prazo ate o vencimento e pelo risco do emissor.
 */
export function scoreFixedIncome(
  terms: FixedIncomeTerms,
  settings: ScoringSettings,
  market: MarketContext,
  today = new Date(),
): ScoreResult {
  const equivalent = equivalentAnnualRate(terms, market);
  const cdiRatio = market.cdi > 0 ? equivalent / market.cdi : null;
  const yearsToMaturity = yearsBetween(today, new Date(terms.maturityDate));

  return aggregate(
    terms.assetId,
    "renda_fixa",
    [
      buildDimension(
        "yield",
        "Rentabilidade",
        "Taxa equivalente vs CDI e IPCA",
        settings.fixedIncome.yield,
        [
          graded(
            "vs-cdi",
            "Rende acima do CDI",
            cdiRatio,
            0.85,
            1.3,
            `Taxa equivalente de ${pct(equivalent)} a.a. contra CDI de ${pct(market.cdi)}`,
          ),
          graded(
            "real-rate",
            "Ganho real acima da inflação",
            equivalent - market.ipca,
            0,
            0.07,
            `Juro real estimado de ${pct(equivalent - market.ipca)} a.a.`,
          ),
        ],
      ),
      buildDimension("term", "Prazo", "Anos até o vencimento", settings.fixedIncome.term, [
        graded(
          "maturity",
          "Prazo curto o bastante",
          yearsToMaturity,
          8,
          1,
          `Vence em ${yearsToMaturity.toFixed(1).replace(".", ",")} anos — prazo longo trava o dinheiro e aumenta o risco de crédito`,
        ),
      ]),
      buildDimension(
        "issuer-risk",
        "Risco do emissor",
        "Rating e cobertura do FGC",
        settings.fixedIncome.issuerRisk,
        [
          graded(
            "rating",
            "Rating do emissor",
            ratingScore(terms.issuerRating),
            0,
            1,
            terms.issuerRating
              ? `Rating ${terms.issuerRating} em escala nacional`
              : "Emissor sem rating publicado",
          ),
          binary(
            "fgc",
            "Coberto pelo FGC",
            terms.fgcCovered,
            "Garantia do FGC até R$ 250 mil por CPF e instituição",
          ),
        ],
      ),
    ],
    today.toISOString().slice(0, 10),
  );
}

/**
 * Converte a taxa contratada para taxa anual comparavel, seja ela prefixada,
 * percentual do CDI/Selic ou IPCA + spread. Titulo isento recebe o gross-up
 * de 15% (aliquota de longo prazo), para comparar com tributado na mesma base.
 */
export function equivalentAnnualRate(terms: FixedIncomeTerms, market: MarketContext): number {
  let gross: number;

  switch (terms.indexer) {
    case "prefixado":
      gross = terms.contractedRate;
      break;
    case "cdi":
    case "selic":
      gross = market.cdi * terms.contractedRate;
      break;
    case "ipca":
      gross = market.ipca + (terms.spread ?? terms.contractedRate);
      break;
  }

  return terms.isTaxExempt ? gross / 0.85 : gross;
}

/** Escala de rating nacional convertida para 0..1. */
function ratingScore(rating: string | null): number | null {
  if (!rating) return null;
  const scale: Record<string, number> = {
    AAA: 1,
    AA: 0.9,
    A: 0.78,
    BBB: 0.62,
    BB: 0.45,
    B: 0.3,
    CCC: 0.15,
    CC: 0.08,
    C: 0.04,
    D: 0,
  };
  const normalized = rating.toUpperCase().replace(/[+-]/g, "").replace(/\.BR$/i, "").trim();
  const base = scale[normalized];
  if (base === undefined) return null;
  if (rating.includes("+")) return Math.min(1, base + 0.03);
  if (rating.includes("-")) return Math.max(0, base - 0.03);
  return base;
}

function yearsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}
