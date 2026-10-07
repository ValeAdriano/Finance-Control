/* Agronegócio: rebanho, valor e resultado da atividade.
 *
 * O rebanho não é digitado, é CONTADO: cada movimento soma ou subtrai
 * cabeças de uma categoria. Assim a contagem de hoje sempre bate com o
 * histórico, e corrigir um lançamento antigo corrige tudo que vem depois.
 *
 * Valor do rebanho = cabeças × peso vivo × rendimento de carcaça ÷ 15
 * × preço da arroba. O peso vem da informação mais recente da categoria
 * (pesagem ou movimento com peso, com quem entra depois na média pelas
 * cabeças); sem nada, de um peso típico — e a tela diz qual foi usada. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  // de onde cada categoria vem, na ordem em que o animal cresce
  const ORIGEM = {
    garrote: ["bezerro"],
    boi_magro: ["bezerro", "garrote"],
    boi_gordo: ["bezerro", "garrote", "boi_magro"],
    touro: ["bezerro", "garrote", "boi_magro"],
    novilha: ["bezerra"],
    vaca: ["bezerra", "novilha"],
  };

  function arrobas(kgVivo, rendimento) { return (kgVivo * (rendimento / 100)) / 15; }

  // valor de uma cabeça pela cotação: preço por cabeça da categoria ou peso × arroba
  function valorCabeca(cat, kg, cfg) {
    const porCabeca = Number((cfg.valor_cabeca_por_categoria || {})[cat]);
    if (ok(porCabeca) && porCabeca > 0) return porCabeca;
    const preco = Number((cfg.arroba_por_categoria || {})[cat]) || Number(cfg.preco_arroba) || 0;
    return arrobas(kg, Number(cfg.rendimento_carcaca) || 52) * preco;
  }
  // "outra entrada" sem valor entra pelo valor estimado (preenchido em analisa):
  // é capital posto na atividade, não lucro
  const valorEntrada = (m) => (m.valor_total > 0 ? m.valor_total : m.valor_estimado || 0);

  function analisa(agro, cfg) {
    const movs = [...(agro.movs || [])].sort((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em));
    const custos = agro.custos || [];
    const pesagens = [...(agro.pesagens || [])].sort((a, b) => a.data.localeCompare(b.data));
    const rend = Number(cfg.rendimento_carcaca) || 52;

    // ---------------------------------------------------------- contagem
    const rebanho = {}, porFazenda = {}, porLote = {};
    const soma = (obj, k, n) => { obj[k] = (obj[k] || 0) + n; };
    // onde está a maior parte de uma categoria: é de lá que sai um
    // movimento que não disse a fazenda (ex.: a mudança de categoria)
    const ondeEsta = (tabela, cat) => {
      let melhor = null, n = 0;
      for (const [k, cats] of Object.entries(tabela)) if ((cats[cat] || 0) > n) { n = cats[cat]; melhor = k; }
      return melhor;
    };
    const mexe = (faz, lote, cat, n) => {
      soma(rebanho, cat, n);
      faz = faz || "Sem fazenda";
      porFazenda[faz] = porFazenda[faz] || {};
      soma(porFazenda[faz], cat, n);
      if (lote) { porLote[lote] = porLote[lote] || {}; soma(porLote[lote], cat, n); }
    };
    // O gado muda de categoria sozinho: o boi comprado magro é vendido
    // gordo sem ninguém lançar a mudança. Quando uma saída passa do que
    // existe na categoria, a diferença sai das categorias de onde o animal
    // veio (a mais próxima primeiro) e, se ainda faltar, de qualquer outra
    // que tenha cabeças. Assim comprar 9 magros e vender 9 gordos zera.
    const tira = (m, cat, n) => {
      const faz = m.fazenda || ondeEsta(porFazenda, cat);
      mexe(faz, m.lote || ondeEsta(porLote, cat), cat, -n);
    };
    const ajustes = [];
    const saida = (m, n) => {
      let falta = n;
      const daPropria = Math.min(falta, Math.max(0, rebanho[m.categoria] || 0));
      if (daPropria) { tira(m, m.categoria, daPropria); falta -= daPropria; }
      if (!falta) return;
      const antes = (ORIGEM[m.categoria] || []).slice().reverse();
      const outras = Object.keys(rebanho).filter((c) => c !== m.categoria && !antes.includes(c));
      for (const c of [...antes, ...outras]) {
        const tem = Math.max(0, rebanho[c] || 0);
        if (!tem) continue;
        const n2 = Math.min(falta, tem);
        tira(m, c, n2);
        ajustes.push({ data: m.data, tipo: m.tipo, cabecas: n2, de: c, para: m.categoria });
        falta -= n2;
        if (!falta) return;
      }
      // saiu mais do que o rebanho inteiro tinha: fica registrado como negativo
      tira(m, m.categoria, falta);
    };
    // Peso de cada categoria no tempo, junto com a contagem: a pesagem vale
    // para a categoria inteira; quem entra depois com peso (compra, entrada,
    // mudança de categoria) entra na média ponderada pelas cabeças; uma
    // saída com peso é a informação mais nova da categoria.
    const pesoCat = {};
    let ip = 0;
    const pesa = (p) => {
      const a = pesoCat[p.categoria];
      if (a && a.fonte === "pesagem" && a.data === p.data) {
        a.kg = (a.kg * a.pesadas + p.peso_medio_kg * p.cabecas) / (a.pesadas + p.cabecas); a.pesadas += p.cabecas;
      } else pesoCat[p.categoria] = { kg: p.peso_medio_kg, pesadas: p.cabecas, cab: Math.max(p.cabecas, rebanho[p.categoria] || 0), fonte: "pesagem", data: p.data };
    };
    // pesagens de dias anteriores a d (a do mesmo dia vem depois dos movimentos)
    const pesagensAte = (d) => { while (ip < pesagens.length && pesagens[ip].data < d) pesa(pesagens[ip++]); };
    const entraPeso = (cat, kg, n, data) => {
      const a = pesoCat[cat], tem = a ? Math.max(0, Math.min(a.cab, rebanho[cat] || 0)) : 0;
      pesoCat[cat] = { kg: tem ? (a.kg * tem + kg * n) / (tem + n) : kg, cab: tem + n, fonte: "movimento", data };
    };
    const kgEm = (cat) => (pesoCat[cat] ? pesoCat[cat].kg : FC.PESO_TIPICO[cat]);
    const temPeso = (m) => ok(m.peso_medio_kg) && m.peso_medio_kg > 0;
    for (const m of movs) {
      const t = FC.TIPOS_MOV[m.tipo];
      if (!t) continue;
      pesagensAte(m.data);
      // outra entrada sem valor: estimada como o valor do rebanho na data.
      // Fica no próprio lançamento para caixa() e os fluxos da carteira.
      if (m.tipo === "entrada") m.valor_estimado = m.valor_total > 0 ? null
        : m.cabecas * valorCabeca(m.categoria, temPeso(m) ? m.peso_medio_kg : kgEm(m.categoria), cfg);
      if (m.tipo === "reclassificacao") {
        const faz = m.fazenda || ondeEsta(porFazenda, m.categoria);
        const lote = m.lote || ondeEsta(porLote, m.categoria);
        // só muda de categoria o que existe nela: o excesso não cria cabeças
        const n = Math.min(m.cabecas, Math.max(0, rebanho[m.categoria] || 0));
        if (n < m.cabecas) ajustes.push({ data: m.data, tipo: m.tipo, cabecas: m.cabecas - n, de: m.categoria, para: m.categoria_destino, ignorado: true });
        if (n && temPeso(m)) entraPeso(m.categoria_destino, m.peso_medio_kg, n, m.data);
        if (n) { mexe(faz, lote, m.categoria, -n); mexe(faz, lote, m.categoria_destino, n); }
      } else if (t.sinal < 0) {
        saida(m, m.cabecas);
        if (temPeso(m)) pesoCat[m.categoria] = { kg: m.peso_medio_kg, cab: Math.max(0, rebanho[m.categoria] || 0), fonte: "movimento", data: m.data };
      } else {
        if (temPeso(m)) entraPeso(m.categoria, m.peso_medio_kg, m.cabecas, m.data);
        mexe(m.fazenda, m.lote, m.categoria, m.cabecas);
      }
    }
    pesagensAte("9999-12-31");
    const inconsistentes = Object.entries(rebanho).filter(([, n]) => n < 0).map(([c]) => c);
    const total = Object.values(rebanho).reduce((s, n) => s + Math.max(0, n), 0);

    // ---------------------------------------------------------- peso atual
    const peso = {};
    for (const cat of Object.keys(FC.CATEGORIAS_GADO)) {
      const p = pesoCat[cat];
      peso[cat] = p ? { kg: p.kg, fonte: p.fonte, data: p.data } : { kg: FC.PESO_TIPICO[cat], fonte: "típico", data: null };
    }

    // ---------------------------------------------------------- valor
    const porCategoria = [];
    let valorRebanho = 0;
    for (const [cat, n] of Object.entries(rebanho)) {
      if (n <= 0) continue;
      const kg = peso[cat].kg;
      const porCabeca = (cfg.valor_cabeca_por_categoria || {})[cat];
      const precoArroba = Number((cfg.arroba_por_categoria || {})[cat]) || Number(cfg.preco_arroba) || 0;
      const arr = arrobas(kg, rend);
      const valor = n * valorCabeca(cat, kg, cfg);
      valorRebanho += valor;
      porCategoria.push({ categoria: cat, nome: FC.CATEGORIAS_GADO[cat], cabecas: n, kg, fonte_peso: peso[cat].fonte,
        data_peso: peso[cat].data, arrobas_cabeca: arr, preco_arroba: precoArroba, valor,
        por_cabeca: ok(Number(porCabeca)) && Number(porCabeca) > 0 });
    }
    porCategoria.sort((a, b) => b.valor - a.valor);

    // ---------------------------------------------------------- financeiro
    const compras = movs.filter((m) => m.tipo === "compra");
    const vendas = movs.filter((m) => m.tipo === "venda");
    // gado que entrou com valor (estoque inicial, transferência) é capital
    // posto na atividade; o que saiu com valor é capital retirado
    const entradasValor = FC.soma(movs.filter((m) => m.tipo === "entrada"), valorEntrada);
    const saidasValor = FC.soma(movs.filter((m) => m.tipo === "saida"), (m) => m.valor_total);
    const gastoCompras = FC.soma(compras, (m) => m.valor_total + m.despesas) + entradasValor;
    const receitaVendas = FC.soma(vendas, (m) => m.valor_total - m.despesas) + saidasValor;
    const totalCustos = FC.soma(custos, (c) => c.valor);
    const custosPorCategoria = {};
    for (const c of custos) soma(custosPorCategoria, c.categoria, c.valor);

    const cabVendidas = FC.soma(vendas, (m) => m.cabecas);
    const arrVendidas = FC.soma(vendas.filter((m) => ok(m.peso_medio_kg)), (m) => m.cabecas * arrobas(m.peso_medio_kg, rend));
    const valorVendasComPeso = FC.soma(vendas.filter((m) => ok(m.peso_medio_kg)), (m) => m.valor_total);
    const cabCompradas = FC.soma(compras, (m) => m.cabecas);

    const investido = gastoCompras + totalCustos;
    const cx = caixa(movs, custos);
    // capital próprio: só o que saiu do bolso (o caixa reinvestido de vendas
    // não conta de novo — ver caixa())
    const aportado = FC.soma(cx.fluxos, (f) => f.aporte);
    const financeiro = {
      caixa_agro: cx.saldo,
      aportado, sacado: FC.soma(cx.fluxos, (f) => f.saque),
      gasto_compras: gastoCompras, receita_vendas: receitaVendas, custos: totalCustos,
      investido, caixa_liquido: receitaVendas - investido,
      // resultado econômico: o que entrou + o que o rebanho vale hoje − tudo que saiu
      resultado: receitaVendas + valorRebanho - investido,
      // retorno sobre o capital aportado (resultado = rebanho + caixa + sacado − aportado)
      retorno_pct: aportado > 0 ? ((receitaVendas + valorRebanho - investido) / aportado) * 100 : null,
      custos_por_categoria: custosPorCategoria,
      cab_vendidas: cabVendidas, cab_compradas: cabCompradas, entradas_valor: entradasValor,
      preco_medio_arroba_venda: arrVendidas ? valorVendasComPeso / arrVendidas : null,
      custo_medio_cabeca_compra: cabCompradas ? (gastoCompras - entradasValor) / cabCompradas : null,
      mortes: FC.soma(movs.filter((m) => m.tipo === "morte"), (m) => m.cabecas),
      nascimentos: FC.soma(movs.filter((m) => m.tipo === "nascimento"), (m) => m.cabecas),
    };
    // mortalidade sobre o que passou pela fazenda
    const entradas = FC.soma(movs.filter((m) => ["compra", "nascimento", "entrada"].includes(m.tipo)), (m) => m.cabecas);
    financeiro.mortalidade_pct = entradas ? (financeiro.mortes / entradas) * 100 : null;

    // ---------------------------------------------------------- série mensal
    const serie = [];
    const eventos = [
      ...movs.map((m) => ({ data: m.data, cab: m.tipo === "reclassificacao" ? 0 : FC.TIPOS_MOV[m.tipo].sinal * m.cabecas,
        inv: m.tipo === "compra" ? m.valor_total + m.despesas : m.tipo === "entrada" ? valorEntrada(m) : 0,
        rec: m.tipo === "venda" ? m.valor_total - m.despesas : m.tipo === "saida" ? m.valor_total : 0 })),
      ...custos.map((c) => ({ data: c.data, cab: 0, inv: c.valor, rec: 0 })),
    ].sort((a, b) => a.data.localeCompare(b.data));
    if (eventos.length) {
      let mes = eventos[0].data.slice(0, 7);
      const fim = FC.datas.hoje().slice(0, 7);
      let i = 0, cab = 0, inv = 0, rec = 0;
      while (mes <= fim) {
        while (i < eventos.length && eventos[i].data.slice(0, 7) <= mes) {
          cab += eventos[i].cab; inv += eventos[i].inv; rec += eventos[i].rec; i++;
        }
        serie.push({ mes, data: mes + "-15", cabecas: cab, investido: inv, recebido: rec });
        const [a, m] = mes.split("-").map(Number);
        mes = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
      }
    }

    // ---------------------------------------------------------- GMD
    const gmd = [];
    const grupos = {};
    for (const p of pesagens) {
      const k = (p.lote ? "Lote " + p.lote : FC.CATEGORIAS_GADO[p.categoria]) + (p.fazenda ? " · " + p.fazenda : "");
      (grupos[k] = grupos[k] || []).push(p);
    }
    // só compara pesagens dos mesmos animais: compra, venda, nascimento ou
    // mudança de categoria no grupo entre duas pesagens começa um período
    // novo; sem duas pesagens no mesmo período, o GMD não aparece
    const MUDA = ["compra", "venda", "entrada", "saida", "nascimento", "reclassificacao"];
    const mexeNoGrupo = (m, p) => MUDA.includes(m.tipo)
      && (p.lote ? m.lote === p.lote : m.categoria === p.categoria || m.categoria_destino === p.categoria)
      && (!p.fazenda || !m.fazenda || m.fazenda === p.fazenda);
    for (const [nome, todas] of Object.entries(grupos)) {
      let ps = [todas[0]];
      const periodos = [ps];
      for (const p of todas.slice(1)) {
        const de = ps.at(-1).data;
        if (movs.some((m) => m.data > de && m.data <= p.data && mexeNoGrupo(m, p))) periodos.push((ps = [p]));
        else ps.push(p);
      }
      ps = periodos.filter((x) => x.length > 1 && x.at(-1).data > x[0].data).at(-1);
      if (!ps) continue;
      const a = ps[0], b = ps.at(-1);
      const dias = FC.datas.dias(a.data, b.data);
      if (dias <= 0) continue;
      const ganho = b.peso_medio_kg - a.peso_medio_kg;
      gmd.push({ nome, de: a.data, ate: b.data, dias, peso_ini: a.peso_medio_kg, peso_fim: b.peso_medio_kg,
        ganho, gmd: ganho / dias, arrobas_mes: (arrobas(ganho, rend) / dias) * 30, pesagens: ps.length });
    }

    return { ajustes, rebanho, total, porFazenda, porLote, porCategoria, valorRebanho, peso, financeiro, serie, gmd,
      inconsistentes, rendimento: rend, tem_dados: movs.length + custos.length + pesagens.length > 0 };
  }

  // cálculo do valor de uma operação a partir do modo de preço escolhido
  function valorDaOperacao({ modo, cabecas, peso_medio_kg, preco_arroba, preco_cabeca, valor_total }, rend) {
    cabecas = Number(cabecas) || 0;
    if (modo === "arroba" && ok(peso_medio_kg) && ok(preco_arroba)) return cabecas * arrobas(peso_medio_kg, rend) * preco_arroba;
    if (modo === "cabeca" && ok(preco_cabeca)) return cabecas * preco_cabeca;
    return ok(valor_total) ? valor_total : 0;
  }

  // ---------------------------------------------------------------- caixa do agro
  // O dinheiro que gira dentro da atividade. Numa venda, a parte
  // reinvestida fica aqui e paga as próximas compras e custos; só o que
  // passa do caixa é aporte novo, e só o que sai da venda sem voltar é
  // saque. Assim vender 1 por 1,8x e recomprar 2 é crescimento, não um
  // saque seguido de um aporte.
  // Devolve os fluxos que de fato entram e saem da carteira e o saldo do
  // caixa depois de cada lançamento.
  function caixa(movs, custos) {
    const ordem = { venda: 0, saida: 1, compra: 2, entrada: 3, custo: 4 };
    const evs = [
      ...(movs || []).filter((m) => ["compra", "venda", "entrada", "saida"].includes(m.tipo))
        .map((m) => ({ data: m.data, tipo: m.tipo, id: m.id, m })),
      ...(custos || []).map((c) => ({ data: c.data, tipo: "custo", id: c.id, c })),
    ].sort((a, b) => a.data.localeCompare(b.data) || ordem[a.tipo] - ordem[b.tipo]
      || String((a.m || a.c).criado_em || "").localeCompare(String((b.m || b.c).criado_em || "")));
    let saldo = 0;
    const fluxos = [], porId = {};
    for (const e of evs) {
      let aporte = 0, saque = 0, doCaixa = 0, reinvestido = 0;
      if (e.tipo === "venda") {
        const liquido = Math.max(0, e.m.valor_total - e.m.despesas);
        reinvestido = Math.min(liquido, Math.max(0, Number(e.m.reinvestido) || 0));
        saldo += reinvestido;
        saque = liquido - reinvestido;
      } else if (e.tipo === "saida") {
        saque = e.m.valor_total || 0;
      } else {
        const custo = e.tipo === "custo" ? e.c.valor : e.tipo === "compra" ? e.m.valor_total + e.m.despesas : valorEntrada(e.m);
        doCaixa = Math.min(saldo, custo);
        saldo -= doCaixa;
        aporte = custo - doCaixa;
      }
      const f = { data: e.data, tipo: e.tipo, id: e.id, aporte, saque, do_caixa: doCaixa, reinvestido, saldo };
      fluxos.push(f);
      if (e.id) porId[e.id] = f;
    }
    // saldo do caixa ao fim de um dia
    const saldoEm = (d) => { let v = 0; for (const f of fluxos) { if (f.data > d) break; v = f.saldo; } return v; };
    return { fluxos, porId, saldo, saldoEm };
  }

  FC.agro = { analisa, arrobas, valorDaOperacao, caixa, valorCabeca, valorEntrada, ORIGEM };
})();
