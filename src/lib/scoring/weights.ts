/**
 * Pesos default do motor de score, conforme `docs/planejamento.md`.
 * Sao editaveis pelo usuario na tela de configuracoes; estes valores sao o
 * ponto de partida, nao uma constante do sistema.
 */

export interface StockWeights {
  qualityPrice: number;
  financialHealth: number;
  safety: number;
  income: number;
}

export const DEFAULT_STOCK_WEIGHTS: StockWeights = {
  qualityPrice: 0.3,
  financialHealth: 0.25,
  safety: 0.2,
  income: 0.25,
};

export interface FiiWeights {
  income: number;
  valuation: number;
  occupancy: number;
  liquidity: number;
  management: number;
}

export const DEFAULT_FII_WEIGHTS: FiiWeights = {
  income: 0.3,
  valuation: 0.2,
  occupancy: 0.2,
  liquidity: 0.15,
  management: 0.15,
};

export interface CryptoWeights {
  marketCap: number;
  liquidity: number;
  volatility: number;
}

export const DEFAULT_CRYPTO_WEIGHTS: CryptoWeights = {
  marketCap: 0.4,
  liquidity: 0.35,
  volatility: 0.25,
};

export interface FixedIncomeWeights {
  yield: number;
  term: number;
  issuerRisk: number;
}

export const DEFAULT_FIXED_INCOME_WEIGHTS: FixedIncomeWeights = {
  yield: 0.45,
  term: 0.2,
  issuerRisk: 0.35,
};

/**
 * Parametros de mercado que dinamizam os criterios. O piso de dividendo do
 * metodo Bazin e classicamente 6% a.a., mas fica defasado quando o CDI sobe —
 * por isso o piso tambem pode ser derivado do CDI corrente.
 */
export interface MarketContext {
  /** CDI anual como fracao (0.105 = 10,5% a.a.). */
  cdi: number;
  /** IPCA anual acumulado como fracao. */
  ipca: number;
  /** Cotacao USD/BRL, usada para consolidar a Binance em reais. */
  usdBrl: number;
}

export interface ScoringSettings {
  stock: StockWeights;
  fii: FiiWeights;
  crypto: CryptoWeights;
  fixedIncome: FixedIncomeWeights;
  /** Piso de dividend yield do Bazin, como fracao. */
  bazinYieldFloor: number;
  /**
   * Quando ligado, o piso do Bazin passa a ser `cdi * bazinCdiFactor`,
   * ignorando `bazinYieldFloor`.
   */
  bazinUseCdiSpread: boolean;
  bazinCdiFactor: number;
  /** Anos minimos de historico de pagamento exigidos por Bazin/Barsi. */
  minDividendYears: number;
  /** Setores considerados pereness pelo criterio de Barsi. */
  perennialSectors: string[];
}

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  stock: DEFAULT_STOCK_WEIGHTS,
  fii: DEFAULT_FII_WEIGHTS,
  crypto: DEFAULT_CRYPTO_WEIGHTS,
  fixedIncome: DEFAULT_FIXED_INCOME_WEIGHTS,
  bazinYieldFloor: 0.06,
  bazinUseCdiSpread: false,
  bazinCdiFactor: 0.7,
  minDividendYears: 5,
  perennialSectors: [
    "Energia Elétrica",
    "Saneamento",
    "Bancos",
    "Seguros",
    "Telecomunicações",
    "Gás",
  ],
};

/** Piso de dividendo efetivo, considerando a configuracao do usuario. */
export function effectiveYieldFloor(settings: ScoringSettings, market: MarketContext): number {
  return settings.bazinUseCdiSpread
    ? market.cdi * settings.bazinCdiFactor
    : settings.bazinYieldFloor;
}
