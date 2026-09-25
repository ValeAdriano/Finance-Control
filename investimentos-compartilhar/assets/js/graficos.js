/* Gráficos em SVG, desenhados na largura real do container (texto nítido
 * no celular e no monitor) e animados só na primeira pintura.
 *
 * Cada função devolve um marcador <div data-g>; FC.animar() chama
 * ativar(), que desenha, liga o hover e redesenha ao redimensionar. */
(function () {
  const FC = window.FC;
  const { html, cru, escapa } = FC;
  const ok = FC.ok;
  const registro = {};
  let seq = 0;

  function marcador(altura, desenha, extra = {}) {
    const id = "g" + ++seq;
    registro[id] = { desenha, altura, ...extra };
    return html`<div class="quadro-grafico" data-g="${id}" style="min-height:${altura}px"></div>`;
  }

  const ts = (x) => (typeof x === "string" ? new Date(x.slice(0, 10) + "T12:00:00Z").getTime() : x);

  function escalaNice(lo, hi, n = 4) {
    if (lo === hi) { hi = lo + (Math.abs(lo) || 1); lo = lo - (Math.abs(lo) || 1) * 0.1; }
    const bruto = (hi - lo) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) || bruto;
    const ini = Math.floor(lo / passo) * passo, fim = Math.ceil(hi / passo) * passo;
    const ticks = [];
    for (let v = ini; v <= fim + passo / 2; v += passo) ticks.push(Number(v.toFixed(10)));
    return { lo: ini, hi: fim, ticks };
  }

  const formatos = {
    brl: (v) => FC.fmt.brlCurto(v),
    brlCheio: (v) => FC.fmt.brlTexto(v),
    pct: (v) => FC.fmt.num(v, 1) + "%",
    base100: (v) => FC.fmt.num(v, 0),
    int: (v) => FC.fmt.int(v),
    num: (v) => FC.fmt.num(v, 1),
  };
  const fmtX = {
    data: (x) => FC.datas.mesAno(new Date(x).toISOString().slice(0, 10)),
    dataCheia: (x) => FC.datas.br(new Date(x).toISOString().slice(0, 10)),
    anos: (x) => (x === 0 ? "hoje" : FC.fmt.num(x, x % 1 ? 1 : 0) + (x === 1 ? " ano" : " anos")),
    anosCurto: (x) => FC.fmt.num(x, 0) + "a",
  };

  // ---------------------------------------------------------------- linhas
  // series: [{nome, pontos:[[x,y]], classe:'l1'|'l2'|'lref'..., area?}]
  // banda: {inf:[[x,y]], sup:[[x,y]]}
  function linhas({ series, banda, altura = 260, y = "brl", x = "data", zero = false, degrau = false, privado = true }) {
    const validas = series.filter((s) => s.pontos && s.pontos.length > 1);
    if (!validas.length) return html`<p class="texto-p">Ainda não há dados suficientes para o gráfico.</p>`;
    return marcador(altura, (L) => {
      const H = altura, mE = 58, mD = 14, mT = 12, mB = 28;
      const W = Math.max(L, 280);
      const todos = validas.flatMap((s) => s.pontos).concat(banda ? banda.inf.concat(banda.sup) : []);
      const xs = todos.map((p) => ts(p[0])), ys = todos.map((p) => p[1]).filter(ok);
      let x0 = Math.min(...xs), x1 = Math.max(...xs);
      if (x0 === x1) x1 = x0 + 1;
      const ylo = zero ? Math.min(0, ...ys) : Math.min(...ys), yhi = Math.max(...ys);
      const esc = escalaNice(ylo, yhi);
      const px = (v) => mE + ((ts(v) - x0) / (x1 - x0)) * (W - mE - mD);
      const py = (v) => mT + (1 - (v - esc.lo) / (esc.hi - esc.lo)) * (H - mT - mB);
      const caminho = (pts) => pts.filter((p) => ok(p[1])).map((p, i, arr) => {
        if (!degrau || !i) return (i ? "L" : "M") + px(p[0]).toFixed(1) + " " + py(p[1]).toFixed(1);
        return "H" + px(p[0]).toFixed(1) + "V" + py(p[1]).toFixed(1);
      }).join("");
      let s = `<svg class="grafico" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
        <defs><linearGradient id="grad-s1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--s1)" stop-opacity=".22"/><stop offset="1" stop-color="var(--s1)" stop-opacity="0"/></linearGradient></defs>`;
      // com variação pequena, "R$ 10 mil" se repetiria em todas as linhas:
      // nesse caso o rótulo vai inteiro (R$ 10.050)
      let fy = formatos[y];
      if (y === "brl" && new Set(esc.ticks.map(fy)).size < esc.ticks.length) fy = (v) => FC.fmt.brlTexto(v, 0);
      const mEx = fy === formatos[y] ? 0 : 20;
      for (const t of esc.ticks) {
        s += `<line class="grade-l" x1="${mE}" x2="${W - mD}" y1="${py(t)}" y2="${py(t)}"/>`;
        s += `<text x="${mE - 8}" y="${py(t) + 4}" text-anchor="end" class="${privado && y.startsWith("brl") ? "rs" : ""}" ${mEx ? 'style="font-size:10px"' : ""}>${escapa(fy(t))}</text>`;
      }
      if (zero && esc.lo < 0) s += `<line class="zero" x1="${mE}" x2="${W - mD}" y1="${py(0)}" y2="${py(0)}"/>`;
      // rótulos do eixo x
      const nX = Math.max(2, Math.min(7, Math.floor((W - mE) / 110)));
      let marcasX = [];
      if (x === "anos") {
        // anos inteiros e redondos: 0, 5, 10… em vez de 2,9 / 5,7
        const passo = [1, 2, 5, 10, 20].find((p) => (x1 - x0) / p <= nX) || 20;
        for (let v = Math.ceil(x0 / passo) * passo; v <= x1 + 1e-9; v += passo) marcasX.push(v);
      } else {
        for (let i = 0; i <= nX; i++) marcasX.push(x0 + ((x1 - x0) * i) / nX);
      }
      const curto = x !== "anos" && x1 - x0 < 100 * 86400000;
      let ultimoRot = null;
      marcasX.forEach((val, i) => {
        const rot = x === "anos" ? fmtX.anos(val) : curto ? FC.datas.br(new Date(val).toISOString().slice(0, 10)).slice(0, 5) : fmtX.data(val);
        if (rot === ultimoRot) return;
        ultimoRot = rot;
        const pxv = px(val);
        const anc = pxv < mE + 20 ? "start" : pxv > W - mD - 20 ? "end" : "middle";
        s += `<text x="${pxv}" y="${H - 8}" text-anchor="${anc}">${escapa(rot)}</text>`;
      });
      if (banda) {
        const sup = banda.sup.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`);
        const inf = [...banda.inf].reverse().map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`);
        s += `<polygon class="banda surge" points="${sup.concat(inf).join(" ")}"/>`;
      }
      for (const se of validas) {
        const d = caminho(se.pontos);
        if (se.area) {
          const pts = se.pontos.filter((p) => ok(p[1]));
          s += `<path class="area surge" d="${d}L${px(pts.at(-1)[0]).toFixed(1)} ${py(esc.lo)}L${px(pts[0][0]).toFixed(1)} ${py(esc.lo)}Z"/>`;
        }
        // linha tracejada não pode ser "desenhada": a animação usa o próprio
        // tracejado e a deixaria contínua
        const ref = /^lref/.test(se.classe || "");
        s += `<path class="${se.classe || "l1"} ${ref ? "surge" : "anima"}" d="${d}"/>`;
      }
      s += `<line class="cursor" x1="0" x2="0" y1="${mT}" y2="${H - mB}"/>`;
      validas.forEach((se, i) => { s += `<circle class="ponto-hover" data-s="${i}" r="4.5" cx="-10" cy="-10" style="stroke:var(--${(se.classe || "l1").replace("l", "s").replace("sref", "sref")})"/>`; });
      s += "</svg>";
      return { svg: s, px, py, x0, x1, mE, mD, W };
    }, { hover: { series: validas, y, x, privado } });
  }

  // ---------------------------------------------------------------- colunas
  // barras: [{rotulo, valor, detalhe?: [[nome, valor]]}]
  function colunas({ barras, altura = 220, y = "brl", cor = "var(--s1)", privado = true }) {
    if (!barras.length) return html`<p class="texto-p">Sem dados.</p>`;
    return marcador(altura, (L) => {
      const H = altura, mE = 58, mD = 8, mT = 10, mB = 28, W = Math.max(L, 280);
      const vals = barras.map((b) => b.valor);
      const esc = escalaNice(Math.min(0, ...vals), Math.max(...vals, 0.01));
      const larg = (W - mE - mD) / barras.length;
      const py = (v) => mT + (1 - (v - esc.lo) / (esc.hi - esc.lo)) * (H - mT - mB);
      let s = `<svg class="grafico" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
      for (const t of esc.ticks) {
        s += `<line class="grade-l" x1="${mE}" x2="${W - mD}" y1="${py(t)}" y2="${py(t)}"/>`;
        s += `<text x="${mE - 8}" y="${py(t) + 4}" text-anchor="end" class="${privado ? "rs" : ""}">${escapa(formatos[y](t))}</text>`;
      }
      const cada = Math.max(1, Math.ceil(barras.length / Math.floor((W - mE) / 56)));
      barras.forEach((b, i) => {
        const w = Math.max(2, Math.min(larg * 0.64, 56)), x = mE + i * larg + (larg - w) / 2;
        const y0 = py(Math.max(0, b.valor)), h = Math.abs(py(b.valor) - py(0));
        s += `<rect class="col cresce" data-i="${i}" style="--i:${i};fill:${b.cor || cor}" x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0.5, h).toFixed(1)}" rx="${Math.min(4, w / 3).toFixed(1)}"/>`;
        if (i % cada === 0) s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${escapa(b.rotulo)}</text>`;
      });
      s += "</svg>";
      return { svg: s, larg, mE };
    }, { colunas: { barras, y, privado } });
  }

  // ---------------------------------------------------------------- composição
  function composicao(partes) {
    const total = partes.reduce((s, p) => s + Math.max(0, p.valor), 0) || 1;
    return html`<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;gap:2px">
      ${partes.map((p, i) => html`<i style="flex:${Math.max(0, p.valor) / total};background:${p.cor};transform-origin:left;animation:estica .9s var(--mola) ${i * 80}ms both"></i>`)}
    </div>`;
  }

  // ---------------------------------------------------------------- régua
  const ROT_LENTE = { regra: "seu alvo", historica: "mediana 3 anos", pares: "mediana do setor", macro: "renda fixa" };
  function fReg(v, u) {
    if (!ok(v)) return "";
    if (u === "R$") return Math.abs(v) >= 1e6 ? "R$ " + FC.fmt.num(v / 1e6, 1) + " mi" : Math.abs(v) >= 1e3 ? "R$ " + FC.fmt.int(v / 1e3) + " mil" : "R$ " + FC.fmt.int(v);
    return FC.fmt.num(v) + (u === "%" ? "%" : "");
  }
  // Melhor fica SEMPRE à direita, inclusive quando menor é melhor.
  function regua(m) {
    const valor = m.valor;
    if (!ok(valor)) return "";
    const esc = m.escala || {}, u = m.unidade || "";
    const marcas = m.lentes.filter((L) => ok(L.referencia) && ROT_LENTE[L.lente]).map((L) => [L.referencia, ROT_LENTE[L.lente]]);
    let pts = [valor, ...marcas.map((x) => x[0]), esc.otimo, esc.aceitavel].filter(ok);
    if (pts.length < 2) return "";
    return marcador(70, (L) => {
      const W = Math.max(L, 280), H = 70;
      let lo = Math.min(...pts), hi = Math.max(...pts);
      if (hi === lo) hi = lo + Math.abs(lo || 1) * 0.1;
      const log = lo > 0 && hi / lo > 20;
      if (log) { lo = Math.log10(lo); hi = Math.log10(hi); }
      const folga = (hi - lo) * 0.14; lo -= folga; hi += folga;
      const menor = esc.direcao === "menor_melhor";
      const pe = 10, pd = 62, util = W - pe - pd;
      const x = (v) => {
        if (log) v = v > 0 ? Math.log10(v) : lo;
        let t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
        if (menor) t = 1 - t;
        return pe + t * util;
      };
      const y = 30;
      let s = `<svg class="regua" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="posição do valor atual entre as referências">`;
      s += `<rect class="trilho" x="${pe}" y="${y - 3}" width="${util}" height="6" rx="3"/>`;
      if (ok(esc.aceitavel)) {
        const x1 = Math.max(x(esc.aceitavel), pe), x2 = pe + util;
        if (x2 > x1 + 1) s += `<rect class="faixa-boa" x="${x1}" y="${y - 3}" width="${x2 - x1}" height="6" rx="3"><title>a partir de ${escapa(fReg(esc.aceitavel, u))} você considera aceitável</title></rect>`;
      }
      s += `<text class="direcao" x="${pe + util + 8}" y="${y + 4}">melhor →</text>`;
      marcas.sort((a, b) => x(a[0]) - x(b[0]));
      const fimFileira = [-999, -999];
      for (const [v, nome] of marcas) {
        const p = x(v), texto = `${nome} ${fReg(v, u)}`, meia = texto.length * 2.7;
        let fil = p - meia > fimFileira[0] + 10 ? 0 : 1;
        if (p - meia <= fimFileira[fil] + 10) continue;
        fimFileira[fil] = p + meia;
        const ty = fil ? 63 : 50;
        s += `<line class="tick" x1="${p}" y1="${y + 5}" x2="${p}" y2="${ty - 10}"/>`;
        let anc = "middle", tx = p;
        if (p - meia < 0) { anc = "start"; tx = 0; } else if (p + meia > pe + util) { anc = "end"; tx = pe + util; }
        s += `<text class="rot" x="${tx}" y="${ty}" text-anchor="${anc}">${escapa(texto)}</text>`;
      }
      if (m.valor_alt && ok(m.valor_alt.valor)) {
        const pa = x(m.valor_alt.valor);
        s += `<circle class="anel-r" cx="${pa}" cy="${y}" r="6"/><circle class="agora-alt" cx="${pa}" cy="${y}" r="4"><title>${escapa(m.valor_alt.rotulo)}: ${escapa(fReg(m.valor_alt.valor, u))}</title></circle>`;
      }
      const p = x(valor);
      s += `<line class="agulha" x1="${p}" y1="${y - 12}" x2="${p}" y2="${y + 12}"/><circle class="anel-r" cx="${p}" cy="${y}" r="6.5"/>`;
      s += `<circle class="agora" cx="${p}" cy="${y}" r="4.5"><title>hoje: ${escapa(fReg(valor, u))}</title></circle>`;
      s += `<text class="hoje" x="${p}" y="12" text-anchor="${p < 24 ? "start" : p > pe + util - 24 ? "end" : "middle"}">hoje</text></svg>`;
      return { svg: s };
    });
  }

  function sparkline(serie, largura = 132, altura = 34) {
    const pts = (serie || []).map((x) => x[1]).filter(ok);
    if (pts.length < 5) return "";
    const lo = Math.min(...pts), hi = Math.max(...pts), fx = hi - lo || 1;
    const passo = (largura - 8) / (pts.length - 1);
    const cy = (v) => altura - 4 - ((v - lo) / fx) * (altura - 12);
    const c = pts.map((v, i) => `${(4 + i * passo).toFixed(1)},${cy(v).toFixed(1)}`).join(" ");
    const ux = 4 + (pts.length - 1) * passo, uy = cy(pts.at(-1));
    return cru(`<svg class="spark grafico" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}"><polyline class="anima" points="${c}"/><circle class="anel-r" cx="${ux}" cy="${uy}" r="4.5"/><circle class="ponta" cx="${ux}" cy="${uy}" r="2.8"/></svg>`);
  }

  function faixa52(preco, min, max, largura = 170, altura = 34) {
    if (![preco, min, max].every(ok) || max <= min) return "";
    const pe = 4, util = largura - 8;
    const x = pe + Math.max(0, Math.min(1, (preco - min) / (max - min))) * util;
    return cru(`<svg class="faixa52" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="preço dentro da faixa de 52 semanas">
      <rect class="trilho" x="${pe}" y="8" width="${util}" height="6" rx="3"/>
      <circle class="agora" cx="${x}" cy="11" r="6"/>
      <text x="${pe}" y="30">${FC.fmt.num(min)}</text><text x="${pe + util}" y="30" text-anchor="end">${FC.fmt.num(max)}</text></svg>`);
  }

  // barra de alocação: o que você tem × o traço da meta
  function barraAlocacao(pct, alvo, escala, cor) {
    const w = Math.min(100, (pct / escala) * 100), m = Math.min(100, (alvo / escala) * 100);
    return html`<div class="aloc-barra"><i style="width:${w}%;background:${cor}"></i><span class="meta" style="left:calc(${m}% - 1px)" title="meta ${FC.fmt.num(alvo, 0)}%"></span></div>`;
  }

  // ---------------------------------------------------------------- ativação
  function desenhaEm(el, primeira) {
    const r = registro[el.dataset.g];
    if (!r) return;
    const largura = el.clientWidth;
    if (!largura) return;
    if (!primeira && r._largura === largura) return;
    r._largura = largura;
    const out = r.desenha(largura);
    r._geo = out;
    el.innerHTML = out.svg + '<div class="dica-grafico" aria-hidden="true"></div>';
    if (!primeira) FC.$$(".anima, .cresce, .surge", el).forEach((n) => { n.classList.remove("anima", "cresce", "surge"); });
    else FC.$$("path.anima, polyline.anima", el).forEach((p) => { try { p.style.setProperty("--comp", Math.ceil(p.getTotalLength()) + 1); } catch (e) { /* */ } });
    ligaHover(el, r);
  }

  function ligaHover(el, r) {
    const svg = FC.$("svg", el), dica = FC.$(".dica-grafico", el);
    if (!svg || !dica) return;
    const g = r._geo;
    const mostra = (cx, conteudo) => {
      dica.innerHTML = conteudo;
      dica.classList.add("visivel");
      const w = dica.offsetWidth;
      dica.style.left = Math.max(0, Math.min(el.clientWidth - w, cx - w / 2)) + "px";
      dica.style.top = "-8px";
      dica.style.transform = "translateY(-100%)";
    };
    const esconde = () => { dica.classList.remove("visivel"); svg.classList.remove("ativo"); FC.$$(".col.hover", svg).forEach((c) => c.classList.remove("hover")); };

    if (r.hover) {
      const { series, y, x } = r.hover;
      const fY = formatos[y === "brl" ? "brlCheio" : y] || formatos.num;
      const cursor = FC.$(".cursor", svg), pontos = FC.$$(".ponto-hover", svg);
      const mover = (clientX) => {
        const bx = svg.getBoundingClientRect();
        const mx = clientX - bx.left;
        const alvo = g.x0 + ((mx - g.mE) / (g.W - g.mE - g.mD)) * (g.x1 - g.x0);
        let linhasD = "", ref = null;
        series.forEach((se, i) => {
          let melhor = null, dist = Infinity;
          for (const p of se.pontos) { const d = Math.abs(ts(p[0]) - alvo); if (d < dist && ok(p[1])) { dist = d; melhor = p; } }
          if (!melhor) return;
          ref = ref || melhor;
          pontos[i].setAttribute("cx", g.px(melhor[0]));
          pontos[i].setAttribute("cy", g.py(melhor[1]));
          const cls = (se.classe || "l1");
          const cor = cls === "lref" || cls === "lref2" ? "var(--sref)" : `var(--s${cls.slice(1)})`;
          linhasD += `<div class="linha-d"><span><i class="ponto-e" style="background:${cor}"></i>${escapa(se.nome || "")}</span><b class="${r.hover.privado && y.startsWith("brl") ? "rs" : ""}">${escapa(fY(melhor[1]))}</b></div>`;
        });
        if (!ref) return;
        const cx = g.px(ref[0]);
        cursor.setAttribute("x1", cx); cursor.setAttribute("x2", cx);
        svg.classList.add("ativo");
        const quando = x === "anos" ? fmtX.anos(ref[0]) : FC.datas.br(String(ref[0]).slice(0, 10));
        mostra(cx, `<div class="quando">${escapa(quando)}</div>${linhasD}`);
      };
      svg.addEventListener("mousemove", (e) => mover(e.clientX));
      svg.addEventListener("touchmove", (e) => mover(e.touches[0].clientX), { passive: true });
      svg.addEventListener("touchstart", (e) => mover(e.touches[0].clientX), { passive: true });
      svg.addEventListener("mouseleave", esconde);
      svg.addEventListener("touchend", () => setTimeout(esconde, 1600));
    }
    if (r.colunas) {
      const { barras, y, privado } = r.colunas;
      const fY = formatos[y === "brl" ? "brlCheio" : y] || formatos.num;
      FC.$$(".col", svg).forEach((c) => {
        const ativa = () => {
          const b = barras[Number(c.dataset.i)];
          FC.$$(".col.hover", svg).forEach((x) => x.classList.remove("hover"));
          c.classList.add("hover");
          const det = (b.detalhe || []).slice(0, 6).map(([n, v]) => `<div class="linha-d"><span>${escapa(n)}</span><b class="${privado ? "rs" : ""}">${escapa(fY(v))}</b></div>`).join("");
          const cx = Number(c.getAttribute("x")) + Number(c.getAttribute("width")) / 2;
          mostra(cx, `<div class="quando">${escapa(b.titulo || b.rotulo)}</div><div class="linha-d"><span>Total</span><b class="${privado ? "rs" : ""}">${escapa(fY(b.valor))}</b></div>${det}`);
        };
        c.addEventListener("mouseenter", ativa);
        c.addEventListener("click", ativa);
      });
      svg.addEventListener("mouseleave", esconde);
    }
  }

  let redim = null;
  window.addEventListener("resize", () => {
    clearTimeout(redim);
    redim = setTimeout(() => FC.$$("[data-g]").forEach((el) => desenhaEm(el, false)), 150);
  });

  function ativar(raiz) {
    requestAnimationFrame(() => {
      FC.$$("[data-g]", raiz).forEach((el) => { if (!el.firstChild) desenhaEm(el, true); });
      // limpa registros de gráficos que já saíram da tela
      for (const id of Object.keys(registro)) if (!document.querySelector(`[data-g="${id}"]`) && registro[id]._largura) delete registro[id];
    });
  }

  FC.graficos = { linhas, colunas, composicao, regua, sparkline, faixa52, barraAlocacao, ativar };
})();
