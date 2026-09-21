import { repo } from "@/lib/repo";
import { getPortfolio } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectionPanel } from "@/components/projecao/projection-panel";

export const metadata = { title: "Projeção" };

export default async function ProjecaoPage() {
  const [portfolio, market] = await Promise.all([getPortfolio(), repo.getMarketContext()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projeção de patrimônio"
        description="Onde o aporte recorrente leva a carteira em 1, 5 e 10 anos — e quanto disso é juro composto."
      />
      <ProjectionPanel
        initialAmount={portfolio.totalBrl}
        suggestedContribution={3500}
        cdi={market.cdi}
        ipca={market.ipca}
      />
    </div>
  );
}
