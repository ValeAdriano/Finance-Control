import Link from "next/link";
import { repo } from "@/lib/repo";
import { getPortfolio, getScores } from "@/lib/queries";
import { ASSET_CLASS_LABEL, type AssetClass } from "@/types/domain";
import { brl, percent } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ScoreBadge } from "@/components/ui/score-badge";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Análise de ativos" };

/**
 * Ranking por score. Inclui ativo da watchlist, que ainda nao esta na carteira:
 * o mesmo motor avalia o que voce tem e o que voce esta pensando em comprar.
 */
export default async function AnalisePage() {
  const [assets, scores, portfolio, watchlist, settings] = await Promise.all([
    repo.getAssets(),
    getScores(),
    getPortfolio(),
    repo.getWatchlist(),
    repo.getScoringSettings(),
  ]);

  const owned = new Map(portfolio.positions.map((p) => [p.asset.id, p]));
  const watched = new Set(watchlist.map((w) => w.assetId));

  const rows = assets
    .map((asset) => ({ asset, score: scores.get(asset.id), position: owned.get(asset.id) }))
    .filter((row) => row.score !== undefined)
    .sort((a, b) => (b.score?.score ?? -1) - (a.score?.score ?? -1));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Análise de ativos"
        description="Score determinístico por metodologia consolidada — sem IA no cálculo. Clique no ativo para ver critério por critério."
      />

      <Card>
        <CardHeader
          title="Como o score é montado"
          description="Os pesos são configuráveis na tela de configurações."
        />
        <CardBody className="text-muted grid gap-3 text-[13px] sm:grid-cols-2">
          <Methodology
            title={`Ações — ${percent(settings.stock.qualityPrice, 0)} / ${percent(settings.stock.financialHealth, 0)} / ${percent(settings.stock.safety, 0)} / ${percent(settings.stock.income, 0)}`}
            body="Magic Formula (Greenblatt), Piotroski F-Score, critérios defensivos de Graham e método Bazin com os critérios de Barsi."
          />
          <Methodology
            title="FIIs"
            body="DY consistente de 12 a 24 meses, P/VP, vacância, concentração de inquilinos, liquidez diária e taxa de administração."
          />
          <Methodology
            title="Cripto"
            body="Porte de mercado, liquidez e volatilidade. Mede risco relativo, não valor intrínseco — não existe framework fundamentalista equivalente ao de ações."
          />
          <Methodology
            title="Renda fixa"
            body="Taxa equivalente contra CDI e IPCA, prazo até o vencimento, rating do emissor e cobertura do FGC."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ranking" description="Do maior para o menor score." />
        <CardBody>
          <Table>
            <thead>
              <tr>
                <Th>Ativo</Th>
                <Th>Classe</Th>
                <Th>Situação</Th>
                <Th align="right">Posição</Th>
                <Th align="right">Score</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ asset, score, position }) => (
                <Tr key={asset.id}>
                  <Td>
                    <Link
                      href={`/ativos/${asset.symbol.toLowerCase()}`}
                      className="hover:text-accent flex flex-col"
                    >
                      <span className="font-medium">{asset.symbol}</span>
                      <span className="text-faint text-[12px]">{asset.name}</span>
                    </Link>
                  </Td>
                  <Td>
                    <span className="text-muted text-[13px]">
                      {ASSET_CLASS_LABEL[asset.assetClass as AssetClass]}
                    </span>
                  </Td>
                  <Td>
                    {position ? (
                      <Badge tone="accent">Na carteira</Badge>
                    ) : watched.has(asset.id) ? (
                      <Badge>Watchlist</Badge>
                    ) : (
                      <span className="text-faint text-[13px]">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    {position ? (
                      brl(position.marketValueBrl)
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end">
                      <ScoreBadge result={score} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

function Methodology({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-line rounded-[12px] border px-3 py-2.5">
      <p className="text-content text-[13px] font-medium">{title}</p>
      <p className="mt-0.5 leading-snug">{body}</p>
    </div>
  );
}
