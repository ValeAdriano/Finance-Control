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

## D-005 · `bolsa_e_cripto.valor` no MCP (M1)
`valor` passa a ser o valor das posições **com custo conhecido**, o mesmo conjunto de `custo` e `resultado` (antes somava todas e o resultado não fechava). O valor de todas as posições continua disponível em `valor_total`, com a lista `sem_custo`. Nome e tipo do campo não mudaram.

## D-006 · Fonte única do custo (M1)
O custo sai sempre dos lançamentos, com o preço por cota de `FC.carteira.precoDoLancamento`: o `preco` informado e, sem ele, `|valor| ÷ |quantidade|`. A mesma função alimenta a posição e a rentabilidade, por isso aplicado e custo batem. Só quando nenhum lançamento traz preço o custo vira `preço médio × quantidade`, marcado `custo_estimado`. O custo não é coluna do banco: o backfill idempotente (`supabase/backfills/0001_preco_dos_lancamentos.sql`) só grava o preço que já é calculado.

## D-007 · Retorno sem sentido (M1)
O Modified Dietz devolve `null` com `periodo_motivo` quando o capital médio fica abaixo de 10% do total aplicado no período (vendas ou aportes concentrados). O limite é a constante `DIETZ_BASE_MINIMA` em `rentabilidade.js`.

## D-008 · Cotação quebrada (M1)
Preço zero ou ausente sem erro da fonte marca o ativo com `cotacao_quebrada: true`. A nota vai para `score_bruto` e `score` fica `null`, o que tira o ativo de rankings, sugestões e da "melhor nota" sem mexer em cada tela. A posição fica sem valor até a cotação voltar.

## D-009 · Proventos e aporte (M1)
- `plano.destino_proventos` ∈ {`mesmo_ativo`, `caixa`, `pote:<id>`} é a fonte. Sem ele, sai do legado: caixa de proventos ligado → `caixa`; `reinvestir_dividendos: false` → `caixa`; senão `mesmo_ativo`. `reinvestir_dividendos` é derivado: verdadeiro para `mesmo_ativo` e para `caixa` com caixa de proventos ligado (o que sai do caixa para compras conta no mês, como antes).
- O plano do Salário é a fonte do aporte mensal. A projeção usa o plano sempre que ele existir, salvo `usar_plano: false` explícito. `premissas.aporte_mensal_fonte` diz qual vale.

## D-010 · Fim do ganho (M1)
`ganhos.fim` segue como o último mês com pagamento. Colunas novas: `data_fim_contrato` (para o proporcional do M5) e `data_ultimo_pagamento` (quando existe, vale no lugar de `fim` para a renda do mês).

## D-011 · Saldo dos potes (M2)
Um pote soma os títulos com o `pote_id` dele (título sem pote = livre), o caixa de proventos se `preferencias.proventos.pote_id` apontar para ele e os seus movimentos em `potes_movimentos`. Mover entre potes grava duas linhas de sinal contrário com o mesmo `transferencia_id`: o total não muda, então patrimônio e alocação não mudam. Dinheiro que entra de fora num pote (venda do gado, M3/M4) é uma linha sem par e soma no pilar caixa. O seed da migration põe no pote de reserva os títulos já marcados como reserva em `premissas.titulos`; o resto fica no livre, sem tocar em `renda_fixa`.

## D-012 · Conta sem potes (M2)
Conta nova não ganha potes no cadastro: a tela Potes oferece "Criar os potes" e o primeiro `mover_entre_potes` cria os padrões. Sem a tabela no banco, a tela explica e o MCP responde com a migration a aplicar.
