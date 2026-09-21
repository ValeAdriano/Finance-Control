/**
 * Popula o banco com o conjunto de dados que a Fase 1 usava como mock, para a
 * interface ter o que mostrar assim que o Supabase entra no lugar.
 *
 * Roda via tsx (que resolve os aliases do tsconfig), lendo as chaves do
 * .env.local:
 *
 *   npm run seed -- --email voce@exemplo.com --password 'senha forte'
 *
 * Usa a service role key e portanto **ignora a RLS** — é trabalho de sistema,
 * não requisição de usuário. É idempotente: apaga o dado do usuário antes de
 * inserir, então rodar de novo repõe o estado em vez de duplicar.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  agroPositions,
  assets,
  cryptoMetrics,
  fiiFundamentals,
  fixedIncomeTerms,
  holdings,
  institutions,
  stockFundamentals,
} from "@/mocks/assets";
import { buildNetWorthHistory, buildPriceHistory } from "@/mocks/series";
import {
  allocationTargets,
  expenseCategories,
  expenseEntries,
  journalEntries,
  marketContext,
  transactions,
  watchlist,
} from "@/mocks/records";
import { DEFAULT_SCORING_SETTINGS } from "@/lib/scoring/weights";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = arg("email");
const password = arg("password");

if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
if (!email || !password) {
  console.error("Uso: npm run seed -- --email voce@exemplo.com --password 'senha forte'");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function check(step: string, error: { message: string } | null) {
  if (error) {
    console.error(`✗ ${step}: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${step}`);
}

/** Insere em lotes: um INSERT com milhares de linhas estoura o limite da API. */
async function insertAll<T>(table: string, rows: T[], chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await db.from(table).insert(rows.slice(i, i + chunkSize) as any);
    if (error) {
      console.error(`✗ ${table}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${table} (${rows.length} linhas)`);
}

/* ------------------------------ 1. usuário ------------------------------- */

const { data: existing } = await db.auth.admin.listUsers();
let userId = existing?.users.find((u) => u.email === email)?.id;

if (userId) {
  console.log(`✓ usuário ${email} já existe`);
} else {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    // Sem servidor de e-mail configurado, confirmar aqui evita conta travada.
    email_confirm: true,
  });
  check(`usuário ${email} criado`, error);
  userId = data?.user?.id;
}

const user_id = userId!;

/* --------------------------- 2. limpa o anterior -------------------------- */

// `assets` cascateia para holdings, transactions, price_history, fundamentals,
// watchlist e journal — por isso basta apagar a raiz de cada árvore.
for (const table of [
  "assets",
  "institutions",
  "expense_entries",
  "expense_categories",
  "allocation_targets",
  "journal_entries",
  "net_worth_history",
  "scoring_settings",
]) {
  const { error } = await db.from(table).delete().eq("user_id", user_id);
  check(`limpeza de ${table}`, error);
}

/* ------------------------- 3. ids do mock -> uuid ------------------------- */

const institutionId = new Map(institutions.map((i) => [i.id, randomUUID()]));
const assetId = new Map(assets.map((a) => [a.id, randomUUID()]));
const categoryId = new Map(expenseCategories.map((c) => [c.id, randomUUID()]));

/* ------------------------------ 4. inserção ------------------------------ */

await insertAll(
  "institutions",
  institutions.map((i) => ({
    id: institutionId.get(i.id)!,
    user_id,
    name: i.name,
    provider: i.provider,
    status: i.status,
    last_sync_at: i.lastSyncAt,
  })),
);

await insertAll(
  "assets",
  assets.map((a) => ({
    id: assetId.get(a.id)!,
    user_id,
    institution_id: a.institutionId ? institutionId.get(a.institutionId) : null,
    symbol: a.symbol,
    name: a.name,
    asset_class: a.assetClass,
    currency: a.currency,
    sector: a.sector,
  })),
);

