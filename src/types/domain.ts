/**
 * Modelo de dominio da plataforma. Espelha o schema do Postgres em
 * `supabase/migrations/` — mudou aqui, muda la (e vice-versa).
 */

/** Classes de investimento cobertas pela plataforma. */
export const ASSET_CLASSES = ["acao", "fii", "cripto", "renda_fixa", "agro"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  acao: "Ações",
  fii: "FIIs",
  cripto: "Cripto",
  renda_fixa: "Renda fixa",
  agro: "Agronegócio",
};

/** Moeda em que o ativo e negociado. Cripto e cotada em USD e convertida na borda. */
export type Currency = "BRL" | "USD";

/** De onde o dado veio — importa para saber o que da pra reconciliar. */
export type DataSource = "manual" | "pluggy" | "binance" | "brapi" | "nota_corretagem";

export interface Institution {
  id: string;
  name: string;
  /** Conector que alimenta a instituicao. */
  provider: Extract<DataSource, "manual" | "pluggy" | "binance">;
  /** Ultima sincronizacao bem sucedida (ISO 8601). */
  lastSyncAt: string | null;
  status: "conectada" | "expirada" | "erro" | "manual";
}

export interface Asset {
  id: string;
  /** Ticker (PETR4, HGLG11, BTC) ou nome do contrato, para renda fixa e agro. */
  symbol: string;
  /**
   * Identificador do ativo na URL. Derivado do simbolo por `assetSlug`, porque
   * simbolo de renda fixa e agro tem espaco e sinal e nao serve como rota.
   */
  slug: string;
  name: string;
  assetClass: AssetClass;
  currency: Currency;
  sector: string | null;
  institutionId: string | null;
}

export interface Holding {
  assetId: string;
  quantity: number;
  /** Custo medio por unidade, na moeda do ativo. Base do calculo de IR. */
  averagePrice: number;
  /** Ultima cotacao conhecida, na moeda do ativo. */
  lastPrice: number;
  /** Variacao percentual do dia, como fracao (0.0125 = +1,25%). */
  dayChange: number;
  updatedAt: string;
}

export type TransactionKind =
  "compra" | "venda" | "dividendo" | "juros" | "aporte" | "resgate" | "taxa";

export interface Transaction {
  id: string;
  assetId: string;
  kind: TransactionKind;
  date: string;
  quantity: number;
  /** Preco unitario na moeda do ativo. Para dividendo, o valor por cota. */
  unitPrice: number;
  fees: number;
  source: DataSource;
  /** Chave de deduplicacao do sync — mesma chave nao entra duas vezes. */
  externalId: string | null;
  notes: string | null;
}

export interface PricePoint {
  assetId: string;
  date: string;
  close: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  /** Orcamento mensal em BRL. `null` = sem teto definido. */
  monthlyBudget: number | null;
  color: string;
}

export interface ExpenseEntry {
  id: string;
  categoryId: string;
  date: string;
  description: string;
  /** Positivo para entrada, negativo para saida. */
  amount: number;
  source: DataSource;
}

export interface AllocationTarget {
  assetClass: AssetClass;
  /** Meta como fracao (0.4 = 40%). A soma das metas deve fechar em 1. */
  target: number;
}

export interface WatchlistItem {
  assetId: string;
  addedAt: string;
  /** Preco-alvo de entrada, na moeda do ativo. */
  targetPrice: number | null;
  notes: string | null;
}

export interface JournalEntry {
  id: string;
  assetId: string | null;
  date: string;
  title: string;
  body: string;
  tags: string[];
}

/** Ponto da serie historica de patrimonio, sempre consolidado em BRL. */
export interface NetWorthPoint {
  date: string;
  /** Patrimonio total em BRL. */
  total: number;
  /** Quanto disso foi aporte, para separar rentabilidade de dinheiro novo. */
  contributed: number;
  byClass: Record<AssetClass, number>;
}

/** Indices de comparacao (CDI, IBOV, IPCA) normalizados em base 100. */
export interface BenchmarkPoint {
  date: string;
  cdi: number;
  ibov: number;
  ipca: number;
  carteira: number;
}

