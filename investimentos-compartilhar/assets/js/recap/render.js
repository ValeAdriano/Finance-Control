/* Retrospectiva — o quadro do vídeo, no estilo stories.
 *
 * render(ctx, t, data, opts) desenha o instante t (segundos) num canvas
 * 1080×1920. Pura: mesma entrada, mesmo quadro; aleatoriedade só pela
 * semente do mês. Cada etapa tem uma cor sólida, tipografia enorme e
 * formas em movimento; a troca de etapa é uma cortina circular na cor
 * da próxima. opts: { privado, reduzido }. */
(function () {
  const FC = window.FC;
  const R = () => FC.recap;
  const W = 1080, H = 1920, SAFE = 120, CX = W / 2;
  const FONTE = '-apple-system, "SF Pro Display", "Helvetica Neue", "Segoe UI", Arial, sans-serif';
  const F = (peso, tam) => `${peso} ${tam}px ${FONTE}`;
  const LOGO = ["M4 17l5-5 4 3 7-8", "M15 7h5v5"];     // o logo original do app, grade 24×24
  const BOTAO_FINAL = { x: SAFE, y: 1560, w: W - SAFE * 2, h: 132 };
  const GANHO = "#1ed760", PERDA = "#ff5c5c";

  // paleta de cada etapa: fundo, cor da tinta, destaque e a cor das formas
  const PALETA = {
    abertura:   { fundo: "#2a1bff", tinta: "#ffffff", destaque: "#ffe14d", forma: "#4a3dff" },
    resultado:  { fundo: "#0c0c0f", tinta: "#ffffff", destaque: null, forma: "#26262e" },
    aportes:    { fundo: "#ff4fa3", tinta: "#1b0030", destaque: "#2a1bff", forma: "#ff7dbd" },
    renda:      { fundo: "#ffb020", tinta: "#1c0d00", destaque: "#1c0d00", forma: "#ffc555" },
    dividendos: { fundo: "#7b2fff", tinta: "#ffffff", destaque: "#ffe14d", forma: "#9255ff" },
    destaques:  { fundo: "#00c2ff", tinta: "#001b26", destaque: "#001b26", forma: "#4dd6ff" },
    alocacao:   { fundo: "#0c0c0f", tinta: "#ffffff", destaque: "#ffe14d", forma: "#26262e" },
    extra:      { fundo: "#e8c07d", tinta: "#2a1800", destaque: "#2a1800", forma: "#f0d29f" },
    meses:      { fundo: "#ffe14d", tinta: "#1b0030", destaque: "#2a1bff", forma: "#ffea80" },
    final:      { fundo: "#2a1bff", tinta: "#ffffff", destaque: "#ffe14d", forma: "#4a3dff" },
  };

  // ---------------------------------------------------------------- utilidades
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, q) => a + (b - a) * q;
  const eOut = (q) => 1 - Math.pow(1 - clamp(q), 3);
  const eOutExpo = (q) => (q >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(q)));
  const eInOut = (q) => { q = clamp(q); return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; };
  const mola = (q) => { q = clamp(q); return 1 - Math.pow(Math.E, -6.5 * q) * Math.cos(10 * q); };
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  const cachePlano = new WeakMap();
  function planoDe(data, opts) {
    const chave = opts.privado ? "p" : "n";
    let c = cachePlano.get(data);
    if (!c) { c = {}; cachePlano.set(data, c); }
    if (!c[chave]) c[chave] = { plano: R().plano(data, opts), textos: R().textos(data, opts) };
    return c[chave];
  }
  const cacheGrao = new Map();
  function grao(seed) {
    if (cacheGrao.has(seed)) return cacheGrao.get(seed);
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d"), img = g.createImageData(256, 256), r = rng(seed ^ 0x9e3779b9);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    cacheGrao.set(seed, c);
    return c;
  }
  const temEspaco = typeof CanvasRenderingContext2D !== "undefined" && "letterSpacing" in CanvasRenderingContext2D.prototype;
  function fonte(ctx, peso, tam, esp = 0) {
    ctx.font = F(peso, tam);
    if (temEspaco) ctx.letterSpacing = esp + "px";
  }

  function texto(ctx, s, x, y, { tam = 44, peso = 600, cor = "#fff", alinha = "left", alpha = 1, esp = 0 } = {}) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    fonte(ctx, peso, tam, esp); ctx.textAlign = alinha; ctx.textBaseline = "alphabetic"; ctx.fillStyle = cor;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  // título cinético: cada linha sobe de trás de uma máscara, uma após a outra
  function titulo(ctx, linhas, x, y, lt, t0, { tam = 150, peso = 900, cor = "#fff", alt = 0.98, esp = -5, reduzido = false } = {}) {
    ctx.save();
    fonte(ctx, peso, tam, esp);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const k = Math.min(1, (W - SAFE - x) / Math.max(...linhas.map((l) => ctx.measureText(l).width)));
    linhas.forEach((ln, i) => {
      const q = reduzido ? eOut((lt - t0) / 0.4) : eOut((lt - t0 - i * 0.13) / 0.55);
      if (q <= 0) return;
      const yy = y + i * tam * alt * k;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, yy - tam * k * 0.95, W, tam * k * 1.2); ctx.clip();
      if (reduzido) ctx.globalAlpha *= q;
      ctx.translate(x, yy + (reduzido ? 0 : (1 - q) * tam * k * 1.1)); ctx.scale(k, k);
      ctx.fillStyle = cor;
      ctx.fillText(ln, 0, 0);
      ctx.restore();
    });
    ctx.restore();
    return linhas.length * tam * alt * k;
  }

  // frase que entra palavra por palavra, quebrada na largura
  function frase(ctx, s, x, y, lt, t0, { tam = 50, peso = 600, cor = "#fff", maxW = W - SAFE * 2, alt = 1.25, reduzido = false } = {}) {
    ctx.save();
    fonte(ctx, peso, tam, -0.5);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const esp = ctx.measureText(" ").width, linhas = [[]];
    let larg = 0;
    for (const w of s.split(" ")) {
      const lw = ctx.measureText(w).width;
      if (larg + lw > maxW && linhas.at(-1).length) { linhas.push([]); larg = 0; }
      linhas.at(-1).push({ w, lw }); larg += lw + esp;
    }
    let k = 0;
    linhas.forEach((ln, i) => {
      let xx = x;
      for (const p of ln) {
        const q = reduzido ? eOut((lt - t0) / 0.4) : eOut((lt - t0 - k * 0.055) / 0.4);
        if (q > 0) {
          ctx.globalAlpha = q; ctx.fillStyle = cor;
          ctx.fillText(p.w, xx, y + i * tam * alt + (reduzido ? 0 : (1 - q) * 22));
        }
        xx += p.lw + esp; k++;
      }
    });
    ctx.restore();
    return linhas.length * tam * alt;
  }

  // número gigante que encolhe para caber na área segura
  function numeroGrande(ctx, s, x, y, { tam = 260, cor = "#fff", sombra = null } = {}) {
    ctx.save();
    fonte(ctx, 900, tam, -8);
    const w = ctx.measureText(s).width, k = Math.min(1, (W - SAFE - x) / w);
    ctx.translate(x, y); ctx.scale(k, k);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    if (sombra) { ctx.shadowColor = sombra; ctx.shadowBlur = 50; }
    ctx.fillStyle = cor; ctx.fillText(s, 0, 0);
    ctx.restore();
  }

  // pílula tipo adesivo, levemente girada
  function adesivo(ctx, s, x, y, { fundo = "#fff", cor = "#000", tam = 40, giro = 0, q = 1 } = {}) {
    if (q <= 0) return;
    ctx.save();
    fonte(ctx, 800, tam, -0.5);
    const w = ctx.measureText(s).width + tam * 1.3, h = tam * 1.75;
    ctx.translate(x, y); ctx.rotate(giro); ctx.scale(lerp(0.4, 1, q), lerp(0.4, 1, q));
    ctx.globalAlpha *= clamp(q * 1.6);
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = fundo; ctx.fill();
    ctx.fillStyle = cor; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(s, 0, 2);
    ctx.restore();
  }

  function logo(ctx, x, y, tam, desenho = 1, sombra = true) {
    ctx.save();
    ctx.translate(x - tam / 2, y - tam / 2);
    const g = ctx.createLinearGradient(0, 0, tam, tam);
    g.addColorStop(0, "#0a84ff"); g.addColorStop(1, "#5e5ce6");
    if (sombra) { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = tam * 0.3; ctx.shadowOffsetY = tam * 0.08; }
    ctx.beginPath(); ctx.roundRect(0, 0, tam, tam, tam * 0.24); ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = "transparent";
    const k = (tam * 0.62) / 24;
    ctx.translate(tam * 0.19, tam * 0.19); ctx.scale(k, k);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    // desenha o traço do começo ao fim (os dois trechos têm menos de 40 unidades)
    if (desenho < 1) ctx.setLineDash([Math.max(0.001, desenho * 40), 40]);
    for (const p of LOGO) ctx.stroke(new Path2D(p));
    ctx.restore();
  }

  const conta = (c, t, de, ate) => (c ? lerp(de, ate, eOutExpo((t - c.ini) / c.dur)) : ate);
  const rotulo = (ctx, s, cor, lt) => texto(ctx, s, SAFE, 330, { tam: 38, peso: 800, cor, esp: 3, alpha: eOut(lt / 0.4) });

  // ---------------------------------------------------------------- fundos
  // letreiro que rola em diagonal, repetido — a assinatura visual do Wrapped
  function letreiro(ctx, s, y, lt, { cor, tam = 150, vel = 90, giro = -0.12, reduzido = false } = {}) {
    ctx.save();
    ctx.translate(CX, y); ctx.rotate(giro);
    fonte(ctx, 900, tam, -4);
    ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillStyle = cor;
    const bloco = s + "  •  ", w = ctx.measureText(bloco).width;
    const off = -(((reduzido ? 0 : lt * vel) % w) + w);
    for (let x = off - W; x < W * 1.2; x += w) ctx.fillText(bloco, x, 0);
    ctx.restore();
  }

  function formas(ctx, id, lt, data, opts) {
    const p = PALETA[id], r = rng(data.seed ^ (id.length * 7919)), red = opts.reduzido;
    const gira = red ? 0 : lt * 0.35;
    ctx.save();
    ctx.fillStyle = p.forma; ctx.strokeStyle = p.forma;
    if (id === "abertura" || id === "final") {
      // anéis concêntricos girando atrás de tudo
      ctx.translate(W * 0.85, H * 0.2); ctx.rotate(gira);
      ctx.lineWidth = 46;
      for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(0, 0, i * 110, 0.3 * i, 0.3 * i + 4.4); ctx.stroke(); }
    } else if (id === "aportes" || id === "dividendos") {
      // bolas grandes flutuando
      for (let i = 0; i < 5; i++) {
        const x = r() * W, y = r() * H, raio = 120 + r() * 220, f = r() * 6, m = red ? 0 : 1;
        ctx.beginPath(); ctx.arc(x + Math.sin(lt * 0.8 + f) * 40 * m, y + Math.cos(lt * 0.6 + f) * 50 * m, raio, 0, 6.283); ctx.fill();
      }
    } else if (id === "renda" || id === "extra" || id === "meses") {
      // faixas diagonais correndo
      ctx.translate(CX, H / 2); ctx.rotate(-0.5);
      for (let i = -7; i <= 7; i++) ctx.fillRect(-1600, i * 300 + ((red ? 0 : lt * 40) % 300), 3200, 110);
    } else if (id === "destaques") {
      // estrela de pontas girando
      ctx.translate(W * 0.82, H * 0.82); ctx.rotate(gira);
      ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283, rr = i % 2 ? 260 : 460; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else {
      // resultado e alocação: grade de pontos pulsando
      for (let y = 60; y < H; y += 90) for (let x = 60; x < W; x += 90) {
        const q = red ? 0.5 : 0.5 + 0.5 * Math.sin(lt * 2 + (x + y) * 0.01);
        ctx.globalAlpha = 0.35 + 0.4 * q;
        ctx.beginPath(); ctx.arc(x, y, 4 + 2 * q, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
  }

  function graoPor(ctx, data, t, opts) {
    ctx.save();
    ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = "overlay";
    const off = opts.reduzido ? 0 : Math.floor(t * 12) % 7;
    ctx.translate(off * 37, off * 53);
    ctx.fillStyle = ctx.createPattern(grao(data.seed), "repeat"); ctx.fillRect(-off * 37, -off * 53, W, H);
    ctx.restore();
  }

  // ---------------------------------------------------------------- etapas
  const ETAPAS = {
    abertura(ctx, t, lt, c, d, tx, o) {
      const p = PALETA.abertura, P = d.patrimonio, pe = R().periodo(d);
      letreiro(ctx, pe.ano ? `${pe.nome}  •  SEU ANO` : tx.abertura.rotulo.toUpperCase().replace(" DE ", " "), 1720, lt, { cor: p.forma, tam: 170, vel: 120, reduzido: o.reduzido });
      rotulo(ctx, pe.ano ? "SUA RETROSPECTIVA DO ANO" : "SUA RETROSPECTIVA", p.destaque, lt);
      titulo(ctx, [pe.nome + ",", "foi assim."], SAFE, 520, lt, 0.2, { tam: pe.ano ? 190 : 150, cor: p.tinta, reduzido: o.reduzido });
      const de = P.inicial != null && P.inicial > 0 ? P.inicial : 0;
      const q = eOut((lt - 1.6) / 0.5);
      texto(ctx, tx.abertura.sub !== "Seu patrimônio" ? `${pe.primeiro}. Patrimônio:` : d.parcial ? `Seu patrimônio ${pe.o === "o ano" ? "neste ano" : "neste mês"}, até agora:` : `Seu patrimônio fechou ${pe.o} em`, SAFE, 1030, { tam: 44, peso: 700, cor: p.tinta, alpha: q });
      if (q > 0) {
        ctx.save(); ctx.globalAlpha = q;
        numeroGrande(ctx, R().brl(conta(c.contador, t, de, P.final), o.privado), SAFE, 1250, { tam: 190, cor: p.destaque });
        ctx.restore();
      }
      if (o.privado) texto(ctx, "valores escondidos", SAFE, 1330, { tam: 34, peso: 700, cor: p.tinta, alpha: q * 0.7 });
    },

    resultado(ctx, t, lt, c, d, tx, o) {
      const P = d.patrimonio, pos = tx.resultado.positivo, v = tx.resultado.valor || 0;   // rendimento, sem os aportes
      const cor = Math.abs(v) < 0.05 ? "#ffffff" : pos ? GANHO : PERDA;
      rotulo(ctx, tx.resultado.rotulo.toUpperCase(), "rgba(255,255,255,0.6)", lt);
      // a linha do mês, grande, desenhando
      const serie = (P.serie || []).map((x) => x[1]);
      if (serie.length > 1) {
        const mn = Math.min(...serie), mx = Math.max(...serie), amp = mx - mn || 1;
        const yT = 1000, yB = 1400, q = o.reduzido ? eOut(lt / 0.6) : eInOut((lt - 0.2) / 1.6);
        const n = q * (serie.length - 1), pts = [];
        for (let i = 0; i <= Math.floor(n); i++) pts.push([lerp(0, W, i / (serie.length - 1)), yB - ((serie[i] - mn) / amp) * (yB - yT)]);
        if (pts.length > 1) {
          ctx.save();
          const g = ctx.createLinearGradient(0, yT, 0, H);
          g.addColorStop(0, cor + "55"); g.addColorStop(1, cor + "00");
          ctx.beginPath(); ctx.moveTo(pts[0][0], H); pts.forEach((pt) => ctx.lineTo(pt[0], pt[1])); ctx.lineTo(pts.at(-1)[0], H); ctx.closePath();
          ctx.fillStyle = g; ctx.fill();
          ctx.beginPath(); pts.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
          ctx.lineWidth = 14; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = cor;
          ctx.shadowColor = cor; ctx.shadowBlur = 30; ctx.stroke();
          ctx.restore();
        }
      }
      if (pos && v >= 0.05 && !o.reduzido) confete(ctx, d.seed, lt - 1.9, [GANHO, "#ffe14d", "#ffffff", "#00c2ff"]);
      numeroGrande(ctx, R().pct(conta(c.contador, t, 0, v)), SAFE, 690, { tam: 330, cor, sombra: cor + "88" });
      if (!o.privado && P.rendimento != null) {
        const vr = conta(c.contador, t, 0, P.rendimento);
        texto(ctx, (vr >= 0 ? "+" : "") + R().brl(vr).replace("R$ −", "−R$ "), SAFE, 800, { tam: 60, peso: 800, cor: "#fff", alpha: eOut((lt - 0.9) / 0.4) });
      }
      frase(ctx, tx.resultado.frase, SAFE, 1570, lt, 1.5, { tam: 48, reduzido: o.reduzido });
    },

    aportes(ctx, t, lt, c, d, tx, o) {
      const p = PALETA.aportes, A = d.aportes, info = tx.aportes;
      const pe = R().periodo(d);
      rotulo(ctx, "APORTES " + pe.do.toUpperCase(), p.tinta, lt);
      if (info.pausa) {
        titulo(ctx, [pe.Periodo + " de", "pausa."], SAFE, 560, lt, 0.2, { tam: 190, cor: p.tinta, reduzido: o.reduzido });
        frase(ctx, info.frase, SAFE, 1000, lt, 0.9, { tam: 52, cor: p.tinta, reduzido: o.reduzido });
        return;
      }
      titulo(ctx, ["Você", "investiu"], SAFE, 540, lt, 0.2, { tam: 170, cor: p.tinta, reduzido: o.reduzido });
      const cumprido = A.plano ? A.plano.cumprido_pct : null;
      const s = o.privado
        ? (cumprido != null ? Math.round(conta(c.contador, t, 0, cumprido)) + "%" : String(Math.round(conta(c.contador, t, 0, A.quantidade))))
        : R().brl(conta(c.contador, t, 0, A.total));
      ctx.save(); ctx.globalAlpha = eOut((lt - 0.8) / 0.3);
      numeroGrande(ctx, s, SAFE, 1010, { tam: 230, cor: p.destaque });
      ctx.restore();
      if (o.privado) texto(ctx, cumprido != null ? "do plano " + pe.do : "aportes " + pe.no, SAFE, 1085, { tam: 46, peso: 800, cor: p.tinta, alpha: eOut((lt - 1) / 0.4) });
      // adesivos: os destinos e o plano cumprido
      const chips = (A.por_destino || []).slice(0, 3), rr = rng(d.seed ^ 0xa11);
      chips.forEach((ch, i) => {
        const q = o.reduzido ? eOut((lt - 1.6) / 0.4) : mola((lt - 1.5 - i * 0.2) / 0.7);
        adesivo(ctx, ch.rotulo, SAFE + 170 + i * 260 + (i % 2) * 40, 1230 + (i % 2) * 110, { fundo: i % 2 ? p.destaque : "#ffffff", cor: i % 2 ? "#fff" : p.tinta, tam: 44, giro: (rr() - 0.5) * 0.3, q });
      });
      if (cumprido != null && !o.privado) {
        const q = o.reduzido ? eOut((lt - 2.2) / 0.4) : mola((lt - 2.2) / 0.8);
        adesivo(ctx, `${Math.round(cumprido)}% do plano ✓`, W - SAFE - 230, 1480, { fundo: p.tinta, cor: "#fff", tam: 46, giro: 0.08, q });
      }
      frase(ctx, info.frase, SAFE, 1680, lt, 2.4, { tam: 46, cor: p.tinta, reduzido: o.reduzido });
    },

    renda(ctx, t, lt, c, d, tx, o) {
      const p = PALETA.renda, Rc = d.receitas, taxa = Rc.taxa_investida_pct;
      rotulo(ctx, "DA SUA RENDA", p.tinta, lt);
      if (taxa != null) {
        numeroGrande(ctx, Math.round(conta(c.contador, t, 0, taxa)) + "%", SAFE - 10, 700, { tam: 400, cor: p.tinta });
        titulo(ctx, ["virou", "investimento."], SAFE, 850, lt, 0.9, { tam: 110, cor: p.tinta, reduzido: o.reduzido });
        // grade de 100 quadrados: cada um é 1% da renda
        const lado = 52, gap = 12, x0 = CX - (10 * lado + 9 * gap) / 2, y0 = 1120, cheios = Math.round(taxa);
        for (let i = 0; i < 100; i++) {
          const col = i % 10, lin = Math.floor(i / 10);
          const q = o.reduzido ? eOut((lt - 1.2) / 0.4) : eOut((lt - 1.1 - i * 0.012) / 0.3);
          if (q <= 0) continue;
          ctx.save(); ctx.globalAlpha = q;
          const x = x0 + col * (lado + gap), y = y0 + lin * (lado + gap), k = lerp(0.3, 1, q);
          ctx.translate(x + lado / 2, y + lado / 2); ctx.scale(k, k);
          ctx.beginPath(); ctx.roundRect(-lado / 2, -lado / 2, lado, lado, 14);
          ctx.fillStyle = i < cheios ? p.tinta : "rgba(28,13,0,0.14)"; ctx.fill();
          ctx.restore();
        }
      } else {
        titulo(ctx, ["Você", "recebeu"], SAFE, 560, lt, 0.2, { tam: 170, cor: p.tinta, reduzido: o.reduzido });
        numeroGrande(ctx, R().brl(conta(c.contador, t, 0, Rc.total), o.privado), SAFE, 1000, { tam: 220, cor: p.tinta });
      }
    },

    dividendos(ctx, t, lt, c, d, tx, o) {
      const p = PALETA.dividendos, D = d.dividendos;
      if (!o.reduzido) moedas(ctx, d.seed, lt, p.destaque);
      rotulo(ctx, "DIVIDENDOS", p.destaque, lt);
      titulo(ctx, ["Seus ativos", "te pagaram"], SAFE, 520, lt, 0.2, { tam: 140, cor: p.tinta, reduzido: o.reduzido });
      ctx.save(); ctx.globalAlpha = eOut((lt - 0.8) / 0.3);
      if (o.privado) {
        const pp = d.patrimonio.final ? (D.total / d.patrimonio.final) * 100 : 0;
        numeroGrande(ctx, conta(c.contador, t, 0, pp).toFixed(2).replace(".", ",") + "%", SAFE, 1000, { tam: 230, cor: p.destaque });
        texto(ctx, "do patrimônio, só em proventos", SAFE, 1080, { tam: 46, peso: 800, cor: p.tinta });
      } else numeroGrande(ctx, R().brl(conta(c.contador, t, 0, D.total)), SAFE, 1000, { tam: 230, cor: p.destaque });
      ctx.restore();
      if (D.maior && D.pagamentos > 1) {
        texto(ctx, "QUEM MAIS PAGOU", SAFE, 1300, { tam: 36, peso: 800, cor: p.destaque, esp: 3, alpha: eOut((lt - 1.8) / 0.4) });
        titulo(ctx, [D.maior.ticker], SAFE, 1470, lt, 1.9, { tam: 190, cor: p.tinta, reduzido: o.reduzido });
      }
      adesivo(ctx, `${D.pagamentos} ${D.pagamentos === 1 ? "pagamento" : "pagamentos"}`, W - SAFE - 170, 1650, { fundo: p.destaque, cor: "#1b0030", tam: 44, giro: -0.08, q: o.reduzido ? eOut((lt - 2.3) / 0.4) : mola((lt - 2.3) / 0.8) });
    },

    destaques(ctx, t, lt, c, d, tx, o) {
      const p = PALETA.destaques, info = tx.destaques;
      rotulo(ctx, info.rotulo.toUpperCase(), p.tinta, lt);
      titulo(ctx, ["Quem subiu", "e quem caiu"], SAFE, 510, lt, 0.2, { tam: 130, cor: p.tinta, reduzido: o.reduzido });
      const linha = (item, y, atraso, rot, cor, n) => {
        const q = eOut((lt - atraso) / (o.reduzido ? 0.4 : 0.55));
        if (q <= 0) return;
        ctx.save(); ctx.globalAlpha = q; if (!o.reduzido) ctx.translate((1 - q) * 500, 0);
        texto(ctx, n, SAFE, y + 40, { tam: 170, peso: 900, cor: "rgba(0,27,38,0.22)", esp: -6 });
        texto(ctx, rot, SAFE + 200, y - 50, { tam: 34, peso: 800, cor: p.tinta, esp: 2 });
        const v = lerp(0, item.pct, eOutExpo((lt - atraso - 0.2) / 1.1));
        ctx.save();
        fonte(ctx, 900, 64, -1);
        // a pílula é medida pelo valor final, para não mudar de largura contando
        const s = R().pct(v), w = ctx.measureText(R().pct(item.pct)).width + 70;
        // o código encolhe para não encostar na pílula
        fonte(ctx, 900, 100, -3);
        const kt = Math.min(1, (W - SAFE - w - 30 - (SAFE + 200)) / ctx.measureText(item.ticker).width);
        ctx.save(); ctx.translate(SAFE + 200, y + 40); ctx.scale(kt, kt); ctx.fillStyle = p.tinta; ctx.textAlign = "left"; ctx.fillText(item.ticker, 0, 0); ctx.restore();
        fonte(ctx, 900, 64, -1);
        ctx.beginPath(); ctx.roundRect(W - SAFE - w, y - 50, w, 110, 55); ctx.fillStyle = cor; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s, W - SAFE - w / 2, y + 7);
        ctx.restore();
        ctx.restore();
      };
      if (info.alta) linha(info.alta, 960, 0.8, "MAIOR ALTA", "#0f8a3c", "#1");
      if (info.queda) linha(info.queda, 1260, 1.25, "MAIOR QUEDA", "#d42a2d", "#2");
      frase(ctx, info.queda ? "Oscilar faz parte. O que importa é a carteira inteira." : info.frase, SAFE, 1600, lt, 2.0, { tam: 46, cor: p.tinta, reduzido: o.reduzido });
    },

    // só no ano: a variação de cada mês em barras, do zero para cima ou para baixo
    meses(ctx, t, lt, c, d, tx, o) {
      const p = PALETA.meses, info = tx.meses, ms = d.meses.filter((m) => m.variacao_pct != null);
      rotulo(ctx, "SEU ANO", p.tinta, lt);
      titulo(ctx, ["Mês", "a mês"], SAFE, 510, lt, 0.2, { tam: 170, cor: p.tinta, reduzido: o.reduzido });
      const x0 = SAFE, larg = W - SAFE * 2, y0 = 1140, alt = 270;
      const max = Math.max(...ms.map((m) => Math.abs(m.variacao_pct)), 0.5);
      const passo = larg / ms.length, bw = passo * 0.62;
      ctx.save();
      ctx.fillStyle = "rgba(27,0,48,0.25)"; ctx.fillRect(x0, y0 - 2, larg, 4);
      ms.forEach((m, i) => {
        const q = o.reduzido ? eOut((lt - 0.8) / 0.5) : mola((lt - 0.8 - i * 0.07) / 0.7);
        const h = (m.variacao_pct / max) * alt * Math.max(0, q);
        const x = x0 + i * passo + (passo - bw) / 2;
        const destaque = m === info.melhor || m === info.pior;
        ctx.fillStyle = m.variacao_pct >= 0 ? (destaque ? "#0a7a34" : "#1b9e4b") : (destaque ? "#c0262a" : "#e0484b");
        ctx.beginPath();
        if (h >= 0) ctx.roundRect(x, y0 - h, bw, Math.max(2, h), [12, 12, 2, 2]);
        else ctx.roundRect(x, y0, bw, Math.max(2, -h), [2, 2, 12, 12]);
        ctx.fill();
        texto(ctx, m.rotulo, x + bw / 2, y0 + alt + 60, { tam: 30, peso: 800, cor: p.tinta, alinha: "center", alpha: eOut((lt - 0.6 - i * 0.05) / 0.4) });
      });
      ctx.restore();
      const qa = o.reduzido ? eOut((lt - 2) / 0.4) : mola((lt - 2) / 0.8);
      const posDe = (m) => x0 + ms.indexOf(m) * passo + passo / 2;
      adesivo(ctx, `melhor: ${info.melhor.rotulo} ${R().pct(info.melhor.variacao_pct)}`, Math.min(W - SAFE - 200, Math.max(SAFE + 200, posDe(info.melhor))), y0 - alt - 60, { fundo: p.tinta, cor: "#fff", tam: 40, giro: -0.05, q: qa });
      if (info.pior.variacao_pct < 0) adesivo(ctx, `pior: ${info.pior.rotulo} ${R().pct(info.pior.variacao_pct)}`, Math.min(W - SAFE - 190, Math.max(SAFE + 190, posDe(info.pior))), y0 + alt + 150, { fundo: "#fff", cor: p.tinta, tam: 40, giro: 0.05, q: o.reduzido ? eOut((lt - 2.3) / 0.4) : mola((lt - 2.3) / 0.8) });
      frase(ctx, info.frase, SAFE, 1700, lt, 2.6, { tam: 46, cor: p.tinta, reduzido: o.reduzido });
    },

    alocacao(ctx, t, lt, c, d, tx, o) {
      const itens = (d.alocacao || []).filter((a) => a.pct > 0 || a.meta_pct > 0);
      rotulo(ctx, "SUA CARTEIRA", "rgba(255,255,255,0.6)", lt);
      titulo(ctx, ["Seu dinheiro,", "dividido"], SAFE, 500, lt, 0.2, { tam: 130, cor: "#fff", reduzido: o.reduzido });
      const max = Math.max(...itens.map((a) => Math.max(a.pct, a.meta_pct || 0)), 1);
      const x0 = SAFE, larg = W - SAFE * 2, y0 = 820, passo = Math.min(150, 700 / itens.length);
      itens.forEach((a, i) => {
        const y = y0 + i * passo, q = o.reduzido ? eOut((lt - 0.7) / 0.5) : eOut((lt - 0.8 - i * 0.15) / 0.9);
        const qt = eOut((lt - 0.6 - i * 0.15) / 0.4);
        texto(ctx, a.nome, x0, y, { tam: 40, peso: 800, cor: "#fff", alpha: qt });
        texto(ctx, Math.round(a.pct * q) + "%", x0 + larg, y, { tam: 40, peso: 900, cor: "#fff", alinha: "right", alpha: qt });
        ctx.save();
        ctx.beginPath(); ctx.roundRect(x0, y + 22, larg, 48, 24); ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fill();
        ctx.beginPath(); ctx.roundRect(x0, y + 22, Math.max(48, (larg * a.pct) / max) * q, 48, 24); ctx.fillStyle = a.cor; ctx.fill();
        if (a.meta_pct > 0) {
          ctx.globalAlpha = eOut((lt - 1.8) / 0.4); ctx.fillStyle = "#fff";
          ctx.fillRect(x0 + (larg * a.meta_pct) / max - 3, y + 10, 6, 72);
        }
        ctx.restore();
      });
      const yl = y0 + itens.length * passo + 10;
      texto(ctx, "▮ = sua meta", SAFE, yl, { tam: 32, peso: 700, cor: "rgba(255,255,255,0.55)", alpha: eOut((lt - 2) / 0.4) });
      frase(ctx, tx.alocacao.frase, SAFE, Math.max(yl + 110, 1560), lt, 2.2, { tam: 46, cor: "#fff", reduzido: o.reduzido });
    },

    extra(ctx, t, lt, c, d, tx, o) {
      const p = PALETA.extra;
      rotulo(ctx, tx.extra.rotulo.toUpperCase(), p.tinta, lt);
      if (c.extra === "agro") {
        numeroGrande(ctx, String(Math.round(conta(c.contador, t, 0, d.agro.cabecas))), SAFE - 10, 900, { tam: 560, cor: p.tinta });
        titulo(ctx, [d.agro.cabecas === 1 ? "cabeça" : "cabeças", "no pasto."], SAFE, 1080, lt, 0.9, { tam: 140, cor: p.tinta, reduzido: o.reduzido });
        if (!o.privado) adesivo(ctx, R().brl(d.agro.valor) + " em rebanho", W - SAFE - 300, 1520, { fundo: p.tinta, cor: p.fundo, tam: 44, giro: -0.06, q: o.reduzido ? eOut((lt - 1.8) / 0.4) : mola((lt - 1.8) / 0.8) });
      } else if (c.extra === "despesas") {
        titulo(ctx, ["Onde mais", "foi dinheiro"], SAFE, 560, lt, 0.2, { tam: 140, cor: p.tinta, reduzido: o.reduzido });
        numeroGrande(ctx, d.despesas.campea.rotulo, SAFE, 1000, { tam: 180, cor: p.tinta });
        frase(ctx, tx.extra.frase, SAFE, 1250, lt, 1.2, { tam: 48, cor: p.tinta, reduzido: o.reduzido });
      } else if (c.extra === "ir") {
        titulo(ctx, ["Imposto", "do mês"], SAFE, 560, lt, 0.2, { tam: 170, cor: p.tinta, reduzido: o.reduzido });
        numeroGrande(ctx, R().brl(conta(c.contador, t, 0, d.ir.darf), o.privado), SAFE, 1000, { tam: 200, cor: p.tinta });
        frase(ctx, tx.extra.frase, SAFE, 1250, lt, 1.2, { tam: 48, cor: p.tinta, reduzido: o.reduzido });
      } else if (c.extra === "metas") {
        const m = d.metas.filter((x) => x.alvo > 0).sort((a, b) => b.pct - a.pct)[0];
        titulo(ctx, [m.nome], SAFE, 560, lt, 0.2, { tam: 140, cor: p.tinta, reduzido: o.reduzido });
        numeroGrande(ctx, Math.round(conta(c.contador, t, 0, Math.min(100, m.pct))) + "%", SAFE, 1000, { tam: 300, cor: p.tinta });
        frase(ctx, tx.extra.frase, SAFE, 1250, lt, 1.2, { tam: 48, cor: p.tinta, reduzido: o.reduzido });
      }
    },

    final(ctx, t, lt, c, d, tx, o) {
      const p = PALETA.final, P = d.patrimonio, pe = tx.final.periodo;
      rotulo(ctx, "RESUMO DE " + pe.nome.toUpperCase(), p.destaque, lt);
      // cartão-resumo, o "card de compartilhar"
      const q = o.reduzido ? eOut(lt / 0.5) : mola(lt / 0.9);
      ctx.save();
      ctx.globalAlpha = clamp(q * 1.5);
      if (!o.reduzido) { ctx.translate(CX, 900); ctx.rotate((1 - q) * -0.08); ctx.scale(lerp(0.85, 1, q), lerp(0.85, 1, q)); ctx.translate(-CX, -900); }
      ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
      ctx.beginPath(); ctx.roundRect(SAFE, 420, W - SAFE * 2, 1000, 56); ctx.fillStyle = "#ffe14d"; ctx.fill();
      ctx.shadowColor = "transparent";
      logo(ctx, SAFE + 110, 540, 120, clamp((lt - 0.3) / 0.8), false);
      texto(ctx, "Finance Control", SAFE + 200, 530, { tam: 44, peso: 900, cor: "#1b0030", esp: -1 });
      texto(ctx, tx.final.rotulo, SAFE + 200, 580, { tam: 34, peso: 700, cor: "rgba(27,0,48,0.6)" });
      const v = P.rendimento_pct ?? P.variacao_pct, stats = [
        ["Patrimônio", R().brl(P.final, o.privado)],
        [pe.ano ? "Rendeu no ano" : "Rendeu no mês", v != null ? R().pct(v) : "—"],
        ["Aportes", d.aportes.total > 0 ? R().brl(d.aportes.total, o.privado) : "—"],
        ["Dividendos", d.dividendos.total > 0 ? R().brl(d.dividendos.total, o.privado) : "—"],
      ];
      stats.forEach(([rot, val], i) => {
        const col = i % 2, lin = Math.floor(i / 2);
        const x = SAFE + 60 + col * 420, y = 760 + lin * 300;
        const qa = eOut((lt - 0.5 - i * 0.12) / 0.4);
        texto(ctx, rot.toUpperCase(), x, y, { tam: 30, peso: 800, cor: "rgba(27,0,48,0.55)", esp: 2, alpha: qa });
        const corVal = rot.startsWith("Rendeu") && v != null && Math.abs(v) >= 0.05 ? (v > 0 ? "#0f8a3c" : "#d42a2d") : "#1b0030";
        ctx.save(); ctx.globalAlpha *= qa; fonte(ctx, 900, 72, -3);
        const k = Math.min(1, 380 / ctx.measureText(val).width);
        ctx.translate(x, y + 90); ctx.scale(k, k); ctx.fillStyle = corVal; ctx.textAlign = "left"; ctx.fillText(val, 0, 0);
        ctx.restore();
      });
      ctx.restore();
      // chamada para o dashboard
      const qb = o.reduzido ? eOut((lt - 1) / 0.4) : mola((lt - 1) / 0.8);
      if (qb > 0) {
        const b = BOTAO_FINAL;
        ctx.save(); ctx.globalAlpha = clamp(qb);
        ctx.translate(CX, b.y + b.h / 2); ctx.scale(lerp(0.85, 1, qb), lerp(0.85, 1, qb)); ctx.translate(-CX, -(b.y + b.h / 2));
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2); ctx.fillStyle = "#ffffff"; ctx.fill();
        texto(ctx, `Ver detalhes ${pe.do}  →`, CX, b.y + b.h / 2 + 16, { tam: 46, peso: 900, cor: "#2a1bff", alinha: "center", esp: -1 });
        ctx.restore();
      }
    },
  };

  // efeitos soltos
  function confete(ctx, seed, lt, cores) {
    if (lt < 0 || lt > 3.5) return;
    const r = rng(seed ^ 0xc0ffee);
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const ang = -Math.PI / 2 + (r() - 0.5) * 1.6, vel = 900 + r() * 900, giro = r() * 10, cor = cores[i % cores.length];
      const x = CX + Math.cos(ang) * vel * lt, y = 1500 + Math.sin(ang) * vel * lt + 1100 * lt * lt;
      if (y > H + 40) continue;
      ctx.globalAlpha = clamp(1 - lt / 3.5);
      ctx.save(); ctx.translate(x, y); ctx.rotate(giro + lt * 8);
      ctx.fillStyle = cor; ctx.fillRect(-10, -18, 20, 36);
      ctx.restore();
    }
    ctx.restore();
  }
  function moedas(ctx, seed, lt, cor) {
    const r = rng(seed ^ 0xd1d);
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const x = r() * W, atraso = r() * 2.2, vel = 420 + r() * 300, tam = 30 + r() * 30, gira = r() * 6;
      const q = lt - atraso;
      if (q < 0) continue;
      const y = -60 + q * vel;
      if (y > H + 60) continue;
      ctx.globalAlpha = 0.35;
      ctx.save(); ctx.translate(x, y); ctx.scale(Math.cos(q * 4 + gira), 1);
      ctx.beginPath(); ctx.arc(0, 0, tam, 0, 6.283); ctx.fillStyle = cor; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // desenha uma etapa inteira (fundo, formas, conteúdo) no tempo local lt
  function etapa(ctx, c, t, lt, data, pl, opts) {
    ctx.fillStyle = PALETA[c.id].fundo; ctx.fillRect(0, 0, W, H);
    formas(ctx, c.id, lt, data, opts);
    ETAPAS[c.id](ctx, t, lt, c, data, pl.textos, opts);
  }

  // ---------------------------------------------------------------- render
  function render(ctx, t, data, opts = {}) {
    const pl = planoDe(data, opts), cenas = pl.plano.cenas, troca = pl.plano.troca;
    t = clamp(t, 0, pl.plano.total - 1e-6);
    const i = Math.max(0, cenas.findIndex((c) => t >= c.ini && t < c.fim));
    const c = cenas[i], lt = t - c.ini;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    if (i > 0 && lt < troca) {
      // cortina: a etapa anterior congela e a nova cresce num círculo
      const ant = cenas[i - 1];
      etapa(ctx, ant, ant.fim - 0.001, ant.dur - 0.001, data, pl, opts);
      const q = opts.reduzido ? eOut(lt / troca) : eInOut(lt / troca);
      ctx.save();
      if (opts.reduzido) ctx.globalAlpha = q;
      else {
        const r = rng(data.seed ^ (i * 104729));
        const cx = W * (0.2 + r() * 0.6), cy = H * (0.3 + r() * 0.5);
        ctx.beginPath(); ctx.arc(cx, cy, Math.hypot(W, H) * q, 0, 6.283); ctx.clip();
      }
      etapa(ctx, c, t, lt, data, pl, opts);
      ctx.restore();
    } else etapa(ctx, c, t, lt, data, pl, opts);
    graoPor(ctx, data, t, opts);
    ctx.restore();
  }

  FC.recapRender = {
    render, W, H, BOTAO_FINAL,
    duracao: (data, opts = {}) => planoDe(data, opts).plano.total,
    etapas: (data, opts = {}) => planoDe(data, opts).plano.cenas.map((c) => ({ id: c.id, ini: c.ini, fim: c.fim, cor: PALETA[c.id].fundo })),
  };
})();
