import Link from "next/link";
import { repo } from "@/lib/repo";
import { getPortfolio, getScores } from "@/lib/queries";
import { ASSET_CLASS_LABEL } from "@/types/domain";
import { date, money, percent } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Watchlist" };

/**
 * Ativos acompanhados sem posicao. Usa exatamente o mesmo motor de score da
 * carteira — a decisao de comprar e a de manter olham para o mesmo numero.
 */
export default async function WatchlistPage() {
  const [watchlist, assets, scores, portfolio] = await Promise.all([
    repo.getWatchlist(),
    repo.getAssets(),
    getScores(),
    getPortfolio(),
  ]);

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const priceById = new Map(
    portfolio.positions.map((p) => [p.asset.id, p.holding.lastPrice] as const),
  );

  const items = watchlist.flatMap((item) => {
    const asset = assetById.get(item.assetId);
    return asset ? [{ item, asset, score: scores.get(asset.id) }] : [];
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Watchlist"
        description="O que você está observando mas ainda não comprou, com preço-alvo de entrada e a tese registrada."
      />

      {items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(({ item, asset, score }) => {
            const currentPrice = priceById.get(asset.id) ?? null;
            const reached =
              currentPrice !== null &&
              item.targetPrice !== null &&
              currentPrice <= item.targetPrice;

            return (
              <Card key={asset.id} as="article">
                <CardHeader
                  title={
                    <Link href={`/ativos/${asset.slug}`} className="hover:text-accent">
                      {asset.symbol} <span className="text-muted font-normal">— {asset.name}</span>
                    </Link>
                  }
                  description={`${ASSET_CLASS_LABEL[asset.assetClass]} · acompanhado desde ${date(item.addedAt)}`}
                  action={<ScoreBadge result={score} />}
                />
                <CardBody className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.targetPrice !== null ? (
                      <Badge tone={reached ? "positive" : "neutral"}>
                        Alvo {money(item.targetPrice, asset.currency)}
                        {reached ? " · atingido" : ""}
                      </Badge>
                    ) : null}
                    {currentPrice !== null ? (
                      <span className="tabular text-muted text-[13px]">
                        Cotação atual {money(currentPrice, asset.currency)}
                        {item.targetPrice
                          ? ` · ${percent((currentPrice - item.targetPrice) / item.targetPrice, 1)} do alvo`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  {item.notes ? (
                    <p className="text-muted text-[14px] leading-relaxed">{item.notes}</p>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="Watchlist vazia"
            description="Adicione um ativo para acompanhar o score dele sem ter posição."
          />
        </Card>
      )}
    </div>
  );
}
