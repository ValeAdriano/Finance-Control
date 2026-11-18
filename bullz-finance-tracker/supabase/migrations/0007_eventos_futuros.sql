-- 0007 · Marco 7 · eventos futuros das projeções
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.
-- CDI e IPCA: a série já mora em indices_diarios (Banco Central/SGS) e é
-- completada todo dia pelo agendamento fc-registro-diario (Edge Function
-- mercado, acao registro_diario → atualizaIndices). Não há tabela nova.
create table if not exists public.eventos_futuros (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  data       date not null,
  tipo       text not null check (tipo in ('venda_agro','mudanca_renda','aporte_extra','resgate')),
  parametros jsonb not null default '{}',   -- {valor, destino, cabecas, aporte_mensal}
  descricao  text not null default '' check (length(descricao) <= 160),
  criado_em  timestamptz not null default now()
);
create index if not exists eventos_futuros_user_idx on public.eventos_futuros (user_id, data);
select privado.politicas_padrao('eventos_futuros');
notify pgrst, 'reload schema';
