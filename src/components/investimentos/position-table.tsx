import Link from "next/link";
import type { Position } from "@/lib/finance";
import type { ScoreResult } from "@/lib/scoring";
import { money, percent, quantity } from "@/lib/format";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Variation } from "@/components/ui/variation";
import { ScoreBadge } from "@/components/ui/score-badge";
import { brl } from "@/lib/format";

/**
 * Lista de posicoes. Tabela no desktop, cards no mobile — a mesma informacao
 * nas duas formas, porque esconder coluna no celular seria esconder dado.
 */
export function PositionTable({
  positions,
  scores,
  showScore = true,
}: {
  positions: Position[];
  scores?: Map<string, ScoreResult>;
  showScore?: boolean;
}) {
  return (
    <>
      <div className="hidden sm:block">
        <Table>
          <thead>
            <tr>
              <Th>Ativo</Th>
              <Th align="right">Quantidade</Th>
              <Th align="right">Preço médio</Th>
              <Th align="right">Cotação</Th>
              <Th align="right">Posição</Th>
              <Th align="right">Resultado</Th>
              <Th align="right">Dia</Th>
              {showScore ? <Th align="right">Score</Th> : null}
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <Tr key={position.asset.id}>
                <Td>
                  <Link
                    href={`/ativos/${position.asset.slug}`}
                    className="hover:text-accent flex flex-col"
                  >
                    <span className="font-medium">{position.asset.symbol}</span>
                    <span className="text-faint text-[12px]">{position.asset.name}</span>
                  </Link>
                </Td>
                <Td align="right">{quantity(position.holding.quantity)}</Td>
                <Td align="right">
                  {money(position.holding.averagePrice, position.asset.currency)}
                </Td>
                <Td align="right">{money(position.holding.lastPrice, position.asset.currency)}</Td>
                <Td align="right">
                  <span className="font-medium">{brl(position.marketValueBrl)}</span>
                  <span className="text-faint block text-[12px]">
                    {percent(position.share, 1)} da carteira
                  </span>
                </Td>
                <Td align="right">
                  <Variation value={position.profitBrl} kind="brl" size="sm" />
                  <span className="text-faint block text-[12px]">
                    {percent(position.profitPercent, 1)}
                  </span>
                </Td>
                <Td align="right">
                  <Variation value={position.holding.dayChange} size="sm" />
                </Td>
                {showScore ? (
                  <Td align="right">
                    <div className="flex justify-end">
                      <ScoreBadge result={scores?.get(position.asset.id)} size="sm" />
                    </div>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 sm:hidden">
        {positions.map((position) => (
          <li key={position.asset.id}>
            <Link
              href={`/ativos/${position.asset.slug}`}
              className="border-line bg-base/60 flex flex-col gap-2 rounded-[14px] border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">{position.asset.symbol}</p>
                  <p className="text-faint truncate text-[12px]">{position.asset.name}</p>
                </div>
                {showScore ? (
                  <ScoreBadge result={scores?.get(position.asset.id)} size="sm" />
                ) : null}
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="tabular text-[17px] font-semibold">
                    {brl(position.marketValueBrl)}
                  </p>
                  <p className="text-faint text-[12px]">
                    {quantity(position.holding.quantity)} ×{" "}
                    {money(position.holding.lastPrice, position.asset.currency)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <Variation value={position.holding.dayChange} size="sm" />
                  <Variation value={position.profitPercent} size="sm" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
