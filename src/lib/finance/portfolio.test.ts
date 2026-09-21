import { describe, expect, it } from "vitest";
import type { Asset, Holding } from "@/types/domain";
import { buildPortfolio, positionsOfClass } from "./portfolio";

const USD_BRL = 5;

const assets: Asset[] = [
  {
    id: "petr4",
    slug: "petr4",
    symbol: "PETR4",
    name: "Petrobras PN",
    assetClass: "acao",
    currency: "BRL",
    sector: "Petróleo",
    institutionId: "inter",
  },
  {
    id: "hglg11",
    slug: "hglg11",
    symbol: "HGLG11",
    name: "CSHG Logística",
    assetClass: "fii",
    currency: "BRL",
    sector: "Logística",
    institutionId: "inter",
  },
  {
    id: "btc",
    slug: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    assetClass: "cripto",
    currency: "USD",
    sector: null,
    institutionId: "binance",
  },
];

const holdings: Holding[] = [
  {
    assetId: "petr4",
    quantity: 100,
    averagePrice: 30,
    lastPrice: 40,
    dayChange: 0.02,
    updatedAt: "2026-09-21",
  },
  {
    assetId: "hglg11",
    quantity: 50,
    averagePrice: 160,
    lastPrice: 150,
    dayChange: -0.01,
    updatedAt: "2026-09-21",
  },
  {
    assetId: "btc",
    quantity: 0.1,
    averagePrice: 50_000,
    lastPrice: 60_000,
    dayChange: 0.05,
    updatedAt: "2026-09-21",
  },
];

describe("buildPortfolio", () => {
  it("converte ativo em dólar para reais antes de somar", () => {
    const portfolio = buildPortfolio(assets, holdings, USD_BRL);
    const btc = portfolio.positions.find((p) => p.asset.id === "btc")!;

    expect(btc.marketValue).toBe(6000);
    expect(btc.marketValueBrl).toBe(30_000);
    // 4.000 (PETR4) + 7.500 (HGLG11) + 30.000 (BTC)
    expect(portfolio.totalBrl).toBe(41_500);
  });

  it("calcula lucro e prejuízo por posição", () => {
    const portfolio = buildPortfolio(assets, holdings, USD_BRL);

    const petr = portfolio.positions.find((p) => p.asset.id === "petr4")!;
    expect(petr.profitBrl).toBe(1000);
    expect(petr.profitPercent).toBeCloseTo(1 / 3, 6);

    const hglg = portfolio.positions.find((p) => p.asset.id === "hglg11")!;
    expect(hglg.profitBrl).toBe(-500);
    expect(hglg.profitPercent).toBeCloseTo(-0.0625, 6);
  });

  it("calcula a variação do dia sobre o fechamento anterior", () => {
    const portfolio = buildPortfolio(assets, holdings, USD_BRL);
    const petr = portfolio.positions.find((p) => p.asset.id === "petr4")!;

    // 4.000 hoje com +2% no dia => 3.921,57 ontem.
    expect(petr.dayChangeBrl).toBeCloseTo(4000 - 4000 / 1.02, 6);
    expect(portfolio.dayChangePercent).toBeCloseTo(
      portfolio.dayChangeBrl / (portfolio.totalBrl - portfolio.dayChangeBrl),
      6,
    );
  });

  it("agrupa por classe e calcula participação", () => {
    const portfolio = buildPortfolio(assets, holdings, USD_BRL);

    expect(portfolio.byClass.acao).toBe(4000);
    expect(portfolio.byClass.fii).toBe(7500);
    expect(portfolio.byClass.cripto).toBe(30_000);
    expect(portfolio.byClass.agro).toBe(0);

    const shares = portfolio.positions.reduce((acc, p) => acc + p.share, 0);
    expect(shares).toBeCloseTo(1, 6);
  });

  it("ordena as posições da maior para a menor", () => {
    const portfolio = buildPortfolio(assets, holdings, USD_BRL);
    expect(portfolio.positions.map((p) => p.asset.symbol)).toEqual(["BTC", "HGLG11", "PETR4"]);
  });

  it("ignora holding de ativo desconhecido em vez de quebrar", () => {
    const portfolio = buildPortfolio(
      assets,
      [...holdings, { ...holdings[0], assetId: "fantasma" }],
      USD_BRL,
    );
    expect(portfolio.positions).toHaveLength(3);
  });

  it("lida com carteira vazia", () => {
    const portfolio = buildPortfolio(assets, [], USD_BRL);

    expect(portfolio.totalBrl).toBe(0);
    expect(portfolio.profitPercent).toBe(0);
    expect(portfolio.dayChangePercent).toBe(0);
  });

  it("filtra posições por classe", () => {
    const portfolio = buildPortfolio(assets, holdings, USD_BRL);
    expect(positionsOfClass(portfolio, "fii").map((p) => p.asset.symbol)).toEqual(["HGLG11"]);
  });
});
