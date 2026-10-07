/* Junta tudo: ativos + aportes + mercado + agro → o retrato da carteira.
 * É o equivalente do antigo coleta(); as telas só leem o resultado. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  // ---------------------------------------------------------------- aportes
  // compras e vendas de cada ticker em ordem de data; a venda entra no
  // preço médio pelo custo das cotas que saíram, não pelo preço da venda
  function consolidadoPorTicker(aportes) {
    const fora = {};
    for (const a of aportes) {
      if (a.tipo !== "ativo" || !a.ticker) continue;
      const d = (fora[a.ticker] = fora[a.ticker] || { quantidade: 0, n: 0, eventos: [] });
      d.quantidade += a.quantidade;
      d.n += 1;
      d.eventos.push({ data: a.data || "", q: Number(a.quantidade) || 0, preco: a.preco });
    }
    for (const d of Object.values(fora)) d.eventos.sort((a, b) => a.data.localeCompare(b.data) || (a.q < 0) - (b.q < 0));
    return fora;
  }
  // aportes em caixa que somam ao saldo (os de extrato já estão no saldo)
  function consolidadoPorTitulo(aportes) {
    const fora = {};
    for (const a of aportes) {
      if (a.tipo === "caixa" && !a.historico && !a.origem) fora[a.titulo] = (fora[a.titulo] || 0) + a.valor;
    }
    return fora;
  }
  function tickersImportados(aportes) {
    return new Set(aportes.filter((a) => a.tipo === "ativo" && a.origem).map((a) => a.ticker));
  }

  // ---------------------------------------------------------------- posição
  // O preço médio só é calculado sobre a parte cujo custo se conhece.
  // Posição base primeiro, depois compras e vendas na ordem: a venda tira
  // a mesma fração da quantidade e do custo (o preço médio não muda).
  function posicao(item, preco, reg) {
    const qBase = Number(item.quantidade) || 0;
    const pmBase = item.preco_medio;
    const qAp = reg ? reg.quantidade : 0;
    const q = qBase + qAp;
    if (!(q > 1e-9 && preco)) return null;
    let qt = qBase, custo = 0, qCusto = 0;
    if (pmBase && qBase) { custo = qBase * pmBase; qCusto = qBase; }
    for (const e of reg ? reg.eventos : []) {
      if (e.q > 0) {
        qt += e.q;
        if (FC.ok(e.preco)) { custo += e.q * e.preco; qCusto += e.q; }
      } else if (e.q < 0 && qt > 1e-12) {
        const fr = Math.min(1, -e.q / qt);
        custo -= custo * fr; qCusto -= qCusto * fr; qt += e.q;
      }
    }
    const atual = q * preco;
    const completo = qCusto >= q - 1e-9;
    const p = {
      quantidade: q, quantidade_base: qBase, quantidade_aportes: qAp, n_aportes: reg ? reg.n : 0,
      atual, custo: null, resultado: null, variacao: null,
      preco_medio: qCusto ? custo / qCusto : null, custo_parcial: !!qCusto && !completo,
    };
    if (completo && custo) { p.custo = custo; p.resultado = atual - custo; p.variacao = (atual / custo - 1) * 100; }
    return p;
  }

  // ---------------------------------------------------------------- alocação
  function alocacao(ativos, rendaFixa, agro, alvos) {
    const valor = {}, dentro = {};
    FC.PILARES.forEach((p) => { valor[p.chave] = 0; dentro[p.chave] = []; });
    for (const a of ativos) {
      if (!a.posicao || !(a.pilar in valor)) continue;
      valor[a.pilar] += a.posicao.atual;
      dentro[a.pilar].push({ nome: a.ticker, ticker: a.ticker, tipo: a.tipo_rotulo, valor: a.posicao.atual,
        score: a.score, cor: a.cor, veredito: a.veredito_curto, quantidade: a.posicao.quantidade, variacao: a.posicao.variacao });
    }
    for (const r of rendaFixa) {
      const p = r.pilar || "caixa";
      if (!(p in valor)) continue;
      valor[p] += r.valor_aplicado;
      dentro[p].push({ nome: r.nome, ticker: null, tipo: r.base, valor: r.valor_aplicado, score: null, cor: r.cor, veredito: r.leitura });
    }
    if (agro && agro.valorRebanho > 0) {
      valor.agro += agro.valorRebanho;
      for (const c of agro.porCategoria) {
        dentro.agro.push({ nome: c.nome, ticker: null, tipo: `${FC.fmt.int(c.cabecas)} cabeças`, valor: c.valor, score: null, cor: "terra", veredito: null });
      }
    }
    // dinheiro de vendas reinvestido que ainda espera a próxima compra
    const caixaAgro = agro ? agro.financeiro.caixa_agro || 0 : 0;
    if (caixaAgro > 0.5) {
      valor.agro += caixaAgro;
      dentro.agro.push({ nome: "Caixa do agro", ticker: null, tipo: "reinvestido, à espera da compra", valor: caixaAgro, score: null, cor: "terra", veredito: null });
    }
    const total = Object.values(valor).reduce((a, b) => a + b, 0);
    if (!total) return { linhas: [], total: 0 };
    // pilares sem valor e sem meta não aparecem (ex.: agro zerado)
    const linhas = FC.PILARES.filter((p) => valor[p.chave] > 0 || Number(alvos[p.chave]) > 0).map((p) => {
      const alvo = Number(alvos[p.chave]) || 0;
      const pct = (valor[p.chave] / total) * 100;
      const comp = dentro[p.chave].sort((a, b) => b.valor - a.valor);
      comp.forEach((x) => { x.peso = valor[p.chave] ? (x.valor / valor[p.chave]) * 100 : 0; });
      return { chave: p.chave, nome: p.nome, cor: p.cor, valor: valor[p.chave], pct, alvo_pct: alvo,
        desvio_pct: pct - alvo, desvio_reais: (total * alvo) / 100 - valor[p.chave], composicao: comp };
    });
    return { linhas, total };
  }

  // ---------------------------------------------------------------- proventos
  function proventosPorMes(lista) {
    const vazio = { meses: [], total: 0, media: 0, media_recente: 0, ultimo: 0, n_meses: 0 };
    const porMes = {};
    for (const p of lista) {
      const mes = (p.data || "").slice(0, 7);
      if (mes.length !== 7) continue;
      const d = (porMes[mes] = porMes[mes] || {});
      const t = p.ticker || "—";
      d[t] = (d[t] || 0) + (p.valor || 0);
    }
    const chaves = Object.keys(porMes).sort();
    if (!chaves.length) return vazio;
    const meses = [];
    let atual = chaves[0];
    const fim = chaves.at(-1);
    while (atual <= fim) {
      const itens = Object.entries(porMes[atual] || {}).sort((a, b) => b[1] - a[1]);
      meses.push({ mes: atual, total: itens.reduce((s, [, v]) => s + v, 0), itens });
      const [a, m] = atual.split("-").map(Number);
      atual = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    }
    const total = meses.reduce((s, m) => s + m.total, 0);
    const ult = meses.slice(-3);
    return { meses, total, media: total / meses.length, media_recente: ult.reduce((s, m) => s + m.total, 0) / ult.length,
      ultimo: meses.at(-1).total, n_meses: meses.length };
  }

  // ---------------------------------------------------------------- preço numa data
  // o fechamento do dia (ou o anterior mais próximo) numa série [[data, preço]]
  function precoEm(serie, dia) {
    let lo = 0, hi = serie.length - 1, r = null;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (serie[m][0] <= dia) { r = serie[m][1]; lo = m + 1; } else hi = m - 1;
    }
    return r;
  }

  // ---------------------------------------------------------------- coleta
  function monta(base, mercado, prefs) {
    const { universo, historicos } = mercado;
    const spot = mercado.spot || {};
    const regras = prefs.regras;
    const aportes = base.aportes;
    const registrados = consolidadoPorTicker(aportes);
    const caixaExtra = consolidadoPorTitulo(aportes);
    const importados = tickersImportados(aportes);

    const ativos = base.ativos.map((item) => {
      let r;
      try {
        r = universo ? FC.avaliador.avalia(item.ticker, item.classe, universo, historicos || {}, regras, spot[item.ticker])
                     : { ticker: item.ticker, classe: item.classe, erro: "carregando dados de mercado…" };
      } catch (e) {
        console.error(e);
        r = { ticker: item.ticker, classe: item.classe, erro: String(e.message || e) };
      }
      // o preço de agora (CoinGecko/Yahoo) vale mais que o do fechamento
      const agora = spot[item.ticker];
      if (!r.erro && agora && FC.ok(agora.preco)) {
        r.preco = agora.preco; r.variacao_dia = agora.variacao_dia; r.fonte_preco = agora.fonte; r.preco_quando = agora.quando;
      }
      const reg = registrados[item.ticker];
      // extrato importado traz a posição inteira: a base não se soma
      const it = importados.has(item.ticker) ? { ...item, quantidade: 0, preco_medio: null } : item;
      r.id = item.id;
      r.item = item;
      r.lista = item.lista;
      r.na_carteira = item.lista === "carteira" || !!reg;
      r.pilar = item.pilar;
      r.posicao = r.na_carteira && !r.erro ? posicao(it, r.preco, reg) : null;
      if (!r.tipo_rotulo) r.tipo_rotulo = FC.CLASSE_ROTULO[item.classe] || item.classe;
      return r;
    });

    const macro = (universo && universo.macro) || {};
    // renda fixa: cada aporte rende da sua data pela sua taxa. Daqui para
    // frente "valor_aplicado" é o valor da posição (com rendimento) — é o
    // que entra na alocação, no patrimônio e na projeção.
    const ix = mercado.indices || null;
    const rendaFixa = base.rendaFixa.map((i) => {
      const rent = FC.rentab.avaliaTitulo(i, aportes, ix);
      const extra = caixaExtra[i.nome] || 0;
      const item = { ...i, principal: i.valor_aplicado + extra, valor_aplicado: rent.valor_atual, aportado_aqui: extra, rent };
      return FC.avaliador.avaliaRendaFixa(item, macro);
    });

    const agro = FC.agro.analisa(base.agro, prefs.agro);
    const { linhas, total } = alocacao(ativos, rendaFixa, agro, prefs.alocacao_alvo);

    const comPos = ativos.filter((a) => a.posicao);
    const comCusto = comPos.filter((a) => a.posicao.custo);
    const investido = FC.soma(comCusto, (a) => a.posicao.custo);
    const atualComCusto = FC.soma(comCusto, (a) => a.posicao.atual);
    const atual = FC.soma(comPos, (a) => a.posicao.atual);
    const cripto = FC.soma(comPos.filter((a) => a.classe === "cripto"), (a) => a.posicao.atual);
    // quanto foi colocado × quanto vale agora, por classe. Posição sem
    // preço médio não entra no resultado (não dá para saber o ganho), mas
    // aparece como "sem custo" para não sumir da conta.
    const porClasse = {};
    for (const [chave, filtro] of [["bolsa", (a) => a.classe !== "cripto"], ["cripto", (a) => a.classe === "cripto"]]) {
      const ps = comPos.filter(filtro);
      if (!ps.length) continue;
      const cc = ps.filter((a) => a.posicao.custo);
      const inv = FC.soma(cc, (a) => a.posicao.custo), atu = FC.soma(cc, (a) => a.posicao.atual);
      porClasse[chave] = { investido: inv, atual_com_custo: atu, atual: FC.soma(ps, (a) => a.posicao.atual),
        resultado: atu - inv, variacao: inv ? (atu / inv - 1) * 100 : null,
        sem_custo: ps.filter((a) => !a.posicao.custo).map((a) => a.ticker), n: ps.length };
    }
    // quanto a carteira andou hoje, pela variação do dia de cada posição
    const hojeAbs = FC.soma(comPos.filter((a) => ok(a.variacao_dia)), (a) => a.posicao.atual - a.posicao.atual / (1 + a.variacao_dia / 100));
    const rf = FC.soma(rendaFixa, (r) => r.valor_aplicado);

    const proventos = aportes.filter((a) => a.tipo === "provento").sort((a, b) => b.data.localeCompare(a.data));
    const hist = { proventos, renda_mensal: proventosPorMes(proventos) };

    const dados = {
      ativos, rendaFixa, agro, macro, regras,
      alocacao: linhas, alocacao_alvo: prefs.alocacao_alvo,
      historico: hist,
      registros: base.historico || [],
      resumo: {
        investido, atual, resultado: atualComCusto - investido,
        // só as posições com preço médio conhecido entram na conta
        variacao: investido ? (atualComCusto / investido - 1) * 100 : null,
        renda_fixa: rf, agro: agro.valorRebanho + (agro.financeiro.caixa_agro || 0), patrimonio: total || atual + rf + agro.valorRebanho + (agro.financeiro.caixa_agro || 0),
        cripto, bolsa: atual - cripto, variacao_hoje: hojeAbs, por_classe: porClasse,
        tem_preco_medio: investido > 0,
      },
      atualizado: universo ? universo.gerado : null,
    };
    // rentabilidade aporte a aporte, consolidada (TIR e retorno no período);
    // proventos já pagos entram como dinheiro que voltou
    let pagos = [];
    try { if (FC.estado && FC.estado.proventos) pagos = FC.dividendos.analisa(dados, base, FC.estado.proventos).pagamentos; } catch (e) { console.error(e); }
    try { dados.rentab = FC.rentab.carteira(dados, base, ix, pagos); } catch (e) { console.error(e); dados.rentab = null; }
    return dados;
  }

  FC.carteira = { monta, posicao, consolidadoPorTicker, proventosPorMes, precoEm };
})();
