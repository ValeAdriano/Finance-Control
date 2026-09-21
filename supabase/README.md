# Supabase

Schema, RLS e agendamento do backend.

A CLI está instalada como dependência de desenvolvimento — use `npx supabase`,
não precisa instalar nada global.

```bash
npx supabase login                          # interativo: abre o navegador
./scripts/supabase-setup.sh <project-ref>   # conecta e aplica as migrações
```

O `project-ref` é o identificador na URL do painel:
`https://supabase.com/dashboard/project/<project-ref>`. Sem argumento, o script
lista os projetos da conta.

## Migrações

| Arquivo                     | O que faz                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `20260921130000_schema.sql` | Tabelas, tipos, índices e RLS em todas as tabelas                                       |
| `20260921130100_jobs.sql`   | `pg_cron`: sync de cotação, Open Finance, snapshot de patrimônio, retenção e keep-alive |

## Decisões que o SQL assume

**RLS em tudo, sem exceção.** O bloco no fim do schema liga `row level security`
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

## Antes de mexer no schema

Rode o linter depois de qualquer migração — ele pega coisa que passa no `db
push` mas é problema de segurança:

```bash
npx supabase db advisors --linked
```

Dois achados dele já viraram migração e valem como regra daqui pra frente:

- **Função sempre com `set search_path = ''`** e nome totalmente qualificado no
  corpo. Sem isso, quem puder criar um schema na frente do caminho decide qual
  tabela a função enxerga.
- **Extensão nunca no schema `public`.** `pg_net` não aceita `alter extension
... set schema`, então foi preciso recriá-la em `extensions`.

## Seed

```bash
npm run seed -- --email voce@exemplo.com --password 'senha forte'
```

Cria a conta (com e-mail já confirmado, já que não há SMTP configurado) e
carrega o conjunto de dados da Fase 1. É idempotente: apaga o dado do usuário
antes de inserir, então rodar de novo repõe o estado em vez de duplicar.

Usa a service role key e portanto ignora a RLS — é trabalho de sistema, não
requisição de usuário.

## Passo manual no painel

O linter aponta **Leaked Password Protection Disabled**, que é um toggle de
projeto e não sai em migração. Ative em
_Authentication > Policies > Password protection_: o Supabase passa a recusar
senha que apareça em vazamento conhecido (checagem contra o HaveIBeenPwned,
por prefixo de hash — a senha em si não sai do servidor).

O `supabase/config.toml` foi puxado do projeto real com `npx supabase config
pull`, então ele reflete o que está no ar. Antes de um `config push`, rode o
`pull` primeiro: o arquivo que o `supabase init` gera tem defaults que
sobrescreveriam configuração de produção.
