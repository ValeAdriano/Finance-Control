import { describe, expect, it } from "vitest";
import type { CryptoMetrics } from "@/types/domain";
import { scoreCrypto } from "./crypto";
import { DEFAULT_SCORING_SETTINGS } from "./weights";

const settings = DEFAULT_SCORING_SETTINGS;

function metrics(overrides: Partial<CryptoMetrics> = {}): CryptoMetrics {
  return {
    assetId: "btc",
    marketCapRank: 1,
    volatility: 0.45,
    dominance: 0.52,
    volume24h: 25_000_000_000,
    referenceDate: "2026-09-21",
    ...overrides,
  };
}

describe("scoreCrypto", () => {
  it("dá nota alta para o ativo mais líquido e de maior porte", () => {
    expect(scoreCrypto(metrics(), settings).score as number).toBeGreaterThan(80);
  });

  it("derruba a nota de ativo pequeno, ilíquido e volátil", () => {
    const result = scoreCrypto(
      metrics({ marketCapRank: 400, dominance: 0.0001, volume24h: 2_000_000, volatility: 1.8 }),
      settings,
    );

    expect(result.score as number).toBeLessThan(10);
  });

  it("mede risco relativo, não valor intrínseco — ativo sem dado fica sem score", () => {
    const result = scoreCrypto(
      metrics({ marketCapRank: null, dominance: null, volume24h: null, volatility: null }),
      settings,
    );

    expect(result.score).toBeNull();
    expect(result.coverage).toBe(0);
  });
});
