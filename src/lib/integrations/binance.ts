import { createHmac } from "node:crypto";
import { z } from "zod";
import { RateLimiter, requestJson } from "./http";

/**
 * Cliente da Binance — saldo da conta e cotação de cripto.
 *
 * A chave é cadastrada pelo usuário na interface, com permissão **somente de
 * leitura**. Nada aqui negocia nem saca: o cliente só chama endpoint de
 * consulta, e é assim que deve continuar.
 */

const BASE_URL = "https://api.binance.com";

const limiter = new RateLimiter(20, 60_000);

const balanceSchema = z.object({
  asset: z.string(),
  free: z.string(),
  locked: z.string(),
});

const accountSchema = z.object({
  canTrade: z.boolean().optional(),
  canWithdraw: z.boolean().optional(),
  balances: z.array(balanceSchema).default([]),
});

const tickerSchema = z.object({
  symbol: z.string(),
  lastPrice: z.string(),
  priceChangePercent: z.string(),
});

export interface BinanceBalance {
  asset: string;
  /** Quantidade total (livre + travada em ordem). */
  quantity: number;
}

export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
}

/**
 * Assina a query string com HMAC-SHA256, como a Binance exige nos endpoints
 * autenticados. O segredo é a chave do HMAC e nunca vai na requisição.
 */
export function signQuery(query: string, apiSecret: string): string {
  return createHmac("sha256", apiSecret).update(query).digest("hex");
}

/**
 * Monta a query assinada de um endpoint autenticado.
 *
 * `recvWindow` limita por quanto tempo a requisição é aceita: sem ele, uma
 * requisição interceptada poderia ser reenviada muito depois.
 */
export function buildSignedQuery(
  params: Record<string, string | number>,
  apiSecret: string,
  timestamp: number = Date.now(),
  recvWindow = 5_000,
): string {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    recvWindow: String(recvWindow),
    timestamp: String(timestamp),
  }).toString();

  return `${query}&signature=${signQuery(query, apiSecret)}`;
}

/** Saldos com quantidade maior que zero. Conta tem centenas de moedas zeradas. */
export async function fetchBalances(
  { apiKey, apiSecret }: BinanceCredentials,
  fetchImpl?: typeof fetch,
  timestamp?: number,
): Promise<BinanceBalance[]> {
  await limiter.acquire();

  const query = buildSignedQuery({}, apiSecret, timestamp);
  const raw = await requestJson<unknown>(`${BASE_URL}/api/v3/account?${query}`, {
    headers: { "X-MBX-APIKEY": apiKey },
    fetchImpl,
  });

  const account = accountSchema.parse(raw);

  return account.balances
    .map((balance) => ({
      asset: balance.asset,
      quantity: Number(balance.free) + Number(balance.locked),
    }))
    .filter((balance) => balance.quantity > 0);
}

/** Cotação em USDT. Endpoint público — não precisa de chave. */
export async function fetchPrices(
  symbols: string[],
  fetchImpl?: typeof fetch,
): Promise<Map<string, { price: number; changePercent: number }>> {
  if (symbols.length === 0) return new Map();

  await limiter.acquire();

  const pairs = symbols.map((s) => `${s.toUpperCase()}USDT`);
  const url = `${BASE_URL}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`;
  const raw = await requestJson<unknown>(url, { fetchImpl });

  const tickers = z.array(tickerSchema).parse(raw);

  return new Map(
    tickers.map((ticker) => [
      ticker.symbol.replace(/USDT$/, ""),
      {
        price: Number(ticker.lastPrice),
        // A Binance devolve percentual como número inteiro ("1.25" = 1,25%);
        // o domínio trabalha com fração.
        changePercent: Number(ticker.priceChangePercent) / 100,
      },
    ]),
  );
}

/**
 * Verifica a chave e, de quebra, confere se ela tem permissão além de leitura.
 *
 * Avisar sobre permissão excessiva é parte do trabalho: uma chave com saque
 * habilitado que vaze custa o saldo da corretora, e o usuário pode não ter
 * percebido o que marcou na hora de criar.
 */
export async function verifyCredentials(
  credentials: BinanceCredentials,
  fetchImpl?: typeof fetch,
): Promise<{ valid: boolean; message: string; overPermissioned?: boolean }> {
  try {
    await limiter.acquire();

    const query = buildSignedQuery({}, credentials.apiSecret);
    const raw = await requestJson<unknown>(`${BASE_URL}/api/v3/account?${query}`, {
      headers: { "X-MBX-APIKEY": credentials.apiKey },
      fetchImpl,
    });

    const account = accountSchema.parse(raw);
    const overPermissioned = account.canTrade === true || account.canWithdraw === true;

    return {
      valid: true,
      overPermissioned,
      message: overPermissioned
        ? "Chave válida, mas com permissão além de leitura. Refaça marcando só “Enable Reading”."
        : "Chave válida, com permissão somente de leitura.",
    };
  } catch (error) {
    const status = (error as { status?: number }).status;

    if (status === 401)
      return { valid: false, message: "Chave ou segredo recusados pela Binance." };
    if (status === 418 || status === 429) {
      return {
        valid: false,
        message: "Binance limitou as chamadas. Tente de novo em alguns minutos.",
      };
    }
    if (status === 400) {
      return {
        valid: false,
        message:
          "Requisição recusada. Se o relógio do computador estiver adiantado, a assinatura falha.",
      };
    }

    return { valid: false, message: "Não foi possível falar com a Binance agora." };
  }
}
