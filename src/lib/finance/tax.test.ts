import { describe, expect, it } from "vitest";
import {
  CRYPTO_MONTHLY_EXEMPTION,
  cryptoProgressiveRate,
  DARF_MINIMUM,
  regressiveRate,
  simulateSale,
  STOCK_MONTHLY_EXEMPTION,
} from "./tax";

describe("simulateSale — ações", () => {
  it("isenta a venda dentro do limite mensal de R$ 20 mil em swing trade", () => {
    const result = simulateSale({
      assetClass: "acao",
      quantity: 100,
      averagePrice: 30,
      salePrice: 50,
      monthlySalesSoFar: 0,
    });

    expect(result.grossAmount).toBe(5000);
    expect(result.grossGain).toBe(2000);
    expect(result.exempt).toBe(true);
    expect(result.tax).toBe(0);
    expect(result.netAmount).toBe(5000);
    expect(result.darfDue).toBe(false);
  });

  it("perde a isenção quando a venda estoura o limite somada às do mês", () => {
    const result = simulateSale({
      assetClass: "acao",
      quantity: 100,
      averagePrice: 30,
      salePrice: 50,
      monthlySalesSoFar: STOCK_MONTHLY_EXEMPTION - 1,
    });

    expect(result.exempt).toBe(false);
    expect(result.taxRate).toBe(0.15);
    expect(result.tax).toBe(300);
    expect(result.netAmount).toBe(4700);
    expect(result.darfDue).toBe(true);
  });

  it("aplica 20% em day trade, sem isenção mesmo em valor baixo", () => {
    const result = simulateSale({
      assetClass: "acao",
      quantity: 10,
      averagePrice: 10,
      salePrice: 20,
      dayTrade: true,
    });

    expect(result.exempt).toBe(false);
    expect(result.taxRate).toBe(0.2);
    expect(result.tax).toBe(20);
  });

  it("desconta as taxas da operação do ganho tributável", () => {
    const result = simulateSale({
      assetClass: "acao",
      quantity: 1000,
      averagePrice: 20,
      salePrice: 25,
      fees: 100,
      monthlySalesSoFar: STOCK_MONTHLY_EXEMPTION,
    });

    expect(result.grossGain).toBe(4900);
    expect(result.tax).toBe(735);
  });
});

describe("simulateSale — prejuízo e compensação", () => {
  it("acumula prejuízo em operação tributada", () => {
    const result = simulateSale({
      assetClass: "fii",
      quantity: 100,
      averagePrice: 110,
      salePrice: 100,
      accumulatedLoss: 500,
    });

    expect(result.grossGain).toBe(-1000);
    expect(result.tax).toBe(0);
    expect(result.remainingLoss).toBe(1500);
  });

  it("compensa o prejuízo acumulado antes de calcular o imposto", () => {
    const result = simulateSale({
      assetClass: "fii",
      quantity: 100,
      averagePrice: 100,
      salePrice: 130,
      accumulatedLoss: 1000,
    });

    expect(result.grossGain).toBe(3000);
    expect(result.lossUsed).toBe(1000);
    expect(result.taxableGain).toBe(2000);
    expect(result.tax).toBe(400);
    expect(result.remainingLoss).toBe(0);
  });

  it("não acumula prejuízo de operação isenta, que não é compensável", () => {
    const result = simulateSale({
      assetClass: "acao",
      quantity: 10,
      averagePrice: 50,
      salePrice: 40,
      accumulatedLoss: 200,
    });

    expect(result.exempt).toBe(true);
    expect(result.remainingLoss).toBe(200);
  });
});

describe("simulateSale — FII, cripto e renda fixa", () => {
  it("tributa FII em 20% sem faixa de isenção", () => {
    const result = simulateSale({
      assetClass: "fii",
      quantity: 10,
      averagePrice: 90,
      salePrice: 100,
    });

    expect(result.exempt).toBe(false);
    expect(result.taxRate).toBe(0.2);
    expect(result.tax).toBe(20);
  });

  it("isenta cripto até R$ 35 mil vendidos no mês", () => {
    const result = simulateSale({
      assetClass: "cripto",
      quantity: 0.5,
      averagePrice: 200_000,
      salePrice: 300_000,
    });

    expect(result.grossAmount).toBe(150_000);
    expect(result.exempt).toBe(false);

    const small = simulateSale({
      assetClass: "cripto",
      quantity: 0.1,
      averagePrice: 200_000,
      salePrice: 300_000,
      monthlySalesSoFar: CRYPTO_MONTHLY_EXEMPTION - 30_000,
    });

    expect(small.exempt).toBe(true);
  });

  it("usa a tabela regressiva na renda fixa", () => {
    expect(regressiveRate(90)).toBe(0.225);
    expect(regressiveRate(200)).toBe(0.2);
    expect(regressiveRate(400)).toBe(0.175);
    expect(regressiveRate(900)).toBe(0.15);

    const result = simulateSale({
      assetClass: "renda_fixa",
      quantity: 1,
      averagePrice: 10_000,
      salePrice: 12_000,
      daysHeld: 900,
    });

    expect(result.taxRate).toBe(0.15);
    expect(result.tax).toBe(300);
  });

  it("isenta LCI, LCA e afins", () => {
    const result = simulateSale({
      assetClass: "renda_fixa",
      quantity: 1,
      averagePrice: 10_000,
      salePrice: 12_000,
      daysHeld: 90,
      isTaxExempt: true,
    });

    expect(result.exempt).toBe(true);
    expect(result.tax).toBe(0);
  });

  it("aplica a tabela progressiva de ganho de capital", () => {
    expect(cryptoProgressiveRate(1_000_000)).toBe(0.15);
    expect(cryptoProgressiveRate(7_000_000)).toBe(0.175);
    expect(cryptoProgressiveRate(20_000_000)).toBe(0.2);
    expect(cryptoProgressiveRate(40_000_000)).toBe(0.225);
  });
});

describe("simulateSale — DARF", () => {
  it("não gera DARF quando o imposto fica abaixo do mínimo", () => {
    const result = simulateSale({
      assetClass: "fii",
      quantity: 1,
      averagePrice: 100,
      salePrice: 130,
    });

    expect(result.tax).toBeLessThan(DARF_MINIMUM);
    expect(result.darfDue).toBe(false);
    expect(result.rationale).toContain("acumula");
  });
});
