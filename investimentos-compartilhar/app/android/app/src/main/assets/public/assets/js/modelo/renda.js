/* Análise de renda: lucro recorrente, payout, preço justo pelo DY e
 * dívida. O "preço justo" é só o preço em que o dividendo de hoje
 * renderia o DY alvo — uma conta de três linhas, não um valuation. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  // DL/EBITDA pelos múltiplos: EV/EBIT − P/EBIT = DL/EBIT
  function dividaSobreEbitda(d) {
    const { p_ebit, ev_ebit, ev_ebitda } = d;
    if (![p_ebit, ev_ebit, ev_ebitda].every(ok) || !ev_ebit) return null;
    return (ev_ebit - p_ebit) * (ev_ebitda / ev_ebit);
  }

  const MIN_PARA_MEDIANA = 5;
  const PLAUSIVEL = { dy: [0, 40], payout: [0, 300], lucro_preco: [0, 60], dl_ebitda: [-5, 15], pvp: [0, 15], roe: [-100, 100] };

  // só quem negocia vota na mediana: preço parado contamina tudo
  function medianasDoSetor(linhas) {
    const validas = linhas.filter((l) => !l.ausente && l.liquido);
    const fora = {};
    for (const [campo, [piso, teto]] of Object.entries(PLAUSIVEL)) {
      const usaveis = validas.map((l) => l[campo]).filter((v) => ok(v) && v >= piso && v <= teto);
      fora[campo] = FC.mediana(usaveis);
      fora["n_" + campo] = usaveis.length;
    }
    return fora;
  }

  function analisa(acoes, cfg, criterios) {
    const payoutMax = Number(criterios.payout_maximo) || 100;
    const dlMax = Number(criterios.dl_ebitda_maximo) || 3;
    const liqMin = (Number(criterios.liquidez_minima) || 0) * 1e6;
    const dyFixo = Number(criterios.dy_desejado) || 6;
    const porSetor = (criterios.alvo || "setor") === "setor";

    const linhas = [];
    for (const [setor, bloco] of Object.entries(cfg.setores || {})) {
      const semEbitda = !!bloco.sem_ebitda;
      for (const [ticker, nome] of Object.entries(bloco.empresas || {})) {
        const d = acoes[ticker];
        if (!d) { linhas.push({ ticker, nome, setor, ausente: true }); continue; }
        const pl = d.pl || 0, dy = d.dy || 0, cot = d.cotacao || 0, liq = d.liquidez || 0;
        linhas.push({
          ticker, nome, setor, ausente: false, cotacao: cot, variacao_dia: d.variacao_dia,
          lucro_preco: pl > 0 ? 100 / pl : null,
          payout: pl > 0 && dy ? dy * pl : null,
          dividendo: cot && dy ? (cot * dy) / 100 : null,
          dl_ebitda: semEbitda ? null : dividaSobreEbitda(d),
          sem_ebitda: semEbitda, dy: dy || null, pl: pl || null, pvp: d.pvp, roe: d.roe,
          liquidez: liq, liquido: liq >= liqMin,
        });
      }
    }
    const setores = {};
    for (const l of linhas) (setores[l.setor] = setores[l.setor] || []).push(l);
    const medianas = Object.fromEntries(Object.entries(setores).map(([s, ls]) => [s, medianasDoSetor(ls)]));

    for (const l of linhas) {
      if (l.ausente) continue;
      const med = medianas[l.setor] || {};
      const alvo = (porSetor ? med.dy : dyFixo) || dyFixo;
      l.dy_alvo = alvo;
      l.mediana_setor = med;
      l.dy_vs_setor = l.dy && med.dy ? l.dy - med.dy : null;
      l.payout_vs_setor = l.payout != null && med.payout != null ? l.payout - med.payout : null;
      const justo = l.dividendo ? (l.dividendo / alvo) * 100 : null;
      l.preco_justo = justo;
      l.desconto = justo && l.cotacao ? (justo / l.cotacao - 1) * 100 : null;
      l.testes = {
        payout: l.payout == null ? null : l.payout <= payoutMax,
        preco: justo == null ? null : l.cotacao <= justo,
        divida: l.sem_ebitda || l.dl_ebitda == null ? null : l.dl_ebitda <= dlMax,
        liquidez: l.liquido,
        lucrativa: !!(l.pl && l.pl > 0),
      };
      const aplic = Object.values(l.testes).filter((v) => v != null);
      l.passa = aplic.length ? aplic.every(Boolean) : false;
      l.n_reprovados = Object.values(l.testes).filter((v) => v === false).length;
    }
    // DY crescente: o que aparece no fim, muito acima dos outros, é o que
    // costuma merecer desconfiança
    const comDy = linhas.filter((l) => l.dy).sort((a, b) => a.dy - b.dy);
    return comDy.concat(linhas.filter((l) => !l.dy));
  }

  function agrupaPorSetor(linhas, cfg) {
    const por = {};
    for (const l of linhas) (por[l.setor] = por[l.setor] || []).push(l);
    return Object.keys(cfg.setores || {}).filter((s) => por[s]).map((s) => {
      const ls = por[s];
      const validas = ls.filter((l) => !l.ausente);
      const med = medianasDoSetor(ls);
      return {
        setor: s, linhas: ls, medianas: med, sem_ebitda: !!(cfg.setores[s] || {}).sem_ebitda,
        total: validas.length, aprovadas: validas.filter((l) => l.passa).length,
        tenho: validas.filter((l) => l.tenho).length,
        mediana_fina: (med.n_dy || 0) < MIN_PARA_MEDIANA, n_dy: med.n_dy || 0,
      };
    });
  }

  // ---------------------------------------------------------------- retorno
  function normaliza(serie) {
    if (!serie.length || !serie[0][1]) return [];
    const b = serie[0][1];
    return serie.map(([d, v]) => [d, (v / b) * 100]);
  }
  function retornoDaAcao(h, reinvestir) {
    const p = h.precos || [];
    if (p.length < 2) return [];
    if (!reinvestir) return normaliza(p);
    const divs = Object.fromEntries(h.dividendos || []);
    let cotas = 1;
    return normaliza(p.map(([d, preco]) => {
      const v = divs[d];
      if (v && preco) cotas += (cotas * v) / preco;
      return [d, cotas * preco];
    }));
  }
  function compara(h, cdiDiario, ibov) {
    const soPreco = retornoDaAcao(h, false);
    const comDiv = retornoDaAcao(h, true);
    if (!soPreco.length) return {};
    const inicio = soPreco[0][0];
    const fora = { so_preco: soPreco, com_dividendos: comDiv };
    if (cdiDiario && cdiDiario.length) {
      let acum = 100;
      fora.cdi = cdiDiario.filter(([d]) => d >= inicio).map(([d, t]) => { acum *= 1 + t / 100; return [d, acum]; });
    }
    if (ibov && ibov.length) fora.ibov = normaliza(ibov.filter(([d]) => d >= inicio));
    fora.resumo = {};
    for (const [k, s] of Object.entries(fora)) if (Array.isArray(s) && s.length) fora.resumo[k] = s.at(-1)[1] - 100;
    fora.anos = FC.datas.dias(inicio, soPreco.at(-1)[0]) / 365.25;
    return fora;
  }

  FC.renda = { analisa, agrupaPorSetor, compara,
    resumo(linhas) {
      const v = linhas.filter((l) => !l.ausente);
      const ap = v.filter((l) => l.passa);
      return { total: v.length, aprovados: ap.length, ausentes: linhas.length - v.length };
    } };
})();
