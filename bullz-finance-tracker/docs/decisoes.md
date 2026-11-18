# Decisões

Registro das escolhas feitas durante a execução do plano de evolução. Cada uma é a opção mais simples e reversível.

## D-001 · Onde ficam os documentos (M0)
`docs/`, `content/` e `seed/` ficam dentro de `bullz-finance-tracker/`, junto do `package.json`, porque todos os scripts rodam dali.

## D-002 · Scripts de verificação (M0)
Criados `npm run typecheck` (`tsc --noEmit`), `npm run build` (`expo export -p web`) e `npm run verifica` (os quatro em sequência).

## D-003 · Migrations e o deploy automático (M0)
- O banco segue com `supabase/schema.sql` como fonte completa e idempotente. Cada marco que cria tabela também grava `supabase/migrations/NNNN_<nome>.sql` com **só** o DDL novo, aditivo e idempotente (`create ... if not exists`, `add column if not exists`).
- O mesmo bloco entra no fim do `schema.sql`, para quem reaplica o arquivo inteiro.
- Nenhuma migration é aplicada em produção pelo agente. As pendentes ficam em `docs/progresso.md`.
- O push na `main` publica o app na Vercel antes das tabelas existirem. Por isso a leitura de tabela nova passa por `FC.db.opcional(tabela)` (`nucleo/supa.js`), que devolve lista vazia quando o PostgREST responde que a tabela não existe (`PGRST205`, `42P01`). Sem a tabela, o app se comporta como antes. Gravação em tabela inexistente devolve um erro legível ("aplique a migration NNNN").
- As Edge Functions não são publicadas pelo push. Mudanças no MCP ficam listadas em `docs/progresso.md` para publicação manual.

## D-004 · Políticas das tabelas novas (M1)
Toda tabela nova recebe o mesmo conjunto das tabelas existentes, por uma função `privado.politicas_padrao(tabela)`: `dono`, `exige 2fa` (restritiva) e `mcp le/insere/altera/apaga` (restritivas).
