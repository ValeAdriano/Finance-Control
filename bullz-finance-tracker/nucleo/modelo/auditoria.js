/* Auditoria dos dados: as checagens de coerência que o Bullz roda sobre o
 * retrato montado (FC.base.carrega). Só leitura. Cada achado diz o que está
 * incoerente, onde e o que fazer. Lista vazia = nada a apontar.
 *
 * Checagens (Marco 1 do plano de evolução):
 *   custo_nulo            posição com preço médio e sem custo
 *   resultado_incoerente  resultado ≠ valor − custo sobre o mesmo conjunto
 *   retorno_sem_sentido   retorno abaixo de −100% ou acima de 1000%
 *   aplicado_divergente   aplicado da rentabilidade ≠ custo da posição (só compras)
 *   cotacao_quebrada      preço zerado ou ausente sem erro da fonte
 *   premissa_duplicada    premissa de aporte salva junto de um plano configurado
 *   proventos_ambiguos    reinvestir_dividendos sem destino_proventos explícito
 *   ganho_fim_divergente  fim do ganho diferente do fim do contrato, sem data do último pagamento
 */
(function () {
  const FC = window.FC;
  const fin = (v) => typeof v === "number" && Number.isFinite(v);
  const TOL = 0.01;

  function achado(tipo, onde, texto, extra = {}) { return { tipo, onde, texto, ...extra }; }

  function verifica(estado) {
    const saida = [];
    const d = estado.dados || {}, base = estado.base || {}, brutas = base.prefsBrutas || {};
    const ativos = d.ativos || [];

    // posições
    for (const a of ativos) {
      if (a.cotacao_quebrada) {
        saida.push(achado("cotacao_quebrada", a.ticker, `${a.ticker} está com cotação ${a.preco == null ? "ausente" : a.preco}: fora de notas, rankings e sugestões até a fonte voltar.`));
      }
      const p = a.posicao;
      if (!p) continue;
      if (p.preco_medio && p.custo == null) {
        saida.push(achado("custo_nulo", a.ticker, `${a.ticker} tem preço médio e custo nulo.`));
      }
    }

    // resumo de bolsa e cripto
    const r = d.resumo;
    if (r && fin(r.investido) && fin(r.atual_com_custo) && fin(r.resultado)) {
      const esperado = r.atual_com_custo - r.investido;
      if (Math.abs(esperado - r.resultado) > TOL) {
        saida.push(achado("resultado_incoerente", "bolsa_e_cripto", `resultado ${r.resultado} ≠ valor ${r.atual_com_custo} − custo ${r.investido}.`));
      }
    }

    // rentabilidade
    const rt = d.rentab;
    if (rt) {
      const confere = (onde, x) => {
        if (!x || !fin(x.periodo_pct)) return;
        if (x.periodo_pct < -100 - TOL || x.periodo_pct > 1000) {
          saida.push(achado("retorno_sem_sentido", onde, `retorno de ${x.periodo_pct.toFixed(1)}% em ${onde} não tem sentido: revise os lançamentos.`));
        }
      };
      confere("total", rt.total);
      for (const [k, v] of Object.entries(rt.classes || {})) confere("classe:" + k, v);
      for (const x of rt.ativos || []) {
        confere(x.ticker, x);
        const a = ativos.find((y) => y.ticker === x.ticker);
        const p = a && a.posicao;
        const soCompras = !(x.realizados && x.realizados.length);
        if (p && fin(p.custo) && !p.custo_estimado && fin(x.aplicado) && soCompras && Math.abs(x.aplicado - p.custo) > Math.max(TOL, p.custo * 0.001)) {
          saida.push(achado("aplicado_divergente", x.ticker, `${x.ticker}: aplicado ${x.aplicado.toFixed(2)} na rentabilidade contra custo ${p.custo.toFixed(2)} na posição.`,
            { aplicado: x.aplicado, custo: p.custo }));
        }
      }
    }

    // preferências
    const plano = brutas.plano || {}, prem = brutas.premissas || {};
    if (plano.destinos && plano.destinos.length && prem.aporte_mensal != null && !prem.aporte_mensal_obsoleta) {
      saida.push(achado("premissa_duplicada", "preferencias.premissas.aporte_mensal",
        `A premissa de aporte (${prem.aporte_mensal}) convive com o plano configurado. O plano é a fonte: a premissa só vale com o plano desligado na projeção.`));
    }
    if (plano.reinvestir_dividendos != null && !plano.destino_proventos) {
      saida.push(achado("proventos_ambiguos", "preferencias.plano",
        `reinvestir_dividendos está salvo sem destino_proventos; o destino derivado é "${FC.salario.destinoProventos(plano, brutas.proventos)}". Salve o plano para fixar.`));
    }

    // ganhos
    for (const g of base.ganhos || []) {
      if (g.tipo === "recorrente" && g.fim && g.data_fim_contrato && g.fim !== g.data_fim_contrato && !g.data_ultimo_pagamento) {
        saida.push(achado("ganho_fim_divergente", g.nome, `${g.nome}: fim ${g.fim} e fim do contrato ${g.data_fim_contrato}. Informe a data do último pagamento.`));
      }
    }
    return saida;
  }

  FC.auditoria = { verifica };
})();
