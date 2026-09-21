"use client";

import { useMemo, useState } from "react";
import type { AssetClass } from "@/types/domain";
import { ASSET_CLASS_LABEL } from "@/types/domain";
import { simulateSale } from "@/lib/finance";
import { brl, percent } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, TextInput, Toggle } from "@/components/ui/field";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";

export interface SimulatorAsset {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  averagePriceBrl: number;
  lastPriceBrl: number;
}

/**
 * Simulador de venda. O calculo e a funcao pura `simulateSale`, a mesma que os
 * testes cobrem — a tela so coleta parametro e mostra o resultado.
 */
export function SaleSimulator({
  assets,
  initialAssetId,
}: {
  assets: SimulatorAsset[];
  initialAssetId?: string;
}) {
  const [assetId, setAssetId] = useState(initialAssetId ?? assets[0]?.id ?? "");
  const asset = assets.find((a) => a.id === assetId) ?? assets[0];

  const [quantity, setQuantity] = useState(() => String(asset?.quantity ?? 0));
  const [salePrice, setSalePrice] = useState(() => String(asset?.lastPriceBrl ?? 0));
  const [fees, setFees] = useState("4.90");
  const [monthlySales, setMonthlySales] = useState("0");
  const [accumulatedLoss, setAccumulatedLoss] = useState("0");
  const [dayTrade, setDayTrade] = useState(false);
  const [daysHeld, setDaysHeld] = useState("730");

  function selectAsset(id: string) {
    const next = assets.find((a) => a.id === id);
    setAssetId(id);
    if (next) {
      setQuantity(String(next.quantity));
      setSalePrice(String(next.lastPriceBrl));
      if (next.assetClass !== "acao") setDayTrade(false);
    }
  }

  const result = useMemo(() => {
    if (!asset) return null;
    return simulateSale({
      assetClass: asset.assetClass,
      quantity: num(quantity),
      averagePrice: asset.averagePriceBrl,
      salePrice: num(salePrice),
      fees: num(fees),
      monthlySalesSoFar: num(monthlySales),
      accumulatedLoss: num(accumulatedLoss),
      dayTrade,
      daysHeld: num(daysHeld),
    });
  }, [asset, quantity, salePrice, fees, monthlySales, accumulatedLoss, dayTrade, daysHeld]);

  if (!asset || !result) {
    return (
      <Card>
        <CardBody className="text-muted py-10 text-center text-[14px]">
          Nenhuma posição disponível para simular.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader title="Operação" description="Ajuste os parâmetros da venda." />
        <CardBody className="flex flex-col gap-4">
          <Field label="Ativo">
            {(id) => (
              <Select id={id} value={assetId} onChange={(e) => selectAsset(e.target.value)}>
                {assets.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.symbol} — {ASSET_CLASS_LABEL[option.assetClass]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade" hint={`Você tem ${asset.quantity}`}>
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              )}
            </Field>
            <Field label="Preço de venda (R$)" hint={`Custo médio ${brl(asset.averagePriceBrl)}`}>
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Taxas (R$)">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                />
              )}
            </Field>
            <Field label="Prejuízo acumulado (R$)" hint="Compensável na mesma classe">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={accumulatedLoss}
                  onChange={(e) => setAccumulatedLoss(e.target.value)}
                />
              )}
            </Field>
          </div>

          {asset.assetClass === "acao" || asset.assetClass === "cripto" ? (
            <Field
              label="Já vendido no mês (R$)"
              hint={
                asset.assetClass === "acao"
                  ? "A isenção de ações vale até R$ 20.000 vendidos no mês, em swing trade"
                  : "A isenção de cripto vale até R$ 35.000 vendidos no mês"
              }
            >
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  value={monthlySales}
                  onChange={(e) => setMonthlySales(e.target.value)}
                />
              )}
            </Field>
          ) : null}

          {asset.assetClass === "renda_fixa" ? (
            <Field label="Dias de aplicação" hint="Define a alíquota da tabela regressiva">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  value={daysHeld}
                  onChange={(e) => setDaysHeld(e.target.value)}
                />
              )}
            </Field>
          ) : null}

          {asset.assetClass === "acao" ? (
            <Toggle
              label="Day trade"
              hint="Alíquota de 20% e sem direito à isenção mensal"
              checked={dayTrade}
              onChange={setDayTrade}
            />
          ) : null}
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader
          title="Resultado da venda"
          description="Estimativa para conferência — não substitui a apuração do contador."
          action={
            result.exempt ? (
              <Badge tone="positive">Isenta</Badge>
            ) : result.darfDue ? (
              <Badge tone="warning">DARF devido</Badge>
            ) : (
              <Badge>Sem DARF</Badge>
            )
          }
        />
        <CardBody className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <Stat label="Valor bruto" value={brl(result.grossAmount)} />
            <Stat
              label="Imposto"
              value={brl(result.tax)}
              hint={result.taxRate > 0 ? `alíquota de ${percent(result.taxRate, 1)}` : undefined}
            />
            <Stat label="Líquido a receber" value={brl(result.netAmount)} />
          </div>

          <dl className="flex flex-col gap-2 text-[14px]">
            <Row label="Custo de aquisição" value={brl(result.cost)} />
            <Row label="Taxas da operação" value={brl(result.fees)} />
            <Row
              label={result.grossGain >= 0 ? "Ganho na operação" : "Prejuízo na operação"}
              value={brl(Math.abs(result.grossGain))}
              tone={result.grossGain >= 0 ? "positive" : "negative"}
            />
            {result.lossUsed > 0 ? (
              <Row label="Prejuízo compensado" value={`− ${brl(result.lossUsed)}`} />
            ) : null}
            <Row label="Base de cálculo" value={brl(result.taxableGain)} />
            {result.remainingLoss > 0 ? (
              <Row label="Prejuízo a carregar" value={brl(result.remainingLoss)} />
            ) : null}
          </dl>

          <p className="bg-sunken text-muted rounded-[12px] px-3.5 py-3 text-[13px] leading-relaxed">
            {result.rationale}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="border-line flex items-baseline justify-between gap-3 border-b pb-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd
        className={
          tone === "positive"
            ? "tabular text-positive font-medium"
            : tone === "negative"
              ? "tabular text-negative font-medium"
              : "tabular text-content font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/** Aceita vírgula decimal, que é como se digita número em pt-BR. */
function num(value: string): number {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
