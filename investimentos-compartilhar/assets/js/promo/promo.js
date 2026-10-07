/* Vídeo de divulgação do Finance Control, feito inteiro em JavaScript.
 *
 * Um canvas desenhado por render(ctx, t, dados, opts) — pura, mesmo
 * instante, mesmo quadro — com um celular mostrando o app com os números
 * da conta aberta, cena a cena, e o título de cada recurso ao lado. Trilha
 * em Web Audio (o mesmo motor da retrospectiva) e exportação por
 * MediaRecorder. Formatos: vertical (1080×1920) e horizontal (1920×1080). */
(function () {
  const FC = window.FC;
  const { html, icone } = FC;

  const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // ---------------------------------------------------------------- dados
  // tudo o que o vídeo mostra sai da conta aberta agora
  function montaDados() {
    const e = FC.estado, d = e.dados, rt = d.rentab || {}, hoje = FC.datas.hoje();
    const tot = rt.total || {};
    // série do patrimônio (até ~90 pontos) e as mesmas datas na Selic e no Ibovespa
    let pontos = [];
    // proventos pagos contam como dinheiro que voltou, igual ao Início
    let pagos = [];
    try { if (e.proventos) pagos = FC.dividendos.analisa(d, e.base, e.proventos).pagamentos; } catch (err) { console.error(err); }
    try { pontos = FC.rentab.serieDiaria(e.base, e.mercado, e.mercado.indices, e.prefs, d.resumo.patrimonio, pagos).pontos; } catch (err) { console.error(err); }
    const ano = pontos.filter((p) => p.data >= FC.datas.soma(hoje, -365));
    const trecho = ano.length >= 2 ? ano : pontos;
    const passo = Math.max(1, Math.ceil(trecho.length / 90));
    const amostra = trecho.filter((_, i) => i % passo === 0 || i === trecho.length - 1);
    const ix = e.mercado.indices, ibov = (e.bench || {}).ibov;
    const simula = (ret) => {
      if (trecho.length < 2) return [];
      let v = trecho[0].valor; const out = [[trecho[0].data, v]];
      for (let i = 1; i < trecho.length; i++) {
        const r = ret(trecho[i - 1].data, trecho[i].data);
        v = v * (r == null ? 1 : r) + (trecho[i].fluxo - trecho[i - 1].fluxo);
        out.push([trecho[i].data, v]);
      }
      return out.filter((_, i) => i % passo === 0 || i === out.length - 1);
    };
    const selic = ix ? simula((a, b) => ix.fator("selic", 100, a, b).f) : [];
    const ibovS = ibov && ibov.length ? simula((a, b) => { const x = FC.carteira.precoEm(ibov, a), y = FC.carteira.precoEm(ibov, b); return x && y ? y / x : 1; }) : [];

    const NOMES = { bolsa: ["Ações, FIIs e ETFs", "#0a84ff"], cripto: ["Cripto", "#ff9f0a"], renda_fixa: ["Renda fixa", "#30d158"], agro: ["Agro", "#c9a77c"] };
    const classes = Object.entries(rt.classes || {}).filter(([k, v]) => v && NOMES[k] && (k !== "agro" || FC.modulo("agro")))
      .map(([k, v]) => ({ nome: NOMES[k][0], cor: NOMES[k][1], valor: v.valor_atual, pct: v.periodo_pct, xirr: v.xirr }));
    let div = null;
    try { div = FC.dividendos.analisa(d, e.base, e.proventos || {}); } catch (err) { /* sem proventos */ }
    const melhores = (rt.ativos || []).filter((a) => a.periodo_pct != null).sort((a, b) => b.periodo_pct - a.periodo_pct);
    // o exemplo de Graham: o de melhor nota com margem positiva (se houver)
    const graham = d.ativos.filter((a) => a.graham && a.graham.valor != null && a.score != null).sort((a, b) => b.score - a.score);
    const comGraham = graham.find((a) => a.graham.margem > 0) || graham[0];
    const fii = d.ativos.find((a) => a.classe === "fii" && a.cvm);
    const rf = d.rendaFixa || [];
    return {
      seed: FC.recap.seedDoMes(hoje), nome: (FC.auth.usuario.user_metadata || {}).nome || "",
      patrimonio: d.resumo.patrimonio, aplicado: tot.aplicado, ganho: tot.ganho, periodo: tot.periodo_pct, xirr: tot.xirr,
      serie: amostra.map((p) => [p.data, p.valor]), selic, ibov: ibovS,
      selicFim: selic.length ? selic.at(-1)[1] : null, ibovFim: ibovS.length ? ibovS.at(-1)[1] : null,
      partes: [["Bolsa", d.resumo.bolsa, "#0a84ff"], ["Renda fixa", d.resumo.renda_fixa, "#30d158"], ["Cripto", d.resumo.cripto, "#ff9f0a"], ["Agro", d.resumo.agro, "#c9a77c"]].filter(([, v]) => v > 0),
      classes,
      dividendos: div ? { recebido: div.resumo.recebido_12m, pagadores: div.resumo.n_pagadores, meses: (div.serie || []).filter((m) => !m.futuro).slice(-12).map((m) => [m.mes, m.total]) } : null,
      melhor: melhores[0] ? { ticker: melhores[0].ticker, pct: melhores[0].periodo_pct } : null,
      ativo: comGraham ? { ticker: comGraham.ticker, score: comGraham.score, cor: comGraham.cor, veredito: comGraham.veredito_curto,
        preco: comGraham.preco, graham: comGraham.graham.valor, margem: comGraham.graham.margem } : null,
      fii: fii ? { ticker: fii.ticker, tipo: { fii_tijolo: "Tijolo", fii_papel: "Papel (CRI)", fii_fof: "Fundo de fundos", fii_hibrido: "Híbrido" }[fii.perfil] || "FII",
        vacFin: fii.cvm.vacancia_financeira, vacFis: fii.cvm.vacancia_fisica_cvm, maior: fii.cvm.maior_imovel ?? (fii.cvm.cri || {}).maior ?? (fii.cvm.fii || {}).maior,
        n: fii.cvm.n_imoveis || (fii.cvm.cri || {}).n || (fii.cvm.fii || {}).n } : null,
      rf: rf.slice(0, 3).map((r) => ({ nome: r.nome, base: r.base, valor: r.valor_aplicado, ganho: r.rent ? r.rent.ganho : null })),
      plano: (() => {
        const pl = e.prefs && e.prefs.plano;
        if (!pl || !pl.destinos || !pl.destinos.length) return null;
        try {
          // começo de mês sem aporte ainda: mostra o mês que acabou
          const doMes = (m) => FC.salario.planoDoMes({ plano: pl, ganhos: e.base.ganhos || [], base: e.base, mes: m });
          let mes = hoje.slice(0, 7), g = doMes(mes);
          if (!(g.aportado > 0)) { mes = FC.datas.soma(mes + "-01", -1).slice(0, 7); g = doMes(mes); }
          return { pct: pl.modo === "valor" ? null : pl.percentual, mes: NOMES_MES[Number(mes.slice(5, 7)) - 1].toLowerCase(),
            cumprido: g.total > 0 ? Math.min(100, (g.aportado / g.total) * 100) : null };
        } catch (err) { return null; }
      })(),
      // a retrospectiva de exemplo é a do mês que acabou
      mes: NOMES_MES[Number(FC.datas.soma(hoje.slice(0, 8) + "01", -1).slice(5, 7)) - 1],
    };
  }

  // ---------------------------------------------------------------- linha do tempo
  const CENAS = [
    { id: "abertura", dur: 4.2, telefone: false },
    { id: "patrimonio", dur: 5.2, titulo: ["Seu patrimônio,", "num lugar só."], sub: "Bolsa, cripto, renda fixa e agro, com preço de agora." },
    { id: "comparacao", dur: 5.4, titulo: ["Melhor que a Selic?", "Agora você sabe."], sub: "Cada aporte comparado com a Selic e o Ibovespa, no mesmo dia." },
    { id: "rentab", dur: 5, titulo: ["Rentabilidade", "de verdade."], sub: "Cada aporte com a sua data: TIR e retorno no período." },
    { id: "dividendos", dur: 4.6, titulo: ["Dividendos", "no calendário."], sub: "Quanto cada ativo paga, e quando cai na conta." },
    { id: "analise", dur: 5, titulo: ["Cada ativo,", "avaliado."], sub: "Preço justo de Graham, P/VP, DY e o raio-x dos FIIs." },
    { id: "rf", dur: 4.6, titulo: ["Renda fixa", "rendendo de verdade."], sub: "CDI, Selic e IPCA de cada dia útil, aporte a aporte." },
    { id: "seguranca", dur: 3.8, titulo: ["Seus dados,", "só seus."], sub: "Verificação em duas etapas e retrospectiva do mês." },
    { id: "chamada", dur: 4.6, telefone: false },
  ];
  let ac = 0;
  for (const c of CENAS) { c.ini = ac; c.fim = ac + c.dur; ac += c.dur; }
  const TOTAL = ac;
  // som: whoosh nas trocas, ticks no contador do patrimônio, acorde no fim
  function linhaDoTempo() {
    const ev = [];
    CENAS.forEach((c, i) => { if (i) ev.push({ t: c.ini, tipo: "whoosh" }); });
    const p = CENAS[1], ini = p.ini + 0.9, dur = 1.8;
    for (let k = 0; k < 24; k++) ev.push({ t: ini + dur * (1 - Math.pow(1 - k / 24, 0.55)), tipo: "tick", freq: 620 + 900 * (k / 24) });
    ev.push({ t: ini + dur, tipo: "ding" });
    ev.push({ t: CENAS.at(-1).ini + 0.2, tipo: "acorde" });
    return { eventos: ev.sort((a, b) => a.t - b.t), total: TOTAL, positivo: true };
  }

  // ---------------------------------------------------------------- desenho
  const FONTE = '-apple-system, "SF Pro Display", "Helvetica Neue", "Segoe UI", Arial, sans-serif';
  const F = (p, t) => `${p} ${t}px ${FONTE}`;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, q) => a + (b - a) * q;
  const eOut = (q) => 1 - Math.pow(1 - clamp(q), 3);
  const eInOut = (q) => { q = clamp(q); return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; };
  const mola = (q) => { q = clamp(q); return 1 - Math.pow(Math.E, -6.5 * q) * Math.cos(10 * q); };
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const brl = (v, o) => (o.privado ? "R$ •••" : "R$ " + nf0.format(v || 0));
  const pct = (v, s = true) => (v == null ? "—" : (s && v > 0 ? "+" : "") + nf1.format(v).replace("-", "−") + "%");
  const LOGO = ["M4 17l5-5 4 3 7-8", "M15 7h5v5"];
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

  function texto(ctx, s, x, y, { tam = 40, peso = 600, cor = "#fff", alinha = "left", alpha = 1 } = {}) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.font = F(peso, tam); ctx.textAlign = alinha; ctx.textBaseline = "alphabetic"; ctx.fillStyle = cor;
    ctx.fillText(s, x, y); ctx.restore();
  }
  function logo(ctx, x, y, tam, desenho = 1) {
    ctx.save(); ctx.translate(x - tam / 2, y - tam / 2);
    const g = ctx.createLinearGradient(0, 0, tam, tam); g.addColorStop(0, "#0a84ff"); g.addColorStop(1, "#5e5ce6");
    ctx.shadowColor = "rgba(10,132,255,0.5)"; ctx.shadowBlur = tam * 0.35;
    ctx.beginPath(); ctx.roundRect(0, 0, tam, tam, tam * 0.24); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = "transparent";
    const k = (tam * 0.62) / 24; ctx.translate(tam * 0.19, tam * 0.19); ctx.scale(k, k);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (desenho < 1) ctx.setLineDash([Math.max(0.001, desenho * 40), 40]);
    for (const p of LOGO) ctx.stroke(new Path2D(p));
    ctx.restore();
  }
  // título que sobe linha a linha por trás de uma máscara
  function titulo(ctx, linhas, x, y, lt, { tam, cor = "#fff", alinha = "left", larg }) {
    ctx.save(); ctx.font = F(800, tam); ctx.textAlign = alinha;
    const k = Math.min(1, larg / Math.max(...linhas.map((l) => ctx.measureText(l).width)));
    linhas.forEach((l, i) => {
      const q = eOut((lt - 0.15 - i * 0.12) / 0.55);
      if (q <= 0) return;
      const yy = y + i * tam * 1.02 * k;
      ctx.save(); ctx.beginPath(); ctx.rect(-5000, yy - tam * k, 20000, tam * k * 1.25); ctx.clip();
      ctx.translate(x, yy + (1 - q) * tam * k * 1.1); ctx.scale(k, k); ctx.fillStyle = cor; ctx.fillText(l, 0, 0); ctx.restore();
    });
    ctx.restore();
    return linhas.length * tam * 1.02 * k;
  }
  function quebra(ctx, s, larg) {
    const ls = [[]]; let w = 0; const esp = ctx.measureText(" ").width;
    for (const p of s.split(" ")) { const pw = ctx.measureText(p).width; if (w + pw > larg && ls.at(-1).length) { ls.push([]); w = 0; } ls.at(-1).push(p); w += pw + esp; }
    return ls.map((l) => l.join(" "));
  }
  function linhaGrafico(ctx, pts, x, y, w, h, q, { cor, larg = 5, area = false, tracejado = false, mn, mx }) {
    if (!pts || pts.length < 2) return;
    const lo = mn ?? Math.min(...pts.map((p) => p[1])), hi = mx ?? Math.max(...pts.map((p) => p[1])), amp = hi - lo || 1;
    const n = Math.max(1, Math.floor(q * (pts.length - 1)));
    const xy = pts.slice(0, n + 1).map((p, i) => [x + (i / (pts.length - 1)) * w, y + h - ((p[1] - lo) / amp) * h]);
    ctx.save();
    if (area) {
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, cor + "40"); g.addColorStop(1, cor + "00");
      ctx.beginPath(); ctx.moveTo(xy[0][0], y + h); xy.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.lineTo(xy.at(-1)[0], y + h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    }
    ctx.beginPath(); xy.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (tracejado) ctx.setLineDash([14, 10]);
    ctx.stroke(); ctx.restore();
  }

  // ---- telas do celular, desenhadas numa grade lógica de 656 × 1136
  const SW = 656, SH = 1136;
  function cartao(ctx, x, y, w, h) {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.08)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 34); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore();
  }
  const INK = "#1d1d1f", INK2 = "#6e6e73", VERDE = "#248a3d", VERM = "#d70015", AZUL = "#0a84ff";
  const TELAS = {
    patrimonio(ctx, lt, d, o) {
      texto(ctx, d.nome ? `Boa tarde, ${d.nome}.` : "Boa tarde.", 40, 160, { tam: 26, cor: INK2, peso: 500 });
      cartao(ctx, 30, 190, SW - 60, 360);
      texto(ctx, "Patrimônio", 70, 250, { tam: 26, cor: INK2, peso: 500 });
      const q = eOut((lt - 0.9) / 1.8);
      texto(ctx, o.privado ? "R$ •••" : brl(d.patrimonio * (0.82 + 0.18 * q), o), 70, 330, { tam: 64, cor: INK, peso: 700 });
      let x = 70;
      d.partes.slice(0, 3).forEach(([n, v, cor], i) => {
        const a = eOut((lt - 1.3 - i * 0.15) / 0.4); if (a <= 0) return;
        ctx.save(); ctx.globalAlpha = a; ctx.font = F(600, 21);
        const s = `${n} ${o.privado ? "" : brl(v, o)}`.trim(), w = ctx.measureText(s).width + 52;
        ctx.beginPath(); ctx.roundRect(x, 375, w, 46, 23); ctx.fillStyle = "#f2f2f7"; ctx.fill();
        ctx.beginPath(); ctx.arc(x + 22, 398, 7, 0, 6.283); ctx.fillStyle = cor; ctx.fill();
        ctx.fillStyle = INK; ctx.fillText(s, x + 38, 405); ctx.restore(); x += w + 10;
      });
      texto(ctx, d.ganho != null ? `${d.ganho >= 0 ? "+" : "−"}${o.privado ? "" : brl(Math.abs(d.ganho), o) + " · "}${pct(d.periodo)}` : "", 70, 495, { tam: 30, cor: (d.ganho || 0) >= 0 ? VERDE : VERM, peso: 700, alpha: eOut((lt - 2.4) / 0.4) });
      cartao(ctx, 30, 580, SW - 60, 420);
      texto(ctx, "Crescimento do patrimônio", 70, 640, { tam: 26, cor: INK, peso: 700 });
      linhaGrafico(ctx, d.serie, 70, 690, SW - 140, 270, eInOut((lt - 0.5) / 2.6), { cor: AZUL, area: true });
    },
    comparacao(ctx, lt, d, o) {
      cartao(ctx, 30, 150, SW - 60, 560);
      texto(ctx, "Comparar com", 70, 210, { tam: 24, cor: INK2, peso: 500 });
      [["Selic", "#ff9f0a"], ["Ibovespa", "#af52de"]].forEach(([n, c], i) => {
        ctx.save(); ctx.globalAlpha = eOut((lt - 0.4 - i * 0.2) / 0.3);
        ctx.beginPath(); ctx.roundRect(240 + i * 150, 182, n === "Selic" ? 110 : 140, 42, 21); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke();
        texto(ctx, n, 240 + i * 150 + (n === "Selic" ? 55 : 70), 211, { tam: 21, cor: c, peso: 700, alinha: "center" }); ctx.restore();
      });
      const todos = [...d.serie, ...d.selic, ...d.ibov].map((p) => p[1]);
      const mn = Math.min(...todos), mx = Math.max(...todos), q = eInOut((lt - 0.6) / 2.6);
      linhaGrafico(ctx, d.selic, 70, 270, SW - 140, 380, q, { cor: "#ff9f0a", tracejado: true, mn, mx, larg: 4 });
      linhaGrafico(ctx, d.ibov, 70, 270, SW - 140, 380, q, { cor: "#af52de", tracejado: true, mn, mx, larg: 4 });
      linhaGrafico(ctx, d.serie, 70, 270, SW - 140, 380, q, { cor: AZUL, mn, mx, larg: 6 });
      const kpi = (rot, cor, fim, y, atraso) => {
        if (fim == null) return;
        const a = eOut((lt - atraso) / 0.4); if (a <= 0) return;
        cartao(ctx, 30, y, SW - 60, 150);
        const dif = d.patrimonio - fim;
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = cor; ctx.fillRect(70, y + 52, 26, 5);
        texto(ctx, `Se fosse ${rot}`, 110, y + 62, { tam: 24, cor: INK2, peso: 500 });
        texto(ctx, o.privado ? pct((d.patrimonio / fim - 1) * 100) : brl(fim, o), 70, y + 118, { tam: 40, cor: INK, peso: 700 });
        texto(ctx, `${dif >= 0 ? "você está acima" : "você está abaixo"}${o.privado ? "" : " " + brl(Math.abs(dif), o)}`, SW - 70, y + 118, { tam: 23, cor: dif >= 0 ? VERDE : VERM, peso: 700, alinha: "right" });
        ctx.restore();
      };
      kpi("Selic", "#ff9f0a", d.selicFim, 740, 2.2);
      kpi("Ibovespa", "#af52de", d.ibovFim, 910, 2.5);
    },
    rentab(ctx, lt, d, o) {
      cartao(ctx, 30, 150, SW - 60, 330);
      texto(ctx, "Seu dinheiro investido", 70, 215, { tam: 28, cor: INK, peso: 700 });
      texto(ctx, "TIR ao ano", 70, 280, { tam: 24, cor: INK2, peso: 500 });
      const q = eOut((lt - 0.6) / 1.4);
      texto(ctx, d.xirr != null ? pct(d.xirr * q) : pct((d.periodo || 0) * q), 70, 380, { tam: 96, cor: (d.xirr ?? d.periodo ?? 0) >= 0 ? VERDE : VERM, peso: 800 });
      texto(ctx, d.xirr != null ? `${pct(d.periodo)} no período` : "no período", 70, 440, { tam: 24, cor: INK2, peso: 500 });
      d.classes.slice(0, 4).forEach((c, i) => {
        const y = 520 + i * 140, a = eOut((lt - 1.2 - i * 0.18) / 0.5); if (a <= 0) return;
        ctx.save(); ctx.globalAlpha = a; cartao(ctx, 30, y, SW - 60, 120);
        ctx.beginPath(); ctx.arc(80, y + 60, 12, 0, 6.283); ctx.fillStyle = c.cor; ctx.fill();
        texto(ctx, c.nome, 110, y + 52, { tam: 26, cor: INK, peso: 700 });
        texto(ctx, o.privado ? "" : brl(c.valor, o), 110, y + 88, { tam: 22, cor: INK2, peso: 500 });
        texto(ctx, pct(c.pct), SW - 70, y + 72, { tam: 32, cor: (c.pct || 0) >= 0 ? VERDE : VERM, peso: 800, alinha: "right" });
        ctx.restore();
      });
    },
    dividendos(ctx, lt, d, o) {
      const dv = d.dividendos || { recebido: 0, pagadores: 0, meses: [] };
      cartao(ctx, 30, 150, SW - 60, 300);
      texto(ctx, "Dividendos recebidos em 12 meses", 70, 215, { tam: 26, cor: INK2, peso: 500 });
      texto(ctx, o.privado ? `${dv.pagadores} pagadores` : brl(dv.recebido * eOut((lt - 0.5) / 1.4), o), 70, 315, { tam: 72, cor: VERDE, peso: 800 });
      texto(ctx, o.privado ? "" : `${dv.pagadores} ativos pagadores`, 70, 380, { tam: 24, cor: INK2, peso: 500 });
      cartao(ctx, 30, 480, SW - 60, 520);
      texto(ctx, "Por mês", 70, 540, { tam: 26, cor: INK, peso: 700 });
      const ms = dv.meses.length ? dv.meses : Array.from({ length: 12 }, (_, i) => ["", 0]);
      const mx = Math.max(1, ...ms.map((m) => m[1])), bw = (SW - 140) / ms.length;
      ms.forEach(([m, v], i) => {
        const q = mola((lt - 0.8 - i * 0.06) / 0.6), h = (v / mx) * 340 * clamp(q);
        ctx.beginPath(); ctx.roundRect(70 + i * bw + bw * 0.15, 940 - h, bw * 0.7, Math.max(4, h), [10, 10, 3, 3]);
        ctx.fillStyle = i === ms.length - 1 ? VERDE : "#34c75988"; ctx.fill();
        if (m) texto(ctx, ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][Number(m.slice(5, 7)) - 1], 70 + i * bw + bw / 2, 975, { tam: 18, cor: INK2, alinha: "center" });
      });
    },
    analise(ctx, lt, d, o) {
      const a = d.ativo;
      if (a) {
        cartao(ctx, 30, 150, SW - 60, 420);
        texto(ctx, a.ticker, 70, 225, { tam: 44, cor: INK, peso: 800 });
        const sc = a.score * eOut((lt - 0.4) / 1.2);
        ctx.save(); ctx.lineWidth = 16; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(SW - 130, 220, 52, 0, 6.283); ctx.strokeStyle = "#f2f2f7"; ctx.stroke();
        ctx.beginPath(); ctx.arc(SW - 130, 220, 52, -Math.PI / 2, -Math.PI / 2 + (sc / 100) * 6.283);
        ctx.strokeStyle = a.cor === "verde" ? "#34c759" : a.cor === "amarelo" ? "#ff9f0a" : "#ff3b30"; ctx.stroke(); ctx.restore();
        texto(ctx, String(Math.round(sc)), SW - 130, 234, { tam: 38, cor: INK, peso: 800, alinha: "center" });
        texto(ctx, a.veredito || "", 70, 270, { tam: 24, cor: INK2, peso: 500 });
        texto(ctx, "PREÇO JUSTO DE GRAHAM", 70, 350, { tam: 20, cor: INK2, peso: 700 });
        texto(ctx, "R$ " + nf1.format(a.graham).replace(",0", ""), 70, 410, { tam: 50, cor: INK, peso: 800 });
        const topo = Math.max(a.preco, a.graham) * 1.2, q = eOut((lt - 1) / 1);
        ctx.fillStyle = "#e5e5ea"; ctx.beginPath(); ctx.roundRect(70, 460, SW - 140, 12, 6); ctx.fill();
        const xp = 70 + (a.preco / topo) * (SW - 140), xj = 70 + (a.graham / topo) * (SW - 140) * q + (1 - q) * (xp - 70);
        ctx.fillStyle = a.margem >= 0 ? "#34c75988" : "#ff3b3088"; ctx.fillRect(Math.min(xp, xj), 460, Math.abs(xj - xp), 12);
        ctx.fillStyle = INK; ctx.fillRect(xp - 3, 446, 6, 40); ctx.fillStyle = AZUL; ctx.fillRect(xj - 3, 446, 6, 40);
        texto(ctx, `margem de segurança ${pct(a.margem)}`, 70, 530, { tam: 24, cor: a.margem >= 0 ? VERDE : VERM, peso: 700, alpha: q });
      }
      const f = d.fii;
      if (f) {
        const y = a ? 600 : 150, al = eOut((lt - 1.8) / 0.5); if (al <= 0) return;
        ctx.save(); ctx.globalAlpha = al; cartao(ctx, 30, y, SW - 60, 400);
        texto(ctx, "RAIO-X DO FUNDO", 70, y + 60, { tam: 20, cor: INK2, peso: 700 });
        texto(ctx, `${f.ticker} · ${f.tipo}`, 70, y + 115, { tam: 36, cor: INK, peso: 800 });
        const fatos = [[f.vacFis != null ? pct(f.vacFis, false) : null, "vacância física"], [f.vacFin != null ? pct(f.vacFin, false) : null, "vacância financeira"],
          [f.maior != null ? pct(f.maior, false) : null, "maior posição"], [f.n ? String(f.n) : null, f.tipo === "Papel (CRI)" ? "CRIs" : f.tipo === "Fundo de fundos" ? "FIIs na carteira" : "imóveis"]].filter((x) => x[0]);
        fatos.slice(0, 4).forEach(([v, r], i) => {
          const cx = 70 + (i % 2) * 280, cy = y + 200 + Math.floor(i / 2) * 120;
          texto(ctx, v, cx, cy, { tam: 44, cor: INK, peso: 800 }); texto(ctx, r, cx, cy + 36, { tam: 22, cor: INK2, peso: 500 });
        });
        ctx.restore();
      }
    },
    rf(ctx, lt, d, o) {
      cartao(ctx, 30, 150, SW - 60, 120 + Math.max(1, d.rf.length) * 130);
      texto(ctx, "Renda fixa", 70, 215, { tam: 30, cor: INK, peso: 800 });
      d.rf.forEach((r, i) => {
        const y = 270 + i * 130, a = eOut((lt - 0.5 - i * 0.2) / 0.5); if (a <= 0) return;
        ctx.save(); ctx.globalAlpha = a;
        texto(ctx, r.nome.length > 24 ? r.nome.slice(0, 23) + "…" : r.nome, 70, y + 40, { tam: 25, cor: INK, peso: 700 });
        texto(ctx, r.base || "", 70, y + 76, { tam: 21, cor: INK2, peso: 500 });
        texto(ctx, o.privado ? "" : brl(r.valor, o), SW - 70, y + 40, { tam: 25, cor: INK, peso: 700, alinha: "right" });
        if (r.ganho != null) texto(ctx, `${r.ganho >= 0 ? "+" : "−"}${o.privado ? "" : brl(Math.abs(r.ganho), o)} rendendo`, SW - 70, y + 76, { tam: 21, cor: VERDE, peso: 700, alinha: "right" });
        ctx.restore();
      });
      if (d.plano) {
        const y = 330 + Math.max(1, d.rf.length) * 130, a = eOut((lt - 1.6) / 0.5);
        ctx.save(); ctx.globalAlpha = a; cartao(ctx, 30, y, SW - 60, 300);
        texto(ctx, "Plano do mês", 70, y + 70, { tam: 30, cor: INK, peso: 800 });
        texto(ctx, d.plano.pct != null ? `${d.plano.pct}% do salário vira investimento` : "um valor fixo por mês para investir", 70, y + 115, { tam: 23, cor: INK2, peso: 500 });
        if (d.plano.cumprido != null) {
          const q = eOut((lt - 1.8) / 1.2) * d.plano.cumprido / 100;
          ctx.lineWidth = 26; ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(SW - 150, y + 190, 70, 0, 6.283); ctx.strokeStyle = "#f2f2f7"; ctx.stroke();
          if (q > 0.001) { ctx.beginPath(); ctx.arc(SW - 150, y + 190, 70, -Math.PI / 2, -Math.PI / 2 + q * 6.283); ctx.strokeStyle = AZUL; ctx.stroke(); }
          texto(ctx, Math.round(q * 100) + "%", SW - 150, y + 202, { tam: 30, cor: INK, peso: 800, alinha: "center" });
          texto(ctx, `do plano de ${d.plano.mes} cumprido`, 70, y + 230, { tam: 23, cor: INK2, peso: 500 });
        }
        ctx.restore();
      }
    },
    seguranca(ctx, lt, d) {
      cartao(ctx, 30, 150, SW - 60, 420);
      const q = mola(lt / 0.8);
      ctx.save(); ctx.translate(SW / 2, 300); ctx.scale(q, q);
      ctx.beginPath(); ctx.arc(0, 0, 90, 0, 6.283); ctx.fillStyle = "#34c75922"; ctx.fill();
      ctx.strokeStyle = "#248a3d"; ctx.lineWidth = 9; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -55); ctx.lineTo(48, -36); ctx.lineTo(48, 5); ctx.quadraticCurveTo(44, 46, 0, 62); ctx.quadraticCurveTo(-44, 46, -48, 5); ctx.lineTo(-48, -36); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, 2); ctx.lineTo(-4, 18); ctx.lineTo(24, -12); ctx.stroke();
      ctx.restore();
      texto(ctx, "Verificação em duas etapas", SW / 2, 470, { tam: 28, cor: INK, peso: 800, alinha: "center" });
      texto(ctx, "opcional, em Ajustes", SW / 2, 512, { tam: 24, cor: VERDE, peso: 700, alinha: "center" });
      const a = eOut((lt - 1) / 0.5);
      ctx.save(); ctx.globalAlpha = a;
      ctx.beginPath(); ctx.roundRect(30, 610, SW - 60, 380, 34);
      const g = ctx.createLinearGradient(30, 610, SW - 30, 990); g.addColorStop(0, "#2a1bff"); g.addColorStop(1, "#7b2fff"); ctx.fillStyle = g; ctx.fill();
      texto(ctx, "SUA RETROSPECTIVA", 70, 680, { tam: 20, cor: "#ffe14d", peso: 800 });
      texto(ctx, d.mes + ",", 70, 770, { tam: 60, cor: "#fff", peso: 800 });
      texto(ctx, "foi assim.", 70, 840, { tam: 60, cor: "#fff", peso: 800 });
      ctx.beginPath(); ctx.arc(SW - 120, 900, 46, 0, 6.283); ctx.fillStyle = "#ffe14d"; ctx.fill();
      ctx.fillStyle = "#2a1bff"; ctx.beginPath(); ctx.moveTo(SW - 132, 878); ctx.lineTo(SW - 132, 922); ctx.lineTo(SW - 98, 900); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
  };

  function layout(W, H) {
    if (H > W) return { tx: 110, ty: 250, tl: W - 220, tam: 92, sub: 36, fone: { w: 700, h: 1212, x: (W - 700) / 2, y: 650 }, alinha: "left" };
    return { tx: 140, ty: 380, tl: 860, tam: 104, sub: 36, fone: { w: 520, h: 900, x: 1220, y: (H - 900) / 2 }, alinha: "left" };
  }

  function fundo(ctx, W, H, t, d) {
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, "#050f2b"); g.addColorStop(0.6, "#0d1446"); g.addColorStop(1, "#1d1257");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = rng(d.seed);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    [["10,132,255", 0.45], ["94,92,230", 0.42], ["100,210,255", 0.18]].forEach(([c, a], i) => {
      const x = W * (0.5 + 0.4 * Math.sin(t * (0.12 + r() * 0.1) + r() * 6)), y = H * (0.45 + 0.35 * Math.cos(t * 0.1 + r() * 6 + i));
      const rad = Math.max(W, H) * 0.42;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, `rgba(${c},${a})`); rg.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    });
    ctx.restore();
  }

  function telefone(ctx, f, t, d, o) {
    // o celular entra subindo na 1ª cena com ele e sai antes da chamada final
    const pri = CENAS.find((c) => c.telefone !== false), ult = [...CENAS].reverse().find((c) => c.telefone !== false);
    const ent = eOut((t - pri.ini) / 0.9), sai = 1 - eInOut((t - (ult.fim - 0.6)) / 0.6);
    const a = Math.min(ent, sai);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - ent) * 220 + (1 - sai) * 120);
    ctx.shadowColor = "rgba(10,132,255,0.45)"; ctx.shadowBlur = 90;
    ctx.beginPath(); ctx.roundRect(f.x, f.y, f.w, f.h, f.w * 0.13); ctx.fillStyle = "#0b0b0f"; ctx.fill(); ctx.shadowColor = "transparent";
    const bz = f.w * 0.032, sx = f.x + bz, sy = f.y + bz, sw = f.w - bz * 2, sh = f.h - bz * 2;
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, f.w * 0.11); ctx.save(); ctx.clip();
    ctx.fillStyle = "#f5f5f7"; ctx.fillRect(sx, sy, sw, sh);
    const k = sw / SW;
    ctx.translate(sx, sy); ctx.scale(k, k);
    // barra de status e topo do app
    texto(ctx, "9:41", 60, 54, { tam: 24, cor: INK, peso: 700 });
    ctx.beginPath(); ctx.roundRect(SW / 2 - 70, 18, 140, 40, 20); ctx.fillStyle = "#0b0b0f"; ctx.fill();
    logo(ctx, 62, 105, 40); texto(ctx, "Finance Control", 94, 114, { tam: 25, cor: INK, peso: 700 });
    // a tela atual entra deslizando da direita, como navegação do app
    const i = CENAS.findIndex((c) => t >= c.ini && t < c.fim);
    const c = CENAS[Math.max(0, i)];
    const desenha = (cena, lt, dx) => { if (!TELAS[cena.id]) return; ctx.save(); ctx.translate(dx, 0); TELAS[cena.id](ctx, lt, d, o); ctx.restore(); };
    const lt = t - c.ini, prev = CENAS[i - 1];
    if (prev && TELAS[prev.id] && lt < 0.5) {
      const q = eInOut(lt / 0.5);
      desenha(prev, prev.dur, -q * SW * 0.35);
      ctx.save(); ctx.globalAlpha = q; ctx.fillStyle = "#f5f5f7"; ctx.fillRect(0, 140, SW, SH); ctx.restore();
      desenha(c, lt, (1 - q) * SW);
    } else desenha(c, lt, 0);
    ctx.restore(); ctx.restore();
  }

  function render(ctx, t, d, o = {}) {
    const W = ctx.canvas.width, H = ctx.canvas.height, L = layout(W, H);
    t = clamp(t, 0, TOTAL - 1e-6);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    fundo(ctx, W, H, t, d);
    const i = CENAS.findIndex((c) => t >= c.ini && t < c.fim), c = CENAS[i], lt = t - c.ini;
    if (c.id === "abertura" || c.id === "chamada") {
      const sai = c.id === "abertura" ? 1 - eInOut((lt - (c.dur - 0.5)) / 0.5) : 1;
      const q = mola(lt / 1.1);
      ctx.save(); ctx.globalAlpha = sai;
      const cy = H / 2 - (H > W ? 180 : 110);
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(lerp(0.5, 1, q), lerp(0.5, 1, q)); ctx.translate(-W / 2, -cy);
      logo(ctx, W / 2, cy, H > W ? 260 : 220, clamp((lt - 0.2) / 0.9)); ctx.restore();
      texto(ctx, "Finance Control", W / 2, cy + (H > W ? 260 : 210), { tam: H > W ? 96 : 104, peso: 800, alinha: "center", alpha: eOut((lt - 0.4) / 0.5) });
      if (c.id === "abertura") {
        texto(ctx, "Todos os seus investimentos.", W / 2, cy + (H > W ? 350 : 290), { tam: 44, peso: 500, cor: "rgba(235,235,245,0.8)", alinha: "center", alpha: eOut((lt - 0.9) / 0.5) });
        texto(ctx, "Um painel só.", W / 2, cy + (H > W ? 410 : 345), { tam: 44, peso: 700, cor: "#64d2ff", alinha: "center", alpha: eOut((lt - 1.3) / 0.5) });
      } else {
        texto(ctx, o.chamada || "Comece hoje.", W / 2, cy + (H > W ? 350 : 290), { tam: 48, peso: 700, cor: "#64d2ff", alinha: "center", alpha: eOut((lt - 0.9) / 0.5) });
        const qb = mola((lt - 1.3) / 0.8);
        if (qb > 0) {
          ctx.save(); ctx.globalAlpha = clamp(qb); ctx.font = F(800, 42);
          const s = o.site || "", bw = ctx.measureText(s || "Crie sua conta").width + 120, by = cy + (H > W ? 430 : 350);
          ctx.translate(W / 2, by + 50); ctx.scale(lerp(0.85, 1, qb), lerp(0.85, 1, qb));
          ctx.beginPath(); ctx.roundRect(-bw / 2, -50, bw, 100, 50); ctx.fillStyle = "#fff"; ctx.fill();
          ctx.fillStyle = "#2a1bff"; ctx.textAlign = "center"; ctx.fillText(s || "Crie sua conta", 0, 15); ctx.restore();
        }
      }
      ctx.restore();
    } else {
      // título da cena ao lado (ou acima) do celular
      const sai = 1 - eInOut((lt - (c.dur - 0.45)) / 0.45);
      ctx.save(); ctx.globalAlpha = sai;
      const h = titulo(ctx, c.titulo, L.tx, L.ty, lt, { tam: L.tam, larg: L.tl });
      ctx.font = F(500, L.sub);
      quebra(ctx, c.sub, L.tl).forEach((l, k) => texto(ctx, l, L.tx, L.ty + h + 30 + k * L.sub * 1.3, { tam: L.sub, peso: 500, cor: "rgba(235,235,245,0.78)", alpha: eOut((lt - 0.6 - k * 0.1) / 0.5) }));
      ctx.restore();
    }
    telefone(ctx, L.fone, t, d, o);
    ctx.restore();
  }

  // ---------------------------------------------------------------- tela
  FC.abrePromo = function () {
    let d;
    try { d = montaDados(); } catch (e) { return FC.ui.erro(e); }
    if (!FC.estado.bench) FC.mercado.benchmarks(5).then((b) => { FC.estado.bench = b; d = montaDados(); desenha(); }).catch(() => {});
    let formato = FC.local.ler("promo-formato", "vertical"), privado = !!FC.local.ler("promo-privado", false), mudo = false;
    let chamada = FC.local.ler("promo-chamada", "Comece hoje."), site = FC.local.ler("promo-site", location.hostname && !/^(localhost|127\.)/.test(location.hostname) ? location.hostname : "");
    let t = 1.6, tocando = false, t0 = 0, inicio = 0, raf = 0, audio = null, gravando = false;
    const el = document.createElement("div");
    el.className = "promo";
    el.innerHTML = String(html`<div class="promo-caixa">
      <div class="promo-topo"><b>Vídeo de divulgação</b><span class="fraco">feito no navegador com os números desta conta</span>
        <button class="icone-bt" data-c="fechar" aria-label="Fechar">${icone("fechar", 20)}</button></div>
      <div class="promo-corpo">
        <div class="promo-palco"><canvas></canvas><div class="promo-gravando" hidden><span class="ponto-rec"></span><span data-rec>Gravando…</span></div></div>
        <div class="promo-lado">
          <div class="campo"><label>Formato</label><div class="segmentado" id="pr-formato">
            <button type="button" data-f="vertical" aria-pressed="${formato === "vertical"}">Vertical 9:16</button>
            <button type="button" data-f="horizontal" aria-pressed="${formato === "horizontal"}">Horizontal 16:9</button></div></div>
          <label class="check"><span class="interruptor"><input type="checkbox" id="pr-privado" ${privado ? "checked" : ""}><span></span></span> Esconder valores em reais</label>
          <div class="campo"><label for="pr-chamada">Frase final</label><input class="entrada" id="pr-chamada" maxlength="40" value="${chamada}"></div>
          <div class="campo"><label for="pr-site">Endereço no botão final</label><input class="entrada" id="pr-site" maxlength="40" value="${site}" placeholder="seusite.com.br"></div>
          <div class="promo-controles">
            <button class="botao sec" data-c="play">${icone("play", 18)} Assistir</button>
            <button class="icone-bt" data-c="mudo" aria-label="Som">${icone("som", 20)}</button>
            <input type="range" class="recap-barra" min="0" max="1000" value="0" aria-label="Posição">
          </div>
          <button class="botao" data-c="exportar">${icone("exportar", 18)} Exportar vídeo</button>
          <p class="texto-p">${Math.round(TOTAL)} s com trilha. A gravação leva o tempo do vídeo — mantenha esta aba aberta. Para divulgar, prefira a conta de demonstração ou esconda os valores.</p>
        </div>
      </div></div>`);
    document.body.appendChild(el);
    document.documentElement.classList.add("ob-aberto");
    const canvas = FC.$("canvas", el), ctx = canvas.getContext("2d"), barra = FC.$(".recap-barra", el);
    const opts = () => ({ privado, chamada, site });
    function dimensiona() {
      const [w, h] = formato === "vertical" ? [1080, 1920] : [1920, 1080];
      canvas.width = w; canvas.height = h;
      FC.$(".promo-palco", el).classList.toggle("horizontal", formato !== "vertical");
    }
    function desenha() {
      render(ctx, t, d, opts());
      barra.value = String(Math.round((t / TOTAL) * 1000)); barra.style.setProperty("--p", (t / TOTAL) * 100 + "%");
    }
    function quadro(agora) {
      if (!tocando) return;
      t = t0 + (agora - inicio) / 1000;
      if (t >= TOTAL) { t = TOTAL; para(); if (gravando) gravando.fim(); }
      desenha();
      if (tocando) raf = requestAnimationFrame(quadro);
    }
    function garanteAudio() {
      if (!audio) { try { audio = FC.recapAudio.criar(d, { linha: linhaDoTempo() }); audio.mudo(mudo); } catch (e) { console.error(e); } }
      if (audio) audio.retoma();
    }
    function toca() {
      if (t >= TOTAL - 0.01) t = 0;
      garanteAudio(); tocando = true; t0 = t; inicio = performance.now();
      if (audio) audio.toca(t);
      FC.$("[data-c=play]", el).innerHTML = String(html`${icone("pausa", 18)} Pausar`);
      raf = requestAnimationFrame(quadro);
    }
    function para() {
      tocando = false; cancelAnimationFrame(raf); if (audio) audio.para();
      FC.$("[data-c=play]", el).innerHTML = String(html`${icone("play", 18)} Assistir`);
    }
    function fecha() { para(); if (audio) audio.fecha(); el.remove(); document.documentElement.classList.remove("ob-aberto"); document.removeEventListener("keydown", tecla); }
    const tecla = (e) => { if (e.key === "Escape" && !gravando) fecha(); };
    document.addEventListener("keydown", tecla);
    FC.$("[data-c=fechar]", el).addEventListener("click", () => { if (!gravando) fecha(); });
    FC.$("[data-c=play]", el).addEventListener("click", () => (tocando ? para() : toca()));
    FC.$("[data-c=mudo]", el).addEventListener("click", (e) => { mudo = !mudo; if (audio) audio.mudo(mudo); e.currentTarget.innerHTML = String(icone(mudo ? "somDesligado" : "som", 20)); });
    barra.addEventListener("input", () => { t = (Number(barra.value) / 1000) * TOTAL; if (tocando) { t0 = t; inicio = performance.now(); if (audio) audio.toca(t); } desenha(); });
    FC.$$("#pr-formato button", el).forEach((b) => b.addEventListener("click", () => {
      formato = b.dataset.f; FC.local.gravar("promo-formato", formato);
      FC.$$("#pr-formato button", el).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      FC.ui.segmentado(FC.$("#pr-formato", el)); dimensiona(); desenha();
    }));
    FC.$("#pr-privado", el).addEventListener("change", (e) => { privado = e.target.checked; FC.local.gravar("promo-privado", privado); desenha(); });
    FC.$("#pr-chamada", el).addEventListener("input", (e) => { chamada = e.target.value; FC.local.gravar("promo-chamada", chamada); desenha(); });
    FC.$("#pr-site", el).addEventListener("input", (e) => { site = e.target.value.trim(); FC.local.gravar("promo-site", site); desenha(); });
    FC.$("[data-c=exportar]", el).addEventListener("click", () => {
      if (gravando) return;
      if (!window.MediaRecorder || !canvas.captureStream) return FC.ui.aviso("Este navegador não grava vídeo. Use o Chrome, o Edge ou o Safari atualizado.", "erro");
      const tipo = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((x) => MediaRecorder.isTypeSupported(x));
      if (!tipo) return FC.ui.aviso("Este navegador não grava vídeo neste formato.", "erro");
      para(); garanteAudio();
      const stream = canvas.captureStream(30);
      if (audio) audio.fluxo.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 });
      const partes = []; rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      const aviso = FC.$(".promo-gravando", el), rot = FC.$("[data-rec]", el);
      el.classList.add("gravando"); aviso.hidden = false;
      const rel = setInterval(() => { rot.textContent = `Gravando… ${Math.floor(t)} de ${Math.round(TOTAL)} s`; }, 250);
      gravando = { fim() { clearInterval(rel); setTimeout(() => rec.stop(), 300); } };
      rec.onstop = () => {
        const blob = new Blob(partes, { type: tipo.split(";")[0] });
        const url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = `finance-control-divulgacao-${formato}.${tipo.startsWith("video/mp4") ? "mp4" : "webm"}`;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
        el.classList.remove("gravando"); aviso.hidden = true; gravando = false;
        stream.getVideoTracks().forEach((tr) => tr.stop());
        FC.ui.aviso(`Vídeo salvo (${(blob.size / 1048576).toFixed(1)} MB)`);
      };
      rec.start(250); t = 0; toca();
    });
    dimensiona(); FC.ui.segmentado(FC.$("#pr-formato", el)); desenha();
    return { _quadro: (x) => { t = x; desenha(); }, canvas };
  };

  FC.promo = { render, montaDados, TOTAL, CENAS };
})();
