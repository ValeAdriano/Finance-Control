-- =============================================================================
-- Aponta o agendamento para a rota da aplicação
--
-- Os jobs criados em `..._jobs.sql` chamavam Edge Functions que nunca
-- existiram — ficavam falhando em silêncio. A lógica de sync vive em
-- TypeScript, usada pela interface; duplicá-la em Deno só criaria duas
-- versões para divergirem.
--
-- Antes de valer, dois segredos precisam existir no Vault:
--
--   select vault.create_secret('https://SEU-APP.vercel.app', 'app_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
--
-- O `cron_secret` é o mesmo valor da variável CRON_SECRET da aplicação.
-- =============================================================================

select cron.unschedule('sync-quotes');
select cron.unschedule('sync-open-finance');

-- Cotação em dia útil, dentro do pregão. A frequência é deliberada: a brapi
-- dá 15.000 requisições por ciclo mensal.
select cron.schedule(
  'sync-quotes',
  '0 13,17,21 * * 1-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
           || '/api/cron/sync?provider=brapi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Binance negocia todo dia, inclusive fim de semana.
select cron.schedule(
  'sync-binance',
  '0 12 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
           || '/api/cron/sync?provider=binance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);
