"use client";

import { useMemo, useState } from "react";
import { projectWealth, projectionMilestones } from "@/lib/finance";
import { brl, percent } from "@/lib/format";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Stat } from "@/components/ui/stat";
import { ProjectionChart } from "@/components/charts/projection-chart";

/**
 * Projecao de patrimonio. Tudo recalcula no cliente porque `projectWealth` e
 * funcao pura e barata — nao vale um round-trip de servidor por tecla digitada.
 */
export function ProjectionPanel({
  initialAmount,
  suggestedContribution,
  cdi,
  ipca,
}: {
  initialAmount: number;
  suggestedContribution: number;
  cdi: number;
  ipca: number;
}) {
  const [amount, setAmount] = useState(() => String(Math.round(initialAmount)));
  const [contribution, setContribution] = useState(() => String(suggestedContribution));
  const [annualReturn, setAnnualReturn] = useState(() => (cdi * 100).toFixed(1).replace(".", ","));
  const [growth, setGrowth] = useState("5");
  const [inflation, setInflation] = useState(() => (ipca * 100).toFixed(1).replace(".", ","));
  const [years, setYears] = useState("10");

  const input = useMemo(
    () => ({
      initialAmount: num(amount),
      monthlyContribution: num(contribution),
      annualReturn: num(annualReturn) / 100,
      contributionGrowth: num(growth) / 100,
      annualInflation: num(inflation) / 100,
      years: Math.max(1, Math.min(40, num(years))),
    }),
    [amount, contribution, annualReturn, growth, inflation, years],
  );

  const series = useMemo(() => projectWealth(input), [input]);
  const milestones = useMemo(() => projectionMilestones(input, [1, 5, 10]), [input]);

  const final = series.at(-1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Premissas" description="Mude qualquer valor para ver o efeito." />
          <CardBody className="grid grid-cols-2 gap-3">
            <Field label="Patrimônio hoje (R$)">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              )}
            </Field>
            <Field label="Aporte mensal (R$)">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                />
              )}
            </Field>
            <Field label="Retorno anual (%)" hint={`CDI atual: ${percent(cdi, 1)}`}>
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={annualReturn}
                  onChange={(e) => setAnnualReturn(e.target.value)}
                />
              )}
            </Field>
            <Field label="Reajuste do aporte (% a.a.)">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={growth}
                  onChange={(e) => setGrowth(e.target.value)}
                />
              )}
            </Field>
            <Field label="Inflação (% a.a.)" hint={`IPCA atual: ${percent(ipca, 1)}`}>
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={inflation}
                  onChange={(e) => setInflation(e.target.value)}
                />
              )}
            </Field>
            <Field label="Horizonte (anos)">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Composição do patrimônio projetado"
            description="A faixa de cima é rendimento; a de baixo é o dinheiro que você colocou."
          />
          <CardBody>
            <ProjectionChart data={series} />
          </CardBody>
          <CardFooter>
            Projeção bruta, sem imposto e sem evento de mercado. Serve para comparar cenários, não
            para prever o futuro.
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader title="Marcos" description="Onde você chega em 1, 5 e 10 anos." />
        <CardBody className="grid gap-6 sm:grid-cols-3">
          {milestones.map(({ years: milestoneYears, point }) => (
            <Stat
              key={milestoneYears}
              label={`Em ${milestoneYears} ${milestoneYears === 1 ? "ano" : "anos"}`}
              value={brl(point.total)}
              hint={
                point.realTotal !== null
                  ? `${brl(point.realTotal)} em poder de compra de hoje · ${brl(point.earnings)} de rendimento`
                  : `${brl(point.earnings)} de rendimento`
              }
            />
          ))}
        </CardBody>
        {final ? (
          <CardFooter>
            No fim do horizonte de {input.years} anos: {brl(final.total)}, sendo{" "}
            {brl(final.contributed)} de aporte e {brl(final.earnings)} de rendimento — o rendimento
            representa {percent(final.total === 0 ? 0 : final.earnings / final.total, 0)} do total.
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}

function num(value: string): number {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
