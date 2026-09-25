/* Utilidades compartilhadas: HTML seguro, formatação brasileira, datas,
 * ícones e os componentes de interface (folha, aviso, confirmação). */
(function () {
  const FC = (window.FC = window.FC || {});

  // ---------------------------------------------------------------- HTML
  // Tudo o que entra por ${} é escapado, a menos que venha de cru() ou
  // de outro html``. Assim nenhum texto digitado vira marcação.
  class Cru { constructor(s) { this.s = String(s); } toString() { return this.s; } }
  const cru = (s) => new Cru(s == null ? "" : s);
  const escapa = (v) => String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  function valor(v) {
    if (v == null || v === false) return "";
    if (v instanceof Cru) return v.s;
    if (Array.isArray(v)) return v.map(valor).join("");
    return escapa(v);
  }
  function html(partes, ...vals) {
    let s = partes[0];
    vals.forEach((v, i) => { s += valor(v) + partes[i + 1]; });
    return new Cru(s);
  }
  FC.html = html; FC.cru = cru; FC.escapa = escapa;

  // ---------------------------------------------------------------- números
  const nf = {};
  function formatador(casas) {
    const k = casas;
    if (!nf[k]) nf[k] = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
    return nf[k];
  }
  const ok = (v) => typeof v === "number" && Number.isFinite(v);
  const fmt = {
    num(v, casas = 2) { return ok(v) ? formatador(casas).format(v) : "—"; },
    int(v) { return ok(v) ? formatador(0).format(Math.round(v)) : "—"; },
    pct(v, casas = 2) { return ok(v) ? formatador(casas).format(v) + "%" : "—"; },
    delta(v, casas = 1, suf = "") {
      if (!ok(v)) return "—";
      const s = formatador(casas).format(Math.abs(v));
      return (v > 0 ? "+" : v < 0 ? "−" : "") + s + suf;
    },
    // preço unitário: moedas de centavos (cripto) ganham casas até mostrar
    // o valor, em vez de virar "0,00"
    preco(v) {
      if (!ok(v)) return "—";
      const a = Math.abs(v);
      if (a === 0 || a >= 1) return formatador(2).format(v);
      const casas = Math.min(10, Math.max(2, 3 - Math.floor(Math.log10(a))));
      return formatador(casas).format(v);
    },
    // quantidade: inteira para cota; até 8 casas para cripto (0,00350000 → 0,0035)
    qtd(v) {
      if (!ok(v)) return "—";
      if (Number.isInteger(v)) return formatador(0).format(v);
      return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(v);
    },
    // valor de mercado (liquidez, cotação): não é dinheiro do usuário
    mercado(v) {
      if (!ok(v)) return "—";
      if (Math.abs(v) >= 1e9) return "R$ " + formatador(2).format(v / 1e9) + " bi";
      if (Math.abs(v) >= 1e6) return "R$ " + formatador(1).format(v / 1e6) + " mi";
      return "R$ " + formatador(2).format(v);
    },
    brlTexto(v, casas = 2) {
      if (!ok(v)) return "—";
      return (v < 0 ? "−" : "") + "R$ " + formatador(casas).format(Math.abs(v));
    },
    brlCurto(v) {
      if (!ok(v)) return "—";
      const a = Math.abs(v), s = v < 0 ? "−" : "";
      if (a >= 1e6) return s + "R$ " + formatador(1).format(a / 1e6) + " mi";
      if (a >= 1e4) return s + "R$ " + formatador(0).format(a / 1e3) + " mil";
      return s + "R$ " + formatador(0).format(a);
    },
    // dinheiro DO USUÁRIO: sai marcado para o modo privado poder borrar
    brl(v, casas = 2) { return html`<span class="rs">${fmt.brlTexto(v, casas)}</span>`; },
    metrica(v, unidade) {
      if (!ok(v)) return "sem dado";
      if (unidade === "R$") return fmt.mercado(v);
      if (unidade === "%") return fmt.num(v) + "%";
      return fmt.num(v);
    },
  };
  FC.fmt = fmt;
  // "cotas" para bolsa; para cripto, o próprio código (0,0035 BTC)
  FC.unidade = (a, q) => (a && a.classe === "cripto" ? (a.ticker || "").split("-")[0].replace(/\d+$/, "") : q === 1 ? "cota" : "cotas");
  FC.ok = ok;

  // número digitado em formulário (aceita vírgula decimal)
  FC.lerNum = function (txt) {
    if (txt == null) return null;
    let s = String(txt).trim();
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  };

  // ---------------------------------------------------------------- datas
  // Datas trafegam como texto ISO (AAAA-MM-DD): compara-se como texto e
  // não há surpresa de fuso horário.
  const datas = {
    hoje() {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    },
    soma(iso, dias) {
      const d = new Date(iso + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + dias);
      return d.toISOString().slice(0, 10);
    },
    dias(a, b) {
      return Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
    },
    br(iso) {
      if (!iso) return "—";
      const [a, m, d] = String(iso).slice(0, 10).split("-");
      return `${d}/${m}/${a}`;
    },
    mesAno(iso) {
      const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
      const [a, m] = String(iso).split("-");
      return `${meses[Number(m) - 1]}/${a.slice(2)}`;
    },
    // "agora", "há 5 min", "há 2 h", ou a data
    ha(quando) {
      if (!quando) return "";
      const s = (Date.now() - new Date(quando).getTime()) / 1000;
      if (s < 90) return "agora";
      if (s < 3600) return `há ${Math.round(s / 60)} min`;
      if (s < 86400) return `há ${Math.round(s / 3600)} h`;
      return new Date(quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    },
    // dd/mm/aaaa -> ISO
    deBr(txt) {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(String(txt || "").trim());
      if (!m) return null;
      const a = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    },
  };
  // ---- dias úteis: sem fim de semana e sem feriado bancário nacional
  const cacheFeriados = {};
  function pascoa(ano) {           // algoritmo de Meeus/Jones/Butcher
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  datas.feriados = function (ano) {
    if (cacheFeriados[ano]) return cacheFeriados[ano];
    const p = pascoa(ano);
    const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25"].map((d) => `${ano}-${d}`);
    if (ano >= 2024) fixos.push(`${ano}-11-20`);          // Consciência Negra, feriado nacional desde 2024
    const moveis = [datas.soma(p, -48), datas.soma(p, -47), datas.soma(p, -2), datas.soma(p, 60)]; // Carnaval, Sexta Santa, Corpus Christi
    return (cacheFeriados[ano] = new Set([...fixos, ...moveis]));
  };
  datas.ehUtil = function (iso) {
    const dow = new Date(iso + "T12:00:00Z").getUTCDay();
    return dow !== 0 && dow !== 6 && !datas.feriados(Number(iso.slice(0, 4))).has(iso);
  };
  datas.ultimoDiaDoMes = (mes) => { const [a, m] = mes.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };
  // n-ésimo dia útil do mês (AAAA-MM); se o mês tiver menos, o último
  datas.diaUtil = function (mes, n) {
    let achados = 0, ultimo = null;
    for (let d = 1; d <= datas.ultimoDiaDoMes(mes); d++) {
      const iso = `${mes}-${String(d).padStart(2, "0")}`;
      if (!datas.ehUtil(iso)) continue;
      ultimo = iso;
      if (++achados === n) return iso;
    }
    return ultimo;
  };
  datas.ultimoDiaUtil = function (mes) {
    for (let d = datas.ultimoDiaDoMes(mes); d >= 1; d--) {
      const iso = `${mes}-${String(d).padStart(2, "0")}`;
      if (datas.ehUtil(iso)) return iso;
    }
    return `${mes}-01`;
  };
  FC.datas = datas;

  // ---------------------------------------------------------------- ícones
  // Traço fino (1.6), cantos arredondados, geometria simples: no espírito
  // dos SF Symbols. Todos desenhados na grade de 24.
  const P = {
    inicio: '<path d="M3.5 10.8 12 4l8.5 6.8"/><path d="M5.8 9.2V18.5a1.5 1.5 0 0 0 1.5 1.5h9.4a1.5 1.5 0 0 0 1.5-1.5V9.2"/><path d="M10 20v-4.5a2 2 0 0 1 4 0V20"/>',
    ativos: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z"/><path d="M15 3.9A8.5 8.5 0 0 1 20.1 9H15z"/>',
    aportes: '<rect x="3.5" y="3.5" width="17" height="17" rx="5.5"/><path d="M12 8.5v7M8.5 12h7"/>',
    agro: '<path d="M12 20.5v-8.5"/><path d="M12 12c0-4.4 3-7.5 8-7.5 0 4.4-3 7.5-8 7.5z"/><path d="M12 14.5c0-3.3-2.4-6-6.5-6 0 3.3 2.4 6 6.5 6z"/>',
    renda: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    simular: '<path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9"/><circle cx="15" cy="7.5" r="2"/><circle cx="9" cy="16.5" r="2"/>',
    projecoes: '<path d="M3.5 17.5 9 12l3.5 3 8-8"/><path d="M15.5 7h5v5"/>',
    ajustes: '<path d="M12 3.2l7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6z"/><circle cx="12" cy="12" r="2.8"/>',
    ajuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 2-2.3 3.5"/><path d="M12 16.8v.01"/>',
    mais: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.7"/>',
    olhoFechado: '<path d="M3.5 3.5l17 17"/><path d="M10.4 5.6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-2.8 3.6M6.6 6.8C4 8.5 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2"/><path d="M10 10a2.7 2.7 0 0 0 4 4"/>',
    atualizar: '<path d="M19.5 10.5A7.8 7.8 0 0 0 5.8 7.2M4.5 13.5a7.8 7.8 0 0 0 13.7 3.3"/><path d="M5 3.8v3.9h3.9M19 20.2v-3.9h-3.9"/>',
    sair: '<path d="M10 4H7.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2H10"/><path d="M15 8l4 4-4 4M19 12H9.5"/>',
    fechar: '<path d="M7 7l10 10M17 7 7 17"/>',
    chevron: '<path d="M9.5 6l6 6-6 6"/>',
    voltar: '<path d="M14.5 6l-6 6 6 6"/>',
    lixo: '<path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/><path d="M6.5 7l.8 11.3A1.8 1.8 0 0 0 9.1 20h5.8a1.8 1.8 0 0 0 1.8-1.7L17.5 7"/>',
    editar: '<path d="M14.8 5.2l4 4L9 19H5v-4z"/><path d="M12.8 7.2l4 4"/>',
    cadeado: '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    escudo: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="M9.2 12.2l2 2 3.8-4"/>',
    alerta: '<path d="M10.3 4.5a2 2 0 0 1 3.4 0l7.2 12.5a2 2 0 0 1-1.7 3H4.8a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4M12 16.8v.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.01"/>',
    check: '<path d="M5.5 12.5l4 4L18.5 7.5"/>',
    importar: '<path d="M12 4v10.5M7.8 10.5 12 14.7l4.2-4.2"/><path d="M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
    exportar: '<path d="M12 14.5V4M7.8 8.2 12 4l4.2 4.2"/><path d="M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
    boi: '<path d="M7.5 7.5h9a1 1 0 0 1 1 1v4a5.5 5.5 0 0 1-11 0v-4a1 1 0 0 1 1-1z"/><path d="M6.5 9C4.3 9 3 7.3 3 5.2M17.5 9c2.2 0 3.5-1.7 3.5-3.8"/><path d="M10.2 15.8h3.6M9.8 11v.01M14.2 11v.01"/>',
    carteira: '<path d="M18.5 7.5V6.3a1.8 1.8 0 0 0-1.8-1.8H6.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-12"/><circle cx="16.5" cy="13" r="1" fill="currentColor" stroke="none"/>',
    balanca: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M8 10.5a4.6 4.6 0 0 1 8 0"/><path d="M12 11.5l1.6-2.3"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
    recibo: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    bussola: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    presente: '<rect x="4" y="9" width="16" height="11.5" rx="2.5"/><path d="M3.5 9h17M12 9v11.5"/><path d="M12 9c-1-3-5-4-5-1.5C7 9 12 9 12 9zM12 9c1-3 5-4 5-1.5C17 9 12 9 12 9z"/>',
    cesta: '<path d="M4 10h16l-1.6 8.3a2 2 0 0 1-2 1.7H7.6a2 2 0 0 1-2-1.7z"/><path d="M8.5 10 11 4.5M15.5 10 13 4.5M9.5 14v2.5M14.5 14v2.5"/>',
    moeda: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.4A2.7 2.7 0 0 0 12 8.2c-1.5 0-2.6.8-2.6 1.9s1.1 1.6 2.6 1.9 2.6.8 2.6 1.9-1.1 1.9-2.6 1.9a2.7 2.7 0 0 1-2.6-1.2M12 6.7v1.5M12 15.8v1.5"/>',
  };
  FC.icone = function (nome, tam = 20, extra = "") {
    return cru(`<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[nome] || ""}</svg>`);
  };
  FC.logo = function (tam = 18) {
    return cru(`<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></svg>`);
  };

  // ---------------------------------------------------------------- DOM
  FC.$ = (sel, raiz = document) => raiz.querySelector(sel);
  FC.$$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));
  FC.dadosDoForm = function (form) {
    const d = {};
    new FormData(form).forEach((v, k) => { d[k] = typeof v === "string" ? v.trim() : v; });
    FC.$$("input[type=checkbox]", form).forEach((c) => { if (c.name) d[c.name] = c.checked; });
    return d;
  };

  // ---------------------------------------------------------------- estado
  FC.pilula = (cor, texto) => html`<span class="pilula ${cor || "cinza"}">${texto}</span>`;
  FC.ponto = (cor) => html`<span class="ponto-e ${cor || "cinza"}"></span>`;
  FC.anel = function (score, cor, grande = false) {
    const r = 20, c = 2 * Math.PI * r;
    const v = ok(score) ? Math.max(0, Math.min(100, score)) : 0;
    return html`<div class="anel ${cor || "cinza"} ${grande ? "grande" : ""}" role="img" aria-label="score ${ok(score) ? Math.round(score) : "sem dados"}">
      <svg viewBox="0 0 48 48"><circle class="trilho" cx="24" cy="24" r="${r}" fill="none" stroke-width="5"/>
      <circle class="arco" cx="24" cy="24" r="${r}" fill="none" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}" data-alvo="${(c * (1 - v / 100)).toFixed(2)}"/></svg>
      <span>${ok(score) ? Math.round(score) : "—"}</span></div>`;
  };
  FC.ajuda = (texto) => html`<span class="ajuda" tabindex="0" data-dica="${texto}">?</span>`;

  // ---------------------------------------------------------------- animações pós-render
  const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  FC.animar = function (raiz, { semAnimacao = false } = {}) {
    const parado = semAnimacao || semMovimento();
    // anéis de score
    if (parado) FC.$$(".anel .arco[data-alvo]", raiz).forEach((a) => { a.style.transition = "none"; a.style.strokeDashoffset = a.dataset.alvo; });
    requestAnimationFrame(() => {
      FC.$$(".anel .arco[data-alvo]", raiz).forEach((a) => { a.style.strokeDashoffset = a.dataset.alvo; });
    });
    // números que contam até o valor
    FC.$$("[data-conta]", raiz).forEach((el) => {
      const alvo = Number(el.dataset.conta);
      const modo = el.dataset.modo || "brl";
      const pinta = (v) => {
        el.textContent = modo === "brl" ? fmt.brlTexto(v) : modo === "int" ? fmt.int(v) : fmt.num(v, Number(el.dataset.casas || 2));
      };
      if (!ok(alvo) || parado) { pinta(alvo); return; }
      const dur = 1100, t0 = performance.now();
      const passo = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);
        pinta(alvo * e);
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
    // linhas dos gráficos: o traço precisa saber o próprio comprimento
    FC.$$(".grafico path.anima, .grafico polyline.anima", raiz).forEach((p) => {
      try { p.style.setProperty("--comp", Math.ceil(p.getTotalLength()) + 1); } catch (e) { /* sem layout */ }
    });
    FC.graficos && FC.graficos.ativar(raiz);
    FC.$$(".segmentado", raiz).forEach(FC.ui.segmentado);
  };

  // ---------------------------------------------------------------- interface
  const ui = {};
  FC.ui = ui;

  ui.aviso = function (texto, tipo = "ok") {
    let caixa = FC.$(".avisos");
    if (!caixa) { caixa = document.createElement("div"); caixa.className = "avisos"; caixa.setAttribute("role", "status"); document.body.appendChild(caixa); }
    const el = document.createElement("div");
    el.className = "aviso " + tipo;
    el.innerHTML = `<span class="ponto"></span><span>${escapa(texto)}</span>`;
    caixa.appendChild(el);
    setTimeout(() => { el.classList.add("saindo"); setTimeout(() => el.remove(), 260); }, tipo === "erro" ? 5200 : 3000);
  };

  ui.erro = function (e) {
    console.error(e);
    const msg = (e && (e.message || e.error_description || e.msg)) || String(e);
    ui.aviso(traduzErro(msg), "erro");
  };

  function traduzErro(msg) {
    const m = String(msg);
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sem conexão. Confira a internet e tente de novo.";
    if (/duplicate key.*ativos_user_id_ticker/i.test(m)) return "Esse ativo já está cadastrado.";
    if (/duplicate key.*renda_fixa_user_id_nome/i.test(m)) return "Já existe um título com esse nome.";
    if (/JWT expired|session.*expired/i.test(m)) return "Sua sessão expirou. Entre de novo.";
    if (/Password should be|password.*characters/i.test(m)) return "A senha precisa de ao menos 10 caracteres, com maiúscula, minúscula e número.";
    if (/Invalid TOTP|invalid.*code/i.test(m)) return "Código incorreto. Confira o app autenticador.";
    if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Espere um minuto e tente de novo.";
    if (/already registered|already been registered|user_already_exists/i.test(m)) return "Já existe uma conta com esse e-mail. Entre com ela.";
    if (/Signups not allowed|signup.*disabled/i.test(m)) return "O cadastro de novas contas está desligado no momento.";
    if (/Unable to validate email|invalid.*email/i.test(m)) return "Esse e-mail não parece válido.";
    if (/check constraint/i.test(m)) return "Algum valor está fora do permitido. Revise o formulário.";
    return m;
  }
  ui.traduzErro = traduzErro;

  // Folha: o painel que sobe de baixo no celular e surge no centro no
  // computador. Devolve {el, fechar}.
  let pilhaFolhas = 0;
  ui.folha = function ({ titulo, corpo, rodape, larga = false, aoMontar, aoFechar }) {
    const fundo = document.createElement("div");
    fundo.className = "fundo";
    fundo.innerHTML = `<div class="folha ${larga ? "larga" : ""}" role="dialog" aria-modal="true" aria-label="${escapa(titulo || "")}">
      <div class="puxador"></div>
      <div class="folha-topo"><h2>${escapa(titulo || "")}</h2>
        <button class="fechar" type="button" aria-label="Fechar">${FC.icone("fechar", 16)}</button></div>
      <div class="folha-corpo">${valor(corpo)}</div>
      ${rodape ? `<div class="folha-rodape">${valor(rodape)}</div>` : ""}
    </div>`;
    document.body.appendChild(fundo);
    pilhaFolhas++;
    document.body.style.overflow = "hidden";
    const folha = FC.$(".folha", fundo);
    const corpoEl = FC.$(".folha-corpo", fundo);
    const topo = FC.$(".folha-topo", fundo);
    corpoEl.addEventListener("scroll", () => topo.classList.toggle("rolou", corpoEl.scrollTop > 4));
    let fechada = false;
    const anterior = document.activeElement;
    function fechar() {
      if (fechada) return;
      fechada = true;
      fundo.classList.add("saindo");
      document.removeEventListener("keydown", tecla);
      setTimeout(() => {
        fundo.remove();
        pilhaFolhas--;
        if (!pilhaFolhas) document.body.style.overflow = "";
        anterior && anterior.focus && anterior.focus();
        aoFechar && aoFechar();
      }, 220);
    }
    function tecla(e) { if (e.key === "Escape" && fundo === FC.$$(".fundo").at(-1)) fechar(); }
    document.addEventListener("keydown", tecla);
    fundo.addEventListener("mousedown", (e) => { if (e.target === fundo) fechar(); });
    FC.$(".fechar", fundo).addEventListener("click", fechar);
    // arrastar para baixo fecha (celular)
    let y0 = null;
    FC.$(".puxador", fundo).addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    FC.$(".puxador", fundo).addEventListener("touchend", (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 60) fechar(); y0 = null; });
    const api = { el: folha, corpo: corpoEl, fechar };
    FC.animar(folha);
    aoMontar && aoMontar(api);
    setTimeout(() => { const f = FC.$("input:not([type=hidden]), select, textarea", corpoEl); if (f && window.innerWidth > 640) f.focus(); }, 60);
    return api;
  };

  ui.confirma = function (texto, { titulo = "Confirmar", botao = "Confirmar", perigo = false } = {}) {
    return new Promise((ok) => {
      let resposta = false;
      const f = ui.folha({
        titulo,
        corpo: html`<p style="font-size:15px;color:var(--ink-2)">${texto}</p>`,
        rodape: html`<button class="botao sec" data-r="nao">Cancelar</button>
                     <button class="botao ${perigo ? "perigo" : ""}" data-r="sim">${botao}</button>`,
        aoFechar: () => ok(resposta),
      });
      FC.$$("[data-r]", f.el).forEach((b) => b.addEventListener("click", () => { resposta = b.dataset.r === "sim"; f.fechar(); }));
    });
  };

  // botão com estado de carregando enquanto a promessa roda
  ui.ocupado = async function (botao, fn) {
    if (!botao) return fn();
    const antes = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = '<span class="carrega"></span>';
    try { return await fn(); } finally { botao.disabled = false; botao.innerHTML = antes; }
  };

  // controle segmentado com o fundo que desliza até a opção escolhida
  ui.segmentado = function (seg) {
    if (seg.dataset.pronto) { posiciona(); return; }
    seg.dataset.pronto = "1";
    const d = document.createElement("span");
    d.className = "deslizante";
    seg.prepend(d);
    function posiciona() {
      const sel = FC.$("button[aria-pressed=true]", seg) || FC.$("button", seg);
      const dl = FC.$(".deslizante", seg);
      if (!sel || !dl) return;
      dl.style.left = sel.offsetLeft + "px";
      dl.style.width = sel.offsetWidth + "px";
    }
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      FC.$$("button", seg).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      posiciona();
    });
    requestAnimationFrame(posiciona);
    window.addEventListener("resize", posiciona);
  };

  // ---------------------------------------------------------------- preferências locais
  // Só conveniências deste navegador (tema, modo privado). Nada de dado.
  FC.local = {
    ler(k, padrao) { try { const v = localStorage.getItem("fc:" + k); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; } },
    gravar(k, v) { try { localStorage.setItem("fc:" + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
    apagar(k) { try { localStorage.removeItem("fc:" + k); } catch (e) { /* idem */ } },
  };

  FC.aplicaTema = function (tema) {
    const t = tema || FC.local.ler("tema", "auto");
    if (t === "auto") document.documentElement.removeAttribute("data-tema");
    else document.documentElement.setAttribute("data-tema", t);
  };
  FC.aplicaTema();

  // baixar um arquivo gerado no navegador
  FC.baixar = function (nome, conteudo, tipo = "application/json") {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  };

  // hash curto e estável, sem depender de crypto.subtle (que exige
  // contexto seguro e pode faltar ao abrir o arquivo direto do disco)
  FC.hash = function (str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  };

  FC.carregaScript = function (src) {
    return new Promise((ok, falha) => {
      if (FC.$(`script[src="${src}"]`)) return ok();
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => falha(new Error("não consegui carregar " + src));
      document.head.appendChild(s);
    });
  };

  FC.mediana = function (valores) {
    const v = valores.filter(ok).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  FC.soma = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
})();
