/* Rentabilidade aporte a aporte.
 *
 * 1. Renda fixa: cada aporte rende da SUA data até hoje, pela taxa dele
 *    (ou a do título). Pós-fixado (CDI/Selic) compõe dia a dia com o
 *    índice publicado para cada dia útil; prefixado usa dias úteis/252;
 *    IPCA + X distribui o IPCA de cada mês pelos dias úteis do mês.
 * 2. Ações, FIIs e cripto: lotes por compra, vendas consumindo os lotes
 *    mais antigos (PEPS/FIFO), cada lote com o próprio resultado.
 * 3. Consolidação por ativo e pela carteira, ponderada por valor e tempo:
 *    - TIR (XIRR) ao ano: a taxa que o SEU dinheiro rendeu, contando quando
 *      cada real entrou e saiu. É a medida certa para quem decide os aportes.
 *    - Retorno no período (Modified Dietz): o ganho dividido pelo capital
 *      médio que ficou aplicado — o mesmo critério, sem anualizar (bom para
 *      prazos curtos, em que anualizar distorce).
 *    A TWR (que ignora o tamanho dos aportes) serve para comparar com o
 *    CDI e o Ibovespa e é calculada na série diária do gráfico.
 */
(function () {
  const FC = window.FC;
  const D = () => FC.datas;
  const INICIO = "2015-01-01";

  // ---------------------------------------------------------------- índices
  // { cdi: [[data, %dia]], selic: [...], ipca: [[AAAA-MM-01, %mês]] } →
  // calendário de dias úteis (o do CDI publicado; depois dele, o do app)
  // e fatores acumulados por indexador e taxa, para consultar em O(1).
  // "reserva" é a foto anual do Banco Central (macro: cdi, selic_meta,
  // ipca_12m): sem a série diária, o título rende por ela (como estimativa)
  // em vez de ficar parado no valor aplicado.
  const aoDia = (anual) => (FC.ok(anual) ? (Math.pow(1 + anual / 100, 1 / 252) - 1) * 100 : null);
  const aoMes = (anual) => (FC.ok(anual) ? (Math.pow(1 + anual / 100, 1 / 12) - 1) * 100 : null);
  function preparaIndices(bruto, reserva) {
    bruto = bruto || {}; reserva = reserva || {};
    const cdi = bruto.cdi || [], selic = bruto.selic || [], ipca = bruto.ipca || [];
    const resCdi = aoDia(reserva.cdi), resSelic = aoDia(reserva.selic_meta) ?? resCdi, resIpca = aoMes(reserva.ipca_12m);
    const mCdi = new Map(cdi), mSelic = new Map(selic), mIpca = new Map(ipca.map(([d, v]) => [d.slice(0, 7), v]));
    const priCal = cdi.length ? cdi[0][0] : null, ultCal = cdi.length ? cdi.at(-1)[0] : null;
    const ultCdi = cdi.length ? cdi.at(-1)[1] : null, priCdi = cdi.length ? cdi[0][1] : null;
    const ultIpca = ipca.length ? ipca.at(-1)[1] : resIpca;
    const hoje = D().hoje();
    // todos os dias corridos de INICIO a hoje (+1, para "até hoje" incluir hoje)
    const dias = [], pos = new Map();
    for (let d = INICIO, i = 0; d <= D().soma(hoje, 1); d = D().soma(d, 1), i++) { dias.push(d); pos.set(d, i); }
    const util = dias.map((d) => (ultCal && d >= priCal && d <= ultCal ? mCdi.has(d) : D().ehUtil(d)));
    const porMes = {};
    dias.forEach((d, i) => { if (util[i]) porMes[d.slice(0, 7)] = (porMes[d.slice(0, 7)] || 0) + 1; });
    const cache = new Map();

    // valor do índice num dia útil e se foi medido ou estimado
    function taxaDia(indexador, d) {
      if (indexador === "selic") {
        if (mSelic.has(d)) return [mSelic.get(d), false];
        if (mCdi.has(d)) return [mCdi.get(d), true];        // Selic ausente: o CDI do dia
      } else if (mCdi.has(d)) return [mCdi.get(d), false];
      if (ultCdi == null) return [indexador === "selic" ? resSelic : resCdi, true];
      return [d > ultCal ? ultCdi : priCdi, true];
    }

    // fatores acumulados: acum[i] = produto dos fatores diários antes do dia i
    function serie(indexador, taxa) {
      const chave = indexador + ":" + taxa;
      if (cache.has(chave)) return cache.get(chave);
      const acum = new Float64Array(dias.length + 1), est = new Uint8Array(dias.length + 1);
      acum[0] = 1;
      for (let i = 0; i < dias.length; i++) {
        let g = 1, e = 0;
        if (util[i]) {
          const d = dias[i];
          if (indexador === "cdi" || indexador === "selic") {
            const [v, estimado] = taxaDia(indexador, d);
            g = v == null ? 1 : 1 + (v / 100) * (taxa / 100); e = estimado ? 1 : 0;
          } else if (indexador === "prefixado") {
            g = Math.pow(1 + taxa / 100, 1 / 252);
          } else if (indexador === "ipca") {
            const m = d.slice(0, 7), v = mIpca.has(m) ? mIpca.get(m) : ultIpca;
            e = mIpca.has(m) ? 0 : 1;
            g = Math.pow(1 + (v || 0) / 100, 1 / (porMes[m] || 21)) * Math.pow(1 + taxa / 100, 1 / 252);
          }
        }
        acum[i + 1] = acum[i] * g;
        est[i + 1] = est[i] + e;
      }
      const s = { acum, est };
      cache.set(chave, s);
      return s;
    }

    // fator de "de" até "ate" (o dia "ate" não rende ainda) e se houve estimativa
    function fator(indexador, taxa, de, ate) {
      if (!(de < ate)) return { f: 1, estimado: false };
      const i = pos.get(de < INICIO ? INICIO : de), j = pos.get(ate > dias.at(-1) ? dias.at(-1) : ate);
      if (i == null || j == null) return { f: 1, estimado: true };
      const s = serie(indexador, Number(taxa) || 0);
      return { f: s.acum[j] / s.acum[i], estimado: s.est[j] - s.est[i] > 0 || de < INICIO };
    }
    return { fator, ultimo: { cdi: ultCal, ipca: ipca.length ? ipca.at(-1)[0] : null, selic: selic.length ? selic.at(-1)[0] : null },
      tem: cdi.length > 0, so_reserva: !cdi.length && resCdi != null, vazio: !cdi.length && resCdi == null };
  }

  // ---------------------------------------------------------------- consolidação
  const anos = (de, ate) => D().dias(de, ate) / 365;

  // TIR com datas (XIRR). fluxos: [{data, valor}], valor < 0 = dinheiro que
  // saiu do bolso (aporte), > 0 = que voltou (resgate, provento, saldo final).
  function xirr(fluxos) {
    const fs = fluxos.filter((f) => Math.abs(f.valor) > 1e-9).sort((a, b) => a.data.localeCompare(b.data));
    if (fs.length < 2 || !fs.some((f) => f.valor < 0) || !fs.some((f) => f.valor > 0)) return null;
    const t0 = fs[0].data, ts = fs.map((f) => anos(t0, f.data));
    const npv = (r) => fs.reduce((s, f, k) => s + f.valor / Math.pow(1 + r, ts[k]), 0);
    const der = (r) => fs.reduce((s, f, k) => s - (ts[k] * f.valor) / Math.pow(1 + r, ts[k] + 1), 0);
    let r = 0.1;
    for (let k = 0; k < 60; k++) {
      const v = npv(r), dv = der(r);
      if (!isFinite(v) || !isFinite(dv) || dv === 0) break;
      const n = r - v / dv;
      if (!isFinite(n) || n <= -0.9999) break;
      if (Math.abs(n - r) < 1e-10) return n * 100;
      r = n;
    }
    // Newton não convergiu: bisseção
    let lo = -0.9999, hi = 10, flo = npv(lo), fhi = npv(hi);
    if (flo * fhi > 0) { hi = 1e4; fhi = npv(hi); if (flo * fhi > 0) return null; }
    for (let k = 0; k < 200; k++) {
      const m = (lo + hi) / 2, fm = npv(m);
      if (Math.abs(fm) < 1e-9) return m * 100;
      if (flo * fm < 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; }
    }
    return ((lo + hi) / 2) * 100;
  }

  // Modified Dietz: ganho ÷ capital médio ponderado pelo tempo que ficou aplicado
  function dietz(fluxos, valorFinal, fim) {
    const fs = fluxos.filter((f) => Math.abs(f.valor) > 1e-9);
    if (!fs.length) return null;
    const ini = fs.reduce((m, f) => (f.data < m ? f.data : m), fs[0].data);
    const T = Math.max(1, D().dias(ini, fim));
    // aqui o fluxo entra com o sinal do bolso para a carteira: aporte +, saída −
    const entra = fs.map((f) => ({ data: f.data, v: -f.valor }));
    const liquido = entra.reduce((s, f) => s + f.v, 0);
    const base = entra.reduce((s, f) => s + f.v * (D().dias(f.data, fim) / T), 0);
    if (!(base > 1e-9)) return null;
    return ((valorFinal - liquido) / base) * 100;
  }

  // retorno de um lote e o equivalente ao ano (só a partir de 30 dias: abaixo
  // disso, anualizar transforma ruído em número gigante)
  function anualiza(pct, dias) {
    if (pct == null || dias < 30) return null;
    return (Math.pow(1 + pct / 100, 365 / dias) - 1) * 100;
  }

  function resumoFluxos(fluxos, valorFinal, hoje, extra = {}) {
    const aplicado = -fluxos.filter((f) => f.valor < 0).reduce((s, f) => s + f.valor, 0);
    const devolvido = fluxos.filter((f) => f.valor > 0).reduce((s, f) => s + f.valor, 0);
    const comFinal = fluxos.concat(valorFinal > 0 ? [{ data: hoje, valor: valorFinal }] : []);
    const inicio = fluxos.length ? fluxos.reduce((m, f) => (f.data < m ? f.data : m), fluxos[0].data) : hoje;
    const dias = D().dias(inicio, hoje);
    return {
      aplicado, devolvido, valor_atual: valorFinal,
      ganho: valorFinal + devolvido - aplicado,
      periodo_pct: dietz(fluxos, valorFinal, hoje),
      // a TIR anual só aparece com 90 dias de história
      xirr: dias >= 90 ? xirr(comFinal) : null,
      desde: inicio, dias, ...extra,
    };
  }

  // ---------------------------------------------------------------- renda fixa
  const PADRAO_TAXA = { cdi: 100, selic: 100, prefixado: 0, ipca: 0 };
  function lotesDoTitulo(titulo, aportes) {
    const ind = titulo.tipo, taxa = titulo.taxa != null ? Number(titulo.taxa) : PADRAO_TAXA[ind];
    const lotes = [];
    if (Number(titulo.valor_aplicado) > 0) {
      lotes.push({ id: "inicial", origem: "saldo inicial", data: titulo.data_inicio || String(titulo.criado_em || D().hoje()).slice(0, 10),
        valor: Number(titulo.valor_aplicado), indexador: ind, taxa });
    }
    for (const a of aportes) {
      // os de extrato importado já estão no saldo inicial
      if (a.tipo !== "caixa" || a.historico || a.origem || a.titulo !== titulo.nome) continue;
      lotes.push({ id: a.id, origem: a.valor < 0 ? "resgate" : "aporte", data: a.data, valor: Number(a.valor),
        indexador: a.indexador || ind, taxa: a.taxa != null ? Number(a.taxa) : taxa, proprio: !!(a.indexador || a.taxa != null) });
    }
    return lotes.sort((a, b) => a.data.localeCompare(b.data));
  }

  function rotuloTaxa(indexador, taxa) {
    const n = (v) => FC.fmt.num(v, v % 1 ? 2 : 0);
    return indexador === "cdi" ? `${n(taxa)}% do CDI` : indexador === "selic" ? `${n(taxa)}% da Selic`
      : indexador === "ipca" ? `IPCA + ${n(taxa)}%` : `${n(taxa)}% a.a. pré`;
  }

  // valor de um título num dia (para o gráfico) e a análise completa (para hoje)
  function valorTituloEm(lotes, ix, dia) {
    let v = 0;
    for (const l of lotes) if (l.data <= dia) v += l.valor * (ix ? ix.fator(l.indexador, l.taxa, l.data, dia).f : 1);
    return v;
  }

  function avaliaTitulo(titulo, aportes, ix, hoje = D().hoje()) {
    const lotes = lotesDoTitulo(titulo, aportes).map((l) => {
      // o rendimento de um dia útil entra no dia seguinte: hoje vale o acumulado até ontem
      const { f, estimado } = ix ? ix.fator(l.indexador, l.taxa, l.data, hoje) : { f: 1, estimado: true };
      const atual = l.valor * f, dias = D().dias(l.data, hoje), pct = (f - 1) * 100;
      return { ...l, rotulo_taxa: rotuloTaxa(l.indexador, l.taxa), valor_atual: atual, rendimento: atual - l.valor,
        pct: l.valor > 0 ? pct : null, pct_aa: l.valor > 0 ? anualiza(pct, dias) : null, dias, estimado };
    });
    const valor = lotes.reduce((s, l) => s + l.valor_atual, 0);
    const fluxos = lotes.map((l) => ({ data: l.data, valor: -l.valor }));
    return { lotes, ...resumoFluxos(fluxos, valor, hoje, { estimado: lotes.some((l) => l.estimado), sem_indices: !ix || ix.vazio, so_reserva: !!(ix && ix.so_reserva) }) };
  }

  // ---------------------------------------------------------------- ações, FIIs, cripto
  function eventosDoAtivo(item, aportes) {
    const ev = [];
    const importado = aportes.some((a) => a.tipo === "ativo" && a.ticker === item.ticker && a.origem);
    if (!importado && Number(item.quantidade) > 0) {
      ev.push({ id: "inicial", origem: "posição inicial", data: item.data_base || String(item.criado_em || D().hoje()).slice(0, 10),
        q: Number(item.quantidade), preco: item.preco_medio != null ? Number(item.preco_medio) : null });
    }
    for (const a of aportes) {
      if (a.tipo !== "ativo" || a.ticker !== item.ticker || !a.data) continue;
      ev.push({ id: a.id, origem: a.quantidade < 0 ? "venda" : "compra", data: a.data, q: Number(a.quantidade), preco: Number(a.preco) });
    }
    return ev.sort((a, b) => a.data.localeCompare(b.data) || (a.q < 0) - (b.q < 0));
  }

  function avaliaAtivo(item, aportes, preco, proventosPagos = [], hoje = D().hoje()) {
    const ev = eventosDoAtivo(item, aportes);
    const abertos = [], realizados = [], fluxos = [];
    for (const e of ev) {
      if (e.q > 0) {
        abertos.push({ ...e, q_rest: e.q });
        if (e.preco != null) fluxos.push({ data: e.data, valor: -e.q * e.preco });
      } else {
        // venda: consome os lotes mais antigos (PEPS)
        let falta = -e.q;
        fluxos.push({ data: e.data, valor: falta * e.preco });
        for (const l of abertos) {
          if (falta <= 1e-12) break;
          const usa = Math.min(l.q_rest, falta);
          if (usa <= 0) continue;
          l.q_rest -= usa; falta -= usa;
          realizados.push({ data_compra: l.data, data_venda: e.data, q: usa, preco_compra: l.preco, preco_venda: e.preco,
            ganho: l.preco != null ? usa * (e.preco - l.preco) : null, pct: l.preco ? (e.preco / l.preco - 1) * 100 : null });
        }
      }
    }
    for (const p of proventosPagos) fluxos.push({ data: p.pagamento || p.data_com, valor: p.valor });
    const lotes = abertos.filter((l) => l.q_rest > 1e-12).map((l) => {
      const custo = l.preco != null ? l.q_rest * l.preco : null, atual = preco != null ? l.q_rest * preco : null;
      const pct = l.preco && preco != null ? (preco / l.preco - 1) * 100 : null, dias = D().dias(l.data, hoje);
      return { ...l, quantidade: l.q_rest, custo, valor_atual: atual, rendimento: custo != null && atual != null ? atual - custo : null,
        pct, pct_aa: anualiza(pct, dias), dias };
    });
    const q = lotes.reduce((s, l) => s + l.quantidade, 0);
    const semCusto = lotes.some((l) => l.preco == null);
    const valor = preco != null ? q * preco : 0;
    // sem o custo de algum lote não há como medir o retorno do ativo inteiro
    const r = semCusto ? { aplicado: null, valor_atual: valor, ganho: null, periodo_pct: null, xirr: null, desde: ev[0] && ev[0].data, dias: null }
      : resumoFluxos(fluxos, valor, hoje);
    return { lotes, realizados, quantidade: q, sem_custo: semCusto,
      proventos: proventosPagos.reduce((s, p) => s + p.valor, 0), fluxos, ...r };
  }

  // ---------------------------------------------------------------- carteira
  // tudo junto: ativos, renda fixa e agro, cada um com seus fluxos datados
  function carteira(dados, base, ix, pagamentos = []) {
    const hoje = D().hoje();
    const porTicker = {};
    for (const p of pagamentos) if (p.status === "pago") (porTicker[p.ticker] = porTicker[p.ticker] || []).push(p);
    const ativos = dados.ativos.filter((a) => a.posicao || base.aportes.some((x) => x.tipo === "ativo" && x.ticker === a.ticker))
      .map((a) => ({ ticker: a.ticker, classe: a.classe, ...avaliaAtivo(a.item, base.aportes, a.preco, porTicker[a.ticker] || [], hoje) }));
    const titulos = base.rendaFixa.map((t) => ({ nome: t.nome, ...avaliaTitulo(t, base.aportes, ix, hoje) }));
    // agro: compras, custos e entradas saem do bolso; vendas e saídas voltam
    const fAgro = [];
    for (const m of base.agro.movs) {
      if (m.tipo === "compra") fAgro.push({ data: m.data, valor: -(m.valor_total + m.despesas) });
      else if (m.tipo === "venda") fAgro.push({ data: m.data, valor: m.valor_total - m.despesas });
      else if (m.tipo === "entrada" && m.valor_total) fAgro.push({ data: m.data, valor: -m.valor_total });
      else if (m.tipo === "saida" && m.valor_total) fAgro.push({ data: m.data, valor: m.valor_total });
    }
    for (const c of base.agro.custos) fAgro.push({ data: c.data, valor: -c.valor });
    const agro = fAgro.length ? resumoFluxos(fAgro, dados.agro.valorRebanho || 0, hoje) : null;

    const grupo = (lista, filtro) => {
      const ok = lista.filter(filtro).filter((x) => x.aplicado != null);
      if (!ok.length) return null;
      const fl = ok.flatMap((x) => x.fluxos || x.lotes.map((l) => ({ data: l.data, valor: -l.valor })));
      return resumoFluxos(fl, ok.reduce((s, x) => s + (x.valor_atual || 0), 0), hoje, { n: ok.length });
    };
    const classes = {
      bolsa: grupo(ativos, (a) => a.classe !== "cripto"),
      cripto: grupo(ativos, (a) => a.classe === "cripto"),
      renda_fixa: grupo(titulos, () => true),
      agro,
    };
    const fl = [
      ...ativos.filter((a) => a.aplicado != null).flatMap((a) => a.fluxos),
      ...titulos.flatMap((t) => t.lotes.map((l) => ({ data: l.data, valor: -l.valor }))),
      ...fAgro,
    ];
    const final = ativos.filter((a) => a.aplicado != null).reduce((s, a) => s + a.valor_atual, 0)
      + titulos.reduce((s, t) => s + t.valor_atual, 0) + (agro ? dados.agro.valorRebanho || 0 : 0);
    return { ativos, titulos, classes, total: fl.length ? resumoFluxos(fl, final, hoje) : null,
      sem_custo: ativos.filter((a) => a.sem_custo).map((a) => a.ticker) };
  }

  // ---------------------------------------------------------------- série diária
  // O patrimônio reconstruído dia a dia: posições × preço de cada dia +
  // renda fixa rendendo + o rebanho no valor do app. "fluxo" acumula o
  // dinheiro que entrou, para separar aporte de rendimento.
  function serieDiaria(base, mercado, ix, prefs, valorHoje) {
    const hoje = D().hoje(), hist = (mercado && mercado.historicos) || {}, spot = (mercado && mercado.spot) || {};
    const eventos = [];       // {data, ticker, q, custo}
    for (const a of base.ativos) for (const e of eventosDoAtivo(a, base.aportes)) eventos.push({ ...e, ticker: a.ticker });
    const titulos = base.rendaFixa.map((t) => lotesDoTitulo(t, base.aportes));
    const movsAgro = base.agro.movs || [];
    const datas = [...eventos.map((e) => e.data), ...titulos.flat().map((l) => l.data), ...movsAgro.map((m) => m.data), ...(base.agro.custos || []).map((c) => c.data)].filter(Boolean);
    if (!datas.length) return { pontos: [], inicio: null };
    const inicio = datas.sort()[0];

    // preço de um ativo num dia: o fechamento daquele dia (ou o anterior);
    // antes do começo da série, o primeiro preço conhecido; sem série, o de agora
    const precoDia = (t, d) => {
      const h = hist[t];
      if (h && !h.erro && h.precos && h.precos.length) return FC.carteira.precoEm(h.precos, d) ?? h.precos[0][1];
      const s = spot[t];
      return s && FC.ok(s.preco) ? s.preco : null;
    };
    // rebanho: o valor que o app calcula com os lançamentos até cada data
    const datasAgro = [...new Set([...movsAgro.map((m) => m.data), ...(base.agro.custos || []).map((c) => c.data), ...(base.agro.pesagens || []).map((p) => p.data)])].sort();
    const agroEm = datasAgro.map((d) => [d, FC.agro.analisa({
      movs: movsAgro.filter((m) => m.data <= d), custos: (base.agro.custos || []).filter((c) => c.data <= d),
      pesagens: (base.agro.pesagens || []).filter((p) => p.data <= d) }, prefs.agro).valorRebanho || 0]);
    const valorAgro = (d) => { let v = 0; for (const [dd, x] of agroEm) { if (dd > d) break; v = x; } return v; };

    // dinheiro que entrou até cada dia (aporte +, resgate/venda −)
    const fluxos = [];
    // compra e venda entram pelo preço do negócio; a posição inicial entra
    // pelo preço de mercado do dia em que aparece (o preço médio dela é de
    // compras anteriores — usá-lo aqui criaria um ganho ou perda que não
    // aconteceu dentro do gráfico)
    for (const e of eventos) {
      const p = e.id === "inicial" ? precoDia(e.ticker, e.data) ?? e.preco : e.preco ?? precoDia(e.ticker, e.data);
      if (p != null) fluxos.push([e.data, e.q * p]);
    }
    for (const ls of titulos) for (const l of ls) fluxos.push([l.data, l.valor]);
    for (const m of movsAgro) {
      if (m.tipo === "compra") fluxos.push([m.data, m.valor_total + m.despesas]);
      else if (m.tipo === "venda") fluxos.push([m.data, -(m.valor_total - m.despesas)]);
      else if (m.tipo === "entrada" && m.valor_total) fluxos.push([m.data, m.valor_total]);
      else if (m.tipo === "saida" && m.valor_total) fluxos.push([m.data, -m.valor_total]);
    }
    for (const c of base.agro.custos || []) fluxos.push([c.data, c.valor]);
    fluxos.sort((a, b) => a[0].localeCompare(b[0]));

    const pontos = [];
    const pos = {};
    let ie = 0, ifl = 0, acum = 0;
    const evs = eventos.slice().sort((a, b) => a.data.localeCompare(b.data));
    for (let d = inicio; d <= hoje; d = D().soma(d, 1)) {
      while (ie < evs.length && evs[ie].data <= d) { pos[evs[ie].ticker] = (pos[evs[ie].ticker] || 0) + evs[ie].q; ie++; }
      while (ifl < fluxos.length && fluxos[ifl][0] <= d) { acum += fluxos[ifl][1]; ifl++; }
      let v = 0, faltou = false;
      for (const [t, q] of Object.entries(pos)) {
        if (q <= 1e-12) continue;
        const p = precoDia(t, d);
        if (p == null) { faltou = true; continue; }
        v += q * p;
      }
      for (const ls of titulos) v += valorTituloEm(ls, ix, d);
      v += valorAgro(d);
      pontos.push({ data: d, valor: v, fluxo: acum, incompleto: faltou });
    }
    // o ponto de hoje usa os preços de agora, igual ao patrimônio do topo
    if (valorHoje != null && pontos.length) pontos.at(-1).valor = valorHoje;
    return { pontos, inicio };
  }

  // TWR da série: encadeia o retorno de cada dia descontando o fluxo do dia
  function twr(pontos) {
    let f = 1;
    for (let i = 1; i < pontos.length; i++) {
      const ant = pontos[i - 1].valor, fl = pontos[i].fluxo - pontos[i - 1].fluxo;
      if (ant > 1e-9) f *= (pontos[i].valor - fl) / ant;
    }
    return (f - 1) * 100;
  }

  // ---------------------------------------------------------------- comparação
  // "E se cada aporte tivesse ido para a Selic (ou o Ibovespa) no mesmo dia?"
  // Cada fluxo cresce pelo índice da data dele até hoje; vendas, resgates e
  // proventos saem da conta simulada na mesma data, pelo mesmo valor.
  function crescimentoIndice(indice, de, ate, ix, ibov) {
    if (indice === "selic") return ix ? ix.fator("selic", 100, de, ate).f : null;
    if (!ibov || !ibov.length || de < ibov[0][0]) return null;      // antes da série: sem comparação
    const a = FC.carteira.precoEm(ibov, de), b = FC.carteira.precoEm(ibov, ate);
    return a && b ? b / a : null;
  }
  function comparaIndices(fluxos, hoje, ix, ibov) {
    const out = {};
    for (const indice of ["selic", "ibov"]) {
      let v = 0, ok = true;
      for (const f of fluxos) {
        const g = crescimentoIndice(indice, f.data, hoje, ix, ibov);
        if (g == null) { ok = false; break; }
        v += -f.valor * g;
      }
      out[indice] = ok && fluxos.length ? v : null;
    }
    return out;
  }

  FC.rentab = { crescimentoIndice, comparaIndices, preparaIndices, xirr, dietz, anualiza, avaliaTitulo, avaliaAtivo, carteira, serieDiaria, twr,
    lotesDoTitulo, valorTituloEm, rotuloTaxa, PADRAO_TAXA };
})();
