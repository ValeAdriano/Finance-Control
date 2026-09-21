import type { StockFundamentals } from "@/types/domain";
import type { Criterion, DimensionResult, ScoreResult } from "./types";
import {
  aggregate,
  binary,
  buildDimension,
  clamp,
  graded,
  percentileRank,
  scaleLinear,
} from "./utils";
import { effectiveYieldFloor, type MarketContext, type ScoringSettings } from "./weights";

/**
 * Score de acoes: media ponderada de 4 dimensoes, cada uma de uma metodologia
 * consolidada (ver `docs/planejamento.md`).
 *
 * A Magic Formula e comparativa — ela ranqueia a empresa contra as outras —,
 * entao o score de acoes e calculado para a lista inteira de uma vez, nunca
 * para um ativo isolado. Por isso a funcao publica recebe um array.
 */
export function scoreStocks(
  universe: StockFundamentals[],
  settings: ScoringSettings,
  market: MarketContext,
): ScoreResult[] {
  const roicRank = percentileRank(universe, (f) => f.roic);
  const yieldRank = percentileRank(universe, (f) => f.earningsYield);
  const ranked = universe.filter((f) => f.roic !== null).length >= MIN_RANK_UNIVERSE;

  return universe.map((f) =>
    aggregate(
      f.assetId,
      "acao",
      [
        magicFormulaDimension(
          f,
          roicRank.get(f) ?? null,
          yieldRank.get(f) ?? null,
          settings,
          ranked,
        ),
        piotroskiDimension(f, settings),
        grahamDimension(f, settings),
        bazinBarsiDimension(f, settings, market),
      ],
      f.referenceDate,
    ),
  );
}

/**
 * Tamanho minimo de universo para que o ranking relativo signifique alguma
 * coisa. Com menos que isso, o pior de tres ativos otimos receberia nota zero
 * so por ser o terceiro — entao caimos para a escala absoluta.
 */
export const MIN_RANK_UNIVERSE = 5;

/** Faixas absolutas usadas quando nao ha universo suficiente para ranquear. */
const ROIC_SCALE = { worst: 0, best: 0.25 } as const;
const EARNINGS_YIELD_SCALE = { worst: 0, best: 0.2 } as const;

/**
 * Magic Formula (Joel Greenblatt): soma do ranking de ROIC com o ranking de
 * earnings yield (EBIT/EV). Boa empresa (ROIC alto) por preco bom (EY alto).
 *
 * O metodo e comparativo, mas uma carteira pessoal costuma ter poucos ativos;
 * abaixo de `MIN_RANK_UNIVERSE` o ranking vira ruido, entao o criterio passa a
 * usar faixa absoluta. A interface mostra qual dos dois foi aplicado.
 */
function magicFormulaDimension(
  f: StockFundamentals,
  roicPercentile: number | null,
  yieldPercentile: number | null,
  settings: ScoringSettings,
  ranked: boolean,
): DimensionResult {
  const criteria: Criterion[] = [
    ranked
      ? {
          id: "roic",
          label: "ROIC (ranking)",
          score: roicPercentile,
          value: f.roic,
          detail:
            f.roic === null
              ? "Sem dado de ROIC"
              : `ROIC de ${pct(f.roic)} — posição ${pct(roicPercentile ?? 0)} entre os ativos analisados`,
        }
      : graded(
          "roic",
          "ROIC",
          f.roic,
          ROIC_SCALE.worst,
          ROIC_SCALE.best,
          "Retorno sobre o capital investido — universo pequeno demais para ranquear, avaliado em escala absoluta",
        ),
    ranked
      ? {
          id: "earnings-yield",
          label: "Earnings yield EBIT/EV (ranking)",
          score: yieldPercentile,
          value: f.earningsYield,
          detail:
            f.earningsYield === null
              ? "Sem dado de EBIT/EV"
              : `EBIT/EV de ${pct(f.earningsYield)} — posição ${pct(yieldPercentile ?? 0)} entre os ativos analisados`,
        }
      : graded(
          "earnings-yield",
          "Earnings yield EBIT/EV",
          f.earningsYield,
          EARNINGS_YIELD_SCALE.worst,
          EARNINGS_YIELD_SCALE.best,
          "EBIT sobre valor da firma — universo pequeno demais para ranquear, avaliado em escala absoluta",
        ),
  ];

  return buildDimension(
    "quality-price",
    "Qualidade x preço",
    "Magic Formula (Joel Greenblatt)",
    settings.stock.qualityPrice,
    criteria,
  );
}

