"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { recordTransaction, updatePrice, type FormState } from "@/lib/carteira/actions";
import type { AssetClass, TransactionKind } from "@/types/domain";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";

const INITIAL: FormState = { ok: false, message: null };

const KINDS: { value: TransactionKind; label: string }[] = [
  { value: "compra", label: "Compra" },
  { value: "venda", label: "Venda" },
  { value: "dividendo", label: "Dividendo" },
  { value: "juros", label: "Juros" },
  { value: "aporte", label: "Aporte" },
  { value: "resgate", label: "Resgate" },
  { value: "taxa", label: "Taxa" },
];

/**
 * Lançamento de movimentação no ativo.
 *
 * Provento não mexe na posição, então o formulário muda de rótulo conforme o
 * tipo: pedir "preço unitário" para um dividendo confundiria quem está
 * lançando o valor por cota.
 */
export function TransactionForm({
  assetId,
  symbol,
  assetClass,
  currentPrice,
}: {
  assetId: string;
  symbol: string;
  assetClass: AssetClass;
  currentPrice: number;
}) {
  const [state, action, pending] = useActionState(recordTransaction, INITIAL);
  const [priceState, priceAction, updatingPrice] = useActionState(updatePrice, INITIAL);
  const [kind, setKind] = useState<TransactionKind>("compra");

  const isIncome = kind === "dividendo" || kind === "juros";
  const isFraction = assetClass === "cripto";

  return (
    <div className="flex flex-col gap-6">
      <form action={action}>
        <Card>
          <CardHeader
            title="Registrar movimentação"
            description={`Compra e venda mantêm o custo médio de ${symbol} em dia — é ele que o cálculo de IR usa.`}
          />
          <CardBody className="flex flex-col gap-4">
            <input type="hidden" name="assetId" value={assetId} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                {(id) => (
                  <Select
                    id={id}
                    name="kind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value as TransactionKind)}
                  >
                    {KINDS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Data">
                {(id) => (
                  <TextInput
                    id={id}
                    name="date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={isIncome ? "Quantidade que recebeu provento" : "Quantidade"}
                hint={state.errors?.quantity}
              >
                {(id) => (
                  <TextInput
                    id={id}
                    name="quantity"
                    inputMode="decimal"
                    required
                    placeholder={isFraction ? "0,05" : "100"}
                  />
                )}
              </Field>

              <Field label={isIncome ? "Valor por unidade (R$)" : "Preço unitário"}>
                {(id) => (
                  <TextInput
                    id={id}
                    name="unitPrice"
                    inputMode="decimal"
                    required
                    placeholder="30,50"
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Taxas (R$)"
                hint="Corretagem e emolumentos. Entram no custo de aquisição."
              >
                {(id) => <TextInput id={id} name="fees" inputMode="decimal" placeholder="0,00" />}
              </Field>

              <Field label="Observação" hint="Opcional.">
                {(id) => <TextInput id={id} name="notes" placeholder="Motivo da operação" />}
              </Field>
            </div>

            {state.message ? (
              <p
                role="status"
                className={
                  state.ok
                    ? "bg-positive-soft text-positive rounded-[12px] px-3.5 py-3 text-[13px]"
                    : "bg-negative-soft text-negative rounded-[12px] px-3.5 py-3 text-[13px]"
                }
              >
                {state.message}
              </p>
            ) : null}

            <div>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                Registrar
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>

      <form action={priceAction}>
        <Card>
          <CardHeader
            title="Atualizar cotação"
            description="Para ativo que nenhuma integração cobre, ou enquanto as chaves não estão configuradas."
          />
          <CardBody className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="assetId" value={assetId} />

            <Field label="Cotação atual">
              {(id) => (
                <TextInput
                  id={id}
                  name="lastPrice"
                  inputMode="decimal"
                  required
                  defaultValue={String(currentPrice).replace(".", ",")}
                  className="w-40"
                />
              )}
            </Field>

            <Button type="submit" variant="secondary" disabled={updatingPrice}>
              {updatingPrice ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Atualizar
            </Button>

            {priceState.message ? (
              <p
                role="status"
                className={
                  priceState.ok ? "text-positive text-[13px]" : "text-negative text-[13px]"
                }
              >
                {priceState.message}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
