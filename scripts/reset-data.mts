/**
 * Limpa os dados da conta, preservando a configuração.
 *
 * Roda em dry-run por padrão: sem `--yes`, só mostra o que seria apagado. Uma
 * limpeza de banco não deve ser possível por engano de digitação.
 *
 *   npm run reset -- --email voce@exemplo.com              # dry-run
 *   npm run reset -- --email voce@exemplo.com --yes        # executa
 *   npm run reset -- --email voce@exemplo.com --all --yes  # apaga também a configuração
 *
 * Usa a service role key e portanto ignora a RLS — é trabalho de sistema.
 */

import { createClient } from "@supabase/supabase-js";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const has = (name: string) => process.argv.includes(`--${name}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = arg("email");
const execute = has("yes");
const wipeConfig = has("all");

if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
if (!email) {
  console.error("Uso: npm run reset -- --email voce@exemplo.com [--all] [--yes]");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: users } = await db.auth.admin.listUsers();
const user = users?.users.find((u) => u.email === email);

if (!user) {
  console.error(`Usuário ${email} não encontrado.`);
  process.exit(1);
}

/**
 * `assets` cascateia para holdings, transactions, price_history,
 * asset_fundamentals e watchlist — por isso basta apagar a raiz. `journal_entries`
 * não cascateia (asset_id é `on delete set null`), então vai explícito.
 */
const DATA_TABLES = [
  "assets",
  "institutions",
  "expense_entries",
  "journal_entries",
  "net_worth_history",
  "sync_runs",
] as const;

/** Configuração: sobrevive por padrão, porque refazer na mão é chato à toa. */
const CONFIG_TABLES = ["expense_categories", "allocation_targets", "scoring_settings"] as const;

/** Nunca apagado por este script: a credencial é do usuário, não dado de teste. */
const NEVER = ["provider_credentials"] as const;

const CASCADED = ["holdings", "transactions", "price_history", "asset_fundamentals", "watchlist"];

async function count(table: string): Promise<number> {
  const { count: total } = await db
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);
  return total ?? 0;
}

const targets = wipeConfig ? [...DATA_TABLES, ...CONFIG_TABLES] : [...DATA_TABLES];

console.log(`Conta: ${email}`);
console.log(execute ? "Modo: EXECUTAR\n" : "Modo: dry-run (nada será apagado)\n");

console.log("Será apagado:");
let totalRows = 0;
for (const table of [...targets, ...CASCADED]) {
  const rows = await count(table);
  totalRows += rows;
  const note = CASCADED.includes(table) ? " (em cascata)" : "";
  if (rows > 0) console.log(`  ${table.padEnd(22)}${rows}${note}`);
}

console.log("\nSerá preservado:");
for (const table of wipeConfig ? NEVER : [...CONFIG_TABLES, ...NEVER]) {
  console.log(`  ${table.padEnd(22)}${await count(table)}`);
}
console.log(`  ${"conta e 2FA".padEnd(22)}intactos`);

if (!execute) {
  console.log(`\n${totalRows} linhas seriam apagadas. Rode de novo com --yes para executar.`);
  process.exit(0);
}

console.log("\nApagando…");
for (const table of targets) {
  const { error } = await db.from(table).delete().eq("user_id", user.id);
  if (error) {
    console.error(`✗ ${table}: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${table}`);
}

console.log("\nEstado final:");
for (const table of [...targets, ...CASCADED, ...CONFIG_TABLES, ...NEVER]) {
  console.log(`  ${table.padEnd(22)}${await count(table)}`);
}