/**
 * Piotroski F-Score: 9 criterios binarios de solidez contabil, agrupados em
 * rentabilidade, alavancagem/liquidez e eficiencia operacional.
 */
function piotroskiDimension(f: StockFundamentals, settings: ScoringSettings): DimensionResult {
  const criteria: Criterion[] = [
    binary(
      "net-income",
      "Lucro líquido positivo",
      positive(f.netIncome),
      "Empresa deu lucro no exercício",
    ),
    binary("roa", "ROA positivo", positive(f.roa), "Retorno sobre ativos acima de zero"),
    binary(
      "ocf",
      "Caixa operacional positivo",
      positive(f.operatingCashFlow),
      "O lucro virou caixa de verdade",
    ),
    binary(
      "accruals",
      "Caixa operacional > lucro",
      compare(f.operatingCashFlow, f.netIncome, "gt"),
      "Lucro sustentado por caixa, não por accruals contábeis",
    ),
    binary(
      "leverage",
      "Alavancagem de longo prazo caiu",
      compare(f.longTermDebtToAssetsPreviousYear, f.longTermDebtToAssets, "gt"),
      "Dívida de longo prazo sobre ativos menor que no ano anterior",
    ),
    binary(
      "liquidity",
      "Liquidez corrente subiu",
      compare(f.currentRatio, f.currentRatioPreviousYear, "gt"),
      "Capacidade de pagar o curto prazo melhorou",
    ),
    binary(
      "dilution",
      "Sem emissão de novas ações",
      f.issuedShares === null ? null : !f.issuedShares,
      "Não diluiu o acionista no período",
    ),
    binary(
      "gross-margin",
      "Margem bruta subiu",
      compare(f.grossMargin, f.grossMarginPreviousYear, "gt"),
      "Ganhou poder de precificação ou eficiência de custo",
    ),
    binary(
      "asset-turnover",
      "Giro do ativo subiu",
      compare(f.assetTurnover, f.assetTurnoverPreviousYear, "gt"),
      "Produz mais receita com o mesmo ativo",
    ),
  ];

  return buildDimension(
    "financial-health",
    "Saúde financeira",
    "Piotroski F-Score (0-9)",
    settings.stock.financialHealth,
    criteria,
  );
}

/** F-Score absoluto (0-9), usado na interface junto do percentual. */
export function piotroskiFScore(f: StockFundamentals, settings: ScoringSettings): number | null {
  const dimension = piotroskiDimension(f, settings);
  const answered = dimension.criteria.filter((c) => c.score !== null);
  if (answered.length === 0) return null;
  return answered.reduce((acc, c) => acc + (c.score as number), 0);
}

/**
 * Criterios defensivos de Benjamin Graham: liquidez corrente >= 2, divida de
 * longo prazo menor que o capital de giro, P/L moderado, P/VP ate ~1,5 e o
 * produto P/L x P/VP <= 22,5.
 */
