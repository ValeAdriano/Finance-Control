import { describe, expect, it, vi } from "vitest";
import {
  buildSignedQuery,
  fetchBalances,
  fetchPrices,
  signQuery,
  verifyCredentials,
} from "./binance";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fakeFetch(response: Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe("signQuery", () => {
  /**
   * Vetor oficial da documentação da Binance. Se a assinatura mudar, toda
   * chamada autenticada passa a ser recusada — por isso o valor é fixado aqui.
   */
  it("bate com o exemplo da documentação da Binance", () => {
    const query =
      "symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559";
    const secret = "NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j";

    expect(signQuery(query, secret)).toBe(
      "c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71",
    );
  });

  it("muda a assinatura se o segredo muda", () => {
    expect(signQuery("a=1", "segredo1")).not.toBe(signQuery("a=1", "segredo2"));
  });
});

describe("buildSignedQuery", () => {
  it("inclui timestamp, recvWindow e assinatura", () => {
    const query = buildSignedQuery({}, "segredo", 1700000000000);

    expect(query).toContain("timestamp=1700000000000");
    expect(query).toContain("recvWindow=5000");
    expect(query).toMatch(/signature=[0-9a-f]{64}$/);
  });

  it("não expõe o segredo na query", () => {
    expect(buildSignedQuery({}, "meu-segredo-secreto", 1)).not.toContain("meu-segredo-secreto");
  });

  it("assina exatamente o que é enviado, na mesma ordem", () => {
    const query = buildSignedQuery({ symbol: "BTCUSDT" }, "s", 1000);
    const [payload, signature] = query.split("&signature=");

    expect(signature).toBe(signQuery(payload, "s"));
  });
});

describe("fetchBalances", () => {
  it("soma saldo livre com travado e descarta moeda zerada", async () => {
    const { impl } = fakeFetch(
      json({
        balances: [
          { asset: "BTC", free: "0.05", locked: "0.04" },
          { asset: "ETH", free: "1.0", locked: "0" },
          { asset: "XRP", free: "0", locked: "0" },
        ],
      }),
    );

    const balances = await fetchBalances({ apiKey: "k", apiSecret: "s" }, impl, 1);

    expect(balances).toEqual([
      { asset: "BTC", quantity: 0.09 },
      { asset: "ETH", quantity: 1 },
    ]);
  });

  it("manda a chave no header, nunca na query", async () => {
    const { impl, calls } = fakeFetch(json({ balances: [] }));
    await fetchBalances({ apiKey: "minha-chave", apiSecret: "s" }, impl, 1);

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["X-MBX-APIKEY"]).toBe("minha-chave");
    expect(calls[0].url).not.toContain("minha-chave");
  });
});

describe("fetchPrices", () => {
  it("converte percentual da Binance para fração do domínio", async () => {
    const { impl } = fakeFetch(
      json([
        { symbol: "BTCUSDT", lastPrice: "71450.10", priceChangePercent: "1.56" },
        { symbol: "ETHUSDT", lastPrice: "3420.00", priceChangePercent: "-2.10" },
      ]),
    );

    const prices = await fetchPrices(["btc", "eth"], impl);

    // Comparação aproximada: 1.56/100 não é exatamente 0,0156 em ponto
    // flutuante, e arredondar no cliente violaria a regra de só arredondar na
    // formatação.
    expect(prices.get("BTC")?.price).toBe(71450.1);
    expect(prices.get("BTC")?.changePercent).toBeCloseTo(0.0156, 9);
    expect(prices.get("ETH")?.changePercent).toBeCloseTo(-0.021, 9);
  });

  it("não chama a API quando não há símbolo", async () => {
    const { impl } = fakeFetch(json([]));
    expect((await fetchPrices([], impl)).size).toBe(0);
    expect(impl).not.toHaveBeenCalled();
  });
});

describe("verifyCredentials", () => {
  it("avisa quando a chave tem permissão além de leitura", async () => {
    const { impl } = fakeFetch(json({ canTrade: true, canWithdraw: false, balances: [] }));
    const result = await verifyCredentials({ apiKey: "k", apiSecret: "s" }, impl);

    expect(result.valid).toBe(true);
    expect(result.overPermissioned).toBe(true);
    expect(result.message).toContain("Enable Reading");
  });

  it("aprova chave somente leitura sem alarde", async () => {
    const { impl } = fakeFetch(json({ canTrade: false, canWithdraw: false, balances: [] }));
    const result = await verifyCredentials({ apiKey: "k", apiSecret: "s" }, impl);

    expect(result.valid).toBe(true);
    expect(result.overPermissioned).toBe(false);
  });

  it("distingue chave recusada de indisponibilidade", async () => {
    const recusada = await verifyCredentials(
      { apiKey: "k", apiSecret: "s" },
      fakeFetch(json({ msg: "invalid" }, 401)).impl,
    );
    expect(recusada.valid).toBe(false);
    expect(recusada.message).toContain("recusados");

    const limitada = await verifyCredentials(
      { apiKey: "k", apiSecret: "s" },
      fakeFetch(json({}, 418)).impl,
    );
    expect(limitada.message).toContain("limitou");
  });

  it("explica o erro de relógio adiantado, que é a causa comum do 400", async () => {
    const result = await verifyCredentials(
      { apiKey: "k", apiSecret: "s" },
      fakeFetch(json({ code: -1021 }, 400)).impl,
    );

    expect(result.message).toContain("relógio");
  });
});
