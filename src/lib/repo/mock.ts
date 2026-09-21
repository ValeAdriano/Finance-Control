import type { FinanceRepository } from "./types";
import type { PricePoint } from "@/types/domain";
import { DEFAULT_SCORING_SETTINGS } from "@/lib/scoring";
import { assetSlug } from "@/lib/slug";
import {
  agroPositions,
  assets,
  cryptoMetrics,
  fiiFundamentals,
  fixedIncomeTerms,
  holdings,
  institutions,
  stockFundamentals,
} from "@/mocks/assets";
import { buildBenchmarks, buildNetWorthHistory, buildPriceHistory } from "@/mocks/series";
import {
  allocationTargets,
  expenseCategories,
  expenseEntries,
  journalEntries,
  marketContext,
  transactions,
  watchlist,
} from "@/mocks/records";

/**
 * Implementacao mockada do repositorio (Fase 1). As series geradas sao
 * memoizadas no modulo: sao deterministicas, entao recalcular a cada request
 * so gastaria CPU.
 */

/** O slug e derivado, nao digitado — o mock calcula igual ao trigger do banco. */
const withSlug = assets.map((asset) => ({ ...asset, slug: assetSlug(asset.symbol) }));

let priceHistoryCache: PricePoint[] | null = null;
function priceHistory(): PricePoint[] {
  priceHistoryCache ??= buildPriceHistory();
  return priceHistoryCache;
}

const netWorthCache = buildNetWorthHistory();
const benchmarkCache = buildBenchmarks();

export const mockRepository: FinanceRepository = {
  async getInstitutions() {
    return institutions;
  },

  async getAssets() {
    return withSlug;
  },

  async getAsset(idOrSlug) {
    const needle = assetSlug(idOrSlug);
    return withSlug.find((a) => a.id === idOrSlug || a.slug === needle) ?? null;
  },

  async getHoldings() {
    return holdings;
  },

  async getTransactions(options) {
    let result = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
    if (options?.assetId) result = result.filter((t) => t.assetId === options.assetId);
    if (options?.limit) result = result.slice(0, options.limit);
    return result;
  },

  async getPriceHistory(assetId, days = 180) {
    const series = priceHistory().filter((p) => p.assetId === assetId);
    return series.slice(Math.max(0, series.length - days));
  },

  async getNetWorthHistory() {
    return netWorthCache;
  },

  async getBenchmarks() {
    return benchmarkCache;
  },

  async getExpenseCategories() {
    return expenseCategories;
  },

  async getExpenseEntries(month) {
    return month ? expenseEntries.filter((e) => e.date.startsWith(month)) : expenseEntries;
  },

  async getAllocationTargets() {
    return allocationTargets;
  },

  async getWatchlist() {
    return watchlist;
  },

  async getJournalEntries(assetId) {
    const sorted = [...journalEntries].sort((a, b) => b.date.localeCompare(a.date));
    return assetId ? sorted.filter((j) => j.assetId === assetId) : sorted;
  },

  async getStockFundamentals() {
    return stockFundamentals;
  },

  async getFiiFundamentals() {
    return fiiFundamentals;
  },

  async getCryptoMetrics() {
    return cryptoMetrics;
  },

  async getFixedIncomeTerms() {
    return fixedIncomeTerms;
  },

  async getAgroPositions() {
    return agroPositions;
  },

  async getMarketContext() {
    return marketContext;
  },

  async getScoringSettings() {
    return DEFAULT_SCORING_SETTINGS;
  },
};
