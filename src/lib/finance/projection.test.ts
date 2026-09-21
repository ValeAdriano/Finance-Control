import { describe, expect, it } from "vitest";
import { projectWealth, projectionMilestones, toMonthlyRate } from "./projection";

describe("toMonthlyRate", () => {
  it("compõe a taxa anual em vez de dividir por 12", () => {
    const monthly = toMonthlyRate(0.12);
    expect(monthly).toBeCloseTo(0.009489, 5);
    expect((1 + monthly) ** 12 - 1).toBeCloseTo(0.12, 10);
  });
});

describe("projectWealth", () => {
  it("devolve um ponto por mês do horizonte", () => {
    const series = projectWealth({
      initialAmount: 0,
      monthlyContribution: 1000,
      annualReturn: 0.1,
      years: 5,
    });

    expect(series).toHaveLength(60);
    expect(series.at(-1)?.year).toBe(5);
  });

  it("separa aporte de rendimento", () => {
    const series = projectWealth({
      initialAmount: 10_000,
      monthlyContribution: 1000,
      annualReturn: 0.1,
      years: 10,
    });

    const last = series.at(-1)!;
    expect(last.contributed).toBe(10_000 + 1000 * 120);
    expect(last.earnings).toBeCloseTo(last.total - last.contributed, 2);
    expect(last.earnings).toBeGreaterThan(0);
  });

  it("sem rendimento, o total é a soma dos aportes", () => {
    const series = projectWealth({
      initialAmount: 1000,
      monthlyContribution: 100,
      annualReturn: 0,
      years: 1,
    });

    expect(series.at(-1)?.total).toBe(2200);
    expect(series.at(-1)?.earnings).toBe(0);
  });

  it("reajusta o aporte a cada 12 meses quando há crescimento configurado", () => {
    const comReajuste = projectWealth({
      initialAmount: 0,
      monthlyContribution: 1000,
      annualReturn: 0,
      years: 2,
      contributionGrowth: 0.1,
    });

    // 12 meses a 1000 + 12 meses a 1100.
    expect(comReajuste.at(-1)?.contributed).toBeCloseTo(12_000 + 13_200, 2);
  });

  it("desconta a inflação quando informada", () => {
    const series = projectWealth({
      initialAmount: 100_000,
      monthlyContribution: 0,
      annualReturn: 0.1,
      years: 10,
      annualInflation: 0.05,
    });

    const last = series.at(-1)!;
    expect(last.realTotal).not.toBeNull();
    expect(last.realTotal as number).toBeLessThan(last.total);
    // 10% nominal com 5% de inflação ≈ 4,76% real ao ano.
    expect(last.realTotal as number).toBeCloseTo(100_000 * (1.1 / 1.05) ** 10, 0);
  });

  it("deixa realTotal nulo quando não há inflação informada", () => {
    const series = projectWealth({
      initialAmount: 1000,
      monthlyContribution: 0,
      annualReturn: 0.1,
      years: 1,
    });

    expect(series.at(-1)?.realTotal).toBeNull();
  });
});

describe("projectionMilestones", () => {
  it("devolve os marcos pedidos mesmo além do horizonte informado", () => {
    const milestones = projectionMilestones({
      initialAmount: 0,
      monthlyContribution: 1000,
      annualReturn: 0.1,
      years: 1,
    });

    expect(milestones.map((m) => m.years)).toEqual([1, 5, 10]);
    expect(milestones[2].point.total).toBeGreaterThan(milestones[0].point.total);
  });
});
