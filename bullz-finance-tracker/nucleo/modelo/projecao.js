/* Projeção mês a mês, em moeda de hoje.
 *
 * 1. Tudo em termos reais: R$ 1 milhão em 2046 não é R$ 1 milhão.
 * 2. O que é contratado (renda fixa até o vencimento) separado do que é premissa.
 * 3. Proventos vêm do DY observado, não de chute — somar um retorno
 *    total "esperado" ao dividendo contaria o dinheiro duas vezes.
 * 4. Risco vem da volatilidade dos seus ativos (misturada a uma referência
 *    de mercado quando a série é curta) e vira um leque: 500 caminhos
 *    mensais com sorteio fixo, então o mesmo dado dá sempre o mesmo número.
 * 5. O juro de hoje não dura 20 anos: CDI e IPCA saem do valor atual e
 *    convergem para o longo prazo (padrão no caminho do Focus/BCB).
 *
 * Valorização real de cada pilar (sem proventos), quando você não digita:
 *   médio  — referência de longo prazo do mercado para a classe
 *   real   — o que os seus ativos do pilar renderam de fato (TIR real menos
 *            o DY), pesando mais quanto mais anos de histórico
 *   atual  — o que o preço de hoje embute ("building blocks"): juro real
 *            médio do horizonte + prêmio de risco da classe − DY atual.
 *            DY alto hoje (preço baixo) deixa menos para a valorização
 *   valorização = (0,4·médio + 0,4·atual + 0,2·c·real) / (0,8 + 0,2·c),
 *   c = min(1, anos de histórico / 5)
 *
 * A valorização é a mediana (retorno geométrico) de cada pilar.
 * Os sorteios são lognormais em torno dela, então a média fica acima e a
 * mediana bate com a conta determinística. */
