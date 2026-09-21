import { describe, expect, it } from "vitest";
import type { FixedIncomeTerms } from "@/types/domain";
import { equivalentAnnualRate, scoreFixedIncome } from "./fixed-income";
import { DEFAULT_SCORING_SETTINGS, type MarketContext } from "./weights";

const market: MarketContext = { cdi: 0.1, ipca: 0.045, usdBrl: 5.4 };
const settings = DEFAULT_SCORING_SETTINGS;
const today = new Date("2026-09-21T12:00:00Z");

function terms(overrides: Partial<FixedIncomeTerms> = {}): FixedIncomeTerms {
  return {
    assetId: "cdb-inter",
    indexer: "cdi",
    contractedRate: 1.1,
    spread: null,
    maturityDate: "2027-09-21",
    issuer: "Banco Inter",
    issuerRating: "AA",
    fgcCovered: true,
    isTaxExempt: false,
    ...overrides,
  };
}

describe("equivalentAnnualRate", () => {
  it("converte percentual do CDI em taxa anual", () => {
    expect(equivalentAnnualRate(terms({ contractedRate: 1.1 }), market)).toBeCloseTo(0.11, 10);
  });

  it("mantém a taxa do prefixado", () => {
    expect(
      equivalentAnnualRate(terms({ indexer: "prefixado", contractedRate: 0.13 }), market),
    ).toBeCloseTo(0.13, 10);
  });

  it("soma o spread ao IPCA", () => {
    expect(
      equivalentAnnualRate(terms({ indexer: "ipca", contractedRate: 0, spread: 0.06 }), market),
    ).toBeCloseTo(0.105, 10);
  });

  it("faz gross-up do título isento para comparar na mesma base do tributado", () => {
    const isento = equivalentAnnualRate(terms({ contractedRate: 0.95, isTaxExempt: true }), market);
    const tributado = equivalentAnnualRate(terms({ contractedRate: 0.95 }), market);

    expect(isento).toBeGreaterThan(tributado);
    expect(isento).toBeCloseTo(0.095 / 0.85, 10);
  });
});

describe("scoreFixedIncome", () => {
  it("dá nota alta para título acima do CDI, curto, de emissor forte e com FGC", () => {
    const result = scoreFixedIncome(terms({ contractedRate: 1.3 }), settings, market, today);
    expect(result.score as number).toBeGreaterThan(75);
  });

  it("derruba a nota de título longo, abaixo do CDI e sem garantia", () => {
    const result = scoreFixedIncome(
      terms({
        contractedRate: 0.85,
        maturityDate: "2036-09-21",
        issuerRating: "B",
        fgcCovered: false,
      }),
      settings,
      market,
      today,
    );

    expect(result.score as number).toBeLessThan(30);
  });

  it("trata emissor sem rating como dado faltante, não como nota zero", () => {
    const semRating = scoreFixedIncome(terms({ issuerRating: null }), settings, market, today);
    const dimension = semRating.dimensions.find((d) => d.id === "issuer-risk")!;

    expect(dimension.coverage).toBe(0.5);
    expect(semRating.coverage).toBeLessThan(1);
  });

  it("reconhece os modificadores + e - do rating", () => {
    const score = (rating: string) =>
      scoreFixedIncome(terms({ issuerRating: rating }), settings, market, today)
        .dimensions.find((d) => d.id === "issuer-risk")!
        .criteria.find((c) => c.id === "rating")!.score as number;

    expect(score("AA+")).toBeGreaterThan(score("AA"));
    expect(score("AA-")).toBeLessThan(score("AA"));
  });
});
