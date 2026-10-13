/* Confere que o banco recalcula o perfil igual ao navegador.
 * Precisa de um Postgres descartável:
 *   PERFIL_PG="-h 127.0.0.1 -p 54399 -U postgres" node tests/perfil-sql.test.js
 * Sem PERFIL_PG, o teste é ignorado. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

if (!process.env.PERFIL_PG) { console.log("PERFIL_PG não definido: teste do banco ignorado"); process.exit(0); }
const conn = process.env.PERFIL_PG.split(/\s+/);
const raiz = path.join(__dirname, "..");
const ctx = { window: { FC: {} } };
vm.createContext(ctx);
for (const f of ["assets/js/padroes.js", "assets/js/modelo/perfil.js"]) vm.runInContext(fs.readFileSync(path.join(raiz, f), "utf8"), ctx);
const FC = ctx.window.FC;

const schema = fs.readFileSync(path.join(raiz, "supabase/schema.sql"), "utf8");
const a = schema.indexOf("-- >>> perfil_confere"), b = schema.indexOf("-- <<< perfil_confere");
const funcao = schema.slice(a, b);

let s = 12345;
const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const casos = [];
for (let i = 0; i < 1500; i++) {
  const r = {};
  for (const q of FC.PERFIL.perguntas) {
    if (q.multipla) { r[q.id] = q.opcoes.filter(() => rnd() > 0.5).map((o) => o.id); continue; }
    if (!q.essencial && rnd() < 0.25) continue;
    r[q.id] = q.opcoes[Math.floor(rnd() * q.opcoes.length)].id;
  }
  if (rnd() < 0.3) r.agro_pct = Math.round(rnd() * 100);
  casos.push(r);
}
const lit = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'";
const linhas = [
  "drop schema if exists privado cascade; drop schema if exists auth cascade; drop table if exists perfil_investidor;",
  "create schema privado; create schema auth; create table auth.users (id uuid primary key);",
  "create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;",
  "insert into auth.users values ('00000000-0000-0000-0000-000000000001');",
  `create table perfil_investidor (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users,
    versao_modelo text not null, origem text not null, respostas jsonb not null, tolerancia smallint not null, capacidade smallint not null,
    necessidade numeric(6,4), score smallint not null, perfil text not null, consistencia text not null,
    valido_ate date not null default (current_date + interval '24 months'), criado_em timestamptz not null default now());`,
  funcao,
  "create trigger perfil_confere before insert on perfil_investidor for each row execute function privado.perfil_confere();",
  `create function pg_temp.tenta(resp jsonb, v text, t int, c int, sc int, p text, cons text) returns text language plpgsql as $f$
   begin
     insert into perfil_investidor (versao_modelo, origem, respostas, tolerancia, capacidade, score, perfil, consistencia) values (v, 'cadastro', resp, t, c, sc, p, cons);
     return 'ok';
   exception when others then return sqlerrm; end $f$;`,
];
let esperado = 0;
for (const r of casos) {
  const c = FC.perfil.calcula(r);
  if (FC.perfil.faltantes(r).length) { esperado++; linhas.push(`select 'falta' || ':' || pg_temp.tenta(${lit(r)}::jsonb, 'perfil-v1', ${c.tolerancia}, ${c.capacidade}, ${c.score}, '${c.perfil}', '${c.consistencia}');`); continue; }
  linhas.push(`select 'ok:' || pg_temp.tenta(${lit(r)}::jsonb, 'perfil-v1', ${c.tolerancia}, ${c.capacidade}, ${c.score}, '${c.perfil}', '${c.consistencia}');`);
}
// adulteração: capacidade maior que a real tem de ser recusada
const base = casos.find((r) => !FC.perfil.faltantes(r).length);
const cb = FC.perfil.calcula(base);
linhas.push(`select 'adulterado:' || pg_temp.tenta(${lit(base)}::jsonb, 'perfil-v1', ${cb.tolerancia}, ${Math.min(100, cb.capacidade + 7)}, ${cb.score}, '${cb.perfil}', '${cb.consistencia}');`);
linhas.push(`select 'versao:' || pg_temp.tenta(${lit(base)}::jsonb, 'perfil-v9', ${cb.tolerancia}, ${cb.capacidade}, ${cb.score}, '${cb.perfil}', '${cb.consistencia}');`);

const arq = path.join(require("os").tmpdir(), "perfil-sql-test.sql");
fs.writeFileSync(arq, linhas.join("\n"));
const out = execFileSync("psql", [...conn, "-d", process.env.PERFIL_DB || "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-f", arq], { encoding: "utf8", maxBuffer: 1 << 26 })
  .split("\n").filter(Boolean);
let ruins = 0, oks = 0;
for (const l of out) {
  if (l.startsWith("ok:ok")) oks++;
  else if (l.startsWith("falta:resposta_faltando")) oks++;
  else if (l.startsWith("adulterado:perfil_adulterado") || l.startsWith("versao:versao_modelo_desconhecida")) oks++;
  else { ruins++; if (ruins < 6) console.error("✗ " + l); }
}
console.log(`${oks}/${out.length} casos do banco bateram com o navegador`);
process.exit(ruins ? 1 : 0);