(function () {
  const FC = window.FC;
  const MESES = 12;
  const real = (nom, ipca) => ((1 + nom / 100) / (1 + ipca / 100) - 1) * 100;
  const nominal = (re, ipca) => ((1 + re / 100) * (1 + ipca / 100) - 1) * 100;
  const mensal = (a) => Math.pow(1 + a / 100, 1 / MESES) - 1;

  // Longo prazo quando você não informa: IPCA perto do teto da meta, como o
  // Focus projeta para 2029 em diante, e juro real de 5,5% (o Focus implica
  // ~6%; um pouco abaixo porque juro real alto tende a ceder no longo prazo)
  const LONGO_PRAZO = { ipca: 3.5, juro_real: 5.5, meses: 36 };
  // Volatilidade real anual de referência (%), usada quando a série do pilar
  // é curta: Ibovespa ~31% em 2000–2024 (anual); carteira de ações
  // diversificada ~25%, FIIs ~12%, cripto ~60%, rebanho ~15%
  const VOL_REFERENCIA = { acoes: 25, real_estate: 12, alternativos: 60, caixa: 1, agro: 15 };
  // meses de "peso" da referência: com 36 meses de série, metade de cada
  const PESO_REFERENCIA = 36;
  // correlação entre os pilares de risco (o caixa sorteia à parte)
  const CORREL = { "acoes|real_estate": 0.5, "acoes|alternativos": 0.3, "real_estate|alternativos": 0.2, "acoes|agro": 0.1, "real_estate|agro": 0.1, "alternativos|agro": 0.05 };
  const correl = (a, b) => (a === b ? 1 : CORREL[a + "|" + b] ?? CORREL[b + "|" + a] ?? 0);
  // IR sobre o ganho no resgate (ações/ETFs/cripto 15%, FII 20%; rendimento
  // de FII e dividendos são isentos; renda fixa longa 15%; rebanho fora)
  const ALIQ_GANHO = { acoes: 15, real_estate: 20, alternativos: 15, agro: 0 };
  const CAMINHOS = 500, SEMENTE = 20240917;
  const TAXA_SAQUE = 4;
  // valorização real de longo prazo (sem proventos), % a.a.
  const VAL_MEDIO = { acoes: 4, real_estate: 0.5, alternativos: 3.5, agro: 3 };
  // prêmio de risco real sobre a renda fixa (FC.PERFIL.premios: ações 4, FIIs 2,5, cripto 6)
  const PREMIO = { acoes: 4, real_estate: 2.5, alternativos: 6 };
  const PESOS_VAL = { medio: 0.4, atual: 0.4, real: 0.2 };
  const ANOS_CONFIANCA = 5;
  const limita = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function valorizacaoPorFontes(k, dy, hist, juroReal) {
    const medio = VAL_MEDIO[k] ?? 2;
    const premio = (FC.PERFIL && FC.PERFIL.premios ? { acoes: FC.PERFIL.premios.acoes, real_estate: FC.PERFIL.premios.fiis, alternativos: FC.PERFIL.premios.cripto } : PREMIO)[k];
    const atual = premio != null ? limita(juroReal + premio - (dy || 0), -5, 15) : null;
    const real = hist && hist.anos > 0 && hist.valor != null ? limita(hist.valor - (dy || 0), -10, 20) : null;
    const c = real != null ? Math.min(1, hist.anos / ANOS_CONFIANCA) : 0;
    const pesos = { medio: PESOS_VAL.medio, atual: atual != null ? PESOS_VAL.atual : 0, real: PESOS_VAL.real * c };
    const soma = pesos.medio + pesos.atual + pesos.real;
    const valor = (pesos.medio * medio + pesos.atual * (atual || 0) + pesos.real * (real || 0)) / soma;
    return { valor, medio, atual, real, anos: hist ? hist.anos : 0, pesos: { medio: pesos.medio / soma, atual: pesos.atual / soma, real: pesos.real / soma } };
  }

  // ---------------------------------------------------------------- dados
  // retornos mensais (log) de uma série diária [[data, preço]]
  function retornosMensais(serie) {
    const fim = {};
    for (const [d, p] of serie || []) if (p > 0 && d) fim[String(d).slice(0, 7)] = p;
    const ms = Object.keys(fim).sort(), r = {};
    for (let i = 1; i < ms.length; i++) r[ms[i]] = Math.log(fim[ms[i]] / fim[ms[i - 1]]);
    return r;
  }

  // volatilidade anual observada do pilar: retorno mensal da cesta, cada
  // ativo pesando o que vale hoje
  function volObservada(ativos) {
    const porMes = {};
    for (const a of ativos) {
      const r = retornosMensais(a.serie_preco);
      for (const [m, v] of Object.entries(r)) {
        const x = (porMes[m] = porMes[m] || { s: 0, w: 0 });
        x.s += v * a.peso; x.w += a.peso;
      }
    }
    const rs = Object.values(porMes).filter((x) => x.w > 0).map((x) => x.s / x.w);
    if (rs.length < 6) return { vol: null, meses: rs.length };
    const m = rs.reduce((a, b) => a + b, 0) / rs.length;
    const dp = Math.sqrt(rs.reduce((s, v) => s + (v - m) ** 2, 0) / (rs.length - 1));
    return { vol: dp * Math.sqrt(MESES) * 100, meses: rs.length };
  }

  function perfilDosPilares(dados) {
    const pilares = {}, membros = {};
    for (const a of dados.ativos) {
      if (!a.posicao || !a.pilar) continue;
      const dyM = (a.metricas || []).find((m) => m.chave === "dy" && m.valor);
      const dy = dyM ? dyM.valor : 0;
      const p = (pilares[a.pilar] = pilares[a.pilar] || { valor: 0, dyp: 0, custo: 0, titulos: [] });
      p.valor += a.posicao.atual;
      p.dyp += a.posicao.atual * dy;
      p.custo += a.posicao.custo > 0 ? a.posicao.custo : a.posicao.atual;
      (membros[a.pilar] = membros[a.pilar] || []).push({ ticker: a.ticker, serie_preco: a.serie_preco, peso: a.posicao.atual });
    }
    for (const p of Object.values(pilares)) p.dy = p.valor ? p.dyp / p.valor : 0;

    const caixa = (pilares.caixa = pilares.caixa || { valor: 0, dy: 0, custo: 0, titulos: [] });
    // o que está no pilar caixa fora da renda fixa (ETF de caixa, conta) rende como CDI
    if (caixa.valor > 0) caixa.titulos.push({ nome: "Outros no caixa", valor: caixa.valor, custo: caixa.custo, tipo: "cdi", taxa: 100, vencimento: null, isento: false, avulso: true });
    for (const r of dados.rendaFixa) {
      const aplic = r.valor_aplicado || 0;
      if (!aplic) continue;
      // sem taxa informada vale o padrão do tipo (100% do CDI/Selic, IPCA + 0)
      const taxa = r.taxa != null ? Number(r.taxa) : FC.rentab ? FC.rentab.PADRAO_TAXA[r.tipo] ?? 100 : 100;
      const isento = FC.impostos ? FC.impostos.isentoRF(r, FC.infoTitulo ? FC.infoTitulo(FC.estado && FC.estado.prefs, r.id) : null) : false;
      caixa.valor += aplic;
      caixa.custo += r.principal > 0 ? r.principal : aplic;
      caixa.titulos.push({ nome: r.nome, valor: aplic, custo: r.principal > 0 ? r.principal : aplic, tipo: r.tipo, taxa, vencimento: r.vencimento || null, isento });
    }

    if (dados.agro && dados.resumo.agro > 0) pilares.agro = { valor: dados.resumo.agro, dy: 0, custo: dados.resumo.agro, titulos: [] };
    for (const [k, p] of Object.entries(pilares)) p.obs = k === "caixa" || k === "agro" ? { vol: null, meses: 0 } : volObservada(membros[k] || []);
    return pilares;
  }

  // o seu retorno real até aqui (TIR anual, deflacionada pelo IPCA de 12 meses)
  function historicoReal(dados, ipca) {
    const r = dados.rentab;
    if (!r) return {};
    const pilarDe = Object.fromEntries(dados.ativos.filter((a) => a.pilar).map((a) => [a.ticker, a.pilar]));
    const acc = {};
    for (const a of r.ativos || []) {
      const k = pilarDe[a.ticker];
      if (!k || a.xirr == null || !(a.valor_atual > 0)) continue;
      const x = (acc[k] = acc[k] || { s: 0, w: 0, d: 0 });
      x.s += a.xirr * a.valor_atual; x.w += a.valor_atual; x.d += (a.dias || 0) * a.valor_atual;
    }
    // { valor: % real a.a., anos: tempo médio de histórico, pesado pelo valor }
    const out = Object.fromEntries(Object.entries(acc).map(([k, x]) => [k, { valor: real(x.s / x.w, ipca), anos: x.d / x.w / 365 }]));
    const cl = r.classes || {};
    if (cl.renda_fixa && cl.renda_fixa.xirr != null) out.caixa = { valor: real(cl.renda_fixa.xirr, ipca), anos: (cl.renda_fixa.dias || 0) / 365 };
    if (cl.agro && cl.agro.xirr != null) out.agro = { valor: real(cl.agro.xirr, ipca), anos: (cl.agro.dias || 0) / 365 };
    return out;
  }

  // ---------------------------------------------------------------- macro
  // trajetória mês a mês: sai do valor de hoje e chega ao de longo prazo
  function trajetoria(hoje, lp, meses, total) {
    const v = new Float64Array(total + 1);
    for (let m = 0; m <= total; m++) v[m] = meses > 0 && m < meses ? hoje + ((lp - hoje) * m) / meses : lp;
    return v;
  }

  // fator mensal real de cada título, mês a mês: pós-fixado anda com o CDI,
  // prefixado e IPCA+ seguem o contratado até vencer e depois viram CDI
  function fatoresTitulo(t, macro, total, hoje) {
    const f = new Float64Array(total + 1);
    const venceEm = t.vencimento ? Math.max(0, Math.round(FC.datas.dias(hoje, t.vencimento) / 30.44)) : Infinity;
    for (let m = 1; m <= total; m++) {
      const cdi = macro.cdi[m], ipca = macro.ipca[m];
      let re;
      if (m > venceEm || t.tipo === "cdi" || t.tipo === "selic") re = real((cdi * (m > venceEm ? 100 : t.taxa)) / 100, ipca);
      else if (t.tipo === "ipca") re = t.taxa;
      else re = real(t.taxa, ipca);
      f[m] = mensal(re);
    }
    return { f, venceEm };
  }

  // ---------------------------------------------------------------- sorteio
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cholesky(M) {
    const n = M.length, L = M.map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = M[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
    return L;
  }
  const quantil = (ordenado, q) => {
    if (!ordenado.length) return 0;
    const i = (ordenado.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (i - lo);
  };

  // ---------------------------------------------------------------- destino do aporte
  // pesos[] na ordem de ks; alvos em %
  function destino(ks, saldos, alvos, modo, pesosPlano, saida) {
    const n = ks.length;
    if (modo === "plano" && pesosPlano) {
      let s = 0;
      for (let i = 0; i < n; i++) s += pesosPlano[ks[i]] || 0;
      for (let i = 0; i < n; i++) saida[i] = s ? (pesosPlano[ks[i]] || 0) / s : 1 / n;
      return;
    }
    let total = 0, somaAlvos = 0;
    for (let i = 0; i < n; i++) { if (alvos[i] > 0) total += saldos[i]; somaAlvos += alvos[i]; }
    if (!somaAlvos) { for (let i = 0; i < n; i++) saida[i] = 1 / n; return; }
    const proporcional = () => { for (let i = 0; i < n; i++) saida[i] = alvos[i] / somaAlvos; };
    if (!total || modo === "proporcional") return proporcional();
    // pilar com meta 0% não entra na base do equilíbrio
    let sf = 0;
    for (let i = 0; i < n; i++) { saida[i] = Math.max(0, (total * alvos[i]) / 100 - saldos[i]); sf += saida[i]; }
    if (sf <= 0) return proporcional();
    for (let i = 0; i < n; i++) saida[i] /= sf;
  }

  // ---------------------------------------------------------------- simulação
  // monta tudo o que não muda entre caminhos
  function prepara(pilares, prem, alvosObj, macro, hoje) {
    const meses = Math.round(Number(prem.horizonte_anos) || 20) * MESES;
    const modo = prem.distribuicao_aporte || "rebalancear";
    const val = prem._valorizacao || {};
    const volUser = prem.volatilidade || {};
    const ks = Object.keys(pilares);
    // se não há nenhum pilar (carteira vazia), o aporte cria os pilares da meta
    if (!ks.length) for (const k of Object.keys(alvosObj)) if (Number(alvosObj[k]) > 0) ks.push(k);
    // pilar que o plano manda aportar e que você ainda não tem: começa do zero
    if (modo === "plano" && prem._pesos_plano) for (const k of Object.keys(prem._pesos_plano)) if (!ks.includes(k)) ks.push(k);
    const p = (k) => pilares[k] || { valor: 0, dy: 0, custo: 0, titulos: [], obs: { vol: null, meses: 0 } };
    const risco = ks.map((k) => {
      const ref = VOL_REFERENCIA[k] ?? 20, o = p(k).obs || { vol: null, meses: 0 };
      const u = Number(volUser[k]);
      if (volUser[k] != null && volUser[k] !== "" && Number.isFinite(u)) return { vol: Math.max(0, u), origem: "sua premissa", observada: o.vol, meses: o.meses };
      if (o.vol == null) return { vol: ref, origem: "referência de mercado", observada: null, meses: o.meses };
      // mistura por credibilidade: a variância observada pesa os meses de série
      const v = Math.sqrt((o.meses * o.vol ** 2 + PESO_REFERENCIA * ref ** 2) / (o.meses + PESO_REFERENCIA));
      return { vol: v, origem: `seus ativos (${o.meses} meses) + referência`, observada: o.vol, meses: o.meses };
    });
    // caixa: cada título é um balde com a própria taxa; o aporte novo no caixa vai para o CDI
    const iCx = ks.indexOf("caixa");
    const titulos = iCx >= 0 ? p("caixa").titulos.map((t) => ({ ...t, ...fatoresTitulo(t, macro, meses, hoje) })) : [];
    const novoCdi = iCx >= 0 ? fatoresTitulo({ tipo: "cdi", taxa: 100 }, macro, meses, hoje).f : null;
    const cxTributavel = (() => {
      const tt = FC.soma(titulos, (t) => t.valor);
      return tt ? FC.soma(titulos.filter((t) => !t.isento), (t) => t.valor) / tt : 1;
    })();
    const iRisco = ks.map((k, i) => i).filter((i) => i !== iCx);
    const L = cholesky(iRisco.map((i) => iRisco.map((j) => correl(ks[i], ks[j]))));
    return {
      ks, meses, modo, iCx, titulos, novoCdi, iRisco, L, risco,
      inicial: ks.map((k) => p(k).valor), custo0: ks.map((k) => p(k).custo || p(k).valor),
      dy: ks.map((k) => (k === "caixa" ? 0 : p(k).dy || 0)),
      g: ks.map((k) => (k === "caixa" ? 0 : Math.log(1 + (Number(val[k]) || 0) / 100) / MESES)),
      s: ks.map((k, i) => risco[i].vol / 100 / Math.sqrt(MESES)),
      alvos: ks.map((k) => Number(alvosObj[k]) || 0),
      aliq: ks.map((k) => (k === "caixa" ? 15 * cxTributavel : ALIQ_GANHO[k] ?? 15) / 100),
      aporte: Number(prem.aporte_mensal) || 0,
      fatorAporte: Float64Array.from({ length: meses + 1 }, (_, m) => Math.pow(1 + mensal(Number(prem.crescimento_aporte_real) || 0), Math.max(0, m - 1))),
      reinveste: !!prem.reinvestir_proventos, pesosPlano: prem._pesos_plano,
    };
  }

  // choques já correlacionados de todos os caminhos, sorteados uma vez só:
  // o mesmo sorteio serve à busca do aporte (números aleatórios comuns)
  function sorteia(P, n) {
    const nR = P.iRisco.length, passo = nR + 1, rnd = mulberry32(SEMENTE);
    const t = new Float32Array(n * P.meses * passo), z = new Float64Array(nR);
    let sobra = null;
    const normal = () => {
      if (sobra != null) { const v = sobra; sobra = null; return v; }
      let u = 0;
      while (!u) u = rnd();
      const r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * rnd();
      sobra = r * Math.sin(th);
      return r * Math.cos(th);
    };
    for (let o = 0; o < t.length; o += passo) {
      for (let i = 0; i < nR; i++) z[i] = normal();
      for (let a = 0; a < nR; a++) {
        let e = 0;
        for (let b = 0; b <= a; b++) e += P.L[a][b] * z[b];
        t[o + a] = e;
      }
      t[o + nR] = normal();
    }
    return { t, passo };
  }

  // um caminho. c < 0 = determinístico (todo choque zero).
  // fotos: a cada trimestre chama aoMarcar(mês, total, renda do mês)
  function caminho(P, c, aporteBase, aoMarcar) {
    const n = P.ks.length, saldo = Float64Array.from(P.inicial), custo = Float64Array.from(P.custo0);
    const tit = P.titulos.map((t) => t.valor), pesos = new Float64Array(n), nR = P.iRisco.length;
    const S = c >= 0 ? P.choques : null;
    let o = S ? c * P.meses * S.passo : 0;
    let novo = 0, aportado = 0, prov = 0, rendaMes = 0;
    for (let m = 1; m <= P.meses; m++, o += S ? S.passo : 0) {
      for (let a = 0; a < nR; a++) {
        const i = P.iRisco[a];
        saldo[i] *= Math.exp(P.g[i] + (S ? P.s[i] * S.t[o + a] : 0));
      }
      if (P.iCx >= 0) {
        // o caixa tem um choque pequeno (inflação surpresa), comum a todos os títulos
        const sc = P.s[P.iCx], choque = S ? Math.exp(sc * S.t[o + nR] - (sc * sc) / 2) : 1;
        let s = 0;
        for (let j = 0; j < tit.length; j++) { tit[j] *= (1 + P.titulos[j].f[m]) * choque; s += tit[j]; }
        novo *= (1 + P.novoCdi[m]) * choque;
        saldo[P.iCx] = s + novo;
      }
      rendaMes = 0;
      for (let i = 0; i < n; i++) rendaMes += (saldo[i] * P.dy[i]) / 100 / MESES;
      prov += rendaMes;
      const ap = aporteBase * P.fatorAporte[m];
      aportado += ap;
      const entrada = ap + (P.reinveste ? rendaMes : 0);
      destino(P.ks, saldo, P.alvos, P.modo, P.pesosPlano, pesos);
      for (let i = 0; i < n; i++) {
        const v = entrada * pesos[i];
        saldo[i] += v; custo[i] += v;
        if (i === P.iCx) novo += v;
      }
      if (aoMarcar && (m % 3 === 0 || m === P.meses)) {
        let tot = 0;
        for (let i = 0; i < n; i++) tot += saldo[i];
        aoMarcar(m, tot, rendaMes);
      }
    }
    let final = 0, ir = 0;
    for (let i = 0; i < n; i++) { final += saldo[i]; ir += Math.max(0, saldo[i] - custo[i]) * P.aliq[i]; }
    return { final, liquido: final - ir, aportado, prov, rendaMes };
  }

  // ---------------------------------------------------------------- determinístico
  function deterministico(P, pilares) {
    const pat = [], renda = [];
    const r = caminho(P, -1, P.aporte, (m, tot, rm) => { pat.push([m / MESES, tot]); renda.push([m / MESES, rm]); });
    const inicial = P.inicial.reduce((a, b) => a + b, 0);
    return {
      patrimonio: pat, renda, final: r.final, final_liquido: r.liquido, inicial, aportado: r.aportado, proventos: r.prov,
      valorizacao: r.final - inicial - r.aportado - (P.reinveste ? r.prov : 0),
      renda_mensal_final: r.rendaMes,
      // hoje é observado: não muda com o cenário
      renda_mensal_hoje: Object.keys(pilares).filter((k) => k !== "caixa").reduce((s, k) => s + (pilares[k].valor * (pilares[k].dy || 0)) / 100 / MESES, 0),
    };
  }

  // ---------------------------------------------------------------- Monte Carlo
  function monteCarlo(P, n, aporte, alvo) {
    P.choques = sorteia(P, n);
    const nQ = Math.ceil(P.meses / 3), tempos = [];
    const fotos = Array.from({ length: nQ }, () => new Float64Array(n));
    const finais = new Float64Array(n), liquidos = new Float64Array(n), rendas = new Float64Array(n);
    // primeiro mês em que cada caminho cruza o alvo (para a chance ano a ano)
    const cruzou = alvo > 0 ? new Float64Array(n).fill(Infinity) : null;
    for (let c = 0; c < n; c++) {
      let q = 0;
      const r = caminho(P, c, aporte, (m, tot) => {
        if (c === 0) tempos.push(m / MESES);
        fotos[q++][c] = tot;
        if (cruzou && tot >= alvo && cruzou[c] === Infinity) cruzou[c] = m;
      });
      finais[c] = r.final; liquidos[c] = r.liquido; rendas[c] = r.rendaMes;
    }
    const ord = (a) => Float64Array.from(a).sort();
    const faixa = (q) => fotos.map((f, i) => [tempos[i], quantil(ord(f), q)]);
    const fF = ord(finais), fL = ord(liquidos), fR = ord(rendas);
    const pct = (q) => ({ final: quantil(fF, q), final_liquido: quantil(fL, q), renda_mensal_final: quantil(fR, q) });
    return {
      caminhos: n, tempos,
      faixas: { p10: faixa(0.1), p25: faixa(0.25), p50: faixa(0.5), p75: faixa(0.75), p90: faixa(0.9) },
      p10: pct(0.1), p20: pct(0.2), p50: pct(0.5), p90: pct(0.9),
      cruzou,
      chance: alvo > 0 ? (finais.filter((v) => v >= alvo).length / n) * 100 : null,
    };
  }

  // aporte que leva 80% dos caminhos ao alvo no horizonte. Com os mesmos
  // choques, o patrimônio final é quase linear no aporte: a secante chega
  // em poucas rodadas (numa amostra de 200 caminhos)
  function aportePara(P, alvo, chance = 0.8) {
    const n = Math.min(200, P.choques.t.length / (P.meses * P.choques.passo));
    const f = (ap) => {
      const v = new Float64Array(n);
      for (let c = 0; c < n; c++) v[c] = caminho(P, c, ap).final;
      return quantil(v.sort(), 1 - chance) - alvo;
    };
    let a0 = P.aporte, f0 = f(a0);
    if (f0 >= 0) return null;
    let a1 = Math.max(a0 * 2, a0 + 500), f1 = f(a1);
    for (let i = 0; i < 8; i++) {
      if (Math.abs(f1) <= alvo * 0.002 || f1 === f0) break;
      const a2 = Math.max(0, a1 - (f1 * (a1 - a0)) / (f1 - f0));
      a0 = a1; f0 = f1; a1 = a2; f1 = f(a1);
    }
    return a1 > 0 && Number.isFinite(a1) ? a1 : null;
  }

  function projeta(dados, prem, opcoes = {}) {
    // com o plano do Salário ligado, o aporte e a divisão vêm dele
    const pp = dados.plano_projecao;
    const usandoPlano = !!(prem.usar_plano && pp && pp.aporte_mensal > 0);
    if (usandoPlano) prem = { ...prem, aporte_mensal: pp.aporte_mensal, distribuicao_aporte: "plano", _pesos_plano: pp.pesos };
    const hoje = opcoes.hoje || FC.datas.hoje();
    const m0 = dados.macro || {};
    const lp = prem.macro_longo_prazo || {};
    const num = (v) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
    const ipcaHoje = num(m0.ipca_12m) ?? 4, cdiHoje = num(m0.cdi) ?? 10;
    const ipcaLp = num(lp.ipca) ?? LONGO_PRAZO.ipca;
    const cdiLp = num(lp.cdi) ?? nominal(LONGO_PRAZO.juro_real, ipcaLp);
    const conv = num(prem.meses_convergencia) ?? LONGO_PRAZO.meses;
    const meses = Math.round(Number(prem.horizonte_anos) || 20) * MESES;
    const macro = { cdi: trajetoria(cdiHoje, cdiLp, conv, meses), ipca: trajetoria(ipcaHoje, ipcaLp, conv, meses) };
    const macroLp = { cdi: cdiLp, ipca: ipcaLp, juro_real: real(cdiLp, ipcaLp), cdi_hoje: cdiHoje, ipca_hoje: ipcaHoje, juro_real_hoje: real(cdiHoje, ipcaHoje), meses: conv };

    const alvos = dados.alocacao_alvo || {};
    const pilares = perfilDosPilares(dados);
    const hist = historicoReal(dados, ipcaHoje);
    // juro real médio ao longo do horizonte (já com a convergência)
    let jr = 0;
    for (let m = 1; m <= meses; m++) jr += real(macro.cdi[m], macro.ipca[m]);
    jr /= meses;
    const manual = prem.valorizacao_premissa || {};
    const fontes = {}, valFinal = {};
    for (const k of FC.PILARES.map((x) => x.chave)) {
      if (k === "caixa") continue;
      fontes[k] = valorizacaoPorFontes(k, pilares[k] ? pilares[k].dy : 0, hist[k], jr);
      const u = num(manual[k]);
      valFinal[k] = u != null ? u : fontes[k].valor;
    }
    prem = { ...prem, _valorizacao: valFinal };
    const P = prepara(pilares, prem, alvos, macro, hoje);
    const base = deterministico(P, pilares);

    // independência: renda-alvo / taxa de saque
    const taxaSaque = num(prem.taxa_saque) ?? TAXA_SAQUE;
    const rendaAlvo = num(prem.renda_alvo) ?? (dados.objetivos && dados.objetivos.renda_desejada_mensal > 0 ? dados.objetivos.renda_desejada_mensal : null);
    const alvo = rendaAlvo > 0 && taxaSaque > 0 ? (rendaAlvo * MESES) / (taxaSaque / 100) : 0;

    const mc = monteCarlo(P, opcoes.caminhos || CAMINHOS, P.aporte, alvo);
    let independencia = null;
    if (alvo > 0) {
      const anoEm = (serie) => { const x = serie.find((p) => p[1] >= alvo); return x ? x[0] : null; };
      // chance de já ter chegado, ano a ano
      const porAno = [];
      for (let a = 1; a <= meses / MESES; a++) porAno.push([a, (mc.cruzou.filter((m) => m <= a * MESES).length / mc.caminhos) * 100]);
      independencia = {
        renda_alvo: rendaAlvo, taxa_saque: taxaSaque, patrimonio_alvo: alvo,
        renda_alvo_origem: num(prem.renda_alvo) != null ? "sua premissa" : "objetivos",
        chance_no_horizonte: mc.chance,
        // "já chegou em algum momento" é diferente de "está acima no fim"
        chance_por_ano: porAno,
        ano_mediano: anoEm(mc.faixas.p50), ano_p10: anoEm(mc.faixas.p10), ano_base: anoEm(base.patrimonio),
        ja_atingido: base.inicial >= alvo,
        aporte_para_80: mc.chance != null && mc.chance < 80 && opcoes.aporte_para !== false ? aportePara(P, alvo) : null,
      };
    }
    delete mc.cruzou;

    const val = valFinal;
    const ordem = FC.PILARES.map((p) => p.chave);
    const risco = Object.fromEntries(P.ks.map((k, i) => [k, P.risco[i]]));
    const resumo = Object.entries(pilares).map(([k, p]) => {
      const comum = { chave: k, nome: FC.PILAR_NOME[k], valor: p.valor, volatilidade: risco[k] ? risco[k].vol : null, vol_origem: risco[k] ? risco[k].origem : null, vol_observada: risco[k] ? risco[k].observada : null, historico_real: hist[k] ? hist[k].valor : null, historico_anos: hist[k] ? hist[k].anos : null };
      if (k === "caixa") {
        const tt = FC.soma(p.titulos, (t) => t.valor) || 1;
        const em = (m) => FC.soma(P.titulos, (t) => (t.valor * (Math.pow(1 + t.f[Math.min(m, meses)], MESES) - 1) * 100)) / tt;
        return { ...comum, dy: null, valorizacao: null, total: P.titulos.length ? em(1) : 0, total_lp: P.titulos.length ? em(meses) : 0, titulos: p.titulos };
      }
      return { ...comum, dy: p.dy, valorizacao: Number(val[k]) || 0, valorizacao_fontes: fontes[k], valorizacao_manual: num(manual[k]) != null, total: (Number(val[k]) || 0) + p.dy, titulos: [] };
    }).sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
    const caixa = resumo.find((l) => l.chave === "caixa");
    const rv = resumo.filter((l) => l.chave !== "caixa" && l.valor > 0).map((l) => l.total);
    const titulos = P.titulos.filter((t) => !t.avulso).map((t) => ({
      nome: t.nome, valor: t.valor, isento: t.isento, vencimento: t.vencimento, vence_em_meses: Number.isFinite(t.venceEm) ? t.venceEm : null,
      real: (Math.pow(1 + t.f[1], MESES) - 1) * 100, nominal: nominal((Math.pow(1 + t.f[1], MESES) - 1) * 100, ipcaHoje),
      posfixado: t.tipo === "cdi" || t.tipo === "selic",
    }));
    return {
      usando_plano: usandoPlano,
      base, mc, independencia, pilares: resumo, macro_lp: { ...macroLp, juro_real_medio: jr }, valorizacao: fontes,
      usando_macro_padrao: num(lp.cdi) == null && num(lp.ipca) == null, premissas: prem,
      // mesmo com o juro convergindo, a renda fixa segue acima da renda variável
      alerta_caixa: !!caixa && caixa.valor > 0 && rv.length > 0 && caixa.total_lp > Math.max(...rv),
      titulos_caixa: titulos, caixa_real: caixa ? caixa.total : 0, caixa_real_lp: caixa ? caixa.total_lp : 0,
    };
  }

  FC.projecao = { projeta, LONGO_PRAZO, VOL_REFERENCIA, TAXA_SAQUE, CAMINHOS, VAL_MEDIO, PESOS_VAL, valorizacaoPorFontes, _interno: { retornosMensais, volObservada, cholesky, mulberry32, quantil } };
})();
