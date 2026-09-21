import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { repo } from "@/lib/repo";
import { getPortfolio, getScores } from "@/lib/queries";
import { ASSET_CLASS_LABEL } from "@/types/domain";
import { brl, date, money, percent, quantity, signedBrl } from "@/lib/format";
import { equivalentAnnualRate } from "@/lib/scoring";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Variation } from "@/components/ui/variation";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { ButtonLink } from "@/components/ui/button";
import { PriceChart } from "@/components/charts/price-chart";
import { ScoreDetail } from "@/components/analise/score-detail";
import { TransactionForm } from "@/components/carteira/transaction-form";
import { TRANSACTION_LABEL } from "@/components/investimentos/transaction-label";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const asset = await repo.getAsset(slug);
  return { title: asset ? `${asset.symbol} — ${asset.name}` : "Ativo" };
}

export default async function AtivoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const asset = await repo.getAsset(slug);
  if (!asset) notFound();

  const [portfolio, scores, priceHistory, transactions, journal, market, fixedIncome, agro] =
    await Promise.all([
      getPortfolio(),
      getScores(),
      repo.getPriceHistory(asset.id),
      repo.getTransactions({ assetId: asset.id }),
      repo.getJournalEntries(asset.id),
      repo.getMarketContext(),
      repo.getFixedIncomeTerms(),
      repo.getAgroPositions(),
    ]);

  const position = portfolio.positions.find((p) => p.asset.id === asset.id);
  const score = scores.get(asset.id);
  const terms = fixedIncome.find((t) => t.assetId === asset.id);
  const agroPosition = agro.find((a) => a.assetId === asset.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/investimentos"
          className="text-muted hover:text-content mb-3 inline-flex items-center gap-1.5 text-[13px]"
        >
          <ArrowLeft aria-hidden className="size-4" /> Investimentos
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[30px] leading-tight font-semibold tracking-tight">
                {asset.symbol}
              </h1>
              <Badge>{ASSET_CLASS_LABEL[asset.assetClass]}</Badge>
              {asset.sector ? <Badge>{asset.sector}</Badge> : null}
            </div>
            <p className="text-muted mt-1 text-[15px]">{asset.name}</p>
          </div>

          {position ? (
            <div className="flex items-end gap-4">
              <div className="text-right">
                <p className="tabular text-[26px] leading-tight font-semibold">
                  {money(position.holding.lastPrice, asset.currency)}
                </p>
                <Variation value={position.holding.dayChange} size="sm" className="justify-end" />
              </div>
              <ButtonLink href={`/simulador?ativo=${asset.slug}`} variant="secondary">
                Simular venda
              </ButtonLink>
            </div>
          ) : (
            <ButtonLink href="/watchlist" variant="secondary">
              Ver na watchlist
            </ButtonLink>
          )}
        </div>
      </div>

      {position ? (
        <Card>
          <CardBody className="grid gap-6 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Posição"
              value={brl(position.marketValueBrl)}
              hint={`${percent(position.share, 1)} da carteira`}
            />
            <Stat
              label="Quantidade"
              value={quantity(position.holding.quantity)}
              hint={`preço médio ${money(position.holding.averagePrice, asset.currency)}`}
            />
            <Stat
              label="Resultado"
              value={signedBrl(position.profitBrl)}
              trailing={<Variation value={position.profitPercent} size="sm" />}
            />
            <Stat
              label="Custo total"
              value={brl(position.costBrl)}
              hint={asset.currency === "USD" ? `convertido a ${brl(market.usdBrl)}/US$` : undefined}
            />
          </CardBody>
        </Card>
      ) : null}

      {priceHistory.length > 0 ? (
        <Card>
          <CardHeader title="Cotação" description="Últimos 180 pregões." />
          <CardBody>
            <PriceChart data={priceHistory} currency={asset.currency} />
          </CardBody>
        </Card>
      ) : null}

      {terms ? (
        <Card>
          <CardHeader title="Condições do título" />
          <CardBody className="grid gap-6 sm:grid-cols-4">
            <Stat
              label="Remuneração"
              value={
                terms.indexer === "prefixado"
                  ? percent(terms.contractedRate)
                  : terms.indexer === "ipca"
                    ? `IPCA + ${percent(terms.spread ?? 0)}`
                    : `${percent(terms.contractedRate, 0)} do CDI`
              }
              hint={`${percent(equivalentAnnualRate(terms, market))} a.a. equivalente`}
            />
            <Stat label="Vencimento" value={date(terms.maturityDate)} hint={terms.issuer} />
            <Stat
              label="Rating"
              value={terms.issuerRating ?? "—"}
              hint={terms.fgcCovered ? "coberto pelo FGC" : "sem FGC"}
            />
            <Stat
              label="Tributação"
              value={terms.isTaxExempt ? "Isento" : "Tabela regressiva"}
              hint={terms.isTaxExempt ? "LCI, LCA, CRI, CRA ou debênture" : "22,5% a 15% por prazo"}
            />
          </CardBody>
        </Card>
      ) : null}

      {agroPosition ? (
        <Card>
          <CardHeader
            title="Ciclo do investimento"
            description="Aporte e apuração lançados manualmente."
          />
          <CardBody className="grid gap-6 sm:grid-cols-4">
            <Stat label="Aportado" value={brl(agroPosition.contributed)} />
            <Stat
              label="Valor apurado"
              value={brl(agroPosition.currentValue)}
              trailing={
                <Variation
                  value={
                    (agroPosition.currentValue - agroPosition.contributed) /
                    agroPosition.contributed
                  }
                  size="sm"
                />
              }
            />
            <Stat label="Início do ciclo" value={date(agroPosition.cycleStart)} />
            <Stat
              label="Apuração prevista"
              value={agroPosition.expectedSettlement ? date(agroPosition.expectedSettlement) : "—"}
            />
          </CardBody>
        </Card>
      ) : null}

      {score ? (
        <Card>
          <CardHeader
            title="Score do ativo"
            description="Abra cada dimensão para ver o critério que gerou a nota."
          />
          <CardBody>
            <ScoreDetail result={score} />
          </CardBody>
        </Card>
      ) : null}

      <TransactionForm
        assetId={asset.id}
        symbol={asset.symbol}
        assetClass={asset.assetClass}
        currentPrice={position?.holding.lastPrice ?? 0}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Movimentações"
            description="Compras, vendas e proventos deste ativo."
          />
          <CardBody>
            {transactions.length > 0 ? (
              <Table className="min-w-[420px]">
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Tipo</Th>
                    <Th align="right">Qtd.</Th>
                    <Th align="right">Preço</Th>
                    <Th align="right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <Tr key={transaction.id}>
                      <Td>{date(transaction.date)}</Td>
                      <Td>
                        <Badge
                          tone={
                            transaction.kind === "venda" || transaction.kind === "resgate"
                              ? "negative"
                              : transaction.kind === "dividendo" || transaction.kind === "juros"
                                ? "positive"
                                : "neutral"
                          }
                        >
                          {TRANSACTION_LABEL[transaction.kind]}
                        </Badge>
                      </Td>
                      <Td align="right">{quantity(transaction.quantity)}</Td>
                      <Td align="right">{money(transaction.unitPrice, asset.currency)}</Td>
                      <Td align="right">
                        {money(transaction.quantity * transaction.unitPrice, asset.currency)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="Nenhuma movimentação registrada" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Journal" description="Sua tese e as decisões sobre este ativo." />
          <CardBody>
            {journal.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {journal.map((entry) => (
                  <li key={entry.id} className="border-line border-b pb-4 last:border-0 last:pb-0">
                    <p className="text-faint text-[12px]">{date(entry.date)}</p>
                    <p className="mt-0.5 text-[15px] font-medium">{entry.title}</p>
                    <p className="text-muted mt-1 text-[14px] leading-relaxed">{entry.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Sem anotação para este ativo"
                description="O journal serve para registrar por que você comprou — e reler antes de vender no susto."
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
