import { describe, expect, it } from "vitest";
import type { StockFundamentals } from "@/types/domain";
import { piotroskiFScore, scoreStocks } from "./stocks";
import { DEFAULT_SCORING_SETTINGS, type MarketContext } from "./weights";

const market: MarketContext = { cdi: 0.105, ipca: 0.045, usdBrl: 5.4 };
const settings = DEFAULT_SCORING_SETTINGS;

function fundamentals(overrides: Partial<StockFundamentals> = {}): StockFundamentals {
  return {
    assetId: "a1",
    roic: 0.2,
    earningsYield: 0.15,
    netIncome: 1000,
    operatingCashFlow: 1200,
    roa: 0.12,
    roaPreviousYear: 0.1,
    longTermDebtToAssets: 0.2,
    longTermDebtToAssetsPreviousYear: 0.25,
    currentRatio: 2.2,
    currentRatioPreviousYear: 2,
    issuedShares: false,
    grossMargin: 0.4,
    grossMarginPreviousYear: 0.35,
    assetTurnover: 0.9,
    assetTurnoverPreviousYear: 0.8,
    priceToEarnings: 8,
    priceToBook: 1.1,
    longTermDebt: 500,
    workingCapital: 900,
    dividendYield: 0.09,
    dividendYieldHistory: [0.09, 0.08, 0.07, 0.065, 0.061],
    yearsPayingDividends: 12,
    netDebtToEbitda: 0.8,
    sector: "Energia Elétrica",
    referenceDate: "2026-06-30",
    ...overrides,
  };
}

