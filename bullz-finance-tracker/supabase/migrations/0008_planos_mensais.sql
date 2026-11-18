-- 0008 · Marco 8 · plano mensal com snapshot, execução e histórico
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.
create table if not exists public.planos_mensais (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users on delete cascade,
  mes                 text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status              text not null default 'rascunho' check (status in ('rascunho','ativo','fechado')),
  -- previsto (congelado na ativação)
  renda_prevista      jsonb not null default '[]',
  impostos_previstos  numeric,
  despesas_previstas  numeric,
  modo                text check (modo is null or modo in ('percentual','valor','fixo_mais_sobra')),
  valor_fixo          numeric,
  sobra_prevista      numeric,
  meta_total          numeric not null default 0,
  destinos            jsonb not null default '[]',   -- [{tipo, alvo, pct, valor}]
  regras_snapshot     jsonb,
  contexto            jsonb not null default '{}',   -- origem dos números, desvio do mês anterior, eventos
  -- realizado (fechamento)
  renda_real          numeric,
  impostos_reais      numeric,
  despesas_reais      numeric,
  sobra_real          numeric,
  aportado_total      numeric,
  execucao            jsonb,
  fora_do_plano       jsonb,
  origem              text not null default 'gerado' check (origem in ('gerado','manual','reconstruido')),
  observacao          text not null default '' check (length(observacao) <= 300),
  criado_em           timestamptz not null default now(),
  ativado_em          timestamptz,
  fechado_em          timestamptz,
  unique (user_id, mes)
);
select privado.politicas_padrao('planos_mensais');
-- um único mês ativo por conta
create unique index if not exists planos_mensais_um_ativo on public.planos_mensais (user_id) where status = 'ativo';

create table if not exists public.planos_mensais_log (
  id        bigint generated always as identity primary key,
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  plano_id  uuid not null references public.planos_mensais on delete cascade,
  quando    timestamptz not null default now(),
  quem      text not null default 'app' check (length(quem) <= 120),
  acao      text not null check (acao in ('reabrir','editar_fechado','fechar','ativar')),
  motivo    text not null default '' check (length(motivo) <= 300),
  detalhe   jsonb not null default '{}'
);
select privado.politicas_padrao('planos_mensais_log');

alter table public.aportes add column if not exists plano_mensal_id uuid references public.planos_mensais on delete set null;
alter table public.aportes add column if not exists destino_idx integer check (destino_idx is null or destino_idx >= 0);

-- fechamento automático: todo dia 1º, o plano ativo de um mês que já passou
-- vira fechado. O realizado é apurado pelo app/MCP na próxima leitura
-- (contexto.apurar = true), com o mesmo cálculo do fechamento manual.
create or replace function privado.fecha_planos_vencidos()
returns integer language sql security definer set search_path = '' as $$
  with f as (
    update public.planos_mensais
       set status = 'fechado', fechado_em = now(), contexto = contexto || '{"apurar": true, "fechado_por": "agendamento"}'::jsonb
     where status = 'ativo' and mes < to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM')
    returning 1)
  select count(*)::integer from f;
$$;
revoke all on function privado.fecha_planos_vencidos() from public, anon, authenticated;
select cron.unschedule('fc-fecha-planos') where exists (select 1 from cron.job where jobname = 'fc-fecha-planos');
select cron.schedule('fc-fecha-planos', '5 3 1 * *', $$select privado.fecha_planos_vencidos()$$);

notify pgrst, 'reload schema';