await insertAll(
  "holdings",
  holdings.map((h) => ({
    user_id,
    asset_id: assetId.get(h.assetId)!,
    quantity: h.quantity,
    average_price: h.averagePrice,
    last_price: h.lastPrice,
    day_change: h.dayChange,
  })),
);

await insertAll(
  "transactions",
  transactions.map((t) => ({
    user_id,
    asset_id: assetId.get(t.assetId)!,
    kind: t.kind,
    date: t.date,
    quantity: t.quantity,
    unit_price: t.unitPrice,
    fees: t.fees,
    source: t.source,
    external_id: t.externalId,
    notes: t.notes,
  })),
);

await insertAll(
  "price_history",
  buildPriceHistory().map((p) => ({
    user_id,
    asset_id: assetId.get(p.assetId)!,
    date: p.date,
    close: p.close,
    source: "brapi" as const,
  })),
);

/** Fundamentos: o payload é o objeto de domínio sem os campos já colunados. */
const fundamentals = [
  ...stockFundamentals.map(({ assetId: id, referenceDate, ...payload }) => ({
    user_id,
    asset_id: assetId.get(id)!,
    reference_date: referenceDate,
    payload,
    source: "brapi" as const,
  })),
  ...fiiFundamentals.map(({ assetId: id, referenceDate, ...payload }) => ({
    user_id,
    asset_id: assetId.get(id)!,
    reference_date: referenceDate,
    payload,
    source: "brapi" as const,
  })),
  ...cryptoMetrics.map(({ assetId: id, referenceDate, ...payload }) => ({
    user_id,
    asset_id: assetId.get(id)!,
    reference_date: referenceDate,
    payload,
    source: "binance" as const,
  })),
  ...fixedIncomeTerms.map(({ assetId: id, ...payload }) => ({
    user_id,
    asset_id: assetId.get(id)!,
    reference_date: "2026-09-21",
    payload,
    source: "manual" as const,
  })),
  ...agroPositions.map(({ assetId: id, ...payload }) => ({
    user_id,
    asset_id: assetId.get(id)!,
    reference_date: "2026-09-21",
    payload,
    source: "manual" as const,
  })),
];

await insertAll("asset_fundamentals", fundamentals);

await insertAll(
  "expense_categories",
  expenseCategories.map((c) => ({
    id: categoryId.get(c.id)!,
    user_id,
    name: c.name,
    monthly_budget: c.monthlyBudget,
    color: c.color,
  })),
);

await insertAll(
  "expense_entries",
  expenseEntries.map((e) => ({
    user_id,
    category_id: categoryId.get(e.categoryId)!,
    date: e.date,
    description: e.description,
    amount: e.amount,
    source: e.source,
  })),
);

await insertAll(
  "allocation_targets",
  allocationTargets.map((t) => ({ user_id, asset_class: t.assetClass, target: t.target })),
);

await insertAll(
  "watchlist",
  watchlist.map((w) => ({
    user_id,
    asset_id: assetId.get(w.assetId)!,
    added_at: w.addedAt,
    target_price: w.targetPrice,
    notes: w.notes,
  })),
);

await insertAll(
  "journal_entries",
  journalEntries.map((j) => ({
    user_id,
    asset_id: j.assetId ? assetId.get(j.assetId)! : null,
    date: j.date,
    title: j.title,
    body: j.body,
    tags: j.tags,
  })),
);

await insertAll(
  "net_worth_history",
  buildNetWorthHistory().map((p) => ({
    user_id,
    date: p.date,
    total: p.total,
    contributed: p.contributed,
    by_class: p.byClass,
  })),
);

// O contexto de mercado viaja junto das configurações até a Fase 3 trazer CDI
// e dólar de fonte oficial.
await insertAll("scoring_settings", [
  { user_id, settings: { ...DEFAULT_SCORING_SETTINGS, market: marketContext } },
]);

console.log(`\nPronto. Entre em /entrar com ${email}.`);
