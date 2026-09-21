import type { Asset, AssetClass, Holding } from "@/types/domain";
import { ASSET_CLASSES } from "@/types/domain";

/**
 * Consolidacao da carteira. Tudo que a interface mostra como "patrimonio" sai
 * daqui, sempre convertido para BRL na borda — o valor em USD da Binance nunca
 * e somado direto.
 */

export interface Position {
  asset: Asset;
  holding: Holding;
  /** Valor de mercado na moeda do ativo. */
  marketValue: number;
  /** Valor de mercado em BRL. */
  marketValueBrl: number;
  /** Custo total em BRL. */
  costBrl: number;
  /** Lucro/prejuizo nao realizado em BRL. */
  profitBrl: number;
  /** Lucro/prejuizo como fracao do custo. */
  profitPercent: number;
  /** Variacao do dia em BRL. */
  dayChangeBrl: number;
  /** Participacao na carteira, preenchida por `buildPortfolio`. */
  share: number;
}

export interface Portfolio {
  positions: Position[];
  totalBrl: number;
  totalCostBrl: number;
  profitBrl: number;
  profitPercent: number;
  dayChangeBrl: number;
  dayChangePercent: number;
  byClass: Record<AssetClass, number>;
}

export function buildPortfolio(assets: Asset[], holdings: Holding[], usdBrl: number): Portfolio {
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const positions: Position[] = holdings.flatMap((holding) => {
    const asset = assetById.get(holding.assetId);
    if (!asset) return [];

    const fx = asset.currency === "USD" ? usdBrl : 1;
    const marketValue = holding.quantity * holding.lastPrice;
    const marketValueBrl = marketValue * fx;
    const costBrl = holding.quantity * holding.averagePrice * fx;
    const profitBrl = marketValueBrl - costBrl;
    // A variacao do dia e sobre o valor de fechamento anterior, nao sobre o de hoje.
    const previousValueBrl = marketValueBrl / (1 + holding.dayChange);

    return [
      {
        asset,
        holding,
        marketValue,
        marketValueBrl,
        costBrl,
        profitBrl,
        profitPercent: costBrl === 0 ? 0 : profitBrl / costBrl,
        dayChangeBrl: marketValueBrl - previousValueBrl,
        share: 0,
      },
    ];
  });

  const totalBrl = sum(positions.map((p) => p.marketValueBrl));
  const totalCostBrl = sum(positions.map((p) => p.costBrl));
  const dayChangeBrl = sum(positions.map((p) => p.dayChangeBrl));
  const previousTotal = totalBrl - dayChangeBrl;

  for (const position of positions) {
    position.share = totalBrl === 0 ? 0 : position.marketValueBrl / totalBrl;
  }

  positions.sort((a, b) => b.marketValueBrl - a.marketValueBrl);

  return {
    positions,
    totalBrl,
    totalCostBrl,
    profitBrl: totalBrl - totalCostBrl,
    profitPercent: totalCostBrl === 0 ? 0 : (totalBrl - totalCostBrl) / totalCostBrl,
    dayChangeBrl,
    dayChangePercent: previousTotal === 0 ? 0 : dayChangeBrl / previousTotal,
    byClass: groupByClass(positions),
  };
}

export function groupByClass(positions: Position[]): Record<AssetClass, number> {
  const base = Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<AssetClass, number>;

  for (const position of positions) {
    base[position.asset.assetClass] += position.marketValueBrl;
  }

  return base;
}

export function positionsOfClass(portfolio: Portfolio, assetClass: AssetClass): Position[] {
  return portfolio.positions.filter((p) => p.asset.assetClass === assetClass);
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