describe("scoreStocks", () => {
  it("dá nota alta para empresa que passa em todos os critérios", () => {
    const [result] = scoreStocks([fundamentals()], settings, market);

    expect(result.score).not.toBeNull();
    expect(result.score as number).toBeGreaterThan(85);
    expect(result.coverage).toBe(1);
  });

  it("dá nota baixa para empresa endividada, cara e sem dividendo", () => {
    const [result] = scoreStocks(
      [
        fundamentals({
          roic: 0.01,
          earningsYield: 0.01,
          netIncome: -500,
          operatingCashFlow: -300,
          roa: -0.05,
          roaPreviousYear: 0.02,
          longTermDebtToAssets: 0.6,
          longTermDebtToAssetsPreviousYear: 0.4,
          currentRatio: 0.8,
          currentRatioPreviousYear: 1.2,
          issuedShares: true,
          grossMargin: 0.1,
          grossMarginPreviousYear: 0.2,
          assetTurnover: 0.4,
          assetTurnoverPreviousYear: 0.6,
          priceToEarnings: 40,
          priceToBook: 4,
          longTermDebt: 5000,
          workingCapital: 100,
          dividendYield: 0,
          dividendYieldHistory: [0, 0, 0],
          yearsPayingDividends: 0,
          netDebtToEbitda: 6,
          sector: "Tecnologia",
        }),
      ],
      settings,
      market,
    );

    expect(result.score as number).toBeLessThan(20);
  });

  it("ranqueia a Magic Formula de forma relativa quando o universo é grande o bastante", () => {
    const results = scoreStocks(
      [
        fundamentals({ assetId: "melhor", roic: 0.3, earningsYield: 0.2 }),
        fundamentals({ assetId: "bom", roic: 0.22, earningsYield: 0.15 }),
        fundamentals({ assetId: "medio", roic: 0.15, earningsYield: 0.1 }),
        fundamentals({ assetId: "fraco", roic: 0.09, earningsYield: 0.06 }),
        fundamentals({ assetId: "pior", roic: 0.05, earningsYield: 0.03 }),
      ],
      settings,
      market,
    );

    const magic = (id: string) =>
      results.find((r) => r.assetId === id)!.dimensions.find((d) => d.id === "quality-price")!
        .score as number;

    expect(magic("melhor")).toBe(100);
    expect(magic("pior")).toBe(0);
    expect(magic("medio")).toBeGreaterThan(magic("pior"));
    expect(magic("medio")).toBeLessThan(magic("melhor"));
  });

  it("cai para escala absoluta quando o universo é pequeno demais para ranquear", () => {
    // Sozinho no universo, o ativo não pode ser "o melhor da lista" de graça:
    // ROIC fraco precisa derrubar a dimensão mesmo sem ninguém para comparar.
    const [fraco] = scoreStocks(
      [fundamentals({ roic: 0.01, earningsYield: 0.01 })],
      settings,
      market,
    );
    const [forte] = scoreStocks(
      [fundamentals({ roic: 0.3, earningsYield: 0.25 })],
      settings,
      market,
    );

    const magic = (r: typeof fraco) =>
      r.dimensions.find((d) => d.id === "quality-price")!.score as number;

    expect(magic(fraco)).toBeLessThan(15);
    expect(magic(forte)).toBe(100);
  });

  it("não penaliza o ativo por dado faltante, apenas reduz a cobertura", () => {
    const complete = scoreStocks([fundamentals()], settings, market)[0];
    const partial = scoreStocks(
      [
        fundamentals({
          netIncome: null,
          operatingCashFlow: null,
          roa: null,
          roaPreviousYear: null,
        }),
      ],
      settings,
      market,
    )[0];

    expect(partial.coverage).toBeLessThan(complete.coverage);
    expect(partial.score as number).toBeGreaterThan(80);
  });

  it("devolve score nulo quando não há dado nenhum", () => {
    const empty: StockFundamentals = {
      ...fundamentals(),
      roic: null,
      earningsYield: null,
      netIncome: null,
      operatingCashFlow: null,
      roa: null,
      roaPreviousYear: null,
      longTermDebtToAssets: null,
      longTermDebtToAssetsPreviousYear: null,
      currentRatio: null,
      currentRatioPreviousYear: null,
      issuedShares: null,
      grossMargin: null,
      grossMarginPreviousYear: null,
      assetTurnover: null,
      assetTurnoverPreviousYear: null,
      priceToEarnings: null,
      priceToBook: null,
      longTermDebt: null,
      workingCapital: null,
      dividendYield: null,
      dividendYieldHistory: [],
      yearsPayingDividends: null,
      netDebtToEbitda: null,
      sector: null,
    };

    const [result] = scoreStocks([empty], settings, market);
    expect(result.score).toBeNull();
    expect(result.coverage).toBe(0);
  });

  it("respeita os pesos configurados", () => {
    const onlyIncome = scoreStocks(
      [fundamentals({ roic: 0.001, earningsYield: 0.001 })],
      {
        ...settings,
        stock: { qualityPrice: 0, financialHealth: 0, safety: 0, income: 1 },
      },
      market,
    )[0];

    const onlyMagic = scoreStocks(
      [fundamentals({ roic: 0.001, earningsYield: 0.001 })],
      {
        ...settings,
        stock: { qualityPrice: 1, financialHealth: 0, safety: 0, income: 0 },
      },
      market,
    )[0];

    expect(onlyIncome.score as number).toBeGreaterThan(onlyMagic.score as number);
  });

  it("usa o piso de dividendo dinâmico quando o spread sobre o CDI está ligado", () => {
    // CDI 10,5% x fator 0,7 => piso de 7,35%, acima do DY de 6,5% do ativo.
    const asset = fundamentals({ dividendYield: 0.065, dividendYieldHistory: [0.065, 0.064] });

    const fixedFloor = scoreStocks([asset], settings, market)[0];
    const cdiFloor = scoreStocks([asset], { ...settings, bazinUseCdiSpread: true }, market)[0];

    const income = (r: typeof fixedFloor) =>
      r.dimensions.find((d) => d.id === "income")!.score as number;

    expect(income(cdiFloor)).toBeLessThan(income(fixedFloor));
  });
});

describe("piotroskiFScore", () => {
  it("devolve 9 para a empresa que passa em todos os critérios", () => {
    expect(piotroskiFScore(fundamentals(), settings)).toBe(9);
  });

  it("desconta um ponto por critério reprovado", () => {
    expect(piotroskiFScore(fundamentals({ issuedShares: true }), settings)).toBe(8);
  });

  it("ignora critério sem dado em vez de contar como reprovado", () => {
    expect(piotroskiFScore(fundamentals({ issuedShares: null }), settings)).toBe(8);
  });
});
