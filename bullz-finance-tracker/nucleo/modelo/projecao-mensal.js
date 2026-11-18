/* Projeção mês a mês por ativo, com eventos e cenários (Marco 7).
 *
 * Entradas: as posições de hoje (ativos, títulos, potes, agro), o plano de
 * aporte do Salário (valor de cada mês futuro, Marco 5), a hierarquia (a
 * divisão sugerida no modo hierarquia, Marco 6), os eventos futuros e o
 * cenário. Saída: a série mensal por ativo e por categoria.
 *
 * Cenários:
 *   historico     cada ativo rende a sua taxa histórica com proventos
 *                 reinvestidos (janela padrão de 5 anos); renda fixa pelo
 *                 CDI/IPCA de hoje e pela taxa do título
 *   so_proventos  preço parado: o ativo cresce só pelo DY reinvestido; RF igual
 *   estresse      histórico + choque na cripto no 1º mês (padrão −30%)
 *
 * Eventos (eventos_futuros e os da chamada): venda_agro, mudanca_renda,
 * aporte_extra, resgate. As vendas planejadas do agro (Marco 4) viram
 * eventos sozinhas. Indicadores: CDI e IPCA de indices_diarios (série do
 * Banco Central, completada todo dia pelo agendamento fc-registro-diario). */
