import type { AssetClass, BenchmarkPoint, NetWorthPoint, PricePoint } from "@/types/domain";
import { ASSET_CLASSES } from "@/types/domain";
import { assets, holdings } from "./assets";
import { marketContext } from "./records";

/**
 * Series historicas mockadas. Geradas por PRNG com semente fixa em vez de
 * `Math.random`: o valor precisa ser o mesmo no servidor e no cliente, senao o
 * React acusa divergencia de hidratacao a cada render.
 *
 * As series sao construidas de tras pra frente, a partir da posicao atual, para
 * o historico terminar exatamente no patrimonio que a carteira tem hoje — um
 * grafico que nao fecha com o KPI ao lado destruiria a confianca na tela.
 */

/** mulberry32 — PRNG pequeno e deterministico. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REFERENCE = new Date("2026-09-21T00:00:00Z");
const MONTHLY_CONTRIBUTION = 3_500;
const MONTHS: number = 24;

function monthsBack(count: number): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(REFERENCE.getUTCFullYear(), REFERENCE.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

/** Valor atual por classe, em BRL — o ponto de chegada da serie. */
function currentByClass(): Record<AssetClass, number> {
  const base = Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Record<AssetClass, number>;

  for (const holding of holdings) {
    const asset = assets.find((a) => a.id === holding.assetId);
    if (!asset) continue;
    const fx = asset.currency === "USD" ? marketContext.usdBrl : 1;
    base[asset.assetClass] += holding.quantity * holding.lastPrice * fx;
  }

  return base;
}

/**
 * 24 meses de patrimonio. Cripto entra com peso menor no inicio e cresce ate o
 * peso de hoje: e a historia que a anotacao do journal conta ("cripto passou de
 * 10% para 14% so por valorizacao").
 */
export function buildNetWorthHistory(): NetWorthPoint[] {
  const random = rng(20260921);
  const months = monthsBack(MONTHS);
  const current = currentByClass();
  const total = Object.values(current).reduce((acc, value) => acc + value, 0);

  const currentWeights = Object.fromEntries(
    ASSET_CLASSES.map((c) => [c, total === 0 ? 0 : current[c] / total]),
  ) as Record<AssetClass, number>;

  // Peso no inicio da serie: cripto pesava menos, renda fixa pesava mais.
  const startWeights: Record<AssetClass, number> = {
    acao: currentWeights.acao * 1.04,
    fii: currentWeights.fii * 1.02,
    cripto: currentWeights.cripto * 0.68,
    renda_fixa: currentWeights.renda_fixa * 1.18,
    agro: currentWeights.agro * 0.9,
  };
  const startSum = Object.values(startWeights).reduce((acc, value) => acc + value, 0);

  // Caminha de tras pra frente: remove o aporte do mes e desfaz o rendimento.
  const totals: number[] = [total];
  const returns: number[] = [];
  for (let i = 1; i < MONTHS; i++) {
    const monthlyReturn = (random() - 0.38) * 0.03;
    returns.unshift(monthlyReturn);
    const previous = (totals[0] - MONTHLY_CONTRIBUTION) / (1 + monthlyReturn);
    totals.unshift(previous);
  }

  let contributed = totals[0] * 0.82;

  return months.map((month, index) => {
    if (index > 0) contributed += MONTHLY_CONTRIBUTION;
    const monthTotal = totals[index];
    const progress = MONTHS === 1 ? 1 : index / (MONTHS - 1);

    const byClass = Object.fromEntries(
      ASSET_CLASSES.map((assetClass) => {
        const start = startSum === 0 ? 0 : startWeights[assetClass] / startSum;
        const weight = start + (currentWeights[assetClass] - start) * progress;
        return [assetClass, round2(monthTotal * weight)];
      }),
    ) as Record<AssetClass, number>;

    return {
      date: `${month}-01`,
      total: round2(monthTotal),
      contributed: round2(contributed),
      byClass,
    };
  });
}

/**
 * Carteira contra CDI, IBOV e IPCA, em base 100. A linha da carteira nao e
 * inventada: sai do retorno mensal da serie de patrimonio, ja descontado o
 * aporte — senao o grafico mediria quanto foi depositado, nao rentabilidade.
 */
export function buildBenchmarks(): BenchmarkPoint[] {
  const random = rng(31415);
  const netWorth = buildNetWorthHistory();

  let cdi = 100;
  let ibov = 100;
  let ipca = 100;
  let carteira = 100;

  return netWorth.map((point, index) => {
    if (index > 0) {
      const previous = netWorth[index - 1];
      const contribution = point.contributed - previous.contributed;
      const portfolioReturn =
        previous.total === 0 ? 0 : (point.total - contribution) / previous.total - 1;

      cdi *= 1 + 0.0084;
      ipca *= 1 + 0.0037;
      ibov *= 1 + (random() - 0.44) * 0.06;
      carteira *= 1 + portfolioReturn;
    }

    return {
      date: point.date,
      cdi: round2(cdi),
      ibov: round2(ibov),
      ipca: round2(ipca),
      carteira: round2(carteira),
    };
  });
}

/** 180 pregoes de cotacao por ativo, terminando no preco atual da posicao. */
export function buildPriceHistory(days = 180): PricePoint[] {
  const points: PricePoint[] = [];

  for (const asset of assets) {
    // Renda fixa e agro nao tem cotacao diaria de mercado.
    if (asset.assetClass === "renda_fixa" || asset.assetClass === "agro") continue;

    const holding = holdings.find((h) => h.assetId === asset.id);
    if (!holding) continue;

    const random = rng(hash(asset.id));
    const volatility = asset.assetClass === "cripto" ? 0.032 : 0.014;

    const series: number[] = [holding.lastPrice];
    for (let i = 1; i < days; i++) {
      series.unshift(series[0] / (1 + (random() - 0.49) * volatility));
    }

    series.forEach((close, index) => {
      const d = new Date(REFERENCE);
      d.setUTCDate(d.getUTCDate() - (days - 1 - index));
      // Cripto negocia todo dia; bolsa não abre no fim de semana.
      const weekday = d.getUTCDay();
      if (asset.assetClass !== "cripto" && (weekday === 0 || weekday === 6)) return;

      points.push({ assetId: asset.id, date: d.toISOString().slice(0, 10), close: round2(close) });
    });
  }

  return points;
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
