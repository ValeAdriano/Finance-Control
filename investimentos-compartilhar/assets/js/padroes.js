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
  };

  FC.ROTULO_CURTO = {
    pvp: "P/VP", pl: "P/L", dy: "DY", vacancia: "Vacância", cap_rate: "Cap rate",
    liquidez: "Liquidez", roe: "ROE", div_liq_pl: "Dív/PL", cresc_rec_5a: "Cresc 5a",
    dist_maxima_52s: "Desc. máx", premio_media_200d: "vs média 200d",
  };

  FC.VEREDITO_CURTO = {
    "atende seus critérios": "Atende",
    "zona cinzenta": "Zona cinzenta",
    "fora dos seus critérios": "Fora",
    "sem dados": "Sem dados",
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
          vacancia: { rotulo: "Vacância média", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 3, aceitavel: 10, ruim: 25 },
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
    cenarios: { pessimista: -4, otimista: 3 },
    macro_longo_prazo: { cdi: null, ipca: null },
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
