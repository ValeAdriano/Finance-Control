import { z } from "zod";
import { RateLimiter, requestJson } from "./http";

/**
 * Cliente da Pluggy — Open Finance.
 *
 * Acesso direto ao Open Finance como pessoa física não é viável (exige ser
 * instituição participante do Banco Central), então o caminho é o conector
 * gratuito da Pluggy, que permite até 5 conexões ativas e atualiza a cada 24h.
 *
 * O fluxo é: client id + secret geram um apiKey de curta duração, e é ele que
 * autentica as chamadas seguintes.
 */

const BASE_URL = "https://api.pluggy.ai";

const limiter = new RateLimiter(20, 60_000);

const authSchema = z.object({ apiKey: z.string() });

const itemSchema = z.object({
  id: z.string(),
  status: z.string(),
  connector: z.object({ id: z.number(), name: z.string() }).partial().optional(),
  updatedAt: z.string().nullable().default(null),
});

const accountSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  balance: z.number(),
  currencyCode: z.string().default("BRL"),
});

const transactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  category: z.string().nullable().default(null),
  type: z.string().nullable().default(null),
});

export type PluggyAccount = z.infer<typeof accountSchema>;
export type PluggyTransaction = z.infer<typeof transactionSchema>;
export type PluggyItem = z.infer<typeof itemSchema>;

export interface PluggyCredentials {
  clientId: string;
  clientSecret: string;
}

/** Troca client id + secret por um apiKey de curta duração. */
export async function authenticate(
  { clientId, clientSecret }: PluggyCredentials,
  fetchImpl?: typeof fetch,
): Promise<string> {
  await limiter.acquire();

  const raw = await requestJson<unknown>(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    fetchImpl,
  });

  return authSchema.parse(raw).apiKey;
}

export async function fetchItem(
  apiKey: string,
  itemId: string,
  fetchImpl?: typeof fetch,
): Promise<PluggyItem> {
  await limiter.acquire();

  const raw = await requestJson<unknown>(`${BASE_URL}/items/${itemId}`, {
    headers: { "X-API-KEY": apiKey },
    fetchImpl,
  });

  return itemSchema.parse(raw);
}

export async function fetchAccounts(
  apiKey: string,
  itemId: string,
  fetchImpl?: typeof fetch,
): Promise<PluggyAccount[]> {
  await limiter.acquire();

  const raw = await requestJson<unknown>(`${BASE_URL}/accounts?itemId=${itemId}`, {
    headers: { "X-API-KEY": apiKey },
    fetchImpl,
  });

  return z.object({ results: z.array(accountSchema).default([]) }).parse(raw).results;
}

/**
 * Lançamentos de uma conta a partir de uma data.
 *
 * O `from` é o que evita reimportar o extrato inteiro a cada sync; a
 * deduplicação de verdade vem do `id` da Pluggy gravado em `external_id`, com
 * índice único no banco.
 */
export async function fetchTransactions(
  apiKey: string,
  accountId: string,
  from: string,
  fetchImpl?: typeof fetch,
): Promise<PluggyTransaction[]> {
  const results: PluggyTransaction[] = [];
  let page = 1;

  // A API pagina; sem o laço, o sync perderia lançamento silenciosamente.
  for (;;) {
    await limiter.acquire();

    const raw = await requestJson<unknown>(
      `${BASE_URL}/transactions?accountId=${accountId}&from=${from}&page=${page}&pageSize=200`,
      { headers: { "X-API-KEY": apiKey }, fetchImpl },
    );

    const parsed = z
      .object({
        results: z.array(transactionSchema).default([]),
        totalPages: z.number().default(1),
      })
      .parse(raw);

    results.push(...parsed.results);

    if (page >= parsed.totalPages || parsed.results.length === 0) break;
    page++;
  }

  return results;
}

export async function verifyCredentials(
  credentials: PluggyCredentials,
  fetchImpl?: typeof fetch,
): Promise<{ valid: boolean; message: string }> {
  try {
    await authenticate(credentials, fetchImpl);
    return { valid: true, message: "Credenciais válidas." };
  } catch (error) {
    const status = (error as { status?: number }).status;

    if (status === 401 || status === 403) {
      return { valid: false, message: "Client ID ou Client Secret recusados pela Pluggy." };
    }

    return { valid: false, message: "Não foi possível falar com a Pluggy agora." };
  }
}
