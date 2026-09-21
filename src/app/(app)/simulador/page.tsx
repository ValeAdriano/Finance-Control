import { getPortfolio } from "@/lib/queries";
import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui/page-header";
import { SaleSimulator, type SimulatorAsset } from "@/components/simulador/sale-simulator";

export const metadata = { title: "Simulador de venda" };

/**
 * O simulador trabalha em reais: posicao em dolar entra ja convertida, porque
 * a apuracao de IR no Brasil e em reais de qualquer forma.
 */
export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ ativo?: string }>;
}) {
  const [{ ativo }, portfolio, market] = await Promise.all([
    searchParams,
    getPortfolio(),
    repo.getMarketContext(),
  ]);

  const assets: SimulatorAsset[] = portfolio.positions.map((position) => {
    const fx = position.asset.currency === "USD" ? market.usdBrl : 1;
    return {
      id: position.asset.id,
      symbol: position.asset.symbol,
      name: position.asset.name,
      assetClass: position.asset.assetClass,
      quantity: position.holding.quantity,
      averagePriceBrl: round2(position.holding.averagePrice * fx),
      lastPriceBrl: round2(position.holding.lastPrice * fx),
    };
  });

  const initial = ativo
    ? assets.find((a) => a.symbol.toLowerCase() === ativo.toLowerCase())
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Simulador de venda"
        description="Quanto sai de imposto e quanto entra na conta, antes de confirmar a operação."
      />
      <SaleSimulator assets={assets} initialAssetId={initial?.id} />
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
