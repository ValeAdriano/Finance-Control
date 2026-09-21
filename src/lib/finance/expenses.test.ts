import { describe, expect, it } from "vitest";
import type { ExpenseCategory, ExpenseEntry } from "@/types/domain";
import { summarizeExpenses } from "./expenses";

const categories: ExpenseCategory[] = [
  { id: "moradia", name: "Moradia", monthlyBudget: 2000, color: "#000" },
  { id: "lazer", name: "Lazer", monthlyBudget: 500, color: "#111" },
  { id: "salario", name: "Salário", monthlyBudget: null, color: "#222" },
];

const entries: ExpenseEntry[] = [
  {
    id: "1",
    categoryId: "salario",
    date: "2026-09-05",
    description: "Salário",
    amount: 10_000,
    source: "manual",
  },
  {
    id: "2",
    categoryId: "moradia",
    date: "2026-09-10",
    description: "Aluguel",
    amount: -1800,
    source: "manual",
  },
  {
    id: "3",
    categoryId: "lazer",
    date: "2026-09-12",
    description: "Restaurante",
    amount: -600,
    source: "manual",
  },
  {
    id: "4",
    categoryId: "lazer",
    date: "2026-08-12",
    description: "Cinema",
    amount: -80,
    source: "manual",
  },
];

describe("summarizeExpenses", () => {
  it("separa entrada de saída e calcula o saldo do mês", () => {
    const summary = summarizeExpenses(categories, entries, "2026-09");

    expect(summary.income).toBe(10_000);
    expect(summary.expenses).toBe(2400);
    expect(summary.balance).toBe(7600);
    expect(summary.savingsRate).toBeCloseTo(0.76, 6);
  });

  it("marca categoria estourada e categoria em atenção", () => {
    const summary = summarizeExpenses(categories, entries, "2026-09");
    const category = (id: string) => summary.categories.find((c) => c.category.id === id)!;

    expect(category("lazer").status).toBe("estourado");
    expect(category("lazer").usage).toBeCloseTo(1.2, 6);
    expect(category("moradia").status).toBe("atencao");
    expect(category("salario").status).toBe("sem_orcamento");
    expect(category("salario").usage).toBeNull();
  });

  it("filtra pelo mês de referência", () => {
    const setembro = summarizeExpenses(categories, entries, "2026-09");
    const agosto = summarizeExpenses(categories, entries, "2026-08");

    expect(setembro.categories.find((c) => c.category.id === "lazer")?.spent).toBe(600);
    expect(agosto.categories.find((c) => c.category.id === "lazer")?.spent).toBe(80);
    expect(agosto.income).toBe(0);
  });

  it("ordena as categorias pelo maior gasto", () => {
    const summary = summarizeExpenses(categories, entries, "2026-09");
    expect(summary.categories[0].category.id).toBe("moradia");
  });

  it("não divide por zero quando não há renda no período", () => {
    const summary = summarizeExpenses(categories, [entries[1]], "2026-09");
    expect(summary.savingsRate).toBe(0);
  });
});
