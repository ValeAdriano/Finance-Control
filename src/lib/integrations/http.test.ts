import { describe, expect, it, vi } from "vitest";
import { HttpError, isRetryable, RateLimiter, requestJson, safeUrl } from "./http";

/** `fetch` falso que devolve as respostas na ordem em que foram passadas. */
function fakeFetch(responses: (Response | Error)[]) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url));
    const next = responses.shift();
    if (!next) throw new Error("fetch chamado mais vezes que o esperado");
    if (next instanceof Error) throw next;
    return next;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const noSleep = async () => {};

describe("requestJson", () => {
  it("devolve o JSON quando a chamada dá certo de primeira", async () => {
    const { impl } = fakeFetch([json({ ok: true })]);
    const result = await requestJson<{ ok: boolean }>("https://api.exemplo/x", {
      fetchImpl: impl,
      sleepImpl: noSleep,
    });

    expect(result).toEqual({ ok: true });
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it("tenta de novo em 500 e devolve o resultado da tentativa boa", async () => {
    const { impl } = fakeFetch([json({}, 500), json({}, 503), json({ ok: true })]);
    const result = await requestJson<{ ok: boolean }>("https://api.exemplo/x", {
      fetchImpl: impl,
      sleepImpl: noSleep,
    });

    expect(result).toEqual({ ok: true });
    expect(impl).toHaveBeenCalledTimes(3);
  });

  it("tenta de novo em 429, que é o caso de cota estourada", async () => {
    const { impl } = fakeFetch([json({}, 429), json({ ok: true })]);
    await requestJson("https://api.exemplo/x", { fetchImpl: impl, sleepImpl: noSleep });
    expect(impl).toHaveBeenCalledTimes(2);
  });

  it("NÃO tenta de novo em 401: a resposta seria a mesma e arriscaria bloquear a chave", async () => {
    const { impl } = fakeFetch([json({ message: "chave inválida" }, 401)]);

    await expect(
      requestJson("https://api.exemplo/x", { fetchImpl: impl, sleepImpl: noSleep }),
    ).rejects.toThrow(HttpError);
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it("não tenta de novo em 400", async () => {
    const { impl } = fakeFetch([json({}, 400)]);
    await expect(
      requestJson("https://api.exemplo/x", { fetchImpl: impl, sleepImpl: noSleep }),
    ).rejects.toThrow(HttpError);
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it("tenta de novo em erro de rede", async () => {
    const { impl } = fakeFetch([new TypeError("fetch failed"), json({ ok: true })]);
    const result = await requestJson<{ ok: boolean }>("https://api.exemplo/x", {
      fetchImpl: impl,
      sleepImpl: noSleep,
    });
    expect(result).toEqual({ ok: true });
  });

  it("desiste depois do número de tentativas configurado", async () => {
    const { impl } = fakeFetch([json({}, 500), json({}, 500), json({}, 500), json({}, 500)]);

    await expect(
      requestJson("https://api.exemplo/x", { fetchImpl: impl, sleepImpl: noSleep, attempts: 3 }),
    ).rejects.toThrow();
    expect(impl).toHaveBeenCalledTimes(3);
  });

  it("espera mais a cada tentativa (backoff exponencial)", async () => {
    const waits: number[] = [];
    const { impl } = fakeFetch([json({}, 500), json({}, 500), json({ ok: true })]);

    await requestJson("https://api.exemplo/x", {
      fetchImpl: impl,
      sleepImpl: async (ms) => {
        waits.push(ms);
      },
      backoffMs: 100,
    });

    expect(waits).toHaveLength(2);
    expect(waits[0]).toBeGreaterThanOrEqual(100);
    expect(waits[1]).toBeGreaterThanOrEqual(200);
    expect(waits[1]).toBeGreaterThan(waits[0]);
  });

  it("carrega status e trecho do corpo no erro, para diagnóstico", async () => {
    const { impl } = fakeFetch([json({ message: "token inválido" }, 403)]);

    await expect(
      requestJson("https://api.exemplo/x", { fetchImpl: impl, sleepImpl: noSleep }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("isRetryable", () => {
  it("repete o que pode dar certo numa segunda chamada", () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(408)).toBe(true);
  });

  it("não repete erro de cliente", () => {
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(403)).toBe(false);
    expect(isRetryable(404)).toBe(false);
  });
});

describe("safeUrl", () => {
  it("tira a query string, que é onde token costuma viajar", () => {
    expect(safeUrl("https://brapi.dev/api/quote/PETR4?token=SEGREDO")).toBe(
      "https://brapi.dev/api/quote/PETR4",
    );
  });

  it("lida com string que não é URL válida", () => {
    expect(safeUrl("não-é-url?token=x")).toBe("não-é-url");
  });
});

describe("RateLimiter", () => {
  it("deixa passar dentro do limite sem esperar", async () => {
    const now = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter(
      3,
      1000,
      () => now,
      async (ms) => {
        waits.push(ms);
      },
    );

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(waits).toHaveLength(0);
  });

  it("segura a quarta chamada até a janela abrir", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter(
      3,
      1000,
      () => now,
      async (ms) => {
        waits.push(ms);
        now += ms;
      },
    );

    await limiter.acquire();
    now += 100;
    await limiter.acquire();
    now += 100;
    await limiter.acquire();
    now += 100;
    await limiter.acquire();

    expect(waits).toHaveLength(1);
    expect(waits[0]).toBe(700);
  });

  it("libera de novo depois que a janela passa", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter(
      2,
      1000,
      () => now,
      async (ms) => {
        waits.push(ms);
      },
    );

    await limiter.acquire();
    await limiter.acquire();
    now += 1500;
    await limiter.acquire();

    expect(waits).toHaveLength(0);
  });
});
