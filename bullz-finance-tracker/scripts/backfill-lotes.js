/* Backfill idempotente dos lotes do agro (Marco 4).
 *
 * Agrupa os movimentos históricos em lotes pela ordem de compra e venda
 * (PEPS, o mesmo cálculo do app: FC.lotes.monta), cria em agro_lotes uma
 * linha por lote calculado e grava o lote_id nos movimentos que ainda não
 * têm. Rodar de novo não duplica: movimento com lote_id fica como está e o
 * lote é achado pelo nome (único por conta).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-lotes.js [--grava]
 *
 * Sem --grava, só mostra o que faria (e as suposições). Exige a migration 0004. */
const { createClient } = require("@supabase/supabase-js");
const { carregaNucleo } = require("../testes/nucleo.js");

async function main() {
  const url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) { console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
  const grava = process.argv.includes("--grava");
  const sb = createClient(url, chave, { auth: { persistSession: false } });
  const { FC } = carregaNucleo();
  const tudo = async (t) => { const { data, error } = await sb.from(t).select("*"); if (error) throw error; return data; };
  const [movs, custos, lotes] = await Promise.all([tudo("agro_movimentos"), tudo("agro_custos"), tudo("agro_lotes")]);
  const contas = [...new Set(movs.map((m) => m.user_id))];
  for (const uid of contas) {
    const meus = movs.filter((m) => m.user_id === uid).map((m) => ({ ...m, cabecas: Number(m.cabecas), valor_total: Number(m.valor_total) || 0, despesas: Number(m.despesas) || 0 }));
    const r = FC.lotes.monta(meus, custos.filter((c) => c.user_id === uid), lotes.filter((l) => l.user_id === uid), {}, null);
    console.log(`conta ${uid.slice(0, 8)}…: ${r.lotes.length} lotes`);
    for (const s of r.suposicoes) console.log("  suposição:", s);
    for (const l of r.lotes.filter((x) => !x.id)) {
      const nome = (l.nome || `Lote de ${l.aberto_em}`).slice(0, 80);
      let linha = lotes.find((x) => x.user_id === uid && x.nome === nome);
      if (!linha && grava) {
        const { data, error } = await sb.from("agro_lotes").insert({ user_id: uid, nome }).select().single();
        if (error) throw error;
        linha = data;
      }
      const ids = Object.entries(r.atribuicoes).filter(([, k]) => k === l.chave).map(([id]) => id).filter((id) => !id.includes(":"));
      for (const id of ids) {
        const m = meus.find((x) => x.id === id);
        if (!m || m.lote_id) continue;
        console.log(`  ${m.data} ${m.tipo} ${m.cabecas} → ${nome}`);
        if (grava && linha) { const { error } = await sb.from("agro_movimentos").update({ lote_id: linha.id }).eq("id", id).is("lote_id", null); if (error) throw error; }
      }
    }
  }
  if (!grava) console.log("\n(simulação: rode com --grava para gravar)");
}
main().catch((e) => { console.error(e); process.exit(1); });
