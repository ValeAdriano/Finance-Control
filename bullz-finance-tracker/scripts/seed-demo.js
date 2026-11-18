/* npm run seed:demo — grava a conta demo (seed/demo/dados.js) num Supabase de
 * DESENVOLVIMENTO. Idempotente: upsert pelos ids fixos; rodar duas vezes dá o
 * mesmo resultado.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_EMAIL=... DEMO_SENHA=... npm run seed:demo
 *
 * Sem as variáveis, só mostra o que gravaria. Nunca rode contra produção:
 * o script recusa a URL do projeto de produção (config.js). */
const { createClient } = require("@supabase/supabase-js");
const { montaDemo, semeia } = require("../seed/demo/dados.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    const d = montaDemo();
    console.log("seed:demo (simulação, sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY):");
    for (const [t, l] of Object.entries(d)) if (l.length) console.log(`  ${t}: ${l.length}`);
    return;
  }
  const prod = (/supabaseUrl:\s*"([^"]+)"/.exec(fs.readFileSync(path.join(__dirname, "..", "nucleo", "config.js"), "utf8")) || [])[1];
  if (prod && url.replace(/\/$/, "") === prod.replace(/\/$/, "") && process.env.SEED_PERMITE_PRODUCAO !== "sim") {
    console.error("Esta é a URL de produção. O seed demo é só para desenvolvimento."); process.exit(1);
  }
  const email = process.env.DEMO_EMAIL, senha = process.env.DEMO_SENHA;
  if (!email || !senha) { console.error("Defina DEMO_EMAIL e DEMO_SENHA (a conta demo)."); process.exit(1); }
  const sb = createClient(url, chave, { auth: { persistSession: false } });
  let uid = null;
  for (let pagina = 1; !uid; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) uid = u.id;
    if (data.users.length < 200) break;
  }
  if (!uid) {
    const { data, error } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome: "Conta demo" } });
    if (error) throw error;
    uid = data.user.id;
  }
  const c = await semeia(sb, uid);
  console.log("seed:demo gravado para", email, c);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
