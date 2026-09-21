import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { syncBinance, syncQuotes } from "@/lib/integrations/sync";
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

  if (provider !== "brapi" && provider !== "binance") {
    return NextResponse.json({ error: "integração desconhecida" }, { status: 400 });
  }

  // Sem sessão, o cliente administrativo é o único jeito de descobrir quem
  // tem credencial cadastrada. A RLS não se aplica a ele — por isso o
  // `user_id` é passado explicitamente em cada operação do sync.
  const admin = createAdminClient();

  const { data: credentials, error } = await admin
    .from("provider_credentials")
    .select("user_id")
    .eq("provider", provider);

  if (error) {
    return NextResponse.json({ error: "falha ao listar credenciais" }, { status: 500 });
  }

  const results: { userId: string; ok: boolean; message: string }[] = [];

  for (const { user_id } of credentials) {
    const context: SyncContext = { supabase: admin, userId: user_id };

    const result = provider === "brapi" ? await syncQuotes(context) : await syncBinance(context);

    results.push({
      // Só o prefixo do id vai para a resposta: ela pode acabar em log.
      userId: user_id.slice(0, 8),
      ok: result.ok,
      message: result.message,
    });
  }

  return NextResponse.json({ provider, processed: results.length, results });
}
