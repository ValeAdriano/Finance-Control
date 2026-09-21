import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assetSlug } from "@/lib/slug";
import { fetchQuotes } from "./brapi";
import { fetchBalances, fetchPrices } from "./binance";
import {
  loadCredential,
  recordVerification,
  type BinanceSecret,
  type BrapiSecret,
  type SyncContext,
} from "./credentials";
import { planBinanceSync, planQuoteSync, type SyncableAsset } from "./sync-plan";

/**
 * Execução do sync. O que decidir *o que* fazer está em `sync-plan.ts`, que é
 * puro e testado; aqui só há I/O.
 *
 * Toda execução vira uma linha em `sync_runs`, com quantos registros entraram
 * e quantos foram ignorados — o número de ignorados é o que deixa a
 * idempotência visível em produção, não só em teste.
 *
 * O `SyncContext` é o que permite a mesma implementação servir à interface
 * (com a sessão do usuário) e ao agendamento (com o cliente administrativo,
 * onde não há sessão). Duplicar essa lógica numa Edge Function em Deno faria
 * as duas versões divergirem na primeira correção.
 */

/** Resolve o contexto: o informado, ou o da sessão atual. */
async function resolveContext(context?: SyncContext): Promise<SyncContext> {
  if (context) return context;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada.");

  return { supabase, userId: data.user.id };
}

export interface SyncResult {
  ok: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  message: string;
}

type Provider = "brapi" | "binance" | "pluggy";

async function startRun(provider: Provider, ctx: SyncContext): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("sync_runs")
    .insert({ user_id: ctx.userId, provider, status: "rodando" })
    .select("id")
    .single();

  return data?.id ?? null;
}

async function finishRun(
  runId: string | null,
  status: "sucesso" | "parcial" | "erro",
  result: Omit<SyncResult, "ok">,
  ctx: SyncContext,
) {
  if (!runId) return;

  await ctx.supabase
    .from("sync_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      message: result.message,
    })
    .eq("id", runId);
}

/** Cotação de ações e FIIs pela brapi. */
export async function syncQuotes(context?: SyncContext): Promise<SyncResult> {
  const ctx = await resolveContext(context);
  const runId = await startRun("brapi", ctx);

  try {
    const credential = await loadCredential<BrapiSecret>("brapi", ctx);
    if (!credential) {
      const result = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        message: "Nenhum token da brapi cadastrado.",
      };
      await finishRun(runId, "erro", result, ctx);
      return { ok: false, ...result };
    }

    const supabase = ctx.supabase;
    const { data: assets, error } = await supabase
      .from("assets")
      .select("id, symbol, asset_class, currency")
      .eq("user_id", ctx.userId)
      .in("asset_class", ["acao", "fii"]);

    if (error) throw new Error(error.message);

    const syncable: SyncableAsset[] = assets.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      assetClass: a.asset_class,
      currency: a.currency,
    }));

    if (syncable.length === 0) {
      const result = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        message: "Nenhuma ação ou FII na carteira.",
      };
      await finishRun(runId, "sucesso", result, ctx);
      return { ok: true, ...result };
    }

    const quotes = await fetchQuotes(
      syncable.map((a) => a.symbol),
      { token: credential.token },
    );

    const today = new Date().toISOString().slice(0, 10);
    const plan = planQuoteSync(syncable, quotes, today);

    const userId = ctx.userId;

    // `price_history` é append-only e tem chave primária por (user, ativo, dia):
    // rodar duas vezes no mesmo dia atualiza a linha, não cria outra.
    if (plan.priceRows.length > 0) {
      const { error: priceError } = await supabase.from("price_history").upsert(
        plan.priceRows.map((row) => ({
          user_id: userId,
          asset_id: row.assetId,
          date: row.date,
          close: row.close,
          source: "brapi" as const,
        })),
        { onConflict: "user_id,asset_id,date" },
      );
      if (priceError) throw new Error(priceError.message);
    }

    for (const update of plan.holdingUpdates) {
      await supabase
        .from("holdings")
        .update({ last_price: update.lastPrice, day_change: update.dayChange })
        .eq("user_id", userId)
        .eq("asset_id", update.assetId);
    }

    await recordVerification("brapi", "valida", "Sincronização concluída.", ctx);

    const result = {
      inserted: plan.priceRows.length,
      updated: plan.holdingUpdates.length,
      skipped: plan.missing.length,
      message:
        plan.missing.length > 0
          ? `${plan.holdingUpdates.length} cotações atualizadas. Sem retorno da brapi para: ${plan.missing.join(", ")}.`
          : `${plan.holdingUpdates.length} cotações atualizadas.`,
    };

    await finishRun(runId, plan.missing.length > 0 ? "parcial" : "sucesso", result, ctx);
    return { ok: true, ...result };
  } catch (error) {
    return failRun(runId, "brapi", error, ctx);
  }
}

