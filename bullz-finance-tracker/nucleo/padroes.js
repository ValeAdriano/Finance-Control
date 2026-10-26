/* Valores de partida. Tudo aqui pode ser sobrescrito na tela de Ajustes;
 * o que você muda fica na tabela `preferencias` do Supabase, e o que não
 * muda continua vindo daqui. */
(function () {
  const FC = window.FC;

  FC.PILARES = [
    { chave: "acoes", nome: "Ações", cor: "var(--s1)" },
    { chave: "real_estate", nome: "Real Estate", cor: "var(--s4)" },
    { chave: "alternativos", nome: "Alternativos", cor: "var(--s3)" },
    { chave: "caixa", nome: "Caixa", cor: "var(--s2)" },
    { chave: "agro", nome: "Agronegócio", cor: "var(--s5)" },
  ];
  FC.PILAR_NOME = Object.fromEntries(FC.PILARES.map((p) => [p.chave, p.nome]));

  // ------------------------------------------------------------------ módulos
  // O que nem todo mundo usa fica desligado até a pessoa ligar em Ajustes.
  // Desligar só esconde: os dados continuam guardados e somando no patrimônio.
  FC.MODULOS = [
    { chave: "dividendos", nome: "Dividendos e proventos", icone: "moeda", desc: "aba Dividendos: histórico, próximos pagamentos e análise de proventos", rotas: ["dividendos"] },
    { chave: "irpf", nome: "Imposto de Renda", icone: "recibo", desc: "aba Imposto de Renda: Bens e Direitos, rendimentos e cálculo de DARF", rotas: ["irpf"] },
    { chave: "salario", nome: "Salário e planejamento", icone: "carteira", desc: "aba Salário: controle de renda mensal, aportes e reserva de emergência", rotas: ["salario"] },
    { chave: "projecoes", nome: "Projeções", icone: "projecoes", desc: "aba Projeções: patrimônio e renda futuros em moeda de hoje", rotas: ["projecoes"] },
    { chave: "agro", nome: "Agronegócio", icone: "agro", desc: "aba Agro: rebanho, compras, vendas, custos e pesagens do gado", rotas: ["agro"] },
    { chave: "fii", nome: "Fundos Imobiliários (FIIs)", icone: "ativos", desc: "FIIs na carteira e nas opções de classes de ativos", classes: ["fii"] },
    { chave: "cripto", nome: "Criptomoedas", icone: "cripto", desc: "BTC, ETH e outras criptos com cotação em reais, e a aba Cripto: ranking, gráficos e a ficha de cada moeda", classes: ["cripto"], rotas: ["cripto"] },
    { chave: "exterior", nome: "Bolsa dos EUA", icone: "ativos", desc: "ações e ETFs negociados nos Estados Unidos", classes: ["acao_us", "etf_us"] },
    { chave: "renda", nome: "Análise de setores", icone: "renda", desc: "aba Renda: empresas de setores perenes pelos seus critérios de dividendo", rotas: ["renda"] },
    { chave: "simular", nome: "Simulador de compras", icone: "simular", desc: "aba Simular: o efeito de uma cesta na alocação antes de comprar", rotas: ["simular"] },
    { chave: "noticias", nome: "Notícias", icone: "jornal", desc: "aba Notícias: manchetes do mercado e de cripto, atualizadas sozinhas", rotas: ["noticias"] },
    { chave: "engajamento", nome: "Sequência e vídeo", icone: "play", desc: "o foguinho da sequência de aportes e o vídeo de divulgação" },
  ];
  // sem escolha salva, liga o que a conta já usa
  FC.resolveModulos = function (salvos, base) {
    const ativos = (base && base.ativos) || [];
    const ag = (base && base.agro) || {};
    const padroes = {
      dividendos: true,
      irpf: true,
      salario: true,
      projecoes: true,
      fii: ativos.some((a) => a.classe === "fii"),
      agro: !!((ag.movs || []).length || (ag.custos || []).length),
      cripto: ativos.some((a) => a.classe === "cripto"),
      exterior: ativos.some((a) => a.classe === "acao_us" || a.classe === "etf_us"),
      renda: false,
      simular: false,
      engajamento: false,
      noticias: true,
    };
    if (salvos) {
      return Object.fromEntries(FC.MODULOS.map((m) => [
        m.chave,
        salvos[m.chave] !== undefined ? !!salvos[m.chave] : (padroes[m.chave] ?? false)
      ]));
    }
    return padroes;
  };
  const mods = () => (FC.estado && FC.estado.prefs && FC.estado.prefs.modulos) || {};
  FC.modulo = (chave) => !!mods()[chave];
  // rota pertence a um módulo desligado?
  FC.rotaLigada = (id) => !FC.MODULOS.some((m) => (m.rotas || []).includes(id) && !FC.modulo(m.chave));
  // classes de ativo à mostrar nos formulários (mantém a atual, mesmo desligada)
  FC.classesLigadas = (atual) => Object.entries(FC.CLASSES).filter(([k]) =>
    k === atual || !FC.MODULOS.some((m) => (m.classes || []).includes(k) && !FC.modulo(m.chave)));
  FC.pilaresLigados = () => FC.PILARES.filter((p) => {
    if (p.chave === "agro") return FC.modulo("agro");
    if (p.chave === "alternativos") return FC.modulo("cripto");
    if (p.chave === "real_estate") return FC.modulo("fii");
    return true;
  });

  FC.CLASSES = {
    acao_br: "Ação brasileira",
    etf_br: "ETF na B3",
    fii: "FII",
    acao_us: "Ação dos EUA",
    etf_us: "ETF dos EUA",
    cripto: "Criptomoeda",
  };
  FC.CLASSE_ROTULO = {
    ...FC.CLASSES,
    fii_papel: "FII de papel",
    fii_tijolo: "FII de tijolo",
    fii_fof: "FII de fundos (FOF)",
    fii_hibrido: "FII híbrido",
  };

  FC.ROTULO_CURTO = {
    pvp: "P/VP", pl: "P/L", dy: "DY", vacancia: "Vacância", cap_rate: "Cap rate",
    liquidez: "Liquidez", roe: "ROE", div_liq_pl: "Dív/PL", cresc_rec_5a: "Cresc 5a",
    dist_maxima_52s: "Desc. máx", premio_media_200d: "vs média 200d",
    vacancia_financeira: "Vac. financ.", concentracao: "Concentração",
  };

  // descreve a distância dos SEUS critérios — não é recomendação
  FC.VEREDITO_CURTO = {
    "Dentro dos seus critérios": "Nos critérios",
    "Perto dos seus critérios": "Perto",
    "Fora dos seus critérios": "Fora",
    "sem dados": "Sem dados",
    // textos antigos, caso algum venha de dado salvo
    "atende seus critérios": "Nos critérios",
    "zona cinzenta": "Perto",
    "fora dos seus critérios": "Fora",
  };

  FC.PADRAO_ALOCACAO = { acoes: 25, real_estate: 25, alternativos: 25, caixa: 25, agro: 0 };

  // ------------------------------------------------------------------ regras
  // Cada métrica é vista por quatro lentes (histórica, sua regra, pares,
  // macro). As faixas geram a curva de nota: ótimo → 100, aceitável → 60,
  // ruim → 0, com interpolação linear entre os pontos.
  FC.PADRAO_REGRAS = {
    pesos_lentes: { historica: 0.3, regra: 0.3, pares: 0.25, macro: 0.15 },
    janela_historico_anos: 3,
    vereditos: { atende: 70, observar: 45 },
    perfis: {
      fii_tijolo: {
        descricao: "FII de imóveis físicos — lajes, shoppings, galpões, renda urbana",
        isento_ir: true,
        metricas: {
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 3, otimo: 0.9, aceitavel: 1.02, ruim: 1.25 },
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 11, aceitavel: 8.5, ruim: 6, ancora_macro: "cdi" },
          vacancia: { rotulo: "Vacância física", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 3, aceitavel: 10, ruim: 25 },
          // a receita que deixa de entrar — pesa mais que a área vaga
          vacancia_financeira: { rotulo: "Vacância financeira (estimada)", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 3, aceitavel: 8, ruim: 20 },
          concentracao: { rotulo: "Concentração — maior imóvel na receita", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 15, aceitavel: 30, ruim: 60 },
          cap_rate: { rotulo: "Cap Rate", unidade: "%", direcao: "maior_melhor", peso: 1, otimo: 10, aceitavel: 7.5, ruim: 5 },
          liquidez: { rotulo: "Liquidez diária", unidade: "R$", direcao: "maior_melhor", peso: 2, otimo: 3000000, aceitavel: 500000, ruim: 100000 },
        },
      },
      fii_papel: {
        descricao: "FII de CRI — recebíveis indexados a IPCA ou CDI",
        isento_ir: true,
        metricas: {
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 4, otimo: 0.95, aceitavel: 1.03, ruim: 1.12 },
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 4, otimo: 13, aceitavel: 10, ruim: 8, ancora_macro: "cdi" },
          // sem imóvel não há vacância: o risco é de crédito, e diluído é melhor
          concentracao: { rotulo: "Concentração — maior CRI da carteira", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 5, aceitavel: 10, ruim: 25 },
          liquidez: { rotulo: "Liquidez diária", unidade: "R$", direcao: "maior_melhor", peso: 2, otimo: 3000000, aceitavel: 500000, ruim: 100000 },
        },
      },
      fii_fof: {
        descricao: "Fundo de fundos — carteira de cotas de outros FIIs",
        isento_ir: true,
        metricas: {
          // FOF costuma negociar com desconto: o próprio desconto é parte da tese
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 3, otimo: 0.88, aceitavel: 0.98, ruim: 1.08 },
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 11, aceitavel: 9, ruim: 7, ancora_macro: "cdi" },
          concentracao: { rotulo: "Concentração — maior FII da carteira", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 10, aceitavel: 20, ruim: 40 },
          liquidez: { rotulo: "Liquidez diária", unidade: "R$", direcao: "maior_melhor", peso: 2, otimo: 3000000, aceitavel: 500000, ruim: 100000 },
        },
      },
      fii_hibrido: {
        descricao: "FII híbrido — imóveis e papéis na mesma carteira",
        isento_ir: true,
        metricas: {
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 3, otimo: 0.92, aceitavel: 1.02, ruim: 1.2 },
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 11.5, aceitavel: 9, ruim: 7, ancora_macro: "cdi" },
          vacancia: { rotulo: "Vacância física", unidade: "%", direcao: "menor_melhor", peso: 1, otimo: 3, aceitavel: 10, ruim: 25 },
          vacancia_financeira: { rotulo: "Vacância financeira (estimada)", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 3, aceitavel: 8, ruim: 20 },
          concentracao: { rotulo: "Concentração — maior posição", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 15, aceitavel: 30, ruim: 60 },
          liquidez: { rotulo: "Liquidez diária", unidade: "R$", direcao: "maior_melhor", peso: 2, otimo: 3000000, aceitavel: 500000, ruim: 100000 },
        },
      },
      acao_br: {
        descricao: "Ação listada na B3",
        isento_ir: true,
        metricas: {
          pl: { rotulo: "P/L", direcao: "menor_melhor", peso: 3, otimo: 7, aceitavel: 12, ruim: 20 },
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 2, otimo: 1, aceitavel: 2, ruim: 4 },
          // sem âncora macro de propósito: ação rende dividendo MAIS valorização
          dy: { rotulo: "Dividend Yield", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 8, aceitavel: 5, ruim: 2 },
          roe: { rotulo: "ROE", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 20, aceitavel: 12, ruim: 5 },
          div_liq_pl: { rotulo: "Dívida líquida / Patrimônio", direcao: "menor_melhor", peso: 2, otimo: 0.3, aceitavel: 1, ruim: 2.5 },
          cresc_rec_5a: { rotulo: "Crescimento da receita em 5 anos", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 15, aceitavel: 5, ruim: 0 },
          liquidez: { rotulo: "Liquidez 2 meses", unidade: "R$", direcao: "maior_melhor", peso: 1, otimo: 50000000, aceitavel: 5000000, ruim: 500000 },
        },
      },
      etf_br: {
        // ETF de índice não tem P/VP nem P/L próprios e não distribui:
        // só dá para medir o preço contra a própria história (timing).
        descricao: "ETF de índice na B3 — IVVB11, BOVA11, GOLD11, NASD11",
        isento_ir: false,
        metricas: {
          premio_media_200d: { rotulo: "Prêmio sobre a média de 200 dias", unidade: "%", direcao: "menor_melhor", peso: 3, otimo: -5, aceitavel: 8, ruim: 25 },
          dist_maxima_52s: { rotulo: "Desconto da máxima de 52 semanas", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 15, aceitavel: 5, ruim: 0 },
        },
      },
      acao_us: {
        descricao: "Ação listada nos EUA — cobertura fundamentalista menor",
        metricas: {
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 4, aceitavel: 2, ruim: 0.5 },
          dist_maxima_52s: { rotulo: "Desconto da máxima de 52 semanas", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 25, aceitavel: 10, ruim: 0 },
          premio_media_200d: { rotulo: "Prêmio sobre a média de 200 dias", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: -5, aceitavel: 8, ruim: 25 },
        },
      },
      cripto: {
        // Cripto não tem lucro, patrimônio nem dividendo: como no ETF de
        // índice, só existe o preço contra a própria história. As faixas são
        // mais largas porque a volatilidade é várias vezes a da bolsa — um
        // prêmio de 20% sobre a média de 200 dias é comum em alta.
        descricao: "Criptomoeda — cotada em dólar e convertida pelo câmbio do dia",
        isento_ir: false,
        metricas: {
          premio_media_200d: { rotulo: "Prêmio sobre a média de 200 dias", unidade: "%", direcao: "menor_melhor", peso: 3, otimo: -15, aceitavel: 15, ruim: 50 },
          dist_maxima_52s: { rotulo: "Desconto da máxima de 52 semanas", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 40, aceitavel: 15, ruim: 0 },
        },
      },
      etf_us: {
        descricao: "ETF — avaliado por preço relativo e distribuição",
        metricas: {
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 1, otimo: 3, aceitavel: 1.5, ruim: 0.3 },
          dist_maxima_52s: { rotulo: "Desconto da máxima de 52 semanas", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 20, aceitavel: 8, ruim: 0 },
          premio_media_200d: { rotulo: "Prêmio sobre a média de 200 dias", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: -5, aceitavel: 8, ruim: 25 },
        },
      },
    },
    // o Fundamentus erra alguns segmentos; aqui se força a mão
    override_perfil: { MXRF11: "fii_papel", KNCR11: "fii_papel", IRDM11: "fii_papel", RECR11: "fii_papel", CPTS11: "fii_papel" },
    segmentos_papel: ["Títulos e Val. Mob.", "Titulos e Val. Mob.", "Papel"],
    // Recomendação do perfil do investidor (editável em Ajustes → Regras →
    // faixas avançadas). Pontos de partida para calibrar, não números da
    // pesquisa. Hierarquia: renda fixa > ações > cripto. Os pesos do
    // questionário ficam em FC.PERFIL, versionados.
    perfil: {
      alocacao: {
        conservador: { renda_fixa: [85, 95], fiis: [0, 5], acoes: [0, 10], cripto: [0, 0] },
        moderado: { renda_fixa: [60, 70], fiis: [10, 15], acoes: [15, 25], cripto: [0, 3] },
        arrojado: { renda_fixa: [40, 50], fiis: [10, 20], acoes: [25, 35], cripto: [3, 7] },
      },
      // nota mínima nas quatro lentes para virar candidato
      score_minimo: { conservador: 70, moderado: 60, arrojado: 55 },
      // peso máximo de um ativo na carteira (% do investido)
      peso_max_ativo: { conservador: 5, moderado: 8, arrojado: 10 },
      // liquidez diária mínima (R$) quando o ativo tem a medida
      liquidez_minima: { conservador: 1000000, moderado: 500000, arrojado: 100000 },
      // quanto da sobra mensal informada vira aporte sugerido
      fator_aporte: { conservador: 0.5, moderado: 0.7, arrojado: 0.85 },
    },
  };

  // ------------------------------------------------------------------ renda
  // Setores cujo lucro vem de tarifa regulada, contrato longo ou spread —
  // não de cotação de commodity. Condição para dividendo recorrente.
  FC.PADRAO_RENDA = {
    criterios_padrao: { dy_desejado: 6, payout_maximo: 100, dl_ebitda_maximo: 3, liquidez_minima: 1 },
    setores: {
      Bancos: {
        sem_ebitda: true,
        empresas: {
          BBAS3: "Banco do Brasil", ITUB4: "Itaú Unibanco", BBDC4: "Bradesco", SANB11: "Santander Brasil",
          BPAC11: "BTG Pactual", ABCB4: "Banco ABC Brasil", BRSR6: "Banrisul", BMGB4: "Banco BMG",
          ITSA4: "Itaúsa", PINE4: "Banco Pine", BRBI11: "BR Partners", BMEB4: "Banco Mercantil do Brasil",
        },
      },
      Energia: {
        empresas: {
          EQTL3: "Equatorial", CMIG4: "Cemig", CPLE3: "Copel", ENGI11: "Energisa", EGIE3: "Engie Brasil",
          TAEE11: "Taesa", ISAE4: "ISA Energia", AURE3: "Auren Energia", CPFE3: "CPFL Energia", ALUP11: "Alupar",
        },
      },
      Saneamento: { empresas: { SBSP3: "Sabesp", SAPR11: "Sanepar", CSMG3: "Copasa" } },
      Telecom: {
        empresas: { VIVT3: "Vivo (Telefônica Brasil)", TIMS3: "TIM Brasil", DESK3: "Desktop", FIQE3: "Unifique", BRST3: "Brisanet" },
      },
    },
  };

  // ------------------------------------------------------------------ projeção
  // Tudo em moeda de hoje (termos reais). Valorização SEM proventos: os
  // proventos saem do DY observado de cada ativo.
  FC.PADRAO_PREMISSAS = {
    horizonte_anos: 20,
    aporte_mensal: 500,
    reinvestir_proventos: true,
    distribuicao_aporte: "rebalancear",
    valorizacao_real_anual: { acoes: 4, real_estate: 0.5, alternativos: 3.5, caixa: 0, agro: 3 },
    cenarios: { pessimista: null, otimista: null },   // vazio: os deltas de FC.projecao.CENARIOS
    macro_longo_prazo: { cdi: null, ipca: null },
  };

  // ------------------------------------------------------------------ objetivos
  // Guardados em preferencias.premissas.objetivos (sem coluna própria), junto
  // com premissas.titulos = { [id]: { instituicao, isento, reserva } }.
  FC.PADRAO_OBJETIVOS = { custo_vida_mensal: null, meses_reserva: 6, renda_desejada_mensal: null };
  FC.objetivos = function (prefs) {
    const o = { ...FC.PADRAO_OBJETIVOS, ...((((prefs || {}).premissas) || {}).objetivos || {}) };
    if (!(o.meses_reserva > 0)) o.meses_reserva = 6;
    // sem renda desejada, a meta é cobrir o custo de vida
    if (!(o.renda_desejada_mensal > 0)) o.renda_desejada_mensal = o.custo_vida_mensal > 0 ? o.custo_vida_mensal : null;
    return o;
  };
  FC.infoTitulo = (prefs, id) => ((((prefs || {}).premissas) || {}).titulos || {})[id] || {};

  // ------------------------------------------------------------------ perfil do investidor
  // Questionário em quatro blocos, cada um alimenta um eixo e é pontuado
  // sozinho: capacidade (blocos 1 e 2), necessidade (bloco 3, calculada) e
  // tolerância (bloco 4). O perfil final é o MENOR entre tolerância e
  // capacidade, nunca a média. Mudou algum ponto ou teto? Suba `versao`:
  // cada avaliação guardada diz com qual versão foi calculada, e o banco
  // recalcula com a mesma tabela (supabase/schema.sql, gerada por
  // scripts/gera-perfil-sql.js).
  //   c = pontos de capacidade · t = pontos de tolerância
  //   v = valor de referência (R$, meses ou anos) · nd = "prefiro não dizer"
  const ND = { id: "nd", rotulo: "Prefiro não dizer", nd: true };
  FC.PERFIL = {
    versao: "perfil-v1",
    meses_validade: 24,       // depois disso o perfil está vencido
    meses_revisao: 12,        // revisão sugerida
    max_adiamentos: 3,        // convite a contas antigas
    taxa_sobra_cheia: 0.30,   // poupar 30% da renda vale os pontos todos
    neutro: 0.4,              // sem resposta: 40% dos pontos do item
    faixas: [
      { chave: "conservador", nome: "Conservador", de: 0, ate: 34 },
      { chave: "moderado", nome: "Moderado", de: 35, ate: 64 },
      { chave: "arrojado", nome: "Arrojado", de: 65, ate: 100 },
    ],
    // tetos que nenhuma resposta compensa
    tetos: {
      divida_cara: 20,        // o plano começa por quitar
      reserva_curta: 30,      // menos de 3 meses: o plano começa pela reserva
      prazo_curto: 25,        // objetivo em menos de 2 anos
      saque_provavel: 40,     // pode precisar do dinheiro antes
    },
    agro_alto: { limite_pct: 50, desconto: 15 },   // agro acima disso reduz a capacidade
    // duas ideias do bloco 4 perguntadas de dois jeitos: se divergem 2 degraus ou mais, "baixa consistência"
    espelhos: [["t_queda", "t_clima"], ["t_certo", "t_carteiras"]],
    degraus_contradicao: 2,
    // conhecimento limita produtos, não o perfil: teto de peso (%) por classe
    conhecimento: {
      nenhum: { acoes: 10, fiis: 5, cripto: 0 },
      basico: { acoes: 25, fiis: 20, cripto: 3 },
      experiente: { acoes: 100, fiis: 100, cripto: 100 },
    },
    estudar_peso_max: 2,      // % máximo de ativo "para estudar"
    cripto_grandes: ["BTC", "ETH", "BNB", "SOL"],
    // meses de custo da reserva, por estabilidade da renda
    reserva_meses: { estavel: 6, clt: 6, variavel: 12, sem_renda: 12, nd: 6 },
    // prêmio real (p.p.) de cada classe sobre a renda fixa real, para o retorno de referência
    premios: { renda_fixa: 0, fiis: 2.5, acoes: 4, cripto: 6 },
    retorno_real_padrao: 4,   // % a.a. real da renda fixa sem CDI e IPCA do mercado
    blocos: [
      { id: "sobre", n: 1, nome: "Sobre você", eixo: "Capacidade",
        porque: "Idade, estabilidade da renda e dependentes mostram quanta folga você tem para se recuperar de uma perda." },
      { id: "dinheiro", n: 2, nome: "Seu dinheiro hoje", eixo: "Capacidade",
        porque: "Renda, sobra e reserva dizem quanto você pode perder sem mexer na sua vida. Usamos faixas: não precisa do valor exato." },
      { id: "objetivo", n: 3, nome: "Objetivo e prazo", eixo: "Necessidade",
        porque: "O que você quer alcançar e em quanto tempo define o retorno que o plano precisa entregar." },
      { id: "reacao", n: 4, nome: "Experiência e reação", eixo: "Tolerância",
        porque: "Não há resposta certa: mede como você se sente diante de risco, que é diferente do quanto você pode perder." },
    ],
    // essencial: sem ela o perfil não sai. As outras podem ficar para o checklist.
    perguntas: [
      // ---------- 1. sobre você
      { id: "idade", bloco: "sobre", essencial: true, texto: "Quantos anos você tem?",
        porque: "Quanto mais jovem, mais tempo para se recuperar de uma queda.",
        opcoes: [
          { id: "ate_30", rotulo: "Até 30 anos", c: 15 }, { id: "31_40", rotulo: "31 a 40", c: 13 }, { id: "41_50", rotulo: "41 a 50", c: 10 },
          { id: "51_60", rotulo: "51 a 60", c: 6 }, { id: "61_mais", rotulo: "Mais de 60", c: 3 },
        ] },
      { id: "estab", bloco: "sobre", essencial: true, texto: "Como é a sua renda?",
        porque: "Renda estável aguenta mais oscilação do que renda que muda de mês a mês.",
        opcoes: [
          { id: "estavel", rotulo: "Estável: servidor público ou aposentadoria", c: 20, v: "estavel" },
          { id: "clt", rotulo: "Salário fixo com carteira assinada", c: 15, v: "clt" },
          { id: "variavel", rotulo: "Varia: autônomo, comissão, empresário", c: 8, v: "variavel" },
          { id: "sem_renda", rotulo: "No momento, sem renda", c: 0, v: "sem_renda" },
          { ...ND, c: 8, v: "nd" },
        ] },
      { id: "dependentes", bloco: "sobre", essencial: false, texto: "Quantas pessoas dependem da sua renda?",
        porque: "Mais dependentes pedem mais folga no seu orçamento.",
        opcoes: [
          { id: "0", rotulo: "Só eu", c: 10 }, { id: "1", rotulo: "1 pessoa", c: 7 }, { id: "2", rotulo: "2 pessoas", c: 4 }, { id: "3_mais", rotulo: "3 ou mais", c: 2 },
        ] },
      // ---------- 2. seu dinheiro hoje
      { id: "renda", bloco: "dinheiro", essencial: true, dinheiro: true, texto: "Quanto você recebe por mês, já com os descontos?",
        porque: "Com a renda e a sobra, calculamos quanto do que entra você consegue guardar. Guardamos só a faixa, nunca o valor exato.",
        opcoes: [
          { id: "ate_3k", rotulo: "Até R$ 3 mil", v: 2000 }, { id: "3_5k", rotulo: "R$ 3 a 5 mil", v: 4000 }, { id: "5_8k", rotulo: "R$ 5 a 8 mil", v: 6500 },
          { id: "8_15k", rotulo: "R$ 8 a 15 mil", v: 11500 }, { id: "15_30k", rotulo: "R$ 15 a 30 mil", v: 22500 }, { id: "30k_mais", rotulo: "Mais de R$ 30 mil", v: 40000 }, ND,
        ] },
      { id: "sobra", bloco: "dinheiro", essencial: true, dinheiro: true, texto: "Quanto costuma sobrar por mês?",
        porque: "É daqui que sai o aporte sugerido. Sem isso o plano não consegue dizer quanto guardar.",
        opcoes: [
          { id: "nada", rotulo: "Nada ou fico no vermelho", v: 0 }, { id: "ate_500", rotulo: "Até R$ 500", v: 250 }, { id: "500_1500", rotulo: "R$ 500 a 1.500", v: 1000 },
          { id: "1500_3000", rotulo: "R$ 1.500 a 3 mil", v: 2250 }, { id: "3000_6000", rotulo: "R$ 3 a 6 mil", v: 4500 }, { id: "6000_mais", rotulo: "Mais de R$ 6 mil", v: 8000 }, ND,
        ] },
      { id: "reserva", bloco: "dinheiro", essencial: true, dinheiro: true, texto: "Quantos meses do seu custo de vida você tem guardados, de fácil resgate?",
        porque: "A reserva de emergência é o primeiro passo: sem ela, qualquer imprevisto força a vender investimento na hora errada.",
        opcoes: [
          { id: "nenhuma", rotulo: "Nenhum", c: 0, v: 0 }, { id: "menos_3", rotulo: "Menos de 3 meses", c: 1, v: 1.5 }, { id: "3_6", rotulo: "3 a 6 meses", c: 3, v: 4.5 },
          { id: "6_12", rotulo: "6 a 12 meses", c: 4, v: 9 }, { id: "12_mais", rotulo: "Mais de 12 meses", c: 5, v: 12 }, { ...ND, c: 1, v: null },
        ] },
      { id: "divida", bloco: "dinheiro", essencial: true, texto: "Você tem dívida cara em aberto, como cartão rotativo ou cheque especial?",
        porque: "Nenhum investimento rende mais do que o juro do rotativo. Com dívida cara, o plano começa por quitar.",
        opcoes: [{ id: "nao", rotulo: "Não" }, { id: "sim", rotulo: "Sim" }] },
      { id: "patrimonio", bloco: "dinheiro", essencial: false, dinheiro: true, texto: "Quanto você já tem investido, somando tudo?",
        porque: "Quanto maior o patrimônio, menor o peso de uma queda na sua vida.",
        opcoes: [
          { id: "nada", rotulo: "Ainda nada", c: 0, v: 0 }, { id: "ate_10k", rotulo: "Até R$ 10 mil", c: 4, v: 5000 }, { id: "10_50k", rotulo: "R$ 10 a 50 mil", c: 8, v: 30000 },
          { id: "50_200k", rotulo: "R$ 50 a 200 mil", c: 12, v: 125000 }, { id: "200k_1m", rotulo: "R$ 200 mil a 1 milhão", c: 17, v: 600000 },
          { id: "1m_mais", rotulo: "Mais de R$ 1 milhão", c: 20, v: 1500000 }, { ...ND, c: 8, v: null },
        ] },
      { id: "moradia", bloco: "dinheiro", essencial: false, texto: "Como é a sua moradia?",
        porque: "Casa própria quitada reduz o seu custo fixo e aumenta a folga.",
        opcoes: [
          { id: "propria", rotulo: "Própria", c: 5 }, { id: "familia", rotulo: "Cedida ou com a família", c: 4 }, { id: "aluguel", rotulo: "Aluguel ou financiada", c: 2 },
        ] },
      // ---------- 3. objetivo e prazo
      { id: "objetivo", bloco: "objetivo", essencial: true, texto: "Qual é o seu objetivo principal com o dinheiro?",
        porque: "O objetivo decide para que serve a carteira: segurança, renda ou crescimento.",
        opcoes: [
          { id: "reserva", rotulo: "Montar uma reserva" }, { id: "imovel", rotulo: "Comprar um imóvel" }, { id: "aposentadoria", rotulo: "Aposentadoria ou independência" },
          { id: "renda_passiva", rotulo: "Viver de renda passiva" }, { id: "crescer", rotulo: "Fazer o patrimônio crescer" }, { id: "educacao", rotulo: "Educação ou um grande projeto" },
        ] },
      { id: "valor_alvo", bloco: "objetivo", essencial: false, dinheiro: true, texto: "Quanto você quer juntar para esse objetivo?",
        porque: "Com o valor, o prazo e o que você guarda, calculamos o retorno que o objetivo exige.",
        opcoes: [
          { id: "ate_50k", rotulo: "Até R$ 50 mil", v: 30000 }, { id: "50_200k", rotulo: "R$ 50 a 200 mil", v: 125000 }, { id: "200_500k", rotulo: "R$ 200 a 500 mil", v: 350000 },
          { id: "500k_1m", rotulo: "R$ 500 mil a 1 milhão", v: 750000 }, { id: "1m_3m", rotulo: "R$ 1 a 3 milhões", v: 2000000 }, { id: "3m_mais", rotulo: "Mais de R$ 3 milhões", v: 5000000 }, ND,
        ] },
      { id: "prazo", bloco: "objetivo", essencial: true, texto: "Em quanto tempo você quer chegar lá?",
        porque: "Prazo curto não combina com risco alto: uma queda pode não dar tempo de voltar.",
        opcoes: [
          { id: "menos_2", rotulo: "Em menos de 2 anos", v: 1 }, { id: "2_5", rotulo: "De 2 a 5 anos", v: 3.5 }, { id: "5_10", rotulo: "De 5 a 10 anos", v: 7.5 },
          { id: "10_20", rotulo: "De 10 a 20 anos", v: 15 }, { id: "20_mais", rotulo: "Mais de 20 anos", v: 25 },
        ] },
      { id: "saque", bloco: "objetivo", essencial: false, texto: "Qual a chance de você precisar desse dinheiro antes do prazo?",
        porque: "Quem pode precisar do dinheiro antes não deve deixá-lo em algo que pode estar em queda.",
        opcoes: [{ id: "nao", rotulo: "Baixa" }, { id: "talvez", rotulo: "Média" }, { id: "provavel", rotulo: "Alta" }] },
      // ---------- 4. experiência e reação
      { id: "tempo", bloco: "reacao", essencial: true, texto: "Há quanto tempo você investe?",
        porque: "Experiência com altos e baixos muda como as pessoas reagem na prática.",
        opcoes: [
          { id: "nunca", rotulo: "Ainda não invisto", k: 0 }, { id: "menos_1", rotulo: "Menos de 1 ano", k: 1 }, { id: "1_3", rotulo: "1 a 3 anos", k: 2 },
          { id: "3_5", rotulo: "3 a 5 anos", k: 3 }, { id: "5_mais", rotulo: "Mais de 5 anos", k: 4 },
        ] },
      { id: "produtos", bloco: "reacao", essencial: false, multipla: true, texto: "Quais destes você já usou?",
        porque: "Quem nunca investiu em renda variável vê esses produtos só como “para estudar”, com peso limitado.",
        opcoes: [
          { id: "poupanca", rotulo: "Poupança" }, { id: "renda_fixa", rotulo: "CDB, Tesouro ou outra renda fixa" }, { id: "fundos", rotulo: "Fundos" },
          { id: "acoes", rotulo: "Ações ou ETFs", rv: true }, { id: "fii", rotulo: "Fundos imobiliários", rv: true }, { id: "cripto", rotulo: "Criptomoedas", rv: true },
        ] },
      { id: "t_queda", bloco: "reacao", essencial: true, texto: "Seu investimento perde 20% em três meses. O que você faz?",
        porque: "Uma das perguntas que medem a sua reação a quedas.",
        opcoes: [
          { id: "vende", rotulo: "Vendo tudo para não perder mais", t: 0 }, { id: "parte", rotulo: "Vendo uma parte", t: 1 },
          { id: "mantem", rotulo: "Mantenho e espero", t: 2 }, { id: "aporta", rotulo: "Aporto mais, ficou mais barato", t: 3 },
        ] },
      { id: "t_certo", bloco: "reacao", essencial: true, texto: "Qual você prefere: R$ 1.000 garantidos ou 50% de chance de ganhar R$ 2.500 (e 50% de não ganhar nada)?",
        porque: "Compara a certeza com o ganho maior e incerto.",
        opcoes: [
          { id: "certo", rotulo: "Os R$ 1.000 garantidos", t: 0 }, { id: "quase_certo", rotulo: "Garantidos, mas pensei na aposta", t: 1 },
          { id: "quase_risco", rotulo: "A aposta, com algum receio", t: 2 }, { id: "risco", rotulo: "A aposta, sem hesitar", t: 3 },
        ] },
      { id: "amigo", bloco: "reacao", essencial: true, texto: "Como um amigo próximo descreveria você diante de risco?",
        porque: "O olhar de fora costuma ser mais honesto que o nosso.",
        opcoes: [
          { id: "cauteloso", rotulo: "Muito cauteloso", t: 0 }, { id: "prudente", rotulo: "Prudente", t: 1 },
          { id: "equilibrado", rotulo: "Equilibrado", t: 2 }, { id: "ousado", rotulo: "Ousado", t: 3 },
        ] },
      { id: "t_perda", bloco: "reacao", essencial: true, texto: "Qual a maior perda, em um ano, que você aceitaria na sua carteira para ter chance de ganhar mais?",
        porque: "Coloca um número no seu limite.",
        opcoes: [
          { id: "zero", rotulo: "Nenhuma", t: 0 }, { id: "5", rotulo: "Até 5%", t: 1 }, { id: "10", rotulo: "Até 10%", t: 2 },
          { id: "20", rotulo: "Até 20%", t: 3 }, { id: "30", rotulo: "30% ou mais", t: 4 },
        ] },
      { id: "t_clima", bloco: "reacao", essencial: true, texto: "O mercado cai forte e só se fala em crise. Como você se sente?",
        porque: "A mesma ideia da pergunta de queda, perguntada de outro jeito, para conferir a consistência.",
        opcoes: [
          { id: "angustia", rotulo: "Muita angústia, quero sair", t: 0 }, { id: "preocupa", rotulo: "Preocupado, mas aguento", t: 1 },
          { id: "neutro", rotulo: "Tranquilo, é parte do jogo", t: 2 }, { id: "oportunidade", rotulo: "Vejo oportunidade", t: 3 },
        ] },
      { id: "t_carteiras", bloco: "reacao", essencial: true, texto: "Entre duas carteiras, qual você escolheria? A rende 6% ao ano sem oscilar. B pode render 14% ou perder 8%.",
        porque: "Compara estabilidade com possibilidade de ganho, em números.",
        opcoes: [
          { id: "a", rotulo: "A, com certeza", t: 0 }, { id: "mais_a", rotulo: "A, mas tenho curiosidade pela B", t: 1 },
          { id: "mais_b", rotulo: "B, com algum receio", t: 2 }, { id: "b", rotulo: "B, sem dúvida", t: 3 },
        ] },
      { id: "t_foco", bloco: "reacao", essencial: true, texto: "O que pesa mais para você numa carteira?",
        porque: "Mostra se a prioridade é proteger o que existe ou fazer crescer.",
        opcoes: [
          { id: "preservar", rotulo: "Não perder o que já tenho", t: 0 }, { id: "mais_preservar", rotulo: "Proteger, mas com algum ganho", t: 1 },
          { id: "equilibrar", rotulo: "Equilibrar ganho e proteção", t: 2 }, { id: "crescer", rotulo: "Fazer crescer, aceitando oscilar", t: 3 },
        ] },
    ],
    // por que cada recomendação existe: o Relatório monta o texto pelo id da regra
    regras: {
      "plano.divida_cara": "Você declarou dívida cara em aberto. Nenhum investimento rende mais que o juro do rotativo, então o plano começa por quitá-la.",
      "plano.reserva_6": "Renda estável pede reserva de 6 meses de custo de vida, em renda fixa pós-fixada com liquidez diária.",
      "plano.reserva_12": "Renda variável ou autônoma pede reserva de 12 meses de custo de vida, em renda fixa pós-fixada com liquidez diária.",
      "plano.reserva_ok": "Sua reserva já cobre os meses recomendados para o seu tipo de renda.",
      "plano.objetivo_curto": "Objetivo em menos de 2 anos fica em renda fixa com vencimento casado ao prazo, fora da carteira de risco.",
      "plano.longo_prazo": "O que sobra depois da reserva segue a alocação do seu perfil.",
      "plano.aporte": "Aporte sugerido: a sobra mensal que você informou vezes o fator do perfil {perfil} ({fator}).",
      "alocacao.faixa_perfil": "Perfil {perfil}: faixas de alocação do seu perfil, com o ponto dentro da faixa dado pelo seu score ({score}).",
      "alocacao.teto_conhecimento": "{classe} limitada a {teto}% porque você ainda tem pouca experiência com renda variável.",
      "alocacao.modulo_desligado": "{classe} fica de fora porque o módulo está desligado em Ajustes.",
      "alocacao.hierarquia": "Renda fixa sempre a maior fatia, ações no meio e cripto a menor.",
      "alocacao.cripto_perfil": "Cripto limitada a {teto}%: perfil {perfil}.",
      "teto.divida_cara": "Capacidade limitada a {limite}: dívida cara em aberto.",
      "teto.reserva_curta": "Capacidade limitada a {limite}: reserva menor que 3 meses.",
      "teto.prazo_curto": "Capacidade limitada a {limite}: objetivo em menos de 2 anos.",
      "teto.saque_provavel": "Capacidade limitada a {limite}: chance alta de precisar do dinheiro antes do prazo.",
      "desconto.agro_alto": "Capacidade reduzida em {pontos} pontos: o agro passa de 50% do patrimônio.",
      "candidato.filtros": "Passa nos quatro filtros do perfil {perfil}: classe permitida, score mínimo, risco e concentração.",
      "conflito.meta_acima_perfil": "A sua meta pede mais risco do que cabe no seu perfil.",
      "conflito.meta_folgada": "Dá para chegar lá com menos risco.",
      "conflito.tolerancia_acima_capacidade": "O limite é a sua situação financeira, não a coragem.",
      "conflito.baixa_consistencia": "Respostas parecidas se contradisseram: o resultado fica marcado como baixa consistência.",
      "conflito.carteira_acima_perfil": "A carteira real é mais arriscada do que o perfil declarado.",
      "conflito.vendas_em_queda": "Houve vendas em quedas fortes, o que contradiz a tolerância declarada.",
    },
  };

  // ------------------------------------------------------------------ agro
  FC.CATEGORIAS_GADO = {
    bezerro: "Bezerro", bezerra: "Bezerra", garrote: "Garrote", novilha: "Novilha",
    boi_magro: "Boi magro", boi_gordo: "Boi gordo", vaca: "Vaca", touro: "Touro", outro: "Outro",
  };
  // peso vivo típico (kg) — só para estimar quando você ainda não pesou
  FC.PESO_TIPICO = { bezerro: 200, bezerra: 180, garrote: 300, novilha: 300, boi_magro: 380, boi_gordo: 540, vaca: 450, touro: 750, outro: 350 };
  FC.TIPOS_MOV = {
    compra: { nome: "Compra", sinal: 1, cor: "azul" },
    venda: { nome: "Venda", sinal: -1, cor: "verde" },
    nascimento: { nome: "Nascimento", sinal: 1, cor: "terra" },
    morte: { nome: "Morte", sinal: -1, cor: "vermelho" },
    entrada: { nome: "Outra entrada", sinal: 1, cor: "cinza" },
    saida: { nome: "Outra saída", sinal: -1, cor: "cinza" },
    reclassificacao: { nome: "Mudança de categoria", sinal: 0, cor: "amarelo" },
  };
  FC.CATEGORIAS_CUSTO = {
    nutricao: "Nutrição e sal", sanidade: "Sanidade e vacinas", mao_de_obra: "Mão de obra",
    arrendamento: "Arrendamento de pasto", frete: "Frete", maquinas: "Máquinas e combustível",
    impostos: "Impostos e taxas", outros: "Outros",
  };
  // A arroba é 15 kg de carcaça. Com rendimento de carcaça de ~52%, um
  // boi de 540 kg vivo rende 540 × 0,52 ÷ 15 ≈ 18,7 @.
  FC.PADRAO_AGRO = {
    preco_arroba: 310,
    rendimento_carcaca: 52,
    // preço por @ específico por categoria (ex.: bezerro costuma ter ágio)
    arroba_por_categoria: {},
    data_cotacao: null,
    // true: o rebanho vale o que foi pago até ser vendido (sem estimar pela @)
    avaliar_pelo_custo: false,
  };

  // mescla profunda: o que foi salvo sobrepõe o padrão, chave a chave
  FC.mescla = function mescla(base, sobre) {
    if (sobre == null) return JSON.parse(JSON.stringify(base));
    if (typeof base !== "object" || base == null || Array.isArray(base)) return sobre;
    const saida = JSON.parse(JSON.stringify(base));
    for (const [k, v] of Object.entries(sobre)) {
      if (v && typeof v === "object" && !Array.isArray(v) && typeof saida[k] === "object" && saida[k] && !Array.isArray(saida[k])) {
        saida[k] = mescla(saida[k], v);
      } else if (v !== undefined) {
        saida[k] = v;
      }
    }
    return saida;
  };
})();
