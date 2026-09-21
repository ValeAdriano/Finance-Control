import Link from "next/link";
import { AlertTriangle, ArrowRight, Wallet } from "lucide-react";
import { repo } from "@/lib/repo";
import {
  currentMonth,
  getClassBreakdown,
  getExpenseSummary,
  getPortfolio,
  getRebalance,
  getScores,
} from "@/lib/queries";
import { ASSET_CLASS_LABEL } from "@/types/domain";
import { brl, monthName, percent, signedBrl } from "@/lib/format";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Variation } from "@/components/ui/variation";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { BarList } from "@/components/charts/bar-list";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { PositionTable } from "@/components/investimentos/position-table";

export const metadata = { title: "Visão geral" };

/**
 * Home. Poucos KPIs e o que exige acao hoje; o detalhe de cada area fica na
 * tela da area — disclosure progressivo, como pede o planejamento.
 */
export default async function DashboardPage() {
  const month = currentMonth();

  const [portfolio, breakdown, netWorth, scores, rebalanceResult, expenses, institutions] =
    await Promise.all([
      getPortfolio(),
      getClassBreakdown(),
      repo.getNetWorthHistory(),
      getScores(),
      getRebalance(),
      getExpenseSummary(month),
      repo.getInstitutions(),
    ]);

  const alerts = buildAlerts({ rebalanceResult, expenses, institutions });
  const topPositions = portfolio.positions.slice(0, 5);
  const isEmpty = portfolio.positions.length === 0;

  if (isEmpty) return <EmptyDashboard />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visão geral"
        description="Onde está o seu dinheiro hoje e o que precisa de atenção."
      />

      <Card className="animate-fade-up">
        <CardBody className="grid gap-6 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Patrimônio total"
            value={brl(portfolio.totalBrl)}
            trailing={<Variation value={portfolio.dayChangePercent} size="sm" />}
            hint="no dia"
          />
          <Stat
            label="Resultado acumulado"
            value={signedBrl(portfolio.profitBrl)}
            trailing={<Variation value={portfolio.profitPercent} size="sm" />}
            hint="sobre o custo de aquisição"
          />
          <Stat
            label="Variação do dia"
            value={signedBrl(portfolio.dayChangeBrl)}
            hint={`${portfolio.positions.length} ativos na carteira`}
          />
          <Stat
            label={`Saldo de ${monthName(month).toLowerCase()}`}
            value={brl(expenses.balance)}
            hint={`${percent(expenses.savingsRate, 0)} da renda guardada`}
          />
        </CardBody>
      </Card>

      {alerts.length > 0 ? (
        <Card>
          <CardHeader
            title="Precisa de atenção"
            description="Só aparece aqui o que tem ação pendente."
          />
          <CardBody className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <Link
                key={alert.href + alert.title}
                href={alert.href}
                className="border-line hover:bg-sunken flex items-center gap-3 rounded-[12px] border px-3 py-2.5 transition-colors"
              >
                <AlertTriangle
                  aria-hidden
                  className={
                    alert.tone === "negative" ? "text-negative size-4" : "text-warning size-4"
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{alert.title}</span>
                  <span className="text-muted block text-[13px]">{alert.description}</span>
                </span>
                <ArrowRight aria-hidden className="text-faint size-4 shrink-0" />
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Evolução do patrimônio"
            description="Últimos 24 meses. A distância entre as duas linhas é o rendimento."
          />
          <CardBody>
            <NetWorthChart data={netWorth} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Alocação por classe"
            description="Comparada com a meta configurada."
            action={
              <Link href="/rebalanceamento" className="text-accent text-[13px] font-medium">
                Rebalancear
              </Link>
            }
          />
          <CardBody>
            <BarList
              items={breakdown.map((item, index) => ({
                label: ASSET_CLASS_LABEL[item.assetClass],
                value: item.value,
                formattedValue: brl(item.value, true),
                hint: `${percent(item.share, 0)} · meta ${percent(item.target, 0)}`,
                color: `var(--chart-${index + 1})`,
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Maiores posições"
          description="As cinco que mais pesam no patrimônio."
          action={
            <Link href="/investimentos" className="text-accent text-[13px] font-medium">
              Ver todas
            </Link>
          }
        />
        <CardBody>
          {topPositions.length > 0 ? (
            <PositionTable positions={topPositions} scores={scores} />
          ) : (
            <p className="text-muted flex items-center gap-2 py-8 text-[14px]">
              <Wallet aria-hidden className="size-4" /> Nenhuma posição registrada ainda.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Primeira tela de quem ainda não tem posição.
 *
 * Mostrar KPIs zerados e gráfico vazio faria a plataforma parecer quebrada
 * justamente no momento em que ela precisa explicar o que fazer a seguir.
 */
function EmptyDashboard() {
  const steps = [
    {
      title: "Cadastre as chaves das integrações",
      body: "Em Configurações: token da brapi para cotação de ações e FIIs, chave somente leitura da Binance para cripto, e Pluggy para o extrato bancário.",
    },
    {
      title: "Conecte seus bancos",
      body: "Pelo widget da Pluggy. A senha do banco vai direto para ela — não passa por aqui.",
    },
    {
      title: "Sincronize",
      body: "O botão fica na própria tela de Configurações. Depois disso o agendamento roda sozinho.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visão geral"
        description="Sua carteira está vazia. Três passos para ela começar a se preencher sozinha."
      />

      <Card>
        <CardBody className="flex flex-col gap-4 pt-6">
          <ol className="flex flex-col gap-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="tabular bg-accent-soft text-accent flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="text-content block text-[15px] font-medium">{step.title}</span>
                  <span className="text-muted mt-0.5 block text-[14px] leading-relaxed">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink href="/configuracoes" variant="primary">
              Abrir configurações
            </ButtonLink>
            <ButtonLink href="/projecao" variant="secondary">
              Simular uma projeção
            </ButtonLink>
          </div>
        </CardBody>
        <CardFooter>
          A sincronização traz cotação e saldo, mas não o preço médio de compra — ele vem das
          movimentações e é o que o cálculo de imposto usa. Para posição antiga, o caminho é a
          importação de nota de corretagem.
        </CardFooter>
      </Card>
    </div>
  );
}

interface Alert {
  title: string;
  description: string;
  href: string;
  tone: "warning" | "negative";
}

/**
 * Alerta so entra na home se houver algo a fazer. A home nunca lista "tudo
 * certo" — silêncio já é a informação de que está tudo certo.
 */
function buildAlerts({
  rebalanceResult,
  expenses,
  institutions,
}: {
  rebalanceResult: Awaited<ReturnType<typeof getRebalance>>;
  expenses: Awaited<ReturnType<typeof getExpenseSummary>>;
  institutions: Awaited<ReturnType<typeof repo.getInstitutions>>;
}): Alert[] {
  const alerts: Alert[] = [];

  const worst = [...rebalanceResult.rows].sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))[0];

  // Carteira vazia deixa toda classe "abaixo da meta". É verdade e é inútil:
  // o que falta ali é começar a investir, não rebalancear.
  if (rebalanceResult.total > 0 && worst && Math.abs(worst.drift) > 0.03) {
    alerts.push({
      title: `${ASSET_CLASS_LABEL[worst.assetClass]} está ${worst.drift > 0 ? "acima" : "abaixo"} da meta`,
      description: `${percent(Math.abs(worst.drift), 1)} de desvio. O próximo aporte pode corrigir sem precisar vender.`,
      href: "/rebalanceamento",
      tone: "warning",
    });
  }

  for (const category of expenses.categories.filter((c) => c.status === "estourado")) {
    alerts.push({
      title: `Orçamento de ${category.category.name} estourado`,
      description: `${brl(category.spent)} gastos contra ${brl(category.budget ?? 0)} planejados.`,
      href: "/gastos",
      tone: "negative",
    });
  }

  for (const institution of institutions.filter(
    (i) => i.status === "expirada" || i.status === "erro",
  )) {
    alerts.push({
      title: `Conexão com ${institution.name} ${institution.status === "erro" ? "com erro" : "expirada"}`,
      description: "Os lançamentos dessa instituição pararam de ser sincronizados.",
      href: "/configuracoes",
      tone: "negative",
    });
  }

  return alerts;
}
