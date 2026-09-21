import Link from "next/link";
import { getPortfolio, getScores } from "@/lib/queries";
import { ASSET_CLASS_LABEL, ASSET_CLASSES, type AssetClass } from "@/types/domain";
import { brl, percent, signedBrl } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Variation } from "@/components/ui/variation";
import { EmptyState } from "@/components/ui/empty-state";
import { PositionTable } from "@/components/investimentos/position-table";

export const metadata = { title: "Investimentos" };

const TABS: { value: AssetClass | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  ...ASSET_CLASSES.map((assetClass) => ({
    value: assetClass,
    label: ASSET_CLASS_LABEL[assetClass],
  })),
];

export default async function InvestimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string }>;
}) {
  const { classe } = await searchParams;
  const active = TABS.some((tab) => tab.value === classe)
    ? (classe as AssetClass | "todos")
    : "todos";

  const [portfolio, scores] = await Promise.all([getPortfolio(), getScores()]);

  const positions =
    active === "todos"
      ? portfolio.positions
      : portfolio.positions.filter((p) => p.asset.assetClass === active);

  const total = positions.reduce((acc, p) => acc + p.marketValueBrl, 0);
  const cost = positions.reduce((acc, p) => acc + p.costBrl, 0);
  const dayChange = positions.reduce((acc, p) => acc + p.dayChangeBrl, 0);
  const previous = total - dayChange;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Investimentos"
        description="Toda a carteira, por classe de ativo. Clique num ativo para ver a análise completa."
      />

      <nav
        aria-label="Filtrar por classe"
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {TABS.map((tab) => {
          const isActive = tab.value === active;
          return (
            <Link
              key={tab.value}
              href={tab.value === "todos" ? "/investimentos" : `/investimentos?classe=${tab.value}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[14px] transition-colors",
                isActive
                  ? "bg-content text-base font-medium"
                  : "border-line text-muted hover:text-content border",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardBody className="grid gap-6 pt-5 sm:grid-cols-3">
          <Stat
            label={active === "todos" ? "Total investido" : ASSET_CLASS_LABEL[active]}
            value={brl(total)}
            hint={
              active === "todos"
                ? `${positions.length} ativos`
                : `${percent(portfolio.totalBrl === 0 ? 0 : total / portfolio.totalBrl, 1)} da carteira`
            }
          />
          <Stat
            label="Resultado"
            value={signedBrl(total - cost)}
            trailing={<Variation value={cost === 0 ? 0 : (total - cost) / cost} size="sm" />}
          />
          <Stat
            label="Variação do dia"
            value={signedBrl(dayChange)}
            trailing={<Variation value={previous === 0 ? 0 : dayChange / previous} size="sm" />}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={active === "todos" ? "Posições" : `Posições em ${ASSET_CLASS_LABEL[active]}`}
          description="Ordenadas da maior para a menor."
        />
        <CardBody>
          {positions.length > 0 ? (
            <PositionTable positions={positions} scores={scores} />
          ) : (
            <EmptyState
              title="Nenhuma posição nesta classe"
              description="Quando houver aporte nessa categoria, ele aparece aqui automaticamente."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
