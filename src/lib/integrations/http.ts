/**
 * Camada de chamada a API externa: timeout, retry com backoff e limite de
 * requisições por janela.
 *
 * Existe porque toda integração do projeto tem a mesma restrição: cota
 * limitada (a brapi dá 15.000 requisições por ciclo mensal), timeout de 60s na
 * função da Vercel, e API de terceiro que falha de vez em quando sem motivo.
 */

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  /** Tentativas totais, incluindo a primeira. */
  attempts?: number;
  /** Espera inicial do backoff, em ms. Dobra a cada tentativa. */
  backoffMs?: number;
  timeoutMs?: number;
  /** Injetável para teste; usa `globalThis.fetch` por padrão. */
  fetchImpl?: typeof fetch;
  /** Injetável para teste; evita esperar de verdade. */
  sleepImpl?: (ms: number) => Promise<void>;
}

const DEFAULTS = {
  attempts: 3,
  backoffMs: 400,
  // Abaixo do teto de 60s da função da Vercel, com folga para o retry caber.
  timeoutMs: 12_000,
};

/**
 * Só tenta de novo o que pode dar certo numa segunda chamada: erro de rede,
 * 429 e 5xx. Repetir um 401 ou um 400 só gastaria cota — a resposta seria a
 * mesma, e no caso do 401 ainda arriscaria bloquear a chave.
 */
export function isRetryable(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const {
    attempts = DEFAULTS.attempts,
    backoffMs = DEFAULTS.backoffMs,
    timeoutMs = DEFAULTS.timeoutMs,
    fetchImpl = globalThis.fetch,
    sleepImpl = sleep,
    ...request
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: request.method ?? "GET",
          headers: request.headers,
          body: request.body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.ok) return (await response.json()) as T;

      const body = await response.text().catch(() => "");
      const error = new HttpError(
        `${response.status} ${response.statusText || "erro"} em ${safeUrl(url)}`,
        response.status,
        body.slice(0, 500),
      );

      if (!isRetryable(response.status) || attempt === attempts) throw error;
      lastError = error;
    } catch (error) {
      // Erro de rede ou timeout: vale tentar de novo, mas não indefinidamente.
      if (error instanceof HttpError && !isRetryable(error.status)) throw error;
      if (attempt === attempts) throw error;
      lastError = error;
    }

    // Backoff exponencial com jitter: sem o jitter, várias chamadas que
    // falharam juntas voltariam juntas e derrubariam o provedor de novo.
    const wait = backoffMs * 2 ** (attempt - 1);
    await sleepImpl(wait + Math.random() * wait * 0.25);
  }

  throw lastError ?? new Error(`Falha ao chamar ${safeUrl(url)}`);
}

/**
 * Limitador simples de requisições por janela deslizante.
 *
 * Roda em memória, por instância — suficiente para o sync agendado, que é
 * sequencial. Cota mensal (como a da brapi) é controlada por cache no banco,
 * não aqui.
 */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleepImpl: (ms: number) => Promise<void> = sleep,
  ) {}

  async acquire(): Promise<void> {
    this.prune();

    if (this.timestamps.length >= this.max) {
      const oldest = this.timestamps[0];
      const wait = this.windowMs - (this.now() - oldest);
      if (wait > 0) await this.sleepImpl(wait);
      this.prune();
    }

    this.timestamps.push(this.now());
  }

  private prune() {
    const cutoff = this.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Tira query string da URL antes de logar: é onde token costuma viajar. */
export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}
