/**
 * Projecao de patrimonio a partir do valor atual mais aportes recorrentes.
 * Juros compostos com aporte mensal, sem imposto no meio do caminho — a
 * interface deixa claro que e projecao bruta, nao promessa.
 */

export interface ProjectionInput {
  /** Patrimonio inicial em BRL. */
  initialAmount: number;
  /** Aporte mensal em BRL. */
  monthlyContribution: number;
  /** Retorno anual esperado como fracao (0.10 = 10% a.a.). */
  annualReturn: number;
  /** Horizonte em anos. */
  years: number;
  /** Crescimento anual do aporte, como fracao (reajuste do valor aportado). */
  contributionGrowth?: number;
  /** Quando informado, tambem devolve o valor descontado da inflacao. */
  annualInflation?: number;
}

export interface ProjectionPoint {
  month: number;
  year: number;
  /** Total acumulado em BRL nominais. */
  total: number;
  /** Soma dos aportes ate aqui, incluindo o valor inicial. */
  contributed: number;
  /** Quanto do total veio de rendimento. */
  earnings: number;
  /** Total em poder de compra de hoje, quando ha inflacao informada. */
  realTotal: number | null;
}

export function projectWealth(input: ProjectionInput): ProjectionPoint[] {
  const monthlyRate = toMonthlyRate(input.annualReturn);
  const monthlyInflation =
    input.annualInflation === undefined ? null : toMonthlyRate(input.annualInflation);
  const contributionGrowth = input.contributionGrowth ?? 0;

  const points: ProjectionPoint[] = [];
  let total = input.initialAmount;
  let contributed = input.initialAmount;
  let contribution = input.monthlyContribution;

  const months = Math.round(input.years * 12);

  for (let month = 1; month <= months; month++) {
    // Reajusta o aporte no aniversario de cada ano.
    if (month > 1 && (month - 1) % 12 === 0) {
      contribution *= 1 + contributionGrowth;
    }

    total = total * (1 + monthlyRate) + contribution;
    contributed += contribution;

    points.push({
      month,
      year: Math.ceil(month / 12),
      total: round2(total),
      contributed: round2(contributed),
      earnings: round2(total - contributed),
      realTotal: monthlyInflation === null ? null : round2(total / (1 + monthlyInflation) ** month),
    });
  }

  return points;
}

/** Resumo nos marcos que a interface mostra (1, 5 e 10 anos). */
export function projectionMilestones(
  input: ProjectionInput,
  milestones: number[] = [1, 5, 10],
): { years: number; point: ProjectionPoint }[] {
  const maxYears = Math.max(...milestones, input.years);
  const series = projectWealth({ ...input, years: maxYears });

  return milestones
    .map((years) => ({ years, point: series[years * 12 - 1] }))
    .filter((entry) => entry.point !== undefined);
}

/** Converte taxa anual em mensal equivalente (juro composto, nao divisao por 12). */
export function toMonthlyRate(annualRate: number): number {
  return (1 + annualRate) ** (1 / 12) - 1;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
