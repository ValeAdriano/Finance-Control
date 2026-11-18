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

## D-013 · Movimento interno na rentabilidade (M3)
Os lançamentos gerados por um movimento interno carregam `movimento_interno_id`. Os fluxos deles ficam marcados `interno` e saem do total da carteira (aplicado, devolvido, Dietz e TIR), mas continuam no resultado de cada ativo e de cada classe. O saldo dos potes fora de títulos entra no valor final do total; dinheiro que entra num pote sem movimento interno e sem transferência conta como aporte. Os custos do movimento (taxa, spread, saque, impostos) reduzem o líquido do destino, por isso aparecem como perda no total.

## D-014 · Preço padrão da origem (M3)
Sem `origem_preco`, a baixa de um ativo usa o preço de agora. A baixa de um título realiza o rendimento proporcional ao valor que sai. Destino de ativo sem quantidade nem preço usa o preço de agora para calcular as cotas.

## D-015 · Troca no rebanho (M4)
A troca é uma linha `tipo = 'troca'` em `agro_movimentos`. Na leitura, `FC.lotes.expandeTrocas` a desdobra numa venda totalmente reinvestida (receita = `valor_referencia_saida`) e numa compra (custo = `valor_referencia_entrada`). Assim o rebanho, o caixa do agro e a rentabilidade, que não conhecem a troca, contam certo, e a troca não vira aporte nem saque. O ciclo por lote (`FC.lotes.monta`) lê a linha bruta. Na listagem do app, a troca aparece como as duas linhas expandidas (ids `<id>:saida` e `<id>:entrada`); editar uma delas pelo app não funciona: edite a troca pelo MCP (`editar_registro`, tabela `agro_movimentos`, id da troca).

## D-016 · Lotes e suposições do backfill (M4)
- Toda compra abre um lote, salvo quando informa `lote_id` ou um `lote` (texto) igual ao de outra compra, que entram no mesmo lote.
- Venda, troca, morte e saída sem lote baixam dos lotes abertos mais antigos (PEPS), sem olhar a categoria. Cada baixa assim gera uma suposição listada (`FC.lotes.monta().suposicoes`).
- Nascimento e outra entrada sem lote entram no lote aberto mais recente.
- Custo sem lote fica em `custos_sem_lote` (não é rateado).
- O custo das cabeças que saem é o custo médio do lote naquele momento.
- O backfill (`scripts/backfill-lotes.js`) grava essas mesmas atribuições; sem `--grava`, só mostra.

## D-017 · Venda do agro com destino (M4)
Venda com `destino` grava: o movimento interno (origem `agro_lote`, destino o pote), a venda em `agro_movimentos` com `movimento_interno_id` (o saque dela sai do total da carteira), o depósito do líquido no pote e, com `reservar_ir`, uma transferência do IR estimado para o pote IR a pagar. O Funrural retido entra em `despesas` da venda. A alíquota de IR é `preferencias.agro.ir_aliquota` ou o parâmetro `ir_rural_aliquota_padrao`; o modo é `preferencias.agro.ir_modo` (`presuncao`, padrão, ou `livro_caixa`).

## D-018 · Renda do mês (M5)
- O `valor` de um ganho PJ é o faturamento bruto; o imposto sai à parte: `imposto_fixo_mensal` do ganho, senão `imposto_pct`, senão o parâmetro do regime (`das_mei_servicos` para MEI, `simples_aliquota_inicial` para Simples). Sem parâmetro, o imposto fica `null` e o ganho aparece em `impostos_sem_parametro`.
- Proporcional só com `proporcional: true` (ganhos antigos não mudam). A fração é dias cobertos ÷ dias do mês da competência, entre `inicio` e `data_fim_contrato`.
- `pagamento_mes_seguinte: true` desloca a competência um mês para trás: o estágio de novembro cai em dezembro.
- Total a investir no fixo + sobra = renda − impostos − despesas (nunca negativo); `sobra` = total − fixo e pode ser negativa (aí `falta_para_o_fixo` diz quanto). Mês fechado usa as despesas reais; mês corrente ou futuro usa o maior entre o lançado e o custo de vida previsto.
- Custo de vida = média dos 3 meses anteriores que têm despesa; sem nenhum, `objetivos.custo_vida_mensal`.
- Parcela executada = movimento interno com `parcelamento_id`; as pendentes são as parcelas até o mês, menos as executadas, na ordem.

## D-019 · Hierarquia (M6)
- Configuração em `preferencias.hierarquia` (coluna nova, migration 0006). `metas_fixas` continua o padrão: quem não escolher não vê nada mudar.
- "A divisão válida mais próxima" é a de menor distância quadrática numa grade de 0,5 p.p. que respeita faixas, piso e ordem e soma 100%.
- Divisão sugerida: RF no máximo da faixa se o pote de reserva está abaixo da meta; Cripto no mínimo se a carteira está fora da ordem; sem nenhum dos dois, o meio das faixas; Ações completa 100%. Se o resultado sair das faixas, vale a válida mais próxima.
- "Meses para corrigir" simula o aporte mensal do plano (ou a premissa) dividido pelo plano, se ele for válido, ou pela sugerida, com preços parados. Sem aporte, `null`.
- Reserva dinâmica: com ganho PJ ativo e `sem_13_ferias_fgts` diferente de `false`, sugere `meses_reserva_pj` (padrão 12) como alerta. A meta salva não muda.
- Os alertas da hierarquia só aparecem no modo `hierarquia`. O MCP sempre devolve a avaliação, com `modo_alocacao`.

## D-020 · Indicadores e taxas (M7)
- CDI e IPCA: o plano pedia uma tabela `indicadores` com job diário. Ela já existe como `indices_diarios`, preenchida pela Edge Function `mercado` a partir do SGS do Banco Central e completada todo dia pelo agendamento `fc-registro-diario`. O motor mensal lê dali (CDI e IPCA dos últimos 12 meses); sem a série, usa o macro do dia. Não criei tabela duplicada.
- `macro_longo_prazo` não foi sobrescrito: a projeção longa existente continua convergindo para o longo prazo dela. O motor mensal usa os indicadores de hoje.
- Taxas por ativo: retorno anualizado com proventos reinvestidos e DY médio, calculados do histórico de preço que o app já baixa (Yahoo pela Edge Function `mercado`; o plano cita brapi). Janela padrão de 5 anos; com menos de 0,9 ano de histórico, o ativo rende o CDI e a resposta diz isso. O cálculo é local e barato, então não criei o cache `taxas_historicas`: as taxas saem em cada projeção, com a fonte.
- Agro na projeção: fica parado no valor de hoje até um evento de venda; a venda entra líquida de Funrural (quando há parâmetro) no caixa.
- Aporte de cada mês: `FC.salario.metaDoMes` do mês futuro (no fixo + sobra, com o custo de vida previsto). Divisão: a do plano do Salário; no modo hierarquia ou sem destinos, a divisão sugerida (M6).
