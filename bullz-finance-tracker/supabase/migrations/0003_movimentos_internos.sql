-- 0003 · Marco 3 · movimento interno (realocação sem dinheiro novo)
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.

create table if not exists public.movimentos_internos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  data               date not null,
  origem_tipo        text not null check (origem_tipo in ('ativo','titulo_rf','pote','agro_lote')),
  origem_id          text not null check (length(origem_id) between 1 and 80),
  origem_quantidade  numeric,
  origem_preco       numeric,
  destino_tipo       text not null check (destino_tipo in ('ativo','titulo_rf','pote','agro_lote')),
  destino_id         text not null check (length(destino_id) between 1 and 80),
  destino_quantidade numeric,
  destino_preco      numeric,
  custos             jsonb not null default '{}',   -- {taxa, spread, saque, impostos}
  observacao         text not null default '' check (length(observacao) <= 160),
  criado_em          timestamptz not null default now()
);
create index if not exists mov_internos_user_idx on public.movimentos_internos (user_id, data);
select privado.politicas_padrao('movimentos_internos');

-- os lançamentos gerados apontam para o movimento (não são aporte)
alter table public.aportes add column if not exists movimento_interno_id uuid references public.movimentos_internos on delete set null;
alter table public.potes_movimentos add column if not exists movimento_interno_id uuid references public.movimentos_internos on delete set null;
alter table public.agro_movimentos add column if not exists movimento_interno_id uuid references public.movimentos_internos on delete set null;

notify pgrst, 'reload schema';
