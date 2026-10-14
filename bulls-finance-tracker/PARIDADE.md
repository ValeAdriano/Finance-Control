# Matriz de paridade

Cada linha é uma peça do sistema atual que precisa existir igual no app. A coluna **Fonte** aponta
para o arquivo em `../investimentos-compartilhar/assets/js/`. A comparação de cada linha usa os
estados indicados.

**Status:** `·` pendente · `~` em andamento · `=` igual · `≈` diferença aceita (anotar o porquê)

**Estados padrão** (valem para toda tela, salvo indicação): celular claro, celular escuro,
desktop claro, desktop escuro, modo privado, carregando (cache em blur), erro de cotações.

Na coluna **Status**, quando as plataformas divergirem, anote por plataforma (ex.: `iOS = · Android ~ · Web =`).

## Núcleo e tema (F1)

| ID | Item | Fonte | Como comparar | Status |
|---|---|---|---|---|
| N1 | Carga do núcleo na ordem do `index.html` | `index.html` | `FC` com as mesmas chaves que no site | · |
| N2 | Carteira consolidada | `modelo/carteira.js` | JSON igual com as fixtures | · |
| N3 | Rentabilidade por aporte, TIR, TWR | `modelo/rentabilidade.js` | JSON igual | · |
| N4 | Avaliação das 4 lentes | `modelo/avaliador.js` | notas e vereditos iguais | · |
| N5 | Impostos e IRPF | `modelo/impostos.js` | JSON igual | · |
| N6 | Dividendos e proventos | `modelo/dividendos.js` | JSON igual | · |
| N7 | Projeções e cenários | `modelo/projecao.js` | JSON igual | · |
| N8 | Alertas | `modelo/alertas.js` | lista igual | · |
| N9 | Salário, plano, sequência | `modelo/salario.js` | JSON igual | · |
| N10 | Agro | `modelo/agro.js` | JSON igual | · |
| N11 | Renda (setores) | `modelo/renda.js` | JSON igual | · |
| N12 | Perfil e recomendação | `modelo/perfil.js`, `modelo/recomendacao.js` | testes do site passam no app | · |
| N13 | Layout | `layout.js` | `tests/layout.test.js` passa no app | · |
| N14 | Importador de extratos | `modelo/importador.js` | mesmos lançamentos para os extratos de exemplo | · |
| N15 | Retrospectiva (dados) | `modelo/retrospectiva.js` | JSON igual | · |
| N16 | Formatação pt-BR (moeda, %, datas, "há x min") | `util.js` (`fmt`, `datas`) | strings iguais | · |
| T1 | Tokens de cor claro/escuro e contraste alto | `css/app.css` `:root` | valores iguais | · |
| T2 | Tipografia, raios, espaços, sombras | `css/app.css` | diff visual | · |
| T3 | Curvas e durações de animação; reduzir movimento | `css/app.css` | revisão lado a lado | · |
| T4 | Ícones | `util.js` (`icone`) | diff visual de cada ícone | · |
| T5 | Logo e foguinho | `util.js` (`logo`, `foguinho`) | diff visual | · |

## Acesso (F2)

| ID | Item | Fonte | Estados extras | Status |
|---|---|---|---|---|
| A1 | Entrar | `telas/login.js` | erro de senha, sem conexão | · |
| A2 | Criar conta (força da senha, senha vazada, confirmação por e-mail) | `telas/login.js` | senha fraca, vazada, e-mail já usado | · |
| A3 | Verificação em duas etapas (TOTP) | `telas/login.js`, `supa.js` | um e vários autenticadores, código errado | · |
| A4 | Sessão encerrada após 7 dias sem uso | `app.js` | aviso na tela de login | · |
| A5 | Sair da conta | `app.js` | — | · |

## Casca (F2)

