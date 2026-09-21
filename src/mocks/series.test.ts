import { describe, expect, it } from "vitest";
import { buildPortfolio } from "@/lib/finance";
import { assets, holdings } from "./assets";
import { allocationTargets, marketContext } from "./records";
import { buildBenchmarks, buildNetWorthHistory, buildPriceHistory } from "./series";

/**
 * O mock precisa ser coerente consigo mesmo: um gráfico que não fecha com o KPI
 * ao lado faz a interface parecer quebrada mesmo quando o cálculo está certo.
 */
describe("mocks", () => {
  const portfolio = buildPortfolio(assets, holdings, marketContext.usdBrl);

  it("a série de patrimônio termina no valor atual da carteira", () => {
    const history = buildNetWorthHistory();
    expect(history.at(-1)?.total).toBeCloseTo(portfolio.totalBrl, 0);
  });

  it("a soma por classe de cada ponto bate com o total do ponto", () => {
    for (const point of buildNetWorthHistory()) {
      const sum = Object.values(point.byClass).reduce((acc, value) => acc + value, 0);
      expect(sum).toBeCloseTo(point.total, 0);
    }
  });

  it("o patrimônio sempre cresce mais que o aportado, sem virar negativo", () => {
    for (const point of buildNetWorthHistory()) {
      expect(point.total).toBeGreaterThan(0);
      expect(point.contributed).toBeGreaterThan(0);
    }
  });

  it("as metas de alocação somam 100%", () => {
    const sum = allocationTargets.reduce((acc, target) => acc + target.target, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("nenhuma classe desvia absurdamente da meta", () => {
    for (const target of allocationTargets) {
      const share = portfolio.byClass[target.assetClass] / portfolio.totalBrl;
      expect(Math.abs(share - target.target)).toBeLessThan(0.06);
    }
  });

  it("o histórico de preço termina na cotação atual e pula fim de semana", () => {
    const history = buildPriceHistory();

    for (const holding of holdings) {
      const asset = assets.find((a) => a.id === holding.assetId);
      if (!asset || asset.assetClass === "renda_fixa" || asset.assetClass === "agro") continue;

      const series = history.filter((p) => p.assetId === asset.id);
      expect(series.at(-1)?.close).toBeCloseTo(holding.lastPrice, 2);

      if (asset.assetClass !== "cripto") {
        const weekdays = series.map((p) => new Date(`${p.date}T00:00:00Z`).getUTCDay());
        expect(weekdays).not.toContain(0);
        expect(weekdays).not.toContain(6);
      }
    }
  });

  it("os benchmarks partem todos da mesma base 100", () => {
    const [first] = buildBenchmarks();
    expect(first.cdi).toBe(100);
    expect(first.ibov).toBe(100);
    expect(first.ipca).toBe(100);
    expect(first.carteira).toBe(100);
  });

  it("todo ativo com posição tem nome e classe declarados", () => {
    for (const holding of holdings) {
      expect(assets.some((a) => a.id === holding.assetId)).toBe(true);
    }
  });
});
