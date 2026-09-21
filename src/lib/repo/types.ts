import type {
  AgroPosition,
  AllocationTarget,
  Asset,
  BenchmarkPoint,
  CryptoMetrics,
  ExpenseCategory,
  ExpenseEntry,
  FiiFundamentals,
  FixedIncomeTerms,
  Holding,
  Institution,
  JournalEntry,
  NetWorthPoint,
  PricePoint,
  StockFundamentals,
  Transaction,
  WatchlistItem,
} from "@/types/domain";
import type { MarketContext, ScoringSettings } from "@/lib/scoring";

/**
 * Contrato de acesso a dado. A interface toda fala com isso, nunca com o mock
 * nem com o Supabase direto — e o que permite trocar a Fase 1 pela Fase 2 sem
 * reescrever tela nenhuma.
 *
 * Tudo e assincrono de proposito, mesmo no mock: se fosse sincrono agora, cada
 * chamada viraria um `await` novo (e um bug de loading) quando o banco entrar.
 */
export interface FinanceRepository {
  getInstitutions(): Promise<Institution[]>;

  getAssets(): Promise<Asset[]>;
  /** Resolve por uuid ou pelo slug da URL. */
  getAsset(idOrSlug: string): Promise<Asset | null>;
  getHoldings(): Promise<Holding[]>;

  getTransactions(options?: { assetId?: string; limit?: number }): Promise<Transaction[]>;
  getPriceHistory(assetId: string, days?: number): Promise<PricePoint[]>;

  getNetWorthHistory(): Promise<NetWorthPoint[]>;
  getBenchmarks(): Promise<BenchmarkPoint[]>;

  getExpenseCategories(): Promise<ExpenseCategory[]>;
  getExpenseEntries(month?: string): Promise<ExpenseEntry[]>;

  getAllocationTargets(): Promise<AllocationTarget[]>;
  getWatchlist(): Promise<WatchlistItem[]>;
  getJournalEntries(assetId?: string): Promise<JournalEntry[]>;

  getStockFundamentals(): Promise<StockFundamentals[]>;
  getFiiFundamentals(): Promise<FiiFundamentals[]>;
  getCryptoMetrics(): Promise<CryptoMetrics[]>;
  getFixedIncomeTerms(): Promise<FixedIncomeTerms[]>;
  getAgroPositions(): Promise<AgroPosition[]>;

  getMarketContext(): Promise<MarketContext>;
  getScoringSettings(): Promise<ScoringSettings>;
}
