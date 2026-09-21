"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { createAssetWithPosition, type FormState } from "@/lib/carteira/actions";
import { ASSET_CLASS_LABEL, ASSET_CLASSES, type AssetClass } from "@/types/domain";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";

const INITIAL: FormState = { ok: false, message: null };

/** Rótulos por classe: "quantidade" de um CDB não é a mesma coisa que de uma ação. */
const LABELS: Record<
  AssetClass,
  { symbol: string; quantity: string; price: string; hint: string }
> = {
  acao: {
    symbol: "Código (ticker)",
    quantity: "Quantidade de ações",
    price: "Preço médio pago (R$)",
    hint: "Ex.: PETR4, ITSA4",
  },
  fii: {
    symbol: "Código (ticker)",
    quantity: "Quantidade de cotas",
    price: "Preço médio pago (R$)",
    hint: "Ex.: HGLG11, MXRF11",
  },
  cripto: {
    symbol: "Símbolo",
    quantity: "Quantidade",
    price: "Preço médio pago",
    hint: "Ex.: BTC, ETH, SOL",
  },
  renda_fixa: {
    symbol: "Nome do título",
    quantity: "Quantidade",
    price: "Valor aportado (R$)",
    hint: "Ex.: CDB Inter 112% CDI. Use quantidade 1 e o valor total aportado.",
  },
  agro: {
    symbol: "Nome do investimento",
    quantity: "Quantidade",
    price: "Valor aportado (R$)",
    hint: "Ex.: Safra de soja 26/27. Use quantidade 1 e o valor total aportado.",
  },
};

export function NewAssetForm() {
  const [state, action, pending] = useActionState(createAssetWithPosition, INITIAL);
  const [assetClass, setAssetClass] = useState<AssetClass>("acao");

  const labels = LABELS[assetClass];
  const isCrypto = assetClass === "cripto";
  const isValueBased = assetClass === "renda_fixa" || assetClass === "agro";

  return (
    <form action={action}>
      <Card>
        <CardHeader
          title="Novo ativo"
          description="Funciona sem nenhuma integração configurada. O preço médio é o que o cálculo de imposto usa — vale informar com cuidado."
        />
        <CardBody className="flex flex-col gap-4">
          <Field label="Classe">
            {(id) => (
              <Select
                id={id}
                name="assetClass"
                value={assetClass}
                onChange={(event) => setAssetClass(event.target.value as AssetClass)}
              >
                {ASSET_CLASSES.map((option) => (
                  <option key={option} value={option}>
                    {ASSET_CLASS_LABEL[option]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={labels.symbol} hint={labels.hint}>
            {(id) => (
              <TextInput
                id={id}
                name="symbol"
                required
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder={isValueBased ? "CDB Banco X 110% CDI" : "PETR4"}
              />
            )}
          </Field>

          <Field label="Nome" hint="Opcional. Sem isso, usa o próprio código.">
            {(id) => (
              <TextInput id={id} name="name" autoComplete="off" placeholder="Petrobras PN" />
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={labels.quantity}>
              {(id) => (
                <TextInput
                  id={id}
                  name="quantity"
                  inputMode="decimal"
                  required
                  defaultValue={isValueBased ? "1" : ""}
                  placeholder={isCrypto ? "0,05" : "100"}
                />
              )}
            </Field>

            <Field label={labels.price}>
              {(id) => (
                <TextInput
                  id={id}
                  name="averagePrice"
                  inputMode="decimal"
                  required
                  placeholder="30,50"
                />
              )}
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Cotação atual"
              hint="Opcional. Em branco, começa igual ao preço médio — mostrar lucro zero é honesto, inventar cotação não."
            >
              {(id) => (
                <TextInput id={id} name="lastPrice" inputMode="decimal" placeholder="34,22" />
              )}
            </Field>

            <Field label="Moeda">
              {(id) => (
                <Select
                  id={id}
                  name="currency"
                  defaultValue={isCrypto ? "USD" : "BRL"}
                  key={assetClass}
                >
                  <option value="BRL">Real (BRL)</option>
                  <option value="USD">Dólar (USD)</option>
                </Select>
              )}
            </Field>
          </div>

          <Field
            label="Setor"
            hint="Opcional. Usado no critério de setor perene do score de ações."
          >
            {(id) => (
              <TextInput id={id} name="sector" autoComplete="off" placeholder="Energia Elétrica" />
            )}
          </Field>

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
              Adicionar à carteira
            </Button>
          </div>
        </CardBody>
        <CardFooter>
          Depois de adicionar, registre compras e vendas na tela do ativo — é o histórico que mantém
          o custo médio correto para o cálculo de IR.
        </CardFooter>
      </Card>
    </form>
  );
}
