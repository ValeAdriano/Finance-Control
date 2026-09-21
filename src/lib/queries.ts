import { cache } from "react";
import { repo } from "@/lib/repo";
import { buildPortfolio, rebalance, summarizeExpenses, type Portfolio } from "@/lib/finance";
import {
  scoreCryptos,
  scoreFiis,
  scoreFixedIncome,
  scoreStocks,
  type ScoreResult,
} from "@/lib/scoring";
import type { AssetClass } from "@/types/domain";

/**
 * Composicao das consultas que as telas usam. Fica separado do repositorio
 * porque aqui mora regra de apresentacao (juntar posicao com score, resumir o
 * mes), e o repositorio so entrega dado cru.
 *
 * `cache()` do React deduplica a chamada dentro do mesmo request: a home pede
 * a carteira quatro vezes em componentes diferentes e o dado e buscado uma vez.
 */

export const getPortfolio = cache(async (): Promise<Portfolio> => {
  const [assets, holdings, market] = await Promise.all([
    repo.getAssets(),
    repo.getHoldings(),
    repo.getMarketContext(),
  ]);

  return buildPortfolio(assets, holdings, market.usdBrl);
});

/** Score de todo ativo que tem dado de fundamento, indexado por `assetId`. */
export const getScores = cache(async (): Promise<Map<string, ScoreResult>> => {
  const [settings, market, stocks, fiis, cryptos, fixedIncome] = await Promise.all([
    repo.getScoringSettings(),
    repo.getMarketContext(),
    repo.getStockFundamentals(),
    repo.getFiiFundamentals(),
    repo.getCryptoMetrics(),
    repo.getFixedIncomeTerms(),
  ]);

  const results = [
    ...scoreStocks(stocks, settings, market),
    ...scoreFiis(fiis, settings, market),
    ...scoreCryptos(cryptos, settings),
    ...fixedIncome.map((terms) => scoreFixedIncome(terms, settings, market)),
  ];

  return new Map(results.map((result) => [result.assetId, result]));
});

export const getRebalance = cache(async (monthlyContribution = 3_500) => {
  const [portfolio, targets] = await Promise.all([getPortfolio(), repo.getAllocationTargets()]);
  return rebalance(portfolio.byClass, targets, monthlyContribution);
});

export const getExpenseSummary = cache(async (month: string) => {
  const [categories, entries] = await Promise.all([
    repo.getExpenseCategories(),
    repo.getExpenseEntries(),
  ]);

  return summarizeExpenses(categories, entries, month);
});

/** Mes corrente no formato `YYYY-MM`. Centralizado para a Fase 2 poder fixar. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export const getClassBreakdown = cache(async () => {
  const [portfolio, targets] = await Promise.all([getPortfolio(), repo.getAllocationTargets()]);
  const targetByClass = new Map(targets.map((t) => [t.assetClass, t.target]));

  return (Object.entries(portfolio.byClass) as [AssetClass, number][])
    .map(([assetClass, value]) => ({
      assetClass,
      value,
      share: portfolio.totalBrl === 0 ? 0 : value / portfolio.totalBrl,
      target: targetByClass.get(assetClass) ?? 0,
    }))
    .sort((a, b) => b.value - a.value);
});
