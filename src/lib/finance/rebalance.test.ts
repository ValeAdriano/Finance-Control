import { describe, expect, it } from "vitest";
import type { AllocationTarget, AssetClass } from "@/types/domain";
import { rebalance, targetsAreValid } from "./rebalance";

const targets: AllocationTarget[] = [
  { assetClass: "acao", target: 0.4 },
  { assetClass: "fii", target: 0.3 },
  { assetClass: "cripto", target: 0.1 },
  { assetClass: "renda_fixa", target: 0.2 },
];

function current(values: Partial<Record<AssetClass, number>>): Record<AssetClass, number> {
  return { acao: 0, fii: 0, cripto: 0, renda_fixa: 0, agro: 0, ...values };
}

describe("rebalance", () => {
  it("marca como equilibrado o que está dentro da tolerância", () => {
    const result = rebalance(
      current({ acao: 40_000, fii: 30_000, cripto: 10_000, renda_fixa: 20_000 }),
      targets,
    );

    expect(result.total).toBe(100_000);
    expect(result.rows.every((r) => r.status === "equilibrado")).toBe(true);
    expect(result.maxDrift).toBeCloseTo(0, 6);
  });

  it("identifica o desvio de cada classe", () => {
    const result = rebalance(
      current({ acao: 60_000, fii: 20_000, cripto: 10_000, renda_fixa: 10_000 }),
      targets,
    );

    const row = (c: AssetClass) => result.rows.find((r) => r.assetClass === c)!;

    expect(row("acao").status).toBe("acima");
    expect(row("acao").drift).toBeCloseTo(0.2, 6);
    expect(row("fii").status).toBe("abaixo");
    expect(row("renda_fixa").deltaAmount).toBeCloseTo(10_000, 2);
  });

  it("distribui o aporte para as classes em déficit, sem mandar vender", () => {
    const result = rebalance(
      current({ acao: 60_000, fii: 20_000, cripto: 10_000, renda_fixa: 10_000 }),
      targets,
      10_000,
    );

    const row = (c: AssetClass) => result.rows.find((r) => r.assetClass === c)!;

    expect(row("acao").suggestedContribution).toBe(0);
    expect(row("fii").suggestedContribution).toBeGreaterThan(0);
    const distributed = result.rows.reduce((acc, r) => acc + r.suggestedContribution, 0);
    expect(distributed + result.leftover).toBeCloseTo(10_000, 2);
  });

  it("nunca aloca mais que o déficit da classe", () => {
    const result = rebalance(
      current({ acao: 40_000, fii: 29_000, cripto: 10_000, renda_fixa: 20_000 }),
      targets,
      50_000,
    );

    for (const row of result.rows) {
      expect(row.suggestedContribution).toBeLessThanOrEqual(Math.max(0, row.deltaAmount) + 0.01);
    }
  });

  it("distribui o aporte inteiro quando as metas somam 100%", () => {
    const result = rebalance(
      current({ acao: 40_000, fii: 29_000, cripto: 10_000, renda_fixa: 20_000 }),
      targets,
      50_000,
    );

    expect(result.leftover).toBe(0);
  });

  it("devolve sobra quando as metas configuradas não cobrem 100% da carteira", () => {
    const result = rebalance(
      current({ acao: 40_000, fii: 30_000 }),
      [{ assetClass: "acao", target: 0.5 }],
      10_000,
    );

    expect(result.leftover).toBeGreaterThan(0);
  });

  it("lida com carteira zerada sem dividir por zero", () => {
    const result = rebalance(current({}), targets, 1000);

    expect(result.total).toBe(0);
    expect(result.rows.every((r) => Number.isFinite(r.currentShare))).toBe(true);
    expect(result.rows.find((r) => r.assetClass === "acao")?.suggestedContribution).toBeCloseTo(
      400,
      2,
    );
  });
});

describe("targetsAreValid", () => {
  it("aceita metas que somam 100%", () => {
    expect(targetsAreValid(targets)).toBe(true);
  });

  it("rejeita metas que não fecham", () => {
    expect(targetsAreValid([{ assetClass: "acao", target: 0.5 }])).toBe(false);
  });
});
