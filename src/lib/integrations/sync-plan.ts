import type { AssetClass, Currency } from "@/types/domain";
import type { BrapiQuote } from "./brapi";
import type { BinanceBalance } from "./binance";
import type { PluggyTransaction } from "./pluggy";

/**
 * Planejamento do sync: dado o estado atual e o que veio da API externa,
 * decide o que inserir e o que atualizar — sem tocar no banco.
 *
 * A separação existe para a **idempotência ser testável**. É o requisito mais
 * fácil de quebrar sem perceber (reimportar o extrato e duplicar lançamento) e
 * o mais caro de descobrir tarde, então ele é provado por teste, não por
 * inspeção.
 */

export interface PriceRow {
  assetId: string;
  date: string;
  close: number;
}

export interface HoldingUpdate {
  assetId: string;
  lastPrice: number;
  dayChange: number;
}

export interface QuotePlan {
  priceRows: PriceRow[];
  holdingUpdates: HoldingUpdate[];
  /** Tickers pedidos que a brapi não devolveu — some da tela sem aviso seria pior. */
  missing: string[];
}

export interface SyncableAsset {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  currency: Currency;
}

/**
 * Cotação de ações e FIIs.
 *
 * Cotação sem preço não vira linha: gravar `null` em `price_history`
 * contaminaria o histórico, e a tabela é append-only — o erro ficaria lá.
 */
export function planQuoteSync(
  assets: SyncableAsset[],
  quotes: Map<string, BrapiQuote>,
  today: string,
): QuotePlan {
  const priceRows: PriceRow[] = [];
  const holdingUpdates: HoldingUpdate[] = [];
  const missing: string[] = [];

  for (const asset of assets) {
    const quote = quotes.get(asset.symbol.toUpperCase());

    if (!quote || quote.regularMarketPrice === null) {
      missing.push(asset.symbol);
      continue;
    }

    priceRows.push({ assetId: asset.id, date: today, close: quote.regularMarketPrice });
    holdingUpdates.push({
      assetId: asset.id,
      lastPrice: quote.regularMarketPrice,
      // A brapi devolve percentual inteiro; o domínio guarda fração.
      dayChange: (quote.regularMarketChangePercent ?? 0) / 100,
    });
  }

  return { priceRows, holdingUpdates, missing };
}

export interface NewCryptoAsset {
  symbol: string;
  name: string;
  quantity: number;
}

export interface BinancePlan {
  /** Moedas com saldo que ainda não existem como ativo. */
  newAssets: NewCryptoAsset[];
  holdingUpdates: (HoldingUpdate & { quantity: number })[];
  priceRows: PriceRow[];
  /** Ativos que existiam e zeraram — a posição precisa ir a zero, não sumir. */
  zeroed: string[];
  /** Moedas com saldo mas sem par em USDT: não dá para avaliar. */
  unpriced: string[];
}

/**
 * Saldo e cotação da Binance.
 *
 * Moeda que sumiu do saldo vira posição zerada em vez de desaparecer: apagar o
 * ativo levaria junto o histórico de transação e de preço, e o custo médio
 * some — justamente o que o cálculo de IR precisa.
 */
export function planBinanceSync(
  existingAssets: SyncableAsset[],
  balances: BinanceBalance[],
  prices: Map<string, { price: number; changePercent: number }>,
  today: string,
): BinancePlan {
  const bySymbol = new Map(
    existingAssets.filter((a) => a.assetClass === "cripto").map((a) => [a.symbol.toUpperCase(), a]),
  );

  const newAssets: NewCryptoAsset[] = [];
  const holdingUpdates: BinancePlan["holdingUpdates"] = [];
  const priceRows: PriceRow[] = [];
  const unpriced: string[] = [];
  const seen = new Set<string>();

  for (const balance of balances) {
    const symbol = balance.asset.toUpperCase();

    // Stablecoin atrelada ao dólar não tem par USDT e não é posição de risco.
    if (symbol === "USDT" || symbol === "USDC" || symbol === "BUSD") continue;

    seen.add(symbol);

    const quote = prices.get(symbol);
    if (!quote) {
      unpriced.push(symbol);
      continue;
    }

    const existing = bySymbol.get(symbol);

    if (!existing) {
      newAssets.push({ symbol, name: symbol, quantity: balance.quantity });
      continue;
    }

    holdingUpdates.push({
      assetId: existing.id,
      quantity: balance.quantity,
      lastPrice: quote.price,
      dayChange: quote.changePercent,
    });
    priceRows.push({ assetId: existing.id, date: today, close: quote.price });
  }

  const zeroed = [...bySymbol.entries()]
    .filter(([symbol]) => !seen.has(symbol))
    .map(([, asset]) => asset.id);

  return { newAssets, holdingUpdates, priceRows, zeroed, unpriced };
}

export interface ExpenseRow {
  externalId: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string | null;
}

export interface ExpensePlan {
  toInsert: ExpenseRow[];
  /** Quantos já existiam. É o número que prova que o sync é idempotente. */
  skipped: number;
}

/**
 * Importação do extrato via Open Finance.
 *
 * A deduplicação usa o `id` da Pluggy, que é estável entre chamadas, e é
 * reforçada por índice único em `(user_id, source, external_id)` no banco — o
 * filtro aqui evita a ida desnecessária, o índice garante a correção mesmo se
 * duas execuções rodarem ao mesmo tempo.
 */
export function planExpenseImport(
  existingExternalIds: Set<string>,
  transactions: PluggyTransaction[],
  categoryResolver: (category: string | null) => string | null,
): ExpensePlan {
  const toInsert: ExpenseRow[] = [];
  let skipped = 0;

  // A própria resposta pode repetir um id entre páginas; o Set local evita
  // que o lote conflite consigo mesmo no insert.
  const seen = new Set<string>();

  for (const transaction of transactions) {
    if (existingExternalIds.has(transaction.id) || seen.has(transaction.id)) {
      skipped++;
      continue;
    }

    seen.add(transaction.id);
    toInsert.push({
      externalId: transaction.id,
      date: transaction.date.slice(0, 10),
      description: transaction.description,
      amount: transaction.amount,
      categoryId: categoryResolver(transaction.category),
    });
  }

  return { toInsert, skipped };
}
