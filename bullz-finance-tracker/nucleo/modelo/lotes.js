/* Agro por lote (Marco 4): o fluxo real é "compra" e depois "venda ou troca".
 *
 * Lote: toda compra cria um lote (ou usa o lote informado). Venda, troca,
 * morte e saída baixam cabeças do lote, sem exigir que a categoria bata
 * (o garrote comprado sai boi). Sem lote informado, a baixa sai dos lotes
 * abertos mais antigos (PEPS). O resultado e a duração saem por lote.
 *
 * Troca (permuta): sai `cabecas_saida` do lote, com `valor_referencia_saida`
 * como receita (fecha o ciclo dessas cabeças com resultado), e abre um lote
 * novo com `cabecas_entrada` e custo = `valor_referencia_entrada`.
 *
 * Avaliação de um lote aberto: estimativa manual (valor_estimado_cabeca) >
 * arroba (só com usa_peso) > custo médio.
 *
 * Impostos rurais da venda: Funrural (alíquota de parametros_fiscais, retido
 * pelo comprador por padrão) e IR estimado (presunção de 20% da receita ×
 * alíquota, ou livro-caixa). Sem o parâmetro, o imposto volta null com o
 * motivo, nunca um número inventado. */
(function () {
  const FC = window.FC;
  const ok = (v) => v != null && v !== "" && Number.isFinite(Number(v));

  // ---------------------------------------------------------------- parâmetros fiscais
  // linhas {chave, valor, vigencia_inicio, vigencia_fim, fonte}; vale a que
  // cobre a data (a de início mais recente)
  function parametro(lista, chave, data) {
    const d = data || FC.datas.hoje();
    const vale = (lista || []).filter((p) => p.chave === chave && (!p.vigencia_inicio || p.vigencia_inicio <= d) && (!p.vigencia_fim || p.vigencia_fim >= d))
      .sort((a, b) => String(b.vigencia_inicio || "").localeCompare(String(a.vigencia_inicio || "")));
    return vale.length ? { chave, valor: Number(vale[0].valor), fonte: vale[0].fonte || null, vigencia_inicio: vale[0].vigencia_inicio || null } : null;
  }

  // ---------------------------------------------------------------- troca → venda + compra
  // Expande cada troca em uma venda reinvestida e uma compra com o valor de
  // referência, para o rebanho, o caixa e a rentabilidade do agro (que não
  // conhecem a troca) contarem certo. A venda fica toda no caixa do agro e a
  // compra a consome: troca não é aporte nem saque.
  function expandeTrocas(movs) {
    const saida = [];
    for (const m of movs || []) {
      if (m.tipo !== "troca") { saida.push(m); continue; }
      const vs = Number(m.valor_referencia_saida) || 0, ve = Number(m.valor_referencia_entrada) || 0;
      const base = { data: m.data, fazenda: m.fazenda, lote: m.lote, contraparte: m.contraparte, criado_em: m.criado_em, user_id: m.user_id,
        peso_medio_kg: null, preco_arroba: null, despesas: 0, observacao: m.observacao || "", origem_troca: m.id, movimento_interno_id: m.movimento_interno_id || null };
      saida.push({ ...base, id: m.id + ":saida", tipo: "venda", categoria: m.categoria, categoria_destino: null, cabecas: Number(m.cabecas_saida || m.cabecas),
        preco_cabeca: null, valor_total: vs, reinvestido: vs, lote_id: m.lote_id || null });
      saida.push({ ...base, id: m.id + ":entrada", tipo: "compra", categoria: m.categoria_destino || m.categoria, categoria_destino: null,
        cabecas: Number(m.cabecas_entrada), preco_cabeca: null, valor_total: ve, reinvestido: null, lote_id: m.lote_entrada_id || null, criado_em: (m.criado_em || "") + "~" });
    }
    return saida;
  }

  // ---------------------------------------------------------------- lotes
  const ORDEM = { compra: 0, troca: 1, nascimento: 2, entrada: 3, reclassificacao: 4, venda: 5, morte: 6, saida: 7 };

  /**
   * movs: agro_movimentos SEM expandir (com troca); custos: agro_custos;
   * linhas: agro_lotes (nome, estimativa, venda planejada, custos inclusos);
   * cfg: prefs.agro; ag: FC.agro.analisa (para a arroba por categoria).
   */
  function monta(movs, custos, linhas, cfg = {}, ag = null, hoje = FC.datas.hoje()) {
    const porId = new Map((linhas || []).map((l) => [l.id, l]));
    const porNome = new Map((linhas || []).filter((l) => l.nome).map((l) => [String(l.nome).toLowerCase(), l]));
    const lotes = new Map();
    const atribuicoes = {};       // id do movimento → chave do lote
    const suposicoes = [];
    const abre = (chave, m, extra = {}) => {
      if (!lotes.has(chave)) {
        const linha = porId.get(chave) || porNome.get(String(chave).toLowerCase()) || null;
        lotes.set(chave, { chave, id: linha ? linha.id : null, nome: (linha && linha.nome) || extra.nome || null, linha, aberto_em: m.data, fechado_em: null,
          cabecas_entrada: 0, cabecas: 0, custo_total: 0, custo_saido: 0, receita: 0, resultado_realizado: 0, saidas: [], categorias: {}, despesas_custos: 0 });
      }
      return lotes.get(chave);
    };
    const chaveDe = (m) => m.lote_id || (m.lote ? "nome:" + String(m.lote).toLowerCase() : null);
    const abertos = () => [...lotes.values()].filter((l) => l.cabecas > 0).sort((a, b) => a.aberto_em.localeCompare(b.aberto_em));
    const entra = (l, n, custo, cat) => { l.cabecas_entrada += n; l.cabecas += n; l.custo_total += custo; l.categorias[cat] = (l.categorias[cat] || 0) + n; };
    // baixa n cabeças: do lote dito ou dos mais antigos; devolve [{lote, n, custo}]
    const baixa = (m, n) => {
      const pedacos = [];
      const dito = chaveDe(m) && lotes.get(chaveDe(m));
      const fila = dito ? [dito, ...abertos().filter((l) => l !== dito)] : abertos();
      if (!dito) suposicoes.push(`${m.data} ${m.tipo} de ${n} sem lote: saiu dos lotes abertos mais antigos (PEPS).`);
      let falta = n;
      for (const l of fila) {
        if (falta <= 0) break;
        const usa = Math.min(l.cabecas, falta);
        if (usa <= 0) continue;
        const custoCab = l.cabecas > 0 ? (l.custo_total - l.custo_saido) / l.cabecas : 0;
        l.cabecas -= usa; l.custo_saido += custoCab * usa; falta -= usa;
        pedacos.push({ lote: l, n: usa, custo: custoCab * usa });
        if (l.cabecas <= 0) l.fechado_em = m.data;
      }
      return pedacos;
    };

    const ordenados = [...(movs || [])].sort((a, b) => a.data.localeCompare(b.data) || (ORDEM[a.tipo] ?? 9) - (ORDEM[b.tipo] ?? 9)
      || String(a.criado_em || "").localeCompare(String(b.criado_em || "")));
    for (const m of ordenados) {
      const n = Number(m.cabecas) || 0;
      if (m.tipo === "compra") {
        const chave = chaveDe(m) || "compra:" + m.id;
        const l = abre(chave, m, { nome: m.lote || null });
        if (l.cabecas <= 0 && l.cabecas_entrada > 0) { l.fechado_em = null; }
        entra(l, n, (Number(m.valor_total) || 0) + (Number(m.despesas) || 0), m.categoria);
        atribuicoes[m.id] = l.chave;
      } else if (m.tipo === "nascimento" || m.tipo === "entrada") {
        const dito = chaveDe(m) && lotes.get(chaveDe(m));
        const l = dito || abertos().slice(-1)[0] || abre("entrada:" + m.id, m);
        entra(l, n, m.tipo === "entrada" ? FC.agro.valorEntrada(m) || 0 : 0, m.categoria);
        atribuicoes[m.id] = l.chave;
      } else if (m.tipo === "venda" || m.tipo === "morte" || m.tipo === "saida") {
        const receita = m.tipo === "venda" ? Math.max(0, (Number(m.valor_total) || 0) - (Number(m.despesas) || 0)) : m.tipo === "saida" ? Number(m.valor_total) || 0 : 0;
        const ps = baixa(m, n);
        const tot = ps.reduce((s, p) => s + p.n, 0) || 1;
        for (const p of ps) {
          const r = receita * (p.n / tot);
          p.lote.receita += r;
          p.lote.resultado_realizado += r - p.custo;
          p.lote.saidas.push({ data: m.data, tipo: m.tipo, cabecas: p.n, receita: r, custo: p.custo, resultado: r - p.custo });
        }
        if (ps[0]) atribuicoes[m.id] = ps[0].lote.chave;
      } else if (m.tipo === "troca") {
        const ns = Number(m.cabecas_saida || m.cabecas) || 0;
        const vs = Number(m.valor_referencia_saida) || 0, ve = Number(m.valor_referencia_entrada) || 0;
        const ps = baixa(m, ns);
        const tot = ps.reduce((s, p) => s + p.n, 0) || 1;
        for (const p of ps) {
          const r = vs * (p.n / tot);
          p.lote.receita += r;
          p.lote.resultado_realizado += r - p.custo;
          p.lote.saidas.push({ data: m.data, tipo: "troca", cabecas: p.n, receita: r, custo: p.custo, resultado: r - p.custo });
        }
        if (ps[0]) atribuicoes[m.id] = ps[0].lote.chave;
        const novo = abre(m.lote_entrada_id || "troca:" + m.id, m, { nome: null });
        entra(novo, Number(m.cabecas_entrada) || 0, ve, m.categoria_destino || m.categoria);
        atribuicoes[m.id + ":entrada"] = novo.chave;
      }
    }

    // custos da operação: no lote dito; sem lote, ficam à parte
    let custosSemLote = 0;
    for (const c of custos || []) {
      const chave = c.lote_id || (c.lote ? "nome:" + String(c.lote).toLowerCase() : null);
      const l = chave && lotes.get(chave);
      if (l) { l.custo_total += Number(c.valor) || 0; l.despesas_custos += Number(c.valor) || 0; } else custosSemLote += Number(c.valor) || 0;
    }

    const usaPeso = cfg.usa_peso !== false && !!(ag && ag.usa_peso);
    const lista = [...lotes.values()].map((l) => {
      const linha = l.linha || {};
      const custoAberto = l.custo_total - l.custo_saido;
      const custoCab = l.cabecas > 0 ? custoAberto / l.cabecas : null;
      // categoria predominante (para a arroba)
      const cat = Object.entries(l.categorias).sort((a, b) => b[1] - a[1])[0];
      let valorCab = null, origem = null;
      if (l.cabecas > 0) {
        if (ok(linha.valor_estimado_cabeca)) { valorCab = Number(linha.valor_estimado_cabeca); origem = "estimativa"; }
        else if (usaPeso && cat && ag) {
          const c = (ag.porCategoria || []).find((x) => x.categoria === cat[0]);
          if (c && c.valor_cabeca > 0 && !c.pelo_custo) { valorCab = c.valor_cabeca; origem = "arroba"; }
        }
        if (valorCab == null) { valorCab = custoCab; origem = "custo"; }
      }
      const valor = l.cabecas > 0 ? valorCab * l.cabecas : 0;
      const fim = l.cabecas > 0 ? hoje : l.fechado_em || hoje;
      const custosZerados = l.despesas_custos <= 0 && l.cabecas_entrada > 0;
      return {
        chave: l.chave, id: l.id, nome: l.nome || (l.id ? null : `Lote de ${FC.datas.br ? FC.datas.br(l.aberto_em) : l.aberto_em}`),
        aberto: l.cabecas > 0, aberto_em: l.aberto_em, fechado_em: l.cabecas > 0 ? null : l.fechado_em, dias: FC.datas.dias(l.aberto_em, fim),
        cabecas_entrada: l.cabecas_entrada, cabecas: l.cabecas, custo_total: l.custo_total, custo_em_aberto: custoAberto, custo_medio_cabeca: custoCab,
        receita: l.receita, resultado_realizado: l.resultado_realizado,
        valor_estimado: valor, valor_estimado_cabeca: valorCab, origem_valor: origem, data_estimativa: linha.data_estimativa || null,
        resultado_total: l.resultado_realizado + valor - custoAberto, saidas: l.saidas,
        custos_inclusos_no_preco: !!linha.custos_inclusos_no_preco,
        // custo zerado só alerta quando os custos não estão no preço
        alerta_custos: custosZerados && !linha.custos_inclusos_no_preco && l.cabecas > 0,
        venda_planejada: linha.data_prevista ? { data_prevista: linha.data_prevista, cabecas: ok(linha.cabecas_previstas) ? Number(linha.cabecas_previstas) : l.cabecas,
          preco_esperado_cabeca: ok(linha.preco_esperado_cabeca) ? Number(linha.preco_esperado_cabeca) : null, destino_planejado: linha.destino_planejado || null } : null,
      };
    }).sort((a, b) => a.aberto_em.localeCompare(b.aberto_em));
    const vendas_planejadas = lista.filter((l) => l.venda_planejada && l.aberto).map((l) => ({ lote: l.nome, lote_id: l.id, ...l.venda_planejada,
      receita_esperada: l.venda_planejada.preco_esperado_cabeca != null ? l.venda_planejada.preco_esperado_cabeca * l.venda_planejada.cabecas : null }));
    return { lotes: lista, atribuicoes, suposicoes, custos_sem_lote: custosSemLote, vendas_planejadas };
  }

  // ---------------------------------------------------------------- impostos da venda
  /**
   * receita bruta da venda → Funrural, líquido e IR estimado.
   * opcoes: { parametros, data, funrural_retido (padrão true), ir_modo
   *           ("presuncao"|"livro_caixa"), ir_aliquota, despesas_livro_caixa }
   */
  function impostosVenda(receita, opcoes = {}) {
    const ps = opcoes.parametros || [];
    const dia = opcoes.data || FC.datas.hoje();
    const usados = [];
    const pFun = parametro(ps, "funrural_pf_aliquota", dia);
    const retido = opcoes.funrural_retido !== false;
    let funrural = null, motivo = null;
    if (pFun) { funrural = (receita * pFun.valor) / 100; usados.push(pFun); } else motivo = "parâmetro funrural_pf_aliquota ausente em parametros_fiscais";
    const liquido = receita - (retido && funrural != null ? funrural : 0);
    const modo = opcoes.ir_modo || "presuncao";
    const pAliq = opcoes.ir_aliquota != null ? { chave: "ir_aliquota (preferência)", valor: Number(opcoes.ir_aliquota) } : parametro(ps, "ir_rural_aliquota_padrao", dia);
    let ir = null, base = null;
    if (pAliq) {
      usados.push(pAliq);
      if (modo === "livro_caixa") base = Math.max(0, receita - (Number(opcoes.despesas_livro_caixa) || 0));
      else {
        const pPres = parametro(ps, "ir_rural_presuncao_pct", dia);
        if (pPres) { usados.push(pPres); base = (receita * pPres.valor) / 100; }
      }
      if (base != null) ir = (base * pAliq.valor) / 100;
    }
    if (ir == null && !motivo) motivo = "parâmetros de IR rural ausentes em parametros_fiscais";
    return { receita, funrural, funrural_retido: retido, liquido, ir_modo: modo, ir_base: base, ir_estimado: ir, estimativa: true,
      parametros_usados: usados, ...(motivo ? { motivo } : {}) };
  }

  FC.lotes = { monta, expandeTrocas, impostosVenda, parametro };
})();
