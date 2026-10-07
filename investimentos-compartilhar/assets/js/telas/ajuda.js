/* Guia da tela: o botão de ajuda do topo abre uma folha explicando o que
 * cada parte da tela atual faz, e dá dicas de uso. O conteúdo é fixo
 * por rota; as rotas sem guia próprio caem no do Início. */
(function () {
  const FC = window.FC;
  const { html, icone } = FC;

  // cada guia: resumo, partes da tela [ícone, nome, o que faz] e dicas
  const GUIAS = {
    inicio: {
      resumo: "O retrato do seu dinheiro hoje: quanto você tem, como cresceu e onde está.",
      partes: [
        ["inicio", "Patrimônio", "Soma de tudo — bolsa, cripto, renda fixa e rebanho — com o preço de mercado de agora. Abaixo, a variação do dia e desde o início."],
        ["projecoes", "Crescimento do patrimônio", "O patrimônio reconstruído dia a dia: posições × preço de cada dia, renda fixa rendendo aporte a aporte e o rebanho. A linha tracejada é o total que você anotava à parte. O TWR compara com o CDI do mesmo período."],
        ["ativos", "Foguinho roxo", "Sua sequência: quantos meses seguidos você bateu a meta de aporte do plano. O anel em volta mostra quanto da meta deste mês já foi. Toque para ir ao Salário."],
        ["ativos", "Alocação por pilar", "Quanto do total está em cada pilar comparado com a sua meta. A meta se ajusta em Ajustes → Metas de alocação."],
        ["moeda", "Dividendos", "Quanto você recebeu, a média mensal e os próximos pagamentos anunciados."],
        ["agro", "Agronegócio", "Cabeças no rebanho e o valor estimado do gado, quando você usa o Agro."],
        ["check", "Mais aderentes aos seus critérios", "Os ativos da sua lista com as melhores notas nas quatro lentes de avaliação."],
      ],
      dicas: ["Toque no olho do topo para borrar os valores em público.", "O botão de atualizar busca as cotações na hora; sem ele, o painel atualiza sozinho a cada minuto."],
    },
    ativos: {
      resumo: "Tudo o que você tem ou acompanha na bolsa e em cripto, avaliado pelos seus critérios, e a renda fixa contra o CDI.",
      partes: [
        ["ativos", "Minha lista", "Seus ativos com quantidade, preço médio, valor atual e o veredito: Atende, Zona cinzenta ou Não atende. Use o botão “+ Ativo” para cadastrar um novo."],
        ["info", "Detalhe do ativo", "Toque em um ativo para ver indicadores, evolução da posição e como a nota é formada nas quatro lentes. FIIs ganham um raio-x da CVM e uma análise própria do tipo: tijolo (vacância física e financeira, concentração em imóveis), papel (concentração em CRIs), fundo de fundos e híbrido."],
        ["moeda", "Pagadoras de dividendos", "Ranking de quem paga: frequência, meses em que paga, quanto do preço devolve por ano e há quantos anos paga sem falhar."],
        ["renda", "Renda fixa", "Seus títulos com taxa, vencimento e rendimento real (descontada a inflação). “+ Título” cadastra um novo."],
        ["carteira", "Seu dinheiro investido", "Quanto você colocou, quanto vale e o ganho. O % é do período, com cada aporte na sua data (não é valor de hoje ÷ total aportado), e a TIR mostra a taxa ao ano."],
      ],
      dicas: ["O campo “Analisar qualquer código” avalia um ticker sem cadastrar; se gostar, toque em Adicionar.", "Cripto usa a cotação em reais do CoinGecko; ações e FIIs, a da B3."],
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
      ],
      dicas: ["Os valores vêm do Fundamentus e são atualizados a cada 12 horas.", "Para comparar pagadoras que você ainda não tem, use Investimentos → Pagadoras de dividendos."],
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
        ["ativos", "Sequência de aportes", "O foguinho roxo conta os meses seguidos em que você bateu a meta do plano. O mês atual não quebra a sequência enquanto está em andamento; mês sem renda cadastrada fica congelado."],
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
        ["simular", "Módulos", "Liga e desliga o que nem todo mundo usa: agronegócio, cripto, bolsa dos EUA, análise de setores e simulador. Desligar só tira dos menus; os dados ficam."],
        ["cadeado", "Conta e segurança", "Nome, verificação em duas etapas, troca de senha e sair dos outros aparelhos."],
        ["olho", "Aparência", "Tema claro, escuro ou automático e o modo privado."],
        ["ativos", "Metas e regras", "Metas de alocação por pilar, o peso de cada lente e as faixas de cada indicador."],
        ["importar", "Seus dados", "Baixar ou restaurar backup, importar o histórico mensal e apagar dados."],
      ],
      dicas: ["A apresentação do começo pode ser revista em Conta → Ver a apresentação."],
    },
  };

  FC.guiaDaTela = function (rota) {
    const g = GUIAS[rota] || GUIAS.inicio;
    const nome = (FC.ROTAS.find((r) => r.id === rota) || FC.ROTAS[0]).nome;
    const f = FC.ui.folha({
      titulo: `Guia · ${nome}`,
      corpo: html`<div class="guia">
        <p class="guia-resumo">${g.resumo}</p>
        <h3 class="guia-rot">Nesta tela</h3>
        <ol class="guia-partes">${g.partes.map(([ic, t, d], i) => html`<li style="--i:${i}">
          <span class="guia-ic">${icone(ic, 20)}</span><div><b>${t}</b><p>${d}</p></div></li>`)}</ol>
        ${g.dicas && g.dicas.length ? html`<h3 class="guia-rot">Dicas</h3>
          <ul class="guia-dicas">${g.dicas.map((d) => html`<li>${d}</li>`)}</ul>` : ""}
        <button class="botao texto pequeno mt2" type="button" id="guia-tour">${icone("info", 16)} Ver a apresentação completa</button>
      </div>`,
    });
    FC.$("#guia-tour", f.el).addEventListener("click", () => { f.fechar(); setTimeout(() => FC.onboarding.abre(), 250); });
  };
})();
