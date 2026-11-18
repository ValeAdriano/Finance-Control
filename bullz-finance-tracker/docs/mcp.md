# Ferramentas MCP do Bullz

Gerado por `node scripts/gera-doc-mcp.mjs` a partir de `supabase/functions/mcp/ferramentas.mjs`. Não edite à mão.

Servidor: Edge Function `mcp` (ver `nucleo/README.md`, seção Conexão com IA). Valores em reais, datas AAAA-MM-DD, percentuais em %.

- **🆕** = nova no plano de evolução (M1 a M14). As 20 originais mantêm nome e tipo dos campos; só ganharam campos.
- Toda ferramenta nova de gravação aceita `simular: true`, que devolve o efeito sem gravar.
- Ferramentas que gravam exigem a conexão com permissão de edição.

| ferramenta | tipo | |
|---|---|---|
| [`resumo_patrimonio`](#resumo_patrimonio) | lê |  |
| [`listar_posicoes`](#listar_posicoes) | lê |  |
| [`detalhar_ativo`](#detalhar_ativo) | lê |  |
| [`listar_lancamentos`](#listar_lancamentos) | lê |  |
| [`listar_renda_fixa`](#listar_renda_fixa) | lê |  |
| [`rentabilidade`](#rentabilidade) | lê |  |
| [`dividendos`](#dividendos) | lê |  |
| [`agro_resumo`](#agro_resumo) | lê |  |
| [`agro_lancamentos`](#agro_lancamentos) | lê |  |
| [`salario_e_plano`](#salario_e_plano) | lê |  |
| [`historico_patrimonio`](#historico_patrimonio) | lê |  |
| [`preferencias`](#preferencias) | lê |  |
| [`listar_potes`](#listar_potes) | lê | 🆕 |
| [`simular_realocacao`](#simular_realocacao) | lê | 🆕 |
| [`projetar`](#projetar) | lê | 🆕 |
| [`listar_eventos`](#listar_eventos) | lê | 🆕 |
| [`listar_planos_mensais`](#listar_planos_mensais) | lê | 🆕 |
| [`detalhar_plano_mensal`](#detalhar_plano_mensal) | lê | 🆕 |
| [`listar_alertas`](#listar_alertas) | lê | 🆕 |
| [`apurar_ir`](#apurar_ir) | lê | 🆕 |
| [`auditar_dados`](#auditar_dados) | lê | 🆕 |
| [`registrar_lancamento`](#registrar_lancamento) | grava |  |
| [`salvar_ativo`](#salvar_ativo) | grava |  |
| [`salvar_titulo`](#salvar_titulo) | grava |  |
| [`salvar_ganho`](#salvar_ganho) | grava |  |
| [`registrar_agro`](#registrar_agro) | grava |  |
| [`planejar_venda_agro`](#planejar_venda_agro) | grava | 🆕 |
| [`atualizar_metas`](#atualizar_metas) | grava |  |
| [`mover_entre_potes`](#mover_entre_potes) | grava | 🆕 |
| [`registrar_movimento_interno`](#registrar_movimento_interno) | grava | 🆕 |
| [`registrar_despesa`](#registrar_despesa) | grava | 🆕 |
| [`registrar_parcelamento`](#registrar_parcelamento) | grava | 🆕 |
| [`configurar_alocacao`](#configurar_alocacao) | grava | 🆕 |
| [`registrar_evento`](#registrar_evento) | grava | 🆕 |
| [`gerar_plano_mensal`](#gerar_plano_mensal) | grava | 🆕 |
| [`editar_plano_mensal`](#editar_plano_mensal) | grava | 🆕 |
| [`ativar_plano_mensal`](#ativar_plano_mensal) | grava | 🆕 |
| [`fechar_plano_mensal`](#fechar_plano_mensal) | grava | 🆕 |
| [`reabrir_plano_mensal`](#reabrir_plano_mensal) | grava | 🆕 |
| [`reconstruir_planos_mensais`](#reconstruir_planos_mensais) | grava | 🆕 |
| [`criar_alerta_preco`](#criar_alerta_preco) | grava | 🆕 |
| [`criar_revisao`](#criar_revisao) | grava | 🆕 |
| [`editar_registro`](#editar_registro) | grava |  |
| [`apagar_registro`](#apagar_registro) | grava (apaga) |  |

## resumo_patrimonio

**Resumo do patrimônio** · só leitura

Patrimônio total em reais, quanto há em cada classe (bolsa, cripto, renda fixa, agro), alocação por pilar contra a meta, rentabilidade desde o início e os alertas da carteira. Comece por aqui para qualquer pergunta geral sobre os investimentos.

## listar_posicoes

**Posições em bolsa e cripto** · só leitura

Ações, FIIs, ETFs e criptomoedas: quantidade, preço médio, preço de agora, valor, resultado e a nota do ativo pelos critérios do dono. Use `lista: "watchlist"` para o que está só em observação.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `classe` | `acao_br` \| `etf_br` \| `fii` \| `acao_us` \| `etf_us` \| `cripto` |  | filtra por classe |
| `lista` | `carteira` \| `watchlist` \| `todas` |  | padrão: "carteira" |

## detalhar_ativo

**Detalhe de um ativo** · só leitura

Tudo sobre um ticker da carteira ou da watchlist: posição, lotes de compra, vendas realizadas, rentabilidade com proventos, indicadores com nota, proventos recebidos e a receber, e os últimos lançamentos.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `ticker` | string | sim | código do ativo em maiúsculas, ex.: ITSA4, MXRF11, BTC |

## listar_lancamentos

**Lançamentos (aportes, vendas, proventos)** · só leitura

Histórico de compras, vendas, proventos recebidos e movimentos de renda fixa, do mais recente para o mais antigo. Cada item traz o `id` usado por editar_registro e apagar_registro (tabela "aportes").

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `de` | string |  | data, AAAA-MM-DD |
| `ate` | string |  | data, AAAA-MM-DD |
| `ticker` | string |  | código do ativo em maiúsculas, ex.: ITSA4, MXRF11, BTC |
| `titulo` | string |  | nome do título de renda fixa |
| `tipo` | `compra` \| `venda` \| `provento` \| `aporte_renda_fixa` \| `resgate_renda_fixa` |  |  |
| `limite` | integer |  | quantos itens por página (até 200) |
| `pagina` | integer |  | padrão: 1 |

## listar_renda_fixa

**Títulos de renda fixa** · só leitura

CDBs, LCIs, Tesouro e afins: taxa, vencimento, quanto foi aplicado, saldo de hoje com o rendimento acumulado e o imposto estimado no resgate.

## rentabilidade

**Rentabilidade da carteira** · só leitura

Quanto a carteira rendeu desde o primeiro lançamento: aplicado, devolvido (vendas e proventos), valor de hoje, ganho, retorno no período e TIR ao ano. No total, por classe, por ativo e por título de renda fixa.

## dividendos

**Dividendos e proventos** · só leitura

Proventos da carteira: recebido nos últimos 12 meses e no ano, média mensal estimada, yield, o que cada ativo paga, o total por mês e os pagamentos já anunciados a receber.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `ano` | integer |  | ano dos totais por mês (padrão: o atual) |

## agro_resumo

**Resumo do agronegócio** · só leitura

Pecuária: rebanho por categoria, valor de hoje, quanto foi investido, vendas, custos, resultado e os indicadores do negócio (ganho de peso, mortalidade, custo por cabeça).

## agro_lancamentos

**Lançamentos do agro** · só leitura

Movimentos do rebanho (compra, venda, nascimento, morte…), custos e pesagens por período. Cada item traz o `id` e a `tabela` usados por editar_registro e apagar_registro.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `especie` | `movimentos` \| `custos` \| `pesagens` \| `todos` |  | padrão: "todos" |
| `de` | string |  | data, AAAA-MM-DD |
| `ate` | string |  | data, AAAA-MM-DD |
| `limite` | integer |  | quantos itens por página (até 200) |

## salario_e_plano

**Salário e plano do mês** · só leitura

Os ganhos cadastrados (salário, bônus, aluguel…), a renda do mês e o plano de investimento: quanto investir, quanto já foi aportado e o que falta.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `mes` | string |  | AAAA-MM (padrão: o mês atual) |

## historico_patrimonio

**Histórico do patrimônio** · só leitura

A evolução do patrimônio ao longo do tempo, pelas fotos diárias gravadas pelo app: total e cada classe. Períodos longos voltam resumidos em até `max_pontos` datas.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `de` | string |  | data, AAAA-MM-DD |
| `ate` | string |  | data, AAAA-MM-DD |
| `max_pontos` | integer |  | padrão: 60 |

## preferencias

**Metas e preferências** · só leitura

As metas de alocação por pilar, as premissas de projeção, o plano de investimento, a configuração do agro e os módulos ligados. `incluir_regras` traz também os critérios de avaliação dos ativos (resposta longa).

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `incluir_regras` | boolean |  | padrão: false |

## listar_potes 🆕

**Potes (finalidade do dinheiro)** · só leitura

A renda fixa separada por finalidade: reserva de emergência, oportunidade, oportunidade do agro, IR a pagar e livre. Saldo de cada pote, títulos dentro dele, meta e quanto falta. A reserva de emergência é medida só pelo pote dela; IR a pagar é dinheiro comprometido.

## simular_realocacao 🆕

**Simular uma realocação** · só leitura

Mostra o efeito de trocar um ativo por outro (ou por um título, ou mandar para um pote) sem gravar nada: alocação antes e depois, se a ordem RF › Ações › Cripto melhora ou piora, o resultado realizado na origem e o custo do destino.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `data` | string |  | AAAA-MM-DD (padrão: hoje) |
| `origem_tipo` | `ativo` \| `titulo_rf` \| `pote` \| `agro_lote` | sim |  |
| `origem_id` | string | sim | ativo: ticker · titulo_rf: nome ou id · pote: tipo, nome ou id |
| `origem_quantidade` | number | sim | ativo: cotas · titulo_rf e pote: valor em reais |
| `origem_preco` | number |  | ativo: preço da venda (padrão: o de agora) |
| `destino_tipo` | `ativo` \| `titulo_rf` \| `pote` | sim |  |
| `destino_id` | string | sim |  |
| `destino_quantidade` | number |  | ativo: cotas compradas |
| `destino_preco` | number |  | ativo: preço da compra |
| `destino_classe` | `acao_br` \| `etf_br` \| `fii` \| `acao_us` \| `etf_us` \| `cripto` |  | só para ativo de destino ainda não cadastrado |
| `custos` | object |  |  |
| `observacao` | string |  |  |
| `parcelamento_id` | string |  | executa a parcela pendente deste parcelamento (salario_e_plano.parcelas_pendentes) |

Exemplo:

```json
{ "origem_tipo": "ativo", "origem_id": "ETH", "origem_quantidade": 0.2, "destino_tipo": "pote", "destino_id": "oportunidade" }
```

## projetar 🆕

**Projeção mês a mês** · só leitura

Projeta a carteira mês a mês por ativo e por categoria (renda fixa, ações, cripto, agro), com o aporte de cada mês pelo plano do Salário, a divisão do plano ou da hierarquia, os eventos futuros (vendas planejadas do agro entram sozinhas) e um cenário: `historico` (taxa histórica de cada ativo com proventos reinvestidos), `so_proventos` (preço parado, só DY e CDI) ou `estresse` (histórico com choque na cripto, padrão −30%). Horizonte de 1 a 24 meses (`meses`) ou de 1 a 50 anos (`anos`, resumido por ano). `eventos` acrescenta eventos só nesta chamada. É estimativa, não promessa.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `meses` | integer |  |  |
| `anos` | integer |  |  |
| `cenario` | `historico` \| `so_proventos` \| `estresse` |  | padrão: "historico" |
| `choque_cripto` | number |  |  |
| `janela_anos` | integer |  | janela da taxa histórica (padrão 5) |
| `incluir_vendas_planejadas` | boolean |  | padrão: true |
| `eventos` | lista de object |  |  |

Exemplo:

```json
{ "meses": 12, "cenario": "estresse", "eventos": [{ "data": "2027-02-15", "tipo": "venda_agro", "valor": 36000, "cabecas": 6 }] }
```

## listar_eventos 🆕

**Eventos futuros das projeções** · só leitura

Os eventos que entram nas projeções: vendas planejadas do agro, mudanças de renda, aportes extras e resgates, salvos ou vindos dos lotes. Cada evento salvo traz o `id`.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `de` | string |  | data, AAAA-MM-DD |
| `ate` | string |  | data, AAAA-MM-DD |

## listar_planos_mensais 🆕

**Planos mensais (histórico)** · só leitura

Resumo de cada mês com plano salvo: status (rascunho, ativo, fechado), meta, aportado, % executado, fora do plano, sobra prevista e real e se a hierarquia foi respeitada. Do mais recente para o mais antigo.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `de` | string |  |  |
| `ate` | string |  |  |

## detalhar_plano_mensal 🆕

**Detalhe do plano de um mês** · só leitura

O plano de um mês: de onde vem cada número da renda, os destinos com previsto, aportado e desvio, os aportes atribuídos a cada destino, o que ficou fora do plano, o contexto do mês anterior e o log de reaberturas.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `mes` | string | sim |  |

## listar_alertas 🆕

**Alertas de preço e revisões** · só leitura

Os alertas de preço cadastrados (acima, abaixo ou empate com o preço médio), com o preço de agora, o alvo e se dispararia hoje; as revisões programadas (as vencidas primeiro) e as notificações recentes. Cada item traz o `id` (tabelas alertas_preco e revisoes em editar_registro e apagar_registro).

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `incluir_feitas` | boolean |  | padrão: false |

## apurar_ir 🆕

**IR estimado (renda variável, DARF, rural e relatório anual)** · só leitura

Estima o imposto das vendas de ações, ETFs, FIIs e cripto mês a mês (preço médio, isenções, day trade, compensação de prejuízo), monta os DARFs (valor, código, vencimento), consolida o IR rural do agro no ano e, com `relatorio: true`, o rascunho anual para a declaração (bens em 31/12, rendimentos isentos e tributáveis, resultado rural). Alíquotas e isenções vêm de parametros_fiscais pela vigência. É estimativa: a lista dos parâmetros usados vem junto.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `ano` | integer |  | padrão: o ano atual |
| `relatorio` | boolean |  | padrão: false |

Exemplo:

```json
{ "ano": 2026, "relatorio": true }
```

## auditar_dados 🆕

**Auditar os dados** · só leitura

Roda as checagens de coerência da conta (custo nulo, resultado que não fecha, retorno sem sentido, aplicado divergente, cotação quebrada, premissa de aporte duplicada, proventos ambíguos, fim de ganho divergente) e devolve as inconsistências encontradas. Só leitura. Lista vazia = nada a apontar.

Exemplo:

```json
{}
```

## registrar_lancamento

**Registrar compra, venda, provento ou renda fixa** · grava

Lança uma operação. compra/venda: `ticker`, `quantidade` e `preco` ou `valor` total (ativo novo numa compra precisa de `classe`). provento: `ticker` e `valor`. aporte_renda_fixa/resgate_renda_fixa: `titulo` (já cadastrado, veja listar_renda_fixa) e `valor`. Sempre confirme os números com a pessoa antes de chamar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `operacao` | `compra` \| `venda` \| `provento` \| `aporte_renda_fixa` \| `resgate_renda_fixa` | sim |  |
| `data` | string |  | AAAA-MM-DD (padrão: hoje) |
| `ticker` | string |  | código do ativo em maiúsculas, ex.: ITSA4, MXRF11, BTC |
| `quantidade` | number |  |  |
| `preco` | number |  | preço por cota |
| `valor` | number |  | valor total da operação, sempre positivo |
| `titulo` | string |  | nome do título de renda fixa |
| `classe` | `acao_br` \| `etf_br` \| `fii` \| `acao_us` \| `etf_us` \| `cripto` |  | só para ativo ainda não cadastrado |
| `pilar` | `acoes` \| `real_estate` \| `alternativos` \| `caixa` |  |  |
| `indexador` | `cdi` \| `selic` \| `ipca` \| `prefixado` |  | renda fixa: taxa própria deste aporte |
| `taxa` | number |  |  |
| `observacao` | string |  |  |
| `vender_acima_da_posicao` | boolean |  | permite vender mais do que a posição registrada |

## salvar_ativo

**Cadastrar ou atualizar um ativo** · grava

Cria um ativo (carteira ou watchlist) ou atualiza o cadastro de um que já existe, pelo ticker: classe, pilar, lista, posição inicial e preço médio. Compras e vendas do dia a dia vão em registrar_lancamento, não aqui.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `ticker` | string | sim | código do ativo em maiúsculas, ex.: ITSA4, MXRF11, BTC |
| `classe` | `acao_br` \| `etf_br` \| `fii` \| `acao_us` \| `etf_us` \| `cripto` |  |  |
| `pilar` | `acoes` \| `real_estate` \| `alternativos` \| `caixa` |  |  |
| `lista` | `carteira` \| `watchlist` |  |  |
| `quantidade` | number |  | posição inicial, fora dos lançamentos |
| `preco_medio` | number ou null |  |  |
| `data_base` | string ou null |  |  |

## salvar_titulo

**Cadastrar ou atualizar um título de renda fixa** · grava

Cria um título de renda fixa ou atualiza um existente, pelo nome. `tipo` cdi ou selic: taxa = % do índice; ipca: taxa = juro real ao ano; prefixado: taxa = % ao ano. Para um título novo que vai receber aportes, deixe valor_aplicado em 0 e lance os aportes com registrar_lancamento.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `nome` | string | sim |  |
| `novo_nome` | string |  | para renomear um título existente |
| `tipo` | `cdi` \| `selic` \| `ipca` \| `prefixado` |  |  |
| `taxa` | number,null |  |  |
| `vencimento` | string ou null |  |  |
| `valor_aplicado` | number |  |  |
| `pilar` | `acoes` \| `real_estate` \| `alternativos` \| `caixa` |  |  |
| `data_inicio` | string ou null |  |  |
| `pote_id` | string ou null |  | o pote do título (veja listar_potes); nulo = livre |

## salvar_ganho

**Cadastrar ou atualizar um ganho** · grava

Cria um ganho (salário, bônus, aluguel…) ou, com `id`, atualiza um existente. `tipo` recorrente vale todo mês entre `inicio` e `fim`; avulso vale só no mês de `inicio`. O valor é o líquido.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `id` | string |  | id do ganho a atualizar (veja salario_e_plano) |
| `nome` | string |  |  |
| `categoria` | `salario` \| `extra` \| `bonus` \| `decimo_terceiro` \| `ferias` \| `aluguel` \| `pro_labore` \| `outros` \| `pj` |  |  |
| `tipo` | `recorrente` \| `avulso` |  |  |
| `valor` | number |  |  |
| `inicio` | string |  | data, AAAA-MM-DD |
| `fim` | string ou null |  |  |
| `observacao` | string |  |  |
| `dia_regra` | `dia_fixo` \| `dia_util` \| `ultimo_dia_util` ou null |  |  |
| `dia_numero` | integer ou null |  |  |
| `data_fim_contrato` | string ou null |  | recorrente: quando o contrato termina (pode ser depois do último pagamento) |
| `data_ultimo_pagamento` | string ou null |  | recorrente: a data do último pagamento; vale no lugar de `fim` para a renda do mês |
| `regime` | `mei` \| `simples` \| `outro` |  | PJ: mei, simples ou outro |
| `imposto_fixo_mensal` | number ou null |  | PJ: DAS ou imposto fixo por mês |
| `imposto_pct` | number ou null |  | PJ: % sobre o faturamento |
| `sem_13_ferias_fgts` | boolean |  | PJ: sem 13º, férias e FGTS (padrão: true) |
| `proporcional` | boolean |  | paga pelos dias trabalhados quando começa ou termina no meio do mês |
| `pagamento_mes_seguinte` | boolean |  | o trabalho de um mês cai na conta no mês seguinte |

## registrar_agro

**Registrar movimento, custo ou pesagem do gado** · grava

Lança no agro. movimento: `tipo` (compra, venda, troca, nascimento, morte, entrada, saida, reclassificacao), `categoria`, `cabecas` e, em compra e venda, o preço (`preco_arroba` com `peso_medio_kg`, ou `preco_cabeca`, ou `valor_total`). troca: `cabecas_saida`, `cabecas_entrada`, `valor_referencia_saida` e `valor_referencia_entrada` (totais), `categoria` (sai) e `categoria_destino` (entra): fecha o ciclo das cabeças que saem e abre um lote novo. `lote_id` liga ao lote (veja agro_resumo); sem ele, a compra abre um lote e a saída baixa dos lotes mais antigos. venda com `destino` (pote): Funrural retido e o líquido vai para o pote como movimento interno; com `reservar_ir`, o IR estimado vai para o pote IR a pagar. custo: `categoria_custo` e `valor`. pesagem: `categoria`, `cabecas` e `peso_medio_kg`. `simular: true` mostra o efeito sem gravar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `especie` | `movimento` \| `custo` \| `pesagem` | sim |  |
| `data` | string |  | AAAA-MM-DD (padrão: hoje) |
| `tipo` | `compra` \| `venda` \| `nascimento` \| `morte` \| `entrada` \| `saida` \| `reclassificacao` \| `troca` |  |  |
| `categoria` | `bezerro` \| `bezerra` \| `garrote` \| `novilha` \| `boi_magro` \| `boi_gordo` \| `vaca` \| `touro` \| `outro` |  |  |
| `categoria_destino` | `bezerro` \| `bezerra` \| `garrote` \| `novilha` \| `boi_magro` \| `boi_gordo` \| `vaca` \| `touro` \| `outro` |  | reclassificacao e troca |
| `cabecas` | integer |  |  |
| `peso_medio_kg` | number |  |  |
| `preco_arroba` | number |  |  |
| `preco_cabeca` | number |  |  |
| `valor_total` | number |  |  |
| `despesas` | number |  | frete, comissão, Funrural da operação |
| `reinvestido` | number |  | venda: quanto do líquido fica no agro para as próximas compras |
| `categoria_custo` | `nutricao` \| `sanidade` \| `mao_de_obra` \| `arrendamento` \| `frete` \| `maquinas` \| `impostos` \| `outros` |  |  |
| `valor` | number |  | custo: o valor pago |
| `descricao` | string |  |  |
| `fazenda` | string |  |  |
| `lote` | string |  |  |
| `contraparte` | string |  |  |
| `observacao` | string |  |  |
| `lote_id` | string |  | o lote do movimento ou do custo (agro_resumo.lotes) |
| `cabecas_saida` | integer |  |  |
| `cabecas_entrada` | integer |  |  |
| `valor_referencia_saida` | number |  |  |
| `valor_referencia_entrada` | number |  |  |
| `destino` | string |  | venda: pote que recebe o líquido (tipo, nome ou id; ex.: oportunidade_agro) |
| `funrural_retido` | boolean |  | venda com destino: o comprador retém o Funrural |
| `reservar_ir` | boolean |  | venda com destino: separa o IR estimado no pote IR a pagar |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "especie": "movimento", "tipo": "troca", "categoria": "boi_magro", "categoria_destino": "bezerro", "cabecas_saida": 3, "cabecas_entrada": 6, "valor_referencia_saida": 18000, "valor_referencia_entrada": 18000 }
```

## planejar_venda_agro 🆕

**Planejar a venda de um lote do gado** · grava

Registra no lote a venda prevista (data, cabeças, preço esperado por cabeça, destino planejado) e, se quiser, a estimativa manual do valor por cabeça e se os custos estão inclusos no preço. Devolve a receita esperada, o Funrural e o IR estimados. A venda planejada alimenta as projeções. `lote` é o id ou o nome do lote (agro_resumo.lotes). `simular: true` não grava.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `lote` | string | sim |  |
| `data_prevista` | string |  | data, AAAA-MM-DD |
| `cabecas` | integer |  |  |
| `preco_esperado_cabeca` | number |  |  |
| `destino_planejado` | string |  | pote ou ativo de destino |
| `valor_estimado_cabeca` | number |  |  |
| `custos_inclusos_no_preco` | boolean |  |  |
| `nome` | string |  | nome do lote, para um lote que ainda não tem |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "lote": "Lote Primavera", "data_prevista": "2027-02-15", "preco_esperado_cabeca": 6000, "destino_planejado": "oportunidade_agro", "simular": true }
```

## atualizar_metas

**Atualizar as metas de alocação** · grava

Muda a meta de alocação por pilar, em % do patrimônio. Informe só os pilares que mudam; os outros ficam como estão. O total precisa fechar em 100.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `metas` | object | sim | pilar → % (acoes, real_estate, alternativos, caixa, agro) |

## mover_entre_potes 🆕

**Mover dinheiro entre potes** · grava

Muda a finalidade de um valor: tira de um pote e põe em outro (ex.: do livre para a reserva de emergência). O patrimônio e a alocação não mudam. `de` e `para` aceitam o id, o tipo (reserva_emergencia, oportunidade, oportunidade_agro, ir_a_pagar, livre) ou o nome. Com `simular: true` devolve o antes e o depois sem gravar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `de` | string | sim |  |
| `para` | string | sim |  |
| `valor` | number | sim |  |
| `data` | string |  | data, AAAA-MM-DD |
| `descricao` | string |  |  |
| `simular` | boolean |  | true: mostra o efeito e não grava |

Exemplo:

```json
{ "de": "livre", "para": "reserva_emergencia", "valor": 1000, "simular": true }
```

## registrar_movimento_interno 🆕

**Registrar um movimento interno (troca sem dinheiro novo)** · grava

Troca um ativo por outro sem dinheiro novo: BNB → ITUB4, cripto → CDB, saldo de pote → ação. Grava a baixa da origem (com resultado realizado pelo preço médio) e a entrada no destino com custo = valor líquido (bruto − custos), ligados pelo mesmo movimento. Não conta como aporte no Salário nem na TIR total. Use `simular: true` para ver o efeito antes; confirme com a pessoa antes de gravar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `data` | string |  | AAAA-MM-DD (padrão: hoje) |
| `origem_tipo` | `ativo` \| `titulo_rf` \| `pote` \| `agro_lote` | sim |  |
| `origem_id` | string | sim | ativo: ticker · titulo_rf: nome ou id · pote: tipo, nome ou id |
| `origem_quantidade` | number | sim | ativo: cotas · titulo_rf e pote: valor em reais |
| `origem_preco` | number |  | ativo: preço da venda (padrão: o de agora) |
| `destino_tipo` | `ativo` \| `titulo_rf` \| `pote` | sim |  |
| `destino_id` | string | sim |  |
| `destino_quantidade` | number |  | ativo: cotas compradas |
| `destino_preco` | number |  | ativo: preço da compra |
| `destino_classe` | `acao_br` \| `etf_br` \| `fii` \| `acao_us` \| `etf_us` \| `cripto` |  | só para ativo de destino ainda não cadastrado |
| `custos` | object |  |  |
| `observacao` | string |  |  |
| `parcelamento_id` | string |  | executa a parcela pendente deste parcelamento (salario_e_plano.parcelas_pendentes) |
| `simular` | boolean |  | true: mostra o efeito e não grava |

Exemplo:

```json
{ "origem_tipo": "ativo", "origem_id": "BTC", "origem_quantidade": 0.005, "destino_tipo": "titulo_rf", "destino_id": "Tesouro Selic 2029", "custos": { "taxa": 20 }, "simular": true }
```

## registrar_despesa 🆕

**Registrar uma despesa** · grava

Lança uma despesa do mês (moradia, alimentação, transporte…). `recorrente: true` repete todo mês a partir da data (até `fim`). O custo de vida do Bullz é a média dos últimos 3 meses de despesas. `simular: true` mostra o efeito sem gravar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `data` | string |  | data, AAAA-MM-DD |
| `categoria` | `moradia` \| `alimentacao` \| `transporte` \| `saude` \| `educacao` \| `lazer` \| `contas` \| `impostos` \| `outros` | sim |  |
| `valor` | number | sim |  |
| `descricao` | string |  |  |
| `recorrente` | boolean |  | padrão: false |
| `fim` | string |  | data, AAAA-MM-DD |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "categoria": "moradia", "valor": 3000, "recorrente": true }
```

## registrar_parcelamento 🆕

**Programar um aporte parcelado** · grava

Divide um valor em N parcelas mensais que saem de um pote para um destino (ativo, título ou pote). Cada mês aparece uma parcela pendente em salario_e_plano; executar a parcela é um movimento interno (não é aporte novo). `inicio` é o mês da 1ª parcela. `simular: true` não grava.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `descricao` | string |  |  |
| `valor_total` | number | sim |  |
| `n_parcelas` | integer | sim |  |
| `inicio` | string | sim | data, AAAA-MM-DD |
| `destino_tipo` | `ativo` \| `titulo_rf` \| `pote` | sim |  |
| `destino_id` | string | sim |  |
| `pote` | string | sim | pote de onde sai (tipo, nome ou id) |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "valor_total": 6000, "n_parcelas": 6, "inicio": "2027-01-01", "destino_tipo": "titulo_rf", "destino_id": "Tesouro Selic 2029", "pote": "oportunidade", "simular": true }
```

## configurar_alocacao 🆕

**Configurar o modo de alocação** · grava

Escolhe entre `metas_fixas` (metas por pilar, como sempre) e `hierarquia` (RF › Ações › Cripto com faixas: RF 45–70% com piso de 40%, Ações 22–38% e nunca acima da RF, Cripto 5–17% e nunca acima de Ações). Faixas e meses de reserva para renda PJ são opcionais. `simular: true` mostra a avaliação da carteira e do plano sem gravar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `modo_alocacao` | `metas_fixas` \| `hierarquia` | sim |  |
| `faixas` | object |  |  |
| `meses_reserva_pj` | integer |  |  |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "modo_alocacao": "hierarquia", "simular": true }
```

## registrar_evento 🆕

**Registrar um evento futuro** · grava

Guarda um evento que muda as projeções: venda_agro (valor, cabecas), mudanca_renda (aporte_mensal a partir da data), aporte_extra (valor, destino) ou resgate (valor). `simular: true` devolve o total projetado no mês do evento com e sem ele, sem gravar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `data` | string | sim | data, AAAA-MM-DD |
| `tipo` | `venda_agro` \| `mudanca_renda` \| `aporte_extra` \| `resgate` | sim |  |
| `valor` | number |  | venda_agro, aporte_extra, resgate: o valor |
| `destino` | string |  | ticker, rf:<título> ou caixa (padrão: a divisão do plano) |
| `cabecas` | integer |  | venda_agro: cabeças vendidas |
| `aporte_mensal` | number |  | mudanca_renda: o aporte mensal a partir da data |
| `descricao` | string |  |  |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "data": "2027-03-10", "tipo": "aporte_extra", "valor": 5000, "simular": true }
```

## gerar_plano_mensal 🆕

**Gerar o plano de um mês** · grava

Cria o rascunho do plano de um mês a partir dos ganhos previstos (com proporcional e eventos), impostos, despesas (média de 3 meses), o modo do plano global, a divisão sugerida pela hierarquia e pela reserva, as parcelas pendentes e os ativos de maior nota (sem cotação quebrada). Mostra de onde vem cada número e o desvio do mês anterior. Se já existe plano para o mês, devolve o existente. `simular: true` não grava.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `mes` | string | sim |  |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "mes": "2026-12", "simular": true }
```

## editar_plano_mensal 🆕

**Editar o rascunho do plano do mês** · grava

Ajusta um rascunho: destinos (lista completa, com tipo categoria|ativo|titulo_rf|pote|parcela, alvo, pct e valor), meta_total, valor_fixo e observação. Só rascunho: plano ativo ou fechado só muda depois de reabrir. A divisão é validada pela hierarquia (aviso, a trava fica na ativação). `simular: true` não grava.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `mes` | string | sim |  |
| `destinos` | lista de object |  |  |
| `meta_total` | number |  |  |
| `valor_fixo` | number |  |  |
| `observacao` | string |  |  |
| `simular` | boolean |  | padrão: false |

## ativar_plano_mensal 🆕

**Ativar o plano do mês** · grava

Congela o rascunho: previsto, destinos e o retrato das regras (faixas, reserva, carteira). Depois disso mudar as preferências não altera o mês. Se a divisão viola a hierarquia, só ativa com `aceitar_violacao: true` (fica registrado). Um mês ativo por vez: se outro estiver ativo, ele é fechado antes, com aviso. `simular: true` não grava.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `mes` | string | sim |  |
| `aceitar_violacao` | boolean |  | padrão: false |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "mes": "2026-12", "aceitar_violacao": false }
```

## fechar_plano_mensal 🆕

**Fechar o plano do mês** · grava

Apura o realizado (renda, impostos, despesas, sobra, aportado, execução por destino e fora do plano) e fecha o mês. Depois de fechado, só muda reabrindo. O agendamento fecha sozinho no dia 1º do mês seguinte. `simular: true` mostra a apuração sem gravar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `mes` | string | sim |  |
| `simular` | boolean |  | padrão: false |

## reabrir_plano_mensal 🆕

**Reabrir o plano de um mês** · grava

Reabre um plano fechado (volta a ativo) para corrigir algo. Exige um motivo, que fica no log do mês. `simular: true` não grava.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `mes` | string | sim |  |
| `motivo` | string | sim |  |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "mes": "2026-11", "motivo": "lançamento esquecido" }
```

## reconstruir_planos_mensais 🆕

**Reconstruir planos de meses passados** · grava

Backfill: para cada mês passado com dados e sem plano salvo, reconstrói o plano como fechado (origem reconstruido) pelos ganhos e lançamentos daquele mês e o plano global. Mês que já tem plano fica como está. `simular: true` não grava.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `meses` | lista de string | sim |  |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "meses": ["2026-10", "2026-11"], "simular": true }
```

## criar_alerta_preco 🆕

**Criar um alerta de preço** · grava

Avisa quando o preço de um ativo da carteira passar de um valor (`acima`), cair abaixo dele (`abaixo`) ou voltar ao preço médio da posição (`empate`, sem valor). O aviso aparece nos alertas do app; o agendamento avalia depois de cada registro diário de cotações. `simular: true` mostra se dispararia hoje, sem gravar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `ticker` | string | sim | código do ativo em maiúsculas, ex.: ITSA4, MXRF11, BTC |
| `condicao` | `acima` \| `abaixo` \| `empate` | sim |  |
| `valor` | number |  | acima e abaixo: o preço alvo |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "ticker": "ETH", "condicao": "empate" }
```

## criar_revisao 🆕

**Programar uma revisão** · grava

Agenda uma pergunta para rever um ativo ou um tema numa data (ex.: "o BNB ainda faz sentido?" em 01/03). Na data, ela aparece nos alertas do resumo até ser marcada como feita (editar_registro, tabela revisoes, campo feita). `simular: true` não grava.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `ticker` | string |  | código do ativo em maiúsculas, ex.: ITSA4, MXRF11, BTC |
| `tema` | string |  |  |
| `data` | string | sim | data, AAAA-MM-DD |
| `pergunta` | string | sim |  |
| `simular` | boolean |  | padrão: false |

Exemplo:

```json
{ "ticker": "ETH", "data": "2027-03-01", "pergunta": "A tese ainda vale?" }
```

## editar_registro

**Corrigir um registro** · grava

Altera campos de um registro existente, pelo id que as ferramentas de listagem devolvem. Tabelas: aportes, ativos, renda_fixa, ganhos, agro_movimentos, agro_custos, agro_pesagens, agro_lotes, despesas, parcelamentos, eventos_futuros, alertas_preco, revisoes. Informe em `campos` só o que muda. Numa venda, quantidade e valor são negativos.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `tabela` | `aportes` \| `ativos` \| `renda_fixa` \| `ganhos` \| `agro_movimentos` \| `agro_custos` \| `agro_pesagens` \| `agro_lotes` \| `despesas` \| `parcelamentos` \| `eventos_futuros` \| `alertas_preco` \| `revisoes` | sim |  |
| `id` | string ou integer | sim |  |
| `campos` | object | sim |  |

## apagar_registro

**Apagar um registro** · grava

Apaga UM registro, pelo id. Não tem volta. Tabelas: aportes, ativos, renda_fixa, ganhos, agro_movimentos, agro_custos, agro_pesagens, agro_lotes, despesas, parcelamentos, eventos_futuros, alertas_preco, revisoes. Apagar um ativo ou um título não apaga os lançamentos dele. Mostre à pessoa o que vai ser apagado e peça a confirmação antes de chamar.

| parâmetro | tipo | obrigatório | descrição |
|---|---|---|---|
| `tabela` | `aportes` \| `ativos` \| `renda_fixa` \| `ganhos` \| `agro_movimentos` \| `agro_custos` \| `agro_pesagens` \| `agro_lotes` \| `despesas` \| `parcelamentos` \| `eventos_futuros` \| `alertas_preco` \| `revisoes` | sim |  |
| `id` | string ou integer | sim |  |
