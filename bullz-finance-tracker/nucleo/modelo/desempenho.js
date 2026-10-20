/* Desempenho da carteira: uma nota de 0 a 100 do quanto os ativos renderam
 * contra a referência de cada um, no período (dia, mês, ano ou tudo).
 *
 * Renda variável (ações, FIIs, ETFs e cripto) contra o Ibovespa; renda fixa
 * (com o caixa de proventos) contra o CDI. O agro não rende enquanto o gado
 * está no pasto: entra só pelas vendas do período, cada ciclo vendido (venda
 * líquida contra o custo de entrada e os custos da atividade) contra o CDI
 * do mesmo prazo, com peso pelo valor vendido. Cada parte ganha
 * 50 + 50·tanh((retorno − referência) / escala): igual à referência = 50,
 * bem acima tende a 100, bem abaixo tende a 0. A nota geral é a média das
 * partes ponderada pelo valor médio de cada uma no período.
 *
 * FC.desempenho.calcula({ pontos, ciclos, ix, ibov, periodo, hoje }) —
 * `pontos` e `ciclos` vêm de FC.rentab.serieDiaria. */
(function () {
  const FC = (window.FC = window.FC || {});
  const D = () => FC.datas;

  const PARTES = [
    { chave: "rv", nome: "Renda variável", ref: "ibov", nome_ref: "Ibovespa" },
    { chave: "rf", nome: "Renda fixa", ref: "cdi", nome_ref: "CDI" },
    { chave: "agro", nome: "Agro (vendas)", ref: "cdi", nome_ref: "CDI", porVendas: true },
  ];
  const PERIODOS = { dia: "Dia", mes: "Mês", ano: "Ano", tudo: "Tudo" };
  const FAIXAS = [
    { chave: "abaixo", nome: "Abaixo", ate: 33, cor: "vermelho" },
    { chave: "no_ritmo", nome: "No ritmo", ate: 66, cor: "amarelo" },
    { chave: "acima", nome: "Acima", ate: 100, cor: "verde" },
  ];
  const faixaDe = (score) => FAIXAS.find((f) => score <= f.ate) || FAIXAS[2];

  function inicioDe(periodo, hoje, primeiro) {
    const d = periodo === "dia" ? D().soma(hoje, -1) : periodo === "mes" ? D().soma(hoje, -30)
      : periodo === "ano" ? D().soma(hoje, -365) : primeiro;
    return d < primeiro ? primeiro : d;
  }

  // a diferença (em pontos percentuais) que leva a nota de 50 a ~88
  function escala(dias) {
    if (dias <= 1) return 1;
    if (dias <= 30) return 1 + (2 * (dias - 1)) / 29;
    if (dias <= 365) return 3 + (7 * (dias - 30)) / 335;
    return 10; // além de um ano, a comparação é anualizada
  }
  const anualiza = (pct, dias) => (dias > 365 ? (Math.pow(1 + pct / 100, 365 / dias) - 1) * 100 : pct);
  const nota = (r, ref, dias) => {
    const a = anualiza(r, dias), b = anualiza(ref, dias);
    return 50 + 50 * Math.tanh((a - b) / escala(dias));
  };

  // fator da referência entre duas datas; null quando ela não andou nesse
  // trecho (fim de semana, feriado, série ainda não carregada)
  function fatorRef(ref, de, ate, ix, ibov) {
    if (!(de < ate)) return null;
    if (ref === "ibov") {
      if (!ibov || !ibov.length || de < ibov[0][0] || !ibov.some(([d]) => d > de && d <= ate)) return null;
      return FC.rentab.crescimentoIndice("ibov", de, ate, ix, ibov);
    }
    if (!ix || typeof ix.fator !== "function") return null;
    const f = ix.fator("cdi", 100, de, ate).f;
    return f === 1 ? null : f;
  }

  function vazio(periodo, de, ate, motivo) {
    return { suficiente: false, motivo, periodo, de, ate, score: 50, faixa: faixaDe(50), partes: [], tendencia: [] };
  }

  // as vendas de gado entre `de` (exclusive) e `ate`, como uma parte da nota
  function parteAgro(ciclos, de, ate, ix) {
    const vendidos = (ciclos || []).filter((c) => c.ate > de && c.ate <= ate && c.custo > 0);
    if (!vendidos.length || !ix || typeof ix.fator !== "function") return null;
    let custo = 0, venda = 0, refPond = 0, notaPond = 0, cabecas = 0;
    for (const c of vendidos) {
      const fr = ix.fator("cdi", 100, c.de, c.ate).f;
      const r = (c.venda / c.custo - 1) * 100, rr = (fr - 1) * 100;
      custo += c.custo; venda += c.venda; cabecas += c.cabecas || 0;
      refPond += c.custo * rr; notaPond += c.venda * nota(r, rr, Math.max(1, c.dias || D().dias(c.de, c.ate)));
    }
    if (!(venda > 0)) return null;
    const p = PARTES.find((x) => x.chave === "agro");
    return { chave: p.chave, nome: p.nome, ref: p.ref, nome_ref: p.nome_ref, retorno: (venda / custo - 1) * 100, retorno_ref: refPond / custo,
      nota: notaPond / venda, valor_medio: venda, vendas: vendidos.length, cabecas };
  }

  function calcula({ pontos, ciclos = [], ix, ibov, periodo = "mes", hoje = D().hoje() }) {
    if (!pontos || pontos.length < 2) return vazio(periodo, null, hoje, "sem histórico");
    const de = inicioDe(periodo, hoje, pontos[0].data);
    const trecho = pontos.filter((p) => p.data >= de && p.data <= hoje && p.partes);
    if (trecho.length < 2) return vazio(periodo, de, hoje, "sem dias suficientes no período");
    const dias = Math.max(1, D().dias(trecho[0].data, trecho.at(-1).data));

    // por parte, de uma vez: o retorno encadeado dia a dia (TWR) e o valor médio
    const acc = PARTES.filter((p) => !p.porVendas).map((p) => ({ ...p, f: 1, soma: 0, n: 0 }));
    const notaGeral = (ate) => {
      let somaPeso = 0, somaNota = 0;
      const partes = [];
      for (const a of acc) {
        const peso = a.n ? a.soma / a.n : 0;
        if (!(peso > 0.5)) continue;
        const fr = fatorRef(a.ref, trecho[0].data, ate, ix, ibov);
        if (fr == null) continue;
        const r = (a.f - 1) * 100, rr = (fr - 1) * 100, nt = nota(r, rr, Math.max(1, D().dias(trecho[0].data, ate)));
        somaPeso += peso; somaNota += peso * nt;
        partes.push({ chave: a.chave, nome: a.nome, ref: a.ref, nome_ref: a.nome_ref, retorno: r, retorno_ref: rr, nota: nt, valor_medio: peso });
      }
      const agro = parteAgro(ciclos, trecho[0].data, ate, ix);
      if (agro) { somaPeso += agro.valor_medio; somaNota += agro.valor_medio * agro.nota; partes.push(agro); }
      if (!somaPeso) return null;
      for (const p of partes) p.peso = p.valor_medio / somaPeso;
      return { score: somaNota / somaPeso, partes };
    };

    const tendencia = [];
    let ultimo = null;
    for (let i = 0; i < trecho.length; i++) {
      for (const a of acc) {
        const cur = trecho[i].partes[a.chave];
        if (i > 0) {
          const ant = trecho[i - 1].partes[a.chave];
          if (ant.valor > 1e-9) a.f *= (cur.valor - (cur.fluxo - ant.fluxo)) / ant.valor;
        }
        a.soma += cur.valor; a.n++;
      }
      if (i === 0) continue;
      const g = notaGeral(trecho[i].data);
      if (g) { ultimo = g; tendencia.push({ data: trecho[i].data, score: g.score }); }
    }
    if (!ultimo) return vazio(periodo, de, hoje, "a referência do período ainda não tem dados");
    // no "tudo", um ponto por semana (e sempre o último)
    const tend = periodo === "tudo" && tendencia.length > 120
      ? tendencia.filter((_, i) => i % 7 === 0 || i === tendencia.length - 1) : tendencia;
    const score = Math.max(0, Math.min(100, ultimo.score));
    return { suficiente: true, periodo, de: trecho[0].data, ate: trecho.at(-1).data, dias, score, faixa: faixaDe(score),
      partes: ultimo.partes.sort((a, b) => b.peso - a.peso), tendencia: tend };
  }

  FC.desempenho = { calcula, faixaDe, FAIXAS, PERIODOS, PARTES, escala };
})();