/* -------------------------------------------------------------------------- */
/* Fundamentos — entrada do motor de score                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fundamentos de acao. Todo campo e anulavel de proposito: dado faltante vira
 * `null` e reduz a cobertura do score, em vez de virar zero e punir o ativo.
 */
export interface StockFundamentals {
  assetId: string;
  /** Retorno sobre o capital investido, como fracao. */
  roic: number | null;
  /** EBIT / Enterprise Value, como fracao (earnings yield da Magic Formula). */
  earningsYield: number | null;

  /** Piotroski — rentabilidade. */
  netIncome: number | null;
  operatingCashFlow: number | null;
  roa: number | null;
  roaPreviousYear: number | null;

  /** Piotroski — alavancagem e liquidez. */
  longTermDebtToAssets: number | null;
  longTermDebtToAssetsPreviousYear: number | null;
  currentRatio: number | null;
  currentRatioPreviousYear: number | null;
  /** Emitiu acao nova no periodo (diluicao)? */
  issuedShares: boolean | null;

  /** Piotroski — eficiencia operacional. */
  grossMargin: number | null;
  grossMarginPreviousYear: number | null;
  assetTurnover: number | null;
  assetTurnoverPreviousYear: number | null;

  /** Graham. */
  priceToEarnings: number | null;
  priceToBook: number | null;
  longTermDebt: number | null;
  workingCapital: number | null;

  /** Bazin / Barsi. */
  dividendYield: number | null;
  /** DY ano a ano, do mais recente para o mais antigo, como fracao. */
  dividendYieldHistory: number[];
  /** Anos consecutivos pagando dividendo. */
  yearsPayingDividends: number | null;
  netDebtToEbitda: number | null;
  sector: string | null;

  /** Data de referencia do balanco usado (ISO 8601). */
  referenceDate: string;
}

export interface FiiFundamentals {
  assetId: string;
  /** DY dos ultimos 12 e 24 meses, como fracao. */
  dividendYield12m: number | null;
  dividendYield24m: number | null;
  /** Desvio padrao dos rendimentos mensais — mede consistencia. */
  dividendVolatility: number | null;
  priceToBook: number | null;
  /** Vacancia fisica, como fracao. Fundo de papel nao tem — fica `null`. */
  vacancyRate: number | null;
  /** Numero de inquilinos e peso do maior deles, como fracao. */
  tenantCount: number | null;
  largestTenantShare: number | null;
  /** Liquidez media diaria em BRL. */
  dailyLiquidity: number | null;
  segment: "tijolo" | "papel" | "hibrido" | "fof" | null;
  /** Taxa de administracao + performance, como fracao do patrimonio. */
  managementFee: number | null;
  referenceDate: string;
}

export interface CryptoMetrics {
  assetId: string;
  /** Posicao no ranking de market cap (1 = maior). */
  marketCapRank: number | null;
  /** Volatilidade anualizada, como fracao. */
  volatility: number | null;
  /** Dominancia de mercado, como fracao. */
  dominance: number | null;
  /** Volume negociado em 24h, em USD. */
  volume24h: number | null;
  referenceDate: string;
}

export type FixedIncomeIndexer = "prefixado" | "cdi" | "ipca" | "selic";

export interface FixedIncomeTerms {
  assetId: string;
  indexer: FixedIncomeIndexer;
  /** Taxa contratada como fracao: 0.12 = 12% a.a. (pre), 1.1 = 110% do CDI. */
  contractedRate: number;
  /** Cupom acima do indexador, quando houver (IPCA + 6% => 0.06). */
  spread: number | null;
  maturityDate: string;
  issuer: string;
  /** Rating do emissor em escala nacional (AAA..D), quando disponivel. */
  issuerRating: string | null;
  /** Coberto pelo FGC? Muda completamente o risco percebido. */
  fgcCovered: boolean;
  isTaxExempt: boolean;
}

/** Investimento em agro: aporte e apuracao sao manuais. */
export interface AgroPosition {
  assetId: string;
  /** Total aportado em BRL. */
  contributed: number;
  /** Valor apurado/estimado hoje em BRL. */
  currentValue: number;
  cycleStart: string;
  /** Previsao de apuracao/colheita. */
  expectedSettlement: string | null;
}
