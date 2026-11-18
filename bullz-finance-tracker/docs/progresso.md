# Progresso do plano de evolução

Plano: `PLANO-BULLZ-EVOLUCAO.md` (M0 a M15). Um commit por marco, direto na `main`.

## Migrations pendentes de produção (aplicar nesta ordem)

Nenhuma ainda.

## Edge Functions a publicar

Nenhuma ainda.

---

## M0 · Reconhecimento e linha de base (2026-11-18)

**Feito**
- Mapeamento em `docs/arquitetura-atual.md`: stack, tabelas, cálculos, ferramentas MCP, vídeo, onboarding.
- Scripts `typecheck`, `build` e `verifica` no `package.json`.
- `docs/decisoes.md` com as decisões D-001 a D-004.
- Pasta `supabase/migrations/` criada.

**Linha de base**: lint, tsc, 105 testes e build verdes na `main` (b2fcae0).

**Decisões**: o app é Expo/RN Web, não Next.js; migrations aditivas com leitura tolerante a tabela ausente (D-003).

**Pendências**: nenhuma.
