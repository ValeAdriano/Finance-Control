-- =============================================================================
-- Agendamento e retenção
--
-- O cron fica no Supabase, não na Vercel: o plano Hobby da Vercel só permite
-- um disparo por dia, o que não serve para atualizar cotação nem para manter o
-- projeto Supabase acordado.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Retenção de cotação -----------------------------------------------------

-- O plano free tem 500MB de banco. `price_history` é a única tabela que cresce
-- sem limite (um ponto por ativo por dia, para sempre), então mantém-se o dia
-- a dia recente e só o fechamento mensal no que é antigo.
create or replace function prune_price_history()
returns void
language sql
as $$
  delete from price_history
  where date < current_date - interval '18 months'
    and date <> (date_trunc('month', date) + interval '1 month - 1 day')::date;
$$;

select cron.schedule(
  'prune-price-history',
  '0 4 1 * *', -- 04:00 do dia 1 de cada mês
  $$ select prune_price_history() $$
);

-- Keep-alive --------------------------------------------------------------

-- Projeto free pausa depois de uma semana sem atividade. Uma leitura barata
-- por dia é suficiente para manter o projeto ativo.
create or replace function keep_alive()
returns void
language sql
as $$
  select 1;
$$;

select cron.schedule('keep-alive', '0 9 * * *', $$ select keep_alive() $$);

-- Sincronização -----------------------------------------------------------

-- As Edge Functions fazem a chamada externa (brapi, Binance, Pluggy); o cron
-- só as dispara. A URL e a chave de serviço ficam em
-- `vault.decrypted_secrets`, nunca no corpo da migração.
--
-- Cotação de ação/FII: 3x por dia em dia útil, dentro do pregão. A brapi
-- permite 15.000 requisições por ciclo mensal, então a frequência é deliberada,
-- e o resultado é sempre cacheado em `price_history`.
select cron.schedule(
  'sync-quotes',
  '0 13,17,21 * * 1-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_sync_quotes_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Open Finance atualiza a cada 24h do lado da Pluggy — puxar mais que uma vez
-- por dia só gastaria requisição.
select cron.schedule(
  'sync-open-finance',
  '30 10 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_sync_pluggy_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Fecha o patrimônio do dia em `net_worth_history`, depois do sync de cotação.
select cron.schedule(
  'snapshot-net-worth',
  '0 23 * * *',
  $$
  insert into net_worth_history (user_id, date, total, contributed, by_class)
  select
    h.user_id,
    current_date,
    sum(h.quantity * h.last_price),
    coalesce(sum(h.quantity * h.average_price), 0),
    jsonb_object_agg(a.asset_class, class_total.value)
  from holdings h
  join assets a on a.id = h.asset_id
  cross join lateral (
    select sum(h2.quantity * h2.last_price) as value
    from holdings h2
    join assets a2 on a2.id = h2.asset_id
    where h2.user_id = h.user_id and a2.asset_class = a.asset_class
  ) class_total
  group by h.user_id
  on conflict (user_id, date) do update
    set total = excluded.total,
        contributed = excluded.contributed,
        by_class = excluded.by_class
  $$
);
