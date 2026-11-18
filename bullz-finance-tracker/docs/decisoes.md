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

## D-021 · Plano mensal (M8)
- `aportado_total` é o **cumprido**: por destino, o aportado até o previsto (o excesso num destino não cobre a falta de outro, como o Salário já fazia). Todo o dinheiro novo do mês fica em `investido_total`. Assim o backfill de nov/2026 fecha em R$ 1.290 (100%) mesmo com ações acima do previsto.
- Atribuição automática, nesta ordem: o destino informado no lançamento (`plano_mensal_id` + `destino_idx`), o ativo ou título igual, a categoria do ativo (RF, Ações, Cripto). Sem destino, `fora_do_plano`.
- Parcelas executadas cumprem o destino `parcela`, mas não entram no `aportado_total` (não são dinheiro novo).
- Mês fechado devolve a execução salva; mês aberto recalcula. Mudar preferências não mexe no salvo.
- A trava `aceitar_violacao` só vale no modo `hierarquia`. No modo `metas_fixas` o plano ativa sem validar a ordem.
- Backfill (`reconstruir_planos_mensais`): meta pelo plano global de hoje e pela renda do mês; cada ativo ou título que recebeu aporte vira um destino, com o previsto do destino do plano que ele casa (o próprio ativo, ou o pilar dele) repartido pelo executado. Aporte sem destino correspondente vai para `fora_do_plano`. Mês com plano salvo fica como está.
- Fechamento automático: `privado.fecha_planos_vencidos()` no pg_cron (`fc-fecha-planos`, dia 1º às 03:05 UTC) só muda o status e marca `contexto.apurar`; o realizado é apurado na próxima chamada de `fechar_plano_mensal` (ou pela tela, ao fechar). Motivo: o cálculo de execução mora no núcleo JS.
- Reatribuir um aporte a outro destino: pelo MCP (`editar_registro` em `aportes`, campos `plano_mensal_id` e `destino_idx`). A tela ainda não tem o botão.

## D-022 · Alertas (M9)
- "Empate" = o preço chega ao preço médio da posição (preço ≥ preço médio), comparado em centavos. O preço de empate em `listar_posicoes` é o preço médio; `alta_necessaria_pct` é quanto falta subir (0 quando já está acima).
- Canal: o Bullz não tem e-mail nem push. A entrega é in-app: os alertas que disparam com a cotação de agora aparecem na lista de alertas do Início (e em `resumo_patrimonio.alertas`); os disparos do agendamento vão para a tabela `notificacoes`.
- Agendamento `fc-avalia-alertas` às 21h40 UTC (18h40 de Brasília), meia hora depois do registro diário das 18h10, que grava o preço e o custo de cada ativo em `patrimonio_historico.ativos`. A função `privado.avalia_alertas_preco()` usa essa foto e dispara cada alerta no máximo uma vez a cada 20 horas.
- Revisões aparecem a partir da data até `feita = true`.

## D-023 · Módulo de IR (M10)
- Motor novo `nucleo/modelo/ir.js`, só com parâmetros de `parametros_fiscais` por vigência. A tela de IRPF existente (`FC.impostos.irpf`) segue para bens e rendimentos; o relatório anual junta os dois.
- Antes da migration 0004 existir no banco, valem os números que o app já usava, com `parametros_embutidos: true` na resposta. Motivo: o push vai ao ar antes das migrations e a tela de IRPF não pode zerar.
- Day trade: venda e compra do mesmo ativo no mesmo dia; a parte casada usa o preço médio das compras do dia. O resto da venda sai pelo preço médio da posição.
- Compensação de prejuízo por natureza: comum (ações + ETF), day trade e FII. Cripto não compensa. Ações isentas no mês: o ganho não entra, a perda entra.
- DARF abaixo de `darf_valor_minimo` acumula para o mês seguinte. Vencimento: último dia útil do mês seguinte.
- Exterior (Lei 14.754/2023) fica listado à parte (`exterior`), fora do DARF mensal.
- IR rural do ano: soma das vendas do agro do ano, por presunção (padrão) ou livro-caixa (receita − compras − custos do ano).
- O módulo `irpf` já era ligado por padrão em `preferencias.modulos` (`FC.resolveModulos`); não precisou mudar.

## D-024 · Conta demo e capturas (M11)
- Uma fonte só: `seed/demo/dados.js` monta a conta demo (datas relativas a hoje, ids fixos). O `npm run seed:demo` grava num Supabase de dev por upsert (idempotente) e recusa a URL de produção; sem variáveis, só simula. O app usa os mesmos dados no modo `?fixture=demo`.
- No modo demo a conta já tem 2FA, tour visto e telemetria respondida, para nada cobrir as telas.
- Capturas: build web com `EXPO_PUBLIC_FIXTURE=demo` em `.capturas-build/` (fora do git), servido localmente, fotografado pelo Playwright do ambiente (1440 e 390 px, claro e escuro) e convertido para WebP pelo ffmpeg. O script falha com qualquer erro de console. O Playwright não entrou nas dependências do app: quem roda as capturas instala à parte (`docs/conteudo.md`).
- As telas que faltavam para mostrar as funcionalidades novas entraram como seções: "Mês a mês" em Projeções, "Por lote" no Agro, "A ordem certa" no Salário e a tela `/alertas`.

