import type { ExpenseCategory, ExpenseEntry } from "@/types/domain";

/** Consolidacao do controle de gastos: total por categoria contra o orcamento. */

export interface CategorySummary {
  category: ExpenseCategory;
  /** Total gasto no periodo (valor positivo). */
  spent: number;
  budget: number | null;
  /** Fracao do orcamento consumida. `null` quando nao ha teto. */
  usage: number | null;
  status: "ok" | "atencao" | "estourado" | "sem_orcamento";
}

export interface ExpenseSummary {
  income: number;
  expenses: number;
  balance: number;
  /** Fracao da renda que sobrou no periodo. */
  savingsRate: number;
  categories: CategorySummary[];
}

export function summarizeExpenses(
  categories: ExpenseCategory[],
  entries: ExpenseEntry[],
  /** Mes de referencia no formato `YYYY-MM`. Omitido, usa tudo. */
  month?: string,
): ExpenseSummary {
  const scoped = month ? entries.filter((e) => e.date.startsWith(month)) : entries;

  const income = sum(scoped.filter((e) => e.amount > 0).map((e) => e.amount));
  const expenses = Math.abs(sum(scoped.filter((e) => e.amount < 0).map((e) => e.amount)));

  const summaries: CategorySummary[] = categories.map((category) => {
    const spent = Math.abs(
      sum(scoped.filter((e) => e.categoryId === category.id && e.amount < 0).map((e) => e.amount)),
    );
    const budget = category.monthlyBudget;
    const usage = budget === null || budget === 0 ? null : spent / budget;

    return {
      category,
      spent,
      budget,
      usage,
      status:
        usage === null
          ? "sem_orcamento"
          : usage > 1
            ? "estourado"
            : usage >= 0.8
              ? "atencao"
              : "ok",
    };
  });

  summaries.sort((a, b) => b.spent - a.spent);

  return {
    income,
    expenses,
    balance: income - expenses,
    savingsRate: income === 0 ? 0 : (income - expenses) / income,
    categories: summaries,
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
