/* Hierarquia de alocação RF › Ações › Cripto (Marco 6).
 *
 * Mapeamento: RF = pilar caixa; Ações = ações + FIIs (real_estate);
 * Cripto = alternativos. O agro fica fora da base.
 *
 * preferencias.hierarquia = { modo_alocacao: "metas_fixas" | "hierarquia",
 *   faixas: { rf: {min, max, piso}, acoes: {min, max}, cripto: {min, max} },
 *   meses_reserva_pj }
 * Regras: RF entre min e max e nunca abaixo do piso; Ações na faixa e nunca
 * acima da RF; Cripto na faixa e nunca acima de Ações. */
(function () {
  const FC = window.FC;

  FC.PADRAO_HIERARQUIA = {
    modo_alocacao: "metas_fixas",
    faixas: { rf: { min: 45, max: 70, piso: 40 }, acoes: { min: 22, max: 38 }, cripto: { min: 5, max: 17 } },
    // renda PJ (sem 13º, férias e FGTS): meses de reserva sugeridos
    meses_reserva_pj: 12,
  };
  const GRUPOS = ["rf", "acoes", "cripto"];
  const NOME = { rf: "Renda fixa", acoes: "Ações e FIIs", cripto: "Cripto" };

  function grupos(porPilar) {
    const v = (k) => Number(porPilar[k]) || 0;
    return { rf: v("caixa"), acoes: v("acoes") + v("real_estate"), cripto: v("alternativos") };
  }
  const pcts = (g) => { const t = g.rf + g.acoes + g.cripto; return t > 0 ? { rf: (g.rf / t) * 100, acoes: (g.acoes / t) * 100, cripto: (g.cripto / t) * 100 } : { rf: 0, acoes: 0, cripto: 0 }; };

  /** o que viola numa divisão em % (rf, acoes, cripto) */
  function violacoes(d, faixas) {
    // tolerância de 0,05 p.p.: divisões vindas de valores em centavos não fecham exato
    const f = faixas || FC.PADRAO_HIERARQUIA.faixas, v = [], eps = 0.05;
    if (d.acoes > d.rf + eps) v.push({ regra: "ordem", texto: `Ações (${d.acoes.toFixed(1)}%) acima da renda fixa (${d.rf.toFixed(1)}%)` });
    if (d.cripto > d.acoes + eps) v.push({ regra: "ordem", texto: `Cripto (${d.cripto.toFixed(1)}%) acima de ações (${d.acoes.toFixed(1)}%)` });
    if (d.rf < f.rf.piso - eps) v.push({ regra: "piso", texto: `Renda fixa (${d.rf.toFixed(1)}%) abaixo do piso de ${f.rf.piso}%` });
    for (const k of GRUPOS) {
      if (d[k] < f[k].min - eps) v.push({ regra: "faixa", grupo: k, texto: `${NOME[k]} (${d[k].toFixed(1)}%) abaixo da faixa de ${f[k].min}%` });
      if (d[k] > f[k].max + eps) v.push({ regra: "faixa", grupo: k, texto: `${NOME[k]} (${d[k].toFixed(1)}%) acima da faixa de ${f[k].max}%` });
    }
    return v;
  }

  /** a divisão válida mais próxima (distância quadrática, passo de 0,5 p.p.) */
  function maisProxima(d, faixas) {
    const f = faixas || FC.PADRAO_HIERARQUIA.faixas;
    let melhor = null, dist = Infinity;
    for (let rf = Math.max(f.rf.min, f.rf.piso); rf <= f.rf.max + 1e-9; rf += 0.5) {
      for (let cr = f.cripto.min; cr <= f.cripto.max + 1e-9; cr += 0.5) {
        const ac = 100 - rf - cr;
        if (ac < f.acoes.min - 1e-9 || ac > f.acoes.max + 1e-9 || ac > rf + 1e-9 || cr > ac + 1e-9) continue;
        const x = (rf - d.rf) ** 2 + (ac - d.acoes) ** 2 + (cr - d.cripto) ** 2;
        if (x < dist - 1e-9) { dist = x; melhor = { rf, acoes: ac, cripto: cr }; }
      }
    }
    return melhor;
  }

  /** a divisão em % que um plano de aporte configurado dá a cada grupo */
  function divisaoDoPlano(plano, base) {
    const ds = (plano && plano.destinos) || [];
    const soma = FC.soma(ds, (d) => Number(d.pct) || 0);
    if (!soma) return null;
    const g = { caixa: 0, acoes: 0, real_estate: 0, alternativos: 0 };
    for (const d of ds) { const p = FC.salario.pilarDoDestino(d, base); if (p in g) g[p] += (Number(d.pct) || 0); }
    return pcts(grupos(g));
  }

  /** valida a divisão: ok, violações e a válida mais próxima */
  function valida(d, faixas) {
    const v = violacoes(d, faixas);
    return { ok: !v.length, violacoes: v, mais_proxima: v.length ? maisProxima(d, faixas) : null };
  }

  /** a ordem está certa na carteira? (valores por pilar) */
  function ordemDaCarteira(porPilar, faixas) {
    const g = grupos(porPilar), p = pcts(g);
    const f = faixas || FC.PADRAO_HIERARQUIA.faixas;
    const respeitada = g.rf >= g.acoes - 1e-6 && g.acoes >= g.cripto - 1e-6 && p.rf >= f.rf.piso - 1e-6;
    return { valores: g, pct: p, respeitada, violacoes: violacoes(p, f) };
  }

  /** meses até a ordem se corrigir, com o aporte e a divisão dados e os preços parados */
  function mesesParaCorrigir(porPilar, aporteMensal, divisao, faixas, limite = 600) {
    const f = faixas || FC.PADRAO_HIERARQUIA.faixas;
    let g = grupos(porPilar);
    const ok = (x) => x.rf >= x.acoes - 1e-6 && x.acoes >= x.cripto - 1e-6 && pcts(x).rf >= f.rf.piso - 1e-6;
    if (ok(g)) return 0;
    if (!(aporteMensal > 0) || !divisao) return null;
    for (let m = 1; m <= limite; m++) {
      g = { rf: g.rf + (aporteMensal * divisao.rf) / 100, acoes: g.acoes + (aporteMensal * divisao.acoes) / 100, cripto: g.cripto + (aporteMensal * divisao.cripto) / 100 };
      if (ok(g)) return m;
    }
    return null;
  }

  /**
   * divisão sugerida do aporte: RF no topo enquanto a reserva estiver abaixo
   * da meta; Cripto no piso enquanto a carteira estiver fora da ordem; o
   * resto em Ações. Sem nenhuma das duas, o meio das faixas. Sempre válida.
   */
  function divisaoSugerida({ reservaAbaixo, foraDaOrdem, faixas }) {
    const f = faixas || FC.PADRAO_HIERARQUIA.faixas;
    const meio = (k) => (f[k].min + f[k].max) / 2;
    const rf = reservaAbaixo ? f.rf.max : meio("rf");
    const cripto = foraDaOrdem ? f.cripto.min : meio("cripto");
    const d = { rf, acoes: 100 - rf - cripto, cripto };
    const motivo = [reservaAbaixo ? "renda fixa no topo enquanto a reserva está abaixo da meta" : null,
      foraDaOrdem ? "cripto no piso enquanto a carteira está fora da ordem" : null].filter(Boolean);
    const v = valida(d, f);
    return { ...(v.ok ? d : v.mais_proxima), motivo: motivo.length ? motivo : ["meio das faixas"] };
  }

  /** reserva dinâmica: renda PJ sem 13º/férias/FGTS sugere mais meses (não troca a meta sozinha) */
  function reservaSugerida(ganhos, prefs, mes) {
    const h = prefs.hierarquia || FC.PADRAO_HIERARQUIA;
    const atual = FC.objetivos ? FC.objetivos(prefs).meses_reserva : 6;
    const pj = FC.rendaMes && FC.rendaMes.temPjSemBeneficios(ganhos, mes);
    const sugerido = pj ? Math.max(atual, Number(h.meses_reserva_pj) || 12) : atual;
    return { meses_atual: atual, meses_sugerido: sugerido, aumentar: sugerido > atual,
      motivo: pj ? "renda PJ sem 13º, férias e FGTS: a reserva precisa cobrir mais meses" : null };
  }

  /** tudo junto para o resumo: ordem, sugestão, meses para corrigir, plano validado */
  function analisa(estado) {
    const d = estado.dados, prefs = estado.prefs, base = estado.base;
    const h = prefs.hierarquia || FC.PADRAO_HIERARQUIA, f = h.faixas;
    const porPilar = Object.fromEntries((d.alocacao || []).map((l) => [l.chave, l.valor]));
    const ordem = ordemDaCarteira(porPilar, f);
    const reservaAbaixo = !!(d.potes && d.potes.reserva && d.potes.reserva.abaixo_da_meta);
    const sugerida = divisaoSugerida({ reservaAbaixo, foraDaOrdem: !ordem.respeitada, faixas: f });
    const pp = FC.salario.paraProjecao(prefs.plano, base.ganhos || [], base);
    const aporte = pp ? pp.aporte_mensal : Number(prefs.premissas.aporte_mensal) || 0;
    const doPlano = divisaoDoPlano(prefs.plano, base);
    const plano = doPlano ? { divisao: doPlano, ...valida(doPlano, f) } : null;
    return {
      modo: h.modo_alocacao, faixas: f, ordem_respeitada: ordem.respeitada, carteira: ordem,
      divisao_sugerida_aporte: sugerida, aporte_mensal: aporte,
      meses_para_corrigir: mesesParaCorrigir(porPilar, aporte, doPlano && valida(doPlano, f).ok ? doPlano : sugerida, f),
      plano, reserva: reservaSugerida(base.ganhos || [], prefs, FC.datas.hoje().slice(0, 7)),
    };
  }

  FC.hierarquia = { grupos, violacoes, maisProxima, divisaoDoPlano, valida, ordemDaCarteira, mesesParaCorrigir, divisaoSugerida, reservaSugerida, analisa, NOME };
})();
