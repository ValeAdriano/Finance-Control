#!/usr/bin/env node
/* Teste de segurança da RLS contra o Supabase de verdade (PLANO-SEGURANCA S5).
 *
 * Usa a chave PUBLICÁVEL (a mesma do app) e duas contas de teste, A e B:
 *   - anônimo não lê nada de nenhuma tabela com dado de usuário;
 *   - B não lê, não grava, não altera e não apaga nada de A, pela API direto;
 *   - A enxerga o que é dela (prova de que o teste não passa por estar vazio).
 * Com TESTE_2FA_EMAIL/SENHA (conta com 2FA ligado), confere também que uma
 * sessão só com senha (aal1) não lê nada.
 *
 * Credenciais em .env.teste (fora do git):
 *   TESTE_EMAIL, TESTE_SENHA        conta A
 *   TESTE_B_EMAIL, TESTE_B_SENHA    conta B
 *   TESTE_2FA_EMAIL, TESTE_2FA_SENHA (opcional)
 *
 *   npm run teste:seguranca
 *
 * Rodar a cada mudança no schema.sql. A conta A ganha uma linha em
 * log_sistema por execução (evento "teste_seguranca"); nada mais é gravado. */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const cfg = fs.readFileSync(path.resolve(__dirname, "..", "nucleo", "config.js"), "utf8");
const URL_SB = /supabaseUrl:\s*"([^"]+)"/.exec(cfg)[1];
const CHAVE = /supabaseChave:\s*"([^"]+)"/.exec(cfg)[1];

const env = {};
try {
  for (const l of fs.readFileSync(path.resolve(__dirname, "..", ".env.teste"), "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* sem arquivo: só variáveis de ambiente */ }
const v = (k) => process.env[k] || env[k];

// tabelas com dado de usuário (coluna do dono) — mercado_cache, indices_diarios
// e uso_eventos são públicas/anônimas e ficam de fora
const TABELAS = ["ativos", "renda_fixa", "aportes", "preferencias", "agro_movimentos", "agro_custos", "agro_pesagens",
  "patrimonio_historico", "log_sistema", "ganhos", "perfil_rascunho", "perfil_investidor", "plano_investimento",
  "onboarding_eventos", "admins", "contas_modo_completo"];

const novo = () => createClient(URL_SB, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });
let falhas = 0, oks = 0;
const ok = (cond, msg) => { if (cond) oks++; else { falhas++; console.error("  FALHOU: " + msg); } };

async function entra(email, senha) {
  const c = novo();
  const { data, error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login de ${email}: ${error.message}`);
  return { c, uid: data.user.id };
}

// "nada visível": erro de permissão ou lista vazia
async function naoLe(c, tabela, filtro) {
  let q = c.from(tabela).select("*").limit(5);
  if (filtro) q = q.eq("user_id", filtro);
  const { data, error } = await q;
  return !!error || (data || []).length === 0;
}

(async () => {
  const [ea, sa, eb, sb] = ["TESTE_EMAIL", "TESTE_SENHA", "TESTE_B_EMAIL", "TESTE_B_SENHA"].map(v);
  if (!ea || !sa || !eb || !sb) {
    console.error("Faltam credenciais: TESTE_EMAIL/TESTE_SENHA e TESTE_B_EMAIL/TESTE_B_SENHA em .env.teste");
    process.exit(1);
  }

  console.log("anônimo");
  const anon = novo();
  for (const t of TABELAS) ok(await naoLe(anon, t), `anon leu ${t}`);
  {
    const { error } = await anon.from("log_sistema").insert({ user_id: "00000000-0000-0000-0000-000000000000", origem: "app", evento: "x" });
    ok(!!error, "anon gravou em log_sistema");
  }

  const A = await entra(ea, sa);
  const B = await entra(eb, sb);
  ok(A.uid !== B.uid, "A e B são a mesma conta");

  console.log("A grava e lê o que é dela");
  {
    const { error } = await A.c.from("log_sistema").insert({ user_id: A.uid, origem: "app", evento: "teste_seguranca", detalhe: {} });
    ok(!error, "A não conseguiu gravar o próprio log: " + (error && error.message));
    const { data } = await A.c.from("log_sistema").select("id").eq("user_id", A.uid).limit(1);
    ok((data || []).length === 1, "A não lê o próprio log (o teste perderia o sentido)");
  }

  console.log("B tenta ler, gravar, alterar e apagar o que é de A");
  for (const t of TABELAS) {
    ok(await naoLe(B.c, t, A.uid), `B leu ${t} de A`);
    const u = await B.c.from(t).update({ user_id: B.uid }).eq("user_id", A.uid).select();
    ok(!!u.error || (u.data || []).length === 0, `B alterou ${t} de A`);
    const d = await B.c.from(t).delete().eq("user_id", A.uid).select();
    ok(!!d.error || (d.data || []).length === 0, `B apagou ${t} de A`);
  }
  for (const t of ["ativos", "aportes", "preferencias", "log_sistema", "ganhos", "patrimonio_historico"]) {
    const { error } = await B.c.from(t).insert({ user_id: A.uid });
    ok(!!error, `B gravou em ${t} em nome de A`);
  }
  {
    // a linha de A continua lá depois das tentativas de B
    const { data } = await A.c.from("log_sistema").select("id").eq("user_id", A.uid).eq("evento", "teste_seguranca").limit(1);
    ok((data || []).length === 1, "o log de A sumiu depois das tentativas de B");
  }

  const [e2, s2] = ["TESTE_2FA_EMAIL", "TESTE_2FA_SENHA"].map(v);
  if (e2 && s2) {
    console.log("conta com 2FA, sessão só com senha (aal1)");
    const C = await entra(e2, s2);
    const { data: n } = await C.c.auth.mfa.getAuthenticatorAssuranceLevel();
    ok(n && n.nextLevel === "aal2", "a conta de 2FA não tem autenticador verificado");
    for (const t of TABELAS) ok(await naoLe(C.c, t, C.uid), `sessão aal1 leu ${t}`);
    await C.c.auth.signOut();
  } else {
    console.log("(sem TESTE_2FA_EMAIL: teste de sessão aal1 pulado)");
  }

  await A.c.auth.signOut();
  await B.c.auth.signOut();
  console.log(`\n${oks} verificações ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
