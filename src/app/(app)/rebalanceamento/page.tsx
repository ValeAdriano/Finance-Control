import { getRebalance } from "@/lib/queries";
import { ASSET_CLASS_LABEL } from "@/types/domain";
import { brl, percent, signedBrl } from "@/lib/format";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Rebalanceamento" };

const MONTHLY_CONTRIBUTION = 3_500;

/**
 * Sugestao de rebalanceamento. Por padrao a correcao e por aporte, nao por
 * venda: vender gera IR e corretagem, comprar o que esta atrasado nao.
 */
export default async function RebalanceamentoPage() {
  const result = await getRebalance(MONTHLY_CONTRIBUTION);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rebalanceamento"
        description="Quanto cada classe desviou da meta e como o próximo aporte corrige isso sem precisar vender."
      />

      <Card>
        <CardHeader
          title="Distribuição do próximo aporte"
          description={`Simulando ${brl(MONTHLY_CONTRIBUTION)} distribuídos proporcionalmente ao déficit de cada classe.`}
        />
        <CardBody>
          <Table>
            <thead>
              <tr>
                <Th>Classe</Th>
                <Th align="right">Hoje</Th>
                <Th align="right">Atual</Th>
                <Th align="right">Meta</Th>
                <Th align="right">Desvio</Th>
                <Th align="right">Aportar</Th>
                <Th align="right">Situação</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <Tr key={row.assetClass}>
                  <Td>
                    <span className="font-medium">{ASSET_CLASS_LABEL[row.assetClass]}</span>
                  </Td>
                  <Td align="right">{brl(row.currentValue)}</Td>
                  <Td align="right">{percent(row.currentShare, 1)}</Td>
                  <Td align="right">
                    <span className="text-muted">{percent(row.targetShare, 1)}</span>
                  </Td>
                  <Td align="right">
                    <span
                      className={
                        row.status === "equilibrado"
                          ? "text-muted"
                          : row.drift > 0
                            ? "text-warning"
                            : "text-accent"
                      }
                    >
                      {row.drift > 0 ? "+" : "−"}
                      {percent(Math.abs(row.drift), 1)}
                    </span>
                  </Td>
                  <Td align="right">
                    {row.suggestedContribution > 0 ? (
                      <span className="font-medium">{brl(row.suggestedContribution)}</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end">
                      <Badge
                        tone={
                          row.status === "equilibrado"
                            ? "positive"
                            : row.status === "acima"
                              ? "warning"
                              : "accent"
                        }
                      >
                        {row.status === "equilibrado"
                          ? "Equilibrado"
                          : row.status === "acima"
                            ? "Acima da meta"
                            : "Abaixo da meta"}
                      </Badge>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
        <CardFooter>
          Patrimônio considerado: {brl(result.total)}. Maior desvio: {percent(result.maxDrift, 1)}.
          Classes dentro de 2 pontos percentuais da meta são tratadas como equilibradas —
          rebalancear ruído só gera custo.
        </CardFooter>
      </Card>

      <Card>
        <CardHeader
          title="Se quisesse corrigir vendendo"
          description="O valor que precisaria sair de cada classe acima da meta. Lembre que a venda pode gerar IR — confira antes no simulador."
        />
        <CardBody>
          <ul className="flex flex-col gap-2">
            {result.rows
              .filter((row) => row.deltaAmount < 0)
              .map((row) => (
                <li
                  key={row.assetClass}
                  className="border-line flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5"
                >
                  <span className="text-[14px]">{ASSET_CLASS_LABEL[row.assetClass]}</span>
                  <span className="tabular text-negative text-[14px] font-medium">
                    {signedBrl(row.deltaAmount)}
                  </span>
                </li>
              ))}
            {result.rows.every((row) => row.deltaAmount >= 0) ? (
              <li className="text-muted py-2 text-[14px]">
                Nenhuma classe está acima da meta — o aporte resolve sozinho.
              </li>
            ) : null}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
