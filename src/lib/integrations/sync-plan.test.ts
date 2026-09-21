import { describe, expect, it } from "vitest";
import type { BrapiQuote } from "./brapi";
import type { PluggyTransaction } from "./pluggy";
import { planBinanceSync, planExpenseImport, planQuoteSync, type SyncableAsset } from "./sync-plan";

const TODAY = "2026-09-21";

function asset(overrides: Partial<SyncableAsset> & { id: string; symbol: string }): SyncableAsset {
  return { assetClass: "acao", currency: "BRL", ...overrides };
}

function quote(overrides: Partial<BrapiQuote> & { symbol: string }): BrapiQuote {
  return {
    regularMarketPrice: null,
    regularMarketChangePercent: null,
    regularMarketPreviousClose: null,
    shortName: null,
    longName: null,
    currency: null,
    marketCap: null,
    priceEarnings: null,
    earningsPerShare: null,
    ...overrides,
  };
}

describe("planQuoteSync", () => {
  it("gera linha de preço e atualização de posição por ativo cotado", () => {
    const plan = planQuoteSync(
      [asset({ id: "a1", symbol: "PETR4" })],
      new Map([
        [
          "PETR4",
          quote({ symbol: "PETR4", regularMarketPrice: 34.22, regularMarketChangePercent: -2.03 }),
        ],
      ]),
      TODAY,
    );

    expect(plan.priceRows).toEqual([{ assetId: "a1", date: TODAY, close: 34.22 }]);
    expect(plan.holdingUpdates[0].lastPrice).toBe(34.22);
    // Percentual inteiro da brapi vira fração no domínio.
    expect(plan.holdingUpdates[0].dayChange).toBeCloseTo(-0.0203, 9);
  });

  it("casa ticker sem depender de maiúscula", () => {
    const plan = planQuoteSync(
      [asset({ id: "a1", symbol: "petr4" })],
      new Map([["PETR4", quote({ symbol: "PETR4", regularMarketPrice: 34.22 })]]),
      TODAY,
    );

    expect(plan.priceRows).toHaveLength(1);
  });

  it("reporta ticker que a brapi não devolveu, em vez de sumir com ele", () => {
    const plan = planQuoteSync(
      [asset({ id: "a1", symbol: "PETR4" }), asset({ id: "a2", symbol: "FANTASMA11" })],
      new Map([["PETR4", quote({ symbol: "PETR4", regularMarketPrice: 34.22 })]]),
      TODAY,
    );

    expect(plan.missing).toEqual(["FANTASMA11"]);
    expect(plan.priceRows).toHaveLength(1);
  });

  it("não grava cotação sem preço: price_history é append-only e o erro ficaria lá", () => {
    const plan = planQuoteSync(
      [asset({ id: "a1", symbol: "PETR4" })],
      new Map([["PETR4", quote({ symbol: "PETR4", regularMarketPrice: null })]]),
      TODAY,
    );

    expect(plan.priceRows).toHaveLength(0);
    expect(plan.missing).toEqual(["PETR4"]);
  });

  it("trata variação ausente como zero, sem descartar a cotação", () => {
    const plan = planQuoteSync(
      [asset({ id: "a1", symbol: "PETR4" })],
      new Map([
        [
          "PETR4",
          quote({ symbol: "PETR4", regularMarketPrice: 34.22, regularMarketChangePercent: null }),
        ],
      ]),
      TODAY,
    );

    expect(plan.holdingUpdates[0].dayChange).toBe(0);
    expect(plan.priceRows).toHaveLength(1);
  });
});

