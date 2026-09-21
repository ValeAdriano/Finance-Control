import { describe, expect, it } from "vitest";
import { applyTransaction, PositionError, rebuildPosition } from "./position";

const EMPTY = { quantity: 0, averagePrice: 0 };

describe("applyTransaction — compra", () => {
  it("primeira compra define quantidade e custo médio", () => {
    const result = applyTransaction(EMPTY, { kind: "compra", quantity: 100, unitPrice: 30 });

    expect(result.quantity).toBe(100);
    expect(result.averagePrice).toBe(30);
  });

  it("soma a taxa ao custo de aquisição", () => {
    const result = applyTransaction(EMPTY, {
      kind: "compra",
      quantity: 100,
      unitPrice: 30,
      fees: 10,
    });

    // 3.000 + 10 de taxa, divididos por 100 ações.
    expect(result.averagePrice).toBe(30.1);
  });

  it("recalcula a média ponderada na segunda compra", () => {
    const first = applyTransaction(EMPTY, { kind: "compra", quantity: 100, unitPrice: 20 });
    const second = applyTransaction(first, { kind: "compra", quantity: 100, unitPrice: 30 });

    expect(second.quantity).toBe(200);
    expect(second.averagePrice).toBe(25);
  });

  it("pondera pela quantidade, não pela média simples dos preços", () => {
    const first = applyTransaction(EMPTY, { kind: "compra", quantity: 900, unitPrice: 10 });
    const second = applyTransaction(first, { kind: "compra", quantity: 100, unitPrice: 20 });

    // Média simples daria 15; a ponderada é 11.
    expect(second.averagePrice).toBe(11);
  });

  it("aceita fração, que cripto exige", () => {
    const first = applyTransaction(EMPTY, { kind: "compra", quantity: 0.05, unitPrice: 200_000 });
    const second = applyTransaction(first, { kind: "compra", quantity: 0.05, unitPrice: 300_000 });

    expect(second.quantity).toBeCloseTo(0.1, 10);
    expect(second.averagePrice).toBeCloseTo(250_000, 6);
  });
});

describe("applyTransaction — venda", () => {
  const position = { quantity: 200, averagePrice: 25 };

  it("reduz a quantidade sem mexer no custo médio", () => {
    const result = applyTransaction(position, { kind: "venda", quantity: 50, unitPrice: 40 });

    expect(result.quantity).toBe(150);
    // A venda não altera o custo por unidade — é a regra da apuração.
    expect(result.averagePrice).toBe(25);
  });

  it("vender com prejuízo também não muda o custo médio", () => {
    const result = applyTransaction(position, { kind: "venda", quantity: 50, unitPrice: 10 });
    expect(result.averagePrice).toBe(25);
  });

  it("zera o custo médio quando a posição acaba", () => {
    const result = applyTransaction(position, { kind: "venda", quantity: 200, unitPrice: 40 });

    expect(result.quantity).toBe(0);
    // Manter o custo faria a próxima compra herdar um preço que não é base de nada.
    expect(result.averagePrice).toBe(0);
  });

  it("recusa vender mais do que existe", () => {
    expect(() =>
      applyTransaction(position, { kind: "venda", quantity: 201, unitPrice: 40 }),
    ).toThrow(PositionError);
  });

  it("tolera erro de ponto flutuante ao zerar posição fracionária", () => {
    const cripto = { quantity: 0.1, averagePrice: 250_000 };
    const result = applyTransaction(cripto, { kind: "venda", quantity: 0.1, unitPrice: 300_000 });

    expect(result.quantity).toBe(0);
  });
});

describe("applyTransaction — provento e taxa", () => {
  const position = { quantity: 100, averagePrice: 30 };

  it("dividendo não altera a posição", () => {
    expect(
      applyTransaction(position, { kind: "dividendo", quantity: 100, unitPrice: 1.2 }),
    ).toEqual(position);
  });

  it("juros e taxa também não alteram", () => {
    expect(applyTransaction(position, { kind: "juros", quantity: 1, unitPrice: 50 })).toEqual(
      position,
    );
    expect(applyTransaction(position, { kind: "taxa", quantity: 1, unitPrice: 5 })).toEqual(
      position,
    );
  });
});

describe("applyTransaction — validação", () => {
  it("recusa valor negativo", () => {
    expect(() => applyTransaction(EMPTY, { kind: "compra", quantity: -1, unitPrice: 10 })).toThrow(
      PositionError,
    );
    expect(() => applyTransaction(EMPTY, { kind: "compra", quantity: 1, unitPrice: -10 })).toThrow(
      PositionError,
    );
  });
});

describe("rebuildPosition", () => {
  it("reconstrói a posição a partir do histórico completo", () => {
    const state = rebuildPosition([
      { kind: "compra", quantity: 100, unitPrice: 20 },
      { kind: "compra", quantity: 100, unitPrice: 30 },
      { kind: "dividendo", quantity: 200, unitPrice: 0.5 },
      { kind: "venda", quantity: 50, unitPrice: 40 },
    ]);

    expect(state.quantity).toBe(150);
    expect(state.averagePrice).toBe(25);
  });

  it("posição zerada e recomprada começa custo médio do zero", () => {
    const state = rebuildPosition([
      { kind: "compra", quantity: 100, unitPrice: 20 },
      { kind: "venda", quantity: 100, unitPrice: 50 },
      { kind: "compra", quantity: 10, unitPrice: 60 },
    ]);

    expect(state.quantity).toBe(10);
    expect(state.averagePrice).toBe(60);
  });

  it("histórico vazio é posição zerada", () => {
    expect(rebuildPosition([])).toEqual(EMPTY);
  });
});
