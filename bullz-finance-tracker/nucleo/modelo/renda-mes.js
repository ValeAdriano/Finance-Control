/* Renda do mês, impostos, despesas e o plano "fixo + sobra" (Marco 5).
 *
 * Ganho PJ: categoria "pj", regime (mei, simples, outro), imposto fixo
 * mensal (DAS) ou percentual sobre o faturamento. Sem valor no ganho, o
 * imposto vem de parametros_fiscais (das_mei_servicos, simples_aliquota_inicial).
 * O `valor` do PJ é o faturamento bruto; o imposto sai à parte.
 *
 * Proporcional: ganho com `proporcional: true` paga pelos dias trabalhados
 * na competência (entre `inicio` e `data_fim_contrato`). Com
 * `pagamento_mes_seguinte`, o mês de competência é o anterior ao do
 * pagamento (o estágio de novembro cai em dezembro).
 *
 * Despesas: tabela `despesas`. O custo de vida é a média dos últimos 3
 * meses com despesa; sem dados, a premissa (objetivos.custo_vida_mensal).
 *
 * Plano fixo_mais_sobra: total a investir = renda − impostos − despesas;
 * o fixo é a parte combinada e a sobra é o resto (pode faltar para o fixo).
 *
 * Parcelamentos: um valor total dividido em N parcelas mensais, de um pote
 * para um destino. Executar a parcela é movimento interno, não aporte. */
