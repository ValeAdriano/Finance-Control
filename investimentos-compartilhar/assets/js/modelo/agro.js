/* Agronegócio: rebanho, valor e resultado da atividade.
 *
 * O rebanho não é digitado, é CONTADO: cada movimento soma ou subtrai
 * cabeças de uma categoria. Assim a contagem de hoje sempre bate com o
 * histórico, e corrigir um lançamento antigo corrige tudo que vem depois.
 *
 * Valor do rebanho = cabeças × peso vivo × rendimento de carcaça ÷ 15
 * × preço da arroba. O peso vem da pesagem mais recente da categoria;
 * sem pesagem, do último movimento com peso; sem nada, de um peso típico
 * — e a tela diz qual das três foi usada. */
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
    for (const m of movs) {
      const t = FC.TIPOS_MOV[m.tipo];
      if (!t) continue;
      if (m.tipo === "reclassificacao") {
        const faz = m.fazenda || ondeEsta(porFazenda, m.categoria);
        const lote = m.lote || ondeEsta(porLote, m.categoria);
        mexe(faz, lote, m.categoria, -m.cabecas);
        mexe(faz, lote, m.categoria_destino, m.cabecas);
      } else if (t.sinal < 0) {
        saida(m, m.cabecas);
      } else mexe(m.fazenda, m.lote, m.categoria, m.cabecas);
    }
    const inconsistentes = Object.entries(rebanho).filter(([, n]) => n < 0).map(([c]) => c);
    const total = Object.values(rebanho).reduce((s, n) => s + Math.max(0, n), 0);

    // ---------------------------------------------------------- peso atual
    const peso = {};
    for (const cat of Object.keys(FC.CATEGORIAS_GADO)) {
      const ps = pesagens.filter((p) => p.categoria === cat);
      if (ps.length) {
        const ultimaData = ps.at(-1).data;
        const doDia = ps.filter((p) => p.data === ultimaData);
        const cab = doDia.reduce((s, p) => s + p.cabecas, 0);
        peso[cat] = { kg: doDia.reduce((s, p) => s + p.peso_medio_kg * p.cabecas, 0) / cab, fonte: "pesagem", data: ultimaData };
        continue;
      }
      const comPeso = movs.filter((m) => (m.categoria === cat || m.categoria_destino === cat) && ok(m.peso_medio_kg));
      if (comPeso.length) { peso[cat] = { kg: comPeso.at(-1).peso_medio_kg, fonte: "movimento", data: comPeso.at(-1).data }; continue; }
      peso[cat] = { kg: FC.PESO_TIPICO[cat], fonte: "típico", data: null };
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
      const valor = ok(Number(porCabeca)) && Number(porCabeca) > 0 ? n * Number(porCabeca) : n * arr * precoArroba;
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
    const entradasValor = FC.soma(movs.filter((m) => m.tipo === "entrada"), (m) => m.valor_total);
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
    const financeiro = {
      gasto_compras: gastoCompras, receita_vendas: receitaVendas, custos: totalCustos,
      investido, caixa_liquido: receitaVendas - investido,
      // resultado econômico: o que entrou + o que o rebanho vale hoje − tudo que saiu
      resultado: receitaVendas + valorRebanho - investido,
      retorno_pct: investido ? ((receitaVendas + valorRebanho) / investido - 1) * 100 : null,
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
        inv: m.tipo === "compra" ? m.valor_total + m.despesas : m.tipo === "entrada" ? m.valor_total : 0,
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
    for (const [nome, ps] of Object.entries(grupos)) {
      if (ps.length < 2) continue;
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

  FC.agro = { analisa, arrobas, valorDaOperacao };
})();
