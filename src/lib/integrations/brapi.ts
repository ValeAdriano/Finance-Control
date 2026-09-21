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
  /**
   * Opcional: a brapi responde cotação mesmo sem token, com limite menor. O
   * token serve para ampliar a cota, não para destravar o acesso.
   */
  token?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Formato plausível de token da brapi.
 *
 * Existe porque a brapi **não recusa token inválido**: ela devolve 200 com
 * cotação com token errado, sem token, com qualquer coisa. Sem essa checagem,
 * um texto colado por engano seria aceito em silêncio e o usuário acharia que
 * está usando a cota ampliada quando não está.
 */
export function looksLikeToken(value: string): boolean {
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(trimmed);
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
  { token, fetchImpl }: BrapiOptions = {},
): Promise<Map<string, BrapiQuote>> {
  if (symbols.length === 0) return new Map();

  await limiter.acquire();

  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const url = `${BASE_URL}/quote/${symbols.join(",")}${query}`;
  const raw = await requestJson<unknown>(url, { fetchImpl });
  const parsed = quoteResponseSchema.parse(raw);

  return new Map(parsed.results.map((quote) => [quote.symbol.toUpperCase(), quote]));
}

/**
 * Confere o token da brapi — até onde dá.
 *
 * A brapi devolve 200 com cotação para token inválido, token ausente e
 * qualquer texto no lugar dele. Então **não existe como confirmar pela API**
 * que o token está sendo aplicado. O que dá para fazer é checar o formato e
 * confirmar que a API responde — e dizer isso ao usuário, em vez de carimbar
 * "válido" sobre um valor que pode ser lixo.
 */
export async function verifyToken(
  token: string,
  fetchImpl?: typeof fetch,
): Promise<{ valid: boolean; message: string }> {
  if (!looksLikeToken(token)) {
    return {
      valid: false,
      message:
        "Isso não parece um token da brapi. Ele é uma sequência de letras e números, sem espaço nem pontuação — confira o que foi colado.",
    };
  }

  try {
    const quotes = await fetchQuotes(["PETR4"], { token, fetchImpl });

    return quotes.size > 0
      ? {
          valid: true,
          message:
            "A brapi respondeu com cotação. Ela não recusa token inválido, então isso confirma o acesso, não o token — se você bater no limite de requisições, é sinal de que ele não está sendo aplicado.",
        }
      : { valid: false, message: "A brapi respondeu sem dado." };
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
