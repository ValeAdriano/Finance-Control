/* Projeção mês a mês, em moeda de hoje.
 *
 * 1. Tudo em termos reais: R$ 1 milhão em 2046 não é R$ 1 milhão.
 * 2. O que é contratado (renda fixa) separado do que é premissa.
 * 3. Proventos vêm do DY observado, não de chute — somar um retorno
 *    total "esperado" ao dividendo contaria o dinheiro duas vezes. */
(function () {
  const FC = window.FC;
  const MESES = 12;
  const mensal = (a) => Math.pow(1 + a / 100, 1 / MESES) - 1;
  const real = (nom, ipca) => ((1 + nom / 100) / (1 + ipca / 100) - 1) * 100;

  function perfilDosPilares(dados, macroLp, ipca) {
    const pilares = {};
    for (const a of dados.ativos) {
      if (!a.posicao || !a.pilar) continue;
      const dyM = (a.metricas || []).find((m) => m.chave === "dy" && m.valor);
      const dy = dyM ? dyM.valor : 0;
      const p = (pilares[a.pilar] = pilares[a.pilar] || { valor: 0, dyp: 0, titulos: [] });
      p.valor += a.posicao.atual;
      p.dyp += a.posicao.atual * dy;
    }
    for (const p of Object.values(pilares)) p.dy = p.valor ? p.dyp / p.valor : 0;

    const caixa = (pilares.caixa = pilares.caixa || { valor: 0, dy: 0, titulos: [] });
    const cdi = macroLp.cdi;
    for (const r of dados.rendaFixa) {
      const aplic = r.valor_aplicado || 0;
      if (!aplic) continue;
      let nominal;
      if (r.taxa == null) nominal = cdi;
      else if (r.tipo === "cdi") nominal = (cdi * r.taxa) / 100;
      else if (r.tipo === "ipca") nominal = ((1 + ipca / 100) * (1 + r.taxa / 100) - 1) * 100;
      else nominal = r.taxa;
      caixa.valor += aplic;
      caixa.titulos.push({ nome: r.nome, valor: aplic, real: real(nominal, ipca), nominal });
    }
    const tt = FC.soma(caixa.titulos, (t) => t.valor);
    caixa.taxa_real = tt ? FC.soma(caixa.titulos, (t) => t.valor * t.real) / tt : 0;

    if (dados.agro && dados.agro.valorRebanho > 0) pilares.agro = { valor: dados.agro.valorRebanho, dy: 0, titulos: [] };
    return pilares;
  }

  function destino(saldos, alvos, modo) {
    const ks = Object.keys(saldos);
    const total = ks.reduce((s, k) => s + saldos[k], 0);
    const somaAlvos = ks.reduce((s, k) => s + (Number(alvos[k]) || 0), 0);
    const proporcional = () => Object.fromEntries(ks.map((k) => [k, (Number(alvos[k]) || 0) / somaAlvos]));
    if (!somaAlvos) return Object.fromEntries(ks.map((k) => [k, 1 / ks.length]));
    if (!total) return proporcional();
    if (modo === "proporcional") return proporcional();
    const faltas = Object.fromEntries(ks.map((k) => [k, Math.max(0, (total * (Number(alvos[k]) || 0)) / 100 - saldos[k])]));
    const sf = Object.values(faltas).reduce((a, b) => a + b, 0);
    if (sf <= 0) return proporcional();
    return Object.fromEntries(ks.map((k) => [k, faltas[k] / sf]));
  }

  function simula(pilares, prem, alvos, ajuste) {
    const meses = Math.round(Number(prem.horizonte_anos) || 20) * MESES;
    const aporte = Number(prem.aporte_mensal) || 0;
    const reinveste = !!prem.reinvestir_proventos;
    const modo = prem.distribuicao_aporte || "rebalancear";
    const val = prem.valorizacao_real_anual || {};
    const saldos = Object.fromEntries(Object.entries(pilares).map(([k, p]) => [k, p.valor]));
    const dy = Object.fromEntries(Object.entries(pilares).map(([k, p]) => [k, p.dy || 0]));
    // se não há nenhum pilar (carteira vazia), o aporte cria os pilares da meta
    if (!Object.keys(saldos).length) for (const k of Object.keys(alvos)) if (Number(alvos[k]) > 0) { saldos[k] = 0; dy[k] = 0; }
    const fator = Object.fromEntries(Object.keys(saldos).map((k) => [k,
      k === "caixa" ? mensal((pilares.caixa || {}).taxa_real || 0) : mensal((Number(val[k]) || 0) + ajuste)]));

    const pat = [], renda = [];
    let aportado = 0, prov = 0;
    const inicial = Object.values(saldos).reduce((a, b) => a + b, 0);
    for (let m = 1; m <= meses; m++) {
      for (const k in saldos) saldos[k] *= 1 + fator[k];
      const rendaMes = Object.keys(saldos).filter((k) => k !== "caixa").reduce((s, k) => s + (saldos[k] * dy[k]) / 100 / MESES, 0);
      prov += rendaMes;
      const entrada = aporte + (reinveste ? rendaMes : 0);
      aportado += aporte;
      const pesos = destino(saldos, alvos, modo);
      for (const [k, w] of Object.entries(pesos)) saldos[k] += entrada * w;
      if (m % 3 === 0 || m === meses) {
        pat.push([m / MESES, Object.values(saldos).reduce((a, b) => a + b, 0)]);
        renda.push([m / MESES, rendaMes]);
      }
    }
    const final = Object.values(saldos).reduce((a, b) => a + b, 0);
    return {
      patrimonio: pat, renda, final, inicial, aportado, proventos: prov,
      valorizacao: final - inicial - aportado - (reinveste ? prov : 0),
      renda_mensal_final: renda.length ? renda.at(-1)[1] : 0,
      renda_mensal_hoje: Object.keys(pilares).filter((k) => k !== "caixa").reduce((s, k) => s + (pilares[k].valor * (dy[k] || 0)) / 100 / MESES, 0),
    };
  }

  function projeta(dados, prem) {
    const macro = dados.macro || {};
    const lp = prem.macro_longo_prazo || {};
    const cdi = lp.cdi != null ? lp.cdi : macro.cdi || 10;
    const ipca = lp.ipca != null ? lp.ipca : macro.ipca_12m || 4;
    const macroLp = { cdi, ipca, juro_real: real(cdi, ipca) };
    const alvos = dados.alocacao_alvo || {};
    const pilares = perfilDosPilares(dados, macroLp, ipca);
    const cen = prem.cenarios || {};
    const base = simula(pilares, prem, alvos, 0);
    const pess = simula(pilares, prem, alvos, Number(cen.pessimista ?? -3));
    const otim = simula(pilares, prem, alvos, Number(cen.otimista ?? 3));
    const val = prem.valorizacao_real_anual || {};
    const ordem = FC.PILARES.map((p) => p.chave);
    const resumo = Object.entries(pilares).map(([k, p]) => k === "caixa"
      ? { chave: k, nome: FC.PILAR_NOME[k], valor: p.valor, dy: null, valorizacao: null, total: p.taxa_real || 0, titulos: p.titulos }
      : { chave: k, nome: FC.PILAR_NOME[k], valor: p.valor, dy: p.dy, valorizacao: Number(val[k]) || 0, total: (Number(val[k]) || 0) + p.dy, titulos: [] })
      .sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
    const caixa = resumo.find((l) => l.chave === "caixa");
    const rv = resumo.filter((l) => l.chave !== "caixa" && l.valor > 0).map((l) => l.total);
    return {
      base, pessimista: pess, otimista: otim, pilares: resumo, macro_lp: macroLp,
      usando_macro_de_hoje: lp.cdi == null, premissas: prem,
      alerta_caixa: !!caixa && caixa.valor > 0 && rv.length > 0 && caixa.total > Math.max(...rv),
      titulos_caixa: caixa ? caixa.titulos : [], caixa_real: caixa ? caixa.total : 0,
    };
  }

  FC.projecao = { projeta };
})();
