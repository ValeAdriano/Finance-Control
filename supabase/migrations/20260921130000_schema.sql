-- =============================================================================
-- Finance Control — schema inicial
--
-- Espelha `src/types/domain.ts`. Toda tabela tem `user_id` e RLS: a plataforma
-- é de uso pessoal, mas nada impede uma segunda conta, e uma tabela sem policy
-- vira vazamento silencioso no dia em que isso acontecer.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Tipos de domínio --------------------------------------------------------

create type asset_class as enum ('acao', 'fii', 'cripto', 'renda_fixa', 'agro');
create type currency_code as enum ('BRL', 'USD');
create type data_source as enum ('manual', 'pluggy', 'binance', 'brapi', 'nota_corretagem');
create type transaction_kind as enum (
  'compra', 'venda', 'dividendo', 'juros', 'aporte', 'resgate', 'taxa'
);
create type institution_status as enum ('conectada', 'expirada', 'erro', 'manual');
create type fixed_income_indexer as enum ('prefixado', 'cdi', 'ipca', 'selic');

-- Instituições ------------------------------------------------------------

create table institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  provider data_source not null default 'manual',
  status institution_status not null default 'manual',
  last_sync_at timestamptz,

  -- Credencial de terceiro NUNCA em texto puro. Gravada já cifrada pela
  -- aplicação (AES-GCM com TOKEN_ENCRYPTION_KEY); o banco só guarda o blob.
  encrypted_credentials bytea,
  credentials_iv bytea,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, name)
);

-- Ativos ------------------------------------------------------------------

create table assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references institutions (id) on delete set null,
  symbol text not null,
  name text not null,
  asset_class asset_class not null,
  currency currency_code not null default 'BRL',
  sector text,
  created_at timestamptz not null default now(),

  unique (user_id, symbol)
);

create index assets_user_class_idx on assets (user_id, asset_class);

-- Posição atual. Uma linha por ativo — o histórico mora em `transactions`.
create table holdings (
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  quantity numeric(20, 8) not null default 0,
  average_price numeric(20, 8) not null default 0,
  last_price numeric(20, 8) not null default 0,
  day_change numeric(10, 6) not null default 0,
  updated_at timestamptz not null default now(),

  primary key (user_id, asset_id)
);

-- Movimentações -----------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  kind transaction_kind not null,
  date date not null,
  quantity numeric(20, 8) not null,
  unit_price numeric(20, 8) not null,
  fees numeric(20, 8) not null default 0,
  source data_source not null default 'manual',

  -- Chave de deduplicação do sync. O índice parcial abaixo é o que torna o
  -- sync idempotente: reimportar o mesmo extrato não duplica lançamento.
  external_id text,

  notes text,
  created_at timestamptz not null default now()
);

create unique index transactions_external_unique
  on transactions (user_id, source, external_id)
  where external_id is not null;

create index transactions_user_date_idx on transactions (user_id, date desc);
create index transactions_asset_idx on transactions (asset_id, date desc);

-- Cotações ----------------------------------------------------------------

-- Append-only: cotação nunca é sobrescrita, só acrescentada. Com 500MB de
-- banco no plano free, a retenção é obrigatória — ver 0003_jobs.sql.
create table price_history (
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  date date not null,
  close numeric(20, 8) not null,
  source data_source not null,
  created_at timestamptz not null default now(),

  primary key (user_id, asset_id, date)
);

create index price_history_asset_date_idx on price_history (asset_id, date desc);

-- Fundamentos por classe --------------------------------------------------

-- Guardados como JSONB: o conjunto de indicadores muda conforme a fonte
-- evolui, e uma coluna por indicador exigiria migração a cada campo novo.
-- A validação de formato é feita com zod na borda da aplicação.
create table asset_fundamentals (
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  reference_date date not null,
  payload jsonb not null,
  source data_source not null default 'brapi',
  fetched_at timestamptz not null default now(),

  primary key (user_id, asset_id, reference_date)
);

-- Gastos ------------------------------------------------------------------

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  monthly_budget numeric(14, 2),
  color text not null default 'var(--chart-1)',

  unique (user_id, name)
);

create table expense_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references expense_categories (id) on delete set null,
  date date not null,
  description text not null,
  -- Positivo = entrada, negativo = saída.
  amount numeric(14, 2) not null,
  source data_source not null default 'manual',
  external_id text,
  created_at timestamptz not null default now()
);

create unique index expense_entries_external_unique
  on expense_entries (user_id, source, external_id)
  where external_id is not null;

create index expense_entries_user_date_idx on expense_entries (user_id, date desc);

-- Produto e decisão -------------------------------------------------------

create table allocation_targets (
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_class asset_class not null,
  -- Fração: 0.4 = 40%. A soma das metas é validada na aplicação.
  target numeric(5, 4) not null check (target >= 0 and target <= 1),

  primary key (user_id, asset_class)
);

create table watchlist (
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  added_at date not null default current_date,
  target_price numeric(20, 8),
  notes text,

  primary key (user_id, asset_id)
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid references assets (id) on delete set null,
  date date not null default current_date,
  title text not null,
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index journal_entries_user_date_idx on journal_entries (user_id, date desc);

-- Configuração do motor de score. Um registro por usuário.
create table scoring_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null,
  updated_at timestamptz not null default now()
);

-- Série de patrimônio, materializada uma vez por dia pelo pg_cron.
create table net_worth_history (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  total numeric(18, 2) not null,
  contributed numeric(18, 2) not null,
  by_class jsonb not null,

  primary key (user_id, date)
);

-- =============================================================================
-- Row Level Security
--
-- Ligada em TODAS as tabelas. Sem policy, a tabela fica inacessível pela chave
-- anon — que é o default seguro desejado.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'institutions', 'assets', 'holdings', 'transactions', 'price_history',
    'asset_fundamentals', 'expense_categories', 'expense_entries',
    'allocation_targets', 'watchlist', 'journal_entries', 'scoring_settings',
    'net_worth_history'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);

    execute format(
      'create policy %I on %I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end
$$;

-- `updated_at` automático onde a coluna existe.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger institutions_updated_at before update on institutions
  for each row execute function set_updated_at();
create trigger holdings_updated_at before update on holdings
  for each row execute function set_updated_at();
create trigger scoring_settings_updated_at before update on scoring_settings
  for each row execute function set_updated_at();
