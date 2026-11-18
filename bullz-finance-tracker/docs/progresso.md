# Progresso do plano de evolução

Plano: `PLANO-BULLZ-EVOLUCAO.md` (M0 a M15). Um commit por marco, direto na `main`.

## Migrations pendentes de produção (aplicar nesta ordem)

1. `supabase/migrations/0001_dados_m1.sql` (colunas de ganhos e `privado.politicas_padrao`)
2. backfill opcional: `supabase/backfills/0001_preco_dos_lancamentos.sql`
3. `supabase/migrations/0002_potes.sql` (potes, potes_movimentos, renda_fixa.pote_id, seed)
4. `supabase/migrations/0003_movimentos_internos.sql`
5. `supabase/migrations/0004_agro_lotes.sql` (parametros_fiscais com seed, agro_lotes, colunas de troca e lote)
6. backfill opcional: `node scripts/backfill-lotes.js` (simula) e `--grava`
7. `supabase/migrations/0005_renda_pj.sql` (ganhos PJ, despesas, parcelamentos, parâmetros de DAS e Simples)
8. `supabase/migrations/0006_hierarquia.sql` (preferencias.hierarquia)
9. `supabase/migrations/0007_eventos_futuros.sql`
10. `supabase/migrations/0008_planos_mensais.sql` (planos, log, colunas em aportes, agendamento `fc-fecha-planos`)
11. backfill: `reconstruir_planos_mensais` com `["2026-10", "2026-11"]` pelo MCP (simule antes)
12. `supabase/migrations/0009_alertas.sql` (alertas_preco, revisoes, notificacoes, agendamento `fc-avalia-alertas`)
13. `supabase/migrations/0010_parametros_ir.sql` (seed dos parâmetros de IR da renda variável)

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

## M3 · Movimento interno (2026-11-18)

**Feito**
- `nucleo/modelo/movimentos.js`: `planeja` monta a baixa da origem (ativo, título, pote, lote do agro) e a entrada no destino (ativo, título, pote) com o mesmo id; resultado realizado pelo preço médio; destino com custo = líquido; alocação antes e depois e efeito na ordem RF › Ações › Cripto.
- Rentabilidade: fluxos internos fora do total, dentro do ativo e da classe (D-013). Salário: movimento interno não é aporte.
- MCP: `registrar_movimento_interno` (com `simular`) e `simular_realocacao`.
- Testes: `testes/movimentos-m3.test.js` (5), incluindo os dois critérios de aceite.

**Migrations**: `0003_movimentos_internos.sql`.

**Pendências**: sem tela própria no app ainda (pelo MCP). A troca de ativo entra na tela de aportes no M14, junto do checklist.

## M4 · Agro por lote (2026-11-18)

**Feito**
- `nucleo/modelo/lotes.js`: ciclo por lote (compra → venda/troca/morte), baixa PEPS sem exigir categoria, resultado e dias por lote, avaliação estimativa > arroba (com `usa_peso`) > custo, alerta de custo zerado respeitando `custos_inclusos_no_preco`, vendas planejadas.
- Troca expandida em venda reinvestida + compra (D-015).
- Impostos rurais da venda com `parametros_fiscais` por vigência; sem parâmetro, `null` + motivo (`docs/parametros-fiscais.md`).
- MCP: `registrar_agro` com `tipo: troca`, `lote_id`, `destino`, `reservar_ir`, `simular`; `agro_resumo.lotes`, `vendas_planejadas`, `custos_sem_lote`; `planejar_venda_agro` (com `simular`); `agro_lotes` editável por `editar_registro`.
- Venda com destino vira movimento interno para o pote (D-017).
- `scripts/backfill-lotes.js` (idempotente, D-016).
- Testes: `testes/agro-m4.test.js` (6), com os dois critérios de aceite.

**Migrations**: `0004_agro_lotes.sql`.

**Pendências**: a tela do agro ainda mostra a troca como duas linhas e não tem a visão por lote; a visão por lote entra nas capturas do M11 por uma seção simples na tela do agro (a fazer lá).

## M5 · Renda PJ e plano "fixo + sobra" (2026-11-18)

