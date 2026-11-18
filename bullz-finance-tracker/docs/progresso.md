# Progresso do plano de evolução

Plano: `PLANO-BULLZ-EVOLUCAO.md` (M0 a M15). Um commit por marco, direto na `main`.

## Migrations pendentes de produção (aplicar nesta ordem)

1. `supabase/migrations/0001_dados_m1.sql` (colunas de ganhos e `privado.politicas_padrao`)
2. backfill opcional: `supabase/backfills/0001_preco_dos_lancamentos.sql`
3. `supabase/migrations/0002_potes.sql` (potes, potes_movimentos, renda_fixa.pote_id, seed)

## Edge Functions a publicar

- `mcp` (o núcleo e as ferramentas mudam a cada marco; publicar no fim com `npm run gera:mcp` + deploy)

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

## M1 · Correção dos bugs de dados (2026-11-18)

**Feito**
- Custo: preço por cota do lançamento = `preco` ou `|valor| ÷ |quantidade|` (`FC.carteira.precoDoLancamento`), usado pela posição e pela rentabilidade. Era a causa do custo nulo (BTC, SOL, BNB), do aplicado divergente e dos retornos absurdos: `Number(null)` virava preço zero.
- Sem preço em nenhum lançamento: custo = preço médio × quantidade, `custo_estimado: true`.
- Resumo: `atual_com_custo`, `sem_custo`, `cotacao_quebrada`; resultado sobre o mesmo conjunto. MCP: `bolsa_e_cripto.valor` no mesmo conjunto e `valor_total` novo (D-005).
- Modified Dietz devolve `null` + `periodo_motivo` quando o capital médio é pequeno demais (D-007). MCP: `retorno_motivo`.
- Cotação quebrada marcada e fora de notas e sugestões (D-008).
- Plano como fonte do aporte; `destino_proventos` explícito com o booleano derivado (D-009).
- Ganhos: `data_fim_contrato` e `data_ultimo_pagamento` (D-010), aceitos por `salvar_ganho` e `editar_registro`.
- `nucleo/modelo/auditoria.js` + ferramenta MCP `auditar_dados` (só leitura).
- Leitura tolerante a tabela ausente: `FC.db.opcional` (D-003).
- Testes: `testes/dados-m1.test.js` (11) e 2 novos em `testes/mcp.test.js`. O teste de catálogo agora confere o contrato das 20 ferramentas originais e exige `simular` nas novas de gravação.

**Migrations**: `0001_dados_m1.sql`.

**Pendências**: a tela de Salário ainda não edita `data_fim_contrato`/`data_ultimo_pagamento` (dá pelo MCP); entra no M5 com o proporcional.

## M2 · Potes com finalidade (2026-11-18)

**Feito**
- `nucleo/modelo/potes.js`: saldo por pote (títulos + caixa de proventos + movimentos), reserva medida só pelo pote de reserva, total comprometido com IR, transferência validada (D-011).
- Carteira: `dados.potes`; o dinheiro de fora dos títulos soma no pilar caixa. Alertas: reserva pelo pote e aviso de IR comprometido.
- MCP: `listar_potes`, `mover_entre_potes` (com `simular`), `resumo_patrimonio.potes`, `salvar_titulo.pote_id`.
- Tela `/potes` (saldo, reserva × meta, mover).
- Testes: `testes/potes-m2.test.js` (4). Ajudante `testes/mcp-req.js`; `testes/mcp-escritas.js` registra as ferramentas de gravação novas no teste de "só consulta".

**Migrations**: `0002_potes.sql`.

**Pendências**: a tela Potes ainda não está no menu (abre por `/potes` e pelos alertas); entra na navegação no M14 junto com o checklist.