(function () {
  const FC = window.FC;
  const ok = (v) => v != null && v !== "" && Number.isFinite(Number(v));
  const mensal = (aa) => Math.pow(1 + aa / 100, 1 / 12) - 1;
  const seguinte = (m) => { const [a, n] = m.split("-").map(Number); return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, "0")}`; };
  const GRUPO = { caixa: "rf", acoes: "acoes", real_estate: "acoes", alternativos: "cripto", agro: "agro" };
  const PILAR_DO_GRUPO = { rf: "caixa", acoes: "acoes", cripto: "alternativos" };

  // ---------------------------------------------------------------- indicadores
  /** CDI e IPCA de hoje (% a.a. e % em 12 meses), da série diária ou do macro */
  function indicadores(dados, mercado) {
    const m = (dados && dados.macro) || {};
    let cdi = ok(m.cdi) ? Number(m.cdi) : null, ipca = ok(m.ipca_12m) ? Number(m.ipca_12m) : null;
    const ix = mercado && mercado.indices;
    if (ix && typeof ix.fator === "function") {
      const hoje = FC.datas.hoje(), ano = FC.datas.soma(hoje, -365);
      try { const f = ix.fator("cdi", 100, ano, hoje); if (f && f.f > 0 && !f.estimado) cdi = (f.f - 1) * 100; } catch (e) { /* fica o macro */ }
      try { const f = ix.fator("ipca", 0, ano, hoje); if (f && f.f > 0 && !f.estimado) ipca = (f.f - 1) * 100; } catch (e) { /* fica o macro */ }
    }
    return { cdi: cdi ?? 10, ipca: ipca ?? 4, fonte: ix ? "indices_diarios (Banco Central)" : "macro do dia" };
  }

  // ---------------------------------------------------------------- taxas por ativo
  /** retorno anualizado com proventos reinvestidos e DY médio, do histórico de preço */
  function taxaHistorica(h, anos = 5) {
    if (!h || !h.precos || h.precos.length < 30) return null;
    const fim = h.precos.at(-1)[0];
    const ini = FC.datas.soma(fim, -Math.round(anos * 365));
    const ps = h.precos.filter(([d]) => d >= ini);
    if (ps.length < 30) return null;
    const divs = (h.dividendos || []).filter(([d]) => d >= ps[0][0] && d <= fim);
    // índice de retorno total: cada provento compra mais cotas no preço do dia
    let cotas = 1, k = 0;
    for (const [d, v] of divs) {
      while (k < ps.length - 1 && ps[k + 1][0] <= d) k++;
      if (ps[k][1] > 0) cotas += (cotas * v) / ps[k][1];
    }
    const p0 = ps[0][1], p1 = ps.at(-1)[1];
    if (!(p0 > 0 && p1 > 0)) return null;
    const anosReais = FC.datas.dias(ps[0][0], fim) / 365;
    if (anosReais < 0.9) return null;
    const total = (cotas * p1) / p0;
    const somaDiv = divs.reduce((s, [, v]) => s + v, 0);
    const precoMedio = ps.reduce((s, [, v]) => s + v, 0) / ps.length;
    return { retorno_aa: (Math.pow(total, 1 / anosReais) - 1) * 100, dy_aa: precoMedio > 0 ? (somaDiv / anosReais / precoMedio) * 100 : 0, anos: anosReais };
  }

  /** taxa a.a. de um título de renda fixa pelo indexador */
  function taxaTitulo(t, ind) {
    const taxa = ok(t.taxa) ? Number(t.taxa) : t.tipo === "cdi" || t.tipo === "selic" ? 100 : 0;
    if (t.tipo === "cdi" || t.tipo === "selic") return (ind.cdi * taxa) / 100;
    if (t.tipo === "ipca") return ((1 + ind.ipca / 100) * (1 + taxa / 100) - 1) * 100;
    return taxa;
  }

  // ---------------------------------------------------------------- eventos
  /** eventos salvos + vendas planejadas do agro + extras da chamada, por mês */
  function eventosDoPeriodo(estado, extras = [], incluirPlanejadas = true) {
    const ev = [];
    for (const e of (estado.base && estado.base.eventosFuturos) || []) ev.push({ ...e, origem: "eventos_futuros" });
    const ag = estado.dados && estado.dados.agro;
    if (incluirPlanejadas && ag && ag.lotes) {
      for (const v of ag.lotes.vendas_planejadas || []) {
        if (!v.data_prevista || v.receita_esperada == null) continue;
        ev.push({ data: v.data_prevista, tipo: "venda_agro", parametros: { valor: v.receita_esperada, cabecas: v.cabecas, destino: v.destino_planejado || "rf", lote: v.lote },
          descricao: `venda planejada ${v.lote || ""}`.trim(), origem: "venda_planejada" });
      }
    }
    for (const e of extras || []) ev.push({ ...e, origem: "chamada" });
    return ev;
  }

  // ---------------------------------------------------------------- motor
  /**
   * opcoes: { meses (1..600), cenario, eventos (extras), taxas {ticker|grupo: % a.a.},
   *           janela_anos, choque_cripto (% negativo), incluir_vendas_planejadas, aporte_mensal (força) }
   */
  function projeta(estado, opcoes = {}) {
    const d = estado.dados, base = estado.base, prefs = estado.prefs, merc = estado.mercado || {};
    const meses = Math.max(1, Math.min(600, Number(opcoes.meses) || 12));
    const cenario = opcoes.cenario || "historico";
    const ind = indicadores(d, merc);
    const forca = opcoes.taxas || {};
    const choque = ok(opcoes.choque_cripto) ? Number(opcoes.choque_cripto) : -30;
    const hoje = FC.datas.hoje();
    const mes0 = hoje.slice(0, 7);

    // ------------------------------------------------ baldes de hoje
    const baldes = [];
    for (const a of d.ativos || []) {
      if (!a.posicao || !(a.posicao.atual > 0)) continue;
      const g = GRUPO[a.pilar] || "acoes";
      const th = taxaHistorica((merc.historicos || {})[a.ticker], opcoes.janela_anos || 5);
      const r = ok(forca[a.ticker]) ? Number(forca[a.ticker]) : ok(forca[g]) ? Number(forca[g]) : th ? th.retorno_aa : ind.cdi;
      const dy = ok(forca["dy:" + a.ticker]) ? Number(forca["dy:" + a.ticker]) : th ? th.dy_aa : 0;
      baldes.push({ chave: a.ticker, nome: a.ticker, grupo: g, pilar: a.pilar, valor: a.posicao.atual, r_aa: r, dy_aa: dy, fonte: ok(forca[a.ticker]) || ok(forca[g]) ? "informada" : th ? "histórica" : "CDI (sem histórico)" });
    }
    for (const t of d.rendaFixa || []) {
      const v = Number(t.valor_aplicado) || 0;
      baldes.push({ chave: "rf:" + t.nome, nome: t.nome, grupo: GRUPO[t.pilar || "caixa"] || "rf", pilar: t.pilar || "caixa", valor: v,
        r_aa: ok(forca["rf:" + t.nome]) ? Number(forca["rf:" + t.nome]) : ok(forca.rf) ? Number(forca.rf) : taxaTitulo(t, ind), dy_aa: 0, fonte: "taxa do título" });
    }
    const caixaExtra = (d.potes ? d.potes.externo : 0) + (d.caixa_proventos && d.caixa_proventos.ativo ? d.caixa_proventos.saldo : 0);
    // o "caixa" recebe aportes de RF sem título e o dinheiro de eventos; rende o CDI
    baldes.push({ chave: "caixa", nome: "Caixa e potes", grupo: "rf", pilar: "caixa", valor: Math.max(0, caixaExtra), r_aa: ok(forca.rf) ? Number(forca.rf) : ind.cdi, dy_aa: 0, fonte: "CDI" });
    const agroHoje = (d.agro && (d.agro.valorRebanho || 0) + ((d.agro.financeiro || {}).caixa_agro || 0)) || 0;
    baldes.push({ chave: "agro", nome: "Agro", grupo: "agro", pilar: "agro", valor: agroHoje, r_aa: 0, dy_aa: 0, fonte: "parado (valor de hoje)" });
    const porChave = new Map(baldes.map((b) => [b.chave, b]));
    const balde = (chave, grupo) => {
      if (!porChave.has(chave)) {
        const nb = { chave, nome: chave, grupo, pilar: PILAR_DO_GRUPO[grupo] || "caixa", valor: 0, r_aa: ok(forca[grupo]) ? Number(forca[grupo]) : ind.cdi, dy_aa: 0, fonte: "novo" };
        baldes.push(nb); porChave.set(chave, nb);
      }
      return porChave.get(chave);
    };

    // ------------------------------------------------ divisão do aporte
    const h = FC.hierarquia ? FC.hierarquia.analisa(estado) : null;
    const usarHierarquia = !!(h && prefs.hierarquia && prefs.hierarquia.modo_alocacao === "hierarquia");
    const destinosPlano = (prefs.plano && prefs.plano.destinos) || [];
    // distribui `valor` num grupo, entre os ativos dele, pelo peso de hoje
    const noGrupo = (grupo, valor) => {
      const membros = baldes.filter((b) => b.grupo === grupo && b.chave !== "caixa" && b.valor > 0);
      if (grupo === "rf" && !membros.length) { balde("caixa", "rf").valor += valor; return; }
      if (!membros.length) { balde("novo:" + grupo, grupo).valor += valor; return; }
      const tot = membros.reduce((s, b) => s + b.valor, 0);
      for (const b of membros) b.valor += (valor * b.valor) / tot;
    };
    const aplicaAporte = (valor) => {
      if (!(valor > 0)) return;
      if (usarHierarquia || !destinosPlano.length) {
        const div = (h && h.divisao_sugerida_aporte) || { rf: 100, acoes: 0, cripto: 0 };
        for (const g of ["rf", "acoes", "cripto"]) noGrupo(g, (valor * (div[g] || 0)) / 100);
        return;
      }
      const soma = destinosPlano.reduce((s, x) => s + (Number(x.pct) || 0), 0) || 1;
      for (const x of destinosPlano) {
        const v = (valor * (Number(x.pct) || 0)) / soma;
        if (x.tipo === "ativo") { const a = (d.ativos || []).find((y) => y.ticker === x.alvo); balde(x.alvo, GRUPO[a ? a.pilar : "alternativos"] || "acoes").valor += v; }
        else if (x.tipo === "renda_fixa") balde("rf:" + x.alvo, "rf").valor += v;
        else noGrupo(GRUPO[x.alvo] || "rf", v);
      }
    };

    // ------------------------------------------------ eventos por mês
    const eventos = eventosDoPeriodo(estado, opcoes.eventos, opcoes.incluir_vendas_planejadas !== false);
    const porMes = {};
    for (const e of eventos) { const m = String(e.data).slice(0, 7); (porMes[m] = porMes[m] || []).push(e); }
    let aporteForcado = ok(opcoes.aporte_mensal) ? Number(opcoes.aporte_mensal) : null;
    const aporteDoMes = (mes) => {
      if (aporteForcado != null) return aporteForcado;
      try { return FC.salario.metaDoMes(prefs.plano, base.ganhos || [], mes, base) || 0; } catch (e) { return 0; }
    };

    // ------------------------------------------------ meses
    const serie = [];
    const somaGrupo = () => {
      const g = { rf: 0, acoes: 0, cripto: 0, agro: 0 };
      for (const b of baldes) g[b.grupo] = (g[b.grupo] || 0) + b.valor;
      return g;
    };
    let mes = mes0;
    for (let i = 1; i <= meses; i++) {
      mes = seguinte(mes);
      // 1. rendimento do mês
      for (const b of baldes) {
        if (b.grupo === "agro") continue;
        if (cenario === "so_proventos" && b.grupo !== "rf") b.valor *= 1 + mensal(b.dy_aa || 0);
        else b.valor *= 1 + mensal(b.r_aa || 0);
      }
      if (cenario === "estresse" && i === 1) for (const b of baldes) if (b.grupo === "cripto") b.valor *= 1 + choque / 100;
      // 2. eventos
      const feitos = [];
      for (const e of porMes[mes] || []) {
        const p = e.parametros || {};
        const v = Number(p.valor) || 0;
        if (e.tipo === "venda_agro") {
          const ag = balde("agro", "agro");
          const imp = FC.lotes ? FC.lotes.impostosVenda(v, { parametros: base.parametros || [], data: e.data }) : null;
          const liquido = imp && imp.funrural != null ? imp.liquido : v;
          // o rebanho vendido sai pelo valor de hoje (proporcional às cabeças, se informado)
          const cab = Number(p.cabecas) || null, total = d.agro && d.agro.total;
          ag.valor = Math.max(0, ag.valor - (cab && total ? (ag.valor * cab) / total : Math.min(ag.valor, v)));
          const destino = p.destino && porChave.has(p.destino) ? porChave.get(p.destino) : balde("caixa", "rf");
          destino.valor += liquido;
          feitos.push({ tipo: e.tipo, valor: liquido, descricao: e.descricao || "venda do gado" });
        } else if (e.tipo === "aporte_extra") {
          if (p.destino && porChave.has(p.destino)) porChave.get(p.destino).valor += v; else aplicaAporte(v);
          feitos.push({ tipo: e.tipo, valor: v, descricao: e.descricao || "aporte extra" });
        } else if (e.tipo === "resgate") {
          let falta = v;
          for (const b of baldes.filter((x) => x.grupo === "rf").sort((a, c) => c.valor - a.valor)) { const t = Math.min(b.valor, falta); b.valor -= t; falta -= t; if (falta <= 0) break; }
          feitos.push({ tipo: e.tipo, valor: -(v - falta), descricao: e.descricao || "resgate" });
        } else if (e.tipo === "mudanca_renda") {
          if (ok(p.aporte_mensal)) aporteForcado = Number(p.aporte_mensal);
          feitos.push({ tipo: e.tipo, valor: ok(p.aporte_mensal) ? Number(p.aporte_mensal) : null, descricao: e.descricao || "mudança de renda" });
        }
      }
      // 3. aporte do mês
      const aporte = aporteDoMes(mes);
      aplicaAporte(aporte);
      const g = somaGrupo();
      const total = g.rf + g.acoes + g.cripto + g.agro;
      serie.push({ mes, aporte, total, total_sem_agro: total - g.agro, por_categoria: g,
        por_ativo: Object.fromEntries(baldes.filter((b) => b.valor > 0.005).map((b) => [b.chave, b.valor])), eventos: feitos });
    }
    return {
      cenario, meses, inicio: mes0, indicadores: ind, divisao: usarHierarquia || !destinosPlano.length ? "hierarquia (sugerida)" : "plano do Salário",
      taxas: baldes.map((b) => ({ chave: b.chave, grupo: b.grupo, r_aa: b.r_aa, dy_aa: b.dy_aa, fonte: b.fonte })),
      eventos: eventos.map((e) => ({ data: e.data, tipo: e.tipo, descricao: e.descricao || null, origem: e.origem, parametros: e.parametros || {} })),
      serie, final: serie.at(-1),
    };
  }

  /** agrega a série mensal em anos (horizonte longo) */
  function porAno(serie) {
    const anos = {};
    for (const p of serie) anos[p.mes.slice(0, 4)] = p;
    return Object.values(anos).map((p) => ({ ano: p.mes.slice(0, 4), mes: p.mes, total: p.total, total_sem_agro: p.total_sem_agro, por_categoria: p.por_categoria }));
  }

  FC.projecaoMensal = { projeta, porAno, indicadores, taxaHistorica, taxaTitulo, eventosDoPeriodo };
})();
