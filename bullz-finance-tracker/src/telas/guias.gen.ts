/* Textos dos guias de cada tela (vieram do objeto GUIAS do site original; agora a fonte é aqui). */
/* eslint-disable */
export const GUIAS: Record<string, { resumo: string; partes: [string, string, string][]; dicas?: string[] }> = {
    perfil: {
      resumo: "O seu perfil de investidor, medido em três eixos, e o plano que sai dele: reserva, aporte mensal, alocação por classe e uma lista de verificação de ativos.",
      partes: [
        ["bussola", "Três eixos", "Tolerância é o que você aguenta sentir; capacidade, o que pode perder; necessidade, o retorno que o objetivo exige. O perfil é o menor entre tolerância e capacidade."],
        ["check", "Plano em passos", "Dívida cara primeiro, depois a reserva de emergência, objetivos curtos e o longo prazo pelo perfil."],
        ["ativos", "Alocação e filtros", "A alocação-alvo por classe e os ativos que passam nos quatro filtros do perfil. Aplicar plano grava as metas, mostrando antes e depois."],
        ["recibo", "Relatório", "O porquê de cada recomendação, com histórico das avaliações. Exporta em PDF."],
      ],
      dicas: ["Revise a cada 12 meses ou quando a renda mudar; com 24 meses o perfil vence.", "As faixas de alocação se editam em Ajustes → Critérios → Regras de avaliação → faixas avançadas (chave perfil)."],
    },
    inicio: {
      resumo: "O retrato do seu dinheiro hoje, em gráficos: quanto você tem, como a carteira está indo contra as referências e o caminho até as metas. Os números detalhados ficam nas outras telas.",
      partes: [
        ["inicio", "Quanto eu tenho", "Tudo o que você tem (bolsa, cripto, renda fixa e rebanho) a preço de agora, já sem o imposto de renda estimado: é o que ficaria com você se resgatasse tudo hoje. O valor bruto aparece logo abaixo."],
        ["projecoes", "Velocímetro do desempenho", "Uma nota de 0 a 100 de como os seus ativos renderam no período (dia, mês, ano ou tudo): renda variável contra o Ibovespa, renda fixa e agro contra o CDI, pesando pelo valor de cada parte. 50 é render igual à referência. Até 33 fica Abaixo, até 66 No ritmo, acima disso Acima. A linha embaixo mostra a nota dia a dia; tocar no velocímetro abre a conta parte a parte, com quanto você colocou e ganhou."],
        ["alvo", "Anéis das metas", "Aporte do mês contra o plano do Salário, renda passiva contra a renda que você quer e reserva de emergência contra os meses de custo de vida. Sem meta definida, o anel leva até onde definir."],
        ["ativos", "Módulos visuais", "Curva do patrimônio, rosca da alocação contra a meta, barras de proventos e os ativos que mais subiram e caíram, no mesmo período do velocímetro."],
        ["carteira", "Números detalhados", "TIR, retorno por classe e a comparação com CDI e inflação estão em Investimentos › Rentabilidade; a alocação em barras, em Minha lista; renda passiva e próximos 30 dias, em Dividendos. Todos também podem voltar ao Início como módulo, em Ajustes → Layout."],
        ["alerta", "Atenção", "Avisos sobre a carteira: muito dinheiro num só ativo ou setor, título vencendo, valor acima da garantia do FGC num mesmo banco, reserva de emergência abaixo da meta e exposição ao dólar."],
      ],
      dicas: ["Em Ajustes → Objetivos, informe o custo de vida e a renda que deseja: o painel passa a medir a reserva de emergência e o caminho para viver de renda.", "Ao editar um título de renda fixa, informe o banco, se é isento de IR e se é a sua reserva — os avisos do FGC e da reserva usam isso.", "Toque no olho do topo para borrar os valores em público."],
    },
    ativos: {
      resumo: "Duas abas: Ativos, para pesquisar o mercado por tipo, e Minha lista, com o que você tem e acompanha.",
      partes: [
        ["ativos", "Ativos", "Pesquise ações e FIIs (todo o Fundamentus), o Tesouro Direto e ETFs, ações dos EUA e cripto. Cada tipo tem os seus filtros e a sua análise: Graham e múltiplos nas ações, P/VP, vacância e segmento nos FIIs, taxa contra o CDI e o IPCA na renda fixa."],
        ["info", "Detalhe do ativo", "Preço com a variação, quanto custa comprar, gráfico de 1 mês a 5 anos, os indicadores pelas suas regras e os dividendos: quanto pagou em cada mês, ano a ano. FIIs ganham o raio-x da CVM."],
        ["moeda", "Pagadoras de dividendos", "Em Ativos › Ações ou FIIs, o ranking de quem paga: frequência, meses em que paga, quanto do preço devolve por ano e há quantos anos paga sem falhar."],
        ["simular", "Comparar", "Escolha 2 ou 3 ativos do mesmo tipo e veja os indicadores lado a lado, com o melhor de cada linha marcado."],
        ["carteira", "Minha lista", "Seu dinheiro investido, a renda por mês e “Meus ativos” por tipo (ações e ETFs, FIIs, renda fixa e cripto), com subtotal, peso na carteira e quanto cada um rendeu em 12 meses. Abaixo, o que você acompanha."],
      ],
      dicas: ["Achou um ativo em Ativos? Toque em Acompanhar ou Adicionar à carteira para ele entrar na Minha lista.", "Cripto usa a cotação em reais do CoinGecko; ações e FIIs, a da B3; o Tesouro, as taxas do Tesouro Transparente."],
    },
    agro: {
      resumo: "Seu rebanho tratado como investimento: o que entrou, o que saiu, quanto custou e quanto vale.",
      partes: [
        ["aportes", "Movimentos", "Compra, venda, nascimento, morte, mudança de categoria e outras entradas e saídas. O rebanho atual é calculado a partir deles."],
        ["renda", "Custos", "Ração, vacina, pasto, frete e o que mais a atividade consumir, por categoria."],
        ["balanca", "Pesagens", "Peso médio por lote. Vira o valor estimado do rebanho e o ganho médio diário (GMD)."],
        ["projecoes", "Resultado da atividade", "Quanto entrou, quanto saiu e o resultado, somando o valor do gado que ainda está no pasto."],
        ["moeda", "Venda e reinvestimento", "Ao vender, diga quanto volta para o gado. O reinvestido fica no caixa do agro e paga as próximas compras sem contar como aporte — vender 1 e recomprar 2 é crescimento, não saque. Só o saque sai do patrimônio."],
        ["boi", "Rebanho por categoria", "Cabeças em cada categoria agora, e a evolução ao longo do tempo."],
      ],
      dicas: ["Numa venda maior que o estoque da categoria, o painel tira da categoria de origem (ex.: boi magro que virou boi gordo).", "Em compras e vendas, informe o preço por @, por cabeça ou o total — o painel calcula o resto."],
    },
    aportes: {
      resumo: "O registro de cada compra, venda e provento. A posição e o preço médio dos ativos saem daqui.",
      partes: [
        ["atualizar", "Repetir aporte", "Os aportes que você faz sempre. Toque, informe quantidade e valor, e pronto."],
        ["aportes", "Novo aporte", "Registre uma compra, venda ou provento. Dá para criar um ativo ou título novo direto daqui."],
        ["editar", "Histórico", "Todos os lançamentos, do mais recente ao mais antigo. A lixeira exclui um lançamento feito errado."],
      ],
      dicas: ["Aporte em renda fixa aumenta o valor aplicado do título.", "Os aportes do mês contam no Guia do mês, em Salário."],
    },
    dividendos: {
      resumo: "Quanto suas ações e FIIs pagam, quando pagam e quanto isso representa.",
      partes: [
        ["moeda", "Resumo", "Média mensal estimada, recebido nos últimos 12 meses e no ano, e o que cai nos próximos 30 dias."],
        ["ativos", "Por mês", "Proventos recebidos mês a mês e os já anunciados."],
        ["info", "Próximos pagamentos", "Data com, data de pagamento e o valor que cabe a você pela quantidade que tinha na data com."],
        ["carteira", "Por ativo", "Quanto cada ativo paga por ano, o yield sobre o preço atual e a frequência."],
        ["aportes", "Para onde vão os proventos", "Direto para você ou guardados num caixa (porquinho, cofrinho, saldo da corretora…) até reinvestir. O caixa pode render % do CDI, tem meta com aviso e, na compra, a parte que sai dele não conta como dinheiro novo: o valor extra do bolso sim."],
      ],
      dicas: ["Os valores vêm do Fundamentus e são atualizados a cada 12 horas.", "Para comparar pagadoras que você ainda não tem, use Investimentos › Ativos › Pagadoras de dividendos."],
    },
    admin: {
      resumo: "Como o sistema está sendo usado de verdade, sem saber quem é quem, e o material de divulgação.",
      partes: [
        ["play", "Vídeos", "Gera o vídeo de divulgação com os números da conta logada, vertical ou horizontal, com trilha."],
        ["alvo", "Cliques", "Cliques por elemento, por página e por dia, comparação entre duas telas e os fluxos de uma tela para outra."],
        ["bussola", "Jornadas", "Cada sessão reconstruída: telas na ordem, tempo em cada uma, o que foi clicado e onde a pessoa parou."],
        ["info", "Logs e insights", "Todos os eventos com busca e filtros, erros agrupados e uma lista automática de atritos, gargalos e partes pouco usadas."],
      ],
      dicas: ["Os dados são anônimos: um código aleatório do aparelho no lugar da conta. Telas e cliques só de quem aceitou; erros técnicos de todos.", "Tudo é apagado automaticamente depois de 180 dias."],
    },
    salario: {
      resumo: "Seus ganhos e o plano que diz quanto investir e onde, todo mês.",
      partes: [
        ["carteira", "Ganhos", "Salário, pró-labore, extras, 13º… Fixos valem todo mês a partir do início; avulsos, só na data. Dá para marcar o dia de receber, como o 5º dia útil."],
        ["ativos", "Seu plano", "Percentual da renda (ou valor fixo) para investir e a divisão entre pilares, ativos ou títulos. Com reinvestimento ligado, os dividendos do mês entram no valor."],
        ["ativos", "Sequência de aportes", "Com o módulo “Sequência e vídeo” ligado em Ajustes, o foguinho roxo conta os meses seguidos em que você bateu a meta do plano. O mês atual não quebra a sequência enquanto está em andamento; mês sem renda cadastrada fica congelado."],
        ["check", "Guia do mês", "O planejado para cada destino, o que você já aportou e o que falta. Navegue entre os meses com as setas."],
        ["projecoes", "Últimos 6 meses", "Renda e quanto dela virou investimento, mês a mês."],
      ],
      dicas: ["Em Projeções, ligue “Usar meu plano do Salário” para projetar com ele."],
    },
    renda: {
      resumo: "Empresas de setores perenes — tarifa regulada, contrato longo ou spread — filtradas pelos seus critérios de dividendo.",
      partes: [
        ["simular", "Seus critérios", "DY mínimo (pelo setor ou um piso fixo), payout máximo, dívida máxima (DL/EBITDA) e liquidez mínima."],
        ["ativos", "Panorama dos setores", "DY mediano de cada setor e quantas empresas passam. Toque em um setor para ver as empresas."],
        ["moeda", "Preço justo", "O preço em que o dividendo de hoje renderia o DY alvo. Abaixo dele, o papel está barato pelo critério."],
      ],
      dicas: ["O universo de setores e empresas se edita em Ajustes → Universo da aba Renda."],
    },
    simular: {
      resumo: "Monte uma cesta de compras e veja o efeito na alocação antes de gastar.",
      partes: [
        ["aportes", "A · Dinheiro novo", "Quanto você vai aportar e em quê. O painel mostra como fica cada pilar."],
        ["exportar", "B · Saindo do caixa", "A mesma cesta paga com o dinheiro do caixa: o patrimônio não muda, só a composição."],
        ["ativos", "Efeito na alocação", "Antes e depois de cada pilar contra a sua meta."],
      ],
      dicas: ["Nada aqui é gravado: para valer, registre em Aportes."],
    },
    projecoes: {
      resumo: "Para onde o patrimônio vai com as premissas de hoje, em reais de hoje. Não é previsão: é aritmética.",
      partes: [
        ["projecoes", "Patrimônio projetado", "Três cenários (pessimista, base, otimista) no horizonte em anos que você escolher."],
        ["moeda", "Renda de proventos", "Quanto a carteira pagaria por mês ao longo do tempo."],
        ["ativos", "De onde vem o patrimônio", "Separa o total final em o que você tem hoje, aportes, proventos e valorização."],
        ["simular", "Premissas por pilar", "Valorização real e dividendos esperados de cada pilar. Ajuste para testar cenários."],
        ["renda", "Renda fixa contratada", "Títulos com taxa conhecida entram pelo que foi contratado, não por premissa."],
      ],
      dicas: ["Com “Usar meu plano do Salário” ligado, o aporte mensal e a divisão vêm do plano."],
    },
    retrospectiva: {
      resumo: "Seu mês contado em etapas, no estilo das retrospectivas de fim de ano, montado com os seus números do período.",
      partes: [
        ["play", "Etapas", "Como stories: toque à direita avança, à esquerda volta e segurar pausa. No teclado, as setas, o espaço e Esc para sair."],
        ["som", "Som", "Trilha e efeitos gerados na hora. O botão de som liga e desliga sem parar o vídeo."],
        ["olho", "Modo privado", "Esconde os valores em reais e mostra só percentuais — bom para compartilhar."],
        ["exportar", "Exportar", "Grava o vídeo com o som em MP4 ou WebM. Leva o tempo do vídeo; mantenha a aba aberta."],
        ["calendario", "Quando aparece", "No Início, a do mês surge nos últimos 5 dias de cada mês e a do ano de 27 a 31 de dezembro. Em Ajustes → Retrospectivas, as duas ficam sempre à mão."],
      ],
      dicas: ["Com o movimento reduzido ligado no sistema, as transições viram fades suaves."],
    },
    ajustes: {
      resumo: "Conta, segurança e os critérios que o painel usa.",
      partes: [
        ["alvo", "Objetivos", "Custo de vida por mês, quantos meses de reserva de emergência (6, se não mudar) e a renda passiva que você quer. O Início usa isso nos avisos e na barra de renda passiva."],
        ["simular", "Módulos", "Liga e desliga o que nem todo mundo usa: agronegócio, cripto, bolsa dos EUA, análise de setores, simulador e a sequência de aportes com o vídeo de divulgação. Desligar só tira dos menus; os dados ficam."],
        ["cadeado", "Conta e segurança", "Nome, verificação em duas etapas, troca de senha e sair dos outros aparelhos."],
        ["olho", "Aparência", "Tema claro, escuro ou automático e o modo privado."],
        ["ativos", "Metas e regras", "Metas de alocação por pilar, o peso de cada lente e as faixas de cada indicador."],
        ["importar", "Seus dados", "Baixar ou restaurar backup, importar o histórico mensal e apagar dados."],
      ],
      dicas: ["A apresentação do começo pode ser revista em Conta → Ver a apresentação."],
    },
  };
