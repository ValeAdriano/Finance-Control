/* As migrations do plano de evolução num Postgres de verdade.
 *
 *   MIGRATIONS_PG="-h 127.0.0.1 -p 54399 -U postgres" node testes/migrations-sql.test.js
 *
 * Monta um banco descartável com o mínimo do Supabase (auth, roles, vault,
 * pg_cron e pg_net de mentira), aplica o supabase/schema.sql INTEIRO duas
 * vezes (tem de ser idempotente) e confere, para cada tabela nova: RLS
 * ligada, as políticas padrão, e que uma conta não lê a linha da outra.
 * Sem MIGRATIONS_PG, o teste é ignorado (o npm test roda sem Postgres). */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

if (!process.env.MIGRATIONS_PG) { console.log("MIGRATIONS_PG não definido: teste das migrations ignorado"); process.exit(0); }
const conn = process.env.MIGRATIONS_PG.split(/\s+/);
const RAIZ = path.resolve(__dirname, "..");
const schema = fs.readFileSync(path.join(RAIZ, "supabase", "schema.sql"), "utf8")
  // extensões que só o Supabase tem: o stub abaixo faz o papel delas
  .replace(/create extension if not exists pg_net[^;]*;/g, "")
  .replace(/create extension if not exists pg_cron;/g, "");
const sql = (q, { db = "bullz_mig", tolera = false } = {}) => {
  try { return execFileSync("psql", [...conn, "-d", db, "-v", "ON_ERROR_STOP=1", "-q", "-At", "-c", q], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { if (tolera) return ""; throw new Error((e.stderr || e.message).toString()); }
};
const arquivo = (texto) => {
  const tmp = path.join(require("os").tmpdir(), "bullz-schema-" + process.pid + ".sql");
  fs.writeFileSync(tmp, texto);
  try { execFileSync("psql", [...conn, "-d", "bullz_mig", "-v", "ON_ERROR_STOP=1", "-q", "-f", tmp], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { throw new Error((e.stderr || e.message).toString().split("\n").slice(0, 6).join("\n")); }
  finally { fs.unlinkSync(tmp); }
};

const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
const STUB = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema extensions; create schema vault; create schema cron; create schema net;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public, auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
create table auth.mfa_factors (user_id uuid, status text);
create function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
create function auth.uid() returns uuid language sql stable as $f$ select nullif(auth.jwt() ->> 'sub', '')::uuid $f$;
create function auth.role() returns text language sql stable as $f$ select auth.jwt() ->> 'role' $f$;
create table vault.secrets (name text, secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(s text, n text) returns uuid language sql as $f$ insert into vault.secrets values (n, s); select gen_random_uuid() $f$;
create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $f$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; select 1::bigint $f$;
create function cron.unschedule(n text) returns boolean language sql as $f$ delete from cron.job where jobname = n; select true $f$;
create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int) returns bigint language sql as $f$ select 1::bigint $f$;
insert into auth.users (id) values ('${A}'), ('${B}');
`;

const NOVAS = ["potes", "potes_movimentos", "movimentos_internos", "agro_lotes", "despesas", "parcelamentos", "eventos_futuros", "planos_mensais", "planos_mensais_log",
  "alertas_preco", "revisoes", "notificacoes", "onboarding_estado"];
let falhas = 0, casos = 0;
const confere = (ok, txt) => { casos++; if (!ok) { falhas++; console.error("FALHOU:", txt); } };

sql("drop database if exists bullz_mig", { db: "postgres" });
sql("create database bullz_mig", { db: "postgres" });
arquivo(STUB);
arquivo(schema);
arquivo(schema);   // de novo: nada pode quebrar nem duplicar
confere(true, "schema.sql aplicado duas vezes");

for (const t of NOVAS) {
  confere(sql(`select relrowsecurity from pg_class where oid = 'public.${t}'::regclass`).trim() === "t", `${t}: RLS ligada`);
  const pols = sql(`select string_agg(policyname, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = '${t}'`).trim().split(",");
  for (const p of ["dono", "exige 2fa", "mcp le", "mcp insere", "mcp altera", "mcp apaga"]) confere(pols.includes(p), `${t}: política "${p}"`);
}
// seed dos potes: um de cada tipo por conta, sem duplicar na 2ª aplicação
confere(sql("select count(*) from public.potes").trim() === "10", "potes: 5 por conta, sem duplicar");
// parâmetros fiscais: seed sem duplicar
confere(Number(sql("select count(*) from public.parametros_fiscais where chave = 'das_mei_servicos'").trim()) === 2, "parâmetros: DAS 2025 e 2026");
// agendamentos
for (const j of ["fc-fecha-planos", "fc-limpa-uso", "fc-limpa-tentativas"]) confere(sql(`select count(*) from cron.job where jobname = '${j}'`).trim() === "1", `agendamento ${j}`);

// isolamento: A não vê o pote de B
const comoA = (q) => sql(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${A}","role":"authenticated"}'; ${q}; commit;`);
confere(comoA("select count(*) from public.potes").trim().split("\n").includes("5"), "A só vê os próprios 5 potes");
confere(comoA("select count(*) from public.potes where user_id = '" + B + "'").trim().split("\n").includes("0"), "A não vê potes de B");
// gravação com o check novo de troca e a coluna de lote
comoA(`insert into public.agro_movimentos (data, tipo, categoria, categoria_destino, cabecas, cabecas_saida, cabecas_entrada, valor_referencia_saida, valor_referencia_entrada)
       values ('2026-08-20', 'troca', 'boi_magro', 'bezerro', 3, 3, 6, 18000, 18000)`);
confere(true, "troca grava com o check novo");
let recusou = false;
try { comoA("insert into public.agro_movimentos (data, tipo, categoria, cabecas) values ('2026-08-20', 'troca', 'boi_magro', 3)"); } catch { recusou = true; }
confere(recusou, "troca sem os campos é recusada");
// um único plano ativo por conta
comoA("insert into public.planos_mensais (mes, status) values ('2026-11', 'ativo')");
recusou = false;
try { comoA("insert into public.planos_mensais (mes, status) values ('2026-12', 'ativo')"); } catch { recusou = true; }
confere(recusou, "só um plano ativo por conta");
// o fechamento automático fecha o mês vencido
sql("select privado.fecha_planos_vencidos()");
confere(sql("select status || ':' || coalesce(contexto->>'apurar', '') from public.planos_mensais where mes = '2026-11'").trim() === (new Date().toISOString().slice(0, 7) > "2026-11" ? "fechado:true" : "ativo:"), "fechamento automático do mês vencido");

sql("drop database if exists bullz_mig", { db: "postgres", tolera: true });
console.log(`migrations-sql: ${casos} casos, ${falhas ? falhas + " falharam" : "todos como esperado"}`);
process.exit(falhas ? 1 : 0);
