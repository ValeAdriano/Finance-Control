/* Apuração estimada de IR com parâmetros fiscais configuráveis (Marco 10).
 *
 * Tudo o que muda com a lei sai de parametros_fiscais, pela vigência da data
 * da operação (FC.lotes.parametro). Trocar um parâmetro muda o cálculo sem
 * mexer no código. Chaves usadas:
 *   ir_acoes_isencao_vendas_mes   vendas de ações no mês até este valor: ganho isento
 *   ir_acoes_aliquota             ações e ETF, operação comum
 *   ir_etf_aliquota               ETF (sem isenção)
 *   ir_daytrade_aliquota          day trade (compra e venda no mesmo dia)
 *   ir_fii_aliquota               FII (sem isenção)
 *   ir_cripto_isencao_vendas_mes  vendas de cripto no mês até este valor: isento
 *   ir_cripto_aliquota            cripto acima da isenção
 *   darf_valor_minimo             DARF abaixo disso acumula para o mês seguinte
 *   darf_codigo_renda_variavel    código do DARF de bolsa
 *   darf_codigo_cripto            código do DARF de cripto
 * Sem a tabela no banco (migration não aplicada), valem os valores que o
 * app já usava (FC.impostos) e a resposta diz `parametros_embutidos: true`.
 *
 * Método: custo pelo preço médio (o da Receita). Prejuízo compensa ganho da
 * mesma natureza nos meses seguintes: comum (ações + ETF), day trade, FII.
 * Exterior (Lei 14.754/2023) é anual e fica fora do DARF mensal.
 * Tudo sai marcado como estimativa, com a lista dos parâmetros usados. */
