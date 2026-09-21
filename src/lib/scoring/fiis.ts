import type { FiiFundamentals } from "@/types/domain";
import type { Criterion, DimensionResult, ScoreResult } from "./types";
import { aggregate, binary, buildDimension, graded } from "./utils";
import { effectiveYieldFloor, type MarketContext, type ScoringSettings } from "./weights";

/**
 * Score de FII pelos criterios que analistas de fundo imobiliario usam no
 * Brasil: renda consistente, preco sobre valor patrimonial, ocupacao e
 * diversificacao de inquilino, liquidez diaria e qualidade da gestao.
 *
 * Diferente de acao, nao ha ranking comparativo aqui — cada fundo e avaliado
 * contra faixas absolutas —, entao a funcao pontua um ativo por vez.
 */
export function scoreFii(
  f: FiiFundamentals,
  settings: ScoringSettings,
  market: MarketContext,
): ScoreResult {
  return aggregate(
    f.assetId,
    "fii",
    [
      incomeDimension(f, settings, market),
      valuationDimension(f, settings),
      occupancyDimension(f, settings),
      liquidityDimension(f, settings),
      managementDimension(f, settings),
    ],
    f.referenceDate,
  );
}

export function scoreFiis(
  universe: FiiFundamentals[],
  settings: ScoringSettings,
  market: MarketContext,
): ScoreResult[] {
  return universe.map((f) => scoreFii(f, settings, market));
}

function incomeDimension(
  f: FiiFundamentals,
  settings: ScoringSettings,
  market: MarketContext,
): DimensionResult {
  const floor = effectiveYieldFloor(settings, market);

  const criteria: Criterion[] = [
    graded(
      "dy-12m",
      `DY 12 meses ≥ ${pct(floor)}`,
      f.dividendYield12m,
      floor * 0.5,
      floor * 1.5,
      "Rendimento distribuído nos últimos 12 meses",
    ),
    graded(
      "dy-24m",
      "DY 24 meses sustentado",
      f.dividendYield24m,
      floor * 0.5,
      floor * 1.5,
      "Confirma que o rendimento não foi evento isolado",
    ),
    graded(
      "dy-stability",
      "Rendimento pouco volátil",
      f.dividendVolatility,
      0.4,
      0.05,
      "Desvio padrão dos rendimentos mensais — quanto menor, mais previsível",
    ),
  ];

  return buildDimension(
    "income",
    "Renda",
    "DY consistente de 12 a 24 meses",
    settings.fii.income,
    criteria,
  );
}

function valuationDimension(f: FiiFundamentals, settings: ScoringSettings): DimensionResult {
  const criteria: Criterion[] = [
    graded(
      "pvp",
      "P/VP próximo ou abaixo de 1",
      f.priceToBook,
      1.6,
      0.85,
      "Acima de 1 é ágio sobre o patrimônio do fundo",
    ),
  ];

  return buildDimension(
    "valuation",
    "Preço",
    "P/VP sobre o valor patrimonial da cota",
    settings.fii.valuation,
    criteria,
  );
}

function occupancyDimension(f: FiiFundamentals, settings: ScoringSettings): DimensionResult {
  /** Fundo de papel e FOF nao tem imovel — vacancia nao se aplica. */
  const physicalFund = f.segment === "tijolo" || f.segment === "hibrido" || f.segment === null;

  const criteria: Criterion[] = [
    graded(
      "vacancy",
      "Vacância baixa",
      physicalFund ? f.vacancyRate : null,
      0.25,
      0.02,
      physicalFund
        ? "Percentual da área locável vaga"
        : "Não se aplica a fundo de papel — critério ignorado",
    ),
    graded(
      "tenant-count",
      "Diversificação de inquilinos",
      physicalFund ? f.tenantCount : null,
      1,
      20,
      "Quantos inquilinos sustentam a receita do fundo",
    ),
    graded(
      "tenant-concentration",
      "Sem dependência de um inquilino",
      physicalFund ? f.largestTenantShare : null,
      0.6,
      0.1,
      "Peso do maior inquilino na receita",
    ),
  ];

  return buildDimension(
    "occupancy",
    "Ocupação",
    "Vacância e concentração de inquilinos",
    settings.fii.occupancy,
    criteria,
  );
}

function liquidityDimension(f: FiiFundamentals, settings: ScoringSettings): DimensionResult {
  const criteria: Criterion[] = [
    graded(
      "daily-liquidity",
      "Liquidez diária",
      f.dailyLiquidity,
      100_000,
      3_000_000,
      "Volume médio negociado por dia — define se dá pra sair da posição",
    ),
  ];

  return buildDimension(
    "liquidity",
    "Liquidez",
    "Volume médio diário negociado",
    settings.fii.liquidity,
    criteria,
  );
}

function managementDimension(f: FiiFundamentals, settings: ScoringSettings): DimensionResult {
  const criteria: Criterion[] = [
    graded(
      "management-fee",
      "Taxa de administração baixa",
      f.managementFee,
      0.015,
      0.003,
      "Taxa cobrada sobre o patrimônio do fundo",
    ),
    binary(
      "segment",
      "Segmento definido",
      f.segment === null ? null : true,
      f.segment === null
        ? "Segmento não informado"
        : `Fundo de ${f.segment} — tijolo tende a ser mais previsível, papel mais sensível a juros`,
    ),
  ];

  return buildDimension(
    "management",
    "Gestão",
    "Taxa e clareza de mandato",
    settings.fii.management,
    criteria,
  );
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}
