"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assetSlug } from "@/lib/slug";
import { applyTransaction, PositionError, toHoldingUpdate } from "@/lib/finance/position";
import { ASSET_CLASSES } from "@/types/domain";

/**
 * Lançamento manual de ativo, posição e movimentação.
 *
 * Existe para a plataforma funcionar **sem nenhuma integração configurada**.
 * As chaves são uma conveniência, não um pré-requisito: quem não tem API da
 * corretora, ou não quer entregar credencial a terceiro, lança na mão e usa
 * tudo igual.
 *
 * Também cobre o que nenhuma integração resolve: o custo médio de compra, que
 * a corretora não informa e o cálculo de imposto exige.
 */

export interface FormState {
  ok: boolean;
  message: string | null;
  /** Erro por campo, para a interface marcar onde está o problema. */
  errors?: Record<string, string>;
}

const numberFromPtBr = z
  .string()
  .trim()
  .transform((value) => Number(value.replace(/\./g, "").replace(",", ".")))
  .refine((value) => Number.isFinite(value), "Número inválido");

const assetSchema = z.object({
  symbol: z.string().trim().min(1, "Informe o código ou nome").max(60),
  name: z.string().trim().max(120).optional(),
  assetClass: z.enum(ASSET_CLASSES),
  currency: z.enum(["BRL", "USD"]),
  sector: z.string().trim().max(80).optional(),
  quantity: numberFromPtBr.refine((v) => v > 0, "Quantidade precisa ser maior que zero"),
  averagePrice: numberFromPtBr.refine((v) => v >= 0, "Preço médio não pode ser negativo"),
  lastPrice: numberFromPtBr.optional(),
});

export async function createAssetWithPosition(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = assetSchema.safeParse({
    symbol: formData.get("symbol"),
    name: formData.get("name") || undefined,
    assetClass: formData.get("assetClass"),
    currency: formData.get("currency"),
    sector: formData.get("sector") || undefined,
    quantity: formData.get("quantity"),
    averagePrice: formData.get("averagePrice"),
    lastPrice: formData.get("lastPrice") || undefined,
  });

  if (!parsed.success) return fieldErrors(parsed.error);

  const input = parsed.data;

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, message: "Sessão expirada." };

    const symbol = input.symbol.toUpperCase();

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .insert({
        user_id: auth.user.id,
        symbol,
        slug: assetSlug(symbol),
        name: input.name ?? symbol,
        asset_class: input.assetClass,
        currency: input.currency,
        sector: input.sector ?? null,
      })
      .select("id, slug")
      .single();

    if (assetError) {
      // O índice único por (user, símbolo) é o que impede o mesmo ativo virar
      // duas linhas com posições separadas.
      return assetError.code === "23505"
        ? { ok: false, message: `Você já tem ${symbol} na carteira.` }
        : { ok: false, message: `Não foi possível criar o ativo: ${assetError.message}` };
    }

    // Sem cotação informada, o preço atual começa no preço médio: mostrar
    // lucro zero é honesto, inventar cotação não.
    const lastPrice = input.lastPrice ?? input.averagePrice;

    const { error: holdingError } = await supabase.from("holdings").insert({
      user_id: auth.user.id,
      asset_id: asset.id,
      quantity: input.quantity,
      average_price: input.averagePrice,
      last_price: lastPrice,
      day_change: 0,
    });

    if (holdingError) {
      return { ok: false, message: `Não foi possível criar a posição: ${holdingError.message}` };
    }

    // A compra inicial entra no histórico: sem ela, o ativo teria posição sem
    // origem, e a reconstrução do custo médio não fecharia.
    await supabase.from("transactions").insert({
      user_id: auth.user.id,
      asset_id: asset.id,
      kind: "compra",
      date: new Date().toISOString().slice(0, 10),
      quantity: input.quantity,
      unit_price: input.averagePrice,
      fees: 0,
      source: "manual",
      notes: "Posição inicial lançada manualmente",
    });

    revalidatePath("/", "layout");
    return { ok: true, message: `${symbol} adicionado à carteira.` };
  } catch (error) {
    console.error("[carteira] falha ao criar ativo:", error);
    return { ok: false, message: "Não foi possível adicionar o ativo." };
  }
}