describe("planBinanceSync", () => {
  const existing: SyncableAsset[] = [
    asset({ id: "btc", symbol: "BTC", assetClass: "cripto", currency: "USD" }),
    asset({ id: "eth", symbol: "ETH", assetClass: "cripto", currency: "USD" }),
  ];

  const prices = new Map([
    ["BTC", { price: 71450, changePercent: 0.0156 }],
    ["ETH", { price: 3420, changePercent: -0.021 }],
    ["SOL", { price: 128.6, changePercent: -0.031 }],
  ]);

  it("atualiza posição e cotação de moeda já conhecida", () => {
    const plan = planBinanceSync(existing, [{ asset: "BTC", quantity: 0.09 }], prices, TODAY);

    expect(plan.holdingUpdates).toEqual([
      { assetId: "btc", quantity: 0.09, lastPrice: 71450, dayChange: 0.0156 },
    ]);
    expect(plan.priceRows).toEqual([{ assetId: "btc", date: TODAY, close: 71450 }]);
  });

  it("propõe ativo novo para moeda que apareceu na conta", () => {
    const plan = planBinanceSync(existing, [{ asset: "SOL", quantity: 8 }], prices, TODAY);

    expect(plan.newAssets).toEqual([{ symbol: "SOL", name: "SOL", quantity: 8 }]);
  });

  it("zera posição de moeda que saiu do saldo, sem apagar o ativo", () => {
    // Apagar levaria junto transação, histórico de preço e custo médio — que é
    // exatamente o que o cálculo de IR precisa.
    const plan = planBinanceSync(existing, [{ asset: "BTC", quantity: 0.09 }], prices, TODAY);

    expect(plan.zeroed).toEqual(["eth"]);
  });

  it("ignora stablecoin atrelada ao dólar", () => {
    const plan = planBinanceSync(
      existing,
      [
        { asset: "USDT", quantity: 500 },
        { asset: "USDC", quantity: 100 },
        { asset: "BUSD", quantity: 50 },
      ],
      prices,
      TODAY,
    );

    expect(plan.newAssets).toHaveLength(0);
    expect(plan.unpriced).toHaveLength(0);
  });

  it("reporta moeda sem par em USDT, que não dá para avaliar", () => {
    const plan = planBinanceSync(existing, [{ asset: "XYZCOIN", quantity: 10 }], prices, TODAY);

    expect(plan.unpriced).toEqual(["XYZCOIN"]);
    expect(plan.newAssets).toHaveLength(0);
  });

  it("não confunde ativo de outra classe com cripto", () => {
    const misto = [...existing, asset({ id: "petr4", symbol: "PETR4" })];
    const plan = planBinanceSync(misto, [{ asset: "BTC", quantity: 1 }], prices, TODAY);

    expect(plan.zeroed).toEqual(["eth"]);
    expect(plan.zeroed).not.toContain("petr4");
  });
});

describe("planExpenseImport — idempotência", () => {
  const resolver = (category: string | null) => (category === "Food" ? "alimentacao" : null);

  function transaction(id: string, overrides: Partial<PluggyTransaction> = {}): PluggyTransaction {
    return {
      id,
      date: "2026-09-10T00:00:00.000Z",
      description: `Lançamento ${id}`,
      amount: -100,
      category: null,
      type: null,
      ...overrides,
    };
  }

  it("importa lançamento novo", () => {
    const plan = planExpenseImport(new Set(), [transaction("t1")], resolver);

    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toInsert[0].externalId).toBe("t1");
    expect(plan.toInsert[0].date).toBe("2026-09-10");
    expect(plan.skipped).toBe(0);
  });

  it("reimportar o mesmo extrato não duplica nada", () => {
    const transactions = [transaction("t1"), transaction("t2"), transaction("t3")];

    const first = planExpenseImport(new Set(), transactions, resolver);
    expect(first.toInsert).toHaveLength(3);

    // Segunda rodada com os mesmos ids já gravados.
    const second = planExpenseImport(
      new Set(first.toInsert.map((row) => row.externalId)),
      transactions,
      resolver,
    );

    expect(second.toInsert).toHaveLength(0);
    expect(second.skipped).toBe(3);
  });

  it("importa só o que é novo quando o extrato cresce", () => {
    const plan = planExpenseImport(
      new Set(["t1", "t2"]),
      [transaction("t1"), transaction("t2"), transaction("t3")],
      resolver,
    );

    expect(plan.toInsert.map((r) => r.externalId)).toEqual(["t3"]);
    expect(plan.skipped).toBe(2);
  });

  it("não deixa o lote conflitar consigo mesmo quando a API repete um id", () => {
    const plan = planExpenseImport(new Set(), [transaction("t1"), transaction("t1")], resolver);

    expect(plan.toInsert).toHaveLength(1);
    expect(plan.skipped).toBe(1);
  });

  it("mapeia categoria conhecida e deixa nula a desconhecida", () => {
    const plan = planExpenseImport(
      new Set(),
      [transaction("t1", { category: "Food" }), transaction("t2", { category: "Outra" })],
      resolver,
    );

    expect(plan.toInsert[0].categoryId).toBe("alimentacao");
    expect(plan.toInsert[1].categoryId).toBeNull();
  });

  it("preserva o sinal: entrada positiva, saída negativa", () => {
    const plan = planExpenseImport(
      new Set(),
      [transaction("t1", { amount: 5000 }), transaction("t2", { amount: -250 })],
      resolver,
    );

    expect(plan.toInsert[0].amount).toBe(5000);
    expect(plan.toInsert[1].amount).toBe(-250);
  });
});
