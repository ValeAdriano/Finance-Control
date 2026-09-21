"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { StockFundamentals } from "@/types/domain";
import {
  DEFAULT_SCORING_SETTINGS,
  scoreStocks,
  type MarketContext,
  type StockWeights,
} from "@/lib/scoring";
import { decimal, percent } from "@/lib/format";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/field";
import { ScoreBadge } from "@/components/ui/score-badge";

const DIMENSIONS: { key: keyof StockWeights; label: string; methodology: string }[] = [
  { key: "qualityPrice", label: "Qualidade x preço", methodology: "Magic Formula (Greenblatt)" },
  { key: "financialHealth", label: "Saúde financeira", methodology: "Piotroski F-Score" },
  { key: "safety", label: "Segurança", methodology: "Critérios defensivos de Graham" },
  { key: "income", label: "Renda e consistência", methodology: "Bazin + Barsi" },
];

/**
 * Ajuste de pesos com efeito visivel na hora. O ranking abaixo recalcula a cada
 * mudanca usando o mesmo motor da tela de analise — e o que torna o peso uma
 * decisao informada em vez de um numero abstrato.
 *
 * A persistencia entra na Fase 2, junto com o Supabase; aqui o ajuste vale para
 * a sessao.
 */
export function WeightsPanel({
  fundamentals,
  names,
  market,
}: {
  fundamentals: StockFundamentals[];
  names: Record<string, string>;
  market: MarketContext;
}) {
  const [weights, setWeights] = useState<StockWeights>(DEFAULT_SCORING_SETTINGS.stock);
  const [useCdiSpread, setUseCdiSpread] = useState(DEFAULT_SCORING_SETTINGS.bazinUseCdiSpread);

  const total = Object.values(weights).reduce((acc, value) => acc + value, 0);

  const ranking = useMemo(() => {
    const results = scoreStocks(
      fundamentals,
      { ...DEFAULT_SCORING_SETTINGS, stock: weights, bazinUseCdiSpread: useCdiSpread },
      market,
    );
    return results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [fundamentals, weights, useCdiSpread, market]);

  const yieldFloor = useCdiSpread
    ? market.cdi * DEFAULT_SCORING_SETTINGS.bazinCdiFactor
    : DEFAULT_SCORING_SETTINGS.bazinYieldFloor;

  return (
    <Card>
      <CardHeader
        title="Pesos do score de ações"
        description="Cada dimensão vem de uma metodologia nomeada. Ajuste e veja o ranking mudar."
        action={
          <Button
            variant="ghost"
            onClick={() => {
              setWeights(DEFAULT_SCORING_SETTINGS.stock);
              setUseCdiSpread(DEFAULT_SCORING_SETTINGS.bazinUseCdiSpread);
            }}
          >
            <RotateCcw aria-hidden className="size-4" /> Restaurar padrão
          </Button>
        }
      />
      <CardBody className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          {DIMENSIONS.map((dimension) => (
            <div key={dimension.key} className="flex flex-col gap-1.5">
              <label className="flex items-baseline justify-between gap-3 text-[14px]">
                <span>
                  <span className="text-content font-medium">{dimension.label}</span>
                  <span className="text-faint ml-2 text-[12px]">{dimension.methodology}</span>
                </span>
                <span className="tabular text-content font-medium">
                  {percent(total === 0 ? 0 : weights[dimension.key] / total, 0)}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(weights[dimension.key] * 100)}
                onChange={(event) =>
                  setWeights((current) => ({
                    ...current,
                    [dimension.key]: Number(event.target.value) / 100,
                  }))
                }
                className="bg-sunken h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--accent)]"
                aria-label={`Peso de ${dimension.label}`}
              />
            </div>
          ))}
        </div>

        <Toggle
          label="Piso de dividendo acompanha o CDI"
          hint={`Piso atual: ${percent(yieldFloor, 1)} a.a. — o piso fixo de 6% do Bazin fica defasado quando o juro sobe`}
          checked={useCdiSpread}
          onChange={setUseCdiSpread}
        />

        <div>
          <p className="text-muted mb-2 text-[13px] font-medium">Ranking com estes pesos</p>
          <ul className="flex flex-col gap-1">
            {ranking.map((result, index) => (
              <li
                key={result.assetId}
                className="odd:bg-base/60 flex items-center justify-between gap-3 rounded-[10px] px-2.5 py-2"
              >
                <span className="flex items-center gap-2.5 text-[14px]">
                  <span className="tabular text-faint w-5 text-[12px]">{index + 1}</span>
                  <span className="font-medium">{names[result.assetId] ?? result.assetId}</span>
                </span>
                <ScoreBadge result={result} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
      <CardFooter>
        Soma dos pesos: {decimal(total * 100, 0)} — os valores são normalizados, então o que importa
        é a proporção entre eles. O ajuste vale para esta sessão; a persistência por usuário entra
        junto com o Supabase.
      </CardFooter>
    </Card>
  );
}
