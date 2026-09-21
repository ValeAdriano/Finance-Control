-- =============================================================================
-- Reagenda o sync de Open Finance para a rota da aplicação
--
-- O job antigo foi removido junto com as Edge Functions que nunca existiram.
-- A Pluggy atualiza os dados a cada 24h, então puxar mais de uma vez por dia
-- só gastaria requisição sem trazer nada novo.
-- =============================================================================

select cron.schedule(
  'sync-open-finance',
  '30 10 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
           || '/api/cron/sync?provider=pluggy',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);