**Feito**
- `nucleo/modelo/renda-mes.js`: valor do ganho no mês (proporcional e pagamento no mês seguinte), imposto do PJ, despesas do mês, custo de vida (média de 3 meses), fixo + sobra e parcelas pendentes (D-018).
- Salário: `rendaDoMes` com proporcional e impostos; modo `fixo_mais_sobra` em meta, plano do mês e projeção; parcelas pendentes no plano. Tela de Salário com o modo novo.
- MCP: `salario_e_plano` com fixo, sobra apurada, impostos, despesas, custo de vida e parcelas; `registrar_despesa` e `registrar_parcelamento` (com `simular`); `salvar_ganho` com regime, impostos, proporcional e pagamento no mês seguinte; `registrar_movimento_interno.parcelamento_id`.
- Testes: `testes/renda-m5.test.js` (5), com os dois critérios de aceite.

**Migrations**: `0005_renda_pj.sql`.

**Pendências**: o formulário de ganho do app ainda não tem os campos de PJ e proporcional (dá pelo MCP); a tela de despesas fica para o onboarding (M14), que pede custo de vida e despesas.

## M6 · Hierarquia de alocação (2026-11-18)

**Feito**
- `nucleo/modelo/hierarquia.js`: grupos RF/Ações/Cripto, violações (ordem, piso, faixas), divisão válida mais próxima, divisão do plano, divisão sugerida, meses para corrigir e reserva dinâmica (D-019).
- `preferencias.hierarquia` com padrão; alertas de plano fora da ordem, carteira fora da ordem e reserva sugerida.
- MCP: `resumo_patrimonio` com `modo_alocacao`, `ordem_respeitada`, `meses_para_corrigir`, `divisao_sugerida_aporte` e `hierarquia`; `configurar_alocacao` (com `simular`).
- Testes: `testes/hierarquia-m6.test.js` (5), com o critério de aceite da carteira real.

**Migrations**: `0006_hierarquia.sql`.

**Pendências**: a escolha do modo no app entra no onboarding (M14, passo "Como dividir").

## M7 · Projeções (2026-11-18)

**Feito**
- `nucleo/modelo/projecao-mensal.js`: indicadores (CDI/IPCA de `indices_diarios`), taxa histórica por ativo com proventos reinvestidos, motor mensal por ativo e categoria com aporte do plano, divisão do plano ou da hierarquia, eventos (venda do agro, mudança de renda, aporte extra, resgate) e cenários `historico`, `so_proventos` e `estresse`; resumo anual (D-020).
- Vendas planejadas do agro viram eventos automaticamente.
- MCP: `projetar` (1–24 meses ou 1–50 anos, cenário, eventos na chamada), `listar_eventos`, `registrar_evento` (com `simular`).
- `testes/conta-adriano.js`: fixture com os números da conta citados no plano (só para teste; o seed demo do M11 é outro).
- Testes: `testes/projecoes-m7.test.js` (5). Critérios de aceite: R$ 32.706,70 sem a venda do gado (alvo 33 mil, −0,9%) e R$ 69.908,46 com a venda (alvo 70 mil, −0,1%), com ações a 12% a.a. e cripto a 15% a.a. fixos no teste.

**Migrations**: `0007_eventos_futuros.sql`.

**Pendências**: a tela de Projeções ainda mostra só a projeção longa; a visão mensal com cenários entra no M11, junto das capturas.

## M8 · Plano mensal com histórico e execução (2026-11-18)

**Feito**
- `nucleo/modelo/plano-mensal.js`: previsto (renda com a origem de cada número, impostos, despesas, modo, meta), geração do rascunho (divisão da hierarquia ou do plano, sugestão de ativo por nota sem cotação quebrada, parcelas, desvio do mês anterior, eventos do mês), execução por destino com atribuição automática ou manual e `fora_do_plano`, validação pela hierarquia, snapshot das regras, realizado e reconstrução (D-021).
- MCP: `listar_planos_mensais`, `detalhar_plano_mensal`, `gerar_plano_mensal`, `editar_plano_mensal`, `ativar_plano_mensal`, `fechar_plano_mensal`, `reabrir_plano_mensal` (com motivo) e `reconstruir_planos_mensais`, todas as de gravação com `simular`; `salario_e_plano` com `plano_salvo` e o plano do mês salvo.
- Tela de Salário: linha do tempo por mês (status, meta × aportado, barras previsto × executado, selos), detalhe por destino com os aportes, ativar e fechar, "Criar plano de {mês}" e gráfico de 12 meses.
- Testes: `testes/plano-mensal-m8.test.js` (6), com os seis critérios de aceite.

**Migrations**: `0008_planos_mensais.sql`.

**Pendências**: reatribuir aporte e editar destinos do rascunho pela tela (hoje pelo MCP).

## M9 · Alertas e acompanhamento (2026-11-18)

