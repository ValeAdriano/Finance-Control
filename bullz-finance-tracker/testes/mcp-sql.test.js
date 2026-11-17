/* Confere, num Postgres de verdade, as travas do MCP no banco (o bloco
 * "CONEXÃO COM IA (MCP)" do supabase/schema.sql): o que um token de cliente
 * de IA consegue ler e gravar em cada situação.
 *
 * Precisa de um Postgres descartável (o mesmo do perfil-sql.test.js):
 *   MCP_PG="-h 127.0.0.1 -p 54399 -U postgres" node testes/mcp-sql.test.js
 * Sem MCP_PG, o teste é ignorado.
 *
 * O Supabase em si não está aqui: `auth.uid()`, `auth.jwt()` e os papéis são
 * imitados do jeito que o PostgREST os entrega (request.jwt.claims). O SQL
 * sob teste é o do schema.sql, recortado, sem alteração. */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

if (!process.env.MCP_PG) { console.log("MCP_PG não definido: teste do banco ignorado"); process.exit(0); }
const conn = process.env.MCP_PG.split(/\s+/);
const schema = fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");
const recorta = (de, ate) => {
  const a = schema.indexOf(de), b = ate ? schema.indexOf(ate, a) : schema.length;
  if (a < 0 || b < 0) throw new Error(`não achei "${de}" no schema.sql`);
  return schema.slice(a, b);
};
// do schema: o 2FA exigido pelo banco, o admin e o bloco do MCP inteiro
const SQL_2FA = recorta("create schema if not exists privado;", "drop function if exists public.painel_mfa_ok();");
const SQL_ADMIN = recorta("create or replace function privado.eh_admin()", "-- ------------------------------------------------------------ uso do app");
const SQL_MCP = recorta("create table if not exists public.mcp_acessos");

const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
const DADOS = ["ativos", "renda_fixa", "aportes", "preferencias", "agro_movimentos", "agro_custos", "agro_pesagens", "patrimonio_historico", "ganhos"];
const FORA = ["perfil_rascunho", "perfil_investidor", "plano_investimento", "onboarding_eventos"];

const montagem = [
  "drop schema if exists privado cascade; drop schema if exists auth cascade; drop schema if exists public cascade; create schema public;",
  "do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;",
  "do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;",
  "do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;",
  "grant usage on schema public to anon, authenticated, service_role;",
  "create schema auth; grant usage on schema auth to authenticated;",
  "create table auth.users (id uuid primary key);",
  "create table auth.mfa_factors (user_id uuid, status text);",
  "create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;",
  `insert into auth.users values ('${A}'), ('${B}');`,
  `insert into auth.mfa_factors values ('${A}', 'verified');`, // A tem 2FA; B não
  // tabelas no essencial: quem é o dono, e a política "dono" de sempre
  ...[...DADOS, ...FORA, "uso_eventos", "log_sistema"].flatMap((t) => [
    `create table public.${t} (id bigint generated always as identity primary key, user_id uuid default auth.uid(), nota text);`,
    `alter table public.${t} enable row level security;`,
    t === "uso_eventos"
      ? `create policy "qualquer usuario grava" on public.${t} for insert to authenticated with check (true);`
      : `create policy "dono" on public.${t} for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));`,
    `grant select, insert, update, delete on public.${t} to authenticated;`,
    `insert into public.${t} (user_id, nota) values ('${A}', 'de A'), ('${B}', 'de B');`,
  ]),
  "create table public.admins (user_id uuid primary key);",
  `insert into public.admins values ('${A}');`,
  SQL_2FA,
  ...FORA.map((t) => `create policy "exige 2fa" on public.${t} as restrictive for all to authenticated using ((select privado.mfa_ok())) with check ((select privado.mfa_ok()));`),
  SQL_ADMIN,
  SQL_MCP,
];