const transactionSchema = z.object({
  assetId: z.string().uuid("Ativo inválido"),
  kind: z.enum(["compra", "venda", "dividendo", "juros", "aporte", "resgate", "taxa"]),
  date: z.string().min(10, "Informe a data"),
  quantity: numberFromPtBr.refine((v) => v > 0, "Quantidade precisa ser maior que zero"),
  unitPrice: numberFromPtBr.refine((v) => v >= 0, "Preço não pode ser negativo"),
  fees: numberFromPtBr.optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Registra a movimentação e atualiza a posição.
 *
 * As duas coisas andam juntas: lançar compra sem atualizar o custo médio
 * deixaria o simulador de IR calculando sobre um número velho.
 */
export async function recordTransaction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = transactionSchema.safeParse({
    assetId: formData.get("assetId"),
    kind: formData.get("kind"),
    date: formData.get("date"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    fees: formData.get("fees") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return fieldErrors(parsed.error);

  const input = parsed.data;

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, message: "Sessão expirada." };

    const { data: holding } = await supabase
      .from("holdings")
      .select("quantity, average_price, last_price")
      .eq("asset_id", input.assetId)
      .maybeSingle();

    const current = {
      quantity: Number(holding?.quantity ?? 0),
      averagePrice: Number(holding?.average_price ?? 0),
    };

    let next;
    try {
      next = applyTransaction(current, {
        kind: input.kind,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        fees: input.fees,
      });
    } catch (error) {
      return error instanceof PositionError
        ? { ok: false, message: error.message, errors: { quantity: error.message } }
        : { ok: false, message: "Não foi possível aplicar a movimentação." };
    }

    const { error: transactionError } = await supabase.from("transactions").insert({
      user_id: auth.user.id,
      asset_id: input.assetId,
      kind: input.kind,
      date: input.date,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      fees: input.fees ?? 0,
      source: "manual",
      notes: input.notes ?? null,
    });

    if (transactionError) {
      return { ok: false, message: `Não foi possível registrar: ${transactionError.message}` };
    }

    const position = toHoldingUpdate(next);

    await supabase.from("holdings").upsert(
      {
        user_id: auth.user.id,
        asset_id: input.assetId,
        quantity: position.quantity,
        average_price: position.averagePrice,
        // Cotação informada na compra vale como preço atual até o sync trazer
        // uma mais nova.
        last_price: Number(holding?.last_price ?? input.unitPrice) || input.unitPrice,
        day_change: 0,
      },
      { onConflict: "user_id,asset_id" },
    );

    revalidatePath("/", "layout");
    return { ok: true, message: "Movimentação registrada." };
  } catch (error) {
    console.error("[carteira] falha ao registrar movimentação:", error);
    return { ok: false, message: "Não foi possível registrar a movimentação." };
  }
}

const priceSchema = z.object({
  assetId: z.string().uuid(),
  lastPrice: numberFromPtBr.refine((v) => v > 0, "Cotação precisa ser maior que zero"),
});

/** Atualização manual de cotação, para ativo que nenhuma integração cobre. */
export async function updatePrice(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = priceSchema.safeParse({
    assetId: formData.get("assetId"),
    lastPrice: formData.get("lastPrice"),
  });

  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Sessão expirada." };

  const { error } = await supabase
    .from("holdings")
    .update({ last_price: parsed.data.lastPrice, day_change: 0 })
    .eq("asset_id", parsed.data.assetId);

  if (error) return { ok: false, message: "Não foi possível atualizar a cotação." };

  // Entra também no histórico, senão o gráfico do ativo ignora a atualização.
  await supabase.from("price_history").upsert(
    {
      user_id: auth.user.id,
      asset_id: parsed.data.assetId,
      date: new Date().toISOString().slice(0, 10),
      close: parsed.data.lastPrice,
      source: "manual",
    },
    { onConflict: "user_id,asset_id,date" },
  );

  revalidatePath("/", "layout");
  return { ok: true, message: "Cotação atualizada." };
}

export async function deleteAsset(_previous: FormState, formData: FormData): Promise<FormState> {
  const assetId = String(formData.get("assetId") ?? "");

  const supabase = await createClient();
  // Cascateia para posição, movimentações e histórico de preço — é o que se
  // espera de "remover da carteira".
  const { error } = await supabase.from("assets").delete().eq("id", assetId);

  if (error) return { ok: false, message: "Não foi possível remover o ativo." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Ativo removido da carteira." };
}

function fieldErrors(error: z.ZodError): FormState {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !errors[field]) errors[field] = issue.message;
  }

  return { ok: false, message: "Confira os campos destacados.", errors };
}