function grahamDimension(f: StockFundamentals, settings: ScoringSettings): DimensionResult {
  const grahamProduct =
    f.priceToEarnings !== null &&
    f.priceToBook !== null &&
    f.priceToEarnings > 0 &&
    f.priceToBook > 0
      ? f.priceToEarnings * f.priceToBook
      : null;

  const criteria: Criterion[] = [
    graded(
      "current-ratio",
      "Liquidez corrente ≥ 2",
      f.currentRatio,
      1,
      2,
      "Ativo circulante cobre ao menos duas vezes o passivo circulante",
    ),
    binary(
      "debt-vs-working-capital",
      "Dívida LP < capital de giro",
      compare(f.workingCapital, f.longTermDebt, "gt"),
      "A dívida de longo prazo cabe dentro do capital de giro",
    ),
    graded(
      "pe",
      "P/L moderado (≤ 15)",
      f.priceToEarnings !== null && f.priceToEarnings <= 0 ? null : f.priceToEarnings,
      25,
      8,
      "Preço sobre lucro dentro da faixa defensiva",
    ),
    graded(
      "pb",
      "P/VP até ~1,5",
      f.priceToBook,
      3,
      1,
      "Preço sobre valor patrimonial dentro da faixa defensiva",
    ),
    graded(
      "graham-product",
      "P/L x P/VP ≤ 22,5",
      grahamProduct,
      45,
      15,
      "Produto de Graham — o teto clássico é 22,5",
    ),
  ];

  return buildDimension(
    "safety",
    "Segurança",
    "Critérios defensivos de Benjamin Graham",
    settings.stock.safety,
    criteria,
  );
}

/**
 * Bazin + Barsi: dividendo alto e, principalmente, *consistente*, em setor
 * perene e sem alavancagem que ameace o pagamento.
 */
function bazinBarsiDimension(
  f: StockFundamentals,
  settings: ScoringSettings,
  market: MarketContext,
): DimensionResult {
  const floor = effectiveYieldFloor(settings, market);
  const history = f.dividendYieldHistory;

  const consistency =
    history.length === 0
      ? null
      : clamp(history.filter((dy) => dy >= floor).length / history.length);

  const criteria: Criterion[] = [
    graded(
      "dividend-yield",
      `Dividend yield ≥ ${pct(floor)}`,
      f.dividendYield,
      floor * 0.5,
      floor * 1.5,
      `Piso ${settings.bazinUseCdiSpread ? "dinâmico sobre o CDI" : "fixo"} de ${pct(floor)} a.a.`,
    ),
    {
      id: "dividend-consistency",
      label: "Dividendo consistente no histórico",
      score: consistency,
      value: consistency,
      detail:
        history.length === 0
          ? "Sem histórico de dividendo"
          : `${history.filter((dy) => dy >= floor).length} de ${history.length} anos acima do piso`,
    },
    graded(
      "dividend-years",
      `${settings.minDividendYears} anos pagando dividendo`,
      f.yearsPayingDividends,
      0,
      settings.minDividendYears,
      "Histórico ininterrupto de pagamento",
    ),
    binary(
      "perennial-sector",
      "Setor perene",
      f.sector === null ? null : settings.perennialSectors.includes(f.sector),
      "Setor com demanda estável ao longo do ciclo (critério de Barsi)",
    ),
    graded(
      "net-debt",
      "Dívida líquida / EBITDA ≤ 3",
      f.netDebtToEbitda,
      5,
      1,
      "Endividamento que não ameaça o pagamento do dividendo",
    ),
  ];

  return buildDimension(
    "income",
    "Renda e consistência",
    "Método Bazin + critérios de Luiz Barsi",
    settings.stock.income,
    criteria,
  );
}

/* ---------------------------------- helpers -------------------------------- */

function positive(value: number | null): boolean | null {
  return value === null ? null : value > 0;
}

function compare(a: number | null, b: number | null, op: "gt"): boolean | null {
  if (a === null || b === null) return null;
  return op === "gt" ? a > b : a < b;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

/** Exportado para o grafico de radar da tela de detalhe. */
export function dimensionScores(result: ScoreResult): { label: string; score: number }[] {
  return result.dimensions
    .filter((d) => d.score !== null)
    .map((d) => ({ label: d.label, score: Math.round(d.score as number) }));
}

export { scaleLinear };
