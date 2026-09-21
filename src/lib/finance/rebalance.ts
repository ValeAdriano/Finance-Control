import type { AllocationTarget, AssetClass } from "@/types/domain";

/**
 * Compara a alocacao atual com a meta configurada e sugere o ajuste.
 *
 * A sugestao default e por *aporte* — comprar o que esta abaixo da meta em vez
 * de vender o que esta acima —, porque vender gera imposto e custo de corretagem.
 * Venda so aparece quando o desvio nao cabe no aporte disponivel.
 */

export interface RebalanceRow {
  assetClass: AssetClass;
  currentValue: number;
  /** Participacao atual como fracao. */
  currentShare: number;
  targetShare: number;
  /** Desvio em pontos percentuais (fracao): atual - meta. */
  drift: number;
  /** Quanto falta (positivo) ou sobra (negativo) em BRL para bater a meta. */
  deltaAmount: number;
  /** Quanto do aporte disponivel vai para essa classe. */
  suggestedContribution: number;
  status: "abaixo" | "acima" | "equilibrado";
}

export interface RebalanceResult {
  total: number;
  rows: RebalanceRow[];
  /** Maior desvio absoluto, usado para o alerta na home. */
  maxDrift: number;
  /**
   * Sobra do aporte depois de cobrir todos os deficits. Com metas somando 100%
   * e sempre zero — so aparece quando as metas configuradas nao cobrem a
   * carteira inteira, que e o caso que `targetsAreValid` barra na interface.
   */
  leftover: number;
}

export function rebalance(
  currentByClass: Record<AssetClass, number>,
  targets: AllocationTarget[],
  availableContribution = 0,
  /** Abaixo desse desvio a classe e considerada equilibrada. */
  tolerance = 0.02,
): RebalanceResult {
  const total = Object.values(currentByClass).reduce((acc, v) => acc + v, 0);
  const totalAfter = total + availableContribution;

  const rows: RebalanceRow[] = targets.map((target) => {
    const currentValue = currentByClass[target.assetClass] ?? 0;
    const currentShare = total === 0 ? 0 : currentValue / total;
    const drift = currentShare - target.target;
    const deltaAmount = totalAfter * target.target - currentValue;

    return {
      assetClass: target.assetClass,
      currentValue,
      currentShare,
      targetShare: target.target,
      drift,
      deltaAmount,
      suggestedContribution: 0,
      status: Math.abs(drift) <= tolerance ? "equilibrado" : drift > 0 ? "acima" : "abaixo",
    };
  });

  // Distribui o aporte proporcionalmente ao deficit de cada classe.
  const deficits = rows.filter((row) => row.deltaAmount > 0);
  const totalDeficit = deficits.reduce((acc, row) => acc + row.deltaAmount, 0);

  if (availableContribution > 0 && totalDeficit > 0) {
    for (const row of deficits) {
      const share = row.deltaAmount / totalDeficit;
      row.suggestedContribution = round2(Math.min(row.deltaAmount, availableContribution * share));
    }
  }

  const used = rows.reduce((acc, row) => acc + row.suggestedContribution, 0);

  return {
    total,
    rows,
    maxDrift: rows.reduce((acc, row) => Math.max(acc, Math.abs(row.drift)), 0),
    leftover: round2(Math.max(0, availableContribution - used)),
  };
}

/** As metas precisam somar 100% — a tela de configuracoes usa isso pra validar. */
export function targetsAreValid(targets: AllocationTarget[]): boolean {
  const sum = targets.reduce((acc, t) => acc + t.target, 0);
  return Math.abs(sum - 1) < 0.0001;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
