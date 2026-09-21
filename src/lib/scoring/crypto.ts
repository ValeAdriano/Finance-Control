import type { CryptoMetrics } from "@/types/domain";
import type { ScoreResult } from "./types";
import { aggregate, buildDimension, graded } from "./utils";
import type { ScoringSettings } from "./weights";

/**
 * Cripto nao tem framework fundamentalista consolidado equivalente ao de acao.
 * O que da pra medir com honestidade e porte, liquidez e volatilidade — entao
 * o score aqui e explicitamente um score de *risco relativo*, nao de valor
 * intrinseco, e a interface precisa dizer isso.
 */
export function scoreCrypto(m: CryptoMetrics, settings: ScoringSettings): ScoreResult {
  return aggregate(
    m.assetId,
    "cripto",
    [
      buildDimension(
        "market-cap",
        "Porte de mercado",
        "Ranking por market cap",
        settings.crypto.marketCap,
        [
          graded(
            "rank",
            "Entre os maiores por market cap",
            m.marketCapRank,
            150,
            1,
            "Quanto melhor o ranking, menor o risco de ativo sem lastro de mercado",
          ),
          graded(
            "dominance",
            "Dominância de mercado",
            m.dominance,
            0,
            0.4,
            "Fatia do mercado cripto total",
          ),
        ],
      ),
      buildDimension(
        "liquidity",
        "Liquidez",
        "Volume negociado em 24h",
        settings.crypto.liquidity,
        [
          graded(
            "volume",
            "Volume diário em bolsa",
            m.volume24h,
            10_000_000,
            2_000_000_000,
            "Volume em USD nas últimas 24h",
          ),
        ],
      ),
      buildDimension(
        "volatility",
        "Volatilidade",
        "Desvio padrão anualizado do retorno",
        settings.crypto.volatility,
        [
          graded(
            "volatility",
            "Volatilidade contida",
            m.volatility,
            1.5,
            0.3,
            "Volatilidade anualizada — cripto é volátil por natureza, a escala reflete isso",
          ),
        ],
      ),
    ],
    m.referenceDate,
  );
}

export function scoreCryptos(universe: CryptoMetrics[], settings: ScoringSettings): ScoreResult[] {
  return universe.map((m) => scoreCrypto(m, settings));
}