**Feito**
- `nucleo/modelo/alertas-preco.js`: preço de empate, disparo em centavos (acima, abaixo, empate), avaliação contra as posições, revisões do dia e sugestão de empates para posições no prejuízo (D-022).
- Alertas do Início: disparos de preço, revisões vencidas e notificações não lidas.
- Banco: `privado.avalia_alertas_preco()` + agendamento `fc-avalia-alertas` grava em `notificacoes`.
- MCP: `listar_posicoes.preco_empate` e `alta_necessaria_pct`; `criar_alerta_preco` e `criar_revisao` (com `simular`); `listar_alertas`.
- **Validação das migrations num Postgres 16 real**: `testes/migrations-sql.test.js` (`npm run teste:banco`) aplica o `schema.sql` inteiro duas vezes sobre um Supabase de mentira e confere RLS, políticas, seed sem duplicar, checks, índice de um plano ativo, agendamentos e o fechamento automático. O `testes/mcp-sql.test.js` passou a recortar o schema antes das migrations.
- Testes: `testes/alertas-m9.test.js` (3), com o critério de aceite do BNB.

**Migrations**: `0009_alertas.sql`.

**Pendências**: tela para criar alerta no detalhe do ativo (hoje pelo MCP e pelo onboarding do M14).

## M10 · Módulo de IR (2026-11-18)

**Feito**
- `nucleo/modelo/ir.js`: vendas pelo preço médio com day trade, apuração mensal com isenções, alíquotas e compensação de prejuízo por natureza, DARF (valor, código, vencimento, mínimo acumulado), IR rural do ano e relatório anual (bens, rendimentos, renda variável, rural). Tudo `estimativa: true` com `parametros_usados` (D-023).
- Seed dos parâmetros em `0010_parametros_ir.sql`, documentado em `docs/parametros-fiscais.md`.
- MCP: `apurar_ir` (ano, `relatorio`).
- Testes: `testes/ir-m10.test.js` (5), com parâmetros de fixture; trocar o parâmetro muda o cálculo; vigência respeitada.

**Migrations**: `0010_parametros_ir.sql`.

**Pendências**: a tela de IRPF ainda mostra a apuração antiga (`FC.impostos`); trocar para `FC.ir` quando a migration estiver aplicada em produção.

## M11 · Conta demo e capturas automáticas (2026-11-18)

**Feito**
- `seed/demo/dados.js`: conta fictícia com RF em potes (reserva, oportunidade, IR a pagar), ações e FIIs com proventos, cripto com uma posição no prejuízo e alerta de empate, agro com lote comprado, troca e venda planejada, renda PJ + aluguel, despesas de 3 meses, 3 planos mensais fechados e 1 ativo, um movimento interno (cripto → RF), revisões e um evento futuro.
- `npm run seed:demo` (`scripts/seed-demo.js`), idempotente, só para dev.
- Modo `?fixture=demo` no app.
- `npm run capturas` (`scripts/capturas.mjs` + `scripts/capturas.config.ts`): 9 telas × desktop/celular × claro/escuro = 36 WebP em `public/capturas/` (1,1 MB), sem erro de console.
- Seções novas: projeção mês a mês com cenários, lotes do agro, "a ordem certa" e a tela de alertas.
- Testes: `testes/demo-m11.test.js` (3): seed duas vezes sem duplicar, nenhum valor da conta real, a demo exercita tudo e passa em `auditar_dados`.

**Pendências**: o seed não foi rodado contra um Supabase de dev (não há um neste ambiente); a simulação e o teste com o banco em memória cobrem a idempotência.

## M12 · Vídeo do tour (2026-11-18)

**Feito**
- `content/tour.ts`: 7 capítulos (0, 5, 11, 17, 23, 29 e 35 s; 41 s no total) com título, legenda, tela e seção.
- `npm run video:render` (`scripts/video-tour.mjs`): build com a conta demo, gravação quadro a quadro das telas reais, legenda embutida, `tour.mp4`, `tour.webm`, `tour-poster.webp` e `tour.vtt` em `public/video/` (1,68 MB) (D-025).
- Testes: `testes/tour-m12.test.js` (2): duração, ordem, arquivos gerados, `.vtt` igual à configuração e limite de 8 MB.

**Correção**: o commit do M11 foi feito com o lint quebrando (o bundle de `.capturas-build/` entrou no lint, e o `grep` no fim do pipe escondeu o erro). Corrigido no commit seguinte (`db3bb6f`). Dali em diante a verificação roda com `pipefail`.
