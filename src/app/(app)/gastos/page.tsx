import { repo } from "@/lib/repo";
import { currentMonth, getExpenseSummary } from "@/lib/queries";
import { brl, date, monthName, percent } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Gastos" };

const STATUS: Record<
  string,
  { label: string; tone: "positive" | "warning" | "negative" | "neutral" }
> = {
  ok: { label: "Dentro do orçamento", tone: "positive" },
  atencao: { label: "Perto do limite", tone: "warning" },
  estourado: { label: "Estourado", tone: "negative" },
  sem_orcamento: { label: "Sem orçamento", tone: "neutral" },
};

export default async function GastosPage() {
  const month = currentMonth();
  const [summary, entries, categories] = await Promise.all([
    getExpenseSummary(month),
    repo.getExpenseEntries(month),
    repo.getExpenseCategories(),
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const movements = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const budgeted = summary.categories.filter((c) => c.budget !== null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gastos"
        description={`Entradas e saídas de ${monthName(month).toLowerCase()}, por categoria, contra o orçamento definido.`}
      />

      <Card>
        <CardBody className="grid gap-6 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Renda" value={brl(summary.income)} />
          <Stat label="Gastos" value={brl(summary.expenses)} />
          <Stat
            label="Saldo"
            value={brl(summary.balance)}
            hint={summary.balance >= 0 ? "disponível para aporte" : "mês no vermelho"}
          />
          <Stat
            label="Taxa de poupança"
            value={percent(summary.savingsRate, 0)}
            hint="da renda do mês"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Orçamento por categoria"
          description="A barra passa de 100% quando o teto estoura — o excesso precisa aparecer, não ser cortado."
        />
        <CardBody>
          {budgeted.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {budgeted.map((item) => {
                const status = STATUS[item.status];
                return (
                  <li key={item.category.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="flex items-center gap-2 text-[14px] font-medium">
                        {item.category.name}
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </span>
                      <span className="tabular text-muted text-[13px]">
                        <span className="text-content font-medium">{brl(item.spent)}</span> de{" "}
                        {brl(item.budget ?? 0)}
                        {item.usage !== null ? (
                          <span className="text-faint ml-2">{percent(item.usage, 0)}</span>
                        ) : null}
                      </span>
                    </div>
                    <Progress
                      value={item.usage ?? 0}
                      label={`Uso do orçamento de ${item.category.name}`}
                      tone={
                        item.status === "estourado"
                          ? "negative"
                          : item.status === "atencao"
                            ? "warning"
                            : "positive"
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Nenhum orçamento definido"
              description="Defina um teto mensal por categoria nas configurações para receber alerta de estouro."
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Lançamentos do mês" description="Entrada em verde, saída em vermelho." />
        <CardBody>
          {movements.length > 0 ? (
            <Table className="min-w-[520px]">
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Descrição</Th>
                  <Th>Categoria</Th>
                  <Th>Origem</Th>
                  <Th align="right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {movements.map((entry) => (
                  <Tr key={entry.id}>
                    <Td>{date(entry.date)}</Td>
                    <Td>{entry.description}</Td>
                    <Td>
                      <span className="text-muted text-[13px]">
                        {categoryName.get(entry.categoryId) ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-faint text-[13px]">
                        {entry.source === "pluggy" ? "Open Finance" : "Manual"}
                      </span>
                    </Td>
                    <Td align="right">
                      <span
                        className={entry.amount >= 0 ? "text-positive font-medium" : "text-content"}
                      >
                        {entry.amount >= 0 ? "+" : "−"}
                        {brl(Math.abs(entry.amount))}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Nenhum lançamento neste mês" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