// ---------------------------------------------------------------- casos
const casos = [];
const token = (claims) => `set local role authenticated; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', true);`;
/** roda `sql` como o dono do token e devolve o resultado (ou "negado" se o banco recusar) */
function caso(nome, claims, sql, esperado) {
  casos.push({ nome, esperado });
  return `begin; ${token(claims)}
do $c$ declare r text; begin
  execute $q$${sql}$q$ into r;
  raise notice 'CASO|${casos.length - 1}|%', coalesce(r, 'null');
exception when insufficient_privilege then raise notice 'CASO|${casos.length - 1}|negado';
end $c$; rollback;`;
}
const conta = (t, extra = "") => `select count(*)::text from public.${t} ${extra}`;
const insere = (t) => `with n as (insert into public.${t} (nota) values ('novo') returning 1) select count(*)::text from n`;
const altera = (t) => `with n as (update public.${t} set nota = 'mexido' returning 1) select count(*)::text from n`;
const apaga = (t) => `with n as (delete from public.${t} returning 1) select count(*)::text from n`;

const direto2 = { sub: A, role: "authenticated", aal: "aal2" };
const direto1 = { sub: A, role: "authenticated", aal: "aal1" };
const ia = (cliente, sub = A) => ({ sub, role: "authenticated", aal: "aal1", client_id: cliente });
const autoriza = (cliente, escrita) => `begin; ${token(direto2)} insert into public.mcp_acessos (client_id, nome, escrita) values ('${cliente}', 'Assistente', ${escrita}); commit;`;

