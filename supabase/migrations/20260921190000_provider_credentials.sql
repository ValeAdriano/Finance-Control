-- =============================================================================
-- Credenciais de integração, cadastradas pelo usuário na interface
--
-- Ficam fora de `institutions` porque nem toda credencial é de uma conta: o
-- token da brapi é do usuário, não de um banco. O que é por conta conectada
-- (o item da Pluggy) continua em `institutions`.
--
-- O par cifrado/IV nunca é lido pelo browser: só Server Action e Edge Function
-- decifram, e só para montar a chamada à API externa.
-- =============================================================================

create type credential_provider as enum ('binance', 'pluggy', 'brapi');

create table provider_credentials (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider credential_provider not null,

  -- Ciphertext AES-256-GCM (com a tag de autenticação no fim) e o IV.
  encrypted bytea not null,
  iv bytea not null,

  -- Prévia mascarada, só para o usuário reconhecer a chave que cadastrou.
  -- Nunca contém segredo inteiro.
  hint text,

  -- Resultado da última verificação contra a API do provedor.
  status text not null default 'nao_verificada'
    check (status in ('nao_verificada', 'valida', 'invalida', 'erro')),
  status_message text,
  last_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, provider)
);

alter table provider_credentials enable row level security;
alter table provider_credentials force row level security;

create policy provider_credentials_owner on provider_credentials
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger provider_credentials_updated_at before update on provider_credentials
  for each row execute function public.set_updated_at();

-- Registro de execução do sync, para a interface mostrar o que aconteceu e
-- para diagnosticar falha de integração sem abrir o log do servidor.
create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider credential_provider not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'rodando'
    check (status in ('rodando', 'sucesso', 'parcial', 'erro')),
  -- Quantos registros entraram, foram atualizados e foram ignorados por já
  -- existirem — o número de ignorados é o que prova que o sync é idempotente.
  inserted integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  message text
);

alter table sync_runs enable row level security;
alter table sync_runs force row level security;

create policy sync_runs_owner on sync_runs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index sync_runs_user_started_idx on sync_runs (user_id, started_at desc);