| ID | Item | Fonte | Estados extras | Status |
|---|---|---|---|---|
| C1 | Menu do topo com as abas ligadas, na ordem do layout | `app.js` | módulos desligados | · |
| C2 | Barra de baixo do celular (4 primeiras abas) e "Mais" | `app.js`, `layout.js` | layout personalizado | · |
| C3 | Folha "Mais opções" (atualizar cotações, guia, instalar, perfil, layout, ajustes, admin, sair) | `app.js` | admin e não admin | · |
| C4 | Sino de avisos com contador e folha "Avisos e Atenção" | `telas/comum.js` | sem avisos, 9+, urgente | · |
| C5 | Modo privado (valores borrados) | `app.js` | — | · |
| C6 | Tema automático/claro/escuro | `util.js` | — | · |
| C7 | Abertura com cache local em blur e revelação | `app.js` | sem cache | · |
| C8 | Faixa de estado das cotações (carregando/erro) | `telas/comum.js` | — | · |
| C9 | Toast, confirmação e folha (sobe no celular, centro no desktop, arrastar para fechar) | `util.js` | — | · |
| C10 | Banner e guia "Adicionar à Tela de Início" | `app.js` | só web | · |

## Início (F3)

| ID | Item | Fonte | Estados extras | Status |
|---|---|---|---|---|
| I1 | Saudação e card do perfil | `telas/inicio.js`, `telas/comum.js` | sem perfil, rascunho, vencido, plano pronto | · |
| I2 | Patrimônio (quanto tenho, coloquei, ganhei), contagem do valor | `telas/inicio.js` | carteira vazia | · |
| I3 | Checklist "Primeiros passos" | `telas/comum.js` | 2 de 6, completo (some) | · |
| I4 | Plano contra realidade | `telas/comum.js` | plano não aplicado (some) | · |
| I5 | Rendeu mais que o CDI? | `telas/inicio.js` | < 90 dias | · |
| I6 | Detalhes técnicos / macro | `telas/inicio.js` | sem rentabilidade | · |
| I7 | Retrospectivas | `telas/inicio.js` | fora da janela | · |
| I8 | Comece por aqui | `telas/inicio.js` | só com carteira vazia | · |
| I9 | Próximos 30 dias | `telas/inicio.js` | vazio | · |
| I10 | Renda passiva | `telas/inicio.js` | sem proventos | · |
| I11 | Alocação por pilar (expandir composição) | `telas/inicio.js` | meta 0% fora do equilíbrio | · |
| I12 | Crescimento do patrimônio (períodos, vista, comparar com Selic/Ibov, datas) | `telas/inicio.js`, `graficos.js` | toque no gráfico | · |
| I13 | Proventos por mês | `telas/inicio.js` | — | · |
| I14 | Agronegócio resumido | `telas/inicio.js` | módulo desligado | · |
| I15 | Mais aderentes aos seus critérios | `telas/inicio.js` | — | · |
| I16 | Ordem e ocultos do layout aplicados | `layout.js` | layout personalizado | · |
| I17 | Editor de layout (`inicio/editar`) | `telas/layout-editor.js` | arrastar, olho, padrão, menu | · |

## Investimentos (F3)

| ID | Item | Fonte | Estados extras | Status |
|---|---|---|---|---|
| V1 | Lista "Sua lista" (carteira e acompanhamento) com nota, veredito e variação | `telas/ativos.js` | sem preço, erro de fonte | · |
| V2 | Renda fixa (títulos, taxa, valor atual) | `telas/ativos.js` | taxa não informada | · |
| V3 | Detalhe do ativo: indicadores, lentes, "Como a nota é formada" | `telas/comum.js`, `telas/ativos.js` | FII, ação, ETF, cripto | · |
| V4 | Proventos: últimos, por cota/ano, meses em que paga | `telas/ativos.js` | sem proventos | · |
| V5 | Evolução da posição e rentabilidade por aporte | `telas/comum.js` | — | · |
| V6 | Folha "Novo ativo" / "Editar" | `telas/comum.js` | validação | · |
| V7 | Folha "Novo título de renda fixa" / "Editar título" | `telas/comum.js` | — | · |

## Aportes (F3)

