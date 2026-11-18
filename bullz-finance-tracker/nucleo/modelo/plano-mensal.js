/* Plano mensal com histórico e execução (Marco 8).
 *
 * Cada mês tem um plano salvo (planos_mensais): o previsto (renda, impostos,
 * despesas, modo, meta, destinos) congelado na ativação, e o realizado
 * apurado no fechamento. Mudar as preferências depois não mexe em mês
 * ativo ou fechado.
 *
 * Destinos: { tipo: categoria | ativo | titulo_rf | pote | parcela, alvo, pct, valor }.
 * Execução: cada aporte do mês (dinheiro novo; movimento interno não conta)
 * vai para um destino, nesta ordem: o informado no lançamento
 * (plano_mensal_id + destino_idx), o ativo ou título igual, a categoria do
 * ativo. O que não acha destino vai para fora_do_plano. Parcelas executadas
 * (movimento interno com parcelamento_id) cumprem o destino "parcela".
 *
 * aportado_total = o cumprido: a soma, por destino, do aportado até o
 * previsto (excesso num destino não cobre falta de outro). investido_total
 * é todo o dinheiro novo do mês. */
(function () {
  const FC = window.FC;
  const mesDe = (iso) => String(iso || "").slice(0, 7);
  const r2 = (v) => Math.round(v * 100) / 100;
  const GRUPO = { caixa: "rf", acoes: "acoes", real_estate: "acoes", alternativos: "cripto", agro: "agro" };
  const NOME_GRUPO = { rf: "renda fixa", acoes: "ações", cripto: "cripto" };
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const nomeMes = (m) => MESES[Number(m.slice(5, 7)) - 1];

  // ---------------------------------------------------------------- utilidades
  function grupoDoAporte(a, base) {
    if (a.tipo === "caixa") { const t = (base.rendaFixa || []).find((x) => x.nome === a.titulo); return GRUPO[(t && t.pilar) || "caixa"] || "rf"; }
    const at = (base.ativos || []).find((x) => x.ticker === a.ticker);
    return GRUPO[at ? at.pilar : "alternativos"] || "acoes";
  }
  function aportesDoMes(base, mes) {
    return (base.aportes || []).filter((a) => mesDe(a.data) === mes && !a.movimento_interno_id && Number(a.valor) > 0
      && (a.tipo === "ativo" || (a.tipo === "caixa" && !a.historico)));
  }
  const rotulo = (d) => d.tipo === "categoria" ? `${NOME_GRUPO[d.alvo] || d.alvo}` : d.tipo === "parcela" ? `parcela ${d.rotulo || ""}`.trim() : d.alvo;
  function divisaoPorGrupo(destinos) {
    const g = { rf: 0, acoes: 0, cripto: 0 };
    let base = 0;
    for (const d of destinos || []) {
      if (d.tipo === "parcela") continue;
      const v = Number(d.valor) || 0;
      const k = d.grupo || (d.tipo === "categoria" ? d.alvo : null);
      if (k && k in g) { g[k] += v; base += v; }
    }
    return base > 0 ? { rf: (g.rf / base) * 100, acoes: (g.acoes / base) * 100, cripto: (g.cripto / base) * 100 } : null;
  }
  // grupo de um destino (para validar a divisão e casar aportes)
  function grupoDoDestino(d, base) {
    if (d.tipo === "categoria") return d.alvo;
    if (d.tipo === "ativo") { const a = (base.ativos || []).find((x) => x.ticker === d.alvo); return GRUPO[a ? a.pilar : "alternativos"]; }
    if (d.tipo === "titulo_rf" || d.tipo === "pote") return "rf";
    return null;
  }
  const comGrupo = (destinos, base) => (destinos || []).map((d, idx) => ({ ...d, idx, grupo: d.grupo || grupoDoDestino(d, base), rotulo: d.rotulo || rotulo(d) }));

  // ---------------------------------------------------------------- execução
  function execucao(plano, estado) {
    const base = estado.base, mes = plano.mes;
    const destinos = comGrupo(plano.destinos, base);
    const exec = destinos.map((d) => ({ idx: d.idx, tipo: d.tipo, alvo: d.alvo, rotulo: d.rotulo, previsto: Number(d.valor) || 0, aportado: 0, aportes: [] }));
    const fora = [];
    for (const a of aportesDoMes(base, mes)) {
      let alvo = null;
      if (a.plano_mensal_id && a.plano_mensal_id === plano.id && a.destino_idx != null && exec[a.destino_idx]) alvo = exec[a.destino_idx];
      if (!alvo) alvo = exec.find((e) => (e.tipo === "ativo" && a.tipo === "ativo" && e.alvo === a.ticker) || (e.tipo === "titulo_rf" && a.tipo === "caixa" && e.alvo === a.titulo));
      if (!alvo) { const g = grupoDoAporte(a, base); alvo = exec.find((e) => e.tipo === "categoria" && e.alvo === g); }
      const item = { aporte_id: a.id, data: a.data, ticker: a.ticker || null, titulo: a.titulo || null, valor: Number(a.valor), grupo: grupoDoAporte(a, base),
        atribuicao: alvo ? (a.plano_mensal_id === plano.id && a.destino_idx != null ? "manual" : "automatica") : null };
      if (alvo) { alvo.aportado += item.valor; alvo.aportes.push(item); } else fora.push(item);
    }
    // parcelas executadas no mês
    for (const m of base.movimentosInternos || []) {
      if (!m.parcelamento_id || mesDe(m.data) !== mes) continue;
      const e = exec.find((x) => x.tipo === "parcela" && x.alvo === m.parcelamento_id);
      if (e) { e.aportado += Number(m.origem_quantidade) || 0; e.aportes.push({ movimento_interno_id: m.id, data: m.data, valor: Number(m.origem_quantidade) || 0, atribuicao: "parcela" }); }
    }
    for (const e of exec) { e.aportado = r2(e.aportado); e.desvio = r2(e.aportado - e.previsto); e.cumprido = r2(Math.min(e.aportado, e.previsto)); }
    const novo = exec.filter((e) => e.tipo !== "parcela");
    const aportadoTotal = r2(FC.soma(novo, (e) => e.cumprido));
    const investido = r2(FC.soma(novo, (e) => e.aportado) + FC.soma(fora, (x) => x.valor));
    const meta = Number(plano.meta_total) || 0;
    // a divisão executada respeitou a hierarquia?
    const g = { rf: 0, acoes: 0, cripto: 0 };
    for (const e of novo) for (const x of e.aportes) if (x.grupo in g) g[x.grupo] += x.valor;
    for (const x of fora) if (x.grupo in g) g[x.grupo] += x.valor;
    const totG = g.rf + g.acoes + g.cripto;
    const divExec = totG > 0 ? { rf: (g.rf / totG) * 100, acoes: (g.acoes / totG) * 100, cripto: (g.cripto / totG) * 100 } : null;
    const faixas = (plano.regras_snapshot && plano.regras_snapshot.faixas) || (estado.prefs && estado.prefs.hierarquia && estado.prefs.hierarquia.faixas);
    const hierarquia = divExec && FC.hierarquia ? FC.hierarquia.valida(divExec, faixas).ok : null;
    return { execucao: exec, fora_do_plano: fora, aportado_total: aportadoTotal, investido_total: investido,
      pct_executado: meta > 0 ? r2((aportadoTotal / meta) * 100) : null, fora_do_plano_total: r2(FC.soma(fora, (x) => x.valor)),
      divisao_executada: divExec, hierarquia_respeitada: hierarquia };
  }

  // ---------------------------------------------------------------- previsto
  function previsto(estado, mes, plano) {
    const base = estado.base, prefs = estado.prefs;
    const P = plano || prefs.plano;
    const renda = FC.salario.rendaDoMes(base.ganhos || [], mes, base.parametros);
    const premissa = FC.objetivos ? FC.objetivos(prefs).custo_vida_mensal : null;
    const custo = FC.rendaMes.custoDeVida(base.despesas || [], mes, premissa);
    const despesas = custo.valor || 0;
    let meta, sobra = null;
    if (P.modo === "fixo_mais_sobra") { const f = FC.rendaMes.fixoMaisSobra({ renda: renda.total, impostos: renda.impostos, despesas, valorFixo: P.valor_fixo }); meta = f.total; sobra = f.sobra; }
    else if (P.modo === "valor") meta = Number(P.valor) || 0;
    else meta = (renda.total * (Number(P.percentual) || 0)) / 100;
    return {
      renda_prevista: renda.itens.map((g) => ({ ganho_id: g.id || null, nome: g.nome, valor: r2(g.valor_mes),
        origem: g.origem_valor || (g.competencia && g.competencia !== mes ? `${g.nome} de ${nomeMes(g.competencia)}, pago em ${nomeMes(mes)}` : `${g.nome}`) })),
      renda_total: r2(renda.total), impostos_previstos: r2(renda.impostos), despesas_previstas: r2(despesas), despesas_origem: custo.origem,
      modo: P.modo, valor_fixo: Number(P.valor_fixo) || 0, sobra_prevista: sobra == null ? null : r2(sobra), meta_total: r2(meta),
    };
  }

  /** o melhor ativo de um grupo pela nota (sem cotação quebrada) */
  function sugestaoDoGrupo(dados, grupo) {
    const cands = (dados.ativos || []).filter((a) => a.na_carteira && !a.cotacao_quebrada && a.score != null && GRUPO[a.pilar] === grupo).sort((a, b) => b.score - a.score);
    return cands[0] ? cands[0].ticker : null;
  }

  /** gera o rascunho de um mês (não grava) */
  function gera(estado, mes) {
    const base = estado.base, prefs = estado.prefs, d = estado.dados;
    const pv = previsto(estado, mes);
    const h = FC.hierarquia ? FC.hierarquia.analisa(estado) : null;
    const destinosPlano = (prefs.plano && prefs.plano.destinos) || [];
    const usarHierarquia = !!(h && (prefs.hierarquia.modo_alocacao === "hierarquia" || !destinosPlano.length));
    let destinos;
    if (usarHierarquia) {
      const div = h.divisao_sugerida_aporte;
      destinos = ["rf", "acoes", "cripto"].map((g) => ({ tipo: "categoria", alvo: g, pct: div[g], valor: r2((pv.meta_total * div[g]) / 100), sugestao: g === "rf" ? null : sugestaoDoGrupo(d, g) }));
    } else {
      const soma = FC.soma(destinosPlano, (x) => Number(x.pct) || 0) || 1;
      destinos = destinosPlano.map((x) => {
        const pct = ((Number(x.pct) || 0) / soma) * 100;
        const tipo = x.tipo === "renda_fixa" ? "titulo_rf" : x.tipo === "pilar" ? "categoria" : "ativo";
        const alvo = x.tipo === "pilar" ? GRUPO[x.alvo] || "rf" : x.alvo;
        return { tipo, alvo, pct, valor: r2((pv.meta_total * pct) / 100) };
      });
    }
    const parcelas = FC.rendaMes.parcelasDoMes(base.parcelamentos || [], base.movimentosInternos || [], mes);
    for (const p of parcelas) destinos.push({ tipo: "parcela", alvo: p.parcelamento_id, pct: null, valor: p.valor, rotulo: `${p.parcela}/${p.de} ${p.descricao || ""}`.trim() });
    // o mês anterior, como contexto
    const ant = FC.rendaMes.anterior(mes);
    const anterior = (base.planosMensais || []).find((x) => x.mes === ant);
    const contexto = [];
    if (anterior && anterior.execucao) {
      for (const e of anterior.execucao) if (e.desvio < -0.5 && e.tipo !== "parcela") contexto.push(`em ${nomeMes(ant)}, ficou ${FC.fmt.brlTexto(-e.desvio)} sem aportar em ${e.rotulo}`);
      if ((anterior.fora_do_plano || []).length) contexto.push(`em ${nomeMes(ant)}, ${FC.fmt.brlTexto(FC.soma(anterior.fora_do_plano, (x) => x.valor))} foram fora do plano`);
    }
    const eventos = FC.projecaoMensal ? FC.projecaoMensal.eventosDoPeriodo(estado, [], true).filter((e) => mesDe(e.data) === mes)
      .map((e) => ({ data: e.data, tipo: e.tipo, descricao: e.descricao || null, valor: (e.parametros || {}).valor ?? null })) : [];
    return { mes, status: "rascunho", origem: "gerado", ...pv, destinos, regras_snapshot: null,
      contexto: { mes_anterior: contexto, eventos, divisao: usarHierarquia ? "hierarquia" : "plano do Salário",
        motivo_divisao: usarHierarquia ? h.divisao_sugerida_aporte.motivo : null } };
  }

  /** valida a divisão do rascunho pela hierarquia (só no modo hierarquia) */
  function validaDivisao(plano, estado) {
    const prefs = estado.prefs;
    if (!FC.hierarquia || !prefs.hierarquia || prefs.hierarquia.modo_alocacao !== "hierarquia") return { ok: true, aplica: false };
    const div = divisaoPorGrupo(comGrupo(plano.destinos, estado.base));
    if (!div) return { ok: true, aplica: true };
    return { ...FC.hierarquia.valida(div, prefs.hierarquia.faixas), divisao: div, aplica: true };
  }

  /** o retrato das regras no momento da ativação (imutável depois) */
  function snapshot(estado, validacao, aceitou) {
    const h = FC.hierarquia ? FC.hierarquia.analisa(estado) : null;
    const pts = estado.dados.potes;
    return { faixas: estado.prefs.hierarquia ? estado.prefs.hierarquia.faixas : null, modo_alocacao: estado.prefs.hierarquia ? estado.prefs.hierarquia.modo_alocacao : null,
      reserva: pts && pts.reserva ? { saldo: r2(pts.reserva.saldo), meta: pts.reserva.meta } : null,
      carteira_pct: h ? h.carteira.pct : null, ordem_respeitada: h ? h.ordem_respeitada : null,
      violacoes: validacao && validacao.violacoes ? validacao.violacoes.map((v) => v.texto) : [], aceitar_violacao: !!aceitou,
      plano_global: JSON.parse(JSON.stringify(estado.prefs.plano)), em: new Date().toISOString() };
  }

  /** o realizado do mês (para fechar) */
  function realizado(plano, estado) {
    const base = estado.base, mes = plano.mes;
    const renda = FC.salario.rendaDoMes(base.ganhos || [], mes, base.parametros);
    const desp = FC.rendaMes.despesasDoMes(base.despesas || [], mes);
    const despesas = desp.itens.length ? desp.total : Number(plano.despesas_previstas) || 0;
    const ex = execucao(plano, estado);
    const sobra = plano.modo === "fixo_mais_sobra" ? r2(renda.total - renda.impostos - despesas - (Number(plano.valor_fixo) || 0)) : null;
    return { renda_real: r2(renda.total), impostos_reais: r2(renda.impostos), despesas_reais: r2(despesas), sobra_real: sobra,
      aportado_total: ex.aportado_total, execucao: ex.execucao, fora_do_plano: ex.fora_do_plano };
  }

  /** reconstrói um mês passado (backfill) pelos ganhos e lançamentos do mês */
  function reconstroi(estado, mes) {
    const base = estado.base, prefs = estado.prefs;
    const pv = previsto(estado, mes);
    // despesas e renda do próprio mês, não a média
    const desp = FC.rendaMes.despesasDoMes(base.despesas || [], mes);
    if (desp.itens.length) pv.despesas_previstas = r2(desp.total);
    const meta = pv.meta_total;
    // o que entrou em cada ativo ou título
    const alvos = new Map();
    for (const a of aportesDoMes(base, mes)) {
      const tipo = a.tipo === "caixa" ? "titulo_rf" : "ativo", alvo = a.tipo === "caixa" ? a.titulo : a.ticker;
      const k = tipo + ":" + alvo;
      if (!alvos.has(k)) alvos.set(k, { tipo, alvo, grupo: grupoDoAporte(a, base), executado: 0 });
      alvos.get(k).executado += Number(a.valor);
    }
    // cada alvo casa com um destino do plano global (exato; senão o grupo)
    const dp = ((prefs.plano && prefs.plano.destinos) || []).map((x) => ({ ...x, grupo: GRUPO[FC.salario.pilarDoDestino(x, base)] || "rf" }));
    const soma = FC.soma(dp, (x) => Number(x.pct) || 0) || 1;
    const casa = (t) => dp.find((x) => (x.tipo === "ativo" && t.tipo === "ativo" && x.alvo === t.alvo) || (x.tipo === "renda_fixa" && t.tipo === "titulo_rf" && x.alvo === t.alvo))
      || dp.find((x) => x.tipo === "pilar" && x.grupo === t.grupo) || null;
    const grupos = new Map();
    for (const t of alvos.values()) { const x = casa(t); if (!x) continue; if (!grupos.has(x)) grupos.set(x, []); grupos.get(x).push(t); }
    const destinos = [];
    for (const [x, ts] of grupos) {
      const valorDest = (meta * (Number(x.pct) || 0)) / soma, tot = FC.soma(ts, (t) => t.executado);
      for (const t of ts) destinos.push({ tipo: t.tipo, alvo: t.alvo, pct: r2(((valorDest * (t.executado / tot)) / (meta || 1)) * 100), valor: r2(valorDest * (t.executado / tot)) });
    }
    const plano = { mes, status: "fechado", origem: "reconstruido", ...pv, destinos, regras_snapshot: { reconstruido: true, plano_global: JSON.parse(JSON.stringify(prefs.plano)) },
      contexto: { mes_anterior: [], eventos: [], divisao: "reconstruído dos lançamentos" } };
    return { ...plano, ...realizado(plano, estado), fechado_em: new Date().toISOString() };
  }

  /** indicadores de um plano (o salvo, ou recalculado se ainda aberto) */
  function indicadores(plano, estado) {
    const aberto = plano.status !== "fechado" || !plano.execucao;
    const ex = aberto ? execucao(plano, estado) : null;
    const exec = aberto ? ex.execucao : plano.execucao;
    const fora = aberto ? ex.fora_do_plano : plano.fora_do_plano || [];
    const novo = exec.filter((e) => e.tipo !== "parcela");
    const aportado = aberto ? ex.aportado_total : Number(plano.aportado_total) || 0;
    const meta = Number(plano.meta_total) || 0;
    let hier = aberto ? ex.hierarquia_respeitada : null;
    if (!aberto) {
      const g = { rf: 0, acoes: 0, cripto: 0 };
      for (const e of novo) for (const x of e.aportes || []) if (x.grupo in g) g[x.grupo] += x.valor;
      for (const x of fora) if (x.grupo in g) g[x.grupo] += x.valor;
      const t = g.rf + g.acoes + g.cripto;
      const faixas = (plano.regras_snapshot && plano.regras_snapshot.faixas) || null;
      hier = t > 0 && FC.hierarquia ? FC.hierarquia.valida({ rf: (g.rf / t) * 100, acoes: (g.acoes / t) * 100, cripto: (g.cripto / t) * 100 }, faixas || undefined).ok : null;
    }
    return { mes: plano.mes, status: plano.status, meta, aportado, pct_executado: meta > 0 ? r2((aportado / meta) * 100) : null,
      fora_do_plano: r2(FC.soma(fora, (x) => x.valor)), sobra_real: plano.sobra_real ?? null, sobra_prevista: plano.sobra_prevista ?? null,
      renda_real: plano.renda_real ?? null, renda_prevista: FC.soma(plano.renda_prevista || [], (x) => x.valor), hierarquia_respeitada: hier,
      execucao: exec, fora: fora, cem_por_cento: meta > 0 && aportado >= meta - 0.5 };
  }

  // ---------------------------------------------------------------- banco
  // as colunas de planos_mensais (migration 0008). O que o cálculo devolve a
  // mais (renda_total, despesas_origem) vai para `contexto`, que é jsonb.
  const COLUNAS = ["id", "mes", "status", "renda_prevista", "impostos_previstos", "despesas_previstas", "modo", "valor_fixo", "sobra_prevista", "meta_total",
    "destinos", "regras_snapshot", "contexto", "renda_real", "impostos_reais", "despesas_reais", "sobra_real", "aportado_total", "execucao", "fora_do_plano",
    "origem", "observacao", "ativado_em", "fechado_em"];
  function paraBanco(plano) {
    const linha = {};
    for (const k of COLUNAS) if (plano[k] !== undefined) linha[k] = plano[k];
    const extra = {};
    if (plano.renda_total !== undefined) extra.renda_total = plano.renda_total;
    if (plano.despesas_origem !== undefined) extra.despesas_origem = plano.despesas_origem;
    if (Object.keys(extra).length) linha.contexto = { ...(plano.contexto || {}), ...extra };
    return linha;
  }

  FC.planoMensal = { paraBanco, COLUNAS, gera, previsto, execucao, validaDivisao, snapshot, realizado, reconstroi, indicadores, divisaoPorGrupo, comGrupo, aportesDoMes, nomeMes };
})();