const roteiro = [
  // --- o app, como sempre
  caso("app com 2FA lê o que é seu", direto2, conta("ativos"), "1"),
  caso("app com 2FA grava", direto2, insere("aportes"), "1"),
  caso("app sem o código do 2FA não lê nada", direto1, conta("ativos"), "0"),
  caso("app sem o código do 2FA não autoriza cliente", direto1, `with n as (insert into public.mcp_acessos (client_id) values ('x') returning 1) select count(*)::text from n`, "negado"),
  caso("app: admin continua admin", direto2, "select public.eh_admin()::text", "true"),

  // --- cliente de IA SEM autorização
  caso("sem autorização: não lê", ia("c1"), conta("ativos"), "0"),
  caso("sem autorização: não grava", ia("c1"), insere("aportes"), "negado"),
  caso("sem autorização: mcp_acesso diz que não", ia("c1"), "select (public.mcp_acesso() ->> 'autorizado')", "false"),
  caso("sem autorização: não cria a própria autorização", ia("c1"), `with n as (insert into public.mcp_acessos (client_id, escrita) values ('c1', true) returning 1) select count(*)::text from n`, "negado"),

  // --- autorizado só para consulta
  autoriza("c1", false),
  ...DADOS.flatMap((t) => [
    caso(`consulta: lê ${t} (só o seu)`, ia("c1"), conta(t), "1"),
    caso(`consulta: não insere em ${t}`, ia("c1"), insere(t), "negado"),
    caso(`consulta: não altera ${t}`, ia("c1"), altera(t), "0"),
    caso(`consulta: não apaga de ${t}`, ia("c1"), apaga(t), "0"),
  ]),
  caso("consulta: lê o log", ia("c1"), conta("log_sistema"), "1"),
  caso("consulta: registra no log", ia("c1"), insere("log_sistema"), "1"),
  caso("consulta: mcp_acesso diz leitura sim, escrita não", ia("c1"), "select (public.mcp_acesso() ->> 'autorizado') || '/' || (public.mcp_acesso() ->> 'escrita') || '/' || (public.mcp_acesso() ->> 'nome')", "true/false/Assistente"),
  caso("consulta: não enxerga a tabela de autorizações", ia("c1"), conta("mcp_acessos"), "0"),
  caso("consulta: não se promove a escrita", ia("c1"), `with n as (update public.mcp_acessos set escrita = true returning 1) select count(*)::text from n`, "0"),
  caso("consulta: não autoriza outro cliente", ia("c1"), `with n as (insert into public.mcp_acessos (client_id, escrita) values ('c9', true) returning 1) select count(*)::text from n`, "negado"),
  ...FORA.flatMap((t) => [
    caso(`cliente de IA não lê ${t}`, ia("c1"), conta(t), "0"),
    caso(`cliente de IA não grava em ${t}`, ia("c1"), insere(t), "negado"),
  ]),
  caso("cliente de IA não grava telemetria", ia("c1"), insere("uso_eventos"), "negado"),
  caso("cliente de IA de conta admin não é admin", ia("c1"), "select public.eh_admin()::text", "false"),
  caso("outro cliente da mesma conta não herda a autorização", ia("c2"), conta("ativos"), "0"),
  caso("o mesmo cliente em outra conta não herda a autorização", ia("c1", B), conta("ativos"), "0"),

  // --- autorizado para editar
  `begin; ${token(direto2)} update public.mcp_acessos set escrita = true where client_id = 'c1'; commit;`,
  ...DADOS.flatMap((t) => [
    caso(`edição: insere em ${t}`, ia("c1"), insere(t), "1"),
    caso(`edição: altera ${t} (só o seu)`, ia("c1"), altera(t), "1"),
    caso(`edição: apaga de ${t} (só o seu)`, ia("c1"), apaga(t), "1"),
  ]),
  caso("edição: continua sem ver o que é de B", ia("c1"), conta("ativos", `where user_id = '${B}'`), "0"),
  caso("edição: continua sem alcançar o perfil", ia("c1"), conta("perfil_investidor"), "0"),
  caso("edição: continua sem ser admin", ia("c1"), "select public.eh_admin()::text", "false"),
  caso("edição: continua sem mexer nas autorizações", ia("c1"), `with n as (delete from public.mcp_acessos returning 1) select count(*)::text from n`, "0"),

  // --- revogado
  `begin; ${token(direto2)} delete from public.mcp_acessos where client_id = 'c1'; commit;`,
  caso("revogado: não lê mais", ia("c1"), conta("ativos"), "0"),
  caso("revogado: não grava mais", ia("c1"), insere("aportes"), "negado"),

  // --- conta sem 2FA (B): mesmas regras
  caso("conta sem 2FA, sem autorização: não lê", ia("c1", B), conta("ativos"), "0"),
  `begin; ${token({ sub: B, role: "authenticated", aal: "aal1" })} insert into public.mcp_acessos (client_id, escrita) values ('c1', false); commit;`,
  caso("conta sem 2FA, consulta: lê", ia("c1", B), conta("ativos"), "1"),
  caso("conta sem 2FA, consulta: não grava", ia("c1", B), insere("aportes"), "negado"),

  // --- sem login
  (casos.push({ nome: "anônimo não chama mcp_acesso", esperado: "negado" }), `begin; set local role anon;
do $c$ begin perform public.mcp_acesso(); raise notice 'CASO|${casos.length - 1}|chamou';
exception when insufficient_privilege then raise notice 'CASO|${casos.length - 1}|negado'; end $c$; rollback;`),
];

// os avisos (raise notice) saem no stderr: junta os dois para ler os casos
let tudo;
try {
  tudo = execFileSync("sh", ["-c", 'psql "$@" -X -q -v ON_ERROR_STOP=1 -f - 2>&1', "psql", ...conn],
    { input: montagem.join("\n") + "\n" + roteiro.join("\n"), encoding: "utf8" });
} catch (e) {
  console.error(String(e.stdout || e.message).split("\n").filter((l) => !l.includes("CASO|")).join("\n"));
  process.exit(1);
}

const visto = {};
for (const m of tudo.matchAll(/CASO\|(\d+)\|(.*)/g)) visto[m[1]] = m[2].trim();
let falhas = 0;
casos.forEach((c, i) => {
  if (visto[i] !== c.esperado) { falhas++; console.error(`  FALHOU: ${c.nome}: esperado ${c.esperado}, veio ${visto[i]}`); }
});
if (falhas) { console.error(`mcp-sql: ${falhas} de ${casos.length} casos falharam`); process.exit(1); }
console.log(`mcp-sql: ${casos.length} casos, todos como esperado`);
