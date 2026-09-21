import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SCORING_SETTINGS, type MarketContext, type ScoringSettings } from "@/lib/scoring";
import { ASSET_CLASSES } from "@/types/domain";
import type {
  AgroPosition,
  AllocationTarget,
  Asset,
  AssetClass,
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
import { assetSlug } from "@/lib/slug";
import type { FinanceRepository } from "./types";
import {
  agroPositionPayload,
  cryptoMetricsPayload,
  fiiFundamentalsPayload,
  fixedIncomeTermsPayload,
  marketContextPayload,
  netWorthByClassPayload,
  parseOrNull,
  scoringSettingsPayload,
  stockFundamentalsPayload,
} from "./schemas";

/**
 * Implementação Supabase do repositório.
 *
 * Nenhuma query filtra por `user_id`: quem faz isso é a RLS, no banco. Filtrar
 * também aqui daria uma falsa sensação de segurança — se a policy estiver
 * errada, o filtro da aplicação esconderia o problema em vez de expô-lo.
 */

/** Fundamentos vivem todos em `asset_fundamentals`, separados por classe. */
async function fundamentalsOfClass(assetClass: AssetClass) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("asset_fundamentals")
    .select("asset_id, reference_date, payload, assets!inner(asset_class)")
    .eq("assets.asset_class", assetClass)
    .order("reference_date", { ascending: false });

  if (error) throw new Error(`Falha ao buscar fundamentos de ${assetClass}: ${error.message}`);

  // Uma linha por ativo: a mais recente. A query já vem ordenada por data.
  const latest = new Map<string, (typeof data)[number]>();
  for (const row of data) {
    if (!latest.has(row.asset_id)) latest.set(row.asset_id, row);
  }

  return [...latest.values()];
}

