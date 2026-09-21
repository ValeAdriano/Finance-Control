import { z } from "zod";
import { RateLimiter, requestJson } from "./http";

/**
 * Cliente da brapi.dev — cotação e fundamentos de ação e FII.
 *
 * A cota gratuita é de 15.000 requisições por ciclo mensal, então o consumo é
 * deliberado: pedir vários tickers numa chamada só (a API aceita lista), e
 * sempre gravar o resultado em `price_history` para não repetir a chamada.
 */

const BASE_URL = "https://brapi.dev/api";

/** Folga em relação ao que a API aceita por minuto, para nunca tomar 429. */
const limiter = new RateLimiter(30, 60_000);

const quoteSchema = z.object({
  symbol: z.string(),
  regularMarketPrice: z.number().nullable().default(null),
  regularMarketChangePercent: z.number().nullable().default(null),
  regularMarketPreviousClose: z.number().nullable().default(null),
  shortName: z.string().nullable().default(null),
  longName: z.string().nullable().default(null),
  currency: z.string().nullable().default(null),
  marketCap: z.number().nullable().default(null),
  priceEarnings: z.number().nullable().default(null),
  earningsPerShare: z.number().nullable().default(null),
});

const quoteResponseSchema = z.object({
  results: z.array(quoteSchema).default([]),
  error: z.string().optional(),
});

export type BrapiQuote = z.infer<typeof quoteSchema>;

export interface BrapiOptions {
  token: string;
  fetchImpl?: typeof fetch;
}

/**
 * Cotação de vários tickers numa chamada.
 *
 * Ticker desconhecido some do `results` em vez de gerar erro — por isso o
 * retorno é um Map: quem chama descobre o que faltou comparando com o que
 * pediu, em vez de assumir que a ordem bate.
 */
export async function fetchQuotes(
  symbols: string[],
  { token, fetchImpl }: BrapiOptions,
): Promise<Map<string, BrapiQuote>> {
  if (symbols.length === 0) return new Map();

  await limiter.acquire();

  const url = `${BASE_URL}/quote/${symbols.join(",")}?token=${encodeURIComponent(token)}`;
  const raw = await requestJson<unknown>(url, { fetchImpl });
  const parsed = quoteResponseSchema.parse(raw);

  return new Map(parsed.results.map((quote) => [quote.symbol.toUpperCase(), quote]));
}

/**
 * Confere se o token funciona, sem gastar chamada grande.
 *
 * Distingue token inválido de indisponibilidade da API: a interface precisa
 * dizer "sua chave está errada" ou "a brapi está fora do ar", que exigem
 * ações diferentes do usuário.
 */
export async function verifyToken(
  token: string,
  fetchImpl?: typeof fetch,
): Promise<{ valid: boolean; message: string }> {
  try {
    const quotes = await fetchQuotes(["PETR4"], { token, fetchImpl });

    return quotes.size > 0
      ? { valid: true, message: "Token válido — cotação recebida." }
      : { valid: false, message: "A brapi respondeu sem dado. Confira o token." };
  } catch (error) {
    const status = (error as { status?: number }).status;

    if (status === 401 || status === 403) {
      return { valid: false, message: "Token recusado pela brapi." };
    }

    return {
      valid: false,
      message:
        status === 429
          ? "Cota da brapi esgotada no ciclo atual."
          : "Não foi possível falar com a brapi agora.",
    };
  }
}
