import { describe, expect, it, vi } from "vitest";
import { authenticate, fetchAccounts, fetchTransactions, verifyCredentials } from "./pluggy";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function sequence(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return responses.shift() ?? json({ results: [], totalPages: 1 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe("authenticate", () => {
  it("troca client id e secret por um apiKey", async () => {
    const { impl, calls } = sequence([json({ apiKey: "chave-temporaria" })]);
    const apiKey = await authenticate({ clientId: "id", clientSecret: "secret" }, impl);

    expect(apiKey).toBe("chave-temporaria");
    expect(calls[0].init?.method).toBe("POST");
    // O segredo vai no corpo, nunca na URL — URL entra em log de servidor.
    expect(calls[0].url).not.toContain("secret");
  });
});

describe("fetchAccounts", () => {
  it("valida e devolve as contas do item", async () => {
    const { impl } = sequence([
      json({
        results: [
          { id: "a1", type: "BANK", name: "Conta corrente", balance: 1200.5, currencyCode: "BRL" },
        ],
      }),
    ]);

    const accounts = await fetchAccounts("k", "item-1", impl);
    expect(accounts[0].balance).toBe(1200.5);
  });
});

describe("fetchTransactions", () => {
  it("percorre todas as páginas, para não perder lançamento", async () => {
    const { impl, calls } = sequence([
      json({
        results: [{ id: "t1", date: "2026-09-01", description: "Mercado", amount: -100 }],
        totalPages: 3,
      }),
      json({
        results: [{ id: "t2", date: "2026-09-02", description: "Salário", amount: 5000 }],
        totalPages: 3,
      }),
      json({
        results: [{ id: "t3", date: "2026-09-03", description: "Luz", amount: -200 }],
        totalPages: 3,
      }),
    ]);

    const transactions = await fetchTransactions("k", "acc", "2026-09-01", impl);

    expect(transactions.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(calls).toHaveLength(3);
    expect(calls[2].url).toContain("page=3");
  });

  it("para quando a página volta vazia", async () => {
    const { impl, calls } = sequence([json({ results: [], totalPages: 10 })]);
    const transactions = await fetchTransactions("k", "acc", "2026-09-01", impl);

    expect(transactions).toHaveLength(0);
    expect(calls).toHaveLength(1);
  });

  it("repassa a data de corte, para não reimportar o extrato inteiro", async () => {
    const { impl, calls } = sequence([json({ results: [], totalPages: 1 })]);
    await fetchTransactions("k", "acc", "2026-08-15", impl);

    expect(calls[0].url).toContain("from=2026-08-15");
  });
});

describe("verifyCredentials", () => {
  it("aprova credencial que autentica", async () => {
    const { impl } = sequence([json({ apiKey: "k" })]);
    expect((await verifyCredentials({ clientId: "i", clientSecret: "s" }, impl)).valid).toBe(true);
  });

  it("distingue credencial recusada de indisponibilidade", async () => {
    const recusada = await verifyCredentials(
      { clientId: "i", clientSecret: "s" },
      sequence([json({}, 403)]).impl,
    );
    expect(recusada.message).toContain("recusados");

    const fora = await verifyCredentials(
      { clientId: "i", clientSecret: "s" },
      sequence([json({}, 500), json({}, 500), json({}, 500)]).impl,
    );
    expect(fora.message).toContain("Não foi possível");
  });
});