export const supabaseRepository: FinanceRepository = {
  async getInstitutions(): Promise<Institution[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("institutions")
      .select("id, name, provider, status, last_sync_at")
      .order("name");

    if (error) throw new Error(`Falha ao buscar instituições: ${error.message}`);

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      provider: row.provider as Institution["provider"],
      status: row.status,
      lastSyncAt: row.last_sync_at,
    }));
  },

  async getAssets(): Promise<Asset[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assets")
      .select("id, slug, symbol, name, asset_class, currency, sector, institution_id")
      .order("symbol");

    if (error) throw new Error(`Falha ao buscar ativos: ${error.message}`);

    return data.map(toAsset);
  },

  async getAsset(idOrSlug: string): Promise<Asset | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assets")
      .select("id, slug, symbol, name, asset_class, currency, sector, institution_id")
      .or(`id.eq.${isUuid(idOrSlug) ? idOrSlug : NIL_UUID},slug.eq.${assetSlug(idOrSlug)}`)
      .maybeSingle();

    if (error) throw new Error(`Falha ao buscar ativo ${idOrSlug}: ${error.message}`);

    return data ? toAsset(data) : null;
  },

  async getHoldings(): Promise<Holding[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("holdings")
      .select("asset_id, quantity, average_price, last_price, day_change, updated_at");

    if (error) throw new Error(`Falha ao buscar posições: ${error.message}`);

    return data.map((row) => ({
      assetId: row.asset_id,
      quantity: Number(row.quantity),
      averagePrice: Number(row.average_price),
      lastPrice: Number(row.last_price),
      dayChange: Number(row.day_change),
      updatedAt: row.updated_at,
    }));
  },

  async getTransactions(options): Promise<Transaction[]> {
    const supabase = await createClient();
    let query = supabase
      .from("transactions")
      .select("id, asset_id, kind, date, quantity, unit_price, fees, source, external_id, notes")
      .order("date", { ascending: false });

    if (options?.assetId) query = query.eq("asset_id", options.assetId);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw new Error(`Falha ao buscar movimentações: ${error.message}`);

    return data.map((row) => ({
      id: row.id,
      assetId: row.asset_id,
      kind: row.kind,
      date: row.date,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      fees: Number(row.fees),
      source: row.source,
      externalId: row.external_id,
      notes: row.notes,
    }));
  },

  async getPriceHistory(assetId: string, days = 180): Promise<PricePoint[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_history")
      .select("asset_id, date, close")
      .eq("asset_id", assetId)
      .order("date", { ascending: false })
      .limit(days);

    if (error) throw new Error(`Falha ao buscar cotações: ${error.message}`);

    // A query pega os N mais recentes; o gráfico precisa em ordem cronológica.
    return data
      .map((row) => ({ assetId: row.asset_id, date: row.date, close: Number(row.close) }))
      .reverse();
  },

  async getNetWorthHistory(): Promise<NetWorthPoint[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("net_worth_history")
      .select("date, total, contributed, by_class")
      .order("date");

    if (error) throw new Error(`Falha ao buscar histórico de patrimônio: ${error.message}`);

    return data.map((row) => ({
      date: row.date,
      total: Number(row.total),
      contributed: Number(row.contributed),
      byClass:
        parseOrNull(netWorthByClassPayload, row.by_class, `net_worth_history ${row.date}`) ??
        emptyByClass(),
    }));
  },

  /**
   * Comparação com CDI, IBOV e IPCA, em base 100.
   *
   * A carteira sai do próprio histórico de patrimônio, descontado o aporte —
   * senão o gráfico mediria quanto foi depositado, não rentabilidade. Os
   * índices entram na Fase 3, junto com a brapi e o Banco Central; até lá, a
   * série vem só com a carteira e os índices repetem a base.
   */
  async getBenchmarks(): Promise<BenchmarkPoint[]> {
    const history = await supabaseRepository.getNetWorthHistory();

    let carteira = 100;

    return history.map((point, index) => {
      if (index > 0) {
        const previous = history[index - 1];
        const contribution = point.contributed - previous.contributed;
        const monthReturn =
          previous.total === 0 ? 0 : (point.total - contribution) / previous.total - 1;
        carteira *= 1 + monthReturn;
      }

      return {
        date: point.date,
        cdi: 100,
        ibov: 100,
        ipca: 100,
        carteira: round2(carteira),
      };
    });
  },

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_categories")
      .select("id, name, monthly_budget, color")
      .order("name");

    if (error) throw new Error(`Falha ao buscar categorias: ${error.message}`);

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      monthlyBudget: row.monthly_budget === null ? null : Number(row.monthly_budget),
      color: row.color,
    }));
  },

  async getExpenseEntries(month?: string): Promise<ExpenseEntry[]> {
    const supabase = await createClient();
    let query = supabase
      .from("expense_entries")
      .select("id, category_id, date, description, amount, source")
      .order("date", { ascending: false });

    if (month) {
      query = query.gte("date", `${month}-01`).lt("date", nextMonth(month));
    }

    const { data, error } = await query;
    if (error) throw new Error(`Falha ao buscar lançamentos: ${error.message}`);

    return data.map((row) => ({
      id: row.id,
      categoryId: row.category_id ?? "",
      date: row.date,
      description: row.description,
      amount: Number(row.amount),
      source: row.source,
    }));
  },

  async getAllocationTargets(): Promise<AllocationTarget[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("allocation_targets").select("asset_class, target");

    if (error) throw new Error(`Falha ao buscar metas de alocação: ${error.message}`);

    return data.map((row) => ({ assetClass: row.asset_class, target: Number(row.target) }));
  },

  async getWatchlist(): Promise<WatchlistItem[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("watchlist")
      .select("asset_id, added_at, target_price, notes")
      .order("added_at", { ascending: false });

    if (error) throw new Error(`Falha ao buscar watchlist: ${error.message}`);

    return data.map((row) => ({
      assetId: row.asset_id,
      addedAt: row.added_at,
      targetPrice: row.target_price === null ? null : Number(row.target_price),
      notes: row.notes,
    }));
  },

  async getJournalEntries(assetId?: string): Promise<JournalEntry[]> {
    const supabase = await createClient();
    let query = supabase
      .from("journal_entries")
      .select("id, asset_id, date, title, body, tags")
      .order("date", { ascending: false });

    if (assetId) query = query.eq("asset_id", assetId);

    const { data, error } = await query;
    if (error) throw new Error(`Falha ao buscar journal: ${error.message}`);

    return data.map((row) => ({
      id: row.id,
      assetId: row.asset_id,
      date: row.date,
      title: row.title,
      body: row.body,
      tags: row.tags,
    }));
  },

  async getStockFundamentals(): Promise<StockFundamentals[]> {
    const rows = await fundamentalsOfClass("acao");

    return rows.flatMap((row) => {
      const payload = parseOrNull(stockFundamentalsPayload, row.payload, `ações ${row.asset_id}`);
      return payload
        ? [{ assetId: row.asset_id, referenceDate: row.reference_date, ...payload }]
        : [];
    });
  },

  async getFiiFundamentals(): Promise<FiiFundamentals[]> {
    const rows = await fundamentalsOfClass("fii");

    return rows.flatMap((row) => {
      const payload = parseOrNull(fiiFundamentalsPayload, row.payload, `FII ${row.asset_id}`);
      return payload
        ? [{ assetId: row.asset_id, referenceDate: row.reference_date, ...payload }]
        : [];
    });
  },

  async getCryptoMetrics(): Promise<CryptoMetrics[]> {
    const rows = await fundamentalsOfClass("cripto");

    return rows.flatMap((row) => {
      const payload = parseOrNull(cryptoMetricsPayload, row.payload, `cripto ${row.asset_id}`);
      return payload
        ? [{ assetId: row.asset_id, referenceDate: row.reference_date, ...payload }]
        : [];
    });
  },

  async getFixedIncomeTerms(): Promise<FixedIncomeTerms[]> {
    const rows = await fundamentalsOfClass("renda_fixa");

    return rows.flatMap((row) => {
      const payload = parseOrNull(
        fixedIncomeTermsPayload,
        row.payload,
        `renda fixa ${row.asset_id}`,
      );
      return payload ? [{ assetId: row.asset_id, ...payload }] : [];
    });
  },

  async getAgroPositions(): Promise<AgroPosition[]> {
    const rows = await fundamentalsOfClass("agro");

    return rows.flatMap((row) => {
      const payload = parseOrNull(agroPositionPayload, row.payload, `agro ${row.asset_id}`);
      return payload ? [{ assetId: row.asset_id, ...payload }] : [];
    });
  },

  /**
   * CDI, IPCA e dólar. Entram na Fase 3, vindos do Banco Central e da brapi;
   * até lá o default mantém o cálculo funcionando com valor plausível.
   */
  async getMarketContext(): Promise<MarketContext> {
    const supabase = await createClient();
    const { data } = await supabase.from("scoring_settings").select("settings").maybeSingle();

    const market = (data?.settings as { market?: unknown })?.market;
    return (
      parseOrNull(marketContextPayload, market, "market context") ?? {
        cdi: 0.1065,
        ipca: 0.0438,
        usdBrl: 5.42,
      }
    );
  },

  async getScoringSettings(): Promise<ScoringSettings> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("scoring_settings")
      .select("settings")
      .maybeSingle();

    if (error) throw new Error(`Falha ao buscar configurações do score: ${error.message}`);

    // Usuário sem configuração salva usa o default — não é erro, é o estado
    // inicial de toda conta nova.
    return (
      parseOrNull(scoringSettingsPayload, data?.settings, "scoring settings") ??
      DEFAULT_SCORING_SETTINGS
    );
  },
};

/* --------------------------------- helpers -------------------------------- */

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function toAsset(row: {
  id: string;
  slug: string;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  currency: "BRL" | "USD";
  sector: string | null;
  institution_id: string | null;
}): Asset {
  return {
    id: row.id,
    slug: row.slug,
    symbol: row.symbol,
    name: row.name,
    assetClass: row.asset_class,
    currency: row.currency,
    sector: row.sector,
    institutionId: row.institution_id,
  };
}

function emptyByClass(): Record<AssetClass, number> {
  return Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<AssetClass, number>;
}

/** `2026-09` -> `2026-10-01`, para o filtro de mês por intervalo meio-aberto. */
export function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m, 1));
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
