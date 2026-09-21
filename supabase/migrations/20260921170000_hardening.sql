-- =============================================================================
-- Correções apontadas pelo linter de segurança do Supabase
-- (`npx supabase db advisors --linked`)
-- =============================================================================

-- 1. search_path fixo nas funções ----------------------------------------
--
-- Função sem `search_path` definido resolve nomes pelo search_path de quem
-- chama. Quem conseguir criar um schema na frente do caminho passa a decidir
-- qual tabela a função enxerga. O padrão seguro é `search_path = ''` e nome
-- totalmente qualificado dentro do corpo.

create or replace function public.prune_price_history()
returns void
language sql
set search_path = ''
as $$
  delete from public.price_history
  where date < current_date - interval '18 months'
    and date <> (date_trunc('month', date) + interval '1 month - 1 day')::date;
$$;

create or replace function public.keep_alive()
returns void
language sql
set search_path = ''
as $$
  select 1;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. pg_net fora do schema public ----------------------------------------
--
-- A extensão não suporta `alter extension ... set schema`, então a correção é
-- recriá-la no schema `extensions`. As funções continuam em `net` (é onde a
-- própria extensão as cria), e o `net.http_post` dos jobs segue funcionando.
--
-- Só recria se ainda estiver em public: rodar de novo não pode derrubar uma
-- fila de requisições em produção.
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_net' and n.nspname = 'public'
  ) then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end
$$;