## D-025 · Vídeo do tour (M12)
- O plano pedia para reaproveitar a ferramenta atual. A que existe (`nucleo/promo/promo.js` no palco) desenha um celular à mão no canvas e grava em tempo real pelo MediaRecorder do navegador. O item 4 do M12 proíbe mockup desenhado à mão, e a gravação em tempo real não é reprodutível. Por isso o tour é gravado das telas reais com a conta demo: o Playwright rola cada seção e salva quadro a quadro (20 fps, 1280×720, tema escuro), com o título do capítulo e a legenda escritos na própria página. O ffmpeg monta `tour.mp4` (H.264), `tour.webm` (VP9) e `tour-poster.webp`; o `tour.vtt` sai do mesmo texto. Remotion não foi necessário.
- Capítulos, tempos e legendas: só em `content/tour.ts` (lido pelo vídeo, pelo `.vtt` e pela home).
- Os arquivos ficam em `public/video/` (1,7 MB no total, longe do limite de 8 MB), servidos pela Vercel; o Storage do Supabase não foi necessário.
- Sem áudio.

## D-026 · Home pública (M13)
- O app é Expo/RN Web, sem Server Components. A home é **HTML estático gerado no build** (`scripts/gera-home.mjs`, a partir de `content/home.pt-BR.ts` e `content/tour.ts`): o `npm run build` faz o `expo export` e depois move o app para `dist/app.html` e grava a home em `dist/index.html`. No `vercel.json`, `buildCommand` virou `npm run build` e o rewrite de tudo foi de `/` para `/app`. A Vercel serve o arquivo primeiro: `/` é a home; `/inicio` e as outras rotas caem no app.
- Sem script inline (a CSP proíbe): `/home-sessao.js` (síncrono, ~300 bytes) manda quem já tem sessão (`localStorage["fc-sessao"]`) para `/inicio` e os links antigos `/#/rota` para `/rota`; `/home.js` cuida dos capítulos, dos vídeos e da colagem.
- Sem fotografia de paisagem: não há banco de imagens licenciado no projeto e não quis puxar foto de terceiros. O "céu noturno sobre o campo" é um degradê em CSS com o brilho do horizonte na cor do agro. O "vídeo de fundo" do hero é o próprio tour, no mockup de desktop, mudo e em loop, tocando só quando aparece; no celular, a captura da Início rola devagar.
- "Conecta com": só o que o Bullz usa hoje (B3, Binance, C6, PicPay por extrato; Banco Central, CVM, Fundamentus, CoinGecko como fontes). Rico e brapi, citados no plano, não são usados; ficaram fora. Só nomes, sem logos.
- A copy evita prometer o que não existe: não há chave de API da Binance (os extratos entram por arquivo) e o backup é em JSON (não há CSV). As promessas foram escritas assim.
- `robots.txt` libera só a home.
- Imagem Open Graph (`public/og-home.png`, 1200×630) gerada uma vez com o ffmpeg a partir da captura da Início; fica no git porque o build da Vercel não tem ffmpeg.
- O gerador lê os `.ts` transpilando com o TypeScript do projeto (`scripts/le-ts.mjs`), para não depender da versão do Node da Vercel.
- **Conferir depois do deploy**: que `/` mostra a home e `/inicio` abre o app. O comportamento foi testado com um servidor local que imita a Vercel, não na Vercel.

## D-027 · Onboarding (M14)
- O onboarding de configuração (`/configurar`, 9 passos) vale para **conta nova** (sem ativos, títulos, lançamentos nem ganhos na primeira entrada). Ele passa na frente do questionário de perfil e do tour antigos, que continuam disponíveis em Ajustes e no Perfil. O passo "Perfil" grava um perfil simples (`premissas.perfil_simples`: conservador, moderado ou arrojado, e o horizonte); o questionário completo segue opcional.
- Conta que já existia: `existente: true` na primeira entrada depois do deploy; não vê o onboarding, só o checklist com as novidades (potes, hierarquia, plano mensal, agro por lote, alertas).
- Um item do checklist sai quando o **dado** existe (ex.: potes criados) ou quando a pessoa dispensa; não basta ter passado pelo passo.
- Progresso em `onboarding_estado` (migration 0011) e, como reserva, no armazenamento local, para retomar mesmo sem a tabela no banco.
- "Conectar contas": não existe conexão por chave com a Binance (o plano pedia um guia da chave read-only). O passo explica como importar os extratos da B3, da Binance, do C6 e do PicPay.
- Passo "Alertas": sugere alertas de empate para as posições abaixo do preço médio e cria os marcados.