| ID | Item | Fonte | Estados extras | Status |
|---|---|---|---|---|
| P1 | Novo aporte: compra, venda, renda fixa, provento | `telas/aportes.js` | venda acima da posição | · |
| P2 | Repetir aporte (folha "Aportar em…") | `telas/aportes.js` | — | · |
| P3 | Histórico com filtros e apagar | `telas/aportes.js` | vazio | · |
| P4 | Importar extrato (CSV/ZIP com senha) | `telas/aportes.js`, `modelo/importador.js` | senha errada, repetidos | · |

## Demais abas (F4)

| ID | Item | Fonte | Estados extras | Status |
|---|---|---|---|---|
| D1 | Dividendos: próximos, por mês, por ativo, folha por ativo | `telas/dividendos.js` | sem proventos | · |
| S1 | Salário: ganhos, plano, guia do mês, sequência, últimos 6 meses | `telas/salario.js` | sem ganhos | · |
| S2 | Folhas "Novo ganho"/"Editar ganho" | `telas/salario.js` | regras de dia | · |
| G1 | Agro: rebanho, dinheiro na atividade, resultado, custos, ganho de peso, evolução, por fazenda | `telas/agro.js` | sem dados | · |
| G2 | Folhas de lançamento, custo, pesagem e cotação do rebanho | `telas/agro.js` | — | · |
| R1 | Imposto de renda: bens e direitos, isentos, exclusiva, exterior, vendas e DARF | `telas/irpf.js` | — | · |
| R2 | Renda: critérios, panorama dos setores | `telas/renda.js` | — | · |
| R3 | Simular: dinheiro novo, saindo do caixa, efeito na alocação | `telas/simular.js` | — | · |
| R4 | Projeções: cenários, patrimônio, renda, premissas, de onde vem | `telas/projecoes.js` | — | · |
| J1 | Ajustes · Geral (conta, aparência, segurança, 2FA, privacidade, aparelho) | `telas/ajustes.js` | 2FA ligado/desligado | · |
| J2 | Ajustes · Módulos e retrospectivas | `telas/ajustes.js` | — | · |
| J3 | Ajustes · Critérios (objetivos, metas, regras, universo de Renda) | `telas/ajustes.js` | JSON inválido | · |
| J4 | Ajustes · Dados (informações, backup, restaurar, histórico mensal, log, apagar) | `telas/ajustes.js` | — | · |
| J5 | Ajustes · botão Layout leva a `inicio/editar` | `telas/ajustes.js` | — | · |

## Perfil, onboarding e ajuda (F5)

| ID | Item | Fonte | Estados extras | Status |
|---|---|---|---|---|
| F1 | Convite (conta antiga, adiamentos) e revisão | `telas/perfil-questionario.js` | 3 adiamentos | · |
| F2 | Questionário: consentimento, uma pergunta por tela, pular, rascunho, faltantes | `telas/perfil-questionario.js` | retomar rascunho | · |
| F3 | Resultado: eixos, conflitos, plano, alocação, candidatos, aplicar/recusar | `telas/perfil-resultado.js` | educativo e completo | · |
| F4 | Relatório: resumo, porquê, plano, aderência, comportamento, histórico, PDF, JSON | `telas/perfil-relatorio.js` | — | · |
| F5 | Apresentação por passos | `telas/onboarding.js` | — | · |
| F6 | Guias "Como usar esta tela" | `telas/ajuda.js` | cada rota | · |

## Extras (F6)

| ID | Item | Fonte | Estados extras | Status |
|---|---|---|---|---|
| X1 | Retrospectiva do mês e do ano (player, áudio, gravar vídeo) | `telas/retrospectiva.js`, `recap/*` | sem dados | · |
| X2 | Vídeo promocional | `promo/promo.js` | vertical e horizontal | · |
| X3 | Administração: vídeos, cliques, jornadas, onboarding, logs | `telas/admin.js` | não admin | · |
| X4 | Consentimento e telemetria anônima | `uso.js` | recusado | · |
