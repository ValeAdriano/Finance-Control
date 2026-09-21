import { describe, expect, it, vi } from "vitest";
import { fetchQuotes, verifyToken } from "./brapi";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fakeFetch(response: Response) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url));
    return response;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe("fetchQuotes", () => {
  it("indexa por ticker em maiúscula", async () => {
    const { impl } = fakeFetch(
      json({
        results: [
          { symbol: "PETR4", regularMarketPrice: 34.22, regularMarketChangePercent: -2.03 },
          { symbol: "TAEE11", regularMarketPrice: 36.84, regularMarketChangePercent: 0.62 },
        ],
      }),
    );

    const quotes = await fetchQuotes(["petr4", "taee11"], { token: "t", fetchImpl: impl });

    expect(quotes.get("PETR4")?.regularMarketPrice).toBe(34.22);
    expect(quotes.size).toBe(2);
  });

  it("pede todos os tickers numa chamada só, para poupar cota", async () => {
    const { impl, calls } = fakeFetch(json({ results: [] }));
    await fetchQuotes(["PETR4", "VALE3", "ITSA4"], { token: "t", fetchImpl: impl });

    expect(impl).toHaveBeenCalledTimes(1);
    expect(calls[0]).toContain("PETR4,VALE3,ITSA4");
  });

  it("não chama a API quando não há ticker", async () => {
    const { impl } = fakeFetch(json({ results: [] }));
    expect((await fetchQuotes([], { token: "t", fetchImpl: impl })).size).toBe(0);
    expect(impl).not.toHaveBeenCalled();
  });

  it("omite ticker desconhecido em vez de inventar valor", async () => {
    const { impl } = fakeFetch(json({ results: [{ symbol: "PETR4", regularMarketPrice: 34.22 }] }));
    const quotes = await fetchQuotes(["PETR4", "NAOEXISTE11"], { token: "t", fetchImpl: impl });

    expect(quotes.has("PETR4")).toBe(true);
    expect(quotes.has("NAOEXISTE11")).toBe(false);
  });

  it("aceita resposta com campo faltando, virando null", async () => {
    const { impl } = fakeFetch(json({ results: [{ symbol: "PETR4" }] }));
    const quotes = await fetchQuotes(["PETR4"], { token: "t", fetchImpl: impl });

    expect(quotes.get("PETR4")?.regularMarketPrice).toBeNull();
  });

  it("rejeita resposta com formato inesperado em vez de propagar lixo", async () => {
    const { impl } = fakeFetch(json({ results: [{ symbol: 123 }] }));

    await expect(fetchQuotes(["PETR4"], { token: "t", fetchImpl: impl })).rejects.toThrow();
  });
});

describe("verifyToken", () => {
  it("aprova token que traz cotação", async () => {
    const { impl } = fakeFetch(json({ results: [{ symbol: "PETR4", regularMarketPrice: 34 }] }));
    const result = await verifyToken("token-bom", impl);

    expect(result.valid).toBe(true);
  });

  it("distingue token recusado de cota esgotada e de API fora do ar", async () => {
    expect((await verifyToken("x", fakeFetch(json({}, 401)).impl)).message).toContain("recusado");
    expect((await verifyToken("x", fakeFetch(json({}, 429)).impl)).message).toContain("Cota");
    expect((await verifyToken("x", fakeFetch(json({}, 500)).impl)).message).toContain(
      "Não foi possível",
    );
  });

  it("reprova token que responde vazio", async () => {
    const { impl } = fakeFetch(json({ results: [] }));
    const result = await verifyToken("token-fraco", impl);

    expect(result.valid).toBe(false);
  });
});
