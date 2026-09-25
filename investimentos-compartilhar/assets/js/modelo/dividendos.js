/* Dividendos: quanto a carteira pagou, quanto vai pagar e quando.
 *
 * Tem direito ao provento quem tem a ação no fim da DATA COM. Então o
 * valor de cada pagamento é a quantidade que você tinha naquele dia ×
 * valor por ação. JCP tem 15% de IR retido na fonte: entra líquido.
 *
 * A quantidade de cada dia sai dos aportes. A posição que foi cadastrada
 * sem histórico de compra (a "quantidade inicial") não tem data: ela é
 * considerada só nos últimos 12 meses — o suficiente para a média mensal,
 * sem inventar dividendos de anos em que talvez você nem tivesse a ação. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;
  const IR_JCP = 0.15;
  const COM_DIVIDENDO = new Set(["acao_br", "fii", "etf_br", "acao_us", "etf_us"]);

  function qtdEm(ativo, compras, importado, data, inicioBase) {
    let q = !importado && data >= inicioBase ? Number(ativo.quantidade) || 0 : 0;
    for (const c of compras) { if (c.data > data) break; q += c.quantidade; }
    return q;
  }

  function frequencia(n12) {
    if (n12 >= 10) return "mensal";
    if (n12 >= 5) return "bimestral";
    if (n12 >= 3) return "trimestral";
    if (n12 >= 2) return "semestral";
    if (n12 >= 1) return "anual";
    return "sem pagamento em 12 meses";
  }

  function analisa(dados, base, proventos) {
    const hoje = FC.datas.hoje();
    const ha12 = FC.datas.soma(hoje, -365);
    const inicioBase = ha12;
    const importados = new Set(base.aportes.filter((a) => a.tipo === "ativo" && a.origem).map((a) => a.ticker));
    const lancados = new Set(base.aportes.filter((a) => a.tipo === "provento" && a.origem).map((a) => a.origem));

    const pagamentos = [];
    const porAtivo = [];
    for (const a of dados.ativos) {
      if (!COM_DIVIDENDO.has(a.classe) || a.erro) continue;
      const item = base.ativos.find((x) => x.ticker === a.ticker) || { quantidade: 0 };
      const compras = base.aportes.filter((x) => x.tipo === "ativo" && x.ticker === a.ticker).sort((x, y) => x.data.localeCompare(y.data));
      const qtdHoje = a.posicao ? a.posicao.quantidade : 0;
      if (!qtdHoje && !compras.length) continue;          // só watchlist: não recebe nada
      const p = proventos[a.ticker];
      const lista = (p && p.lista) || [];

      let recebido12 = 0, porAcao12 = 0, n12 = 0;
      const datas12 = new Set();
      for (const pr of lista) {
        const futuro = pr.data_com > hoje;
        const q = futuro ? qtdHoje : qtdEm(item, compras, importados.has(a.ticker), pr.data_com, inicioBase);
        const liquidoPorAcao = pr.valor * (pr.tipo === "JCP" ? 1 - IR_JCP : 1);
        if (pr.data_com > ha12 && pr.data_com <= hoje) {
          porAcao12 += liquidoPorAcao;
          datas12.add(pr.data_com);
        }
        if (!(q > 0)) continue;
        const valor = q * liquidoPorAcao;
        const quando = pr.pagamento || pr.data_com;
        const pago = !!pr.pagamento && pr.pagamento <= hoje;
        const origem = `div:${a.ticker}:${pr.data_com}:${pr.tipo}:${pr.valor}`;
        pagamentos.push({
          ticker: a.ticker, tipo: pr.tipo, data_com: pr.data_com, pagamento: pr.pagamento, quando,
          valor_por_acao: pr.valor, liquido_por_acao: liquidoPorAcao, quantidade: q, valor, bruto: q * pr.valor,
          status: pago ? "pago" : futuro ? "anunciado" : pr.pagamento ? "a receber" : "sem data de pagamento",
          estimado_base: !futuro && !compras.some((c) => c.data <= pr.data_com), origem, lancado: lancados.has(origem),
        });
        if (pago && pr.pagamento > ha12) recebido12 += valor;
      }
      n12 = datas12.size;
      const preco = a.preco, pm = a.posicao && a.posicao.preco_medio;
      const futuros = pagamentos.filter((x) => x.ticker === a.ticker && x.quando > hoje).sort((x, y) => x.quando.localeCompare(y.quando));
      const passados = pagamentos.filter((x) => x.ticker === a.ticker && x.status === "pago").sort((x, y) => y.quando.localeCompare(x.quando));
      porAtivo.push({
        ticker: a.ticker, classe: a.classe, tipo_rotulo: a.tipo_rotulo, quantidade: qtdHoje, preco, preco_medio: pm,
        fonte: p ? p.fonte : null, erro: p && p.erro, sem_dados: !lista.length,
        por_acao_12m: porAcao12, recebido_12m: recebido12,
        // o que a posição de HOJE renderia por mês, se o próximo ano repetir o último
        mensal_estimado: (qtdHoje * porAcao12) / 12,
        dy_12m: preco ? (porAcao12 / preco) * 100 : null,
        yoc: pm ? (porAcao12 / pm) * 100 : null,
        frequencia: frequencia(n12),
        proximo: futuros[0] || null, ultimo: passados[0] || null,
      });
    }
    porAtivo.sort((x, y) => y.mensal_estimado - x.mensal_estimado);

    // por mês de pagamento: os últimos 12 meses e os meses já anunciados
    const meses = {};
    for (const pg of pagamentos) {
      const m = pg.quando.slice(0, 7);
      const d = (meses[m] = meses[m] || { mes: m, total: 0, itens: {}, futuro: false });
      d.total += pg.valor;
      d.itens[pg.ticker] = (d.itens[pg.ticker] || 0) + pg.valor;
      if (pg.quando > hoje) d.futuro = true;
    }
    const inicioMes = ha12.slice(0, 7);
    const ultimoMes = Object.keys(meses).sort().at(-1) || hoje.slice(0, 7);
    const serie = [];
    for (let m = inicioMes; m <= ultimoMes;) {
      const d = meses[m] || { mes: m, total: 0, itens: {}, futuro: m > hoje.slice(0, 7) };
      serie.push({ ...d, itens: Object.entries(d.itens).sort((a, b) => b[1] - a[1]) });
      const [a, mm] = m.split("-").map(Number);
      m = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, "0")}`;
    }

    const proximos = pagamentos.filter((x) => x.quando >= hoje || x.status === "anunciado" || x.status === "sem data de pagamento" && x.data_com > FC.datas.soma(hoje, -60))
      .sort((x, y) => x.quando.localeCompare(y.quando));
    const recebidos = pagamentos.filter((x) => x.status === "pago").sort((x, y) => y.quando.localeCompare(x.quando));
    const em30 = FC.soma(proximos.filter((x) => x.pagamento && x.pagamento <= FC.datas.soma(hoje, 30)), (x) => x.valor);
    const noAno = FC.soma(recebidos.filter((x) => x.quando.slice(0, 4) === hoje.slice(0, 4)), (x) => x.valor);
    const recebido12 = FC.soma(recebidos.filter((x) => x.quando > ha12), (x) => x.valor);
    const mensal = FC.soma(porAtivo, (x) => x.mensal_estimado);
    const valorPosicoes = FC.soma(porAtivo, (x) => (x.preco || 0) * x.quantidade);

    return {
      porAtivo, pagamentos, proximos, recebidos, serie,
      resumo: { mensal_estimado: mensal, recebido_12m: recebido12, no_ano: noAno, proximos_30d: em30,
        dy_carteira: valorPosicoes ? ((mensal * 12) / valorPosicoes) * 100 : null,
        n_pagadores: porAtivo.filter((x) => x.por_acao_12m > 0).length, n_ativos: porAtivo.length },
    };
  }

  FC.dividendos = { analisa, COM_DIVIDENDO, IR_JCP };
})();
