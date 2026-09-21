import { describe, expect, it } from "vitest";
import type { FiiFundamentals } from "@/types/domain";
import { scoreFii } from "./fiis";
import { DEFAULT_SCORING_SETTINGS, type MarketContext } from "./weights";

const market: MarketContext = { cdi: 0.105, ipca: 0.045, usdBrl: 5.4 };
const settings = DEFAULT_SCORING_SETTINGS;

function fii(overrides: Partial<FiiFundamentals> = {}): FiiFundamentals {
  return {
    assetId: "hglg11",
    dividendYield12m: 0.095,
    dividendYield24m: 0.092,
    dividendVolatility: 0.06,
    priceToBook: 0.95,
    vacancyRate: 0.03,
    tenantCount: 18,
    largestTenantShare: 0.12,
    dailyLiquidity: 2_500_000,
    segment: "tijolo",
    managementFee: 0.006,
    referenceDate: "2026-08-31",
    ...overrides,
  };
}

describe("scoreFii", () => {
  it("dá nota alta para fundo com renda consistente, baixa vacância e liquidez", () => {
    const result = scoreFii(fii(), settings, market);

    expect(result.score as number).toBeGreaterThan(80);
    expect(result.coverage).toBe(1);
  });

  it("derruba a nota de fundo caro, vago e ilíquido", () => {
    const result = scoreFii(
      fii({
        dividendYield12m: 0.03,
        dividendYield24m: 0.03,
        dividendVolatility: 0.35,
        priceToBook: 1.7,
        vacancyRate: 0.3,
        tenantCount: 1,
        largestTenantShare: 0.9,
        dailyLiquidity: 50_000,
        managementFee: 0.02,
      }),
      settings,
      market,
    );

    expect(result.score as number).toBeLessThan(20);
  });

  it("ignora vacância em fundo de papel, que não tem imóvel", () => {
    const papel = scoreFii(
      fii({ segment: "papel", vacancyRate: null, tenantCount: null, largestTenantShare: null }),
      settings,
      market,
    );
    const occupancy = papel.dimensions.find((d) => d.id === "occupancy")!;

    expect(occupancy.score).toBeNull();
    expect(occupancy.coverage).toBe(0);
    // A dimensão sem dado sai da média em vez de zerar o fundo.
    expect(papel.score as number).toBeGreaterThan(80);
  });

  it("penaliza rendimento volátil mesmo com DY alto", () => {
    const estavel = scoreFii(fii(), settings, market);
    const volatil = scoreFii(fii({ dividendVolatility: 0.35 }), settings, market);

    expect(volatil.score as number).toBeLessThan(estavel.score as number);
  });
});
