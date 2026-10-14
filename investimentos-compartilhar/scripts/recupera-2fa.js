#!/usr/bin/env node
/* Recuperação assistida do 2FA (PLANO-SEGURANCA S3, último recurso).
 *
 * Remove os autenticadores de UMA conta, para quem perdeu todos. Antes de
 * rodar, confira a identidade fora do app: o pedido tem de vir do e-mail
 * da conta, e vale confirmar por outro canal que você já conhece.
 *
 * A chave service_role fica só na sua máquina, na variável de ambiente;
 * nunca no repositório, no app ou no site.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/recupera-2fa.js pessoa@exemplo.com            # só mostra
 *   node scripts/recupera-2fa.js pessoa@exemplo.com --remover  # remove
 *
 * Fica registrado em log_sistema (origem "admin"), visível para a própria
 * pessoa em Ajustes → Dados → Registro. */
const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email, flag] = process.argv.slice(2);

if (!url || !chave || !email) {
  console.error("uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/recupera-2fa.js <email> [--remover]");
  process.exit(1);
}
const H = { apikey: chave, Authorization: "Bearer " + chave, "Content-Type": "application/json" };

async function req(caminho, opcoes = {}) {
  const r = await fetch(url + caminho, { ...opcoes, headers: H });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${opcoes.method || "GET"} ${caminho}: ${r.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

async function achaUsuario(alvo) {
  for (let pagina = 1; pagina < 1000; pagina++) {
    const j = await req(`/auth/v1/admin/users?page=${pagina}&per_page=200`);
    const lista = j.users || [];
    const u = lista.find((x) => (x.email || "").toLowerCase() === alvo.toLowerCase());
    if (u) return u;
    if (lista.length < 200) return null;
  }
  return null;
}

(async () => {
  const u = await achaUsuario(email.trim());
  if (!u) { console.error("Nenhuma conta com esse e-mail."); process.exit(2); }
  const fatores = (u.factors || []).filter((f) => f.factor_type === "totp");
  console.log(`Conta ${u.id} · criada em ${u.created_at} · último acesso ${u.last_sign_in_at || "—"}`);
  if (!fatores.length) { console.log("Essa conta não tem autenticador cadastrado."); return; }
  for (const f of fatores) console.log(`  - ${f.friendly_name || "Autenticador"} (${f.status}) · ${f.id}`);
  if (flag !== "--remover") { console.log("\nNada removido. Rode de novo com --remover depois de conferir a identidade."); return; }

  for (const f of fatores) await req(`/auth/v1/admin/users/${u.id}/factors/${f.id}`, { method: "DELETE" });
  await req("/rest/v1/log_sistema", { method: "POST", body: JSON.stringify({ user_id: u.id, origem: "admin", evento: "seguranca",
    detalhe: { acao: "2FA removido pelo administrador (recuperação assistida)", fatores: fatores.length } }) });
  console.log(`\n${fatores.length} autenticador(es) removido(s).`);
  // sem fator, uma sessão antiga que só passou pela senha volta a ler os dados
  console.log("Peça para a pessoa, logo em seguida: trocar a senha (encerra as outras sessões) e ligar o 2FA de novo, com um reserva.");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
