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
  const P = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    ativos: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    aportes: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="10"/>',
    agro: '<path d="M4 20c0-6 3-10 8-12M12 8c5 1 8 5 8 12M8 4c1 2 3 3 4 4 1-1 3-2 4-4"/><path d="M2 20h20"/>',
    renda: '<path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9 9.4 12 10s5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3"/>',
    simular: '<path d="M3 3h18v18H3zM3 9h18M9 21V9"/>',
    projecoes: '<path d="M3 17l6-6 4 4 8-8M14 7h7v7"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    mais: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    olhoFechado: '<path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    atualizar: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    voltar: '<path d="M15 6l-6 6 6 6"/>',
    lixo: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
    cadeado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    alerta: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    importar: '<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>',
    exportar: '<path d="M12 15V3M7 8l5-5 5 5M4 19h16"/>',
    boi: '<path d="M4 8c-1-2 0-4 0-4s2 1 3 3h10c1-2 3-3 3-3s1 2 0 4"/><path d="M6 8c0 6 2 11 6 11s6-5 6-11"/><circle cx="9.5" cy="12" r=".6"/><circle cx="14.5" cy="12" r=".6"/><path d="M10 16h4"/>',
    carteira: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    balanca: '<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
    moeda: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c0-1.1-1.1-2-2.5-2s-2.5.9-2.5 2 1.1 1.7 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2-2.5-.9-2.5-2M12 6v1.5M12 16.5V18"/>',
  };
  FC.icone = function (nome, tam = 20, extra = "") {
    return cru(`<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[nome] || ""}</svg>`);
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
