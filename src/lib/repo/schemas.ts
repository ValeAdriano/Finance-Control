import { z } from "zod";

/**
 * Validação do que vem do banco antes de virar tipo de domínio.
 *
 * Os fundamentos são gravados como JSONB (o conjunto de indicadores muda
 * conforme a fonte evolui, e uma coluna por indicador exigiria migração a cada
 * campo novo). JSONB não tem formato garantido, então a garantia vem daqui.
 */

/** Número que aceita ausência — no domínio, dado faltante é `null`, não zero. */
const optionalNumber = z.number().nullable().default(null);
const optionalBoolean = z.boolean().nullable().default(null);
const optionalString = z.string().nullable().default(null);

export const stockFundamentalsPayload = z.object({
  roic: optionalNumber,
  earningsYield: optionalNumber,
  netIncome: optionalNumber,
  operatingCashFlow: optionalNumber,
  roa: optionalNumber,
  roaPreviousYear: optionalNumber,
  longTermDebtToAssets: optionalNumber,
  longTermDebtToAssetsPreviousYear: optionalNumber,
  currentRatio: optionalNumber,
  currentRatioPreviousYear: optionalNumber,
  issuedShares: optionalBoolean,
  grossMargin: optionalNumber,
  grossMarginPreviousYear: optionalNumber,
  assetTurnover: optionalNumber,
  assetTurnoverPreviousYear: optionalNumber,
  priceToEarnings: optionalNumber,
  priceToBook: optionalNumber,
  longTermDebt: optionalNumber,
  workingCapital: optionalNumber,
  dividendYield: optionalNumber,
  dividendYieldHistory: z.array(z.number()).default([]),
  yearsPayingDividends: optionalNumber,
  netDebtToEbitda: optionalNumber,
  sector: optionalString,
});

export const fiiFundamentalsPayload = z.object({
  dividendYield12m: optionalNumber,
  dividendYield24m: optionalNumber,
  dividendVolatility: optionalNumber,
  priceToBook: optionalNumber,
  vacancyRate: optionalNumber,
  tenantCount: optionalNumber,
  largestTenantShare: optionalNumber,
  dailyLiquidity: optionalNumber,
  segment: z.enum(["tijolo", "papel", "hibrido", "fof"]).nullable().default(null),
  managementFee: optionalNumber,
});

export const cryptoMetricsPayload = z.object({
  marketCapRank: optionalNumber,
  volatility: optionalNumber,
  dominance: optionalNumber,
  volume24h: optionalNumber,
});

export const fixedIncomeTermsPayload = z.object({
  indexer: z.enum(["prefixado", "cdi", "ipca", "selic"]),
  contractedRate: z.number(),
  spread: optionalNumber,
  maturityDate: z.string(),
  issuer: z.string(),
  issuerRating: optionalString,
  fgcCovered: z.boolean(),
  isTaxExempt: z.boolean(),
});

export const agroPositionPayload = z.object({
  contributed: z.number(),
  currentValue: z.number(),
  cycleStart: z.string(),
  expectedSettlement: optionalString,
});

export const marketContextPayload = z.object({
  cdi: z.number(),
  ipca: z.number(),
  usdBrl: z.number(),
});

export const scoringSettingsPayload = z.object({
  stock: z.object({
    qualityPrice: z.number(),
    financialHealth: z.number(),
    safety: z.number(),
    income: z.number(),
  }),
  fii: z.object({
    income: z.number(),
    valuation: z.number(),
    occupancy: z.number(),
    liquidity: z.number(),
    management: z.number(),
  }),
  crypto: z.object({
    marketCap: z.number(),
    liquidity: z.number(),
    volatility: z.number(),
  }),
  fixedIncome: z.object({
    yield: z.number(),
    term: z.number(),
    issuerRisk: z.number(),
  }),
  bazinYieldFloor: z.number(),
  bazinUseCdiSpread: z.boolean(),
  bazinCdiFactor: z.number(),
  minDividendYears: z.number(),
  perennialSectors: z.array(z.string()),
});

export const netWorthByClassPayload = z.object({
  acao: z.number().default(0),
  fii: z.number().default(0),
  cripto: z.number().default(0),
  renda_fixa: z.number().default(0),
  agro: z.number().default(0),
});

/**
 * Valida e devolve `null` em vez de estourar quando um registro está corrompido.
 *
 * Um fundamento malformado não pode derrubar a carteira inteira: o ativo fica
 * sem score (a cobertura já comunica isso) e o resto da tela continua de pé.
 *
 * Dado **ausente** não é dado inválido e não gera aviso: usuário sem
 * configuração salva, ou consulta que a RLS legitimamente não respondeu, são
 * estados normais — avisar neles encheria o log de ruído e esconderia o
 * payload de verdade corrompido.
 */
export function parseOrNull<T>(schema: z.ZodType<T>, value: unknown, context: string): T | null {
  if (value === null || value === undefined) return null;

  const result = schema.safeParse(value);

  if (!result.success) {
    console.warn(`[repo] payload inválido em ${context}:`, result.error.issues.slice(0, 3));
    return null;
  }

  return result.data;
}