/** Saldo e cotação da Binance. */
export async function syncBinance(context?: SyncContext): Promise<SyncResult> {
  const ctx = await resolveContext(context);
  const runId = await startRun("binance", ctx);

  try {
    const credential = await loadCredential<BinanceSecret>("binance", ctx);
    if (!credential) {
      const result = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        message: "Nenhuma chave da Binance cadastrada.",
      };
      await finishRun(runId, "erro", result, ctx);
      return { ok: false, ...result };
    }

    const supabase = ctx.supabase;
    const userId = ctx.userId;

    const { data: assets, error } = await supabase
      .from("assets")
      .select("id, symbol, asset_class, currency")
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    const balances = await fetchBalances(credential);
    const prices = await fetchPrices(balances.map((b) => b.asset));

    const syncable: SyncableAsset[] = assets.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      assetClass: a.asset_class,
      currency: a.currency,
    }));

    const today = new Date().toISOString().slice(0, 10);
    const plan = planBinanceSync(syncable, balances, prices, today);

    // Ativo novo entra junto com a posição, numa transação lógica: um ativo
    // sem holding apareceria na carteira valendo zero.
    let inserted = 0;
    for (const asset of plan.newAssets) {
      const quote = prices.get(asset.symbol);
      if (!quote) continue;

      const { data: created, error: assetError } = await supabase
        .from("assets")
        .insert({
          user_id: userId,
          symbol: asset.symbol,
          slug: assetSlug(asset.symbol),
          name: asset.name,
          asset_class: "cripto",
          currency: "USD",
        })
        .select("id")
        .single();

      if (assetError || !created) continue;

      await supabase.from("holdings").insert({
        user_id: userId,
        asset_id: created.id,
        quantity: asset.quantity,
        // Sem histórico de compra, o custo médio começa na cotação atual e o
        // usuário ajusta — melhor que fingir lucro zero ou lucro inventado.
        average_price: quote.price,
        last_price: quote.price,
        day_change: quote.changePercent,
      });

      inserted++;
    }

    for (const update of plan.holdingUpdates) {
      await supabase
        .from("holdings")
        .update({
          quantity: update.quantity,
          last_price: update.lastPrice,
          day_change: update.dayChange,
        })
        .eq("user_id", userId)
        .eq("asset_id", update.assetId);
    }

    for (const assetId of plan.zeroed) {
      await supabase
        .from("holdings")
        .update({ quantity: 0 })
        .eq("user_id", userId)
        .eq("asset_id", assetId);
    }

    if (plan.priceRows.length > 0) {
      await supabase.from("price_history").upsert(
        plan.priceRows.map((row) => ({
          user_id: userId,
          asset_id: row.assetId,
          date: row.date,
          close: row.close,
          source: "binance" as const,
        })),
        { onConflict: "user_id,asset_id,date" },
      );
    }

    await recordVerification("binance", "valida", "Sincronização concluída.", ctx);

    const notes: string[] = [`${plan.holdingUpdates.length} posições atualizadas`];
    if (inserted > 0) notes.push(`${inserted} moedas novas`);
    if (plan.zeroed.length > 0) notes.push(`${plan.zeroed.length} zeradas`);
    if (plan.unpriced.length > 0) notes.push(`sem cotação: ${plan.unpriced.join(", ")}`);

    const result = {
      inserted,
      updated: plan.holdingUpdates.length + plan.zeroed.length,
      skipped: plan.unpriced.length,
      message: `${notes.join(", ")}.`,
    };

    await finishRun(runId, plan.unpriced.length > 0 ? "parcial" : "sucesso", result, ctx);
    return { ok: true, ...result };
  } catch (error) {
    return failRun(runId, "binance", error, ctx);
  }
}

async function failRun(
  runId: string | null,
  provider: Provider,
  error: unknown,
  ctx: SyncContext,
): Promise<SyncResult> {
  // O detalhe fica no log; a tela recebe texto genérico, porque a mensagem
  // original pode carregar trecho da requisição.
  console.error(`[sync ${provider}]`, error);

  const message = "A sincronização falhou. Confira a credencial e tente de novo.";
  await finishRun(runId, "erro", { inserted: 0, updated: 0, skipped: 0, message }, ctx);

  return { ok: false, inserted: 0, updated: 0, skipped: 0, message };
}

export interface SyncRunSummary {
  provider: Provider;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  inserted: number;
  updated: number;
  skipped: number;
  message: string | null;
}

export async function listRecentRuns(limit = 5): Promise<SyncRunSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sync_runs")
    .select("provider, status, started_at, finished_at, inserted, updated, skipped, message")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return data.map((row) => ({
    provider: row.provider,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    inserted: row.inserted,
    updated: row.updated,
    skipped: row.skipped,
    message: row.message,
  }));
}
