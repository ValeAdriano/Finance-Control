/* Salário e plano de investimento.
 *
 * A renda de um mês é a soma dos ganhos fixos que valem naquele mês
 * (entre início e fim) mais os avulsos com data no mês. O plano diz
 * quanto dessa renda vira investimento e para onde vai cada parte; o
 * guia do mês compara o planejado com o que você de fato aportou. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  FC.CATEGORIAS_GANHO = {
    salario: "Salário", pro_labore: "Pró-labore", extra: "Renda extra / freela", bonus: "Bônus / PLR",
    decimo_terceiro: "13º salário", ferias: "Férias", aluguel: "Aluguel recebido", outros: "Outros",
  };

  FC.PADRAO_PLANO = {
    modo: "percentual",            // percentual da renda | valor fixo | fixo_mais_sobra
    valor_fixo: 0,                 // fixo_mais_sobra: a parte combinada (o resto da sobra vai junto)
    percentual: 30,
    valor: 1000,
    reinvestir_dividendos: true,   // DERIVADO de destino_proventos (ver destinoProventos)
    // para onde vão os proventos: "mesmo_ativo" (entram no aporte do mês),
    // "caixa" (ficam guardados; com caixa de proventos ligado, o que sai dele
    // para compras conta no mês) ou "pote:<id>" (vão para um pote)
    destino_proventos: null,
    destinos: [],                  // [{tipo: pilar|ativo|renda_fixa, alvo, pct}]
  };

  // destino dos proventos: o salvo vale; sem ele, sai do legado
  // (reinvestir_dividendos + destino do caixa de proventos)
  function destinoProventos(plano, proventos) {
    const d = plano && plano.destino_proventos;
    if (d === "mesmo_ativo" || d === "caixa" || (typeof d === "string" && /^pote:.+/.test(d))) return d;
    if (proventos && proventos.destino === "caixa") return "caixa";
    return plano && plano.reinvestir_dividendos === false ? "caixa" : "mesmo_ativo";
  }
  // o booleano antigo, agora só derivado do destino
  function reinvesteProventos(destino, proventos) {
    return destino === "mesmo_ativo" || (destino === "caixa" && !!proventos && proventos.destino === "caixa");
  }

  const mesDe = (iso) => iso.slice(0, 7);
  // o último mês em que um ganho fixo cai na conta: a data do último
  // pagamento, se houver; senão o fim (o fim do contrato fica à parte, em
  // data_fim_contrato, e serve ao proporcional)
  function fimDosPagamentos(g) { return g.data_ultimo_pagamento || g.fim || null; }
  function valeNoMes(g, mes) {
    if (g.tipo === "avulso") return mesDe(g.inicio) === mes;
    const fim = fimDosPagamentos(g);
    return mesDe(g.inicio) <= mes && (!fim || mesDe(fim) >= mes);
  }

  // a renda do mês (com proporcional e impostos do PJ) mora em FC.rendaMes (Marco 5)
  function rendaDoMes(ganhos, mes, parametros) {
    return FC.rendaMes.rendaDoMes(ganhos, mes, parametros || (FC.estado && FC.estado.base && FC.estado.base.parametros) || []);
  }

  function mesesAte(mes, n) {
    const saida = [];
    let [a, m] = mes.split("-").map(Number);
    for (let i = 0; i < n; i++) {
      saida.unshift(`${a}-${String(m).padStart(2, "0")}`);
      m--; if (!m) { m = 12; a--; }
    }
    return saida;
  }

  // ---------------------------------------------------------------- destinos
  function rotuloDestino(d) {
    if (d.tipo === "pilar") return FC.PILAR_NOME[d.alvo] || d.alvo;
    return d.alvo;
  }
  // o pilar de um destino — é o que a projeção usa para distribuir o aporte
  function pilarDoDestino(d, base) {
    if (d.tipo === "pilar") return d.alvo;
    if (d.tipo === "ativo") { const a = base.ativos.find((x) => x.ticker === d.alvo); return a ? a.pilar : "alternativos"; }
    const r = base.rendaFixa.find((x) => x.nome === d.alvo);
    return r ? r.pilar : "caixa";
  }

  // quanto já entrou em um destino dentro do mês
  function aportadoNoMes(d, base, mes) {
    // movimento interno (Marco 3) troca um ativo por outro: não é aporte
    const noMes = (x) => x.data && mesDe(x.data) === mes && !x.movimento_interno_id;
    const ap = base.aportes.filter(noMes);
    if (d.tipo === "ativo") return FC.soma(ap.filter((a) => a.tipo === "ativo" && a.ticker === d.alvo), (a) => a.valor);
    if (d.tipo === "renda_fixa") return FC.soma(ap.filter((a) => a.tipo === "caixa" && !a.historico && a.titulo === d.alvo), (a) => a.valor);
    // pilar: tudo o que foi para ativos/títulos daquele pilar (+ compras de gado, se agro)
    const pilarAtivo = Object.fromEntries(base.ativos.map((a) => [a.ticker, a.pilar]));
    const pilarRf = Object.fromEntries(base.rendaFixa.map((r) => [r.nome, r.pilar]));
    let v = FC.soma(ap.filter((a) => a.tipo === "ativo" && pilarAtivo[a.ticker] === d.alvo), (a) => a.valor)
      + FC.soma(ap.filter((a) => a.tipo === "caixa" && !a.historico && (pilarRf[a.titulo] || "caixa") === d.alvo), (a) => a.valor);
    if (d.alvo === "agro") {
      // só o dinheiro novo: o que veio do caixa de vendas reinvestidas não é aporte
      v += aporteAgroNoMes(base, mes);
    }
    return v;
  }

  // aporte novo no agro dentro do mês (compras e custos além do caixa da atividade)
  const cacheCaixa = new WeakMap();
  function aporteAgroNoMes(base, mes) {
    const movs = base.agro.movs || [];
    let cx = cacheCaixa.get(movs);
    if (!cx || cx.custos !== base.agro.custos) {
      cx = { custos: base.agro.custos, r: FC.agro.caixa(movs, base.agro.custos || []) };
      cacheCaixa.set(movs, cx);
    }
    return FC.soma(cx.r.fluxos.filter((f) => mesDe(f.data) === mes), (f) => f.aporte);
  }

  // tudo o que entrou em investimentos no mês, com ou sem plano
  // (a parte de uma compra paga com o caixa de proventos não é dinheiro novo)
  function investidoNoMes(base, mes) {
    const doCaixa = (a) => (FC.caixaProventos ? FC.caixaProventos.usado(base, a) : 0);
    return FC.soma(base.aportes.filter((a) => a.data && mesDe(a.data) === mes && !a.movimento_interno_id && (a.tipo === "ativo" || (a.tipo === "caixa" && !a.historico))), (a) => a.valor - doCaixa(a))
      + aporteAgroNoMes(base, mes);
  }

  // a meta de aporte de um mês: o valor base do plano (sem dividendos)
  function metaDoMes(plano, ganhos, mes, base) {
    if (!plano) return 0;
    if (plano.modo === "valor") return Number(plano.valor) || 0;
    if (plano.modo === "fixo_mais_sobra") return fixoMaisSobraDoMes(plano, ganhos, base, mes).total;
    return (rendaDoMes(ganhos, mes).total * (Number(plano.percentual) || 0)) / 100;
  }

  // fixo + sobra de um mês: despesas reais no mês fechado; no mês corrente
  // ou futuro, o custo de vida previsto (média de 3 meses ou a premissa)
  function fixoMaisSobraDoMes(plano, ganhos, base, mes, custoPremissa) {
    const R = FC.rendaMes;
    const renda = rendaDoMes(ganhos, mes, base && base.parametros);
    const desp = base ? R.despesasDoMes(base.despesas || [], mes) : { total: 0, itens: [] };
    const atual = FC.datas.hoje().slice(0, 7);
    const premissa = custoPremissa != null ? custoPremissa : FC.objetivos && FC.estado && FC.estado.prefs ? FC.objetivos(FC.estado.prefs).custo_vida_mensal : null;
    const previsto = R.custoDeVida(base ? base.despesas || [] : [], mes, premissa);
    const fechado = mes < atual && desp.itens.length;
    const despesas = fechado ? desp.total : Math.max(desp.total, previsto.valor || 0);
    return { ...R.fixoMaisSobra({ renda: renda.total, impostos: renda.impostos, despesas, valorFixo: plano.valor_fixo }),
      despesas_origem: fechado ? "despesas do mês" : previsto.origem, apurado: !!fechado, renda_detalhe: renda };
  }

  // ---------------------------------------------------------------- sequência
  // Meses seguidos batendo a meta do plano, estilo Duolingo. O mês atual
  // soma quando já bateu e, enquanto não bate, não quebra nada. Mês sem
  // meta (sem renda cadastrada) congela: não soma nem quebra.
  function streak({ plano, ganhos = [], base, hoje = FC.datas.hoje() }) {
    const atualMes = mesDe(hoje);
    const datas = [...base.aportes.map((a) => a.data), ...(base.agro.movs || []).map((m) => m.data),
      ...(base.agro.custos || []).map((c) => c.data), ...ganhos.map((g) => g.inicio)].filter(Boolean).sort();
    const primeiro = datas.length ? mesDe(datas[0]) : atualMes;
    const anterior = (m) => { const [a, n] = m.split("-").map(Number); return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, "0")}`; };
    const estadoDe = (mes) => {
      const meta = metaDoMes(plano, ganhos, mes, base), investido = investidoNoMes(base, mes);
      const batido = meta > 0 && investido >= meta - 0.5;
      const estado = meta <= 0 ? "sem_meta" : batido ? "batido" : mes === atualMes ? "andamento" : "abaixo";
      return { mes, meta, investido, pct: meta > 0 ? Math.min(100, (investido / meta) * 100) : 0, batido, estado };
    };
    const lista = [];
    for (let m = atualMes; m >= primeiro; m = anterior(m)) lista.push(estadoDe(m));
    // sequência atual: do mês atual para trás
    let atual = 0;
    for (const x of lista) {
      if (x.estado === "batido") atual++;
      else if (x.estado === "abaixo") break;
    }
    // recorde: a maior sequência em todo o histórico
    let recorde = 0, corre = 0;
    for (const x of [...lista].reverse()) {
      if (x.estado === "batido") recorde = Math.max(recorde, ++corre);
      else if (x.estado === "abaixo") corre = 0;
    }
    const meses = [];
    for (let i = 0, m = atualMes; i < 12; i++, m = anterior(m)) meses.unshift(lista.find((x) => x.mes === m) || { mes: m, estado: "sem_meta", meta: 0, investido: 0, pct: 0 });
    return { atual, recorde, mesAtual: lista[0], meses, tem_meta: lista.some((x) => x.meta > 0) };
  }

  // ---------------------------------------------------------------- plano do mês
  function planoDoMes({ plano, ganhos, base, mes, dividendosDoMes = 0, custoPremissa }) {
    const renda = rendaDoMes(ganhos, mes, base && base.parametros);
    const fs = plano.modo === "fixo_mais_sobra" ? fixoMaisSobraDoMes(plano, ganhos, base, mes, custoPremissa) : null;
    const valorBase = fs ? fs.total : plano.modo === "valor" ? Number(plano.valor) || 0 : (renda.total * (Number(plano.percentual) || 0)) / 100;
    // parcelas de aporte programado (Marco 5): saem de um pote, não são aporte novo
    const parcelas = base && FC.rendaMes ? FC.rendaMes.parcelasDoMes(base.parcelamentos || [], base.movimentosInternos || [], mes) : [];
    const div = plano.reinvestir_dividendos ? dividendosDoMes : 0;
    const total = valorBase + div;
    const somaPct = FC.soma(plano.destinos, (d) => d.pct) || 0;
    const brutos = plano.destinos.map((d) => ({ ...d, rotulo: rotuloDestino(d), pilar: pilarDoDestino(d, base),
      valor: somaPct ? (total * (Number(d.pct) || 0)) / somaPct : 0, bruto: aportadoNoMes(d, base, mes) }));
    // o aporte conta primeiro no destino mais específico (ativo/título); no
    // pilar que o contém entra só o que passou do planejado para ele
    const destinos = brutos.map((d) => {
      let aportado = d.bruto;
      if (d.tipo === "pilar") {
        for (const x of brutos) if (x.tipo !== "pilar" && x.pilar === d.alvo) aportado -= Math.min(x.bruto, x.valor);
        aportado = Math.max(0, aportado);
      }
      return { ...d, aportado, falta: Math.max(0, d.valor - aportado), feito: d.valor > 0 ? Math.min(100, (aportado / d.valor) * 100) : 0 };
    });
    // cumprido: o que foi a cada destino até o planejado dele — excesso num
    // destino não cobre a falta de outro. O total real fica em "investido".
    const aportadoTotal = FC.soma(destinos, (d) => Math.min(d.valor, d.aportado));
    return { mes, renda, valor_base: valorBase, dividendos: div, total, destinos, soma_pct: somaPct,
      aportado: aportadoTotal, investido: investidoNoMes(base, mes), falta: FC.soma(destinos, (d) => d.falta),
      sobra_renda: renda.total - valorBase, fixo_mais_sobra: fs, parcelas_pendentes: parcelas };
  }

  // proventos pagos no mês (os que o plano reinveste): pelos proventos
  // carregados ou, sem eles, pelos lançados à mão
  // Com caixa de proventos ligado, o que o plano reinveste no mês é o que
  // saiu do caixa para compras naquele mês (o resto continua guardado).
  function dividendosDoMes({ dados, base, proventos }, mes) {
    const cx = dados && dados.caixa_proventos;
    if (cx && cx.ativo) return cx.usadoNoMes(mes);
    if (proventos && dados) {
      const r = FC.dividendos.analisa(dados, base, proventos);
      return FC.soma(r.pagamentos.filter((p) => p.status === "pago" && p.quando.slice(0, 7) === mes), (p) => p.valor);
    }
    return FC.soma(base.aportes.filter((a) => a.tipo === "provento" && a.data && a.data.slice(0, 7) === mes), (a) => a.valor);
  }

  // o plano no formato da projeção: aporte mensal e peso de cada pilar
  function paraProjecao(plano, ganhos, base) {
    if (!plano || !plano.destinos || !plano.destinos.length) return null;
    const mes = FC.datas.hoje().slice(0, 7);
    const renda = rendaDoMes(ganhos, mes);
    // avulsos distorcem um mês só: a projeção usa a renda fixa
    const aporte = plano.modo === "valor" ? Number(plano.valor) || 0
      : plano.modo === "fixo_mais_sobra" ? fixoMaisSobraDoMes(plano, ganhos, base, mes).total
      : (renda.fixa * (Number(plano.percentual) || 0)) / 100;
    const pesos = {};
    const somaPct = FC.soma(plano.destinos, (d) => d.pct) || 1;
    for (const d of plano.destinos) {
      const p = pilarDoDestino(d, base);
      pesos[p] = (pesos[p] || 0) + (Number(d.pct) || 0) / somaPct;
    }
    return { aporte_mensal: aporte, pesos, renda_fixa_mensal: renda.fixa };
  }

  // ---------------------------------------------------------------- quando cai
  const REGRAS_DIA = { dia_util: "dia útil", dia_fixo: "dia fixo", ultimo_dia_util: "último dia útil" };
  function dataRecebimento(g, mes) {
    if (g.tipo === "avulso") return g.inicio;
    const n = Number(g.dia_numero) || 1;
    if (g.dia_regra === "dia_util") return FC.datas.diaUtil(mes, n);
    if (g.dia_regra === "ultimo_dia_util") return FC.datas.ultimoDiaUtil(mes);
    if (g.dia_regra === "dia_fixo") return `${mes}-${String(Math.min(n, FC.datas.ultimoDiaDoMes(mes))).padStart(2, "0")}`;
    return null;                  // sem regra: vale o mês, sem dia marcado
  }
  function descreveRegra(g) {
    if (g.tipo === "avulso") return null;
    if (g.dia_regra === "dia_util") return `${g.dia_numero || 1}º dia útil`;
    if (g.dia_regra === "ultimo_dia_util") return "último dia útil";
    if (g.dia_regra === "dia_fixo") return `todo dia ${g.dia_numero}`;
    return null;
  }
  // próximos recebimentos a partir de hoje (este mês e o seguinte)
  function proximos(ganhos, hojeIso, meses = 2) {
    const saida = [];
    let mes = hojeIso.slice(0, 7);
    for (let i = 0; i < meses; i++) {
      for (const g of ganhos.filter((x) => valeNoMes(x, mes))) {
        const d = dataRecebimento(g, mes);
        if (d && d >= hojeIso) saida.push({ ganho: g, data: d, valor: g.valor });
      }
      const [a, m] = mes.split("-").map(Number);
      mes = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    }
    return saida.sort((x, y) => x.data.localeCompare(y.data));
  }

  FC.salario = { fixoMaisSobraDoMes, destinoProventos, reinvesteProventos, fimDosPagamentos, streak, investidoNoMes, aporteAgroNoMes, metaDoMes, dataRecebimento, descreveRegra, proximos, REGRAS_DIA, rendaDoMes, mesesAte, planoDoMes, dividendosDoMes, paraProjecao, aportadoNoMes, rotuloDestino, pilarDoDestino, valeNoMes };
})();
