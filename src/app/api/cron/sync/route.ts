import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import {
  syncBinance,
  syncCryptoPrices,
  syncOpenFinance,
  syncQuotes,
} from "@/lib/integrations/sync";
import type { SyncContext } from "@/lib/integrations/credentials";

/**
 * Endpoint que o `pg_cron` do Supabase chama para rodar o sync agendado.
 *
 * Fica aqui, e não numa Edge Function em Deno, para reaproveitar a mesma
 * implementação que a interface usa — duas cópias divergiriam na primeira
 * correção.
 *
 * A rota é pública na internet, então a autenticação é um segredo
 * compartilhado no header. Sem ele, qualquer um dispararia sync na conta
 * alheia e queimaria a cota das APIs externas.
 */

export const maxDuration = 60; // teto do plano Hobby da Vercel

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  // Comparação em tempo constante: comparar com `===` vaza, pelo tempo de
  // resposta, quantos caracteres do segredo estavam certos.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const provider = new URL(request.url).searchParams.get("provider") ?? "brapi";

  const PROVIDERS = ["brapi", "binance", "pluggy", "cripto-precos"] as const;
  type Provider = (typeof PROVIDERS)[number];

  if (!PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: "integração desconhecida" }, { status: 400 });
  }

  const job = provider as Provider;

  // Sem sessão, o cliente administrativo é o único jeito de descobrir quem
  // precisa sincronizar. A RLS não se aplica a ele — por isso o `user_id` vai
  // explícito em cada operação do sync.
  const admin = createAdminClient();

  /*
   * Cotação de cripto não depende de credencial: o endpoint de preço da
   * Binance é público. Então o público-alvo desse job é quem tem cripto na
   * carteira, não quem cadastrou chave.
   */
  let userIds: string[] | null;

  if (job === "cripto-precos") {
    const { data, error } = await admin
      .from("assets")
      .select("user_id")
      .eq("asset_class", "cripto");

    userIds = error ? null : [...new Set((data ?? []).map((row) => row.user_id))];
  } else {
    const { data, error } = await admin
      .from("provider_credentials")
      .select("user_id")
      .eq("provider", job);

    userIds = error ? null : (data ?? []).map((row) => row.user_id);
  }

  if (!userIds) {
    return NextResponse.json({ error: "falha ao listar usuários" }, { status: 500 });
  }

  const results: { userId: string; ok: boolean; message: string }[] = [];

  for (const user_id of userIds) {
    const context: SyncContext = { supabase: admin, userId: user_id };

    const result =
      job === "brapi"
        ? await syncQuotes(context)
        : job === "binance"
          ? await syncBinance(context)
          : job === "cripto-precos"
            ? await syncCryptoPrices(context)
            : await syncOpenFinance(context);

    results.push({
      // Só o prefixo do id vai para a resposta: ela pode acabar em log.
      userId: user_id.slice(0, 8),
      ok: result.ok,
      message: result.message,
    });
  }

  return NextResponse.json({ provider: job, processed: results.length, results });
}