(function () {
  const FC = window.FC;
  const ok = (v) => v != null && v !== "" && Number.isFinite(Number(v));
  const mesDe = (iso) => String(iso).slice(0, 7);
  const anterior = (m) => { const [a, n] = m.split("-").map(Number); return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, "0")}`; };
  const seguinte = (m) => { const [a, n] = m.split("-").map(Number); return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, "0")}`; };
  const r2 = (v) => Math.round(v * 100) / 100;

  FC.CATEGORIAS_GANHO = FC.CATEGORIAS_GANHO || {};
  FC.CATEGORIAS_GANHO.pj = "PJ (nota fiscal)";
  FC.REGIMES_PJ = { mei: "MEI", simples: "Simples Nacional", outro: "Outro" };

  // ---------------------------------------------------------------- ganho no mês
  // quantos dias da competência o contrato cobre (fração do mês)
  function fracaoDoMes(g, comp) {
    const ult = FC.datas.ultimoDiaDoMes(comp);
    const ini = `${comp}-01`, fim = `${comp}-${String(ult).padStart(2, "0")}`;
    const de = g.inicio > ini ? g.inicio : ini;
    const fimContrato = g.data_fim_contrato || null;
    const ate = fimContrato && fimContrato < fim ? fimContrato : fim;
    if (ate < de) return 0;
    return (Number(ate.slice(8, 10)) - Number(de.slice(8, 10)) + 1) / ult;
  }

  /** o que o ganho paga no mês de pagamento `mes` (0 se não paga) e o porquê */
  function valorNoMes(g, mes) {
    if (g.tipo === "avulso") return mesDe(g.inicio) === mes ? { valor: g.valor, comp: mes, fracao: 1 } : { valor: 0 };
    const desloca = !!g.pagamento_mes_seguinte;
    const comp = desloca ? anterior(mes) : mes;
    if (mesDe(g.inicio) > comp) return { valor: 0 };
    // fim dos pagamentos: o informado; senão, o mês do fim do contrato (+1 se paga no seguinte)
    const fimPag = g.data_ultimo_pagamento || g.fim || (g.data_fim_contrato ? (desloca ? seguinte(mesDe(g.data_fim_contrato)) + "-01" : g.data_fim_contrato) : null);
    if (fimPag && mesDe(fimPag) < mes) return { valor: 0 };
    if (g.data_fim_contrato && mesDe(g.data_fim_contrato) < comp) return { valor: 0 };
    if (!g.proporcional) return { valor: g.valor, comp, fracao: 1 };
    const fr = fracaoDoMes(g, comp);
    return { valor: r2(g.valor * fr), comp, fracao: fr,
      origem: fr < 1 ? `${FC.fmt ? FC.fmt.brlTexto(g.valor) : g.valor} × ${Math.round(fr * FC.datas.ultimoDiaDoMes(comp))}/${FC.datas.ultimoDiaDoMes(comp)} dias de ${comp}` : null };
  }

  // ---------------------------------------------------------------- impostos
  function impostoDoGanho(g, valorMes, parametros, mes) {
    if (g.categoria !== "pj" || !(valorMes > 0)) return null;
    const P = FC.lotes ? FC.lotes.parametro : () => null;
    if (ok(g.imposto_fixo_mensal)) return { valor: Number(g.imposto_fixo_mensal), origem: "imposto fixo do ganho" };
    if (ok(g.imposto_pct)) return { valor: (valorMes * Number(g.imposto_pct)) / 100, origem: `${g.imposto_pct}% do faturamento` };
    if (g.regime === "mei") {
      const p = P(parametros, "das_mei_servicos", `${mes}-01`);
      return p ? { valor: p.valor, origem: "DAS MEI (parametros_fiscais)", parametro: p } : { valor: null, motivo: "parâmetro das_mei_servicos ausente" };
    }
    if (g.regime === "simples") {
      const p = P(parametros, "simples_aliquota_inicial", `${mes}-01`);
      return p ? { valor: (valorMes * p.valor) / 100, origem: `Simples ${p.valor}% (parametros_fiscais)`, parametro: p } : { valor: null, motivo: "parâmetro simples_aliquota_inicial ausente" };
    }
    return null;
  }

  /** renda do mês com o valor de cada ganho (proporcional quando for o caso) e os impostos do PJ */
  function rendaDoMes(ganhos, mes, parametros = []) {
    const itens = [];
    for (const g of ganhos || []) {
      const v = valorNoMes(g, mes);
      if (!(v.valor > 0)) continue;
      const imp = impostoDoGanho(g, v.valor, parametros, mes);
      itens.push({ ...g, valor_mes: v.valor, competencia: v.comp, fracao: v.fracao, origem_valor: v.origem || null, imposto: imp });
    }
    const total = FC.soma(itens, (g) => g.valor_mes);
    const impostos = FC.soma(itens, (g) => (g.imposto && g.imposto.valor) || 0);
    return { mes, total, fixa: FC.soma(itens.filter((g) => g.tipo === "recorrente"), (g) => g.valor_mes),
      avulsa: FC.soma(itens.filter((g) => g.tipo === "avulso"), (g) => g.valor_mes), impostos, itens,
      impostos_sem_parametro: itens.filter((g) => g.imposto && g.imposto.valor == null).map((g) => g.nome) };
  }

  /** a renda com 13º, férias e FGTS ausentes (PJ): pede reserva maior (Marco 6) */
  function temPjSemBeneficios(ganhos, mes) {
    return (ganhos || []).some((g) => g.categoria === "pj" && g.sem_13_ferias_fgts !== false && valorNoMes(g, mes).valor > 0);
  }

  // ---------------------------------------------------------------- despesas
  function despesasDoMes(despesas, mes) {
    const itens = (despesas || []).filter((d) => d.recorrente
      ? mesDe(d.data) <= mes && (!d.fim || mesDe(d.fim) >= mes)
      : mesDe(d.data) === mes);
    return { mes, total: FC.soma(itens, (d) => Number(d.valor) || 0), itens };
  }
  /** custo de vida: média dos 3 meses anteriores com despesa; sem dados, a premissa */
  function custoDeVida(despesas, mes, premissa = null) {
    const meses = [];
    let m = anterior(mes);
    for (let i = 0; i < 24 && meses.length < 3; i++, m = anterior(m)) {
      const d = despesasDoMes(despesas, m);
      if (d.itens.length) meses.push(d);
    }
    if (!meses.length) return { valor: ok(premissa) ? Number(premissa) : null, origem: "premissa", meses: [] };
    return { valor: FC.soma(meses, (x) => x.total) / meses.length, origem: `média de ${meses.length} ${meses.length === 1 ? "mês" : "meses"} de despesas`, meses: meses.map((x) => x.mes) };
  }

  // ---------------------------------------------------------------- fixo + sobra
  /**
   * renda, impostos e despesas do mês → { total, fixo, sobra }.
   * total a investir = renda − impostos − despesas (nunca negativo).
   */
  function fixoMaisSobra({ renda, impostos, despesas, valorFixo }) {
    const disponivel = renda - impostos - despesas;
    const total = Math.max(0, disponivel);
    const fixo = Number(valorFixo) || 0;
    return { renda, impostos, despesas, valor_fixo: fixo, sobra: r2(disponivel - fixo), total: r2(total),
      fixo_coberto: Math.min(fixo, total), falta_para_o_fixo: r2(Math.max(0, fixo - total)) };
  }

  // ---------------------------------------------------------------- parcelamentos
  // parcelamento: { id, descricao, valor_total, n_parcelas, inicio (AAAA-MM), destino_tipo, destino_id, pote_id }
  // executadas: movimentos internos com parcelamento_id
  function parcelasDoMes(parcelamentos, movimentosInternos, mes) {
    const saida = [];
    for (const p of parcelamentos || []) {
      const n = Number(p.n_parcelas) || 0;
      if (!n) continue;
      const valor = r2(Number(p.valor_total) / n);
      let m = mesDe(p.inicio);
      for (let k = 1; k <= n; k++, m = seguinte(m)) {
        if (m > mes) break;
        const feitas = (movimentosInternos || []).filter((x) => x.parcelamento_id === p.id).length;
        if (k <= feitas) continue;
        saida.push({ parcelamento_id: p.id, descricao: p.descricao, parcela: k, de: n, mes: m, valor, atrasada: m < mes,
          destino_tipo: p.destino_tipo, destino_id: p.destino_id, pote_id: p.pote_id });
      }
    }
    return saida;
  }

  FC.rendaMes = { valorNoMes, fracaoDoMes, impostoDoGanho, rendaDoMes, temPjSemBeneficios, despesasDoMes, custoDeVida, fixoMaisSobra, parcelasDoMes, anterior, seguinte };
})();
