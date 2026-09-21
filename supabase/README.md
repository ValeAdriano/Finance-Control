# Supabase

Schema, RLS e agendamento do backend. Aplicado com a CLI do Supabase:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Migrações

| Arquivo           | O que faz                                                                               |
| ----------------- | --------------------------------------------------------------------------------------- |
| `0001_schema.sql` | Tabelas, tipos, índices e RLS em todas as tabelas                                       |
| `0002_jobs.sql`   | `pg_cron`: sync de cotação, Open Finance, snapshot de patrimônio, retenção e keep-alive |

## Decisões que o SQL assume

**RLS em tudo, sem exceção.** O bloco no fim de `0001` liga `row level security`
e `force row level security` em cada tabela e cria a policy por `user_id`. Tabela
nova entra nessa lista — sem policy, ela fica inacessível pela chave anon, que é
o default correto.

**Sync idempotente.** `transactions` e `expense_entries` têm índice único
parcial sobre `(user_id, source, external_id)`. Reimportar o mesmo extrato não
duplica lançamento; é só usar `on conflict do nothing` no upsert.

**Credencial cifrada.** `institutions.encrypted_credentials` guarda um blob
cifrado pela aplicação (AES-GCM com `TOKEN_ENCRYPTION_KEY`). O banco nunca vê a
chave da Binance nem o token da Pluggy em texto puro.

**Retenção obrigatória.** O plano free tem 500MB. `price_history` é append-only
e a única tabela que cresce sem limite, então `prune_price_history()` mantém o
dia a dia dos últimos 18 meses e, antes disso, só o fechamento mensal.

**Cron no Supabase, não na Vercel.** O plano Hobby da Vercel dispara cron uma
vez por dia — insuficiente para cotação e inútil para keep-alive.

## Segredos

As URLs das Edge Functions e a service role key ficam no Vault, lidas por
`vault.decrypted_secrets`:

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/sync-quotes', 'edge_sync_quotes_url');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/sync-pluggy', 'edge_sync_pluggy_url');
select vault.create_secret('<service-role-key>', 'service_role_key');
```

Nenhum desses valores entra em migração, commit ou variável `NEXT_PUBLIC_`.
