/* Imposto de renda: quanto sobraria se resgatasse tudo hoje, e o rascunho
 * da declaração (DIRPF) de um ano-calendário.
 *
 * É ESTIMATIVA para conferência. O informe de rendimentos da corretora e
 * do banco é o que vale. Regras usadas:
 * - Renda fixa: tabela regressiva por lote (cada aporte conta os próprios
 *   dias) + IOF regressivo nos primeiros 29 dias. LCI, LCA, CRI, CRA,
 *   poupança e debênture incentivada: sem IR.
 * - Bolsa: ganho = venda − custo pelo PREÇO MÉDIO (é o que a Receita
 *   usa; a tela de rentabilidade usa PEPS, que serve para outra coisa).
 *   Ações 15% (isentas se as vendas do mês somam até R$ 20 mil), ETF 15%,
 *   FII 20%, exterior 15% (Lei 14.754/2023), cripto 15% acima de R$ 35 mil
 *   vendidos no mês.
 * - Bens e Direitos pelo CUSTO DE AQUISIÇÃO, nunca pelo valor de mercado. */
(function () {
  const FC = window.FC;
  const D = () => FC.datas;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---------------------------------------------------------------- tabelas
  // IR regressivo da renda fixa (Lei 11.033/2004)
  function aliquotaRF(dias) {
    const d = num(dias);
    return d <= 180 ? 22.5 : d <= 360 ? 20 : d <= 720 ? 17.5 : 15;
  }
  // IOF regressivo (Decreto 6.306/2007, anexo): % do rendimento que fica
  // com o IOF no resgate no dia n (1 a 29); a partir do 30º, zero
  const IOF = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
  function iof(dias) {
    const d = Math.floor(num(dias));
    if (d >= 30) return 0;
    return IOF[Math.max(1, d) - 1] / 100;           // no mesmo dia, como no 1º
  }

  // Códigos da DIRPF (vigentes desde a declaração de 2024; conferir a cada
  // ano no programa da Receita — é só corrigir aqui).
  const CODIGOS = {
    acao_br:   { grupo: "03", codigo: "01", nome: "Ações (inclusive as listadas em bolsa)" },
    acao_us:   { grupo: "03", codigo: "01", nome: "Ações (exterior: informar o país)" },
    fii:       { grupo: "07", codigo: "03", nome: "Fundos de Investimento Imobiliário (FII)" },
    etf_br:    { grupo: "07", codigo: "09", nome: "Fundos de índice (ETF) — conferir código", incerto: true },
    etf_us:    { grupo: "07", codigo: "09", nome: "Fundos de índice no exterior — conferir código", incerto: true },
    bitcoin:   { grupo: "08", codigo: "01", nome: "Criptoativo Bitcoin (BTC)" },
    stable:    { grupo: "08", codigo: "03", nome: "Stablecoins (USDT, USDC…)" },
    cripto:    { grupo: "08", codigo: "02", nome: "Outras criptomoedas (altcoins)" },
    poupanca:  { grupo: "04", codigo: "01", nome: "Depósito em conta poupança" },
    rf:        { grupo: "04", codigo: "02", nome: "Títulos sujeitos à tributação (Tesouro, CDB, RDB, LC, debêntures)" },
    rf_isento: { grupo: "04", codigo: "03", nome: "Títulos isentos (LCI, LCA, CRI, CRA, debênture incentivada)" },
  };
  // Fichas de rendimentos (conferir a cada ano)
  const FICHAS = {
    dividendos: { ficha: "Isentos", codigo: "09", nome: "Lucros e dividendos recebidos" },
    fii:        { ficha: "Isentos", codigo: "99", nome: "Outros — rendimentos de FII (conferir: versões antigas usavam 26)", incerto: true },
    lci:        { ficha: "Isentos", codigo: "12", nome: "Rendimentos de poupança, LCI, LCA, CRI, CRA" },
    jcp:        { ficha: "Exclusiva", codigo: "10", nome: "Juros sobre capital próprio" },
    rf:         { ficha: "Exclusiva", codigo: "06", nome: "Rendimentos de aplicações financeiras" },
    exterior:   { ficha: "Bens e Direitos / aplicações no exterior", codigo: "—", nome: "Dividendos do exterior (15% na declaração, Lei 14.754/2023)" },
  };
  const ALIQ_VENDA = { acao_br: 15, etf_br: 15, fii: 20, acao_us: 15, etf_us: 15, cripto: 15 };
  const ISENCAO_ACOES = 20000, ISENCAO_CRIPTO = 35000;

  // ---------------------------------------------------------------- renda fixa
  const metaDe = (id) => {
    try { return ((FC.estado && FC.estado.prefs && FC.estado.prefs.premissas && FC.estado.prefs.premissas.titulos) || {})[id] || {}; }
    catch (e) { return {}; }
  };
  const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ehPoupanca = (t) => /poupan/.test(sem(t && t.nome));
  // pelo nome: LCI/LCA/CRI/CRA, poupança e "incentivada" são isentos; LIG,
  // CDB, LC, RDB, Tesouro e debênture comum são tributados
  function isentoRF(titulo, meta) {
    if (meta && typeof meta.isento === "boolean") return meta.isento;
    const n = sem(titulo && titulo.nome);
    if (/\blig\b/.test(n)) return false;
    return /\b(lci|lca|cri|cra)\b/.test(n) || /poupan/.test(n) || /incentivad/.test(n);
  }

  // lotes {data, valor, valor_atual, rendimento, dias} do título; sem a
  // análise de rentabilidade, um lote só com o que se sabe
  function lotesHoje(t) {
    if (t && t.rent && Array.isArray(t.rent.lotes) && t.rent.lotes.length) return t.rent.lotes;
    const principal = num(t && (t.principal != null ? t.principal : t.valor_aplicado));
    const atual = num(t && t.valor_aplicado);
    const data = (t && (t.data_inicio || String(t.criado_em || "").slice(0, 10))) || D().hoje();
    return [{ data, valor: principal, valor_atual: atual, rendimento: atual - principal, dias: D().dias(data, D().hoje()) }];
  }

  // Resgates (lotes negativos) saem dos lotes MAIS ANTIGOS, pelo valor de
  // hoje, levando principal e rendimento na mesma proporção — é o que os
  // bancos fazem (PEPS) e é conservador: sobram os lotes novos, que têm a
  // alíquota maior.
  function titulo(t, meta) {
    meta = meta || metaDe(t && t.id);
    const isento = isentoRF(t, meta), poup = ehPoupanca(t);
    const lotes = lotesHoje(t).map((l) => ({ valor: num(l.valor), atual: num(l.valor_atual), dias: num(l.dias), data: l.data }));
    const pos = lotes.filter((l) => l.valor > 0).sort((a, b) => String(a.data).localeCompare(String(b.data)));
    let resgatar = -lotes.filter((l) => l.valor < 0).reduce((s, l) => s + l.atual, 0);
    for (const l of pos) {
      if (resgatar <= 1e-9) break;
      const usa = Math.min(l.atual, resgatar), fr = l.atual > 0 ? usa / l.atual : 1;
      l.valor *= 1 - fr; l.atual -= usa; resgatar -= usa;
    }
    let bruto = 0, ir = 0, vIof = 0, rend = 0;
    for (const l of pos) {
      const g = l.atual - l.valor;
      bruto += l.atual;
      if (g <= 0) continue;
      rend += g;
      const io = poup ? 0 : g * iof(l.dias);
      vIof += io;
      if (!isento) ir += (g - io) * aliquotaRF(l.dias) / 100;
    }
    return { bruto, ir, iof: vIof, liquido: bruto - ir - vIof, isento, rendimento: rend,
      aliquota_media: rend - vIof > 0 && !isento ? (ir / (rend - vIof)) * 100 : 0 };
  }

  // ---------------------------------------------------------------- resumo
  // "Se vendesse e resgatasse tudo hoje": bolsa e cripto pelo ganho sobre o
  // custo, renda fixa pela tabela, agro sem IR aqui. Dentro de um mesmo
  // grupo (ações+ETF BR, FII, exterior, cripto) ganho e perda se compensam
  // como numa venda no mesmo mês; perda que sobra não vira crédito.
  const GRUPO = { acao_br: "comum", etf_br: "comum", fii: "fii", acao_us: "exterior", etf_us: "exterior", cripto: "cripto" };
  function resumo(dados, base, opcoes) {
    opcoes = opcoes || {};
    dados = dados || {};
    const metas = opcoes.titulos || null;
    const por = { bolsa: { bruto: 0, ir: 0, liquido: 0 }, cripto: { bruto: 0, ir: 0, liquido: 0 },
      renda_fixa: { bruto: 0, ir: 0, liquido: 0 }, agro: { bruto: 0, ir: 0, liquido: 0 } };
    const ganhos = { comum: 0, fii: 0, exterior: 0, cripto: 0 };
    const semCusto = [];
    let custoAtivos = 0;
    for (const a of dados.ativos || []) {
      const p = a && a.posicao;
      if (!p || !(num(p.atual) > 0)) continue;
      const g = GRUPO[a.classe] || "comum";
      por[a.classe === "cripto" ? "cripto" : "bolsa"].bruto += num(p.atual);
      if (p.custo == null) { semCusto.push(a.ticker); continue; }
      custoAtivos += num(p.custo);
      ganhos[g] += num(p.atual) - num(p.custo);
    }
    const aliqG = { comum: 15, fii: 20, exterior: 15, cripto: 15 };
    for (const [g, v] of Object.entries(ganhos)) {
      if (v <= 0) continue;
      por[g === "cripto" ? "cripto" : "bolsa"].ir += (v * aliqG[g]) / 100;
    }
    let principalRF = 0, iofTotal = 0;
    const titulos = [];
    for (const t of dados.rendaFixa || []) {
      const meta = metas ? metas[t.id] || {} : metaDe(t.id);
      const r = titulo(t, meta);
      titulos.push({ id: t.id, nome: t.nome, ...r });
      por.renda_fixa.bruto += r.bruto;
      por.renda_fixa.ir += r.ir + r.iof;
      iofTotal += r.iof;
      principalRF += num(t.principal != null ? t.principal : t.valor_aplicado);
    }
    const res = dados.resumo || {};
    por.agro.bruto = num(res.agro);
    for (const c of Object.values(por)) c.liquido = c.bruto - c.ir;

    const bruto = por.bolsa.bruto + por.cripto.bruto + por.renda_fixa.bruto + por.agro.bruto;
    const ir = por.bolsa.ir + por.cripto.ir + por.renda_fixa.ir;
    const tot = dados.rentab && dados.rentab.total;
    const aplicado = tot && FC.ok(tot.aplicado) ? tot.aplicado - num(tot.devolvido) : custoAtivos + principalRF;
    const notas = [
      "Estimativa do que sobraria vendendo e resgatando tudo hoje. Confira com o informe da corretora/banco.",
      "Renda fixa: tabela regressiva por aporte (22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% depois) e IOF nos primeiros 29 dias. LCI, LCA, CRI, CRA, poupança e debênture incentivada sem IR.",
      "Resgates já feitos saem dos aportes mais antigos (como nos bancos): sobram os mais novos, de alíquota maior.",
      "Ações e ETF da B3: 15% sobre o ganho; FII: 20%; exterior: 15%; cripto: 15%. Ganhos e perdas se compensam dentro de cada grupo; perda não vira crédito aqui.",
      "Não aplicada: vendas de ações de até R$ 20 mil no mês são isentas, e de cripto até R$ 35 mil no mês — vendendo aos poucos, o imposto pode ser bem menor.",
      "Agro: atividade rural tem regra própria (livro-caixa, 20% da receita bruta ou resultado) — fica sem IR nesta conta.",
    ];
    if (semCusto.length) notas.push(`Sem preço médio, sem IR estimado: ${semCusto.join(", ")}.`);
    if (iofTotal > 0.005) notas.push(`Inclui ${FC.fmt.brlTexto(iofTotal)} de IOF de aplicações com menos de 30 dias.`);
    return { bruto, ir_estimado: ir, liquido: bruto - ir, aplicado, ganho_bruto: bruto - aplicado, ganho_liquido: bruto - ir - aplicado,
      por_classe: por, titulos, sem_custo: semCusto, notas };
  }

  // ---------------------------------------------------------------- posição numa data
  // eventos do ativo como em FC.rentab: posição inicial na data_base (ou no
  // cadastro), depois compras e vendas. Extrato importado traz a posição
  // inteira: a quantidade inicial não se soma.
  function eventosDoAtivo(item, aportes) {
    const ev = [];
    const importado = aportes.some((a) => a.tipo === "ativo" && a.ticker === item.ticker && a.origem);
    if (!importado && num(item.quantidade) > 0) {
      ev.push({ data: item.data_base || String(item.criado_em || D().hoje()).slice(0, 10), q: num(item.quantidade),
        preco: item.preco_medio != null ? num(item.preco_medio) : null, inicial: true });
    }
    for (const a of aportes) {
      if (a.tipo !== "ativo" || a.ticker !== item.ticker || !a.data) continue;
      ev.push({ data: a.data, q: num(a.quantidade), preco: a.preco != null ? num(a.preco) : null });
    }
    return ev.sort((a, b) => a.data.localeCompare(b.data) || (a.q < 0) - (b.q < 0));
  }
  // percorre os eventos com a regra do preço médio (igual a
  // FC.carteira.posicao): a venda tira a mesma fração de quantidade e custo.
  // aoVender recebe cada venda com o preço médio daquele momento.
  function percorre(ev, ate, aoVender) {
    let q = 0, custo = 0, qCusto = 0;
    for (const e of ev) {
      if (ate && e.data > ate) break;
      if (e.q > 0) {
        q += e.q;
        if (e.preco != null && e.preco > 0) { custo += e.q * e.preco; qCusto += e.q; }
      } else if (e.q < 0 && q > 1e-12) {
        const vend = Math.min(-e.q, q), fr = Math.min(1, vend / q);
        const pm = qCusto > 1e-12 ? custo / qCusto : null;
        if (aoVender) aoVender(e, vend, pm, qCusto >= q - 1e-9);
        custo -= custo * fr; qCusto -= qCusto * fr; q -= vend;
      }
    }
    if (q < 1e-9) { q = 0; custo = 0; qCusto = 0; }
    return { quantidade: q, custo, preco_medio: qCusto > 1e-12 ? custo / qCusto : null, completo: qCusto >= q - 1e-9 };
  }

  // renda fixa: principal até a data; resgate tira a fração do saldo
  // daquele dia (com os índices; sem eles, tira o valor resgatado)
  function principalRFEm(lotes, ix, dia) {
    let p = 0;
    const antes = [];
    for (const l of lotes) {
      if (l.data > dia) break;
      if (l.valor >= 0) { p += l.valor; antes.push(l); continue; }
      const saldo = FC.rentab && FC.rentab.valorTituloEm ? FC.rentab.valorTituloEm(antes, ix, l.data) : p;
      const fr = saldo > 0 ? Math.min(1, -l.valor / saldo) : 1;
      p *= 1 - fr;
      antes.push(l);
    }
    return Math.max(0, p);
  }

  const codigoAtivo = (classe, ticker) => {
    if (classe === "cripto") {
      const t = String(ticker || "").toUpperCase();
      if (/^BTC\b|^BTC-|BITCOIN/.test(t)) return CODIGOS.bitcoin;
      if (/^(USDT|USDC|DAI|BUSD)/.test(t)) return CODIGOS.stable;
      return CODIGOS.cripto;
    }
    return CODIGOS[classe] || CODIGOS.acao_br;
  };
  const unidadeDe = (classe) => (classe === "fii" || classe === "etf_br" || classe === "etf_us" ? "cotas" : classe === "cripto" ? "unidades" : "ações");

  function discrAtivo(a, pos, ano) {
    const f = FC.fmt;
    const nomeCls = (FC.CLASSES && FC.CLASSES[a.classe]) || a.classe;
    const un = a.classe === "cripto" ? String(a.ticker).split("-")[0] : unidadeDe(a.classe);
    const ext = a.classe === "acao_us" || a.classe === "etf_us" ? " Localização: Estados Unidos." : "";
    if (!pos.quantidade) return `${a.ticker} (${nomeCls}): posição zerada em 31/12/${ano}.${ext} Corretora/exchange: —`;
    return `${f.qtd(pos.quantidade)} ${un} ${a.ticker} (${nomeCls}), custo médio ${f.brlTexto(pos.preco_medio)}, custo total ${f.brlTexto(pos.custo)} em 31/12/${ano}.${ext} Corretora/exchange: —`;
  }

  // ---------------------------------------------------------------- proventos do ano
  const COM_JCP = /\bjcp\b|juros sobre capital/i;
  function proventosDoAno(base, dados, ano, pagamentos) {
    const a0 = String(ano);
    const classe = {};
    for (const x of base.ativos || []) classe[x.ticker] = x.classe;
    for (const x of (dados && dados.ativos) || []) classe[x.ticker] = classe[x.ticker] || x.classe;
    const itens = [];
    const pagos = (pagamentos || []).filter((p) => p.status === "pago" && String(p.pagamento || "").slice(0, 4) === a0);
    for (const p of pagos) {
      const jcp = p.tipo === "JCP";
      itens.push({ ticker: p.ticker, classe: classe[p.ticker], tipo: p.tipo, data: p.pagamento, liquido: num(p.valor),
        bruto: num(p.bruto != null ? p.bruto : p.valor), ir_fonte: jcp ? num(p.bruto) - num(p.valor) : 0, fonte: "calculado" });
    }
    // lançados em Aportes: entram os que não são o mesmo pagamento já calculado
    const origens = new Set(pagos.map((p) => p.origem));
    for (const m of base.aportes || []) {
      if (m.tipo !== "provento" || String(m.data || "").slice(0, 4) !== a0) continue;
      if (m.origem && origens.has(m.origem)) continue;
      if (pagos.some((p) => p.ticker === m.ticker && p.pagamento === m.data && Math.abs(num(p.valor) - num(m.valor)) <= 0.05)) continue;
      const cl = classe[m.ticker];
      const jcp = COM_JCP.test(String(m.observacao || "")) || /:JCP:/.test(String(m.origem || ""));
      const tipo = jcp ? "JCP" : cl === "fii" ? "Rendimento" : "Dividendo";
      const liq = num(m.valor);
      // JCP lançado à mão: o valor é o que caiu na conta (líquido dos 15%)
      const bruto = jcp ? liq / (1 - (FC.dividendos ? FC.dividendos.IR_JCP : 0.15)) : liq;
      itens.push({ ticker: m.ticker || "—", classe: cl, tipo, data: m.data, liquido: liq, bruto, ir_fonte: bruto - liq, fonte: "lançado" });
    }
    return itens;
  }

  // ---------------------------------------------------------------- declaração
  function irpf(base, dados, ano, opcoes) {
    opcoes = opcoes || {};
    base = base || {};
    const aportes = base.aportes || [];
    ano = Number(ano) || Number(D().hoje().slice(0, 4)) - 1;
    const fimAnt = `${ano - 1}-12-31`, fim = `${ano}-12-31`;
    const avisos = [];

    // ---- bens e direitos: ações, FIIs, ETFs, cripto
    const bens = [];
    for (const a of base.ativos || []) {
      const ev = eventosDoAtivo(a, aportes);
      if (!ev.length) continue;
      const p0 = percorre(ev, fimAnt), p1 = percorre(ev, fim);
      if (!p0.quantidade && !p1.quantidade) continue;
      const cod = codigoAtivo(a.classe, a.ticker);
      const parcial = (p0.quantidade && !p0.completo) || (p1.quantidade && !p1.completo);
      bens.push({ tipo: "ativo", ticker: a.ticker, nome: a.ticker, classe: a.classe, grupo: cod.grupo, codigo: cod.codigo,
        codigo_nome: cod.nome, codigo_incerto: !!cod.incerto,
        quantidade_anterior: p0.quantidade, quantidade: p1.quantidade,
        anterior: r2(p0.custo), atual: r2(p1.custo), preco_medio: p1.preco_medio, custo_parcial: !!parcial,
        discriminacao: discrAtivo(a, p1, ano) });
      if (parcial) avisos.push(`${a.ticker}: há compras sem preço — o custo declarado fica incompleto.`);
      if (ev[0].inicial && ev[0].data > fimAnt && ev[0].data <= fim) avisos.push(`${a.ticker}: a posição inicial conta a partir de ${D().br(ev[0].data)} (cadastro). Se você já tinha antes, ajuste a situação em 31/12/${ano - 1}.`);
    }
    // ---- bens e direitos: renda fixa
    const ix = opcoes.ix !== undefined ? opcoes.ix : (FC.estado && FC.estado.mercado && FC.estado.mercado.indices) || null;
    const rendIsentos = [];
    for (const t of base.rendaFixa || []) {
      const lotes = FC.rentab && FC.rentab.lotesDoTitulo ? FC.rentab.lotesDoTitulo(t, aportes)
        : [{ data: t.data_inicio || String(t.criado_em || "").slice(0, 10), valor: num(t.valor_aplicado) }];
      const v0 = principalRFEm(lotes, ix, fimAnt), v1 = principalRFEm(lotes, ix, fim);
      if (v0 < 0.005 && v1 < 0.005) continue;
      const meta = (opcoes.titulos ? opcoes.titulos[t.id] : metaDe(t.id)) || {};
      const isento = isentoRF(t, meta), poup = ehPoupanca(t);
      const cod = poup ? CODIGOS.poupanca : isento ? CODIGOS.rf_isento : CODIGOS.rf;
      const taxa = FC.rentab && FC.rentab.rotuloTaxa && t.tipo ? FC.rentab.rotuloTaxa(t.tipo, t.taxa != null ? Number(t.taxa) : (FC.rentab.PADRAO_TAXA || {})[t.tipo]) : "";
      const inst = meta.instituicao || "—";
      bens.push({ tipo: "renda_fixa", id: t.id, nome: t.nome, classe: "renda_fixa", grupo: cod.grupo, codigo: cod.codigo, codigo_nome: cod.nome,
        isento, anterior: r2(v0), atual: r2(v1), reserva: !!meta.reserva,
        discriminacao: `${t.nome}${taxa ? " — " + taxa : ""}${t.vencimento ? ", vencimento " + D().br(t.vencimento) : ""}. Valor aplicado (principal) em 31/12/${ano}: ${FC.fmt.brlTexto(v1)}. Instituição: ${inst}. CNPJ: —` });
      // rendimento isento do ano (LCI/LCA…): o que o saldo cresceu além do
      // que entrou. É acumulado — o informe mostra o que foi de fato pago.
      if (isento && ix && FC.rentab.valorTituloEm) {
        const s0 = FC.rentab.valorTituloEm(lotes, ix, fimAnt), s1 = FC.rentab.valorTituloEm(lotes, ix, fim);
        const fluxo = lotes.filter((l) => l.data > fimAnt && l.data <= fim).reduce((s, l) => s + l.valor, 0);
        const rend = s1 - s0 - fluxo;
        if (rend > 0.005) rendIsentos.push({ ticker: t.nome, classe: "renda_fixa", tipo: poup ? "Poupança" : "LCI/LCA", liquido: rend, bruto: rend,
          ficha: FICHAS.lci, estimado: true });
      }
    }
    bens.sort((a, b) => (a.grupo + a.codigo).localeCompare(b.grupo + b.codigo) || String(a.nome).localeCompare(String(b.nome)));

    // ---- rendimentos
    let pagamentos = opcoes.pagamentos || null;
    if (!pagamentos) {
      try { if (FC.estado && FC.estado.proventos && dados && FC.dividendos) pagamentos = FC.dividendos.analisa(dados, base, FC.estado.proventos).pagamentos; }
      catch (e) { console.error(e); }
    }
    if (!pagamentos) avisos.push("Os proventos calculados ainda não carregaram: entram só os lançados em Aportes.");
    const provs = proventosDoAno(base, dados, ano, pagamentos || []);
    const agrupa = (lista, ficha) => {
      const m = {};
      for (const p of lista) {
        const k = p.ticker;
        const d = (m[k] = m[k] || { ticker: k, classe: p.classe, tipo: p.tipo, liquido: 0, bruto: 0, ir_fonte: 0, n: 0, ficha: p.ficha || ficha, estimado: !!p.estimado });
        d.liquido += p.liquido; d.bruto += p.bruto; d.ir_fonte += p.ir_fonte || 0; d.n += 1;
      }
      return Object.values(m).sort((a, b) => b.liquido - a.liquido);
    };
    const exterior = (p) => p.classe === "acao_us" || p.classe === "etf_us";
    const isentos = agrupa(provs.filter((p) => p.tipo !== "JCP" && !exterior(p) && p.classe !== "fii"), FICHAS.dividendos)
      .concat(agrupa(provs.filter((p) => p.tipo !== "JCP" && !exterior(p) && p.classe === "fii"), FICHAS.fii))
      .concat(rendIsentos.map((r) => ({ ...r, n: 1, ir_fonte: 0 })));
    const exclusiva = agrupa(provs.filter((p) => p.tipo === "JCP" && !exterior(p)), FICHAS.jcp);
    const doExterior = agrupa(provs.filter(exterior), FICHAS.exterior);

    // ---- vendas no ano, mês a mês, pelo preço médio
    const vendas = [];
    for (const a of base.ativos || []) {
      percorre(eventosDoAtivo(a, aportes), fim, (e, q, pm, completo) => {
        if (String(e.data).slice(0, 4) !== String(ano)) return;
        const total = q * num(e.preco);
        vendas.push({ data: e.data, mes: e.data.slice(0, 7), ticker: a.ticker, classe: a.classe, quantidade: q, preco: num(e.preco),
          total, preco_medio: pm, custo: pm != null ? q * pm : null, ganho: pm != null && completo ? total - q * pm : null });
      });
    }
    vendas.sort((a, b) => a.data.localeCompare(b.data));
    const meses = [];
    let prejComum = 0, prejFii = 0;              // perdas do ano levadas para os meses seguintes
    for (let m = 1; m <= 12; m++) {
      const mes = `${ano}-${String(m).padStart(2, "0")}`;
      const vs = vendas.filter((v) => v.mes === mes);
      if (!vs.length) continue;
      const soma = (f, g) => vs.filter(f).reduce((s, v) => s + num(g(v)), 0);
      const ac = (v) => v.classe === "acao_br", etf = (v) => v.classe === "etf_br", fii = (v) => v.classe === "fii";
      const cri = (v) => v.classe === "cripto", ext = (v) => v.classe === "acao_us" || v.classe === "etf_us";
      const vendidoAcoes = soma(ac, (v) => v.total);
      const ganhoAcoes = soma(ac, (v) => v.ganho), ganhoEtf = soma(etf, (v) => v.ganho), ganhoFii = soma(fii, (v) => v.ganho);
      const isentoAcoes = vendidoAcoes <= ISENCAO_ACOES;
      // ações isentas: o ganho não entra, mas a perda entra na compensação
      let baseComum = ganhoEtf + (isentoAcoes ? Math.min(0, ganhoAcoes) : ganhoAcoes);
      baseComum -= prejComum;
      const tribComum = Math.max(0, baseComum);
      prejComum = Math.max(0, -baseComum);
      const baseFii = ganhoFii - prejFii;
      const tribFii = Math.max(0, baseFii);
      prejFii = Math.max(0, -baseFii);
      const vendidoCripto = soma(cri, (v) => v.total), ganhoCripto = soma(cri, (v) => v.ganho);
      const tribCripto = vendidoCripto > ISENCAO_CRIPTO ? Math.max(0, ganhoCripto) : 0;
      const darf = tribComum * 0.15 + tribFii * 0.2;
      meses.push({ mes, vendas: vs, vendido_acoes: vendidoAcoes, ganho_acoes: ganhoAcoes, isento_acoes: isentoAcoes,
        vendido_etf: soma(etf, (v) => v.total), ganho_etf: ganhoEtf, vendido_fii: soma(fii, (v) => v.total), ganho_fii: ganhoFii,
        vendido_cripto: vendidoCripto, ganho_cripto: ganhoCripto, isento_cripto: vendidoCripto <= ISENCAO_CRIPTO,
        vendido_exterior: soma(ext, (v) => v.total), ganho_exterior: soma(ext, (v) => v.ganho),
        base_comum: tribComum, base_fii: tribFii, prejuizo_comum: prejComum, prejuizo_fii: prejFii,
        darf_6015: darf, ir_cripto: tribCripto * 0.15, sem_custo: vs.some((v) => v.ganho == null) });
    }
    const ganhoExterior = vendas.filter((v) => v.classe === "acao_us" || v.classe === "etf_us").reduce((s, v) => s + num(v.ganho), 0);

    return {
      ano, fim_anterior: fimAnt, fim, bens,
      rendimentos: { isentos, exclusiva, exterior: doExterior },
      vendas, meses,
      totais: {
        bens_anterior: bens.reduce((s, b) => s + b.anterior, 0), bens_atual: bens.reduce((s, b) => s + b.atual, 0),
        isentos: isentos.reduce((s, x) => s + x.liquido, 0), exclusiva: exclusiva.reduce((s, x) => s + x.liquido, 0),
        exterior: doExterior.reduce((s, x) => s + x.liquido, 0),
        darf: meses.reduce((s, m) => s + m.darf_6015, 0), ir_cripto: meses.reduce((s, m) => s + m.ir_cripto, 0),
        ganho_exterior: ganhoExterior, ir_exterior: Math.max(0, ganhoExterior) * 0.15,
      },
      avisos,
      notas: [
        "Estimativa para conferência: confira com o informe de rendimentos da corretora/banco antes de declarar.",
        "Bens e Direitos pelo custo de aquisição (preço médio), não pelo valor de mercado. Corretagem e taxas não entram se não foram somadas ao preço.",
        "Renda fixa pelo principal aplicado; resgates tiram a fração do saldo do dia. O rendimento acumulado não entra em Bens e Direitos.",
        "DARF 6015 (ações/ETF/FII) vence no último dia útil do mês seguinte; abaixo de R$ 10 acumula para o próximo. Não desconta o IRRF de 0,005% (dedo-duro).",
        "Perdas compensadas só dentro do ano (ações+ETF juntos, FII à parte). Prejuízos de anos anteriores não entram.",
        "Exterior (Lei 14.754/2023): ganhos e dividendos tributados a 15% na declaração anual, sem isenção mensal; câmbio de cada data não é aplicado aqui.",
        "Cripto: venda acima de R$ 35 mil no mês paga 15% sobre o ganho (DARF de ganho de capital) — conferir a regra para exchanges no exterior.",
      ],
    };
  }

  FC.impostos = { aliquotaRF, iof, isentoRF, titulo, resumo, irpf, CODIGOS, FICHAS, ALIQ_VENDA, ISENCAO_ACOES, ISENCAO_CRIPTO,
    _interno: { eventosDoAtivo, percorre, principalRFEm, proventosDoAno } };
})();