(function () {
  const FC = window.FC;
  const r2 = (v) => Math.round(v * 100) / 100;
  const mesDe = (d) => String(d).slice(0, 7);
  const seguinte = (m) => { const [a, n] = m.split("-").map(Number); return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, "0")}`; };

  // o que o app usava antes da tabela (só quando ela não existe no banco)
  function embutidos() {
    const I = FC.impostos || {};
    return {
      ir_acoes_isencao_vendas_mes: I.ISENCAO_ACOES ?? 20000, ir_acoes_aliquota: 15, ir_etf_aliquota: 15, ir_daytrade_aliquota: 20, ir_fii_aliquota: 20,
      ir_cripto_isencao_vendas_mes: I.ISENCAO_CRIPTO ?? 35000, ir_cripto_aliquota: 15, darf_valor_minimo: 10, darf_codigo_renda_variavel: 6015, darf_codigo_cripto: 4600,
    };
  }

  /** leitor de parâmetros: do banco pela vigência; sem tabela, os embutidos */
  function leitor(parametros, temTabela) {
    const usados = new Map();
    const emb = embutidos();
    const doBanco = temTabela && (parametros || []).some((p) => /^(ir_|darf_)/.test(p.chave));
    function v(chave, data) {
      if (doBanco) {
        const p = FC.lotes.parametro(parametros, chave, data);
        if (p) { usados.set(chave + "@" + (p.vigencia_inicio || ""), p); return p.valor; }
        usados.set(chave + "@ausente", { chave, valor: null, fonte: "ausente em parametros_fiscais" });
        return null;
      }
      usados.set(chave, { chave, valor: emb[chave], fonte: "valor embutido (parametros_fiscais ausente)" });
      return emb[chave];
    }
    return { v, usados: () => [...usados.values()], embutidos: !doBanco };
  }

  const GRUPO = { acao_br: "acoes", etf_br: "etf", fii: "fii", cripto: "cripto", acao_us: "exterior", etf_us: "exterior" };

  /** operações de venda com o ganho pelo preço médio e a natureza (comum ou day trade) */
  function vendas(base) {
    const classe = Object.fromEntries((base.ativos || []).map((a) => [a.ticker, a.classe]));
    const porTicker = {};
    for (const a of base.aportes || []) if (a.tipo === "ativo" && a.ticker && a.data) (porTicker[a.ticker] = porTicker[a.ticker] || []).push(a);
    const saida = [];
    for (const [tk, lista] of Object.entries(porTicker)) {
      const item = (base.ativos || []).find((x) => x.ticker === tk);
      let q = 0, custo = 0;
      if (item && Number(item.quantidade) > 0 && !lista.some((x) => x.origem)) { q = Number(item.quantidade); custo = q * (Number(item.preco_medio) || 0); }
      const ord = lista.slice().sort((a, b) => a.data.localeCompare(b.data) || (Number(a.quantidade) < 0) - (Number(b.quantidade) < 0));
      for (const a of ord) {
        const n = Number(a.quantidade) || 0;
        const preco = FC.carteira.precoDoLancamento(a);
        if (n > 0) { q += n; custo += n * (preco || 0); continue; }
        const venda = -n;
        if (!(venda > 0)) continue;
        // day trade: compra do mesmo ativo no mesmo dia
        const compraDia = ord.filter((x) => x.data === a.data && Number(x.quantidade) > 0);
        const qDT = Math.min(venda, compraDia.reduce((s, x) => s + Number(x.quantidade), 0));
        const pmDia = qDT > 0 ? compraDia.reduce((s, x) => s + Number(x.quantidade) * (FC.carteira.precoDoLancamento(x) || 0), 0) / compraDia.reduce((s, x) => s + Number(x.quantidade), 0) : 0;
        const pm = q > 0 ? custo / q : 0;
        const pv = preco || Math.abs(Number(a.valor)) / venda;
        const g = GRUPO[classe[tk]] || "acoes";
        if (qDT > 0) saida.push({ data: a.data, mes: mesDe(a.data), ticker: tk, grupo: g, natureza: "daytrade", quantidade: qDT, valor_venda: qDT * pv, custo: qDT * pmDia, ganho: qDT * (pv - pmDia) });
        const qc = venda - qDT;
        if (qc > 0) saida.push({ data: a.data, mes: mesDe(a.data), ticker: tk, grupo: g, natureza: "comum", quantidade: qc, valor_venda: qc * pv, custo: qc * pm, ganho: qc * (pv - pm), sem_custo: !(pm > 0) });
        // a baixa sai pelo preço médio (o day trade já casou com a compra do dia)
        q -= venda; custo -= (qc * pm + qDT * pmDia);
        if (q <= 1e-12) { q = 0; custo = 0; }
      }
    }
    return saida.sort((a, b) => a.data.localeCompare(b.data));
  }

  /**
   * apuração mês a mês de um ano (ou até `ate`), com compensação de prejuízo
   * e DARF. Devolve { meses, darfs, prejuizos, parametros_usados, estimativa }.
   */
  function apura(base, { ano, temTabela = true } = {}) {
    const P = leitor(base.parametros, temTabela);
    const todas = vendas(base);
    const anoN = Number(ano) || Number(FC.datas.hoje().slice(0, 4));
    const ini = todas.length ? todas[0].mes : `${anoN}-01`;
    const fim = `${anoN}-12`;
    const prej = { comum: 0, daytrade: 0, fii: 0 };
    let acumulado = { renda_variavel: 0, cripto: 0 };
    const meses = [], darfs = [];
    for (let m = ini; m <= fim; m = seguinte(m)) {
      const dia = `${m}-15`;
      const vs = todas.filter((v) => v.mes === m);
      const soma = (f) => vs.filter(f).reduce((s, v) => s + v.ganho, 0);
      const vendido = (g) => vs.filter((v) => v.grupo === g).reduce((s, v) => s + v.valor_venda, 0);
      const isAcoes = P.v("ir_acoes_isencao_vendas_mes", dia), isCripto = P.v("ir_cripto_isencao_vendas_mes", dia);
      const vendAcoes = vendido("acoes"), vendCripto = vendido("cripto");
      const acoesIsentas = isAcoes != null && vendAcoes <= isAcoes;
      const criptoIsenta = isCripto != null && vendCripto <= isCripto;
      const gAcoes = soma((v) => v.grupo === "acoes" && v.natureza === "comum");
      const gEtf = soma((v) => v.grupo === "etf" && v.natureza === "comum");
      const gDT = soma((v) => v.natureza === "daytrade" && v.grupo !== "cripto");
      const gFii = soma((v) => v.grupo === "fii" && v.natureza === "comum");
      const gCripto = soma((v) => v.grupo === "cripto");
      // ações isentas: o ganho não entra, a perda entra na compensação
      let comum = gEtf + (acoesIsentas ? Math.min(0, gAcoes) : gAcoes);
      const base1 = (valor, chave) => {
        const b = valor + prej[chave];       // prej é ≤ 0
        if (b < 0) { prej[chave] = b; return 0; }
        prej[chave] = 0; return b;
      };
      const tComum = base1(comum, "comum"), tDT = base1(gDT, "daytrade"), tFii = base1(gFii, "fii");
      const aqAcoes = P.v("ir_acoes_aliquota", dia), aqEtf = P.v("ir_etf_aliquota", dia), aqDT = P.v("ir_daytrade_aliquota", dia), aqFii = P.v("ir_fii_aliquota", dia), aqCripto = P.v("ir_cripto_aliquota", dia);
      // ações e ETF dividem a base comum; a alíquota é a das ações (iguais na lei atual)
      const ir = (b, a) => (a == null ? null : (b * a) / 100);
      const irComum = ir(tComum, gEtf && !gAcoes ? aqEtf : aqAcoes), irDT = ir(tDT, aqDT), irFii = ir(tFii, aqFii);
      const irCripto = criptoIsenta || gCripto <= 0 ? 0 : ir(gCripto, aqCripto);
      const faltou = [irComum, irDT, irFii, irCripto].some((x) => x == null);
      const rv = (irComum || 0) + (irDT || 0) + (irFii || 0) + acumulado.renda_variavel;
      const cr = (irCripto || 0) + acumulado.cripto;
      const minimo = P.v("darf_valor_minimo", dia) || 0;
      const venc = FC.datas.ultimoDiaUtil ? FC.datas.ultimoDiaUtil(seguinte(m)) : `${seguinte(m)}-28`;
      const gera = (valor, codigoChave, tipo) => {
        if (!(valor > 0)) return 0;
        if (valor < minimo) return valor;            // acumula
        darfs.push({ mes: m, tipo, codigo: P.v(codigoChave, dia), valor: r2(valor), vencimento: venc, estimativa: true });
        return 0;
      };
      acumulado = { renda_variavel: gera(rv, "darf_codigo_renda_variavel", "renda_variavel"), cripto: gera(cr, "darf_codigo_cripto", "cripto") };
      if (vs.length || rv > 0 || cr > 0) {
        meses.push({ mes: m, vendas: vs.map((v) => ({ ...v, valor_venda: r2(v.valor_venda), custo: r2(v.custo), ganho: r2(v.ganho) })),
          vendido_acoes: r2(vendAcoes), acoes_isentas: acoesIsentas, vendido_cripto: r2(vendCripto), cripto_isenta: criptoIsenta,
          ganho: { acoes: r2(gAcoes), etf: r2(gEtf), daytrade: r2(gDT), fii: r2(gFii), cripto: r2(gCripto) },
          ir: { comum: r2(irComum || 0), daytrade: r2(irDT || 0), fii: r2(irFii || 0), cripto: r2(irCripto || 0) },
          prejuizo_a_compensar: { comum: r2(-prej.comum), daytrade: r2(-prej.daytrade), fii: r2(-prej.fii) },
          acumulado_para_o_mes_seguinte: { renda_variavel: r2(acumulado.renda_variavel), cripto: r2(acumulado.cripto) },
          ...(faltou ? { motivo: "parâmetro ausente: parte do imposto não foi calculada" } : {}) });
      }
    }
    const doAno = (x) => x.mes.startsWith(String(anoN));
    return { ano: anoN, meses: meses.filter(doAno), darfs: darfs.filter(doAno), prejuizos: { comum: r2(-prej.comum), daytrade: r2(-prej.daytrade), fii: r2(-prej.fii) },
      exterior: todas.filter((v) => v.grupo === "exterior" && v.mes.startsWith(String(anoN))).map((v) => ({ ...v, ganho: r2(v.ganho) })),
      estimativa: true, parametros_embutidos: P.embutidos, parametros_usados: P.usados() };
  }

  /** IR rural do ano: as vendas do agro consolidadas (presunção ou livro-caixa) */
  function rural(base, prefs, ano) {
    const a = String(ano);
    const movs = ((base.agro && (base.agro.movsBrutos || base.agro.movs)) || []);
    const vendasAno = movs.filter((m) => m.tipo === "venda" && String(m.data).startsWith(a));
    const receita = vendasAno.reduce((s, m) => s + (Number(m.valor_total) || 0), 0);
    const despesas = ((base.agro && base.agro.custos) || []).filter((c) => String(c.data).startsWith(a)).reduce((s, c) => s + (Number(c.valor) || 0), 0)
      + movs.filter((m) => m.tipo === "compra" && String(m.data).startsWith(a)).reduce((s, m) => s + (Number(m.valor_total) || 0) + (Number(m.despesas) || 0), 0);
    const ag = (prefs && prefs.agro) || {};
    const imp = FC.lotes.impostosVenda(receita, { parametros: base.parametros || [], data: `${a}-12-31`, ir_modo: ag.ir_modo, ir_aliquota: ag.ir_aliquota, despesas_livro_caixa: despesas });
    return { ano: Number(ano), vendas: vendasAno.length, receita_bruta: r2(receita), despesas_do_ano: r2(despesas), resultado_livro_caixa: r2(receita - despesas),
      ir_modo: imp.ir_modo, base_ir: imp.ir_base == null ? null : r2(imp.ir_base), ir_estimado: imp.ir_estimado == null ? null : r2(imp.ir_estimado),
      funrural: imp.funrural == null ? null : r2(imp.funrural), estimativa: true, parametros_usados: imp.parametros_usados, ...(imp.motivo ? { motivo: imp.motivo } : {}) };
  }

  /** relatório anual para a declaração: bens em 31/12, rendimentos, renda variável e rural */
  function relatorio(estado, ano, opcoes = {}) {
    const base = estado.base, dados = estado.dados, prefs = estado.prefs;
    let dirpf = null;
    try { dirpf = FC.impostos.irpf(base, dados, ano, opcoes); } catch (e) { console.error(e); }
    const rv = apura(base, { ano, temTabela: opcoes.temTabela !== false });
    return { ano: Number(ano), estimativa: true, bens_e_direitos: dirpf ? dirpf.bens : [], rendimentos: dirpf ? dirpf.rendimentos : null,
      renda_variavel: rv, rural: rural(base, prefs, ano), avisos: dirpf ? dirpf.avisos || [] : [],
      parametros_usados: rv.parametros_usados, parametros_embutidos: rv.parametros_embutidos };
  }

  FC.ir = { vendas, apura, rural, relatorio, embutidos };
})();
