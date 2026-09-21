-- =============================================================================
-- Cotação de cripto sem chave
--
-- O endpoint de preço da Binance é público; só o saldo da conta exige API key.
-- Separar os dois jobs faz a carteira de cripto ficar avaliada a preço de
-- mercado mesmo para quem ainda não cadastrou (ou não quer cadastrar) chave.
--
-- Cripto negocia todo dia, inclusive fim de semana.
-- =============================================================================

select cron.schedule(
  'sync-crypto-prices',
  '0 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
           || '/api/cron/sync?provider=cripto-precos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);
