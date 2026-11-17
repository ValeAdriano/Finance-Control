/* GERADO por scripts/gera-nucleo-mcp.js — não edite à mão.
 * Fontes: src/nucleo/shim.js e, de nucleo/: config.js, util.js, padroes.js, layout.js, supa.js, graficos.js, modelo/avaliador.js, modelo/agro.js, modelo/rentabilidade.js, modelo/carteira.js, modelo/base.js, modelo/perfil.js, modelo/recomendacao.js, modelo/renda.js, modelo/projecao.js, modelo/importador.js, modelo/dividendos.js, modelo/caixa-proventos.js, modelo/desempenho.js, modelo/impostos.js, modelo/alertas.js, modelo/salario.js, modelo/retrospectiva.js. */
/* eslint-disable */
// deno-lint-ignore-file
// deno-fmt-ignore-file
/* Shim do ambiente de navegador para o núcleo compartilhado.
 *
 * Os arquivos de `nucleo/` (vindos do site original) foram escritos para
 * o navegador: eles fazem `window.FC = window.FC || {}` e depois usam `FC` como
 * global. No navegador isso funciona porque `window === globalThis`. Aqui a
 * gente recria essa condição e dá os poucos globais que o núcleo toca ao
 * carregar (nenhum arquivo de cálculo mexe no DOM ao carregar; os stubs de DOM
 * existem só porque `util.js` e `graficos.js` registram ouvintes na carga).
 *
 * Uma única função, usada nos dois mundos:
 *   - Node/testes: aplicada sobre um contexto de `vm`.
 *   - React Native/Hermes e web: aplicada sobre `global`.
 *
 * O chamador injeta o que é específico de plataforma: `localStorage`
 * (MMKV no nativo, o nativo na web, em memória nos testes), `supabase`
 * (@supabase/supabase-js) e `zip` (@zip.js/zip.js). */

const noop = () => {};

function elementoFalso() {
  return {
    style: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop,
    removeAttribute: noop,
    getAttribute: () => null,
    appendChild: noop,
    removeChild: noop,
    remove: noop,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

function documentoFalso() {
  return {
    documentElement: elementoFalso(),
    body: elementoFalso(),
    head: elementoFalso(),
    createElement: () => elementoFalso(),
    createTextNode: () => ({}),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    activeElement: null,
  };
}

/**
 * Instala, sobre `g`, tudo o que o núcleo espera encontrar no `window` de um
 * navegador. `g` deve ser o objeto global do ambiente (o `global` do Hermes,
 * ou um contexto de `vm` nos testes). Idempotente: só define o que falta.
 *
 * @param {object} g  objeto global de destino
 * @param {object} ext  { localStorage, supabase, zip } — dependências de plataforma
 */
function aplicaShim(g, ext = {}) {
  // a condição central: window e self apontam para o próprio global, igual ao
  // navegador. É isso que faz `window.FC = ...` criar o global `FC`.
  // no navegador `window` e `self` já são o global (e são só-leitura)
  if (g.window !== g) g.window = g;
  if (g.self !== g) g.self = g;
  if (typeof g.globalThis === "undefined") g.globalThis = g;

  if (!g.FC) g.FC = {};
  // alguns arquivos usam FC.ok antes de util.js definir — mantém o mesmo atalho
  if (!g.FC.ok) g.FC.ok = (v) => v != null && typeof v === "number" && Number.isFinite(v);

  if (ext.localStorage && !g.localStorage) g.localStorage = ext.localStorage;
  if (ext.supabase && !g.supabase) g.supabase = ext.supabase;
  if (ext.zip && !g.zip) g.zip = ext.zip;

  if (!g.navigator) g.navigator = { language: "pt-BR", onLine: true };
  if (!g.document) g.document = documentoFalso();
  if (typeof g.matchMedia !== "function") {
    g.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop, removeEventListener: noop });
  }
  if (typeof g.addEventListener !== "function") g.addEventListener = noop;
  if (typeof g.removeEventListener !== "function") g.removeEventListener = noop;
  if (typeof g.requestAnimationFrame !== "function") g.requestAnimationFrame = (f) => setTimeout(f, 0);
  if (typeof g.cancelAnimationFrame !== "function") g.cancelAnimationFrame = noop;
  // promo/promo.js cria um Image para o logo no topo do arquivo; o desenho
  // de verdade roda no palco (WebView), aqui só precisa existir
  if (typeof g.Image !== "function") g.Image = function Image() { this.complete = false; this.naturalWidth = 0; };

  return g;
}

/** localStorage em memória — para testes e como piso seguro. */
function localStorageMemoria() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  };
}



/** Um núcleo novo, isolado dos outros. `ext.supabase` é o módulo que o
 *  núcleo espera em window.supabase ({ createClient }); `ext.localStorage`,
 *  opcional, onde o cache de mercado fica (padrão: memória desta instância). */
export function criaNucleo(ext = {}) {
  const window = aplicaShim({}, {
    localStorage: ext.localStorage || localStorageMemoria(),
    supabase: ext.supabase || { createClient: () => ({ auth: {}, from: () => ({}) }) },
    zip: {},
  });
  const self = window;
  const { document, navigator, localStorage, matchMedia, requestAnimationFrame, cancelAnimationFrame, Image, supabase, zip } = window;
  const addEventListener = window.addEventListener, removeEventListener = window.removeEventListener;
  const FC = window.FC;

/* ---- config.js */
/* Conexão com o Supabase.
 *
 * Esta chave é a PUBLICÁVEL: foi feita para ficar no navegador. Ela
 * sozinha não lê nada — todas as tabelas têm RLS e só respondem ao
 * usuário logado, dono de cada linha. A chave secreta nunca entra aqui.
 */
window.FC = window.FC || {};
FC.config = {
  supabaseUrl: "https://ahbftafpbailgmjughsq.supabase.co",
  supabaseChave: "sb_publishable_-fQlrxL4xhR_iURRWwisyg_R7k4DJUf",
};


/* ---- util.js */
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

  // número digitado em formulário (aceita vírgula decimal, "R$" e ponto de
  // milhar: "5.000" é cinco mil, "1.234,56" e "0.5" também valem)
  FC.lerNum = function (txt) {
    if (txt == null) return null;
    let s = String(txt).trim().replace(/R\$/g, "").replace(/[\s ]/g, "").replace(/[−–]/g, "-");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
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
    ordenar: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
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
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none"/>',
    pausa: '<rect x="6.5" y="5" width="3.8" height="14" rx="1.3" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.3" fill="currentColor" stroke="none"/>',
    som: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    somDesligado: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    alvo: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    celular: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
    baixar: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    moeda: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.4A2.7 2.7 0 0 0 12 8.2c-1.5 0-2.6.8-2.6 1.9s1.1 1.6 2.6 1.9 2.6.8 2.6 1.9-1.1 1.9-2.6 1.9a2.7 2.7 0 0 1-2.6-1.2M12 6.7v1.5M12 15.8v1.5"/>',
    sino: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    compartilhar: '<path d="M12 3v11M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
    cripto: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 8v8M9.8 8.1h3a1.95 1.95 0 0 1 0 3.9h-3M9.8 12h3.5a2 2 0 0 1 0 4H9.8M11 6.6v1.5M11 15.9v1.5M13 6.6v1.5M13 15.9v1.5"/>',
    jornal: '<rect x="3.5" y="5" width="13.5" height="14" rx="2"/><path d="M17 9h2a1.5 1.5 0 0 1 1.5 1.5v6.5a2 2 0 0 1-2 2H6"/><path d="M7 9h6.5M7 12.2h6.5M7 15.4h4"/>',
    adicionarTela: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  };
  FC.icone = function (nome, tam = 20, extra = "") {
    return cru(`<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[nome] || ""}</svg>`);
  };
  FC.logo = function (tam = 18) {
    return cru(`<img class="logo-bullz" src="assets/img/icone-192.png" width="${tam}" height="${tam}" alt="Bullz" style="display:block;width:${tam}px;height:${tam}px;object-fit:contain;border-radius:inherit">`);
  };

  // foguinho roxo da sequência de aportes. Aceso, a chama dança e brilha;
  // apagado, fica cinza e parado. Com pct, ganha o anel do mês em volta
  // (quanto da meta já foi), no estilo dos anéis do WHOOP.
  let seqFogo = 0;
  FC.foguinho = function (tam = 24, { aceso = true, pct = null, extra = "" } = {}) {
    const id = "fg" + ++seqFogo;
    const anel = pct == null ? "" : (() => {
      const c = 2 * Math.PI * 18, p = Math.max(0, Math.min(100, pct));
      return `<svg class="anel-fogo" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" class="trilho"/>
        <circle cx="20" cy="20" r="18" class="progresso" stroke="url(#${id}a)" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(2)}"/>
        <defs><linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c084fc"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs></svg>`;
    })();
    return cru(`<span class="fogo ${aceso ? "aceso" : "apagado"}${pct == null ? "" : " com-anel"}" style="--t:${tam}px" ${extra}>${anel}
      <svg class="chama" viewBox="0 0 32 32" aria-hidden="true"><defs>
        <linearGradient id="${id}e" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#c084fc"/><stop offset="0.55" stop-color="#a855f7"/><stop offset="1" stop-color="#6d28d9"/></linearGradient>
        <linearGradient id="${id}i" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#f5f3ff"/><stop offset="1" stop-color="#d8b4fe"/></linearGradient></defs>
        <g class="ch-ext"><path fill="url(#${id}e)" d="M16 2.5C17.5 7 23.5 10 24.5 17 25.3 23 21.3 28.5 16 28.5 10.7 28.5 6.7 24 7.3 18.5 7.7 14.8 9.8 12.6 11.2 10.2 11.7 12.6 12.6 14 13.9 14.6 13.6 10 14.6 6 16 2.5Z"/></g>
        <g class="ch-int"><path fill="url(#${id}i)" d="M16 13.5C17 16.5 20.3 18.2 20.3 22.2 20.3 25 18.4 26.8 16 26.8 13.6 26.8 11.7 25 11.7 22.6 11.7 20.4 13 19.3 14 17.6 14.4 18.9 15 19.6 15.7 19.9 15.5 17.6 15.4 15.6 16 13.5Z"/></g>
      </svg></span>`);
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
      if (!ok(alvo) || parado || document.body.classList.contains("carregando-dados")) { pinta(alvo); return; }
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
    if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail com o código que enviamos antes de entrar.";
    if (/otp.*expired|token.*(expired|invalid)/i.test(m)) return "Código incorreto ou vencido. Peça outro.";
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


/* ---- padroes.js */
/* Valores de partida. Tudo aqui pode ser sobrescrito na tela de Ajustes;
 * o que você muda fica na tabela `preferencias` do Supabase, e o que não
 * muda continua vindo daqui. */
(function () {
  const FC = window.FC;

  FC.PILARES = [
    { chave: "acoes", nome: "Ações", cor: "var(--s1)" },
    { chave: "real_estate", nome: "Real Estate", cor: "var(--s4)" },
    { chave: "alternativos", nome: "Alternativos", cor: "var(--s3)" },
    { chave: "caixa", nome: "Caixa", cor: "var(--s2)" },
    { chave: "agro", nome: "Agronegócio", cor: "var(--s5)" },
  ];
  FC.PILAR_NOME = Object.fromEntries(FC.PILARES.map((p) => [p.chave, p.nome]));

  // ------------------------------------------------------------------ módulos
  // O que nem todo mundo usa fica desligado até a pessoa ligar em Ajustes.
  // Desligar só esconde: os dados continuam guardados e somando no patrimônio.
  FC.MODULOS = [
    { chave: "dividendos", nome: "Dividendos e proventos", icone: "moeda", desc: "aba Dividendos: histórico, próximos pagamentos e análise de proventos", rotas: ["dividendos"] },
    { chave: "irpf", nome: "Imposto de Renda", icone: "recibo", desc: "aba Imposto de Renda: Bens e Direitos, rendimentos e cálculo de DARF", rotas: ["irpf"] },
    { chave: "salario", nome: "Salário e planejamento", icone: "carteira", desc: "aba Salário: controle de renda mensal, aportes e reserva de emergência", rotas: ["salario"] },
    { chave: "projecoes", nome: "Projeções", icone: "projecoes", desc: "aba Projeções: patrimônio e renda futuros em moeda de hoje", rotas: ["projecoes"] },
    { chave: "agro", nome: "Agronegócio", icone: "agro", desc: "aba Agro: rebanho, compras, vendas, custos e pesagens do gado", rotas: ["agro"] },
    { chave: "fii", nome: "Fundos Imobiliários (FIIs)", icone: "ativos", desc: "FIIs na carteira e nas opções de classes de ativos", classes: ["fii"] },
    { chave: "cripto", nome: "Criptomoedas", icone: "cripto", desc: "BTC, ETH e outras criptos com cotação em reais, e a aba Cripto: ranking, gráficos e a ficha de cada moeda", classes: ["cripto"], rotas: ["cripto"] },
    { chave: "exterior", nome: "Bolsa dos EUA", icone: "ativos", desc: "ações e ETFs negociados nos Estados Unidos", classes: ["acao_us", "etf_us"] },
    { chave: "renda", nome: "Análise de setores", icone: "renda", desc: "aba Renda: empresas de setores perenes pelos seus critérios de dividendo", rotas: ["renda"] },
    { chave: "simular", nome: "Simulador de compras", icone: "simular", desc: "aba Simular: o efeito de uma cesta na alocação antes de comprar", rotas: ["simular"] },
    { chave: "noticias", nome: "Notícias", icone: "jornal", desc: "aba Notícias: manchetes do mercado e de cripto, atualizadas sozinhas", rotas: ["noticias"] },
    { chave: "engajamento", nome: "Sequência e vídeo", icone: "play", desc: "o foguinho da sequência de aportes e o vídeo de divulgação" },
  ];
  // sem escolha salva, liga o que a conta já usa
  FC.resolveModulos = function (salvos, base) {
    const ativos = (base && base.ativos) || [];
    const ag = (base && base.agro) || {};
    const padroes = {
      dividendos: true,
      irpf: true,
      salario: true,
      projecoes: true,
      fii: ativos.some((a) => a.classe === "fii"),
      agro: !!((ag.movs || []).length || (ag.custos || []).length),
      cripto: ativos.some((a) => a.classe === "cripto"),
      exterior: ativos.some((a) => a.classe === "acao_us" || a.classe === "etf_us"),
      renda: false,
      simular: false,
      engajamento: false,
      noticias: true,
    };
    if (salvos) {
      return Object.fromEntries(FC.MODULOS.map((m) => [
        m.chave,
        salvos[m.chave] !== undefined ? !!salvos[m.chave] : (padroes[m.chave] ?? false)
      ]));
    }
    return padroes;
  };
  const mods = () => (FC.estado && FC.estado.prefs && FC.estado.prefs.modulos) || {};
  FC.modulo = (chave) => !!mods()[chave];
  // rota pertence a um módulo desligado?
  FC.rotaLigada = (id) => !FC.MODULOS.some((m) => (m.rotas || []).includes(id) && !FC.modulo(m.chave));
  // classes de ativo à mostrar nos formulários (mantém a atual, mesmo desligada)
  FC.classesLigadas = (atual) => Object.entries(FC.CLASSES).filter(([k]) =>
    k === atual || !FC.MODULOS.some((m) => (m.classes || []).includes(k) && !FC.modulo(m.chave)));
  FC.pilaresLigados = () => FC.PILARES.filter((p) => {
    if (p.chave === "agro") return FC.modulo("agro");
    if (p.chave === "alternativos") return FC.modulo("cripto");
    if (p.chave === "real_estate") return FC.modulo("fii");
    return true;
  });

  FC.CLASSES = {
    acao_br: "Ação brasileira",
    etf_br: "ETF na B3",
    fii: "FII",
    acao_us: "Ação dos EUA",
    etf_us: "ETF dos EUA",
    cripto: "Criptomoeda",
  };
  FC.CLASSE_ROTULO = {
    ...FC.CLASSES,
    fii_papel: "FII de papel",
    fii_tijolo: "FII de tijolo",
    fii_fof: "FII de fundos (FOF)",
    fii_hibrido: "FII híbrido",
  };

  FC.ROTULO_CURTO = {
    pvp: "P/VP", pl: "P/L", dy: "DY", vacancia: "Vacância", cap_rate: "Cap rate",
    liquidez: "Liquidez", roe: "ROE", div_liq_pl: "Dív/PL", cresc_rec_5a: "Cresc 5a",
    dist_maxima_52s: "Desc. máx", premio_media_200d: "vs média 200d",
    vacancia_financeira: "Vac. financ.", concentracao: "Concentração",
  };

  // descreve a distância dos SEUS critérios — não é recomendação
  FC.VEREDITO_CURTO = {
    "Dentro dos seus critérios": "Nos critérios",
    "Perto dos seus critérios": "Perto",
    "Fora dos seus critérios": "Fora",
    "sem dados": "Sem dados",
    // textos antigos, caso algum venha de dado salvo
    "atende seus critérios": "Nos critérios",
    "zona cinzenta": "Perto",
    "fora dos seus critérios": "Fora",
  };

  FC.PADRAO_ALOCACAO = { acoes: 25, real_estate: 25, alternativos: 25, caixa: 25, agro: 0 };

  // ------------------------------------------------------------------ regras
  // Cada métrica é vista por quatro lentes (histórica, sua regra, pares,
  // macro). As faixas geram a curva de nota: ótimo → 100, aceitável → 60,
  // ruim → 0, com interpolação linear entre os pontos.
  FC.PADRAO_REGRAS = {
    pesos_lentes: { historica: 0.3, regra: 0.3, pares: 0.25, macro: 0.15 },
    janela_historico_anos: 3,
    vereditos: { atende: 70, observar: 45 },
    perfis: {
      fii_tijolo: {
        descricao: "FII de imóveis físicos — lajes, shoppings, galpões, renda urbana",
        isento_ir: true,
        metricas: {
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 3, otimo: 0.9, aceitavel: 1.02, ruim: 1.25 },
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 11, aceitavel: 8.5, ruim: 6, ancora_macro: "cdi" },
          vacancia: { rotulo: "Vacância física", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 3, aceitavel: 10, ruim: 25 },
          // a receita que deixa de entrar — pesa mais que a área vaga
          vacancia_financeira: { rotulo: "Vacância financeira (estimada)", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 3, aceitavel: 8, ruim: 20 },
          concentracao: { rotulo: "Concentração — maior imóvel na receita", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 15, aceitavel: 30, ruim: 60 },
          cap_rate: { rotulo: "Cap Rate", unidade: "%", direcao: "maior_melhor", peso: 1, otimo: 10, aceitavel: 7.5, ruim: 5 },
          liquidez: { rotulo: "Liquidez diária", unidade: "R$", direcao: "maior_melhor", peso: 2, otimo: 3000000, aceitavel: 500000, ruim: 100000 },
        },
      },
      fii_papel: {
        descricao: "FII de CRI — recebíveis indexados a IPCA ou CDI",
        isento_ir: true,
        metricas: {
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 4, otimo: 0.95, aceitavel: 1.03, ruim: 1.12 },
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 4, otimo: 13, aceitavel: 10, ruim: 8, ancora_macro: "cdi" },
          // sem imóvel não há vacância: o risco é de crédito, e diluído é melhor
          concentracao: { rotulo: "Concentração — maior CRI da carteira", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 5, aceitavel: 10, ruim: 25 },
          liquidez: { rotulo: "Liquidez diária", unidade: "R$", direcao: "maior_melhor", peso: 2, otimo: 3000000, aceitavel: 500000, ruim: 100000 },
        },
      },
      fii_fof: {
        descricao: "Fundo de fundos — carteira de cotas de outros FIIs",
        isento_ir: true,
        metricas: {
          // FOF costuma negociar com desconto: o próprio desconto é parte da tese
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 3, otimo: 0.88, aceitavel: 0.98, ruim: 1.08 },
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 11, aceitavel: 9, ruim: 7, ancora_macro: "cdi" },
          concentracao: { rotulo: "Concentração — maior FII da carteira", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 10, aceitavel: 20, ruim: 40 },
          liquidez: { rotulo: "Liquidez diária", unidade: "R$", direcao: "maior_melhor", peso: 2, otimo: 3000000, aceitavel: 500000, ruim: 100000 },
        },
      },
      fii_hibrido: {
        descricao: "FII híbrido — imóveis e papéis na mesma carteira",
        isento_ir: true,
        metricas: {
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 3, otimo: 0.92, aceitavel: 1.02, ruim: 1.2 },
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 11.5, aceitavel: 9, ruim: 7, ancora_macro: "cdi" },
          vacancia: { rotulo: "Vacância física", unidade: "%", direcao: "menor_melhor", peso: 1, otimo: 3, aceitavel: 10, ruim: 25 },
          vacancia_financeira: { rotulo: "Vacância financeira (estimada)", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 3, aceitavel: 8, ruim: 20 },
          concentracao: { rotulo: "Concentração — maior posição", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: 15, aceitavel: 30, ruim: 60 },
          liquidez: { rotulo: "Liquidez diária", unidade: "R$", direcao: "maior_melhor", peso: 2, otimo: 3000000, aceitavel: 500000, ruim: 100000 },
        },
      },
      acao_br: {
        descricao: "Ação listada na B3",
        isento_ir: true,
        metricas: {
          pl: { rotulo: "P/L", direcao: "menor_melhor", peso: 3, otimo: 7, aceitavel: 12, ruim: 20 },
          pvp: { rotulo: "P/VP", direcao: "menor_melhor", peso: 2, otimo: 1, aceitavel: 2, ruim: 4 },
          // sem âncora macro de propósito: ação rende dividendo MAIS valorização
          dy: { rotulo: "Dividend Yield", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 8, aceitavel: 5, ruim: 2 },
          roe: { rotulo: "ROE", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 20, aceitavel: 12, ruim: 5 },
          div_liq_pl: { rotulo: "Dívida líquida / Patrimônio", direcao: "menor_melhor", peso: 2, otimo: 0.3, aceitavel: 1, ruim: 2.5 },
          cresc_rec_5a: { rotulo: "Crescimento da receita em 5 anos", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 15, aceitavel: 5, ruim: 0 },
          liquidez: { rotulo: "Liquidez 2 meses", unidade: "R$", direcao: "maior_melhor", peso: 1, otimo: 50000000, aceitavel: 5000000, ruim: 500000 },
        },
      },
      etf_br: {
        // ETF de índice não tem P/VP nem P/L próprios e não distribui:
        // só dá para medir o preço contra a própria história (timing).
        descricao: "ETF de índice na B3 — IVVB11, BOVA11, GOLD11, NASD11",
        isento_ir: false,
        metricas: {
          premio_media_200d: { rotulo: "Prêmio sobre a média de 200 dias", unidade: "%", direcao: "menor_melhor", peso: 3, otimo: -5, aceitavel: 8, ruim: 25 },
          dist_maxima_52s: { rotulo: "Desconto da máxima de 52 semanas", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 15, aceitavel: 5, ruim: 0 },
        },
      },
      acao_us: {
        descricao: "Ação listada nos EUA — cobertura fundamentalista menor",
        metricas: {
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 4, aceitavel: 2, ruim: 0.5 },
          dist_maxima_52s: { rotulo: "Desconto da máxima de 52 semanas", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 25, aceitavel: 10, ruim: 0 },
          premio_media_200d: { rotulo: "Prêmio sobre a média de 200 dias", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: -5, aceitavel: 8, ruim: 25 },
        },
      },
      cripto: {
        // Cripto não tem lucro, patrimônio nem dividendo: como no ETF de
        // índice, só existe o preço contra a própria história. As faixas são
        // mais largas porque a volatilidade é várias vezes a da bolsa — um
        // prêmio de 20% sobre a média de 200 dias é comum em alta.
        descricao: "Criptomoeda — cotada em dólar e convertida pelo câmbio do dia",
        isento_ir: false,
        metricas: {
          premio_media_200d: { rotulo: "Prêmio sobre a média de 200 dias", unidade: "%", direcao: "menor_melhor", peso: 3, otimo: -15, aceitavel: 15, ruim: 50 },
          dist_maxima_52s: { rotulo: "Desconto da máxima de 52 semanas", unidade: "%", direcao: "maior_melhor", peso: 2, otimo: 40, aceitavel: 15, ruim: 0 },
        },
      },
      etf_us: {
        descricao: "ETF — avaliado por preço relativo e distribuição",
        metricas: {
          dy: { rotulo: "Dividend Yield 12m", unidade: "%", direcao: "maior_melhor", peso: 1, otimo: 3, aceitavel: 1.5, ruim: 0.3 },
          dist_maxima_52s: { rotulo: "Desconto da máxima de 52 semanas", unidade: "%", direcao: "maior_melhor", peso: 3, otimo: 20, aceitavel: 8, ruim: 0 },
          premio_media_200d: { rotulo: "Prêmio sobre a média de 200 dias", unidade: "%", direcao: "menor_melhor", peso: 2, otimo: -5, aceitavel: 8, ruim: 25 },
        },
      },
    },
    // o Fundamentus erra alguns segmentos; aqui se força a mão
    override_perfil: { MXRF11: "fii_papel", KNCR11: "fii_papel", IRDM11: "fii_papel", RECR11: "fii_papel", CPTS11: "fii_papel" },
    segmentos_papel: ["Títulos e Val. Mob.", "Titulos e Val. Mob.", "Papel"],
    // Recomendação do perfil do investidor (editável em Ajustes → Regras →
    // faixas avançadas). Pontos de partida para calibrar, não números da
    // pesquisa. Hierarquia: renda fixa > ações > cripto. Os pesos do
    // questionário ficam em FC.PERFIL, versionados.
    perfil: {
      alocacao: {
        conservador: { renda_fixa: [85, 95], fiis: [0, 5], acoes: [0, 10], cripto: [0, 0] },
        moderado: { renda_fixa: [60, 70], fiis: [10, 15], acoes: [15, 25], cripto: [0, 3] },
        arrojado: { renda_fixa: [40, 50], fiis: [10, 20], acoes: [25, 35], cripto: [3, 7] },
      },
      // nota mínima nas quatro lentes para virar candidato
      score_minimo: { conservador: 70, moderado: 60, arrojado: 55 },
      // peso máximo de um ativo na carteira (% do investido)
      peso_max_ativo: { conservador: 5, moderado: 8, arrojado: 10 },
      // liquidez diária mínima (R$) quando o ativo tem a medida
      liquidez_minima: { conservador: 1000000, moderado: 500000, arrojado: 100000 },
      // quanto da sobra mensal informada vira aporte sugerido
      fator_aporte: { conservador: 0.5, moderado: 0.7, arrojado: 0.85 },
    },
  };

  // ------------------------------------------------------------------ renda
  // Setores cujo lucro vem de tarifa regulada, contrato longo ou spread —
  // não de cotação de commodity. Condição para dividendo recorrente.
  FC.PADRAO_RENDA = {
    criterios_padrao: { dy_desejado: 6, payout_maximo: 100, dl_ebitda_maximo: 3, liquidez_minima: 1 },
    setores: {
      Bancos: {
        sem_ebitda: true,
        empresas: {
          BBAS3: "Banco do Brasil", ITUB4: "Itaú Unibanco", BBDC4: "Bradesco", SANB11: "Santander Brasil",
          BPAC11: "BTG Pactual", ABCB4: "Banco ABC Brasil", BRSR6: "Banrisul", BMGB4: "Banco BMG",
          ITSA4: "Itaúsa", PINE4: "Banco Pine", BRBI11: "BR Partners", BMEB4: "Banco Mercantil do Brasil",
        },
      },
      Energia: {
        empresas: {
          EQTL3: "Equatorial", CMIG4: "Cemig", CPLE3: "Copel", ENGI11: "Energisa", EGIE3: "Engie Brasil",
          TAEE11: "Taesa", ISAE4: "ISA Energia", AURE3: "Auren Energia", CPFE3: "CPFL Energia", ALUP11: "Alupar",
        },
      },
      Saneamento: { empresas: { SBSP3: "Sabesp", SAPR11: "Sanepar", CSMG3: "Copasa" } },
      Telecom: {
        empresas: { VIVT3: "Vivo (Telefônica Brasil)", TIMS3: "TIM Brasil", DESK3: "Desktop", FIQE3: "Unifique", BRST3: "Brisanet" },
      },
    },
  };

  // ------------------------------------------------------------------ projeção
  // Tudo em moeda de hoje (termos reais). Valorização SEM proventos: os
  // proventos saem do DY observado de cada ativo.
  FC.PADRAO_PREMISSAS = {
    horizonte_anos: 20,
    aporte_mensal: 500,
    reinvestir_proventos: true,
    distribuicao_aporte: "rebalancear",
    // % a.a. por pilar; vazio usa a fórmula médio + real + atual (FC.projecao)
    valorizacao_premissa: {},
    crescimento_aporte_real: 0,   // % a.a. acima da inflação (aumento de renda)
    volatilidade: {},             // % a.a. por pilar; vazio usa a dos seus ativos + referência
    // vazio: sai do CDI/IPCA de hoje e converge para FC.projecao.LONGO_PRAZO
    macro_longo_prazo: { cdi: null, ipca: null },
    meses_convergencia: null,
    renda_alvo: null,             // R$/mês; vazio usa a renda desejada dos objetivos
    taxa_saque: null,             // % a.a.; vazio usa FC.projecao.TAXA_SAQUE
  };

  // ------------------------------------------------------------------ objetivos
  // Guardados em preferencias.premissas.objetivos (sem coluna própria), junto
  // com premissas.titulos = { [id]: { instituicao, isento, reserva } }.
  FC.PADRAO_OBJETIVOS = { custo_vida_mensal: null, meses_reserva: 6, renda_desejada_mensal: null };
  FC.objetivos = function (prefs) {
    const o = { ...FC.PADRAO_OBJETIVOS, ...((((prefs || {}).premissas) || {}).objetivos || {}) };
    if (!(o.meses_reserva > 0)) o.meses_reserva = 6;
    // sem renda desejada, a meta é cobrir o custo de vida
    if (!(o.renda_desejada_mensal > 0)) o.renda_desejada_mensal = o.custo_vida_mensal > 0 ? o.custo_vida_mensal : null;
    return o;
  };
  FC.infoTitulo = (prefs, id) => ((((prefs || {}).premissas) || {}).titulos || {})[id] || {};

  // ------------------------------------------------------------------ perfil do investidor
  // Questionário em quatro blocos, cada um alimenta um eixo e é pontuado
  // sozinho: capacidade (blocos 1 e 2), necessidade (bloco 3, calculada) e
  // tolerância (bloco 4). O perfil final é o MENOR entre tolerância e
  // capacidade, nunca a média. Mudou algum ponto ou teto? Suba `versao`:
  // cada avaliação guardada diz com qual versão foi calculada, e o banco
  // recalcula com a mesma tabela (supabase/schema.sql, gerada por
  // scripts/gera-perfil-sql.js).
  //   c = pontos de capacidade · t = pontos de tolerância
  //   v = valor de referência (R$, meses ou anos) · nd = "prefiro não dizer"
  const ND = { id: "nd", rotulo: "Prefiro não dizer", nd: true };
  FC.PERFIL = {
    versao: "perfil-v1",
    meses_validade: 24,       // depois disso o perfil está vencido
    meses_revisao: 12,        // revisão sugerida
    max_adiamentos: 3,        // convite a contas antigas
    taxa_sobra_cheia: 0.30,   // poupar 30% da renda vale os pontos todos
    neutro: 0.4,              // sem resposta: 40% dos pontos do item
    faixas: [
      { chave: "conservador", nome: "Conservador", de: 0, ate: 34 },
      { chave: "moderado", nome: "Moderado", de: 35, ate: 64 },
      { chave: "arrojado", nome: "Arrojado", de: 65, ate: 100 },
    ],
    // tetos que nenhuma resposta compensa
    tetos: {
      divida_cara: 20,        // o plano começa por quitar
      reserva_curta: 30,      // menos de 3 meses: o plano começa pela reserva
      prazo_curto: 25,        // objetivo em menos de 2 anos
      saque_provavel: 40,     // pode precisar do dinheiro antes
    },
    agro_alto: { limite_pct: 50, desconto: 15 },   // agro acima disso reduz a capacidade
    // duas ideias do bloco 4 perguntadas de dois jeitos: se divergem 2 degraus ou mais, "baixa consistência"
    espelhos: [["t_queda", "t_clima"], ["t_certo", "t_carteiras"]],
    degraus_contradicao: 2,
    // conhecimento limita produtos, não o perfil: teto de peso (%) por classe
    conhecimento: {
      nenhum: { acoes: 10, fiis: 5, cripto: 0 },
      basico: { acoes: 25, fiis: 20, cripto: 3 },
      experiente: { acoes: 100, fiis: 100, cripto: 100 },
    },
    estudar_peso_max: 2,      // % máximo de ativo "para estudar"
    cripto_grandes: ["BTC", "ETH", "BNB", "SOL"],
    // meses de custo da reserva, por estabilidade da renda
    reserva_meses: { estavel: 6, clt: 6, variavel: 12, sem_renda: 12, nd: 6 },
    // prêmio real (p.p.) de cada classe sobre a renda fixa real, para o retorno de referência
    premios: { renda_fixa: 0, fiis: 2.5, acoes: 4, cripto: 6 },
    retorno_real_padrao: 4,   // % a.a. real da renda fixa sem CDI e IPCA do mercado
    blocos: [
      { id: "sobre", n: 1, nome: "Sobre você", eixo: "Capacidade",
        porque: "Idade, estabilidade da renda e dependentes mostram quanta folga você tem para se recuperar de uma perda." },
      { id: "dinheiro", n: 2, nome: "Seu dinheiro hoje", eixo: "Capacidade",
        porque: "Renda, sobra e reserva dizem quanto você pode perder sem mexer na sua vida. Usamos faixas: não precisa do valor exato." },
      { id: "objetivo", n: 3, nome: "Objetivo e prazo", eixo: "Necessidade",
        porque: "O que você quer alcançar e em quanto tempo define o retorno que o plano precisa entregar." },
      { id: "reacao", n: 4, nome: "Experiência e reação", eixo: "Tolerância",
        porque: "Não há resposta certa: mede como você se sente diante de risco, que é diferente do quanto você pode perder." },
    ],
    // essencial: sem ela o perfil não sai. As outras podem ficar para o checklist.
    perguntas: [
      // ---------- 1. sobre você
      { id: "idade", bloco: "sobre", essencial: true, texto: "Quantos anos você tem?",
        porque: "Quanto mais jovem, mais tempo para se recuperar de uma queda.",
        opcoes: [
          { id: "ate_30", rotulo: "Até 30 anos", c: 15 }, { id: "31_40", rotulo: "31 a 40", c: 13 }, { id: "41_50", rotulo: "41 a 50", c: 10 },
          { id: "51_60", rotulo: "51 a 60", c: 6 }, { id: "61_mais", rotulo: "Mais de 60", c: 3 },
        ] },
      { id: "estab", bloco: "sobre", essencial: true, texto: "Como é a sua renda?",
        porque: "Renda estável aguenta mais oscilação do que renda que muda de mês a mês.",
        opcoes: [
          { id: "estavel", rotulo: "Estável: servidor público ou aposentadoria", c: 20, v: "estavel" },
          { id: "clt", rotulo: "Salário fixo com carteira assinada", c: 15, v: "clt" },
          { id: "variavel", rotulo: "Varia: autônomo, comissão, empresário", c: 8, v: "variavel" },
          { id: "sem_renda", rotulo: "No momento, sem renda", c: 0, v: "sem_renda" },
          { ...ND, c: 8, v: "nd" },
        ] },
      { id: "dependentes", bloco: "sobre", essencial: false, texto: "Quantas pessoas dependem da sua renda?",
        porque: "Mais dependentes pedem mais folga no seu orçamento.",
        opcoes: [
          { id: "0", rotulo: "Só eu", c: 10 }, { id: "1", rotulo: "1 pessoa", c: 7 }, { id: "2", rotulo: "2 pessoas", c: 4 }, { id: "3_mais", rotulo: "3 ou mais", c: 2 },
        ] },
      // ---------- 2. seu dinheiro hoje
      { id: "renda", bloco: "dinheiro", essencial: true, dinheiro: true, texto: "Quanto você recebe por mês, já com os descontos?",
        porque: "Com a renda e a sobra, calculamos quanto do que entra você consegue guardar. Guardamos só a faixa, nunca o valor exato.",
        opcoes: [
          { id: "ate_3k", rotulo: "Até R$ 3 mil", v: 2000 }, { id: "3_5k", rotulo: "R$ 3 a 5 mil", v: 4000 }, { id: "5_8k", rotulo: "R$ 5 a 8 mil", v: 6500 },
          { id: "8_15k", rotulo: "R$ 8 a 15 mil", v: 11500 }, { id: "15_30k", rotulo: "R$ 15 a 30 mil", v: 22500 }, { id: "30k_mais", rotulo: "Mais de R$ 30 mil", v: 40000 }, ND,
        ] },
      { id: "sobra", bloco: "dinheiro", essencial: true, dinheiro: true, texto: "Quanto costuma sobrar por mês?",
        porque: "É daqui que sai o aporte sugerido. Sem isso o plano não consegue dizer quanto guardar.",
        opcoes: [
          { id: "nada", rotulo: "Nada ou fico no vermelho", v: 0 }, { id: "ate_500", rotulo: "Até R$ 500", v: 250 }, { id: "500_1500", rotulo: "R$ 500 a 1.500", v: 1000 },
          { id: "1500_3000", rotulo: "R$ 1.500 a 3 mil", v: 2250 }, { id: "3000_6000", rotulo: "R$ 3 a 6 mil", v: 4500 }, { id: "6000_mais", rotulo: "Mais de R$ 6 mil", v: 8000 }, ND,
        ] },
      { id: "reserva", bloco: "dinheiro", essencial: true, dinheiro: true, texto: "Quantos meses do seu custo de vida você tem guardados, de fácil resgate?",
        porque: "A reserva de emergência é o primeiro passo: sem ela, qualquer imprevisto força a vender investimento na hora errada.",
        opcoes: [
          { id: "nenhuma", rotulo: "Nenhum", c: 0, v: 0 }, { id: "menos_3", rotulo: "Menos de 3 meses", c: 1, v: 1.5 }, { id: "3_6", rotulo: "3 a 6 meses", c: 3, v: 4.5 },
          { id: "6_12", rotulo: "6 a 12 meses", c: 4, v: 9 }, { id: "12_mais", rotulo: "Mais de 12 meses", c: 5, v: 12 }, { ...ND, c: 1, v: null },
        ] },
      { id: "divida", bloco: "dinheiro", essencial: true, texto: "Você tem dívida cara em aberto, como cartão rotativo ou cheque especial?",
        porque: "Nenhum investimento rende mais do que o juro do rotativo. Com dívida cara, o plano começa por quitar.",
        opcoes: [{ id: "nao", rotulo: "Não" }, { id: "sim", rotulo: "Sim" }] },
      { id: "patrimonio", bloco: "dinheiro", essencial: false, dinheiro: true, texto: "Quanto você já tem investido, somando tudo?",
        porque: "Quanto maior o patrimônio, menor o peso de uma queda na sua vida.",
        opcoes: [
          { id: "nada", rotulo: "Ainda nada", c: 0, v: 0 }, { id: "ate_10k", rotulo: "Até R$ 10 mil", c: 4, v: 5000 }, { id: "10_50k", rotulo: "R$ 10 a 50 mil", c: 8, v: 30000 },
          { id: "50_200k", rotulo: "R$ 50 a 200 mil", c: 12, v: 125000 }, { id: "200k_1m", rotulo: "R$ 200 mil a 1 milhão", c: 17, v: 600000 },
          { id: "1m_mais", rotulo: "Mais de R$ 1 milhão", c: 20, v: 1500000 }, { ...ND, c: 8, v: null },
        ] },
      { id: "moradia", bloco: "dinheiro", essencial: false, texto: "Como é a sua moradia?",
        porque: "Casa própria quitada reduz o seu custo fixo e aumenta a folga.",
        opcoes: [
          { id: "propria", rotulo: "Própria", c: 5 }, { id: "familia", rotulo: "Cedida ou com a família", c: 4 }, { id: "aluguel", rotulo: "Aluguel ou financiada", c: 2 },
        ] },
      // ---------- 3. objetivo e prazo
      { id: "objetivo", bloco: "objetivo", essencial: true, texto: "Qual é o seu objetivo principal com o dinheiro?",
        porque: "O objetivo decide para que serve a carteira: segurança, renda ou crescimento.",
        opcoes: [
          { id: "reserva", rotulo: "Montar uma reserva" }, { id: "imovel", rotulo: "Comprar um imóvel" }, { id: "aposentadoria", rotulo: "Aposentadoria ou independência" },
          { id: "renda_passiva", rotulo: "Viver de renda passiva" }, { id: "crescer", rotulo: "Fazer o patrimônio crescer" }, { id: "educacao", rotulo: "Educação ou um grande projeto" },
        ] },
      { id: "valor_alvo", bloco: "objetivo", essencial: false, dinheiro: true, texto: "Quanto você quer juntar para esse objetivo?",
        porque: "Com o valor, o prazo e o que você guarda, calculamos o retorno que o objetivo exige.",
        opcoes: [
          { id: "ate_50k", rotulo: "Até R$ 50 mil", v: 30000 }, { id: "50_200k", rotulo: "R$ 50 a 200 mil", v: 125000 }, { id: "200_500k", rotulo: "R$ 200 a 500 mil", v: 350000 },
          { id: "500k_1m", rotulo: "R$ 500 mil a 1 milhão", v: 750000 }, { id: "1m_3m", rotulo: "R$ 1 a 3 milhões", v: 2000000 }, { id: "3m_mais", rotulo: "Mais de R$ 3 milhões", v: 5000000 }, ND,
        ] },
      { id: "prazo", bloco: "objetivo", essencial: true, texto: "Em quanto tempo você quer chegar lá?",
        porque: "Prazo curto não combina com risco alto: uma queda pode não dar tempo de voltar.",
        opcoes: [
          { id: "menos_2", rotulo: "Em menos de 2 anos", v: 1 }, { id: "2_5", rotulo: "De 2 a 5 anos", v: 3.5 }, { id: "5_10", rotulo: "De 5 a 10 anos", v: 7.5 },
          { id: "10_20", rotulo: "De 10 a 20 anos", v: 15 }, { id: "20_mais", rotulo: "Mais de 20 anos", v: 25 },
        ] },
      { id: "saque", bloco: "objetivo", essencial: false, texto: "Qual a chance de você precisar desse dinheiro antes do prazo?",
        porque: "Quem pode precisar do dinheiro antes não deve deixá-lo em algo que pode estar em queda.",
        opcoes: [{ id: "nao", rotulo: "Baixa" }, { id: "talvez", rotulo: "Média" }, { id: "provavel", rotulo: "Alta" }] },
      // ---------- 4. experiência e reação
      { id: "tempo", bloco: "reacao", essencial: true, texto: "Há quanto tempo você investe?",
        porque: "Experiência com altos e baixos muda como as pessoas reagem na prática.",
        opcoes: [
          { id: "nunca", rotulo: "Ainda não invisto", k: 0 }, { id: "menos_1", rotulo: "Menos de 1 ano", k: 1 }, { id: "1_3", rotulo: "1 a 3 anos", k: 2 },
          { id: "3_5", rotulo: "3 a 5 anos", k: 3 }, { id: "5_mais", rotulo: "Mais de 5 anos", k: 4 },
        ] },
      { id: "produtos", bloco: "reacao", essencial: false, multipla: true, texto: "Quais destes você já usou?",
        porque: "Quem nunca investiu em renda variável vê esses produtos só como “para estudar”, com peso limitado.",
        opcoes: [
          { id: "poupanca", rotulo: "Poupança" }, { id: "renda_fixa", rotulo: "CDB, Tesouro ou outra renda fixa" }, { id: "fundos", rotulo: "Fundos" },
          { id: "acoes", rotulo: "Ações ou ETFs", rv: true }, { id: "fii", rotulo: "Fundos imobiliários", rv: true }, { id: "cripto", rotulo: "Criptomoedas", rv: true },
        ] },
      { id: "t_queda", bloco: "reacao", essencial: true, texto: "Seu investimento perde 20% em três meses. O que você faz?",
        porque: "Uma das perguntas que medem a sua reação a quedas.",
        opcoes: [
          { id: "vende", rotulo: "Vendo tudo para não perder mais", t: 0 }, { id: "parte", rotulo: "Vendo uma parte", t: 1 },
          { id: "mantem", rotulo: "Mantenho e espero", t: 2 }, { id: "aporta", rotulo: "Aporto mais, ficou mais barato", t: 3 },
        ] },
      { id: "t_certo", bloco: "reacao", essencial: true, texto: "Qual você prefere: R$ 1.000 garantidos ou 50% de chance de ganhar R$ 2.500 (e 50% de não ganhar nada)?",
        porque: "Compara a certeza com o ganho maior e incerto.",
        opcoes: [
          { id: "certo", rotulo: "Os R$ 1.000 garantidos", t: 0 }, { id: "quase_certo", rotulo: "Garantidos, mas pensei na aposta", t: 1 },
          { id: "quase_risco", rotulo: "A aposta, com algum receio", t: 2 }, { id: "risco", rotulo: "A aposta, sem hesitar", t: 3 },
        ] },
      { id: "amigo", bloco: "reacao", essencial: true, texto: "Como um amigo próximo descreveria você diante de risco?",
        porque: "O olhar de fora costuma ser mais honesto que o nosso.",
        opcoes: [
          { id: "cauteloso", rotulo: "Muito cauteloso", t: 0 }, { id: "prudente", rotulo: "Prudente", t: 1 },
          { id: "equilibrado", rotulo: "Equilibrado", t: 2 }, { id: "ousado", rotulo: "Ousado", t: 3 },
        ] },
      { id: "t_perda", bloco: "reacao", essencial: true, texto: "Qual a maior perda, em um ano, que você aceitaria na sua carteira para ter chance de ganhar mais?",
        porque: "Coloca um número no seu limite.",
        opcoes: [
          { id: "zero", rotulo: "Nenhuma", t: 0 }, { id: "5", rotulo: "Até 5%", t: 1 }, { id: "10", rotulo: "Até 10%", t: 2 },
          { id: "20", rotulo: "Até 20%", t: 3 }, { id: "30", rotulo: "30% ou mais", t: 4 },
        ] },
      { id: "t_clima", bloco: "reacao", essencial: true, texto: "O mercado cai forte e só se fala em crise. Como você se sente?",
        porque: "A mesma ideia da pergunta de queda, perguntada de outro jeito, para conferir a consistência.",
        opcoes: [
          { id: "angustia", rotulo: "Muita angústia, quero sair", t: 0 }, { id: "preocupa", rotulo: "Preocupado, mas aguento", t: 1 },
          { id: "neutro", rotulo: "Tranquilo, é parte do jogo", t: 2 }, { id: "oportunidade", rotulo: "Vejo oportunidade", t: 3 },
        ] },
      { id: "t_carteiras", bloco: "reacao", essencial: true, texto: "Entre duas carteiras, qual você escolheria? A rende 6% ao ano sem oscilar. B pode render 14% ou perder 8%.",
        porque: "Compara estabilidade com possibilidade de ganho, em números.",
        opcoes: [
          { id: "a", rotulo: "A, com certeza", t: 0 }, { id: "mais_a", rotulo: "A, mas tenho curiosidade pela B", t: 1 },
          { id: "mais_b", rotulo: "B, com algum receio", t: 2 }, { id: "b", rotulo: "B, sem dúvida", t: 3 },
        ] },
      { id: "t_foco", bloco: "reacao", essencial: true, texto: "O que pesa mais para você numa carteira?",
        porque: "Mostra se a prioridade é proteger o que existe ou fazer crescer.",
        opcoes: [
          { id: "preservar", rotulo: "Não perder o que já tenho", t: 0 }, { id: "mais_preservar", rotulo: "Proteger, mas com algum ganho", t: 1 },
          { id: "equilibrar", rotulo: "Equilibrar ganho e proteção", t: 2 }, { id: "crescer", rotulo: "Fazer crescer, aceitando oscilar", t: 3 },
        ] },
    ],
    // por que cada recomendação existe: o Relatório monta o texto pelo id da regra
    regras: {
      "plano.divida_cara": "Você declarou dívida cara em aberto. Nenhum investimento rende mais que o juro do rotativo, então o plano começa por quitá-la.",
      "plano.reserva_6": "Renda estável pede reserva de 6 meses de custo de vida, em renda fixa pós-fixada com liquidez diária.",
      "plano.reserva_12": "Renda variável ou autônoma pede reserva de 12 meses de custo de vida, em renda fixa pós-fixada com liquidez diária.",
      "plano.reserva_ok": "Sua reserva já cobre os meses recomendados para o seu tipo de renda.",
      "plano.objetivo_curto": "Objetivo em menos de 2 anos fica em renda fixa com vencimento casado ao prazo, fora da carteira de risco.",
      "plano.longo_prazo": "O que sobra depois da reserva segue a alocação do seu perfil.",
      "plano.aporte": "Aporte sugerido: a sobra mensal que você informou vezes o fator do perfil {perfil} ({fator}).",
      "alocacao.faixa_perfil": "Perfil {perfil}: faixas de alocação do seu perfil, com o ponto dentro da faixa dado pelo seu score ({score}).",
      "alocacao.teto_conhecimento": "{classe} limitada a {teto}% porque você ainda tem pouca experiência com renda variável.",
      "alocacao.modulo_desligado": "{classe} fica de fora porque o módulo está desligado em Ajustes.",
      "alocacao.hierarquia": "Renda fixa sempre a maior fatia, ações no meio e cripto a menor.",
      "alocacao.cripto_perfil": "Cripto limitada a {teto}%: perfil {perfil}.",
      "teto.divida_cara": "Capacidade limitada a {limite}: dívida cara em aberto.",
      "teto.reserva_curta": "Capacidade limitada a {limite}: reserva menor que 3 meses.",
      "teto.prazo_curto": "Capacidade limitada a {limite}: objetivo em menos de 2 anos.",
      "teto.saque_provavel": "Capacidade limitada a {limite}: chance alta de precisar do dinheiro antes do prazo.",
      "desconto.agro_alto": "Capacidade reduzida em {pontos} pontos: o agro passa de 50% do patrimônio.",
      "candidato.filtros": "Passa nos quatro filtros do perfil {perfil}: classe permitida, score mínimo, risco e concentração.",
      "conflito.meta_acima_perfil": "A sua meta pede mais risco do que cabe no seu perfil.",
      "conflito.meta_folgada": "Dá para chegar lá com menos risco.",
      "conflito.tolerancia_acima_capacidade": "O limite é a sua situação financeira, não a coragem.",
      "conflito.baixa_consistencia": "Respostas parecidas se contradisseram: o resultado fica marcado como baixa consistência.",
      "conflito.carteira_acima_perfil": "A carteira real é mais arriscada do que o perfil declarado.",
      "conflito.vendas_em_queda": "Houve vendas em quedas fortes, o que contradiz a tolerância declarada.",
    },
  };

  // ------------------------------------------------------------------ agro
  FC.CATEGORIAS_GADO = {
    bezerro: "Bezerro", bezerra: "Bezerra", garrote: "Garrote", novilha: "Novilha",
    boi_magro: "Boi magro", boi_gordo: "Boi gordo", vaca: "Vaca", touro: "Touro", outro: "Outro",
  };
  // peso vivo típico (kg) — só para estimar quando você ainda não pesou
  FC.PESO_TIPICO = { bezerro: 200, bezerra: 180, garrote: 300, novilha: 300, boi_magro: 380, boi_gordo: 540, vaca: 450, touro: 750, outro: 350 };
  FC.TIPOS_MOV = {
    compra: { nome: "Compra", sinal: 1, cor: "azul" },
    venda: { nome: "Venda", sinal: -1, cor: "verde" },
    nascimento: { nome: "Nascimento", sinal: 1, cor: "terra" },
    morte: { nome: "Morte", sinal: -1, cor: "vermelho" },
    entrada: { nome: "Outra entrada", sinal: 1, cor: "cinza" },
    saida: { nome: "Outra saída", sinal: -1, cor: "cinza" },
    reclassificacao: { nome: "Mudança de categoria", sinal: 0, cor: "amarelo" },
  };
  FC.CATEGORIAS_CUSTO = {
    nutricao: "Nutrição e sal", sanidade: "Sanidade e vacinas", mao_de_obra: "Mão de obra",
    arrendamento: "Arrendamento de pasto", frete: "Frete", maquinas: "Máquinas e combustível",
    impostos: "Impostos e taxas", outros: "Outros",
  };
  // A arroba é 15 kg de carcaça. Com rendimento de carcaça de ~52%, um
  // boi de 540 kg vivo rende 540 × 0,52 ÷ 15 ≈ 18,7 @.
  FC.PADRAO_AGRO = {
    preco_arroba: 310,
    rendimento_carcaca: 52,
    // preço por @ específico por categoria (ex.: bezerro costuma ter ágio)
    arroba_por_categoria: {},
    data_cotacao: null,
    // true: o rebanho vale o que foi pago até ser vendido (sem estimar pela @)
    avaliar_pelo_custo: false,
  };

  // mescla profunda: o que foi salvo sobrepõe o padrão, chave a chave
  FC.mescla = function mescla(base, sobre) {
    if (sobre == null) return JSON.parse(JSON.stringify(base));
    if (typeof base !== "object" || base == null || Array.isArray(base)) return sobre;
    const saida = JSON.parse(JSON.stringify(base));
    for (const [k, v] of Object.entries(sobre)) {
      if (v && typeof v === "object" && !Array.isArray(v) && typeof saida[k] === "object" && saida[k] && !Array.isArray(saida[k])) {
        saida[k] = mescla(saida[k], v);
      } else if (v !== undefined) {
        saida[k] = v;
      }
    }
    return saida;
  };
})();


/* ---- layout.js */
/* Layout personalizável: ordem das abas (topo e barra do celular) e dos
 * blocos do Início. Salvo em preferencias.layout:
 *
 *   { nav: { ordem: [rotaId…] },   // as 4 primeiras formam a barra do celular
 *     inicio: { ordem: [blocoId…], ocultos: [blocoId…] } }
 *
 * Sem "inicio" salvo, os blocos com padraoOculto começam desligados.
 *
 * Sem layout salvo vale o padrão do app. A resolução é pura (recebe as
 * rotas e o que está ligado), então roda igual no navegador e nos testes. */
(function () {
  const FC = window.FC;

  const MAX_CELULAR = 4;

  // blocos do Início, na ordem padrão. fixo: não dá para ocultar.
  // padraoOculto: começa desligado (os blocos de números brutos, que têm o
  // seu lugar nas outras telas); quem já salvou um layout mantém o que tinha.
  FC.LAYOUT_INICIO = [
    { id: "perfil", nome: "Perfil do investidor", desc: "convite, revisão ou plano pronto", icone: "bussola" },
    { id: "topo", nome: "Patrimônio e desempenho", desc: "quanto você tem, a nota da carteira e as metas", icone: "inicio", fixo: true },
    { id: "checklist", nome: "Primeiros passos", desc: "checklist de ativação", icone: "check" },
    { id: "comecar", nome: "Comece por aqui", desc: "só aparece com a carteira vazia", icone: "ativos" },
    { id: "curva", nome: "Curva do patrimônio", desc: "o patrimônio no período, em área", icone: "projecoes" },
    { id: "rosca", nome: "Rosca da alocação", desc: "cada pilar contra a meta", icone: "ativos" },
    { id: "barras_proventos", nome: "Barras de proventos", desc: "o que caiu em cada um dos últimos 12 meses", icone: "presente" },
    { id: "destaques", nome: "Melhores e piores", desc: "os que mais subiram e caíram no período", icone: "ativos" },
    { id: "retrospectivas", nome: "Retrospectivas", desc: "mês e ano em vídeo", icone: "play" },
    { id: "plano_realidade", nome: "Plano contra realidade", desc: "aporte do mês e reserva", icone: "alvo", padraoOculto: true },
    { id: "frase", nome: "Rendeu mais que o CDI?", desc: "comparação com CDI e inflação", icone: "projecoes", padraoOculto: true },
    { id: "detalhes", nome: "Detalhes técnicos", desc: "TIR, retorno por classe e juros do dia", icone: "info", padraoOculto: true },
    { id: "proximos30", nome: "Próximos 30 dias", desc: "vencimentos e proventos", icone: "calendario", padraoOculto: true },
    { id: "renda_passiva", nome: "Renda passiva", desc: "proventos por mês e a meta", icone: "moeda", padraoOculto: true },
    { id: "alocacao", nome: "Alocação por pilar", desc: "carteira contra as metas, em barras", icone: "ativos", padraoOculto: true },
    { id: "crescimento", nome: "Crescimento do patrimônio", desc: "gráfico dia a dia, com Selic e Ibovespa", icone: "projecoes", padraoOculto: true },
    { id: "proventos", nome: "Proventos por mês", desc: "o que a carteira depositou, em tabela", icone: "presente", padraoOculto: true },
    { id: "agro", nome: "Agro", desc: "rebanho resumido", icone: "boi", padraoOculto: true },
    { id: "melhores", nome: "Melhores e piores (lista)", desc: "ativos em destaque, com números", icone: "ativos", padraoOculto: true },
  ];
  const unicos = (l) => [...new Set(l)];
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

  // rotas: [{id, oculta?}] na ordem padrão · ligada(id): módulo ligado.
  // A barra do celular são as 4 primeiras abas da ordem (o resto vai para "Mais").
  function resolve(salvo, { rotas = [], ligada = () => true } = {}) {
    salvo = salvo && typeof salvo === "object" ? salvo : {};
    const nav = salvo.nav || {}, ini = salvo.inicio || {};

    // ---- navegação: só abas visíveis e ligadas; as novas entram no fim
    const validas = rotas.filter((r) => !r.oculta && ligada(r.id)).map((r) => r.id);
    const guardada = unicos(lista(nav.ordem)).filter((id) => validas.includes(id));
    const ordem = [...guardada, ...validas.filter((id) => !guardada.includes(id))];
    const celular = ordem.slice(0, MAX_CELULAR);

    // ---- Início: blocos conhecidos, novos entram no fim, fixos nunca somem
    const ids = FC.LAYOUT_INICIO.map((b) => b.id);
    const salvaOrdem = unicos(lista(ini.ordem)).filter((id) => ids.includes(id));
    const ordemInicio = [...salvaOrdem, ...ids.filter((id) => !salvaOrdem.includes(id))];
    const fixos = FC.LAYOUT_INICIO.filter((b) => b.fixo).map((b) => b.id);
    // com o Início já salvo, valem os ocultos dele (vazio = nenhum); sem, os do padrão
    const salvouInicio = !!salvo.inicio && typeof salvo.inicio === "object" && Object.keys(salvo.inicio).length > 0;
    const base = salvouInicio ? lista(ini.ocultos) : FC.LAYOUT_INICIO.filter((b) => b.padraoOculto).map((b) => b.id);
    const ocultos = unicos(base).filter((id) => ids.includes(id) && !fixos.includes(id));

    return { nav: { ordem, celular }, inicio: { ordem: ordemInicio, ocultos } };
  }

  // o que gravar: só o que difere do padrão (vazio = null = padrão)
  function paraSalvar(layout, padrao) {
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const nav = {}, ini = {};
    if (!igual(layout.nav.ordem, padrao.nav.ordem)) nav.ordem = layout.nav.ordem;
    if (!igual(layout.inicio.ordem, padrao.inicio.ordem)) ini.ordem = layout.inicio.ordem;
    // salvando o Início, os ocultos vão sempre (mesmo vazios): sem eles valeria o padrão
    if (ini.ordem || !igual([...layout.inicio.ocultos].sort(), [...padrao.inicio.ocultos].sort())) ini.ocultos = layout.inicio.ocultos;
    const saida = {};
    if (Object.keys(nav).length) saida.nav = nav;
    if (Object.keys(ini).length) saida.inicio = ini;
    return Object.keys(saida).length ? saida : null;
  }

  // move um item de `de` para `para` (índices) sem mutar
  function move(arr, de, para) {
    const a = arr.slice();
    if (de < 0 || de >= a.length) return a;
    const [x] = a.splice(de, 1);
    a.splice(Math.max(0, Math.min(a.length, para)), 0, x);
    return a;
  }

  FC.layout = { resolve, paraSalvar, move, MAX_CELULAR };
})();


/* ---- supa.js */
/* Tudo o que fala com o Supabase passa por aqui: sessão, tabelas e a
 * Edge Function de mercado. As telas nunca montam consulta sozinhas. */
(function () {
  const FC = window.FC;

  const sb = window.supabase.createClient(FC.config.supabaseUrl, FC.config.supabaseChave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "fc-sessao" },
  });
  FC.sb = sb;

  function checa({ data, error }) {
    if (error) throw error;
    return data;
  }

  // ------------------------------------------------------------------ acesso
  // Login, pedido de código por e-mail e confirmação passam pela Edge
  // Function "acesso", que limita tentativas por IP e por conta
  // (PLANO-SEGURANCA S1.3). O erro leva `espera` (segundos) quando bloqueado.
  async function acesso(corpo) {
    let r;
    try {
      r = await fetch(FC.config.supabaseUrl + "/functions/v1/acesso", { method: "POST",
        headers: { apikey: FC.config.supabaseChave, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    } catch (e) { throw new Error("Failed to fetch"); }
    // função ainda não publicada: segue pelo caminho direto do Supabase
    if (r.status === 404) return { semFuncao: true };
    let j = {};
    try { j = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) {
      const err = new Error(j.erro || "Falha no acesso (" + r.status + ")");
      err.codigo = j.codigo || (r.status === 429 ? "bloqueado" : "");
      err.espera = r.status === 429 ? Number(j.espera) || 60 : 0;
      throw err;
    }
    return j;
  }
  async function abreSessao(s) { return checa(await sb.auth.setSession(s)); }

  // ------------------------------------------------------------------ sessão
  FC.auth = {
    async sessao() { return checa(await sb.auth.getSession()).session; },
    async entrar(email, senha) {
      const j = await acesso({ acao: "entrar", email, senha });
      if (j.semFuncao) return checa(await sb.auth.signInWithPassword({ email, password: senha }));
      return abreSessao(j.sessao);
    },
    // código de 6 dígitos por e-mail: tipo "senha" (esqueci a senha) ou
    // "cadastro" (confirmar o e-mail). A resposta é a mesma exista a conta ou não.
    async pedirCodigo(tipo, email) {
      const j = await acesso({ acao: "pedir_codigo", tipo, email });
      if (!j.semFuncao) return;
      if (tipo === "senha") checa(await sb.auth.resetPasswordForEmail(email));
      else checa(await sb.auth.resend({ type: "signup", email }));
    },
    async confirmarCodigo(tipo, email, codigo) {
      const j = await acesso({ acao: "confirmar_codigo", tipo, email, codigo });
      if (j.semFuncao) return checa(await sb.auth.verifyOtp({ type: tipo === "senha" ? "recovery" : "signup", email, token: codigo }));
      return abreSessao(j.sessao);
    },
    async cadastrar(email, senha, nome = "") {
      return checa(await sb.auth.signUp({ email, password: senha, options: { data: nome ? { nome } : {} } }));
    },
    async sair() { await sb.auth.signOut(); },
    async trocarSenha(nova) { return checa(await sb.auth.updateUser({ password: nova })); },
    // verificação em duas etapas (TOTP)
    async nivel() { return checa(await sb.auth.mfa.getAuthenticatorAssuranceLevel()); },
    async fatores() { return checa(await sb.auth.mfa.listFactors()); },
    async inscreverTotp(nome) {
      // um fator pendente de outra tentativa impede a nova inscrição
      const f = await FC.auth.fatores();
      for (const x of (f.all || []).filter((x) => x.status !== "verified")) {
        await sb.auth.mfa.unenroll({ factorId: x.id });
      }
      return checa(await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: (nome || "Autenticador") + " · " + new Date().toLocaleDateString("pt-BR") + " " + Date.now().toString(36).slice(-4) }));
    },
    // Confere a senha atual SEM trocar a sessão aberta: pede um token à
    // parte e o revoga em seguida.
    async confereSenha(email, senha) {
      const base = FC.config.supabaseUrl + "/auth/v1";
      const r = await fetch(base + "/token?grant_type=password", { method: "POST",
        headers: { apikey: FC.config.supabaseChave, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: senha }) });
      if (r.status === 429) throw new Error("Muitas tentativas. Espere um minuto e tente de novo.");
      if (!r.ok) return false;
      const j = await r.json();
      try { await fetch(base + "/logout?scope=local", { method: "POST", headers: { apikey: FC.config.supabaseChave, Authorization: "Bearer " + j.access_token } }); } catch (e) { /* expira sozinho */ }
      return true;
    },
    // Senha vazada? Consulta o Have I Been Pwned por k-anonimato: só os 5
    // primeiros caracteres do hash SHA-1 saem daqui. null = não deu para checar.
    async senhaVazada(senha) {
      try {
        const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(senha));
        const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        const r = await fetch("https://api.pwnedpasswords.com/range/" + hex.slice(0, 5), { headers: { "Add-Padding": "true" } });
        if (!r.ok) return null;
        const linha = (await r.text()).split("\n").find((l) => l.startsWith(hex.slice(5)));
        return linha ? Number(linha.split(":")[1]) || 0 : 0;
      } catch (e) { return null; }
    },
    async sairDosOutros() { checa(await sb.auth.signOut({ scope: "others" })); },
    async verificarTotp(factorId, codigo) {
      const d = checa(await sb.auth.mfa.challenge({ factorId }));
      return checa(await sb.auth.mfa.verify({ factorId, challengeId: d.id, code: codigo }));
    },
    async removerTotp(factorId) { return checa(await sb.auth.mfa.unenroll({ factorId })); },
    usuario: null,
  };

  // ------------------------------------------------------------------ leitura em páginas
  async function tudo(tabela, ordem, asc = true) {
    const passo = 1000;
    let ini = 0, saida = [];
    for (;;) {
      let q = sb.from(tabela).select("*").range(ini, ini + passo - 1);
      if (ordem) q = q.order(ordem, { ascending: asc });
      const pag = checa(await q);
      saida = saida.concat(pag);
      if (pag.length < passo) return saida;
      ini += passo;
    }
  }

  const num = (v) => (v == null ? null : Number(v));
  function normAtivo(a) { return { ...a, quantidade: num(a.quantidade) || 0, preco_medio: num(a.preco_medio) }; }
  function normRF(r) { return { ...r, taxa: num(r.taxa), valor_aplicado: num(r.valor_aplicado) || 0, valor_atual: num(r.valor_atual) }; }
  function normAporte(a) { return { ...a, quantidade: num(a.quantidade), preco: num(a.preco), valor: num(a.valor), taxa: num(a.taxa), do_provento: num(a.do_provento) }; }
  function normMov(m) {
    return { ...m, cabecas: Number(m.cabecas), peso_medio_kg: num(m.peso_medio_kg), preco_arroba: num(m.preco_arroba),
             preco_cabeca: num(m.preco_cabeca), valor_total: num(m.valor_total) || 0, despesas: num(m.despesas) || 0, reinvestido: num(m.reinvestido) };
  }

  // ------------------------------------------------------------------ dados
  FC.db = {
    async carregaTudo() {
      const [ativos, rendaFixa, aportes, prefs, movs, custos, pesagens, historico, ganhos] = await Promise.all([
        tudo("ativos", "id"), tudo("renda_fixa", "id"), tudo("aportes", "data"),
        sb.from("preferencias").select("*").maybeSingle().then(checa),
        tudo("agro_movimentos", "data"), tudo("agro_custos", "data"), tudo("agro_pesagens", "data"),
        tudo("patrimonio_historico", "data"), tudo("ganhos", "inicio"),
      ]);
      return {
        ativos: ativos.map(normAtivo),
        rendaFixa: rendaFixa.map(normRF),
        aportes: aportes.map(normAporte),
        prefsBrutas: prefs || {},
        ganhos: ganhos.map((g) => ({ ...g, valor: num(g.valor) })),
        historico: historico.map((h) => ({ ...h, patrimonio: num(h.patrimonio), renda_variavel: num(h.renda_variavel) || 0,
          cripto: num(h.cripto) || 0, renda_fixa: num(h.renda_fixa) || 0, agro: num(h.agro) || 0, investido: num(h.investido) })),
        agro: { movs: movs.map(normMov), custos: custos.map((c) => ({ ...c, valor: num(c.valor) })),
                pesagens: pesagens.map((p) => ({ ...p, peso_medio_kg: num(p.peso_medio_kg), cabecas: Number(p.cabecas) })) },
      };
    },

    // genéricos
    async inserir(tabela, linha) { return checa(await sb.from(tabela).insert(linha).select().single()); },
    async inserirVarios(tabela, linhas, conflito) {
      if (!linhas.length) return [];
      const saida = [];
      for (let i = 0; i < linhas.length; i += 500) {
        let q = conflito
          ? sb.from(tabela).upsert(linhas.slice(i, i + 500), { onConflict: conflito, ignoreDuplicates: true })
          : sb.from(tabela).insert(linhas.slice(i, i + 500));
        saida.push(...(checa(await q.select()) || []));
      }
      return saida;
    },
    async atualizar(tabela, id, campos) { return checa(await sb.from(tabela).update(campos).eq("id", id).select().single()); },
    async apagar(tabela, id) { checa(await sb.from(tabela).delete().eq("id", id)); },

    async gravaPrefs(campos) {
      const uid = FC.auth.usuario.id;
      return checa(await sb.from("preferencias").upsert({ user_id: uid, ...campos, atualizado_em: new Date().toISOString() }).select().single());
    },

    // foto do dia: no mesmo dia, a mais recente substitui a anterior
    async gravaRegistro(linha) {
      return checa(await sb.from("patrimonio_historico").upsert({ ...linha, user_id: FC.auth.usuario.id }, { onConflict: "user_id,data" }).select().single());
    },
    async log(evento, detalhe = {}) {
      try { await sb.from("log_sistema").insert({ user_id: FC.auth.usuario.id, origem: "app", evento, detalhe }); } catch (e) { /* log não pode travar o app */ }
    },
    async logs(limite = 60) {
      return checa(await sb.from("log_sistema").select("*").order("quando", { ascending: false }).limit(limite));
    },

    async apagaConta() {
      // apaga os dados de todas as tabelas; a conta continua existindo
      for (const t of ["aportes", "ativos", "renda_fixa", "agro_movimentos", "agro_custos", "agro_pesagens", "preferencias", "patrimonio_historico", "ganhos"]) {
        checa(await sb.from(t).delete().not("user_id", "is", null));
      }
    },
  };

  // ------------------------------------------------------------------ conexões com IA (MCP)
  // Um assistente de IA (Claude, ChatGPT…) entra pela Edge Function "mcp" com
  // um token OAuth desta conta. O que ele pode fazer é o que está em
  // mcp_acessos: sem linha, nada; com linha, lê; com escrita, edita. A linha
  // só nasce aqui, numa sessão do próprio app (ver o bloco do MCP no schema).
  FC.mcp = {
    url: FC.config.supabaseUrl + "/functions/v1/mcp",
    // o pedido de autorização que trouxe a pessoa à tela de consentimento;
    // se ela já autorizou esse cliente antes, vem só { redirect_url }
    async pedido(id) { return checa(await sb.auth.oauth.getAuthorizationDetails(id)); },
    // grava o alcance ANTES de aprovar: o token já nasce com a regra valendo
    async aprova(id, cliente, escrita) {
      const uid = FC.auth.usuario.id;
      checa(await sb.from("mcp_acessos").upsert({ user_id: uid, client_id: cliente.id, nome: String(cliente.name || "").slice(0, 120), escrita: !!escrita }));
      try {
        return checa(await sb.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })).redirect_url;
      } catch (e) {
        try { await sb.from("mcp_acessos").delete().eq("user_id", uid).eq("client_id", cliente.id); } catch (e2) { /* sem token, a linha não vale nada */ }
        throw e;
      }
    },
    async nega(id) { return checa(await sb.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true })).redirect_url; },
    // o que o Auth diz que está autorizado, com o alcance que o banco aplica
    async lista() {
      const [grants, linhas] = await Promise.all([
        sb.auth.oauth.listGrants().then(checa),
        sb.from("mcp_acessos").select("*").then(checa),
      ]);
      const porId = Object.fromEntries((linhas || []).map((l) => [l.client_id, l]));
      const saida = (grants || []).map((g) => {
        const l = porId[g.client.id];
        delete porId[g.client.id];
        return { id: g.client.id, nome: g.client.name || (l && l.nome) || "Cliente sem nome", site: g.client.uri || "", desde: g.granted_at, com_dados: !!l, escrita: !!(l && l.escrita) };
      });
      // linha sem autorização no Auth: não entra mais, mas aparece para limpar
      for (const l of Object.values(porId)) saida.push({ id: l.client_id, nome: l.nome || "Cliente sem nome", site: "", desde: l.criado_em, com_dados: true, escrita: !!l.escrita, orfa: true });
      return saida;
    },
    async mudaEscrita(clienteId, escrita) {
      return checa(await sb.from("mcp_acessos").update({ escrita: !!escrita }).eq("user_id", FC.auth.usuario.id).eq("client_id", clienteId).select().single());
    },
    // primeiro o banco (o token em uso para de ler na hora), depois o Auth
    // (apaga os tokens de renovação desse cliente)
    async revoga(clienteId) {
      checa(await sb.from("mcp_acessos").delete().eq("user_id", FC.auth.usuario.id).eq("client_id", clienteId));
      const { error } = await sb.auth.oauth.revokeGrant({ clientId: clienteId });
      if (error && !/not found/i.test(error.message || "")) throw error;
    },
  };

  // ------------------------------------------------------------------ perfil do investidor
  // Tudo opcional: se as tabelas ainda não existem no banco (schema não
  // aplicado), carrega() devolve { indisponivel: true } e o app segue sem perfil.
  FC.perfilDb = {
    async carrega() {
      try {
        const uid = FC.auth.usuario.id;
        const [atual, rascunho, adiados, modo, ativou] = await Promise.all([
          sb.from("perfil_atual").select("*").maybeSingle().then(checa),
          sb.from("perfil_rascunho").select("*").maybeSingle().then(checa),
          sb.from("onboarding_eventos").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("evento", "adiado").then((r) => { if (r.error) throw r.error; return r.count || 0; }),
          sb.rpc("modo_recomendacao").then((r) => (r.error ? "educativo" : r.data || "educativo")),
          sb.from("onboarding_eventos").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("evento", "ativacao").then((r) => (r.error ? 0 : r.count || 0)),
        ]);
        let plano = null;
        if (atual) {
          plano = checa(await sb.from("plano_investimento").select("*").eq("perfil_id", atual.id).order("criado_em", { ascending: false }).limit(1).maybeSingle());
        }
        return { indisponivel: false, atual: atual ? { ...atual, necessidade: num(atual.necessidade) } : null, rascunho, plano, adiamentos: adiados, modo, ativou: ativou > 0 };
      } catch (e) {
        console.warn("perfil indisponível:", e.message || e);
        return { indisponivel: true, atual: null, rascunho: null, plano: null, adiamentos: 0, modo: "educativo", ativou: false };
      }
    },
    async salvaRascunho(respostas, passo) {
      return checa(await sb.from("perfil_rascunho").upsert({ user_id: FC.auth.usuario.id, versao_modelo: FC.PERFIL.versao, respostas, passo, atualizado_em: new Date().toISOString() }).select().single());
    },
    async apagaRascunho() { try { await sb.from("perfil_rascunho").delete().eq("user_id", FC.auth.usuario.id); } catch (e) { /* segue */ } },
    // o banco recalcula T, C e score: valor adulterado é recusado
    async conclui({ respostas, calculo, origem, necessidade }) {
      return checa(await sb.from("perfil_investidor").insert({
        versao_modelo: calculo.versao, origem, respostas, tolerancia: calculo.tolerancia, capacidade: calculo.capacidade,
        necessidade: necessidade == null || !Number.isFinite(necessidade) ? null : Math.round(necessidade * 1e4) / 1e4,
        score: calculo.score, perfil: calculo.perfil, consistencia: calculo.consistencia,
      }).select().single());
    },
    async salvaPlano({ perfilId, plano, modo }) {
      return checa(await sb.from("plano_investimento").insert({ perfil_id: perfilId, versao_modelo: FC.PERFIL.versao, modo, plano }).select().single());
    },
    async decide(id, decisao, antes, depois) {
      return checa(await sb.from("plano_investimento").update({ decisao, metas_antes: antes || null, metas_depois: depois || null, decidido_em: new Date().toISOString() }).eq("id", id).select().single());
    },
    async historico() {
      return checa(await sb.from("perfil_investidor").select("*").order("criado_em", { ascending: false }).limit(50));
    },
    async planos() {
      return checa(await sb.from("plano_investimento").select("id,perfil_id,modo,decisao,criado_em,decidido_em,metas_antes,metas_depois").order("criado_em", { ascending: false }).limit(50));
    },
    // só o nome do passo e o tempo: nunca valor financeiro
    async evento(evento, passo = null, duracaoMs = null) {
      try {
        await sb.from("onboarding_eventos").insert({ user_id: FC.auth.usuario.id, evento, passo: passo ? String(passo).slice(0, 40) : null,
          duracao_ms: duracaoMs == null ? null : Math.max(0, Math.min(86400000, Math.round(duracaoMs))) });
      } catch (e) { /* telemetria não trava o app */ }
    },
    async funil(dias = 90) { return checa(await sb.rpc("admin_funil_onboarding", { dias })); },
    // direito do titular: perfil, planos e histórico em JSON
    async exporta() {
      const [perfis, planos, rascunho] = await Promise.all([FC.perfilDb.historico(), FC.perfilDb.planos(),
        sb.from("perfil_rascunho").select("*").maybeSingle().then(checa)]);
      return { perfis, planos, rascunho };
    },
  };

  // ------------------------------------------------------------------ mercado
  // Cache em memória + no navegador: dado público de mercado, guardado só
  // para a próxima abertura ser instantânea. A fonte da verdade é a Edge
  // Function, que tem o próprio cache no banco.
  const memoria = {};
  const VALIDADE = { universo: 60 * 60 * 1000, historicos: 60 * 60 * 1000, benchmarks: 6 * 60 * 60 * 1000 };

  async function chama(corpo) {
    const { data, error } = await sb.functions.invoke("mercado", { body: corpo });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = j.erro || msg; } catch (e) { /* sem corpo */ }
      throw new Error("Mercado: " + msg);
    }
    return data;
  }

  function doNavegador(chave, validade) {
    const x = memoria[chave] || FC.local.ler("m:" + chave, null);
    if (x && Date.now() - x.t < validade) return x.d;
    return null;
  }
  function guarda(chave, d) {
    memoria[chave] = { t: Date.now(), d };
    // o universo inteiro passa de 500 KB; o navegador aguenta, mas se
    // faltar espaço simplesmente não guarda
    FC.local.gravar("m:" + chave, { t: Date.now(), d });
  }

  FC.mercado = {
    async universo(forcar = false) {
      if (!forcar) { const c = doNavegador("universo", VALIDADE.universo); if (c) return c; }
      const d = await chama({ acao: "universo", forcar });
      guarda("universo", d);
      return d;
    },
    async historicos(itens, anos = 3, forcar = false) {
      const saida = {}, faltam = [];
      for (const it of itens) {
        const k = `h:${it.ticker}:${anos}`;
        const c = !forcar && doNavegador(k, VALIDADE.historicos);
        if (c) saida[it.ticker] = c; else faltam.push(it);
      }
      for (let i = 0; i < faltam.length; i += 40) {
        const lote = faltam.slice(i, i + 40);
        const d = await chama({ acao: "historicos", itens: lote, anos, forcar });
        for (const [t, s] of Object.entries(d || {})) {
          saida[t] = s;
          if (!s.erro) guarda(`h:${t}:${anos}`, s);
        }
      }
      return saida;
    },
    async benchmarks(anos = 5, forcar = false) {
      const k = "bench:" + anos;
      if (!forcar) { const c = doNavegador(k, VALIDADE.benchmarks); if (c) return c; }
      const d = await chama({ acao: "benchmarks", anos, forcar });
      guarda(k, d);
      return d;
    },
    // dividendos/JCP/rendimentos com data com e de pagamento (cache de 6 h aqui, 12 h no servidor)
    async proventos(itens, forcar = false) {
      const saida = {}, faltam = [];
      for (const it of itens) {
        // "prov2": a versão anterior podia guardar a lista vazia de um FII pedido como ação
        const c = !forcar && doNavegador("prov2:" + it.ticker, 6 * 60 * 60 * 1000);
        if (c) saida[it.ticker] = c; else faltam.push(it);
      }
      if (faltam.length) {
        const d = (await chama({ acao: "proventos", itens: faltam })) || {};
        for (const [t, v] of Object.entries(d)) { saida[t] = v; if (!v.erro) guarda("prov2:" + t, v); }
      }
      return saida;
    },
    // raio-x de cada FII pelo informe trimestral da CVM (cache de 1 dia aqui, 7 no servidor)
    async fiisCvm(forcar = false) {
      if (!forcar) { const c = doNavegador("fiis_cvm", 24 * 60 * 60 * 1000); if (c) return c; }
      const d = await chama({ acao: "fiis_cvm", forcar });
      if (d && d.fundos) guarda("fiis_cvm", d);
      return d;
    },
    // títulos do Tesouro Direto: taxa e preço do último dia útil (cache de 1 h aqui, 6 h no servidor)
    async tesouro(forcar = false) {
      if (!forcar) { const c = doNavegador("tesouro", 60 * 60 * 1000); if (c) return c; }
      const d = await chama({ acao: "tesouro", forcar });
      if (d && d.titulos) guarda("tesouro", d);
      return d;
    },
    // CDI e Selic diários e IPCA mensal desde 2015, lidos direto da tabela
    // (dado público). Antes, pede à Edge Function que complete o que faltar.
    async indices(forcar = false) {
      // uma série vazia guardada (Edge Function fora do ar) não vale: tenta de novo
      if (!forcar) { const c = doNavegador("indices", 6 * 60 * 60 * 1000); if (c && c.cdi && c.cdi.length) return c; }
      try { await chama({ acao: "indices" }); } catch (e) { console.warn(e); /* lê o que já existe */ }
      const saida = { cdi: [], selic: [], ipca: [] };
      for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from("indices_diarios").select("indice,data,valor").order("indice").order("data").range(de, de + 999);
        if (error) throw error;
        for (const r of data) saida[r.indice].push([r.data, Number(r.valor)]);
        if (data.length < 1000) break;
      }
      if (saida.cdi.length) guarda("indices", saida);
      return saida;
    },
    // preço de agora: CoinGecko para cripto, Yahoo para bolsa (cache de 1 min no servidor)
    async cotacoes(itens) {
      if (!itens.length) return {};
      return (await chama({ acao: "cotacoes", itens })) || {};
    },
    // módulo Cripto: ranking (cache de 1 min no servidor), gráfico por período, ficha e busca
    async criptoMercado(simbolos = []) {
      return (await chama({ acao: "cripto_mercado", simbolos })) || { moedas: [] };
    },
    async criptoGrafico(id, dias) {
      const k = `cg:${id}:${dias}`;
      // o gráfico de 1 dia muda a cada minuto; os longos, em horas
      const c = doNavegador(k, dias === "1" ? 60 * 1000 : dias === "7" ? 5 * 60 * 1000 : 30 * 60 * 1000);
      if (c) return c;
      const d = await chama({ acao: "cripto_grafico", id, dias });
      if (d && d.precos && d.precos.length) { memoria[k] = { t: Date.now(), d }; }
      return d;
    },
    async criptoDetalhe(id) {
      const k = "cgd:" + id;
      const c = doNavegador(k, 5 * 60 * 1000);
      if (c) return c;
      const d = await chama({ acao: "cripto_detalhe", id });
      if (d && d.id) memoria[k] = { t: Date.now(), d };
      return d;
    },
    async criptoBusca(q) {
      return (await chama({ acao: "cripto_busca", q })) || [];
    },
    // manchetes por RSS (cache de 2 min no servidor)
    async noticias(tema = "mercado") {
      return (await chama({ acao: "noticias", tema })) || { itens: [] };
    },
    limpaCacheLocal() {
      for (const k of Object.keys(memoria)) delete memoria[k];
      try {
        Object.keys(localStorage).filter((k) => k.startsWith("fc:m:")).forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* sem armazenamento */ }
    },
  };
})();


/* ---- graficos.js */
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
    // série plana (inclusive com ruído de ponto flutuante): abre a escala
    if (!(hi - lo > 1e-9 * Math.max(1, Math.abs(lo)))) { hi = lo + (Math.abs(lo) || 1); lo = lo - (Math.abs(lo) || 1) * 0.1; }
    const bruto = (hi - lo) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) || bruto;
    const ini = Math.floor(lo / passo) * passo, fim = Math.ceil(hi / passo) * passo;
    const ticks = [];
    for (let v = ini, k = 0; v <= fim + passo / 2 && k < 50; v += passo, k++) ticks.push(Number(v.toFixed(10)));
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
  // banda: {inf:[[x,y]], sup:[[x,y]], classe?} ou uma lista delas (leque)
  // alvo: {valor, rotulo} — linha horizontal tracejada (fica de fora se
  // estiver longe demais dos dados para não achatar o gráfico)
  function linhas({ series, banda, alvo, altura = 260, y = "brl", x = "data", zero = false, degrau = false, privado = true }) {
    const bandas = !banda ? [] : Array.isArray(banda) ? banda.filter(Boolean) : [banda];
    const validas = series.filter((s) => s.pontos && s.pontos.length > 1);
    if (!validas.length) return html`<p class="texto-p">Ainda não há dados suficientes para o gráfico.</p>`;
    return marcador(altura, (L) => {
      const H = altura, mE = 58, mD = 14, mT = 12, mB = 28;
      const W = Math.max(L, 280);
      const todos = validas.flatMap((s) => s.pontos).concat(bandas.flatMap((b) => b.inf.concat(b.sup)));
      const xs = todos.map((p) => ts(p[0])), ys = todos.map((p) => p[1]).filter(ok);
      const mostraAlvo = alvo && ok(alvo.valor) && alvo.valor <= Math.max(...ys) * 1.6;
      if (mostraAlvo) ys.push(alvo.valor);
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
      for (const b of bandas) {
        const sup = b.sup.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`);
        const inf = [...b.inf].reverse().map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`);
        s += `<polygon class="${b.classe || "banda"} surge" points="${sup.concat(inf).join(" ")}"/>`;
      }
      if (mostraAlvo) {
        const ya = py(alvo.valor).toFixed(1);
        s += `<line class="alvo" x1="${mE}" x2="${W - mD}" y1="${ya}" y2="${ya}"/>`;
        if (alvo.rotulo) s += `<text class="alvo-rot" x="${mE + 6}" y="${Number(ya) - 6}" text-anchor="start">${escapa(alvo.rotulo)}</text>`;
      }
      for (const se of validas) {
        const d = caminho(se.pontos);
        if (se.area) {
          const pts = se.pontos.filter((p) => ok(p[1]));
          s += `<path class="area surge" d="${d}L${px(pts.at(-1)[0]).toFixed(1)} ${py(esc.lo)}L${px(pts[0][0]).toFixed(1)} ${py(esc.lo)}Z"/>`;
        }
        // linha tracejada não pode ser "desenhada": a animação usa o próprio
        // tracejado e a deixaria contínua
        const ref = /^(lref|lselic|libov)/.test(se.classe || "");
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
    // sem meta (alvo null), só a barra
    return html`<div class="aloc-barra"><i style="width:${w}%;background:${cor}"></i>${alvo == null ? "" : html`<span class="meta" style="left:calc(${m}% - 1px)" title="meta ${FC.fmt.num(alvo, 0)}%"></span>`}</div>`;
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
  // o app React Native desenha os mesmos SVGs: lê a função de desenho de cada marcador
  FC.graficos.registro = registro;
})();


/* ---- modelo/avaliador.js */
/* As quatro lentes e o avaliador.
 *
 * O veredito é a aplicação mecânica dos SEUS critérios (Ajustes →
 * Regras). Não é recomendação: é o seu checklist, calculado rápido e
 * sempre do mesmo jeito. As lentes discordam de propósito — um FII pode
 * estar barato contra a própria história e caro contra os pares, e ver
 * as duas coisas é o ponto. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  const TITULOS = { regra: "Seu alvo", historica: "Histórico", pares: "Pares", macro: "Renda fixa" };
  const corDaNota = (n) => (n == null ? "cinza" : n >= 70 ? "verde" : n >= 45 ? "amarelo" : "vermelho");
  const nota = (lente, n, texto = "", referencia = null, detalhes = {}) =>
    ({ lente, nota: n, texto, referencia, detalhes, titulo: TITULOS[lente] || lente, cor: corDaNota(n) });

  function interpola(v, otimo, aceitavel, ruim, menor) {
    const d = (a, b) => Math.max(a - b, 1e-9);
    if (menor) {
      if (v <= otimo) return 100;
      if (v <= aceitavel) return 100 - (40 * (v - otimo)) / d(aceitavel, otimo);
      if (v <= ruim) return 60 - (60 * (v - aceitavel)) / d(ruim, aceitavel);
      return 0;
    }
    if (v >= otimo) return 100;
    if (v >= aceitavel) return 100 - (40 * (otimo - v)) / d(otimo, aceitavel);
    if (v >= ruim) return 60 - (60 * (aceitavel - v)) / d(aceitavel, ruim);
    return 0;
  }

  function f(v, u = "") {
    if (!ok(v)) return "—";
    if (u === "R$") return Math.abs(v) >= 1e6 ? "R$ " + FC.fmt.num(v / 1e6, 1) + " mi" : "R$ " + FC.fmt.int(v);
    if (Math.abs(v) >= 1000) return FC.fmt.int(v);
    return FC.fmt.num(v) + u;
  }

  // ---------------------------------------------------------------- lentes
  function lenteRegra(valor, cfg) {
    if (!ok(valor) || cfg.otimo == null) return nota("regra", null, "sem faixa configurada");
    const menor = cfg.direcao === "menor_melhor";
    const n = interpola(valor, cfg.otimo, cfg.aceitavel, cfg.ruim, menor);
    const u = cfg.unidade || "";
    return nota("regra", n, `seu ótimo é ${menor ? "até" : "a partir de"} ${f(cfg.otimo, u)}; aceitável ${f(cfg.aceitavel, u)}`, cfg.otimo);
  }

  function lenteHistorica(valor, serie, cfg, anos) {
    const vals = (serie || []).map((x) => x[1]).filter(ok);
    if (!ok(valor) || vals.length < 20) return nota("historica", null, "histórico insuficiente");
    const menor = cfg.direcao === "menor_melhor";
    const melhores = vals.filter((v) => (menor ? v > valor : v < valor)).length;
    const n = (100 * melhores) / vals.length;
    const ord = [...vals].sort((a, b) => a - b);
    const mediana = ord[Math.floor(ord.length / 2)];
    const alvo = menor ? ord[Math.floor(ord.length / 4)] : ord[Math.floor((3 * ord.length) / 4)];
    const u = cfg.unidade || "";
    return nota("historica", n,
      `melhor que ${Math.round(n)}% dos últimos ${anos} anos; mediana ${f(mediana, u)} (hoje ${valor < mediana ? "abaixo" : "acima"})`,
      alvo, { mediana, min: ord[0], max: ord.at(-1) });
  }

  const MIN_PARES = 10;
  function lentePares(valor, valoresPares, cfg, grupo) {
    const pares = (valoresPares || []).filter(ok);
    if (!ok(valor) || pares.length < MIN_PARES) return nota("pares", null, `amostra insuficiente (${pares.length} pares com o dado)`);
    const menor = cfg.direcao === "menor_melhor";
    const piores = pares.filter((v) => (menor ? v > valor : v < valor)).length;
    const n = (100 * piores) / pares.length;
    const ord = [...pares].sort((a, b) => a - b);
    const mediana = ord[Math.floor(ord.length / 2)];
    return nota("pares", n, `melhor que ${Math.round(n)}% dos ${pares.length} de ${grupo}; mediana ${f(mediana, cfg.unidade || "")}`,
      mediana, { mediana, n: pares.length });
  }

  const IR_LONGO_PRAZO = 0.15;
  function lenteMacro(valor, cfg, macro, isento) {
    const ancora = cfg.ancora_macro;
    if (!ancora || !ok(valor) || !macro[ancora]) return nota("macro", null, "sem âncora macro");
    const bruto = macro[ancora];
    const base = isento ? bruto * (1 - IR_LONGO_PRAZO) : bruto;
    const rot = isento ? `${ancora.toUpperCase()} líquido de IR` : ancora.toUpperCase();
    const spread = valor - base;
    const n = Math.max(0, Math.min(100, 50 + (spread / 3) * 50));
    return nota("macro", n, `${f(valor, "%")} contra ${f(base, "%")} do ${rot}: ${f(Math.abs(spread))} p.p. ${spread >= 0 ? "acima" : "abaixo"}`,
      base, { spread, base, bruto });
  }

  // ---------------------------------------------------------------- perfis
  // O tipo do FII define a análise. Sai da composição da receita e da
  // carteira no informe da CVM; o segmento do Fundamentus desempata (um
  // fundo de imóveis que não declarou os imóveis no trimestre não vira papel).
  function perfilDoFii(ticker, segmento, regras, fii = {}) {
    if ((regras.override_perfil || {})[ticker]) return regras.override_perfil[ticker];
    const papelSeg = (regras.segmentos_papel || []).includes(segmento);
    const tipo = fii.cvm && fii.cvm.tipo;
    const existe = (p) => !!(regras.perfis || {})[p];
    if (tipo === "fof" && existe("fii_fof")) return "fii_fof";
    if (tipo === "hibrido" && existe("fii_hibrido")) return "fii_hibrido";
    if (tipo === "tijolo") return "fii_tijolo";
    if (tipo === "papel") return !papelSeg && fii.qtd_imoveis > 0 ? "fii_tijolo" : "fii_papel";
    return papelSeg ? "fii_papel" : "fii_tijolo";
  }
  function perfilDoAtivo(ticker, classe, universo, regras) {
    if (classe === "fii") { const f = universo.fiis[ticker] || {}; return perfilDoFii(ticker, f.segmento || "", regras, f); }
    return classe;
  }

  // ---------------------------------------------------------------- limpeza
  // O Fundamentus escreve 0 querendo dizer "não informado"; P/L negativo
  // é prejuízo, não barato; e alguns números são impossíveis (vacância de
  // 91% num shopping é a ocupação invertida). Melhor calar que errar.
  const ZERO_E_AUSENTE = new Set(["vacancia", "cap_rate", "dy", "pvp", "pl", "roe", "ffo_yield", "ev_ebitda", "roic", "liquidez"]);
  const NEGATIVO_E_RUIM = new Set(["pl", "pvp", "ev_ebitda"]);
  const PLAUSIVEL = { vacancia: [0, 60], cap_rate: [0, 30], dy: [0, 40], pvp: [0, 5], ffo_yield: [0, 40], vacancia_financeira: [0, 95], concentracao: [0, 100] };

  function sanitiza(chave, valor) {
    if (!ok(valor)) return [null, false, null];
    // zero primeiro: no Fundamentus é "não informado", não reprovação
    if (ZERO_E_AUSENTE.has(chave) && valor === 0) return [null, false, null];
    if (NEGATIVO_E_RUIM.has(chave) && valor <= 0) return [null, true, null];
    const fx = PLAUSIVEL[chave];
    if (fx && !(fx[0] <= valor && valor <= fx[1])) return [null, false, `valor implausível na fonte: ${FC.fmt.num(valor)}`];
    return [valor, false, null];
  }

  function grupoDePares(ticker, classe, perfil, universo, regras) {
    let pares, nome;
    if (classe === "fii") {
      const seg = (universo.fiis[ticker] || {}).segmento || "";
      pares = Object.entries(universo.fiis)
        // papel, FOF e híbrido se comparam com o mesmo tipo; tijolo, com o mesmo segmento
        .filter(([k, v]) => k !== ticker && perfilDoFii(k, v.segmento || "", regras, v) === perfil && (perfil !== "fii_tijolo" || v.segmento === seg))
        .map(([, v]) => v);
      nome = { fii_papel: "fundos de papel", fii_fof: "fundos de fundos", fii_hibrido: "FIIs híbridos" }[perfil] || "FIIs de " + seg;
    } else if (classe === "acao_br") {
      // sem classificação setorial gratuita: compara com a B3 líquida
      pares = Object.entries(universo.acoes).filter(([k, v]) => k !== ticker && (v.liquidez || 0) > 1e6).map(([, v]) => v);
      nome = "ações líquidas da B3";
    } else {
      return ["", {}];
    }
    const metricas = {};
    for (const p of pares) {
      for (const [k, v] of Object.entries(p)) {
        if (typeof v !== "number") continue;
        const [limpo] = sanitiza(k, v);
        if (limpo != null) (metricas[k] = metricas[k] || []).push(limpo);
      }
    }
    return [nome, metricas];
  }

  // ---------------------------------------------------------------- séries
  // DY de 12 meses olhando de uma data do passado
  function dyEm(data, dividendos, preco) {
    if (!preco) return null;
    const ini = FC.datas.soma(data, -365);
    let soma = 0;
    for (const [d, v] of dividendos) if (d > ini && d <= data) soma += v;
    return soma ? (soma / preco) * 100 : null;
  }

  function serieDy(h) {
    if (!h.precos.length || !h.dividendos.length) return [];
    const inicio = FC.datas.soma(h.precos[0][0], 365);
    const saida = [];
    h.precos.forEach(([d, p], i) => {
      if (d < inicio || i % 5) return;
      const dy = dyEm(d, h.dividendos, p);
      if (dy) saida.push([d, dy]);
    });
    return saida;
  }

  function seriePremioMedia(h, janela = 200) {
    const p = h.precos;
    if (p.length < janela + 20) return [];
    const saida = [];
    let soma = 0;
    for (let i = 0; i < janela; i++) soma += p[i][1];
    for (let i = janela; i < p.length; i++) {
      soma += p[i][1] - p[i - janela][1];
      if (i % 5) continue;
      const media = soma / janela;
      if (media) saida.push([p[i][0], (p[i][1] / media - 1) * 100]);
    }
    return saida;
  }

  // P/VP histórico APROXIMADO: o VPA de hoje projetado para trás
  // (vpa vem da cotação e do P/VP da própria fonte, antes do preço ao vivo)
  function seriePvp(h, vpa) {
    if (!(vpa > 0) || !h.precos.length) return [];
    return h.precos.filter((_, i) => !(i % 5)).map(([d, p]) => [d, p / vpa]);
  }

  function valoresAtuais(ticker, classe, universo, h) {
    let base = {};
    if (classe === "fii") base = { ...(universo.fiis[ticker] || {}) };
    else if (classe === "acao_br") base = { ...(universo.acoes[ticker] || {}) };
    if (h) {
      if (base.cotacao == null) base.cotacao = h.preco;
      const ultima = h.precos.length ? h.precos.at(-1)[0] : null;
      const dyCalc = ultima ? dyEm(ultima, h.dividendos, h.preco) : null;
      if (dyCalc) {
        base.dy_calculado = dyCalc;
        if (classe !== "fii" && classe !== "acao_br") base.dy = dyCalc;
      }
      if (h.max_52s && h.preco) base.dist_maxima_52s = (1 - h.preco / h.max_52s) * 100;
      if (h.media_200d && h.preco) base.premio_media_200d = (h.preco / h.media_200d - 1) * 100;
    }
    return base;
  }

  // ---------------------------------------------------------------- Graham
  // Preço justo de Benjamin Graham: √(22,5 × LPA × VPA). O 22,5 vem dos
  // tetos dele para ação defensiva: P/L até 15 e P/VP até 1,5 (15 × 1,5).
  // LPA e VPA saem da cotação e dos múltiplos (LPA = preço ÷ P/L,
  // VPA = preço ÷ P/VP). Não vale com prejuízo ou patrimônio negativo.
  //
  // Nem para banco, seguradora ou financeira: o patrimônio delas é capital
  // regulatório e a dívida é a matéria-prima do negócio — LPA × VPA não
  // mede o mesmo que numa indústria.
  const SETOR_FINANCEIRO = /banc|segur|resseg|previd[eê]ncia|intermedi[aá]rios financeiros|financeira|cr[eé]dito e financiamento|capitaliza/i;
  // raiz do código (4 letras) das financeiras listadas mais conhecidas, para
  // quando a fonte não traz o setor
  const RAIZ_FINANCEIRA = new Set(["BBAS", "ITUB", "BBDC", "SANB", "BPAC", "ABCB", "BRSR", "BMGB", "ITSA", "PINE", "BRBI", "BMEB",
    "BAZA", "BEES", "BGIP", "BMIN", "BNBR", "BPAN", "BSLI", "BRIV", "MERC", "RPAD", "MODL", "CRIV", "BRGE",
    "BBSE", "CXSE", "PSSA", "IRBR", "SULA", "WIZC", "APER"]);
  // setor na aba Renda (Ajustes → Universo) para um ticker, se houver
  function setorNaRenda(ticker) {
    const cfg = (FC.estado && FC.estado.prefs && FC.estado.prefs.renda) || FC.PADRAO_RENDA || {};
    for (const [setor, bloco] of Object.entries(cfg.setores || {})) if (bloco && bloco.empresas && ticker in bloco.empresas) return setor;
    return null;
  }
  // info: { ticker, setor, subsetor } — qualquer um basta
  FC.ehFinanceira = function (info = {}) {
    const t = String(info.ticker || "").toUpperCase();
    const setores = [info.setor, info.subsetor, t ? setorNaRenda(t) : null].filter(Boolean);
    if (setores.some((s) => SETOR_FINANCEIRO.test(s))) return true;
    return !!t && RAIZ_FINANCEIRA.has(t.slice(0, 4));
  };

  FC.graham = function (cotacao, pl, pvp, info) {
    if (!ok(cotacao) || cotacao <= 0) return null;
    if (info && FC.ehFinanceira(info)) return { valor: null, motivo: "não se aplica a bancos e seguradoras" };
    if (!ok(pl) || !ok(pvp) || pl === 0 || pvp === 0) return { valor: null, motivo: "sem P/L ou P/VP na fonte" };
    if (pl < 0) return { valor: null, motivo: "a empresa teve prejuízo nos últimos 12 meses — a fórmula não se aplica" };
    if (pvp < 0) return { valor: null, motivo: "patrimônio líquido negativo — a fórmula não se aplica" };
    const lpa = cotacao / pl, vpa = cotacao / pvp;
    const valor = Math.sqrt(22.5 * lpa * vpa);
    // margem de segurança de Graham: quanto a cotação está abaixo do justo,
    // sobre o justo (nunca passa de 100%); acima do justo, quanto passa dele
    const margem = (1 - cotacao / valor) * 100;
    const acima = (cotacao / valor - 1) * 100;
    const cor = margem >= 15 ? "verde" : acima <= 10 ? "amarelo" : "vermelho";
    const leitura = margem >= 15 ? `${FC.fmt.num(margem, 0)}% abaixo do justo`
      : margem >= 0 ? "perto do justo"
      : acima <= 10 ? "um pouco acima do justo" : `${FC.fmt.num(acima, 0)}% acima do justo`;
    return { valor, lpa, vpa, margem, cor, leitura };
  };

  // ---------------------------------------------------------------- avaliação
  // `agora`: preço ao vivo {preco}. Com ele, os múltiplos que dependem do
  // preço (DY, P/L, P/VP) são recalculados — lucro, dividendo e patrimônio
  // por cota continuam os do Fundamentus.
  function avalia(ticker, classe, universo, historicos, regras, agora) {
    ticker = ticker.toUpperCase();
    const anos = regras.janela_historico_anos || 3;
    const perfil = perfilDoAtivo(ticker, classe, universo, regras);
    const cfgPerfil = regras.perfis[perfil];
    const avisos = [];
    if (!cfgPerfil) return { ticker, classe, erro: `o perfil «${perfil}» não existe nas suas regras` };

    let h = historicos[ticker];
    if (h && h.erro) { avisos.push("histórico de preços indisponível"); h = null; }
    if (!h) h = null;

    const valores = valoresAtuais(ticker, classe, universo, h);
    const vpaFonte = ok(valores.pvp) && valores.pvp > 0 && valores.cotacao > 0 ? valores.cotacao / valores.pvp : null;
    if (agora && ok(agora.preco) && ok(valores.cotacao) && valores.cotacao > 0) {
      const k = agora.preco / valores.cotacao;
      const dyEraCalculado = valores.dy_calculado === valores.dy;
      if (ok(valores.pl)) valores.pl = valores.pl * k;
      if (ok(valores.pvp)) valores.pvp = valores.pvp * k;
      valores.cotacao = agora.preco;
      // o que sai do histórico (cache de 1 h) também passa para o preço de agora
      if (h && h.preco > 0) {
        const kh = agora.preco / h.preco;
        if (ok(valores.dy_calculado)) valores.dy_calculado = valores.dy_calculado / kh;
        if (h.max_52s) valores.dist_maxima_52s = (1 - agora.preco / h.max_52s) * 100;
        if (h.media_200d) valores.premio_media_200d = (agora.preco / h.media_200d - 1) * 100;
      }
      if (ok(valores.dy)) valores.dy = dyEraCalculado ? valores.dy_calculado : valores.dy / k;
    }
    if (!Object.keys(valores).length) return { ticker, classe, erro: "ativo não encontrado nas fontes" };
    // FII: a concentração que importa depende do tipo (imóvel, CRI ou FII)
    const cvm = classe === "fii" ? (universo.fiis[ticker] || {}).cvm : null;
    if (cvm) {
      if (!(valores.vacancia > 0) && cvm.vacancia_fisica_cvm > 0) valores.vacancia = cvm.vacancia_fisica_cvm;
      valores.vacancia_financeira = cvm.vacancia_financeira ?? null;
      valores.concentracao = perfil === "fii_papel" ? (cvm.cri || {}).maior
        : perfil === "fii_fof" ? (cvm.fii || {}).maior
        : perfil === "fii_hibrido" ? cvm.maior_imovel ?? (cvm.cri || {}).maior ?? null
        : cvm.maior_imovel ?? null;          // tijolo: só a concentração dos imóveis
    }

    const series = h ? { dy: serieDy(h), pvp: seriePvp(h, vpaFonte), premio_media_200d: seriePremioMedia(h) } : {};
    const [grupo, pares] = grupoDePares(ticker, classe, perfil, universo, regras);
    const macro = universo.macro || {};
    const pesos = regras.pesos_lentes;
    const isento = cfgPerfil.isento_ir != null ? !!cfgPerfil.isento_ir : perfil.startsWith("fii");

    if (h && h.precos_descartados) avisos.push(`${h.precos_descartados} dia(s) do histórico foram descartados por valores corrompidos na fonte`);
    if (ok(valores.dy) && ok(valores.dy_calculado) && Math.abs(valores.dy - valores.dy_calculado) > 2) {
      avisos.push(`DY diverge entre as fontes: Fundamentus ${FC.fmt.num(valores.dy)}% contra ${FC.fmt.num(valores.dy_calculado)}% pelos proventos do Yahoo`);
    }

    const metricas = [];
    let somaPesos = 0, somaNotas = 0;
    for (const [chave, cfg] of Object.entries(cfgPerfil.metricas)) {
      const [valor, sinalRuim, descarte] = sanitiza(chave, valores[chave]);
      if (descarte) avisos.push(`«${cfg.rotulo || chave}» não foi avaliado — ${descarte}`);
      // a lente histórica compara com uma série medida do MESMO jeito
      const valorHist = chave === "dy" ? valores.dy_calculado : valor;
      const valorMacro = chave === "dy" ? valorHist : valor;

      let notaMetrica, alvo, notas;
      if (sinalRuim) {
        notas = [lenteRegra(null, cfg)];
        notas[0].texto = "valor negativo ou nulo — tratado como reprovado";
        notaMetrica = 0; alvo = null;
      } else {
        notas = [
          lenteRegra(valor, cfg),
          lenteHistorica(valorHist, series[chave], cfg, anos),
          lentePares(valor, pares[chave], cfg, grupo),
          lenteMacro(valorMacro, cfg, macro, isento),
        ];
        const validas = notas.filter((n) => n.nota != null).map((n) => [n, pesos[n.lente] || 0]);
        const sp = validas.reduce((s, [, p]) => s + p, 0);
        notaMetrica = validas.length && sp ? validas.reduce((s, [n, p]) => s + n.nota * p, 0) / sp : null;
        const refs = notas.map((n) => n.referencia).filter(ok);
        alvo = refs.length ? refs.reduce((a, b) => a + b, 0) / refs.length : null;
      }
      if (notaMetrica != null) {
        somaPesos += cfg.peso || 1;
        somaNotas += notaMetrica * (cfg.peso || 1);
      }
      let alt = null;
      if (chave === "dy" && ok(valores.dy_calculado) && ok(valor) && Math.abs(valores.dy_calculado - valor) > 0.3) {
        alt = { rotulo: "por proventos (Yahoo)", valor: valores.dy_calculado };
      }
      const dadas = notas.map((n) => n.nota).filter((n) => n != null);
      let divergencia = 0;
      if (dadas.length > 1) {
        const m = dadas.reduce((a, b) => a + b, 0) / dadas.length;
        divergencia = Math.sqrt(dadas.reduce((s, x) => s + (x - m) ** 2, 0) / dadas.length);
      }
      metricas.push({
        chave, rotulo: cfg.rotulo || chave, rotulo_curto: FC.ROTULO_CURTO[chave] || cfg.rotulo || chave,
        unidade: cfg.unidade || "", valor, valor_alt: alt, sinal_ruim: sinalRuim, peso: cfg.peso || 1,
        nota: notaMetrica, alvo, divergencia, lentes: notas, serie: series[chave] || [],
        escala: { otimo: cfg.otimo, aceitavel: cfg.aceitavel, ruim: cfg.ruim, direcao: cfg.direcao },
      });
    }

    const score = somaPesos ? somaNotas / somaPesos : null;
    const fx = regras.vereditos;
    // as chaves (atende/observar) e as cores ficam; o texto descreve a
    // distância dos seus critérios, sem soar como recomendação
    let veredito, cor, faixa;
    if (score == null) { veredito = "sem dados"; cor = "cinza"; faixa = null; }
    else if (score >= fx.atende) { veredito = "Dentro dos seus critérios"; cor = "verde"; faixa = "atende"; }
    else if (score >= fx.observar) { veredito = "Perto dos seus critérios"; cor = "amarelo"; faixa = "observar"; }
    else { veredito = "Fora dos seus critérios"; cor = "vermelho"; faixa = "fora"; }

    const comDado = metricas.filter((m) => m.valor != null);
    return {
      ticker, classe, perfil, segmento: valores.segmento || "", grupo_pares: grupo,
      preco: valores.cotacao ?? (h ? h.preco : null), moeda: h ? h.moeda : "BRL",
      score, veredito, veredito_curto: FC.VEREDITO_CURTO[veredito], veredito_faixa: faixa, cor, metricas, avisos,
      conflitos: metricas.filter((m) => m.divergencia >= 25),
      destaques: [...comDado].sort((a, b) => b.peso - a.peso).slice(0, 3),
      max_52s: h ? h.max_52s : null, min_52s: h ? h.min_52s : null,
      serie_preco: h ? h.precos : [],
      cambio: h ? h.cambio : null,
      tipo_rotulo: FC.CLASSE_ROTULO[perfil] || FC.CLASSE_ROTULO[classe] || classe,
      // Graham só faz sentido para ação brasileira (lucro e patrimônio
      // contábeis) e fora de bancos e seguradoras
      graham: classe === "acao_br" ? FC.graham(valores.cotacao, valores.pl, valores.pvp,
        { ticker, setor: valores.setor, subsetor: valores.subsetor || valores.segmento }) : null,
      cvm: cvm || null,
    };
  }

  // ---------------------------------------------------------------- renda fixa
  function avaliaRendaFixa(item, macro) {
    if (item.taxa == null) {
      return { ...item, base: "taxa não informada", nominal: null, real: null, premio_cdi: null, cor: "cinza", leitura: "preencha a taxa contratada" };
    }
    const tipo = item.tipo, taxa = Number(item.taxa);
    const cdi = macro.cdi, ipca = macro.ipca_12m;
    // sem o macro do Banco Central, o rótulo sai da própria taxa
    let nominal = null, base = FC.rentab ? FC.rentab.rotuloTaxa(tipo, taxa) : tipo;
    if (tipo === "cdi" && cdi) { nominal = (cdi * taxa) / 100; base = `${FC.fmt.num(taxa, 0)}% do CDI`; }
    else if (tipo === "selic" && (macro.selic_meta || cdi)) { nominal = ((macro.selic_meta || cdi) * taxa) / 100; base = `${FC.fmt.num(taxa, 0)}% da Selic`; }
    else if (tipo === "ipca" && ipca) { nominal = ((1 + ipca / 100) * (1 + taxa / 100) - 1) * 100; base = `IPCA + ${FC.fmt.num(taxa)}%`; }
    else if (tipo === "prefixado") { nominal = taxa; base = `prefixado ${FC.fmt.num(taxa)}%`; }
    const real = nominal && ipca ? ((1 + nominal / 100) / (1 + ipca / 100) - 1) * 100 : null;
    const premio = nominal && cdi ? nominal - cdi : null;
    let cor, leitura;
    if (premio == null) { cor = "cinza"; leitura = "sem dados do Banco Central"; }
    else if (premio >= 1) { cor = "verde"; leitura = `${FC.fmt.delta(premio, 2)} p.p. sobre o CDI`; }
    else if (premio >= -0.5) { cor = "amarelo"; leitura = `${FC.fmt.delta(premio, 2)} p.p. — praticamente o CDI`; }
    else { cor = "vermelho"; leitura = `${FC.fmt.delta(premio, 2)} p.p. abaixo do CDI`; }
    return { ...item, base, nominal, real, premio_cdi: premio, cor, leitura };
  }

  FC.avaliador = { avalia, avaliaRendaFixa, dyEm, interpola, corDaNota, perfilDoAtivo };
})();


/* ---- modelo/agro.js */
/* Agronegócio: rebanho, valor e resultado da atividade.
 *
 * O rebanho não é digitado, é CONTADO: cada movimento soma ou subtrai
 * cabeças de uma categoria. Assim a contagem de hoje sempre bate com o
 * histórico, e corrigir um lançamento antigo corrige tudo que vem depois.
 *
 * Valor do rebanho = cabeças × peso vivo × rendimento de carcaça ÷ 15
 * × preço da arroba. O peso vem da informação mais recente da categoria
 * (pesagem ou movimento com peso, com quem entra depois na média pelas
 * cabeças). Sem peso informado não se chuta peso antes do resto: vale o
 * valor por cabeça da Cotação, depois o preço por cabeça das suas últimas
 * compras e vendas da categoria e, só sem nada disso, o peso típico × @.
 * A tela diz de onde veio cada valor. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  // de onde cada categoria vem, na ordem em que o animal cresce
  const ORIGEM = {
    garrote: ["bezerro"],
    boi_magro: ["bezerro", "garrote"],
    boi_gordo: ["bezerro", "garrote", "boi_magro"],
    touro: ["bezerro", "garrote", "boi_magro"],
    novilha: ["bezerra"],
    vaca: ["bezerra", "novilha"],
  };

  function arrobas(kgVivo, rendimento) { return (kgVivo * (rendimento / 100)) / 15; }

  // valor de uma cabeça pela cotação: preço por cabeça da categoria ou peso × arroba
  function valorCabeca(cat, kg, cfg) {
    const porCabeca = Number((cfg.valor_cabeca_por_categoria || {})[cat]);
    if (ok(porCabeca) && porCabeca > 0) return porCabeca;
    const preco = Number((cfg.arroba_por_categoria || {})[cat]) || Number(cfg.preco_arroba) || 0;
    return arrobas(kg, Number(cfg.rendimento_carcaca) || 52) * preco;
  }
  // preço por cabeça das últimas operações da categoria (até 3, pesando as cabeças)
  const ULTIMAS = 3;
  function precoDasOperacoes(lista) {
    const ult = lista.slice(-ULTIMAS);
    const cab = FC.soma(ult, (x) => x.cabecas);
    return cab ? FC.soma(ult, (x) => x.valor) / cab : null;
  }
  const temPesoMov = (m) => ok(m.peso_medio_kg) && m.peso_medio_kg > 0;

  // valor de uma cabeça sem peso informado: Cotação por cabeça → suas
  // operações → peso típico × @. Devolve {valor, origem}
  function valorSemPeso(cat, cfg, ops) {
    const porCabeca = Number((cfg.valor_cabeca_por_categoria || {})[cat]);
    if (ok(porCabeca) && porCabeca > 0) return { valor: porCabeca, origem: "por_cabeca" };
    const op = ops && ops[cat] ? precoDasOperacoes(ops[cat]) : null;
    if (op > 0) return { valor: op, origem: "operacoes" };
    return { valor: valorCabeca(cat, FC.PESO_TIPICO[cat], cfg), origem: "tipico" };
  }

  // "outra entrada" sem valor entra pelo valor estimado (preenchido em analisa):
  // é capital posto na atividade, não lucro
  const valorEntrada = (m) => (m.valor_total > 0 ? m.valor_total : m.valor_estimado || 0);
  // o que custaram as cabeças que ainda estão no pasto: cada saída consome
  // as entradas mais antigas (nascimento entra a custo zero)
  function custoEmAberto(movs) {
    const ordem = { compra: 0, nascimento: 0, entrada: 0, venda: 1, morte: 1, saida: 1 };
    const abertos = [];
    for (const m of movs.filter((x) => x.tipo in ordem && x.cabecas > 0)) {
      if (ordem[m.tipo] === 0) {
        const total = m.tipo === "compra" ? m.valor_total + m.despesas : m.tipo === "entrada" ? valorEntrada(m) : 0;
        abertos.push({ n: m.cabecas, porCab: total / m.cabecas });
        continue;
      }
      let falta = m.cabecas;
      while (falta > 0 && abertos.length) {
        const l = abertos[0], q = Math.min(falta, l.n);
        l.n -= q; falta -= q;
        if (l.n <= 0) abertos.shift();
      }
    }
    return abertos.reduce((s, l) => s + l.n * l.porCab, 0);
  }

  // giro das vendas: cada venda leva as cabeças que entraram primeiro e
  // carrega o custo e o tempo de pasto delas (nascimento custa zero)
  function giro(movs) {
    const ordem = { compra: 0, nascimento: 0, entrada: 0, venda: 1, morte: 1, saida: 1 };
    const abertos = [];
    let cab = 0, custo = 0, dias = 0;
    for (const m of movs.filter((x) => x.tipo in ordem && x.cabecas > 0)) {
      if (ordem[m.tipo] === 0) {
        const total = m.tipo === "compra" ? m.valor_total + m.despesas : m.tipo === "entrada" ? valorEntrada(m) : 0;
        abertos.push({ n: m.cabecas, porCab: total / m.cabecas, data: m.data });
        continue;
      }
      let falta = m.cabecas;
      while (falta > 0 && abertos.length) {
        const l = abertos[0], q = Math.min(falta, l.n);
        if (m.tipo === "venda") { cab += q; custo += q * l.porCab; dias += q * Math.max(0, FC.datas.dias(l.data, m.data)); }
        l.n -= q; falta -= q;
        if (l.n <= 0) abertos.shift();
      }
    }
    return { cab, custo, dias };
  }

  function analisa(agro, cfg) {
    const movs = [...(agro.movs || [])].sort((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em));
    const custos = agro.custos || [];
    const pesagens = [...(agro.pesagens || [])].sort((a, b) => a.data.localeCompare(b.data));
    const rend = Number(cfg.rendimento_carcaca) || 52;

    // ---------------------------------------------------------- contagem
    const rebanho = {}, porFazenda = {}, porLote = {};
    const soma = (obj, k, n) => { obj[k] = (obj[k] || 0) + n; };
    // onde está a maior parte de uma categoria: é de lá que sai um
    // movimento que não disse a fazenda (ex.: a mudança de categoria)
    const ondeEsta = (tabela, cat) => {
      let melhor = null, n = 0;
      for (const [k, cats] of Object.entries(tabela)) if ((cats[cat] || 0) > n) { n = cats[cat]; melhor = k; }
      return melhor;
    };
    const mexe = (faz, lote, cat, n) => {
      soma(rebanho, cat, n);
      faz = faz || "Sem fazenda";
      porFazenda[faz] = porFazenda[faz] || {};
      soma(porFazenda[faz], cat, n);
      if (lote) { porLote[lote] = porLote[lote] || {}; soma(porLote[lote], cat, n); }
    };
    // O gado muda de categoria sozinho: o boi comprado magro é vendido
    // gordo sem ninguém lançar a mudança. Quando uma saída passa do que
    // existe na categoria, a diferença sai das categorias de onde o animal
    // veio (a mais próxima primeiro) e, se ainda faltar, de qualquer outra
    // que tenha cabeças. Assim comprar 9 magros e vender 9 gordos zera.
    const tira = (m, cat, n) => {
      const faz = m.fazenda || ondeEsta(porFazenda, cat);
      mexe(faz, m.lote || ondeEsta(porLote, cat), cat, -n);
    };
    const ajustes = [];
    const saida = (m, n) => {
      let falta = n;
      const daPropria = Math.min(falta, Math.max(0, rebanho[m.categoria] || 0));
      if (daPropria) { tira(m, m.categoria, daPropria); falta -= daPropria; }
      if (!falta) return;
      const antes = (ORIGEM[m.categoria] || []).slice().reverse();
      const outras = Object.keys(rebanho).filter((c) => c !== m.categoria && !antes.includes(c));
      for (const c of [...antes, ...outras]) {
        const tem = Math.max(0, rebanho[c] || 0);
        if (!tem) continue;
        const n2 = Math.min(falta, tem);
        tira(m, c, n2);
        ajustes.push({ id: m.id, data: m.data, tipo: m.tipo, cabecas: n2, de: c, para: m.categoria });
        falta -= n2;
        if (!falta) return;
      }
      // saiu mais do que o rebanho inteiro tinha: fica registrado como negativo
      tira(m, m.categoria, falta);
    };
    // Peso de cada categoria no tempo, junto com a contagem: a pesagem vale
    // para a categoria inteira; quem entra depois com peso (compra, entrada,
    // mudança de categoria) entra na média ponderada pelas cabeças; uma
    // saída com peso é a informação mais nova da categoria.
    const pesoCat = {};
    let ip = 0;
    const pesa = (p) => {
      const a = pesoCat[p.categoria];
      if (a && a.fonte === "pesagem" && a.data === p.data) {
        a.kg = (a.kg * a.pesadas + p.peso_medio_kg * p.cabecas) / (a.pesadas + p.cabecas); a.pesadas += p.cabecas;
      } else pesoCat[p.categoria] = { kg: p.peso_medio_kg, pesadas: p.cabecas, cab: Math.max(p.cabecas, rebanho[p.categoria] || 0), fonte: "pesagem", data: p.data };
    };
    // pesagens de dias anteriores a d (a do mesmo dia vem depois dos movimentos)
    const pesagensAte = (d) => { while (ip < pesagens.length && pesagens[ip].data < d) pesa(pesagens[ip++]); };
    const entraPeso = (cat, kg, n, data) => {
      const a = pesoCat[cat], tem = a ? Math.max(0, Math.min(a.cab, rebanho[cat] || 0)) : 0;
      pesoCat[cat] = { kg: tem ? (a.kg * tem + kg * n) / (tem + n) : kg, cab: tem + n, fonte: "movimento", data };
    };
    const temPeso = temPesoMov;
    // preço por cabeça de cada compra/venda, por categoria, na ordem do tempo
    const ops = {};
    for (const m of movs) {
      const t = FC.TIPOS_MOV[m.tipo];
      if (!t) continue;
      pesagensAte(m.data);
      // outra entrada sem valor: estimada como o valor do rebanho na data.
      // Fica no próprio lançamento para caixa() e os fluxos da carteira.
      if (m.tipo === "entrada") {
        const kg = temPeso(m) ? m.peso_medio_kg : pesoCat[m.categoria] ? pesoCat[m.categoria].kg : null;
        m.valor_estimado = m.valor_total > 0 ? null
          : m.cabecas * (kg ? valorCabeca(m.categoria, kg, cfg) : valorSemPeso(m.categoria, cfg, ops).valor);
      }
      if ((m.tipo === "compra" || m.tipo === "venda") && m.valor_total > 0 && m.cabecas > 0) (ops[m.categoria] = ops[m.categoria] || []).push({ cabecas: m.cabecas, valor: m.valor_total });
      if (m.tipo === "reclassificacao") {
        const faz = m.fazenda || ondeEsta(porFazenda, m.categoria);
        const lote = m.lote || ondeEsta(porLote, m.categoria);
        // só muda de categoria o que existe nela: o excesso não cria cabeças
        const n = Math.min(m.cabecas, Math.max(0, rebanho[m.categoria] || 0));
        if (n < m.cabecas) ajustes.push({ id: m.id, data: m.data, tipo: m.tipo, cabecas: m.cabecas - n, de: m.categoria, para: m.categoria_destino, ignorado: true });
        if (n && temPeso(m)) entraPeso(m.categoria_destino, m.peso_medio_kg, n, m.data);
        if (n) { mexe(faz, lote, m.categoria, -n); mexe(faz, lote, m.categoria_destino, n); }
      } else if (t.sinal < 0) {
        saida(m, m.cabecas);
        if (temPeso(m)) pesoCat[m.categoria] = { kg: m.peso_medio_kg, cab: Math.max(0, rebanho[m.categoria] || 0), fonte: "movimento", data: m.data };
      } else {
        if (temPeso(m)) entraPeso(m.categoria, m.peso_medio_kg, m.cabecas, m.data);
        mexe(m.fazenda, m.lote, m.categoria, m.cabecas);
      }
    }
    pesagensAte("9999-12-31");
    const inconsistentes = Object.entries(rebanho).filter(([, n]) => n < 0).map(([c]) => c);
    const total = Object.values(rebanho).reduce((s, n) => s + Math.max(0, n), 0);

    // ---------------------------------------------------------- peso atual
    const peso = {};
    for (const cat of Object.keys(FC.CATEGORIAS_GADO)) {
      const p = pesoCat[cat];
      peso[cat] = p ? { kg: p.kg, fonte: p.fonte, data: p.data } : { kg: FC.PESO_TIPICO[cat], fonte: "típico", data: null };
    }

    // ---------------------------------------------------------- valor
    const porCategoria = [];
    let valorRebanho = 0;
    // valor de uma cabeça hoje, por categoria (também estima a "outra entrada" no formulário)
    const valorCabecaHoje = {};
    for (const cat of Object.keys(FC.CATEGORIAS_GADO)) {
      const porCabeca = Number((cfg.valor_cabeca_por_categoria || {})[cat]);
      if (ok(porCabeca) && porCabeca > 0) valorCabecaHoje[cat] = { valor: porCabeca, origem: "por_cabeca" };
      else if (peso[cat].fonte !== "típico") valorCabecaHoje[cat] = { valor: valorCabeca(cat, peso[cat].kg, cfg), origem: "arroba" };
      else valorCabecaHoje[cat] = valorSemPeso(cat, cfg, ops);
    }
    for (const [cat, n] of Object.entries(rebanho)) {
      if (n <= 0) continue;
      const kg = peso[cat].kg;
      const precoArroba = Number((cfg.arroba_por_categoria || {})[cat]) || Number(cfg.preco_arroba) || 0;
      const arr = arrobas(kg, rend);
      const v = valorCabecaHoje[cat];
      const valor = n * v.valor;
      valorRebanho += valor;
      porCategoria.push({ categoria: cat, nome: FC.CATEGORIAS_GADO[cat], cabecas: n, kg, fonte_peso: peso[cat].fonte,
        data_peso: peso[cat].data, arrobas_cabeca: arr, preco_arroba: precoArroba, valor, valor_cabeca: v.valor, origem_valor: v.origem,
        por_cabeca: v.origem === "por_cabeca" });
    }
    // avaliado pelo que foi pago: o rebanho vale o custo até ser vendido, e o
    // ganho só aparece na venda (a divisão por categoria é por cabeça)
    const peloCusto = !!cfg.avaliar_pelo_custo;
    if (peloCusto) {
      const custo = custoEmAberto(movs);
      const cab = porCategoria.reduce((s, c) => s + c.cabecas, 0);
      for (const c of porCategoria) { c.valor = cab ? (custo * c.cabecas) / cab : 0; c.valor_cabeca = cab ? custo / cab : 0; c.pelo_custo = true; c.origem_valor = "custo"; }
      valorRebanho = custo;
    }
    porCategoria.sort((a, b) => b.valor - a.valor);

    // ---------------------------------------------------------- financeiro
    const compras = movs.filter((m) => m.tipo === "compra");
    const vendas = movs.filter((m) => m.tipo === "venda");
    // gado que entrou com valor (estoque inicial, transferência) é capital
    // posto na atividade; o que saiu com valor é capital retirado
    const entradasValor = FC.soma(movs.filter((m) => m.tipo === "entrada"), valorEntrada);
    const saidasValor = FC.soma(movs.filter((m) => m.tipo === "saida"), (m) => m.valor_total);
    const gastoCompras = FC.soma(compras, (m) => m.valor_total + m.despesas) + entradasValor;
    const receitaVendas = FC.soma(vendas, (m) => m.valor_total - m.despesas) + saidasValor;
    const totalCustos = FC.soma(custos, (c) => c.valor);
    const custosPorCategoria = {};
    for (const c of custos) soma(custosPorCategoria, c.categoria, c.valor);

    const cabVendidas = FC.soma(vendas, (m) => m.cabecas);
    const arrVendidas = FC.soma(vendas.filter((m) => ok(m.peso_medio_kg)), (m) => m.cabecas * arrobas(m.peso_medio_kg, rend));
    const valorVendasComPeso = FC.soma(vendas.filter((m) => ok(m.peso_medio_kg)), (m) => m.valor_total);
    const cabCompradas = FC.soma(compras, (m) => m.cabecas);

    const investido = gastoCompras + totalCustos;
    const cx = caixa(movs, custos);
    // capital próprio: só o que saiu do bolso (o caixa reinvestido de vendas
    // não conta de novo — ver caixa())
    const aportado = FC.soma(cx.fluxos, (f) => f.aporte);
    const financeiro = {
      caixa_agro: cx.saldo,
      aportado, sacado: FC.soma(cx.fluxos, (f) => f.saque),
      gasto_compras: gastoCompras, receita_vendas: receitaVendas, custos: totalCustos,
      investido, caixa_liquido: receitaVendas - investido,
      // resultado econômico: o que entrou + o que o rebanho vale hoje − tudo que saiu
      resultado: receitaVendas + valorRebanho - investido,
      // retorno sobre o capital aportado (resultado = rebanho + caixa + sacado − aportado)
      retorno_pct: aportado > 0 ? ((receitaVendas + valorRebanho - investido) / aportado) * 100 : null,
      custos_por_categoria: custosPorCategoria,
      cab_vendidas: cabVendidas, cab_compradas: cabCompradas, entradas_valor: entradasValor,
      preco_medio_arroba_venda: arrVendidas ? valorVendasComPeso / arrVendidas : null,
      custo_medio_cabeca_compra: cabCompradas ? (gastoCompras - entradasValor) / cabCompradas : null,
      mortes: FC.soma(movs.filter((m) => m.tipo === "morte"), (m) => m.cabecas),
      nascimentos: FC.soma(movs.filter((m) => m.tipo === "nascimento"), (m) => m.cabecas),
    };
    // ---------------------------------------------------------- indicadores (sem peso)
    const g = giro(movs);
    financeiro.tempo_medio_dias = g.cab ? g.dias / g.cab : null;
    // natalidade: nascimentos dos últimos 12 meses sobre as matrizes de hoje
    const umAno = FC.datas.soma(FC.datas.hoje(), -365);
    const nasc12 = FC.soma(movs.filter((m) => m.tipo === "nascimento" && m.data >= umAno), (m) => m.cabecas);
    const matrizes = Math.max(0, rebanho.vaca || 0);
    financeiro.natalidade_pct = matrizes ? (nasc12 / matrizes) * 100 : null;
    // mortalidade sobre o que passou pela fazenda
    const entradas = FC.soma(movs.filter((m) => ["compra", "nascimento", "entrada"].includes(m.tipo)), (m) => m.cabecas);
    financeiro.mortalidade_pct = entradas ? (financeiro.mortes / entradas) * 100 : null;

    // ---------------------------------------------------------- série mensal
    const serie = [];
    const eventos = [
      ...movs.map((m) => ({ data: m.data, cab: m.tipo === "reclassificacao" ? 0 : FC.TIPOS_MOV[m.tipo].sinal * m.cabecas,
        inv: m.tipo === "compra" ? m.valor_total + m.despesas : m.tipo === "entrada" ? valorEntrada(m) : 0,
        rec: m.tipo === "venda" ? m.valor_total - m.despesas : m.tipo === "saida" ? m.valor_total : 0 })),
      ...custos.map((c) => ({ data: c.data, cab: 0, inv: c.valor, rec: 0 })),
    ].sort((a, b) => a.data.localeCompare(b.data));
    if (eventos.length) {
      let mes = eventos[0].data.slice(0, 7);
      const fim = FC.datas.hoje().slice(0, 7);
      let i = 0, cab = 0, inv = 0, rec = 0;
      while (mes <= fim) {
        while (i < eventos.length && eventos[i].data.slice(0, 7) <= mes) {
          cab += eventos[i].cab; inv += eventos[i].inv; rec += eventos[i].rec; i++;
        }
        serie.push({ mes, data: mes + "-15", cabecas: cab, investido: inv, recebido: rec });
        const [a, m] = mes.split("-").map(Number);
        mes = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
      }
    }

    // custo por cabeça por mês: custos ÷ (cabeças médias × meses com gado)
    const comGado = serie.filter((x) => x.cabecas > 0);
    const cabMedia = comGado.length ? FC.soma(comGado, (x) => x.cabecas) / comGado.length : 0;
    financeiro.custo_cabeca_mes = cabMedia && comGado.length && totalCustos ? totalCustos / cabMedia / comGado.length : null;
    // margem por cabeça vendida: o líquido da venda menos o que a cabeça custou
    // para entrar e o custo de mantê-la pelo tempo que ficou
    const liqVendas = FC.soma(vendas, (m) => m.valor_total - m.despesas);
    financeiro.margem_cabeca = g.cab && cabVendidas
      ? liqVendas / cabVendidas - g.custo / g.cab - (financeiro.custo_cabeca_mes || 0) * (g.dias / g.cab / 30.44)
      : null;

    // ---------------------------------------------------------- GMD
    const gmd = [];
    const grupos = {};
    for (const p of pesagens) {
      const k = (p.lote ? "Lote " + p.lote : FC.CATEGORIAS_GADO[p.categoria]) + (p.fazenda ? " · " + p.fazenda : "");
      (grupos[k] = grupos[k] || []).push(p);
    }
    // só compara pesagens dos mesmos animais: compra, venda, nascimento ou
    // mudança de categoria no grupo entre duas pesagens começa um período
    // novo; sem duas pesagens no mesmo período, o GMD não aparece
    const MUDA = ["compra", "venda", "entrada", "saida", "nascimento", "reclassificacao"];
    const mexeNoGrupo = (m, p) => MUDA.includes(m.tipo)
      && (p.lote ? m.lote === p.lote : m.categoria === p.categoria || m.categoria_destino === p.categoria)
      && (!p.fazenda || !m.fazenda || m.fazenda === p.fazenda);
    for (const [nome, todas] of Object.entries(grupos)) {
      let ps = [todas[0]];
      const periodos = [ps];
      for (const p of todas.slice(1)) {
        const de = ps.at(-1).data;
        if (movs.some((m) => m.data > de && m.data <= p.data && mexeNoGrupo(m, p))) periodos.push((ps = [p]));
        else ps.push(p);
      }
      ps = periodos.filter((x) => x.length > 1 && x.at(-1).data > x[0].data).at(-1);
      if (!ps) continue;
      const a = ps[0], b = ps.at(-1);
      const dias = FC.datas.dias(a.data, b.data);
      if (dias <= 0) continue;
      const ganho = b.peso_medio_kg - a.peso_medio_kg;
      gmd.push({ nome, de: a.data, ate: b.data, dias, peso_ini: a.peso_medio_kg, peso_fim: b.peso_medio_kg,
        ganho, gmd: ganho / dias, arrobas_mes: (arrobas(ganho, rend) / dias) * 30, pesagens: ps.length });
    }

    // quem pesa o gado: alguma pesagem ou algum lançamento com peso. Sem isso,
    // a tela esconde o que depende de peso em vez de cobrar
    const usaPeso = pesagens.length > 0 || movs.some(temPeso);
    return { ajustes, rebanho, total, porFazenda, porLote, porCategoria, valorRebanho, pelo_custo: peloCusto, peso, financeiro, serie, gmd,
      inconsistentes, rendimento: rend, tem_dados: movs.length + custos.length + pesagens.length > 0,
      usa_peso: usaPeso, valor_cabeca_hoje: valorCabecaHoje };
  }

  // cálculo do valor de uma operação a partir do modo de preço escolhido
  function valorDaOperacao({ modo, cabecas, peso_medio_kg, preco_arroba, preco_cabeca, valor_total }, rend) {
    cabecas = Number(cabecas) || 0;
    if (modo === "arroba" && ok(peso_medio_kg) && ok(preco_arroba)) return cabecas * arrobas(peso_medio_kg, rend) * preco_arroba;
    if (modo === "cabeca" && ok(preco_cabeca)) return cabecas * preco_cabeca;
    return ok(valor_total) ? valor_total : 0;
  }

  // ---------------------------------------------------------------- caixa do agro
  // O dinheiro que gira dentro da atividade. Numa venda, a parte
  // reinvestida fica aqui e paga as próximas compras e custos; só o que
  // passa do caixa é aporte novo, e só o que sai da venda sem voltar é
  // saque. Assim vender 1 por 1,8x e recomprar 2 é crescimento, não um
  // saque seguido de um aporte.
  // Devolve os fluxos que de fato entram e saem da carteira e o saldo do
  // caixa depois de cada lançamento.
  function caixa(movs, custos) {
    const ordem = { venda: 0, saida: 1, compra: 2, entrada: 3, custo: 4 };
    const evs = [
      ...(movs || []).filter((m) => ["compra", "venda", "entrada", "saida"].includes(m.tipo))
        .map((m) => ({ data: m.data, tipo: m.tipo, id: m.id, m })),
      ...(custos || []).map((c) => ({ data: c.data, tipo: "custo", id: c.id, c })),
    ].sort((a, b) => a.data.localeCompare(b.data) || ordem[a.tipo] - ordem[b.tipo]
      || String((a.m || a.c).criado_em || "").localeCompare(String((b.m || b.c).criado_em || "")));
    let saldo = 0;
    const fluxos = [], porId = {};
    for (const e of evs) {
      let aporte = 0, saque = 0, doCaixa = 0, reinvestido = 0;
      if (e.tipo === "venda") {
        const liquido = Math.max(0, e.m.valor_total - e.m.despesas);
        reinvestido = Math.min(liquido, Math.max(0, Number(e.m.reinvestido) || 0));
        saldo += reinvestido;
        saque = liquido - reinvestido;
      } else if (e.tipo === "saida") {
        saque = e.m.valor_total || 0;
      } else {
        const custo = e.tipo === "custo" ? e.c.valor : e.tipo === "compra" ? e.m.valor_total + e.m.despesas : valorEntrada(e.m);
        doCaixa = Math.min(saldo, custo);
        saldo -= doCaixa;
        aporte = custo - doCaixa;
      }
      const f = { data: e.data, tipo: e.tipo, id: e.id, aporte, saque, do_caixa: doCaixa, reinvestido, saldo };
      fluxos.push(f);
      if (e.id) porId[e.id] = f;
    }
    // saldo do caixa ao fim de um dia
    const saldoEm = (d) => { let v = 0; for (const f of fluxos) { if (f.data > d) break; v = f.saldo; } return v; };
    return { fluxos, porId, saldo, saldoEm };
  }

  // a cotação que avalia o rebanho ficou velha? (só importa se alguma
  // categoria depende dela; avaliando pelo custo ou pelas operações, não)
  const DIAS_COTACAO = 30;
  function cotacaoVelha(ag, cfg, hoje = FC.datas.hoje()) {
    if (!ag || ag.pelo_custo || !(ag.total > 0)) return null;
    const depende = ag.porCategoria.some((c) => c.origem_valor === "por_cabeca" || c.origem_valor === "arroba" || c.origem_valor === "tipico");
    if (!depende) return null;
    if (!cfg.data_cotacao) return { dias: null };
    const dias = FC.datas.dias(cfg.data_cotacao, hoje);
    return dias > DIAS_COTACAO ? { dias } : null;
  }

  FC.agro = { analisa, arrobas, valorDaOperacao, caixa, valorCabeca, valorEntrada, valorSemPeso, cotacaoVelha, DIAS_COTACAO, ORIGEM };
})();


/* ---- modelo/rentabilidade.js */
/* Rentabilidade aporte a aporte.
 *
 * 1. Renda fixa: cada aporte rende da SUA data até hoje, pela taxa dele
 *    (ou a do título). Pós-fixado (CDI/Selic) compõe dia a dia com o
 *    índice publicado para cada dia útil; prefixado usa dias úteis/252;
 *    IPCA + X distribui o IPCA de cada mês pelos dias úteis do mês.
 * 2. Ações, FIIs e cripto: lotes por compra, vendas consumindo os lotes
 *    mais antigos (PEPS/FIFO), cada lote com o próprio resultado.
 * 3. Consolidação por ativo e pela carteira, ponderada por valor e tempo:
 *    - TIR (XIRR) ao ano: a taxa que o SEU dinheiro rendeu, contando quando
 *      cada real entrou e saiu. É a medida certa para quem decide os aportes.
 *    - Retorno no período (Modified Dietz): o ganho dividido pelo capital
 *      médio que ficou aplicado — o mesmo critério, sem anualizar (bom para
 *      prazos curtos, em que anualizar distorce).
 *    A TWR (que ignora o tamanho dos aportes) serve para comparar com o
 *    CDI e o Ibovespa e é calculada na série diária do gráfico.
 */
(function () {
  const FC = window.FC;
  const D = () => FC.datas;
  const INICIO = "2015-01-01";

  // ---------------------------------------------------------------- índices
  // { cdi: [[data, %dia]], selic: [...], ipca: [[AAAA-MM-01, %mês]] } →
  // calendário de dias úteis (o do CDI publicado; depois dele, o do app)
  // e fatores acumulados por indexador e taxa, para consultar em O(1).
  // "reserva" é a foto anual do Banco Central (macro: cdi, selic_meta,
  // ipca_12m): sem a série diária, o título rende por ela (como estimativa)
  // em vez de ficar parado no valor aplicado.
  const aoDia = (anual) => (FC.ok(anual) ? (Math.pow(1 + anual / 100, 1 / 252) - 1) * 100 : null);
  const aoMes = (anual) => (FC.ok(anual) ? (Math.pow(1 + anual / 100, 1 / 12) - 1) * 100 : null);
  function preparaIndices(bruto, reserva) {
    bruto = bruto || {}; reserva = reserva || {};
    const cdi = bruto.cdi || [], selic = bruto.selic || [], ipca = bruto.ipca || [];
    const resCdi = aoDia(reserva.cdi), resSelic = aoDia(reserva.selic_meta) ?? resCdi, resIpca = aoMes(reserva.ipca_12m);
    const mCdi = new Map(cdi), mSelic = new Map(selic), mIpca = new Map(ipca.map(([d, v]) => [d.slice(0, 7), v]));
    const priCal = cdi.length ? cdi[0][0] : null, ultCal = cdi.length ? cdi.at(-1)[0] : null;
    const ultCdi = cdi.length ? cdi.at(-1)[1] : null, priCdi = cdi.length ? cdi[0][1] : null;
    const ultIpca = ipca.length ? ipca.at(-1)[1] : resIpca;
    const hoje = D().hoje();
    // todos os dias corridos de INICIO a hoje (+1, para "até hoje" incluir hoje)
    const dias = [], pos = new Map();
    for (let d = INICIO, i = 0; d <= D().soma(hoje, 1); d = D().soma(d, 1), i++) { dias.push(d); pos.set(d, i); }
    const util = dias.map((d) => (ultCal && d >= priCal && d <= ultCal ? mCdi.has(d) : D().ehUtil(d)));
    const porMes = {};
    dias.forEach((d, i) => { if (util[i]) porMes[d.slice(0, 7)] = (porMes[d.slice(0, 7)] || 0) + 1; });
    // o mês corrente conta todos os dias úteis dele, não só os que já passaram:
    // senão o IPCA do mês inteiro entraria em poucos dias
    const mesFim = dias.at(-1).slice(0, 7);
    for (let d = D().soma(dias.at(-1), 1); d.slice(0, 7) === mesFim; d = D().soma(d, 1)) if (D().ehUtil(d)) porMes[mesFim] = (porMes[mesFim] || 0) + 1;
    const cache = new Map();

    // valor do índice num dia útil e se foi medido ou estimado
    function taxaDia(indexador, d) {
      if (indexador === "selic") {
        if (mSelic.has(d)) return [mSelic.get(d), false];
        if (mCdi.has(d)) return [mCdi.get(d), true];        // Selic ausente: o CDI do dia
      } else if (mCdi.has(d)) return [mCdi.get(d), false];
      if (ultCdi == null) return [indexador === "selic" ? resSelic : resCdi, true];
      return [d > ultCal ? ultCdi : priCdi, true];
    }

    // fatores acumulados: acum[i] = produto dos fatores diários antes do dia i
    function serie(indexador, taxa) {
      const chave = indexador + ":" + taxa;
      if (cache.has(chave)) return cache.get(chave);
      const acum = new Float64Array(dias.length + 1), est = new Uint8Array(dias.length + 1);
      acum[0] = 1;
      for (let i = 0; i < dias.length; i++) {
        let g = 1, e = 0;
        if (util[i]) {
          const d = dias[i];
          if (indexador === "cdi" || indexador === "selic") {
            const [v, estimado] = taxaDia(indexador, d);
            g = v == null ? 1 : 1 + (v / 100) * (taxa / 100); e = estimado ? 1 : 0;
          } else if (indexador === "prefixado") {
            g = Math.pow(1 + taxa / 100, 1 / 252);
          } else if (indexador === "ipca") {
            const m = d.slice(0, 7), v = mIpca.has(m) ? mIpca.get(m) : ultIpca;
            e = mIpca.has(m) ? 0 : 1;
            g = Math.pow(1 + (v || 0) / 100, 1 / (porMes[m] || 21)) * Math.pow(1 + taxa / 100, 1 / 252);
          }
        }
        acum[i + 1] = acum[i] * g;
        est[i + 1] = est[i] + e;
      }
      const s = { acum, est };
      cache.set(chave, s);
      return s;
    }

    // fator de "de" até "ate" (o dia "ate" não rende ainda) e se houve estimativa
    function fator(indexador, taxa, de, ate) {
      if (!(de < ate)) return { f: 1, estimado: false };
      const i = pos.get(de < INICIO ? INICIO : de), j = pos.get(ate > dias.at(-1) ? dias.at(-1) : ate);
      if (i == null || j == null) return { f: 1, estimado: true };
      const s = serie(indexador, Number(taxa) || 0);
      return { f: s.acum[j] / s.acum[i], estimado: s.est[j] - s.est[i] > 0 || de < INICIO };
    }
    return { fator, ultimo: { cdi: ultCal, ipca: ipca.length ? ipca.at(-1)[0] : null, selic: selic.length ? selic.at(-1)[0] : null },
      tem: cdi.length > 0, so_reserva: !cdi.length && resCdi != null, vazio: !cdi.length && resCdi == null };
  }

  // ---------------------------------------------------------------- consolidação
  const anos = (de, ate) => D().dias(de, ate) / 365;

  // TIR com datas (XIRR). fluxos: [{data, valor}], valor < 0 = dinheiro que
  // saiu do bolso (aporte), > 0 = que voltou (resgate, provento, saldo final).
  function xirr(fluxos) {
    const fs = fluxos.filter((f) => Math.abs(f.valor) > 1e-9).sort((a, b) => a.data.localeCompare(b.data));
    if (fs.length < 2 || !fs.some((f) => f.valor < 0) || !fs.some((f) => f.valor > 0)) return null;
    const t0 = fs[0].data, ts = fs.map((f) => anos(t0, f.data));
    const npv = (r) => fs.reduce((s, f, k) => s + f.valor / Math.pow(1 + r, ts[k]), 0);
    const der = (r) => fs.reduce((s, f, k) => s - (ts[k] * f.valor) / Math.pow(1 + r, ts[k] + 1), 0);
    let r = 0.1;
    for (let k = 0; k < 60; k++) {
      const v = npv(r), dv = der(r);
      if (!isFinite(v) || !isFinite(dv) || dv === 0) break;
      const n = r - v / dv;
      if (!isFinite(n) || n <= -0.9999) break;
      if (Math.abs(n - r) < 1e-10) return n * 100;
      r = n;
    }
    // Newton não convergiu: bisseção
    let lo = -0.9999, hi = 10, flo = npv(lo), fhi = npv(hi);
    if (flo * fhi > 0) { hi = 1e4; fhi = npv(hi); if (flo * fhi > 0) return null; }
    for (let k = 0; k < 200; k++) {
      const m = (lo + hi) / 2, fm = npv(m);
      if (Math.abs(fm) < 1e-9) return m * 100;
      if (flo * fm < 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; }
    }
    return ((lo + hi) / 2) * 100;
  }

  // Modified Dietz: ganho ÷ capital médio ponderado pelo tempo que ficou aplicado
  function dietz(fluxos, valorFinal, fim) {
    const fs = fluxos.filter((f) => Math.abs(f.valor) > 1e-9);
    if (!fs.length) return null;
    const ini = fs.reduce((m, f) => (f.data < m ? f.data : m), fs[0].data);
    const T = Math.max(1, D().dias(ini, fim));
    // aqui o fluxo entra com o sinal do bolso para a carteira: aporte +, saída −
    const entra = fs.map((f) => ({ data: f.data, v: -f.valor }));
    const liquido = entra.reduce((s, f) => s + f.v, 0);
    const base = entra.reduce((s, f) => s + f.v * (D().dias(f.data, fim) / T), 0);
    if (!(base > 1e-9)) return null;
    return ((valorFinal - liquido) / base) * 100;
  }

  // retorno de um lote e o equivalente ao ano (só a partir de 30 dias: abaixo
  // disso, anualizar transforma ruído em número gigante)
  function anualiza(pct, dias) {
    if (pct == null || dias < 30) return null;
    return (Math.pow(1 + pct / 100, 365 / dias) - 1) * 100;
  }

  function resumoFluxos(fluxos, valorFinal, hoje, extra = {}) {
    const aplicado = -fluxos.filter((f) => f.valor < 0).reduce((s, f) => s + f.valor, 0);
    const devolvido = fluxos.filter((f) => f.valor > 0).reduce((s, f) => s + f.valor, 0);
    const comFinal = fluxos.concat(valorFinal > 0 ? [{ data: hoje, valor: valorFinal }] : []);
    const inicio = fluxos.length ? fluxos.reduce((m, f) => (f.data < m ? f.data : m), fluxos[0].data) : hoje;
    const dias = D().dias(inicio, hoje);
    return {
      aplicado, devolvido, valor_atual: valorFinal,
      ganho: valorFinal + devolvido - aplicado,
      periodo_pct: dietz(fluxos, valorFinal, hoje),
      // a TIR anual só aparece com 90 dias de história
      xirr: dias >= 90 ? xirr(comFinal) : null,
      desde: inicio, dias, ...extra,
    };
  }

  // ---------------------------------------------------------------- renda fixa
  const PADRAO_TAXA = { cdi: 100, selic: 100, prefixado: 0, ipca: 0 };
  function lotesDoTitulo(titulo, aportes) {
    const ind = titulo.tipo, taxa = titulo.taxa != null ? Number(titulo.taxa) : PADRAO_TAXA[ind];
    const lotes = [];
    if (Number(titulo.valor_aplicado) > 0) {
      lotes.push({ id: "inicial", origem: "saldo inicial", data: titulo.data_inicio || String(titulo.criado_em || D().hoje()).slice(0, 10),
        valor: Number(titulo.valor_aplicado), indexador: ind, taxa });
    }
    for (const a of aportes) {
      // os de extrato importado já estão no saldo inicial
      if (a.tipo !== "caixa" || a.historico || a.origem || a.titulo !== titulo.nome) continue;
      lotes.push({ id: a.id, origem: a.valor < 0 ? "resgate" : "aporte", data: a.data, valor: Number(a.valor),
        indexador: a.indexador || ind, taxa: a.taxa != null ? Number(a.taxa) : taxa, proprio: !!(a.indexador || a.taxa != null) });
    }
    lotes.sort((a, b) => a.data.localeCompare(b.data));
    // valor atual informado à mão: vale na data dele; o que entrou depois
    // rende pela taxa a partir dali
    if (titulo.valor_atual != null && titulo.valor_atual !== "" && Number.isFinite(Number(titulo.valor_atual))) {
      lotes.manual = { valor: Number(titulo.valor_atual), data: titulo.valor_atual_em || D().hoje() };
    }
    return lotes;
  }

  function rotuloTaxa(indexador, taxa) {
    const n = (v) => FC.fmt.num(v, v % 1 ? 2 : 0);
    return indexador === "cdi" ? `${n(taxa)}% do CDI` : indexador === "selic" ? `${n(taxa)}% da Selic`
      : indexador === "ipca" ? `IPCA + ${n(taxa)}%` : `${n(taxa)}% a.a. pré`;
  }

  // valor de um título num dia (para o gráfico) e a análise completa (para hoje)
  function valorCalculadoEm(lotes, ix, dia) {
    let v = 0;
    const temFator = ix && typeof ix.fator === "function";
    for (const l of lotes) if (l.data <= dia) v += l.valor * (temFator ? ix.fator(l.indexador, l.taxa, l.data, dia).f : 1);
    return v;
  }
  // Com valor informado, a diferença para o calculado é rendimento: antes
  // da data ela entra aos poucos (do primeiro lote até lá), sem virar
  // aporte; depois, o valor informado segue e os lotes novos rendem.
  function valorTituloEm(lotes, ix, dia) {
    const m = lotes.manual;
    if (!m) return valorCalculadoEm(lotes, ix, dia);
    if (dia >= m.data) {
      let v = m.valor;
      const temFator = ix && typeof ix.fator === "function";
      for (const l of lotes) if (l.data > m.data && l.data <= dia) v += l.valor * (temFator ? ix.fator(l.indexador, l.taxa, l.data, dia).f : 1);
      return v;
    }
    const ini = lotes.length ? lotes[0].data : m.data;
    if (dia < ini) return 0;
    const ajuste = m.valor - valorCalculadoEm(lotes, ix, m.data);
    const f = Math.min(1, D().dias(ini, dia) / Math.max(1, D().dias(ini, m.data)));
    return valorCalculadoEm(lotes, ix, dia) + ajuste * f;
  }

  function avaliaTitulo(titulo, aportes, ix, hoje = D().hoje()) {
    const temFator = ix && typeof ix.fator === "function";
    const lotes = lotesDoTitulo(titulo, aportes).map((l) => {
      // o rendimento de um dia útil entra no dia seguinte: hoje vale o acumulado até ontem
      const { f, estimado } = temFator ? ix.fator(l.indexador, l.taxa, l.data, hoje) : { f: 1, estimado: true };
      const atual = l.valor * f, dias = D().dias(l.data, hoje), pct = (f - 1) * 100;
      return { ...l, rotulo_taxa: rotuloTaxa(l.indexador, l.taxa), valor_atual: atual, rendimento: atual - l.valor,
        pct: l.valor > 0 ? pct : null, pct_aa: l.valor > 0 ? anualiza(pct, dias) : null, dias, estimado };
    });
    const calculado = lotes.reduce((s, l) => s + l.valor_atual, 0);
    const brutos = lotesDoTitulo(titulo, aportes);
    const valor = brutos.manual ? valorTituloEm(brutos, ix, hoje) : calculado;
    const manual = brutos.manual ? { ...brutos.manual, ajuste: valor - calculado } : null;
    const fluxos = lotes.map((l) => ({ data: l.data, valor: -l.valor }));
    return { lotes, manual, ...resumoFluxos(fluxos, valor, hoje, { estimado: lotes.some((l) => l.estimado), sem_indices: !temFator || ix.vazio, so_reserva: !!(ix && ix.so_reserva) }) };
  }

  // ---------------------------------------------------------------- ações, FIIs, cripto
  function eventosDoAtivo(item, aportes) {
    const ev = [];
    const importado = aportes.some((a) => a.tipo === "ativo" && a.ticker === item.ticker && a.origem);
    if (!importado && Number(item.quantidade) > 0) {
      ev.push({ id: "inicial", origem: "posição inicial", data: item.data_base || String(item.criado_em || D().hoje()).slice(0, 10),
        q: Number(item.quantidade), preco: item.preco_medio != null ? Number(item.preco_medio) : null });
    }
    for (const a of aportes) {
      if (a.tipo !== "ativo" || a.ticker !== item.ticker || !a.data) continue;
      ev.push({ id: a.id, origem: a.quantidade < 0 ? "venda" : "compra", data: a.data, q: Number(a.quantidade), preco: Number(a.preco) });
    }
    return ev.sort((a, b) => a.data.localeCompare(b.data) || (a.q < 0) - (b.q < 0));
  }

  function avaliaAtivo(item, aportes, preco, proventosPagos = [], hoje = D().hoje()) {
    const ev = eventosDoAtivo(item, aportes);
    const abertos = [], realizados = [], fluxos = [];
    for (const e of ev) {
      if (e.q > 0) {
        abertos.push({ ...e, q_rest: e.q });
        if (e.preco != null) fluxos.push({ data: e.data, valor: -e.q * e.preco });
      } else {
        // venda: consome os lotes mais antigos (PEPS)
        let falta = -e.q;
        fluxos.push({ data: e.data, valor: falta * e.preco });
        for (const l of abertos) {
          if (falta <= 1e-12) break;
          const usa = Math.min(l.q_rest, falta);
          if (usa <= 0) continue;
          l.q_rest -= usa; falta -= usa;
          realizados.push({ data_compra: l.data, data_venda: e.data, q: usa, preco_compra: l.preco, preco_venda: e.preco,
            ganho: l.preco != null ? usa * (e.preco - l.preco) : null, pct: l.preco ? (e.preco / l.preco - 1) * 100 : null });
        }
      }
    }
    for (const p of proventosPagos) fluxos.push({ data: p.pagamento || p.data_com, valor: p.valor });
    const lotes = abertos.filter((l) => l.q_rest > 1e-12).map((l) => {
      const custo = l.preco != null ? l.q_rest * l.preco : null, atual = preco != null ? l.q_rest * preco : null;
      const pct = l.preco && preco != null ? (preco / l.preco - 1) * 100 : null, dias = D().dias(l.data, hoje);
      return { ...l, quantidade: l.q_rest, custo, valor_atual: atual, rendimento: custo != null && atual != null ? atual - custo : null,
        pct, pct_aa: anualiza(pct, dias), dias };
    });
    const q = lotes.reduce((s, l) => s + l.quantidade, 0);
    // sem o custo de alguma compra (mesmo já vendida) não há como medir o
    // retorno do ativo inteiro; sem o preço de agora, também não
    const semCusto = ev.some((e) => e.q > 0 && e.preco == null);
    const semPreco = preco == null && q > 1e-12;
    const valor = preco != null ? q * preco : 0;
    const r = semCusto || semPreco ? { aplicado: null, valor_atual: valor, ganho: null, periodo_pct: null, xirr: null, desde: ev[0] && ev[0].data, dias: null }
      : resumoFluxos(fluxos, valor, hoje);
    return { lotes, realizados, quantidade: q, sem_custo: semCusto, sem_preco: semPreco,
      proventos: proventosPagos.reduce((s, p) => s + p.valor, 0), fluxos, ...r };
  }

  // ---------------------------------------------------------------- carteira
  // tudo junto: ativos, renda fixa e agro, cada um com seus fluxos datados
  function carteira(dados, base, ix, pagamentos = []) {
    const hoje = D().hoje();
    const porTicker = {};
    for (const p of pagamentos) if (p.status === "pago") (porTicker[p.ticker] = porTicker[p.ticker] || []).push(p);
    const ativos = dados.ativos.filter((a) => a.posicao || base.aportes.some((x) => x.tipo === "ativo" && x.ticker === a.ticker))
      .map((a) => ({ ticker: a.ticker, classe: a.classe, ...avaliaAtivo(a.item, base.aportes, a.preco, porTicker[a.ticker] || [], hoje) }));
    const titulos = base.rendaFixa.map((t) => ({ nome: t.nome, ...avaliaTitulo(t, base.aportes, ix, hoje) }));
    // agro: só o que passa do caixa da atividade sai do bolso (aporte) e só
    // o que não é reinvestido volta (saque) — ver FC.agro.caixa
    const cxAgro = FC.agro.caixa(base.agro.movs, base.agro.custos);
    const fAgro = [];
    for (const f of cxAgro.fluxos) {
      if (f.aporte > 0) fAgro.push({ data: f.data, valor: -f.aporte });
      if (f.saque > 0) fAgro.push({ data: f.data, valor: f.saque });
    }
    const valorAgroHoje = (dados.agro.valorRebanho || 0) + cxAgro.saldo;
    const agro = fAgro.length ? resumoFluxos(fAgro, valorAgroHoje, hoje) : null;

    const grupo = (lista, filtro) => {
      const ok = lista.filter(filtro).filter((x) => x.aplicado != null);
      if (!ok.length) return null;
      const fl = ok.flatMap((x) => x.fluxos || x.lotes.map((l) => ({ data: l.data, valor: -l.valor })));
      return resumoFluxos(fl, ok.reduce((s, x) => s + (x.valor_atual || 0), 0), hoje, { n: ok.length });
    };
    const classes = {
      bolsa: grupo(ativos, (a) => a.classe !== "cripto"),
      cripto: grupo(ativos, (a) => a.classe === "cripto"),
      renda_fixa: grupo(titulos, () => true),
      agro,
    };
    // caixa de proventos: o provento que fica guardado não volta ao bolso e a
    // parte da compra paga com ele não sai do bolso — ver FC.caixaProventos
    const cx = dados.caixa_proventos && dados.caixa_proventos.ativo ? dados.caixa_proventos : null;
    const fCx = [];
    if (cx) {
      const medidos = new Set(ativos.filter((a) => a.aplicado != null).map((a) => a.ticker));
      for (const e of cx.entradas) if (e.fluxo && medidos.has(e.ticker)) fCx.push({ data: e.data, valor: -e.valor });
      for (const s of cx.saidas) if (s.usado > 0) fCx.push({ data: s.data, valor: s.usado });
    }
    const fl = [
      ...ativos.filter((a) => a.aplicado != null).flatMap((a) => a.fluxos),
      ...titulos.flatMap((t) => t.lotes.map((l) => ({ data: l.data, valor: -l.valor }))),
      ...fAgro,
    ].map((f) => ({ ...f }));
    // o ajuste abate o fluxo do mesmo dia (a compra, o provento) em vez de
    // virar um resgate ou aporte à parte; sem par, entra sozinho
    for (const a of fCx) {
      const par = fl.find((f) => f.data === a.data && Math.sign(f.valor) === -Math.sign(a.valor) && Math.abs(f.valor) >= Math.abs(a.valor) - 1e-9);
      if (par) par.valor += a.valor; else fl.push(a);
    }
    const final = ativos.filter((a) => a.aplicado != null).reduce((s, a) => s + a.valor_atual, 0)
      + titulos.reduce((s, t) => s + t.valor_atual, 0) + (agro ? valorAgroHoje : 0) + (cx ? cx.saldo : 0);
    return { ativos, titulos, classes, total: fl.length ? resumoFluxos(fl, final, hoje) : null,
      sem_custo: ativos.filter((a) => a.sem_custo).map((a) => a.ticker),
      sem_preco: ativos.filter((a) => a.sem_preco && !a.sem_custo).map((a) => a.ticker) };
  }

  // ---------------------------------------------------------------- rebanho no tempo
  // As cabeças entram em lotes por categoria (compra, nascimento, outra
  // entrada), mudam de categoria com o lote (reclassificação) e saem na
  // ordem em que entraram (venda, morte, outra saída) — da própria
  // categoria e, se faltar, de onde o animal veio, como em FC.agro.analisa.
  // Cada pedaço de lote vira um segmento {de, ate, n, v0, v1}: valor por
  // cabeça na entrada e na saída, com uma reta entre os dois.
  // "ag" é o resultado de FC.agro.analisa (valor de hoje por categoria).
  // Avaliado pelo custo (ag.pelo_custo), a cabeça vale o que custou até sair.
  function segmentosDoRebanho(movs, ag, hoje) {
    const peloCusto = !!(ag && ag.pelo_custo);
    const ordem = { compra: 0, nascimento: 0, entrada: 0, reclassificacao: 1, venda: 2, morte: 2, saida: 2 };
    const ms = (movs || []).filter((m) => m.tipo in ordem && m.cabecas > 0)
      .sort((a, b) => a.data.localeCompare(b.data) || ordem[a.tipo] - ordem[b.tipo] || String(a.criado_em || "").localeCompare(String(b.criado_em || "")));
    const ORIGEM = FC.agro.ORIGEM || {};
    const abertos = {}, segs = [];
    const lotes = (c) => (abertos[c] = abertos[c] || []);
    const tem = (c) => (abertos[c] || []).reduce((s, l) => s + l.n, 0);
    // tira n cabeças de uma categoria, dos lotes mais antigos primeiro
    const tira = (c, n, fecha) => {
      const ls = lotes(c);
      while (n > 0 && ls.length) {
        const l = ls[0], q = Math.min(n, l.n);
        fecha(l, q);
        l.n -= q; n -= q;
        if (l.n <= 0) ls.shift();
      }
    };
    for (const m of ms) {
      if (ordem[m.tipo] === 0) {
        const vt = m.valor_total || m.valor_estimado;
        const v0 = m.tipo === "compra" ? (m.valor_total + m.despesas) / m.cabecas
          : m.tipo === "nascimento" ? 0 : vt ? vt / m.cabecas : null;
        lotes(m.categoria).push({ de: m.data, n: m.cabecas, v0 });
        continue;
      }
      if (m.tipo === "reclassificacao") {
        // o lote leva a data e o valor de entrada para a categoria nova
        const dest = lotes(m.categoria_destino);
        tira(m.categoria, Math.min(m.cabecas, tem(m.categoria)), (l, q) => dest.push({ de: l.de, n: q, v0: l.v0 }));
        dest.sort((a, b) => a.de.localeCompare(b.de));
        continue;
      }
      // morte e saída sem valor: a cabeça some pelo valor que tinha (perda no dia)
      const v1 = m.tipo === "venda" ? Math.max(0, m.valor_total - m.despesas) / m.cabecas
        : m.tipo === "saida" && m.valor_total ? m.valor_total / m.cabecas : null;
      // pelo custo, a cabeça vale o que custou até o dia da venda
      const fecha = (l, q) => segs.push({ de: l.de, ate: m.data, n: q, v0: l.v0, v1: peloCusto && l.v0 != null ? l.v0 : v1, venda: m.tipo === "venda" ? v1 : null });
      const antes = (ORIGEM[m.categoria] || []).slice().reverse();
      const cats = [m.categoria, ...antes, ...Object.keys(abertos).filter((c) => c !== m.categoria && !antes.includes(c))];
      let falta = m.cabecas;
      for (const c of cats) {
        const q = Math.min(falta, tem(c));
        if (q > 0) { tira(c, q, fecha); falta -= q; }
        if (falta <= 0) break;
      }
    }
    // quem ainda está no pasto termina hoje no valor pela arroba da sua categoria
    const valorHoje = typeof ag === "number" ? ag : (ag && ag.valorRebanho) || 0;
    const porCatHoje = {};
    for (const c of (ag && ag.porCategoria) || []) if (c.cabecas > 0) porCatHoje[c.categoria] = c.valor / c.cabecas;
    const cab = Object.keys(abertos).reduce((s, c) => s + tem(c), 0);
    const porCabHoje = cab ? valorHoje / cab : 0;
    for (const [c, ls] of Object.entries(abertos)) {
      for (const l of ls) if (l.n > 0) segs.push({ de: l.de, ate: hoje, n: l.n, v0: l.v0, v1: peloCusto && l.v0 != null ? l.v0 : porCatHoje[c] ?? porCabHoje, aberto: true });
    }
    for (const g of segs) {
      if (g.v0 == null && g.v1 == null) g.v0 = g.v1 = porCabHoje;
      else if (g.v0 == null) g.v0 = g.v1;
      else if (g.v1 == null) g.v1 = g.v0;
      g.dias = Math.max(1, D().dias(g.de, g.ate));
    }
    return segs;
  }

  function curvaDoRebanho(movs, ag, hoje) {
    const segs = segmentosDoRebanho(movs, ag, hoje);
    return (d) => {
      let v = 0;
      for (const g of segs) {
        if (d < g.de || (!g.aberto && d >= g.ate)) continue;
        const f = Math.min(1, D().dias(g.de, d) / g.dias);
        v += g.n * (g.v0 + (g.v1 - g.v0) * f);
      }
      return v;
    };
  }

  // ---------------------------------------------------------------- ciclos do rebanho
  // O gado não rende enquanto está no pasto: o resultado aparece na venda.
  // Cada venda fecha os lotes que saíram (os mais antigos primeiro), com o
  // custo de entrada deles e a parte dos custos da atividade (nutrição,
  // sanidade, mão de obra…) que coube a essas cabeças: cada custo é rateado
  // pelas cabeças que estavam no pasto na data dele.
  function ciclosDoRebanho(movs, custos, ag, hoje) {
    const segs = segmentosDoRebanho(movs, ag, hoje).filter((g) => g.n > 0);
    const extra = segs.map(() => 0);
    for (const c of custos || []) {
      if (!(c.valor > 0) || !c.data) continue;
      const vivos = segs.map((g, i) => (g.de <= c.data && (g.aberto || c.data < g.ate) ? i : -1)).filter((i) => i >= 0);
      const cab = vivos.reduce((s, i) => s + segs[i].n, 0);
      if (cab > 0) for (const i of vivos) extra[i] += (c.valor * segs[i].n) / cab;
    }
    const out = [];
    segs.forEach((g, i) => {
      if (g.aberto || g.venda == null) return;
      const custo = g.n * (g.v0 || 0) + extra[i];
      if (!(custo > 0)) return;
      out.push({ de: g.de, ate: g.ate, cabecas: g.n, custo, venda: g.n * g.venda, dias: g.dias });
    });
    return out.sort((a, b) => a.ate.localeCompare(b.ate));
  }

  // ---------------------------------------------------------------- série diária
  // O patrimônio reconstruído dia a dia: posições × preço de cada dia +
  // renda fixa rendendo + o rebanho no valor do app. "fluxo" acumula o
  // dinheiro que entrou, para separar aporte de rendimento. Proventos pagos
  // (FC.dividendos.analisa(...).pagamentos) saem do fluxo na data de
  // pagamento — o dinheiro voltou ao bolso e conta como rendimento (com
  // caixa de proventos, ficam no saldo dele em vez de sair);
  // "proventos" acumula só eles. "partes" separa valor e fluxo em renda
  // variável (rv: ações, FIIs, ETFs e cripto), renda fixa (rf: títulos e o
  // caixa de proventos) e agro, para medir cada uma contra a sua referência.
  function serieDiaria(base, mercado, ix, prefs, valorHoje, pagamentos = []) {
    const hoje = D().hoje(), hist = (mercado && mercado.historicos) || {}, spot = (mercado && mercado.spot) || {};
    const eventos = [];       // {data, ticker, q, custo}
    for (const a of base.ativos) for (const e of eventosDoAtivo(a, base.aportes)) eventos.push({ ...e, ticker: a.ticker });
    const titulos = base.rendaFixa.map((t) => lotesDoTitulo(t, base.aportes));
    const movsAgro = base.agro.movs || [];
    const datas = [...eventos.map((e) => e.data), ...titulos.flat().map((l) => l.data), ...movsAgro.map((m) => m.data), ...(base.agro.custos || []).map((c) => c.data)].filter(Boolean);
    if (!datas.length) return { pontos: [], inicio: null, ciclos: [] };
    const inicio = datas.sort()[0];

    // preço de um ativo num dia: o fechamento daquele dia (ou o anterior);
    // antes do começo da série, o primeiro preço conhecido; sem série, o de agora
    const precoDia = (t, d) => {
      const h = hist[t];
      if (h && !h.erro && h.precos && h.precos.length) return FC.carteira.precoEm(h.precos, d) ?? h.precos[0][1];
      const s = spot[t];
      return s && FC.ok(s.preco) ? s.preco : null;
    };
    // rebanho: cada cabeça vale, em cada dia, uma reta entre os dois preços
    // reais que se conhecem dela — o que custou ao entrar e o que rendeu ao
    // sair (ou, se ainda está no pasto, o valor de hoje pela arroba).
    // Avaliar o passado pela arroba de hoje inventaria saltos na venda.
    const analiseAgro = FC.agro.analisa(base.agro, prefs.agro);
    const valorRebanho = curvaDoRebanho(movsAgro, analiseAgro, hoje);
    let ciclos = [];
    try { ciclos = ciclosDoRebanho(movsAgro, base.agro.custos || [], analiseAgro, hoje); } catch (e) { console.error(e); }
    // + o dinheiro de vendas reinvestido que ainda não virou gado
    const cxAgro = FC.agro.caixa(movsAgro, base.agro.custos || []);
    const valorAgro = (d) => valorRebanho(d) + cxAgro.saldoEm(d);

    // dinheiro que entrou até cada dia (aporte +, resgate/venda −)
    const fluxos = [];
    // compra e venda entram pelo preço do negócio; a posição inicial entra
    // pelo preço de mercado do dia em que aparece (o preço médio dela é de
    // compras anteriores — usá-lo aqui criaria um ganho ou perda que não
    // aconteceu dentro do gráfico)
    for (const e of eventos) {
      const p = e.id === "inicial" ? precoDia(e.ticker, e.data) ?? e.preco : e.preco ?? precoDia(e.ticker, e.data);
      if (p != null) fluxos.push([e.data, e.q * p, 0, "rv"]);
    }
    for (const ls of titulos) for (const l of ls) fluxos.push([l.data, l.valor, 0, "rf"]);
    // caixa de proventos ligado: o provento que vai para ele não sai do
    // fluxo (o dinheiro continua na carteira, no saldo do caixa) e a parte da
    // compra paga com o caixa não é dinheiro novo
    let cxProv = null;
    try { if (FC.caixaProventos) cxProv = FC.caixaProventos.analisa(base, pagamentos, prefs && prefs.proventos, ix, hoje); } catch (e) { console.error(e); }
    if (cxProv && !cxProv.ativo) cxProv = null;
    const noCaixa = new Set(cxProv ? cxProv.entradas.filter((e) => e.fluxo).map((e) => e.origem) : []);
    for (const p of pagamentos || []) {
      if (!(p.status === "pago" && p.valor && (p.pagamento || p.data_com)) || noCaixa.has(p.origem)) continue;
      fluxos.push([p.pagamento || p.data_com, -p.valor, -p.valor, "rv"]);
    }
    if (cxProv) {
      // o provento sai da renda variável (rendimento dela) e entra no caixa
      for (const e of cxProv.entradas) { fluxos.push([e.data, -e.valor, -e.valor, "rv"]); fluxos.push([e.data, e.valor, 0, "rf"]); }
      for (const s of cxProv.saidas) if (s.usado > 0) fluxos.push([s.data, -s.usado, 0, "rf"]);
    }
    for (const f of cxAgro.fluxos) if (f.aporte || f.saque) fluxos.push([f.data, f.aporte - f.saque, 0, "agro"]);
    fluxos.sort((a, b) => a[0].localeCompare(b[0]));

    const pontos = [];
    const pos = {};
    let ie = 0, ifl = 0, acum = 0, prov = 0;
    const flParte = { rv: 0, rf: 0, agro: 0 };
    const evs = eventos.slice().sort((a, b) => a.data.localeCompare(b.data));
    for (let d = inicio; d <= hoje; d = D().soma(d, 1)) {
      while (ie < evs.length && evs[ie].data <= d) { pos[evs[ie].ticker] = (pos[evs[ie].ticker] || 0) + evs[ie].q; ie++; }
      while (ifl < fluxos.length && fluxos[ifl][0] <= d) {
        const f = fluxos[ifl];
        acum += f[1]; if (f[2]) prov -= f[2]; if (f[3]) flParte[f[3]] += f[1]; ifl++;
      }
      let rv = 0, rf = 0, faltou = false;
      for (const [t, q] of Object.entries(pos)) {
        if (q <= 1e-12) continue;
        const p = precoDia(t, d);
        if (p == null) { faltou = true; continue; }
        rv += q * p;
      }
      for (const ls of titulos) rf += valorTituloEm(ls, ix, d);
      if (cxProv) rf += cxProv.saldoEm(d);
      const ag = valorAgro(d);
      pontos.push({ data: d, valor: rv + rf + ag, fluxo: acum, proventos: prov, incompleto: faltou,
        partes: { rv: { valor: rv, fluxo: flParte.rv }, rf: { valor: rf, fluxo: flParte.rf }, agro: { valor: ag, fluxo: flParte.agro } } });
    }
    // o ponto de hoje usa os preços de agora, igual ao patrimônio do topo
    // (a diferença é de cotação: vai para a renda variável)
    if (valorHoje != null && pontos.length) {
      const u = pontos.at(-1);
      u.partes.rv.valor = Math.max(0, u.partes.rv.valor + valorHoje - u.valor);
      u.valor = valorHoje;
    }
    return { pontos, inicio, ciclos };
  }

  // TWR da série: encadeia o retorno de cada dia descontando o fluxo do dia
  function twr(pontos) {
    let f = 1;
    for (let i = 1; i < pontos.length; i++) {
      const ant = pontos[i - 1].valor, fl = pontos[i].fluxo - pontos[i - 1].fluxo;
      if (ant > 1e-9) f *= (pontos[i].valor - fl) / ant;
    }
    return (f - 1) * 100;
  }

  // ---------------------------------------------------------------- comparação
  // "E se cada aporte tivesse ido para a Selic (ou o Ibovespa) no mesmo dia?"
  // Cada fluxo cresce pelo índice da data dele até hoje; vendas, resgates e
  // proventos saem da conta simulada na mesma data, pelo mesmo valor.
  function crescimentoIndice(indice, de, ate, ix, ibov) {
    if (indice === "selic") return (ix && typeof ix.fator === "function") ? ix.fator("selic", 100, de, ate).f : null;
    if (!ibov || !ibov.length || de < ibov[0][0]) return null;      // antes da série: sem comparação
    const a = FC.carteira.precoEm(ibov, de), b = FC.carteira.precoEm(ibov, ate);
    return a && b ? b / a : null;
  }
  function comparaIndices(fluxos, hoje, ix, ibov) {
    const out = {};
    for (const indice of ["selic", "ibov"]) {
      let v = 0, ok = true;
      for (const f of fluxos) {
        const g = crescimentoIndice(indice, f.data, hoje, ix, ibov);
        if (g == null) { ok = false; break; }
        v += -f.valor * g;
      }
      out[indice] = ok && fluxos.length ? v : null;
    }
    return out;
  }

  FC.rentab = { crescimentoIndice, comparaIndices, preparaIndices, xirr, dietz, anualiza, avaliaTitulo, avaliaAtivo, carteira, serieDiaria, twr,
    lotesDoTitulo, valorTituloEm, rotuloTaxa, PADRAO_TAXA, ciclosDoRebanho };
})();


/* ---- modelo/carteira.js */
/* Junta tudo: ativos + aportes + mercado + agro → o retrato da carteira.
 * É o equivalente do antigo coleta(); as telas só leem o resultado. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  // ---------------------------------------------------------------- aportes
  // compras e vendas de cada ticker em ordem de data; a venda entra no
  // preço médio pelo custo das cotas que saíram, não pelo preço da venda
  function consolidadoPorTicker(aportes) {
    const fora = {};
    for (const a of aportes) {
      if (a.tipo !== "ativo" || !a.ticker) continue;
      const d = (fora[a.ticker] = fora[a.ticker] || { quantidade: 0, n: 0, eventos: [] });
      d.quantidade += a.quantidade;
      d.n += 1;
      d.eventos.push({ data: a.data || "", q: Number(a.quantidade) || 0, preco: a.preco });
    }
    for (const d of Object.values(fora)) d.eventos.sort((a, b) => a.data.localeCompare(b.data) || (a.q < 0) - (b.q < 0));
    return fora;
  }
  // aportes em caixa que somam ao saldo (os de extrato já estão no saldo)
  function consolidadoPorTitulo(aportes) {
    const fora = {};
    for (const a of aportes) {
      if (a.tipo === "caixa" && !a.historico && !a.origem) fora[a.titulo] = (fora[a.titulo] || 0) + a.valor;
    }
    return fora;
  }
  function tickersImportados(aportes) {
    return new Set(aportes.filter((a) => a.tipo === "ativo" && a.origem).map((a) => a.ticker));
  }

  // ---------------------------------------------------------------- posição
  // O preço médio só é calculado sobre a parte cujo custo se conhece.
  // Posição base primeiro, depois compras e vendas na ordem: a venda tira
  // a mesma fração da quantidade e do custo (o preço médio não muda).
  function posicao(item, preco, reg) {
    const qBase = Number(item.quantidade) || 0;
    const pmBase = item.preco_medio;
    const qAp = reg ? reg.quantidade : 0;
    const q = qBase + qAp;
    if (!(q > 1e-9 && preco)) return null;
    let qt = qBase, custo = 0, qCusto = 0;
    if (pmBase && qBase) { custo = qBase * pmBase; qCusto = qBase; }
    for (const e of reg ? reg.eventos : []) {
      if (e.q > 0) {
        qt += e.q;
        if (FC.ok(e.preco)) { custo += e.q * e.preco; qCusto += e.q; }
      } else if (e.q < 0 && qt > 1e-12) {
        const fr = Math.min(1, -e.q / qt);
        custo -= custo * fr; qCusto -= qCusto * fr; qt += e.q;
      }
    }
    const atual = q * preco;
    const completo = qCusto >= q - 1e-9;
    const p = {
      quantidade: q, quantidade_base: qBase, quantidade_aportes: qAp, n_aportes: reg ? reg.n : 0,
      atual, custo: null, resultado: null, variacao: null,
      preco_medio: qCusto ? custo / qCusto : null, custo_parcial: !!qCusto && !completo,
    };
    if (completo && custo) { p.custo = custo; p.resultado = atual - custo; p.variacao = (atual / custo - 1) * 100; }
    return p;
  }

  // ---------------------------------------------------------------- alocação
  function alocacao(ativos, rendaFixa, agro, alvos, cxProv) {
    const valor = {}, dentro = {};
    FC.PILARES.forEach((p) => { valor[p.chave] = 0; dentro[p.chave] = []; });
    for (const a of ativos) {
      if (!a.posicao || !(a.pilar in valor)) continue;
      valor[a.pilar] += a.posicao.atual;
      dentro[a.pilar].push({ nome: a.ticker, ticker: a.ticker, tipo: a.tipo_rotulo, valor: a.posicao.atual,
        score: a.score, cor: a.cor, veredito: a.veredito_curto, quantidade: a.posicao.quantidade, variacao: a.posicao.variacao });
    }
    for (const r of rendaFixa) {
      const p = r.pilar || "caixa";
      if (!(p in valor)) continue;
      valor[p] += r.valor_aplicado;
      dentro[p].push({ nome: r.nome, ticker: null, tipo: r.base, valor: r.valor_aplicado, score: null, cor: r.cor, veredito: r.leitura });
    }
    if (agro && agro.valorRebanho > 0) {
      valor.agro += agro.valorRebanho;
      for (const c of agro.porCategoria) {
        dentro.agro.push({ nome: c.nome, ticker: null, tipo: `${FC.fmt.int(c.cabecas)} cabeças`, valor: c.valor, score: null, cor: "terra", veredito: null });
      }
    }
    // dinheiro de vendas reinvestido que ainda espera a próxima compra
    const caixaAgro = agro ? agro.financeiro.caixa_agro || 0 : 0;
    if (caixaAgro > 0.5) {
      valor.agro += caixaAgro;
      dentro.agro.push({ nome: "Caixa do agro", ticker: null, tipo: "reinvestido, à espera da compra", valor: caixaAgro, score: null, cor: "terra", veredito: null });
    }
    // proventos guardados à espera do reinvestimento (FC.caixaProventos)
    if (cxProv && cxProv.ativo && cxProv.saldo > 0.5) {
      valor.caixa += cxProv.saldo;
      dentro.caixa.push({ nome: cxProv.nome, ticker: null, tipo: "proventos à espera do reinvestimento", valor: cxProv.saldo, score: null, cor: "verde", veredito: null });
    }
    const total = Object.values(valor).reduce((a, b) => a + b, 0);
    if (!total) return { linhas: [], total: 0 };
    // pilar com meta 0% fica fora do equilíbrio: as metas dos outros valem
    // sobre o patrimônio sem ele (sem nenhuma meta, vale o patrimônio todo)
    const temMeta = (k) => Number(alvos[k]) > 0;
    const algumaMeta = FC.PILARES.some((p) => temMeta(p.chave));
    const baseMeta = algumaMeta ? FC.PILARES.reduce((s, p) => s + (temMeta(p.chave) ? valor[p.chave] : 0), 0) : total;
    // pilares sem valor e sem meta não aparecem (ex.: agro zerado)
    const linhas = FC.PILARES.filter((p) => valor[p.chave] > 0 || temMeta(p.chave)).map((p) => {
      const alvo = Number(alvos[p.chave]) || 0;
      const fora = algumaMeta && !temMeta(p.chave);
      const pct = (valor[p.chave] / total) * 100;
      const pctMeta = fora ? null : baseMeta ? (valor[p.chave] / baseMeta) * 100 : 0;
      const comp = dentro[p.chave].sort((a, b) => b.valor - a.valor);
      comp.forEach((x) => { x.peso = valor[p.chave] ? (x.valor / valor[p.chave]) * 100 : 0; });
      return { chave: p.chave, nome: p.nome, cor: p.cor, valor: valor[p.chave], pct, pct_meta: pctMeta, alvo_pct: alvo, fora_meta: fora,
        // a meta medida em % do patrimônio todo (para desenhar ao lado de pct)
        alvo_no_patrimonio: fora ? 0 : (alvo * baseMeta) / total,
        desvio_pct: fora ? 0 : pctMeta - alvo, desvio_reais: fora ? 0 : (baseMeta * alvo) / 100 - valor[p.chave], composicao: comp };
    }).sort((a, b) => a.fora_meta - b.fora_meta);
    return { linhas, total, base_meta: baseMeta };
  }

  // ---------------------------------------------------------------- proventos
  function proventosPorMes(lista) {
    const vazio = { meses: [], total: 0, media: 0, media_recente: 0, ultimo: 0, n_meses: 0 };
    const porMes = {};
    for (const p of lista) {
      const mes = (p.data || "").slice(0, 7);
      if (mes.length !== 7) continue;
      const d = (porMes[mes] = porMes[mes] || {});
      const t = p.ticker || "—";
      d[t] = (d[t] || 0) + (p.valor || 0);
    }
    const chaves = Object.keys(porMes).sort();
    if (!chaves.length) return vazio;
    const meses = [];
    let atual = chaves[0];
    const fim = chaves.at(-1);
    while (atual <= fim) {
      const itens = Object.entries(porMes[atual] || {}).sort((a, b) => b[1] - a[1]);
      meses.push({ mes: atual, total: itens.reduce((s, [, v]) => s + v, 0), itens });
      const [a, m] = atual.split("-").map(Number);
      atual = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    }
    const total = meses.reduce((s, m) => s + m.total, 0);
    const ult = meses.slice(-3);
    return { meses, total, media: total / meses.length, media_recente: ult.reduce((s, m) => s + m.total, 0) / ult.length,
      ultimo: meses.at(-1).total, n_meses: meses.length };
  }

  // ---------------------------------------------------------------- preço numa data
  // o fechamento do dia (ou o anterior mais próximo) numa série [[data, preço]]
  function precoEm(serie, dia) {
    let lo = 0, hi = serie.length - 1, r = null;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (serie[m][0] <= dia) { r = serie[m][1]; lo = m + 1; } else hi = m - 1;
    }
    return r;
  }

  // ---------------------------------------------------------------- coleta
  function monta(base, mercado, prefs) {
    const { universo, historicos } = mercado;
    const spot = mercado.spot || {};
    const regras = prefs.regras;
    const aportes = base.aportes;
    const registrados = consolidadoPorTicker(aportes);
    const caixaExtra = consolidadoPorTitulo(aportes);
    const importados = tickersImportados(aportes);

    const ativos = base.ativos.map((item) => {
      let r;
      try {
        r = universo ? FC.avaliador.avalia(item.ticker, item.classe, universo, historicos || {}, regras, spot[item.ticker])
                     : { ticker: item.ticker, classe: item.classe, erro: "carregando dados de mercado…" };
      } catch (e) {
        console.error(e);
        r = { ticker: item.ticker, classe: item.classe, erro: String(e.message || e) };
      }
      // o preço de agora (CoinGecko/Yahoo) vale mais que o do fechamento
      const agora = spot[item.ticker];
      if (!r.erro && agora && FC.ok(agora.preco)) {
        r.preco = agora.preco; r.variacao_dia = agora.variacao_dia; r.fonte_preco = agora.fonte; r.preco_quando = agora.quando;
      }
      const reg = registrados[item.ticker];
      // extrato importado traz a posição inteira: a base não se soma
      const it = importados.has(item.ticker) ? { ...item, quantidade: 0, preco_medio: null } : item;
      r.id = item.id;
      r.item = item;
      r.lista = item.lista;
      r.na_carteira = item.lista === "carteira" || !!reg;
      r.pilar = item.pilar;
      r.posicao = r.na_carteira && !r.erro ? posicao(it, r.preco, reg) : null;
      if (!r.tipo_rotulo) r.tipo_rotulo = FC.CLASSE_ROTULO[item.classe] || item.classe;
      return r;
    });

    const macro = (universo && universo.macro) || {};
    // renda fixa: cada aporte rende da sua data pela sua taxa. Daqui para
    // frente "valor_aplicado" é o valor da posição (com rendimento) — é o
    // que entra na alocação, no patrimônio e na projeção.
    const ix = mercado.indices || null;
    const rendaFixa = base.rendaFixa.map((i) => {
      const rent = FC.rentab.avaliaTitulo(i, aportes, ix);
      const extra = caixaExtra[i.nome] || 0;
      const item = { ...i, principal: i.valor_aplicado + extra, valor_aplicado: rent.valor_atual, aportado_aqui: extra, rent };
      return FC.avaliador.avaliaRendaFixa(item, macro);
    });

    const agro = FC.agro.analisa(base.agro, prefs.agro);
    // proventos já pagos: entram na rentabilidade como dinheiro que voltou e,
    // com caixa de proventos ligado, alimentam o saldo dele
    let pagos = [];
    try { if (FC.estado && FC.estado.proventos) pagos = FC.dividendos.analisa({ ativos }, base, FC.estado.proventos).pagamentos; } catch (e) { console.error(e); }
    let cxProv = null;
    try { if (FC.caixaProventos) cxProv = FC.caixaProventos.analisa(base, pagos, prefs.proventos, ix); } catch (e) { console.error(e); }
    const { linhas, total } = alocacao(ativos, rendaFixa, agro, prefs.alocacao_alvo, cxProv);

    const comPos = ativos.filter((a) => a.posicao);
    const comCusto = comPos.filter((a) => a.posicao.custo);
    const investido = FC.soma(comCusto, (a) => a.posicao.custo);
    const atualComCusto = FC.soma(comCusto, (a) => a.posicao.atual);
    const atual = FC.soma(comPos, (a) => a.posicao.atual);
    const cripto = FC.soma(comPos.filter((a) => a.classe === "cripto"), (a) => a.posicao.atual);
    // quanto foi colocado × quanto vale agora, por classe. Posição sem
    // preço médio não entra no resultado (não dá para saber o ganho), mas
    // aparece como "sem custo" para não sumir da conta.
    const porClasse = {};
    for (const [chave, filtro] of [["bolsa", (a) => a.classe !== "cripto"], ["cripto", (a) => a.classe === "cripto"]]) {
      const ps = comPos.filter(filtro);
      if (!ps.length) continue;
      const cc = ps.filter((a) => a.posicao.custo);
      const inv = FC.soma(cc, (a) => a.posicao.custo), atu = FC.soma(cc, (a) => a.posicao.atual);
      porClasse[chave] = { investido: inv, atual_com_custo: atu, atual: FC.soma(ps, (a) => a.posicao.atual),
        resultado: atu - inv, variacao: inv ? (atu / inv - 1) * 100 : null,
        sem_custo: ps.filter((a) => !a.posicao.custo).map((a) => a.ticker), n: ps.length };
    }
    // quanto a carteira andou hoje, pela variação do dia de cada posição;
    // cotas compradas hoje não estavam lá no fechamento de ontem
    const diaHoje = FC.datas.hoje();
    const hojeAbs = FC.soma(comPos.filter((a) => ok(a.variacao_dia)), (a) => {
      const reg = registrados[a.ticker];
      const qHoje = reg ? FC.soma(reg.eventos.filter((e) => e.data === diaHoje && e.q > 0), (e) => e.q) : 0;
      const fr = a.posicao.quantidade > 0 ? Math.max(0, a.posicao.quantidade - qHoje) / a.posicao.quantidade : 0;
      const v = a.posicao.atual * fr;
      return v - v / (1 + a.variacao_dia / 100);
    });
    const rf = FC.soma(rendaFixa, (r) => r.valor_aplicado);
    const cxSaldo = cxProv && cxProv.ativo ? cxProv.saldo : 0;

    const proventos = aportes.filter((a) => a.tipo === "provento").sort((a, b) => b.data.localeCompare(a.data));
    const hist = { proventos, renda_mensal: proventosPorMes(proventos) };

    const dados = {
      ativos, rendaFixa, agro, macro, regras,
      alocacao: linhas, alocacao_alvo: prefs.alocacao_alvo, caixa_proventos: cxProv,
      historico: hist,
      registros: base.historico || [],
      resumo: {
        investido, atual, resultado: atualComCusto - investido,
        // só as posições com preço médio conhecido entram na conta
        variacao: investido ? (atualComCusto / investido - 1) * 100 : null,
        renda_fixa: rf, agro: agro.valorRebanho + (agro.financeiro.caixa_agro || 0), caixa_proventos: cxSaldo,
        patrimonio: total || atual + rf + cxSaldo + agro.valorRebanho + (agro.financeiro.caixa_agro || 0),
        cripto, bolsa: atual - cripto, variacao_hoje: hojeAbs, por_classe: porClasse,
        tem_preco_medio: investido > 0,
      },
      atualizado: universo ? universo.gerado : null,
    };
    // rentabilidade aporte a aporte, consolidada (TIR e retorno no período);
    // proventos já pagos entram como dinheiro que voltou
    try { dados.rentab = FC.rentab.carteira(dados, base, ix, pagos); } catch (e) { console.error(e); dados.rentab = null; }
    return dados;
  }

  FC.carteira = { monta, posicao, consolidadoPorTicker, proventosPorMes, precoEm };
})();


/* ---- modelo/base.js */
/* Do banco ao retrato da carteira, sem interface: preferências com os
 * padrões, o que pedir ao mercado, como juntar o que volta e a montagem.
 *
 * Dois chamadores passam por aqui para calcularem igual:
 *   - o app (src/estado/app.ts), que cuida do que é de tela (cache local,
 *     repintar, relógio de cotações) e usa as peças soltas;
 *   - a Edge Function do MCP (supabase/functions/mcp), que usa `carrega()`
 *     inteiro, uma vez por chamada de ferramenta. */
(function () {
  const FC = window.FC;

  // ---------------------------------------------------------------- preferências
  function montaPrefs(brutas) {
    return {
      alocacao_alvo: { ...FC.PADRAO_ALOCACAO, ...(brutas.alocacao_alvo || {}) },
      premissas: FC.mescla(FC.PADRAO_PREMISSAS, brutas.premissas),
      // objetivos e dados dos títulos moram no mesmo jsonb, mas não são premissas da projeção
      premissas_salvas: !!brutas.premissas && Object.keys(brutas.premissas).some((k) => k !== "objetivos" && k !== "titulos"),
      regras: brutas.regras ? FC.mescla(FC.PADRAO_REGRAS, brutas.regras) : JSON.parse(JSON.stringify(FC.PADRAO_REGRAS)),
      renda: brutas.renda || JSON.parse(JSON.stringify(FC.PADRAO_RENDA)),
      agro: FC.mescla(FC.PADRAO_AGRO, brutas.agro),
      plano: FC.mescla(FC.PADRAO_PLANO, brutas.plano),
      proventos: FC.mescla(FC.PADRAO_PROVENTOS, brutas.proventos),
      layout: brutas.layout || null,
    };
  }

  // ---------------------------------------------------------------- mercado
  // tickers cujo histórico interessa: carteira, watchlist e o que aparece
  // nos aportes (para o gráfico de crescimento do patrimônio)
  function itensDeMercado(base) {
    const m = new Map();
    for (const a of base.ativos) m.set(a.ticker, { ticker: a.ticker, classe: a.classe });
    for (const a of base.aportes) {
      if (a.tipo === "ativo" && a.ticker && !m.has(a.ticker)) m.set(a.ticker, { ticker: a.ticker, classe: "acao_br" });
    }
    return [...m.values()];
  }

  // o raio-x da CVM entra em cada FII do universo (e serve de par para os outros)
  function juntaCvm(universo, cvm) {
    if (!(cvm && cvm.fundos && universo && universo.fiis)) return;
    for (const [t, v] of Object.entries(cvm.fundos)) {
      const f = universo.fiis[t];
      if (!f) continue;
      f.cvm = { ...v, fonte: cvm.fonte };
      f.vacancia_financeira = v.vacancia_financeira ?? null;
      f.concentracao = v.tipo === "papel" ? (v.cri || {}).maior : v.tipo === "fof" ? (v.fii || {}).maior
        : v.tipo === "hibrido" ? v.maior_imovel ?? (v.cri || {}).maior ?? null : v.maior_imovel ?? null;
    }
  }

  // sem a série diária (ou com ela incompleta), a renda fixa rende pela
  // taxa anual do Banco Central em vez de ficar parada no valor aplicado
  function aplicaIndices(mercado, indices) {
    const reserva = (mercado.universo && mercado.universo.macro) || {};
    if (indices || (reserva.cdi != null && !(mercado.indices && mercado.indices.tem))) {
      mercado.indices = FC.rentab.preparaIndices(indices || {}, reserva);
    }
  }

  // ---------------------------------------------------------------- tudo de uma vez
  // Lê as tabelas, busca o mercado (se pedido) e monta `FC.estado.dados`.
  // Não grava nada e não guarda dado de usuário em lugar nenhum além do
  // próprio `FC.estado`. Falha de mercado não derruba a leitura: volta em
  // `erroMercado` e as posições saem sem preço.
  async function carrega({ comMercado = true, comProventos = false } = {}) {
    const estado = (FC.estado = FC.estado || {});
    estado.mercado = estado.mercado || { universo: null, historicos: {}, spot: {} };
    estado.erroMercado = null;
    estado.base = await FC.db.carregaTudo();
    estado.prefs = montaPrefs(estado.base.prefsBrutas);
    estado.prefs.modulos = FC.resolveModulos(estado.base.prefsBrutas.modulos, estado.base);

    if (comMercado) {
      try {
        const anos = estado.prefs.regras.janela_historico_anos || 3;
        const itens = itensDeMercado(estado.base);
        const naCarteira = estado.base.ativos.map((a) => ({ ticker: a.ticker, classe: a.classe }));
        const quieto = (p) => p.catch((e) => { console.error(e); return null; });
        const [universo, historicos, indices, cvm, spot] = await Promise.all([
          FC.mercado.universo(),
          FC.mercado.historicos(itens, anos),
          quieto(FC.mercado.indices()),
          quieto(FC.mercado.fiisCvm()),
          quieto(FC.mercado.cotacoes(naCarteira)),
        ]);
        estado.mercado.universo = universo;
        estado.mercado.historicos = { ...estado.mercado.historicos, ...historicos };
        juntaCvm(universo, cvm);
        aplicaIndices(estado.mercado, indices);
        for (const [t, v] of Object.entries(spot || {})) if (v && !v.erro) estado.mercado.spot[t] = v;
        if (comProventos) {
          const pagam = naCarteira.filter((a) => a.classe !== "cripto");
          estado.proventos = pagam.length ? await quieto(FC.mercado.proventos(pagam)) : {};
        }
      } catch (e) {
        console.error(e);
        estado.erroMercado = e.message || String(e);
      }
    }
    estado.dados = FC.carteira.monta(estado.base, estado.mercado, estado.prefs);
    return estado;
  }

  FC.base = { montaPrefs, itensDeMercado, juntaCvm, aplicaIndices, carrega };
})();


/* ---- modelo/perfil.js */
/* Perfil do investidor: três eixos medidos separadamente.
 *
 *   Tolerância (T, 0 a 100)  o que a pessoa aguenta sentir  → bloco 4
 *   Capacidade (C, 0 a 100)  o que ela pode perder          → blocos 1 e 2
 *   Necessidade (N)          o retorno real que o objetivo exige → bloco 3,
 *                            calculado, nunca perguntado
 *
 * Perfil final = faixa de min(T, C). Sem LLM, sem rede: a mesma resposta
 * dá o mesmo resultado, e a versão do modelo (FC.PERFIL.versao) fica
 * gravada com cada avaliação.
 *
 * Esta regra é espelhada no banco (supabase/schema.sql, função
 * privado.perfil_confere): mexeu aqui, rode scripts/gera-perfil-sql.js. */
(function () {
  const FC = window.FC;
  const P = FC.PERFIL;

  const grampo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pergunta = (id) => P.perguntas.find((q) => q.id === id);
  const opcao = (q, id) => (q.opcoes || []).find((o) => o.id === id) || null;
  const maxDe = (q, campo) => Math.max(0, ...q.opcoes.map((o) => (o[campo] == null ? 0 : o[campo])));

  // a resposta escolhida de uma pergunta de escolha única (null = sem resposta)
  function escolhida(resp, id) {
    const q = pergunta(id);
    const v = resp && resp[id];
    return q && typeof v === "string" ? opcao(q, v) : null;
  }

  // ---------------------------------------------------------------- pendências
  // essenciais que faltam: sem elas o perfil não sai
  function faltantes(resp) {
    return P.perguntas.filter((q) => q.essencial && !(resp || {})[q.id]).map((q) => q.id);
  }
  // as que podem ficar para o checklist
  function opcionaisEmAberto(resp) {
    return P.perguntas.filter((q) => !q.essencial && !(resp || {})[q.id] && q.id !== "produtos").map((q) => q.id);
  }

  // ---------------------------------------------------------------- tolerância
  const itensT = () => P.perguntas.filter((q) => q.opcoes.some((o) => o.t != null));
  function tolerancia(resp) {
    const itens = itensT();
    let pontos = 0, maximo = 0;
    for (const q of itens) {
      maximo += maxDe(q, "t");
      const o = escolhida(resp, q.id);
      if (o && o.t != null) pontos += o.t;
    }
    return maximo ? Math.round((pontos / maximo) * 100) : 0;
  }

  // ---------------------------------------------------------------- consistência
  // cada par "espelho" é a mesma ideia perguntada de dois jeitos
  function espelhos(resp) {
    return P.espelhos.map(([a, b]) => {
      const oa = escolhida(resp, a), ob = escolhida(resp, b);
      if (!oa || !ob) return { a, b, ok: true, degraus: 0 };
      const degraus = Math.abs(oa.t - ob.t);
      return { a, b, degraus, ok: degraus < P.degraus_contradicao };
    });
  }

  // ---------------------------------------------------------------- capacidade
  function pontosDe(resp, id) {
    const q = pergunta(id), max = maxDe(q, "c");
    const o = escolhida(resp, id);
    if (o && o.c != null) return { pontos: o.c, max };
    return { pontos: Math.round(max * P.neutro), max, neutro: true };
  }

  function capacidade(resp, ctx = {}) {
    const itens = ["idade", "estab", "dependentes", "moradia", "patrimonio", "reserva"].map((id) => [id, pontosDe(resp, id)]);
    let pts = itens.reduce((s, [, x]) => s + x.pontos, 0);
    // poupar mais da renda vale mais: 25 pontos a partir de 30% de sobra
    const MAX_SOBRA = 25;
    const rv = escolhida(resp, "renda"), sv = escolhida(resp, "sobra");
    let pontosSobra;
    if (rv && sv && !rv.nd && !sv.nd && rv.v > 0) {
      // aritmética inteira: o banco recalcula igual, sem diferença de arredondamento
      const num = MAX_SOBRA * sv.v * 100, den = rv.v * Math.round(P.taxa_sobra_cheia * 100);
      pontosSobra = sv.v * 100 >= den ? MAX_SOBRA : Math.floor((2 * num + den) / (2 * den));
    } else pontosSobra = Math.round(MAX_SOBRA * P.neutro);
    pts += pontosSobra;

    const descontos = [];
    // o agro vem do sistema, mas fica nas respostas guardadas: o banco recalcula só com elas
    const agro = ctx.agro_pct != null ? ctx.agro_pct : resp.agro_pct;
    if (agro != null && agro > P.agro_alto.limite_pct) {
      pts -= P.agro_alto.desconto;
      descontos.push({ regra: "desconto.agro_alto", pontos: P.agro_alto.desconto });
    }
    let c = Math.round(grampo(pts, 0, 100));

    // tetos: nenhuma resposta compensa
    const tetos = [];
    const reserva = escolhida(resp, "reserva");
    if (resp.divida === "sim") tetos.push({ regra: "teto.divida_cara", limite: P.tetos.divida_cara });
    if (!reserva || reserva.nd || reserva.v < 3) tetos.push({ regra: "teto.reserva_curta", limite: P.tetos.reserva_curta });
    const prazo = escolhida(resp, "prazo");
    if (prazo && prazo.v < 2) tetos.push({ regra: "teto.prazo_curto", limite: P.tetos.prazo_curto });
    if (resp.saque === "provavel") tetos.push({ regra: "teto.saque_provavel", limite: P.tetos.saque_provavel });
    const aplicados = tetos.filter((t) => c > t.limite);
    for (const t of tetos) c = Math.min(c, t.limite);
    return { capacidade: c, pontos_brutos: Math.round(grampo(pts, 0, 100)), tetos, tetos_aplicados: aplicados, descontos, pontos_sobra: pontosSobra };
  }

  // ---------------------------------------------------------------- conhecimento
  // não muda o perfil: limita produtos
  function conhecimento(resp) {
    const t = escolhida(resp, "tempo");
    const q = pergunta("produtos");
    const usados = Array.isArray(resp.produtos) ? resp.produtos : [];
    const rv = q.opcoes.filter((o) => o.rv && usados.includes(o.id)).length;
    if (!t || t.k === 0 || rv === 0) return "nenhum";
    if (t.k >= 3 && rv >= 2) return "experiente";
    return "basico";
  }

  // ---------------------------------------------------------------- faixa e perfil
  function faixaDoScore(score) {
    return P.faixas.find((f) => score >= f.de && score <= f.ate) || P.faixas[0];
  }
  const nomeDoPerfil = (chave) => (P.faixas.find((f) => f.chave === chave) || {}).nome || chave;

  // ---------------------------------------------------------------- cálculo
  // resp: { idade: "31_40", ..., produtos: ["acoes"] }
  // ctx:  { agro_pct } — o que o sistema sabe e a pessoa não responde
  function calcula(resp, ctx = {}) {
    resp = resp || {};
    const T = tolerancia(resp);
    const cap = capacidade(resp, ctx);
    const score = Math.min(T, cap.capacidade);
    const faixa = faixaDoScore(score);
    const esp = espelhos(resp);
    const dinheiroSemResposta = P.perguntas.filter((q) => q.dinheiro && resp[q.id] === "nd").map((q) => q.id);
    const pendentes = faltantes(resp);
    return {
      versao: P.versao,
      tolerancia: T,
      capacidade: cap.capacidade,
      score,
      perfil: faixa.chave,
      faixa,
      limitado_por: T <= cap.capacidade ? "tolerancia" : "capacidade",
      consistencia: esp.every((e) => e.ok) ? "alta" : "baixa",
      espelhos: esp,
      tetos: cap.tetos_aplicados,
      descontos: cap.descontos,
      conhecimento: conhecimento(resp),
      pendentes,
      // "prefiro não dizer" reduz a precisão do plano e o resultado avisa
      precisao: dinheiroSemResposta.length ? "reduzida" : "alta",
      sem_resposta: dinheiroSemResposta,
      detalhe: { pontos_capacidade: cap.pontos_brutos, pontos_sobra: cap.pontos_sobra },
    };
  }

  // ---------------------------------------------------------------- necessidade
  // VF = VP·(1+r)^n + PMT·((1+r)^n − 1)/r, com PMT anual
  function valorFuturo(r, vp, pmtAnual, n) {
    if (Math.abs(r) < 1e-9) return vp + pmtAnual * n;
    const f = Math.pow(1 + r, n);
    return vp * f + pmtAnual * ((f - 1) / r);
  }
  const R_MAX = 1;   // 100% a.a. real: acima disso a meta é impossível

  // retorno real anual que leva de VP ao alvo. 0 = nem precisa de retorno;
  // Infinity = nem com 100% ao ano; null = faltam dados
  function necessidade({ vp, pmtMensal, anos, alvo }) {
    if (!(alvo > 0) || !(anos > 0)) return null;
    vp = Math.max(0, vp || 0);
    const pmt = Math.max(0, pmtMensal || 0) * 12;
    if (valorFuturo(0, vp, pmt, anos) >= alvo) return 0;
    if (valorFuturo(R_MAX, vp, pmt, anos) < alvo) return Infinity;
    let lo = 0, hi = R_MAX;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (valorFuturo(m, vp, pmt, anos) < alvo) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }
  // aporte mensal que fecha a meta com o retorno r
  function aporteNecessario({ vp, anos, alvo, r }) {
    if (!(alvo > 0) || !(anos > 0)) return null;
    const so = valorFuturo(r, Math.max(0, vp || 0), 0, anos);
    if (so >= alvo) return 0;
    const fator = Math.abs(r) < 1e-9 ? anos : (Math.pow(1 + r, anos) - 1) / r;
    return (alvo - so) / fator / 12;
  }
  // anos que a meta leva com o aporte e o retorno r (null: não chega em 80 anos)
  function prazoNecessario({ vp, pmtMensal, alvo, r }) {
    if (!(alvo > 0)) return null;
    const pmt = Math.max(0, pmtMensal || 0) * 12;
    if (valorFuturo(r, Math.max(0, vp || 0), pmt, 80) < alvo) return null;
    let lo = 0, hi = 80;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (valorFuturo(r, Math.max(0, vp || 0), pmt, m) < alvo) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  // ---------------------------------------------------------------- referências
  // retorno real de referência de cada perfil, a partir das premissas que
  // já existem (CDI e IPCA do cenário e prêmio de cada classe)
  function retornoReal(prefs, macro) {
    const ml = ((prefs || {}).premissas || {}).macro_longo_prazo || {};
    const cdi = ml.cdi ?? (macro || {}).cdi ?? null;
    const ipca = ml.ipca ?? (macro || {}).ipca_12m ?? null;
    let real = P.retorno_real_padrao;
    if (cdi != null && ipca != null) real = ((1 + cdi / 100) / (1 + ipca / 100) - 1) * 100;
    return { cdi, ipca, real_rf: real };
  }
  // retorno real anual (fração) de uma alocação { renda_fixa, fiis, acoes, cripto } em %
  function retornoDaAlocacao(aloc, ref) {
    let r = 0;
    for (const [classe, pct] of Object.entries(aloc)) r += (pct / 100) * ((ref.real_rf + (P.premios[classe] || 0)) / 100);
    return r;
  }

  // ---------------------------------------------------------------- revisão
  // 24 meses: obrigatória. 12 meses ou renda informada diferente: sugerida.
  function revisao(registro, { hoje, rendaAtual } = {}) {
    if (!registro) return { estado: "sem_perfil" };
    const agora = hoje || new Date().toISOString().slice(0, 10);
    if (registro.valido_ate && agora > registro.valido_ate) return { estado: "obrigatoria", motivo: "vencido" };
    const criado = (registro.criado_em || "").slice(0, 10);
    if (criado) {
      const dias = Math.round((new Date(agora) - new Date(criado)) / 86400000);
      if (dias >= P.meses_revisao * 30.4) return { estado: "sugerida", motivo: "tempo" };
    }
    const antes = registro.respostas && registro.respostas.renda;
    if (rendaAtual && antes && antes !== "nd" && rendaAtual !== antes) return { estado: "sugerida", motivo: "renda" };
    return { estado: "ok" };
  }

  // ---------------------------------------------------------------- pré-preenchimento
  // o que o sistema já sabe, para a conta antiga só confirmar
  function sugereRespostas(base, dados) {
    const s = {};
    const pat = dados && dados.resumo ? dados.resumo.patrimonio : null;
    const total = pat > 0 ? pat : (((base || {}).historico || []).slice(-1)[0] || {}).patrimonio;
    if (total > 0) {
      const q = pergunta("patrimonio");
      const faixas = [["nada", 0], ["ate_10k", 10000], ["10_50k", 50000], ["50_200k", 200000], ["200k_1m", 1000000], ["1m_mais", Infinity]];
      s.patrimonio = (faixas.find(([, teto]) => total <= teto) || faixas.at(-1))[0];
      if (!opcao(q, s.patrimonio)) delete s.patrimonio;
    }
    const classes = new Set(((base || {}).ativos || []).filter((a) => a.lista === "carteira" || a.quantidade > 0).map((a) => a.classe));
    const usados = [];
    if (classes.has("acao_br") || classes.has("acao_us") || classes.has("etf_br") || classes.has("etf_us")) usados.push("acoes");
    if (classes.has("fii")) usados.push("fii");
    if (classes.has("cripto")) usados.push("cripto");
    if (((base || {}).rendaFixa || []).length) usados.push("renda_fixa");
    if (usados.length) s.produtos = usados;
    return s;
  }

  // ---------------------------------------------------------------- por que este perfil
  // cada resposta com os pontos que deu, por eixo: o Relatório mostra as que mais pesaram
  function contribuicoes(resp) {
    resp = resp || {};
    const itens = [];
    for (const id of ["idade", "estab", "dependentes", "moradia", "patrimonio", "reserva"]) {
      const q = pergunta(id), x = pontosDe(resp, id), o = escolhida(resp, id);
      itens.push({ eixo: "capacidade", id, pergunta: q.texto, resposta: o ? o.rotulo : "Sem resposta", pontos: x.pontos, max: x.max, neutro: !!x.neutro });
    }
    const cap = capacidade(resp);
    const rs = escolhida(resp, "sobra"), rr = escolhida(resp, "renda");
    itens.push({ eixo: "capacidade", id: "sobra", pergunta: "Quanto da renda sobra por mês", max: 25, pontos: cap.pontos_sobra,
      resposta: rs && rr ? `${rs.rotulo}, com renda ${rr.rotulo.toLowerCase()}` : "Sem resposta", neutro: !(rs && rr && !rs.nd && !rr.nd) });
    for (const q of itensT()) {
      const o = escolhida(resp, q.id);
      itens.push({ eixo: "tolerancia", id: q.id, pergunta: q.texto, resposta: o ? o.rotulo : "Sem resposta", pontos: o ? o.t : 0, max: maxDe(q, "t"), neutro: !o });
    }
    return itens;
  }

  // o que mudou entre duas avaliações (para o histórico)
  function diferencas(antes, depois) {
    const ra = (antes && antes.respostas) || {}, rd = (depois && depois.respostas) || {};
    const ids = [...new Set([...Object.keys(ra), ...Object.keys(rd)])].filter((k) => k !== "agro_pct");
    return ids.filter((k) => JSON.stringify(ra[k]) !== JSON.stringify(rd[k])).map((k) => {
      const q = pergunta(k);
      const rot = (v) => (Array.isArray(v) ? v.join(", ") : (q && opcao(q, v) ? opcao(q, v).rotulo : v == null ? "—" : String(v)));
      return { id: k, pergunta: q ? q.texto : k, de: rot(ra[k]), para: rot(rd[k]) };
    });
  }

  FC.perfil = {
    calcula, tolerancia, capacidade, conhecimento, espelhos, faltantes, opcionaisEmAberto,
    necessidade, aporteNecessario, prazoNecessario, valorFuturo, retornoReal, retornoDaAlocacao,
    revisao, sugereRespostas, faixaDoScore, nomeDoPerfil, pergunta, opcao, escolhida, contribuicoes, diferencas,
  };
})();


/* ---- modelo/recomendacao.js */
/* Recomendação do perfil: cascata de três níveis.
 *
 *   1. plano      dívida → reserva → objetivos curtos → longo prazo
 *   2. alocação   faixas por classe, com o ponto dado pelo score bruto
 *   3. candidatos ativos que passam nos quatro filtros do perfil
 *
 * Cada item gerado carrega o id da regra que o produziu (`regra`), para o
 * Relatório explicar o porquê. Classes: renda_fixa, fiis, acoes, cripto;
 * no resto do app elas são os pilares caixa, real_estate, acoes e
 * alternativos (o agro fica fora do alvo: é ilíquido e operacional). */
(function () {
  const FC = window.FC;
  const P = FC.PERFIL;

  const CLASSES = [
    { chave: "renda_fixa", nome: "Renda fixa", pilar: "caixa" },
    { chave: "fiis", nome: "FIIs", pilar: "real_estate" },
    { chave: "acoes", nome: "Ações e ETFs", pilar: "acoes" },
    { chave: "cripto", nome: "Cripto", pilar: "alternativos" },
  ];
  const NOME_CLASSE = Object.fromEntries(CLASSES.map((c) => [c.chave, c.nome]));
  const RISCO = ["fiis", "acoes", "cripto"];
  const grampo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const CLASSE_DO_ATIVO = { acao_br: "acoes", acao_us: "acoes", etf_br: "acoes", etf_us: "acoes", fii: "fiis", cripto: "cripto" };
  // o módulo que liga cada classe de risco (renda fixa e ações BR sempre valem)
  const MODULO_DA_CLASSE = { fiis: "fii", cripto: "cripto" };

  const texto = (regra, params = {}) => String(P.regras[regra] || regra)
    .replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : String(params[k])));
  const regrasDoPerfil = (prefs) => FC.mescla(FC.PADRAO_REGRAS.perfil, (((prefs || {}).regras || {}).perfil) || null);

  // ---------------------------------------------------------------- nível 2
  // posição do score dentro da faixa do perfil: 0 = piso, 1 = teto
  function posicaoNaFaixa(score, faixa) {
    return faixa.ate > faixa.de ? grampo((score - faixa.de) / (faixa.ate - faixa.de), 0, 1) : 0;
  }

  // divide `total` (soma 100) em inteiros pela regra do maior resto
  function inteiros(valores) {
    const chaves = Object.keys(valores);
    const base = Object.fromEntries(chaves.map((k) => [k, Math.floor(valores[k])]));
    let falta = 100 - chaves.reduce((s, k) => s + base[k], 0);
    const ordem = [...chaves].sort((a, b) => (valores[b] - base[b]) - (valores[a] - base[a]));
    for (let i = 0; falta > 0 && i < ordem.length * 2; i++, falta--) base[ordem[i % ordem.length]]++;
    return base;
  }

  // Alvo por classe. Renda fixa recebe o resíduo e a hierarquia
  // renda fixa > ações > cripto vale sempre, qualquer que seja a regra editada.
  function alocacao({ perfil, score, regras, conhecimento, classesOff = [] }) {
    const faixaPerfil = P.faixas.find((f) => f.chave === perfil);
    const pos = posicaoNaFaixa(score, faixaPerfil);
    const f = regras.alocacao[perfil];
    const notas = [{ regra: "alocacao.faixa_perfil", perfil: faixaPerfil.nome, score }];
    const lerp = ([lo, hi]) => lo + pos * (hi - lo);

    // mais risco, menos renda fixa: o orçamento de risco sai da faixa dela
    const rfAlvo = f.renda_fixa[1] - pos * (f.renda_fixa[1] - f.renda_fixa[0]);
    const orcamento = Math.max(0, 100 - rfAlvo);
    const bruto = Object.fromEntries(RISCO.map((c) => [c, lerp(f[c])]));
    const soma = RISCO.reduce((s, c) => s + bruto[c], 0);
    const v = {};
    for (const c of RISCO) {
      let x = soma > 0 ? (bruto[c] / soma) * orcamento : 0;
      x = grampo(x, f[c][0], f[c][1]);
      v[c] = x;
    }
    // teto do conhecimento e módulos desligados
    const teto = P.conhecimento[conhecimento] || P.conhecimento.experiente;
    for (const c of RISCO) {
      if (classesOff.includes(c)) {
        if (v[c] > 0) notas.push({ regra: "alocacao.modulo_desligado", classe: NOME_CLASSE[c] });
        v[c] = 0;
      } else if (v[c] > teto[c]) {
        notas.push({ regra: "alocacao.teto_conhecimento", classe: NOME_CLASSE[c], teto: teto[c] });
        v[c] = teto[c];
      }
    }
    v.renda_fixa = 100 - RISCO.reduce((s, c) => s + v[c], 0);
    let n = inteiros(v);

    // hierarquia, em inteiros
    let mudou = false;
    while (n.renda_fixa <= n.acoes && n.acoes > 0) { n.acoes--; n.renda_fixa++; mudou = true; }
    while (n.acoes <= n.cripto && n.cripto > 0) { n.cripto--; n.renda_fixa++; mudou = true; }
    if (n.renda_fixa <= 0) { const maior = RISCO.slice().sort((a, b) => n[b] - n[a])[0]; n[maior]--; n.renda_fixa++; mudou = true; }
    if (mudou) notas.push({ regra: "alocacao.hierarquia" });
    if (f.cripto[1] > 0 && n.cripto > 0) notas.push({ regra: "alocacao.cripto_perfil", teto: f.cripto[1], perfil: faixaPerfil.nome });

    return {
      classes: n,
      pilares: Object.fromEntries(CLASSES.map((c) => [c.pilar, n[c.chave]]).concat([["agro", 0]])),
      posicao_na_faixa: pos,
      faixas: f,
      notas: notas.map((x) => ({ ...x, texto: texto(x.regra, x) })),
    };
  }

  // renda fixa por indexador: CDI alto puxa para pós-fixado, juro real alto para IPCA+
  function divisaoRendaFixa(macro, retorno) {
    let pos = 50, ipca = 35, pre = 15;
    const cdi = (macro || {}).cdi;
    if (cdi != null && cdi >= 12) { pos += 10; ipca -= 5; pre -= 5; }
    if (retorno && retorno.real_rf >= 6) { ipca += 15; pos -= 10; pre -= 5; }
    pre = Math.max(5, pre);
    const t = pos + ipca + pre;
    const r = inteiros({ pos: (pos / t) * 100, ipca: (ipca / t) * 100, pre: (pre / t) * 100 });
    return [
      { id: "pos", rotulo: "Pós-fixado (CDI ou Selic)", pct: r.pos },
      { id: "ipca", rotulo: "IPCA+ (inflação mais juro)", pct: r.ipca },
      { id: "pre", rotulo: "Prefixado", pct: r.pre },
    ];
  }

  // ---------------------------------------------------------------- nível 1
  function plano({ resp, res, regras, retorno }) {
    const v = (id) => { const o = FC.perfil.escolhida(resp, id); return o && !o.nd ? o.v : null; };
    const renda = v("renda"), sobra = v("sobra");
    const estab = (FC.perfil.escolhida(resp, "estab") || {}).v || "nd";
    const fator = regras.fator_aporte[res.perfil];
    const aporte = sobra != null ? Math.round(sobra * fator) : null;
    const custo = renda != null && sobra != null ? Math.max(0, renda - sobra) : null;
    const passos = [];

    if (resp.divida === "sim") {
      passos.push({ id: "quitar_divida", regra: "plano.divida_cara", titulo: "Quitar a dívida cara",
        resumo: "Direcione a sobra do mês para cartão rotativo ou cheque especial até zerar.",
        valor_mensal: sobra, exclusivo: true, texto: texto("plano.divida_cara") });
      return { passos, aporte_mensal: aporte, fator, custo_mensal: custo, reserva: null, exclusivo: true, estab };
    }

    // 2. reserva de emergência
    const meses = P.reserva_meses[estab] || 6;
    const reservaAtual = (FC.perfil.escolhida(resp, "reserva") || {}).v;
    const atual = reservaAtual == null ? null : reservaAtual;
    const faltaMeses = atual == null ? meses : Math.max(0, meses - atual);
    const faltaValor = custo != null ? faltaMeses * custo : null;
    const mesesParaChegar = faltaValor != null && aporte > 0 ? Math.ceil(faltaValor / aporte) : null;
    const reserva = { meses_alvo: meses, meses_atual: atual, falta_meses: faltaMeses, falta_valor: faltaValor, custo_mensal: custo, meses_para_chegar: mesesParaChegar };
    if (faltaMeses > 0) {
      passos.push({ id: "reserva", regra: meses === 12 ? "plano.reserva_12" : "plano.reserva_6", titulo: "Montar a reserva de emergência",
        resumo: `${meses} meses de custo de vida em renda fixa pós-fixada com liquidez diária.`,
        valor_total: faltaValor, valor_mensal: aporte, meses: mesesParaChegar, texto: texto(meses === 12 ? "plano.reserva_12" : "plano.reserva_6") });
    } else {
      passos.push({ id: "reserva_ok", regra: "plano.reserva_ok", titulo: "Reserva de emergência completa",
        resumo: "Nada a fazer aqui: mantenha o valor atualizado com o custo de vida.", feito: true, texto: texto("plano.reserva_ok") });
    }

    // 3. objetivo de até 2 anos
    const prazo = FC.perfil.escolhida(resp, "prazo");
    const curto = prazo && prazo.v < 2;
    if (curto) {
      passos.push({ id: "objetivo_curto", regra: "plano.objetivo_curto", titulo: "Objetivo de curto prazo em renda fixa",
        resumo: "Título com vencimento casado ao prazo, fora da carteira de risco.", texto: texto("plano.objetivo_curto") });
    }

    // 4. longo prazo, segundo o perfil
    if (!curto || faltaMeses === 0) {
      passos.push({ id: "longo_prazo", regra: "plano.longo_prazo", titulo: "Investir para o longo prazo",
        resumo: `Distribua os aportes pela alocação do perfil ${res.faixa.nome}.`, valor_mensal: aporte, texto: texto("plano.longo_prazo") });
    }
    return { passos, aporte_mensal: aporte, fator, custo_mensal: custo, reserva, exclusivo: false, estab };
  }

  // ---------------------------------------------------------------- necessidade e conflitos
  // alocação do meio das faixas de um perfil, normalizada para 100
  function alocacaoMedia(regras, chave) {
    const f = regras.alocacao[chave];
    const m = Object.fromEntries(Object.keys(f).map((c) => [c, (f[c][0] + f[c][1]) / 2]));
    const t = Object.values(m).reduce((s, x) => s + x, 0) || 1;
    return Object.fromEntries(Object.entries(m).map(([c, x]) => [c, (x / t) * 100]));
  }

  function conflitos({ resp, res, pl, regras, retorno, aloc }) {
    const lista = [];
    const vv = (id) => { const o = FC.perfil.escolhida(resp, id); return o && !o.nd ? o.v : null; };
    const alvoValor = vv("valor_alvo"), anos = vv("prazo"), vp = vv("patrimonio") || 0;
    const pmt = pl.aporte_mensal || 0;
    let necessidade = null;
    if (alvoValor && anos && resp.objetivo !== "reserva") {
      necessidade = FC.perfil.necessidade({ vp, pmtMensal: pmt, anos, alvo: alvoValor });
    }
    const referencia = FC.perfil.retornoDaAlocacao(aloc.classes, retorno);

    if (necessidade != null) {
      if (necessidade === Infinity || necessidade > referencia + 0.005) {
        const r = referencia;
        lista.push({ id: "meta_acima_perfil", regra: "conflito.meta_acima_perfil", nivel: "alto",
          titulo: "Sua meta pede mais risco do que cabe no seu perfil",
          texto: texto("conflito.meta_acima_perfil"),
          necessidade, referencia: r,
          saidas: {
            aporte_necessario: FC.perfil.aporteNecessario({ vp, anos, alvo: alvoValor, r }),
            prazo_necessario: FC.perfil.prazoNecessario({ vp, pmtMensal: pmt, alvo: alvoValor, r }),
            meta_possivel: FC.perfil.valorFuturo(r, vp, pmt * 12, anos),
          } });
      } else if (necessidade < referencia - 0.02) {
        // o perfil mais conservador cuja referência ainda bate a meta
        const menor = P.faixas.find((f) => FC.perfil.retornoDaAlocacao(alocacaoMedia(regras, f.chave), retorno) >= necessidade);
        if (menor && menor.chave !== res.perfil) {
          lista.push({ id: "meta_folgada", regra: "conflito.meta_folgada", nivel: "info",
            titulo: "Dá para chegar lá com menos risco",
            texto: texto("conflito.meta_folgada") + ` Uma alocação ${menor.nome.toLowerCase()} já entrega o retorno que a meta exige.`,
            necessidade, referencia, sugerido: menor.chave });
        }
      }
    }
    if (res.tolerancia >= 65 && res.capacidade <= 34 && res.limitado_por === "capacidade") {
      lista.push({ id: "tolerancia_acima_capacidade", regra: "conflito.tolerancia_acima_capacidade", nivel: "medio",
        titulo: "O limite é a sua situação, não a sua coragem",
        texto: texto("conflito.tolerancia_acima_capacidade") + " Reserva em dia e dívidas quitadas aumentam a capacidade." });
    }
    if (res.consistencia === "baixa") {
      lista.push({ id: "baixa_consistencia", regra: "conflito.baixa_consistencia", nivel: "medio",
        titulo: "Baixa consistência nas respostas", texto: texto("conflito.baixa_consistencia") + " Vale refazer em 30 dias." });
    }
    return { lista, necessidade, referencia };
  }

  // comportamento revelado: a carteira real contra o perfil declarado
  function comportamento({ res, regras, dados, base }) {
    const alertas = [];
    if (!dados) return alertas;
    const rf = dados.resumo.renda_fixa || 0, rv = (dados.resumo.bolsa || 0) + (dados.resumo.cripto || 0);
    const total = rf + rv;
    if (total > 0) {
      const pctRv = (rv / total) * 100;
      const maxRv = 100 - regras.alocacao[res.perfil].renda_fixa[0];
      if (pctRv > maxRv + 10) {
        alertas.push({ id: "carteira_acima_perfil", regra: "conflito.carteira_acima_perfil", nivel: "medio",
          titulo: "Sua carteira é mais arriscada que o seu perfil",
          texto: `${Math.round(pctRv)}% em renda variável e cripto; o perfil ${res.faixa.nome} vai até ${Math.round(maxRv)}%.` });
      }
    }
    // vendas com o preço 20% abaixo da máxima dos 12 meses anteriores
    const hoje = FC.datas ? FC.datas.hoje() : new Date().toISOString().slice(0, 10);
    const limite = new Date(new Date(hoje).getTime() - 365 * 86400000).toISOString().slice(0, 10);
    const hist = (FC.estado && FC.estado.mercado && FC.estado.mercado.historicos) || {};
    let emQueda = 0;
    for (const a of (base && base.aportes) || []) {
      if (a.tipo !== "ativo" || !a.venda || !a.ticker || a.data < limite) continue;
      const s = (hist[a.ticker] || {}).precos;
      if (!s || !s.length) continue;
      const antes = s.filter(([d]) => d <= a.data).slice(-252);
      if (antes.length < 20) continue;
      const maxima = Math.max(...antes.map(([, p]) => p));
      const preco = a.preco || antes.at(-1)[1];
      if (preco && preco <= maxima * 0.8) emQueda++;
    }
    if (emQueda >= 1) {
      alertas.push({ id: "vendas_em_queda", regra: "conflito.vendas_em_queda", nivel: "medio",
        titulo: "Vendas em quedas fortes",
        texto: `${emQueda} venda${emQueda > 1 ? "s" : ""} nos últimos 12 meses com o preço 20% ou mais abaixo da máxima do período. Isso contradiz a tolerância declarada.` });
    }
    return alertas;
  }

  // ---------------------------------------------------------------- nível 3
  const valorMetrica = (a, chave) => { const m = (a.metricas || []).find((x) => x.chave === chave); return m && m.valor != null ? m.valor : null; };

  function motivoDe(a) {
    const partes = (a.destaques || []).filter((m) => m.valor != null).slice(0, 3).map((m) => {
      const v = FC.fmt && FC.fmt.metrica ? FC.fmt.metrica(m.valor, m.unidade) : String(m.valor);
      return `${m.rotulo_curto || m.rotulo} ${v}`;
    });
    return partes.length ? partes.join(" · ") : "nota geral das quatro lentes";
  }
  function alertaDe(a) {
    if (a.conflitos && a.conflitos.length) return `As lentes divergem em ${a.conflitos[0].rotulo_curto || a.conflitos[0].rotulo}`;
    if (a.avisos && a.avisos.length) return a.avisos[0];
    const pior = (a.metricas || []).filter((m) => m.nota != null).sort((x, y) => x.nota - y.nota)[0];
    return pior && pior.nota < 60 ? `${pior.rotulo_curto || pior.rotulo} é o ponto mais fraco (nota ${Math.round(pior.nota)})` : null;
  }

  // universo: carteira, watchlist e as empresas da aba Renda
  function universo({ dados, prefs, mercado }) {
    const itens = [];
    const vistos = new Set();
    for (const a of (dados && dados.ativos) || []) {
      if (a.erro || a.score == null) continue;
      vistos.add(a.ticker);
      itens.push({ ...a, origem: a.na_carteira ? "carteira" : "watchlist" });
    }
    const u = mercado && mercado.universo;
    if (u && FC.avaliador && prefs) {
      const renda = prefs.renda || FC.PADRAO_RENDA;
      for (const bloco of Object.values(renda.setores || {})) {
        for (const ticker of Object.keys(bloco.empresas || {})) {
          if (vistos.has(ticker)) continue;
          vistos.add(ticker);
          try {
            const r = FC.avaliador.avalia(ticker, "acao_br", u, (mercado && mercado.historicos) || {}, prefs.regras, (mercado.spot || {})[ticker]);
            if (!r.erro && r.score != null) itens.push({ ...r, origem: "renda", posicao: null, na_carteira: false });
          } catch (e) { /* ativo fora do universo de mercado */ }
        }
      }
    }
    return itens;
  }

  function candidatos({ itens, res, regras, aloc, classesOff, investido, conhecimento }) {
    const perfil = res.perfil;
    const minimo = regras.score_minimo[perfil], pesoMax = regras.peso_max_ativo[perfil], liqMin = regras.liquidez_minima[perfil];
    const saida = { acoes: [], fiis: [], cripto: [] };
    const descartados = [];

    for (const a of itens) {
      const classe = CLASSE_DO_ATIVO[a.classe];
      if (!classe) continue;
      const motivos = [];
      const individual = a.classe === "acao_br" || a.classe === "acao_us";
      // passo 1: classe permitida pelo perfil e pelo conhecimento
      let estudar = false;
      if (classesOff.includes(classe)) motivos.push(`${NOME_CLASSE[classe]} está desligada em Ajustes → Módulos`);
      else if (aloc.classes[classe] <= 0) {
        if (conhecimento === "nenhum" && (individual || classe === "cripto" || classe === "fiis")) estudar = true;
        else motivos.push(`${NOME_CLASSE[classe]} fica fora da alocação do perfil`);
      } else if (conhecimento === "nenhum" && (individual || classe === "cripto")) estudar = true;
      // passo 2: score mínimo
      if (a.score < minimo) motivos.push(`nota ${Math.round(a.score)} abaixo do mínimo de ${minimo} do perfil`);
      // passo 3: filtros de risco
      const liq = valorMetrica(a, "liquidez");
      if (liq != null && liq < liqMin) motivos.push("liquidez diária abaixo do mínimo do perfil");
      let alertaExtra = null;
      if (classe === "fiis" && perfil === "conservador") {
        if (!["fii_tijolo", "fii_papel"].includes(a.perfil)) motivos.push("tipo de FII fora do que o perfil conservador aceita (só tijolo ou papel)");
        else {
          const conc = valorMetrica(a, "concentracao");
          const lim = a.perfil === "fii_papel" ? 10 : 30;
          if (conc != null && conc > lim) motivos.push(`concentração de ${Math.round(conc)}% acima do limite de ${lim}%`);
          else if (conc == null) alertaExtra = "sem dado de concentração do fundo";
        }
      }
      if (classe === "cripto") {
        const base = String(a.ticker || "").split("-")[0].toUpperCase();
        if (!P.cripto_grandes.includes(base)) motivos.push("fora das criptos de maior capitalização");
      }
      // passo 4: concentração
      const peso = a.posicao && investido > 0 ? (a.posicao.atual / investido) * 100 : 0;
      const tetoPeso = estudar ? Math.min(pesoMax, P.estudar_peso_max) : pesoMax;
      if (peso >= tetoPeso) motivos.push(`já pesa ${peso.toFixed(1).replace(".", ",")}% da carteira, no limite de ${tetoPeso}%`);

      const item = { ticker: a.ticker, nome: a.tipo_rotulo, classe: a.classe, grupo: classe, score: a.score, cor: a.cor,
        veredito: a.veredito_curto, origem: a.origem, na_carteira: !!a.na_carteira, peso_atual: peso, peso_max: tetoPeso,
        estudar, motivo: motivoDe(a), alerta: alertaDe(a) || alertaExtra, regra: "candidato.filtros" };
      if (motivos.length) descartados.push({ ...item, motivos });
      else saida[classe].push(item);
    }
    for (const c of Object.keys(saida)) {
      saida[c].sort((x, y) => y.score - x.score);
      saida[c] = saida[c].slice(0, 5);
    }
    return { por_classe: saida, descartados };
  }

  // ---------------------------------------------------------------- tudo junto
  function gera({ resp, res, prefs, dados, base, mercado, modo = "educativo" }) {
    const regras = regrasDoPerfil(prefs);
    const macro = (dados && dados.macro) || (mercado && mercado.universo && mercado.universo.macro) || {};
    const retorno = FC.perfil.retornoReal(prefs, macro);
    const modulo = (k) => (FC.modulo ? FC.modulo(k) : true);
    const classesOff = RISCO.filter((c) => MODULO_DA_CLASSE[c] && !modulo(MODULO_DA_CLASSE[c]));

    const aloc = alocacao({ perfil: res.perfil, score: res.score, regras, conhecimento: res.conhecimento, classesOff });
    aloc.renda_fixa_divisao = divisaoRendaFixa(macro, retorno);
    const pl = plano({ resp, res, regras, retorno });
    const conf = conflitos({ resp, res, pl, regras, retorno, aloc });
    const comp = comportamento({ res, regras, dados, base });

    const investido = dados && dados.resumo ? (dados.resumo.bolsa || 0) + (dados.resumo.cripto || 0) + (dados.resumo.renda_fixa || 0) : 0;
    const itens = universo({ dados, prefs, mercado });
    const cand = pl.exclusivo ? { por_classe: { acoes: [], fiis: [], cripto: [] }, descartados: [] }
      : candidatos({ itens, res, regras, aloc, classesOff, investido, conhecimento: res.conhecimento });

    const educativo = modo !== "completo";
    return {
      versao: P.versao, modo, perfil: res.perfil, score: res.score,
      plano: pl, alocacao: aloc, candidatos: cand, conflitos: [...conf.lista, ...comp],
      necessidade: conf.necessidade, retorno_referencia: conf.referencia, retorno_real: retorno,
      rotulos: {
        alocacao: educativo ? "Modelo de referência" : "Alocação sugerida",
        candidatos: educativo ? "Ativos que passam nos filtros do seu perfil" : "Ativos candidatos",
        aviso: educativo ? "Ferramenta pessoal com base no questionário que você respondeu. Não é recomendação de investimento." : "Ferramenta pessoal baseada no questionário. Não substitui a análise de um profissional.",
      },
      avisos: [
        ...(res.precisao === "reduzida" ? ["Você escolheu “prefiro não dizer” em alguma pergunta de dinheiro: o plano fica menos preciso."] : []),
        "O resultado vem só das suas respostas ao questionário. Responder outra coisa muda o plano.",
      ],
      // o texto de cada regra usada, para o Relatório
      regras: Object.fromEntries([...pl.passos.map((p) => p.regra), ...aloc.notas.map((n) => n.regra), ...res.tetos.map((t) => t.regra), ...res.descontos.map((d) => d.regra),
        ...conf.lista.map((c) => c.regra), "alocacao.faixa_perfil"].map((id) => [id, P.regras[id]])),
    };
  }

  // ---------------------------------------------------------------- plano contra realidade
  // aporte do mês, distância da alocação-alvo e progresso da reserva
  function planoContraRealidade({ plano: p, alocacaoAlvo, dados, base }) {
    if (!p || !dados) return null;
    const mes = (FC.datas ? FC.datas.hoje() : new Date().toISOString().slice(0, 10)).slice(0, 7);
    const feito = ((base && base.aportes) || []).filter((a) => a.data.slice(0, 7) === mes && !a.venda && a.valor > 0 && (a.tipo === "ativo" || a.tipo === "caixa"))
      .reduce((s, a) => s + a.valor, 0);
    const desvios = (dados.alocacao || []).filter((l) => !l.fora_meta && l.alvo_pct > 0).map((l) => ({ pilar: l.chave, nome: l.nome, atual: l.pct_meta ?? l.pct, alvo: l.alvo_pct, desvio: (l.pct_meta ?? l.pct) - l.alvo_pct }));
    const rf = (dados.resumo || {}).renda_fixa || 0;
    const reserva = p.reserva && p.reserva.custo_mensal > 0 && p.reserva.meses_alvo
      ? { meses_alvo: p.reserva.meses_alvo, meses_atual: Math.min(p.reserva.meses_alvo, rf / p.reserva.custo_mensal) } : null;
    return { mes, aporte_feito: feito, aporte_sugerido: p.aporte_mensal, desvios, reserva };
  }

  // metas gravadas em preferencias.alocacao_alvo
  function metasDoPlano(aloc) {
    return { ...aloc.pilares };
  }

  FC.recomendacao = { CLASSES, gera, alocacao, plano, candidatos, divisaoRendaFixa, planoContraRealidade, metasDoPlano, texto, regrasDoPerfil, inteiros };
})();


/* ---- modelo/renda.js */
/* Análise de renda: lucro recorrente, payout, preço justo pelo DY e
 * dívida. O "preço justo" é só o preço em que o dividendo de hoje
 * renderia o DY alvo — uma conta de três linhas, não um valuation. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  // DL/EBITDA pelos múltiplos: EV/EBIT − P/EBIT = DL/EBIT
  function dividaSobreEbitda(d) {
    const { p_ebit, ev_ebit, ev_ebitda } = d;
    // zero no Fundamentus é "não informado": sem os três, não há conta
    if (![p_ebit, ev_ebit, ev_ebitda].every((v) => ok(v) && v !== 0)) return null;
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
    // 0 digitado é um critério válido; só o vazio cai no padrão
    const num = (v, padrao) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : padrao);
    const payoutMax = num(criterios.payout_maximo, 100);
    const dlMax = num(criterios.dl_ebitda_maximo, 3);
    const liqMin = num(criterios.liquidez_minima, 0) * 1e6;
    const dyFixo = num(criterios.dy_desejado, 6) || 6;
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
          // banco e seguradora: Graham não se aplica (o setor da Renda decide)
          graham: FC.graham(cot, d.pl, d.pvp, { ticker, setor, subsetor: d.subsetor || d.setor }),
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
      // dividendo acima do lucro (payout > 100% ou lucro ≤ 0) não se repete:
      // o preço justo calculado com ele não é confiável e o teste fica de fora
      l.justo_nao_confiavel = justo != null && (!(l.pl > 0) || (l.payout != null && l.payout > 100))
        ? "dividendo maior que o lucro — não se sustenta" : null;
      l.testes = {
        payout: l.payout == null ? null : l.payout <= payoutMax,
        preco: justo == null || l.justo_nao_confiavel ? null : l.cotacao <= justo,
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
    // proventos do mesmo dia somam; os de dia sem pregão entram no pregão seguinte
    const divs = (h.dividendos || []).slice().sort((a, b) => a[0].localeCompare(b[0]));
    let cotas = 1, k = 0;
    return normaliza(p.map(([d, preco]) => {
      let v = 0;
      while (k < divs.length && divs[k][0] <= d) v += Number(divs[k++][1]) || 0;
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


/* ---- modelo/projecao.js */
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


/* ---- modelo/importador.js */
/* Importação de extratos (CSV ou ZIP, com ou sem senha).
 *
 * Detecta o layout pelo cabeçalho: C6, nota de corretora ou PicPay.
 * Nada é importado duas vezes: cada lançamento vira uma origem única, e
 * a tabela recusa repetidas (unique user_id + origem). */
(function () {
  const FC = window.FC;
  const ZIPJS = "https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.52/dist/zip.min.js";

  function num(txt) {
    if (txt == null) return null;
    let s = String(txt).trim().replace(/[−–]/g, "-").replace(/R\$/g, "").replace(/[\s ]/g, "");
    const neg = s.startsWith("-") || s.startsWith("(");
    s = s.replace(/[^\d,.]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");   // "1.000" = mil
    const v = Number(s);
    return Number.isFinite(v) ? (neg ? -v : v) : null;
  }

  function data(txt) {
    const t = String(txt || "").trim();
    let m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(t);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t);
    if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return null;
  }

  // ---------------------------------------------------------------- leitura
  async function textoDoArquivo(arquivo, senha) {
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    let bruto = buf;
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      await FC.carregaScript(ZIPJS);
      const leitor = new window.zip.ZipReader(new window.zip.Uint8ArrayReader(buf), senha ? { password: senha } : {});
      const entradas = await leitor.getEntries();
      const e = entradas.find((x) => /\.(csv|txt)$/i.test(x.filename));
      if (!e) throw new Error("o ZIP não contém nenhum CSV");
      if (e.encrypted && !senha) throw new Error("o arquivo está protegido — informe a senha do ZIP");
      try {
        bruto = await e.getData(new window.zip.Uint8ArrayWriter(), senha ? { password: senha } : {});
      } catch (err) {
        if (/password/i.test(String(err))) throw new Error("senha incorreta para este arquivo");
        throw err;
      }
      await leitor.close();
    }
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bruto).replace(/^﻿/, ""); }
    catch (e) { return new TextDecoder("iso-8859-1").decode(bruto); }
  }

  function separador(amostra) {
    const conta = (c) => (amostra.match(new RegExp("\\" + c, "g")) || []).length;
    const cands = [";", ",", "\t"].map((c) => [c, conta(c)]).sort((a, b) => b[1] - a[1]);
    return cands[0][1] ? cands[0][0] : ",";
  }

  // CSV com aspas, quebra de linha dentro de campo e separador detectado
  function csv(texto) {
    const sep = separador(texto.slice(0, 4000).split("\n").slice(0, 5).join("\n"));
    const linhas = [];
    let campo = "", linha = [], aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); campo = "";
        if (linha.some((x) => x.trim())) linhas.push(linha);
        linha = [];
      } else campo += c;
    }
    linha.push(campo);
    if (linha.some((x) => x.trim())) linhas.push(linha);
    if (!linhas.length) return [];
    const cab = linhas[0].map((c) => c.trim());
    return linhas.slice(1).map((l) => Object.fromEntries(cab.map((c, i) => [c, (l[i] || "").trim()])));
  }

  function coluna(cabs, ...cands) {
    const limpa = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    const mapa = Object.fromEntries(cabs.map((c) => [limpa(c), c]));
    for (const c of cands) if (mapa[limpa(c)]) return mapa[limpa(c)];
    for (const c of cands) {
      const a = limpa(c);
      for (const [k, orig] of Object.entries(mapa)) if (a && k.includes(a)) return orig;
    }
    return null;
  }

  const origem = (inst, ...partes) => inst + ":" + FC.hash([inst, ...partes].join("|")).slice(0, 14);

  function contador() {
    const vistos = {};
    return (...partes) => { const k = partes.join("|"); vistos[k] = (vistos[k] || 0) + 1; return vistos[k]; };
  }

  // ---------------------------------------------------------------- PicPay
  function lePicpay(linhas, tituloCaixa) {
    if (!linhas.length) return [];
    const cols = Object.keys(linhas[0]);
    const cD = coluna(cols, "data"), cT = coluna(cols, "tipo"), cO = coluna(cols, "origem / destino", "origem", "destino", "descricao");
    const cV = coluna(cols, "valor"), cH = coluna(cols, "hora");
    if (!(cD && cT && cV)) return [];
    const vez = contador();
    const saida = [];
    for (const r of linhas) {
      const tipo = (r[cT] || "").toLowerCase();
      const desc = r[cO] || "";
      if (!/cofrinho/i.test(desc)) continue;
      const d = data(r[cD]), v = num(r[cV]);
      if (!d || v == null) continue;
      const guardou = tipo.includes("guardad");
      const hora = cH ? r[cH] || "" : "";
      const n = vez(d, v, desc, tipo, hora);
      saida.push({ tipo: "caixa", titulo: tituloCaixa, valor: guardou ? Math.abs(v) : -Math.abs(v), data: d,
        observacao: `PicPay · ${desc.replace(/^(No|Do) cofrinho\s*/i, "").trim()}${guardou ? "" : " (resgate)"}`.slice(0, 120),
        origem: origem("picpay", d, v, desc, tipo, hora, n) });
    }
    return saida;
  }

  // ---------------------------------------------------------------- corretora
  const COMPRA = ["compra", "c", "credito", "aquisicao"];
  const VENDA = ["venda", "v", "debito", "alienacao"];
  // a palavra inteira (ou "compra à vista" etc.): "cancelamento" e
  // "credito jcp" não são compra
  const eMov = (mov, lista) => lista.some((x) => mov === x || (x.length > 1 && x !== "credito" && x !== "debito" && mov.startsWith(x + " ")));
  function leCorretora(linhas) {
    if (!linhas.length) return [];
    const cols = Object.keys(linhas[0]);
    const cD = coluna(cols, "data do negocio", "data negocio", "data", "data da operacao");
    const cK = coluna(cols, "codigo de negociacao", "codigo", "ticker", "ativo", "papel");
    const cQ = coluna(cols, "quantidade", "qtd", "qtde");
    const cP = coluna(cols, "preco", "preco unitario", "valor unitario", "preco medio");
    const cT = coluna(cols, "tipo de movimentacao", "tipo", "operacao", "c/v", "compra/venda", "entrada/saida");
    const cV = coluna(cols, "valor da operacao", "valor total", "valor");
    if (!(cD && cK && cQ)) return [];
    const vez = contador();
    const saida = [];
    for (const r of linhas) {
      const d = data(r[cD]);
      const bruto = (r[cK] || "").trim().toUpperCase();
      const ticker = bruto ? bruto.split(/\s+/)[0].replace(/[^A-Z0-9]/g, "") : "";
      let q = num(r[cQ]);
      if (!(d && ticker && q)) continue;
      let preco = cP ? num(r[cP]) : null;
      const total = cV ? num(r[cV]) : null;
      if (!preco && total && q) preco = Math.abs(total) / Math.abs(q);
      if (!preco) continue;
      const mov = cT ? (r[cT] || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : "compra";
      if (eMov(mov, VENDA)) q = -Math.abs(q);
      else if (mov && !eMov(mov, COMPRA)) continue;
      const n = vez(d, ticker, q, preco);
      saida.push({ tipo: "ativo", ticker, quantidade: Math.abs(q), preco: Math.abs(preco), data: d, venda: q < 0,
        observacao: ("importado · " + (mov || "compra")).slice(0, 120), origem: origem("corretora", d, ticker, q, preco, n) });
    }
    return saida;
  }

  // ---------------------------------------------------------------- C6
  // O extrato do C6 traz o valor pago mas não a quantidade: ela sai do
  // valor ÷ preço de fechamento do dia, arredondado (só há cotas inteiras).
  const RE_TICKER = /-\s*([A-Z]{4}\d{1,2})F?(?![A-Z0-9])/;
  function leC6(linhas, resolvePreco) {
    if (!linhas.length) return [];
    const cols = Object.keys(linhas[0]);
    const cD = coluna(cols, "data lancamento", "data lançamento", "data");
    const cT = coluna(cols, "titulo", "título"), cS = coluna(cols, "descricao", "descrição");
    const cE = coluna(cols, "entrada(r$)", "entrada"), cX = coluna(cols, "saida(r$)", "saída(r$)", "saida", "saída");
    if (!(cD && cT && cE && cX)) return [];
    const compras = [], estornos = [], saida = [];
    const vez = contador();
    for (const r of linhas) {
      const tit = (r[cT] || "").trim().toUpperCase();
      const desc = r[cS] || "";
      const d = data(r[cD]);
      if (!d) continue;
      // as colunas já dizem o sentido: sinal no texto não inverte nada
      const ent = Math.abs(num(r[cE]) || 0), sai = Math.abs(num(r[cX]) || 0);
      const m = RE_TICKER.exec(desc);
      if (tit === "COMPRA DE ATIVO B3" && m && sai) compras.push({ data: d, ticker: m[1], valor: sai });
      else if (tit === "ESTORNO COMPRA ATIVO" && m && ent) estornos.push({ data: d, ticker: m[1], valor: ent });
      else if (tit === "CREDITO OPERACAO B3" && ent > 1) estornos.push({ data: d, ticker: null, valor: ent });
      else if (["EMISSAO DE CDB", "APLICACAO DE CDB", "APLICAÇÃO DE CDB"].includes(tit) && sai) {
        saida.push({ tipo: "caixa", titulo: "CDB (C6)", valor: sai, data: d, historico: true,
          observacao: "C6 · " + tit.toLowerCase(), origem: origem("c6cdb", d, sai, tit, vez(d, sai, tit)) });
      } else if (["RENDIMENTOS", "JUROS SOBRE CAPITAL", "DIVIDENDOS"].includes(tit) && ent) {
        const tk = (desc || "").trim().toUpperCase().split(/\s+/)[0].replace(/[^A-Z0-9]/g, "");
        saida.push({ tipo: "provento", ticker: tk, valor: ent, data: d, observacao: ("C6 · " + tit.toLowerCase()).slice(0, 120),
          origem: origem("c6prov", d, tk, ent, tit, vez(d, tk, ent, tit)) });
      }
    }
    for (const e of estornos) {
      const i = compras.findIndex((c) => (e.ticker == null || c.ticker === e.ticker) && c.data === e.data && Math.abs(c.valor - e.valor) < 0.01);
      if (i >= 0) compras.splice(i, 1);
    }
    for (const c of compras) {
      const preco = resolvePreco ? resolvePreco(c.ticker, c.data) : null;
      if (!preco) continue;
      const q = Math.max(1, Math.round(c.valor / preco));
      saida.push({ tipo: "ativo", ticker: c.ticker, quantidade: q, preco: c.valor / q, data: c.data, observacao: "C6 · compra",
        origem: origem("c6", c.data, c.ticker, c.valor, vez(c.data, c.ticker, c.valor)) });
    }
    return saida;
  }

  function pulaPreambulo(texto) {
    const ls = texto.split(/\r?\n/);
    for (let i = 0; i < Math.min(40, ls.length); i++) {
      const l = ls[i].toLowerCase().replace(/\s/g, "");
      if (l.startsWith("datalan") || l.startsWith("data,") || l.startsWith("data;")) return ls.slice(i).join("\n");
    }
    return texto;
  }

  async function le(arquivo, { senha, tituloCaixa, resolvePreco } = {}) {
    const texto = pulaPreambulo(await textoDoArquivo(arquivo, senha));
    const linhas = csv(texto);
    if (!linhas.length) throw new Error("não consegui ler nenhuma linha do arquivo");
    const cols = Object.keys(linhas[0]);
    let itens = leC6(linhas, resolvePreco), formato = "C6";
    if (!itens.length) { itens = leCorretora(linhas); formato = "corretora"; }
    if (!itens.length) { itens = lePicpay(linhas, tituloCaixa || "Cofrinho PicPay"); formato = "PicPay"; }
    if (!itens.length) throw new Error("formato não reconhecido. Colunas: " + cols.slice(0, 10).join(", "));
    return { formato, itens };
  }

  FC.importador = { le, csv };
})();


/* ---- modelo/dividendos.js */
/* Dividendos: quanto a carteira pagou, quanto vai pagar e quando.
 *
 * Tem direito ao provento quem tem a ação no fim da DATA COM. Então o
 * valor de cada pagamento é a quantidade que você tinha naquele dia ×
 * valor por ação. JCP tem 15% de IR retido na fonte: entra líquido.
 *
 * A quantidade de cada dia sai dos aportes. A posição que foi cadastrada
 * sem histórico de compra (a "quantidade inicial") não tem data: ela é
 * considerada só nos últimos 12 meses — o suficiente para a média mensal,
 * sem inventar dividendos de anos em que talvez você nem tivesse a ação. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;
  const IR_JCP = 0.15;
  const COM_DIVIDENDO = new Set(["acao_br", "fii", "etf_br", "acao_us", "etf_us"]);

  function qtdEm(ativo, compras, importado, data, inicioBase) {
    let q = !importado && data >= inicioBase ? Number(ativo.quantidade) || 0 : 0;
    for (const c of compras) { if (c.data > data) break; q += c.quantidade; }
    return q;
  }

  function frequencia(n12) {
    if (n12 >= 10) return "mensal";
    if (n12 >= 5) return "bimestral";
    if (n12 >= 3) return "trimestral";
    if (n12 >= 2) return "semestral";
    if (n12 >= 1) return "anual";
    return "sem pagamento em 12 meses";
  }

  function analisa(dados, base, proventos) {
    const hoje = FC.datas.hoje();
    const ha12 = FC.datas.soma(hoje, -365);
    const inicioBase = ha12;
    const importados = new Set(base.aportes.filter((a) => a.tipo === "ativo" && a.origem).map((a) => a.ticker));
    const lancados = new Set(base.aportes.filter((a) => a.tipo === "provento" && a.origem).map((a) => a.origem));
    // provento que veio do extrato (origem própria) também conta como lançado:
    // mesmo ticker, mesma data de pagamento, mesmo valor (até 5 centavos)
    const manuais = base.aportes.filter((a) => a.tipo === "provento");
    const jaLancado = (origem, ticker, pagamento, valor) => lancados.has(origem)
      || (!!pagamento && manuais.some((m) => m.ticker === ticker && m.data === pagamento && Math.abs(m.valor - valor) <= 0.05));

    const pagamentos = [];
    const porAtivo = [];
    for (const a of dados.ativos) {
      if (!COM_DIVIDENDO.has(a.classe) || a.erro) continue;
      const item = base.ativos.find((x) => x.ticker === a.ticker) || { quantidade: 0 };
      const compras = base.aportes.filter((x) => x.tipo === "ativo" && x.ticker === a.ticker).sort((x, y) => x.data.localeCompare(y.data));
      const qtdHoje = a.posicao ? a.posicao.quantidade : 0;
      if (!qtdHoje && !compras.length) continue;          // só watchlist: não recebe nada
      const p = proventos[a.ticker];
      const lista = (p && p.lista) || [];

      let recebido12 = 0, porAcao12 = 0, brutoPorAcao12 = 0, n12 = 0;
      const datas12 = new Set();
      for (const pr of lista) {
        const futuro = pr.data_com > hoje;
        // a posição inicial só recebe a partir da data dela (sem data: os últimos 12 meses)
        const q = futuro ? qtdHoje : qtdEm(item, compras, importados.has(a.ticker), pr.data_com, item.data_base || inicioBase);
        const liquidoPorAcao = pr.valor * (pr.tipo === "JCP" ? 1 - IR_JCP : 1);
        if (pr.data_com > ha12 && pr.data_com <= hoje) {
          porAcao12 += liquidoPorAcao;
          brutoPorAcao12 += pr.valor;
          datas12.add(pr.data_com);
        }
        if (!(q > 0)) continue;
        const valor = q * liquidoPorAcao;
        const quando = pr.pagamento || pr.data_com;
        const pago = !!pr.pagamento && pr.pagamento <= hoje;
        const origem = `div:${a.ticker}:${pr.data_com}:${pr.tipo}:${pr.valor}`;
        pagamentos.push({
          ticker: a.ticker, tipo: pr.tipo, data_com: pr.data_com, pagamento: pr.pagamento, quando,
          valor_por_acao: pr.valor, liquido_por_acao: liquidoPorAcao, quantidade: q, valor, bruto: q * pr.valor,
          status: pago ? "pago" : futuro ? "anunciado" : pr.pagamento ? "a receber" : "sem data de pagamento",
          estimado_base: !futuro && !compras.some((c) => c.data <= pr.data_com), origem, lancado: jaLancado(origem, a.ticker, pr.pagamento, valor),
        });
        if (pago && pr.pagamento > ha12) recebido12 += valor;
      }
      n12 = datas12.size;
      const preco = a.preco, pm = a.posicao && a.posicao.preco_medio;
      const futuros = pagamentos.filter((x) => x.ticker === a.ticker && x.quando > hoje).sort((x, y) => x.quando.localeCompare(y.quando));
      const passados = pagamentos.filter((x) => x.ticker === a.ticker && x.status === "pago").sort((x, y) => y.quando.localeCompare(x.quando));
      porAtivo.push({
        ticker: a.ticker, classe: a.classe, tipo_rotulo: a.tipo_rotulo, quantidade: qtdHoje, preco, preco_medio: pm,
        fonte: p ? p.fonte : null, erro: p && p.erro, sem_dados: !lista.length,
        por_acao_12m: porAcao12, recebido_12m: recebido12,
        // o que a posição de HOJE renderia por mês, se o próximo ano repetir o último
        mensal_estimado: (qtdHoje * porAcao12) / 12,
        // DY bruto (JCP antes do IR), como no resto do app
        dy_12m: preco ? (brutoPorAcao12 / preco) * 100 : null,
        yoc: pm ? (porAcao12 / pm) * 100 : null,
        frequencia: frequencia(n12),
        proximo: futuros[0] || null, ultimo: passados[0] || null,
      });
    }
    porAtivo.sort((x, y) => y.mensal_estimado - x.mensal_estimado);

    // por mês de pagamento: os últimos 12 meses e os meses já anunciados
    const meses = {};
    for (const pg of pagamentos) {
      const m = pg.quando.slice(0, 7);
      const d = (meses[m] = meses[m] || { mes: m, total: 0, itens: {}, futuro: false });
      d.total += pg.valor;
      d.itens[pg.ticker] = (d.itens[pg.ticker] || 0) + pg.valor;
      if (pg.quando > hoje) d.futuro = true;
    }
    const inicioMes = ha12.slice(0, 7);
    const ultimoMes = Object.keys(meses).sort().at(-1) || hoje.slice(0, 7);
    const serie = [];
    for (let m = inicioMes; m <= ultimoMes;) {
      const d = meses[m] || { mes: m, total: 0, itens: {}, futuro: m > hoje.slice(0, 7) };
      serie.push({ ...d, itens: Object.entries(d.itens).sort((a, b) => b[1] - a[1]) });
      const [a, mm] = m.split("-").map(Number);
      m = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, "0")}`;
    }

    const proximos = pagamentos.filter((x) => x.status !== "pago").filter((x) => x.quando >= hoje || x.status === "anunciado" || x.status === "sem data de pagamento" && x.data_com > FC.datas.soma(hoje, -60))
      .sort((x, y) => x.quando.localeCompare(y.quando));
    const recebidos = pagamentos.filter((x) => x.status === "pago").sort((x, y) => y.quando.localeCompare(x.quando));
    const em30 = FC.soma(proximos.filter((x) => x.pagamento && x.pagamento <= FC.datas.soma(hoje, 30)), (x) => x.valor);
    const noAno = FC.soma(recebidos.filter((x) => x.quando.slice(0, 4) === hoje.slice(0, 4)), (x) => x.valor);
    const recebido12 = FC.soma(recebidos.filter((x) => x.quando > ha12), (x) => x.valor);
    const mensal = FC.soma(porAtivo, (x) => x.mensal_estimado);
    const valorPosicoes = FC.soma(porAtivo, (x) => (x.preco || 0) * x.quantidade);

    return {
      porAtivo, pagamentos, proximos, recebidos, serie,
      resumo: { mensal_estimado: mensal, recebido_12m: recebido12, no_ano: noAno, proximos_30d: em30,
        dy_carteira: valorPosicoes ? ((mensal * 12) / valorPosicoes) * 100 : null,
        n_pagadores: porAtivo.filter((x) => x.por_acao_12m > 0).length, n_ativos: porAtivo.length },
    };
  }

  // ---------------------------------------------------------------- análise de pagadora
  // Para um ativo qualquer (não precisa estar na carteira): com que
  // frequência paga, em que meses, quanto do preço devolve por ano, há
  // quantos anos paga sem falhar, se o dividendo cresce e se cabe no lucro.
  const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function analisaPagadora({ ticker, classe, lista, preco, fund }) {
    const hoje = FC.datas.hoje();
    const anoAtual = Number(hoje.slice(0, 4));
    const ha12 = FC.datas.soma(hoje, -365);
    const provs = (lista || []).filter((p) => p.data_com <= hoje);
    const ult12 = provs.filter((p) => p.data_com > ha12);
    const soma12 = FC.soma(ult12, (p) => p.valor);
    const eventos12 = new Set(ult12.map((p) => p.data_com)).size;

    // por ano (pela data com), nos 5 anos fechados
    const anos = [];
    for (let a = anoAtual - 5; a <= anoAtual - 1; a++) {
      const doAno = provs.filter((p) => p.data_com.startsWith(String(a)));
      anos.push({ ano: a, valor: FC.soma(doAno, (p) => p.valor), eventos: new Set(doAno.map((p) => p.data_com)).size });
    }
    const anosComPagamento = anos.filter((x) => x.valor > 0).length;
    const valoresAnos = anos.map((x) => x.valor).filter((v) => v > 0);
    const mediaAnual = valoresAnos.length ? FC.soma(valoresAnos, (v) => v) / anos.length : 0;
    // estabilidade: quanto os anos variam entre si (1 = sempre o mesmo valor)
    let estabilidade = null;
    if (valoresAnos.length >= 3) {
      const m = valoresAnos.reduce((a, b) => a + b, 0) / valoresAnos.length;
      const dp = Math.sqrt(valoresAnos.reduce((s, v) => s + (v - m) ** 2, 0) / valoresAnos.length);
      estabilidade = Math.max(0, 1 - dp / m);
    }
    // crescimento: 12 meses de hoje contra os 12 meses de 3 anos atrás
    const ini3 = FC.datas.soma(hoje, -4 * 365), fim3 = FC.datas.soma(hoje, -3 * 365);
    const soma3 = FC.soma(provs.filter((p) => p.data_com > ini3 && p.data_com <= fim3), (p) => p.valor);
    const crescimento = soma3 > 0 && soma12 > 0 ? (Math.pow(soma12 / soma3, 1 / 3) - 1) * 100 : null;

    // meses em que costuma pagar (pela data de pagamento, 3 últimos anos)
    const meses = Array(12).fill(0);
    const ha3 = FC.datas.soma(hoje, -3 * 365);
    for (const p of provs.filter((x) => x.data_com > ha3)) {
      const d = p.pagamento || p.data_com;
      meses[Number(d.slice(5, 7)) - 1]++;
    }
    const mesesQuePaga = meses.map((n, i) => (n >= 2 ? NOMES_MES[i] : null)).filter(Boolean);

    const frequencia = eventos12 >= 10 ? "mensal" : eventos12 >= 5 ? "bimestral" : eventos12 >= 3 ? "trimestral"
      : eventos12 >= 2 ? "semestral" : eventos12 >= 1 ? "anual" : "não pagou em 12 meses";
    // quem paga mais de uma vez no mês (JCP mensal + extras) paga "todo mês"
    const intervaloMeses = eventos12 ? Math.max(1, 12 / eventos12) : null;
    const dy12 = preco ? (soma12 / preco) * 100 : null;
    const dyMedio5 = preco ? (mediaAnual / preco) * 100 : null;
    const pctJcp = soma12 ? (FC.soma(ult12.filter((p) => p.tipo === "JCP"), (p) => p.valor) / soma12) * 100 : 0;
    const payout = fund && ok(fund.dy) && ok(fund.pl) && fund.pl > 0 ? fund.dy * fund.pl : null;
    const proximo = (lista || []).filter((p) => (p.pagamento || p.data_com) > hoje).sort((a, b) => (a.pagamento || a.data_com).localeCompare(b.pagamento || b.data_com))[0] || null;
    const ultimo = [...provs].sort((a, b) => (b.pagamento || b.data_com).localeCompare(a.pagamento || a.data_com))[0] || null;

    // ---- nota de 0 a 100
    const fii = classe === "fii";
    const alvoDy = fii ? 11 : 7;
    const nDy = dy12 == null ? 0 : Math.min(100, (dy12 / alvoDy) * 100);
    const nConsist = (anosComPagamento / 5) * 100;
    const nFreq = { mensal: 100, bimestral: 85, trimestral: 70, semestral: 50, anual: 30 }[frequencia] || 0;
    const nEstab = estabilidade == null ? 40 : estabilidade * 100;
    const nCresc = crescimento == null ? 50 : Math.max(0, Math.min(100, 50 + crescimento * 5));
    const nPayout = payout == null ? 60 : payout <= 80 ? 100 : payout <= 100 ? 70 : payout <= 150 ? 30 : 0;
    const nota = soma12 ? 0.3 * nDy + 0.2 * nConsist + 0.15 * nFreq + 0.15 * nEstab + 0.1 * nCresc + 0.1 * nPayout : 0;
    const classe_div = !soma12 ? ["Não paga", "cinza"] : nota >= 75 ? ["Excelente pagadora", "verde"] : nota >= 55 ? ["Boa pagadora", "azul"]
      : nota >= 40 ? ["Pagadora irregular", "amarelo"] : ["Fraca", "vermelho"];

    const alertas = [];
    if (payout != null && payout > 100) alertas.push(`Payout de ${FC.fmt.num(payout, 0)}%: pagou mais do que lucrou — pode não se repetir.`);
    if (dy12 != null && dy12 > (fii ? 16 : 14)) alertas.push("DY muito acima do normal: pode ser pagamento extraordinário ou preço que caiu por um motivo.");
    if (anosComPagamento < 5 && anosComPagamento > 0) alertas.push(`Pagou em ${anosComPagamento} dos últimos 5 anos.`);
    if (crescimento != null && crescimento < -10) alertas.push("Os proventos vêm caindo nos últimos 3 anos.");
    if (pctJcp > 50) alertas.push(`${FC.fmt.num(pctJcp, 0)}% vem de JCP, que tem 15% de IR na fonte.`);

    return { ticker, classe, preco, soma12, eventos12, frequencia, intervalo_meses: intervaloMeses, dy12, dy_medio5: dyMedio5,
      anos, anos_com_pagamento: anosComPagamento, estabilidade, crescimento, meses, meses_que_paga: mesesQuePaga,
      pct_jcp: pctJcp, payout, proximo, ultimo, por_mes: porMes(lista), nota, classificacao: classe_div[0], cor: classe_div[1], alertas,
      notas: { dy: nDy, consistencia: nConsist, frequencia: nFreq, estabilidade: nEstab, crescimento: nCresc, payout: nPayout } };
  }

  // ---------------------------------------------------------------- por mês
  // Quanto pagou por cota em cada mês, nos últimos `anos` anos (o atual
  // incluso): pela data de pagamento, ou pela data com quando o pagamento
  // ainda não foi definido. Pagamento já anunciado e ainda não feito entra
  // marcado como futuro. Linhas do ano mais novo para o mais velho.
  function porMes(lista, anos = 5) {
    const hoje = FC.datas.hoje();
    const anoAtual = Number(hoje.slice(0, 4));
    const linhas = [];
    for (let a = anoAtual; a > anoAtual - anos; a--) {
      linhas.push({ ano: a, total: 0, meses: Array.from({ length: 12 }, () => ({ valor: 0, futuro: false, eventos: [] })) });
    }
    let max = 0;
    for (const p of lista || []) {
      const d = p.pagamento || p.data_com;
      if (!d || !(p.valor > 0)) continue;
      const linha = linhas.find((l) => l.ano === Number(d.slice(0, 4)));
      if (!linha) continue;
      const m = linha.meses[Number(d.slice(5, 7)) - 1];
      m.valor += p.valor;
      m.eventos.push(p);
      if (d > hoje) m.futuro = true;
      linha.total += p.valor;
      max = Math.max(max, m.valor);
    }
    for (const l of linhas) for (const m of l.meses) m.eventos.sort((a, b) => (a.pagamento || a.data_com).localeCompare(b.pagamento || b.data_com));
    return { anos: linhas, max };
  }

  FC.dividendos = { analisa, analisaPagadora, porMes, COM_DIVIDENDO, IR_JCP, NOMES_MES };
})();


/* ---- modelo/caixa-proventos.js */
/* Caixa de proventos: para onde vão os dividendos até serem reinvestidos.
 *
 * Por padrão ("direto") nada muda: cada provento pago volta ao bolso, como
 * sempre foi. Com destino "caixa", os proventos pagos ficam guardados num
 * lugar escolhido (porquinho/cofrinho do banco, saldo da corretora, conta
 * corrente…), rendendo ou não, até virarem compra. Uma compra pode usar
 * parte desse saldo (aportes.do_provento) e completar com dinheiro do
 * bolso: só o que passa do caixa é dinheiro novo — o mesmo desenho do
 * caixa do agro (FC.agro.caixa).
 *
 * FC.caixaProventos.analisa(base, pagamentos, cfg, ix, hoje) →
 *   { ativo, nome, saldo, saldoEm(d), entradas, saidas, porId, aplicado,
 *     rendimento, meta, falta, pronto, usadoNoMes(mes) }
 */
(function () {
  const FC = (window.FC = window.FC || {});
  const D = () => FC.datas;

  FC.PADRAO_PROVENTOS = {
    destino: "direto",       // "direto" (volta ao bolso) | "caixa" (guarda até reinvestir)
    tipo: "porquinho",       // chave de TIPOS_CAIXA
    nome: "",                // vazio: o nome do tipo
    indexador: "cdi",        // "cdi" | "selic" | "nenhum"
    taxa: 100,               // % do indexador
    meta: 500,               // saldo que dispara o aviso de reinvestir (0: sem aviso)
    inicio: null,            // a partir de quando os proventos vão para o caixa (vazio: todos)
    excecoes: {},            // { TICKER: true }: os proventos desse ativo vão direto
    saldo_informado: null,   // saldo real conferido no banco/corretora…
    saldo_informado_em: null, // …e a data dele
  };

  // pontos de partida da configuração: o nome e o rendimento típico de cada lugar
  const TIPOS = {
    porquinho: { nome: "Porquinho / cofrinho", indexador: "cdi", taxa: 100 },
    corretora: { nome: "Saldo na corretora", indexador: "nenhum", taxa: 0 },
    conta: { nome: "Conta corrente", indexador: "nenhum", taxa: 0 },
    outro: { nome: "Caixa de proventos", indexador: "cdi", taxa: 100 },
  };

  const num = (v) => (v == null || v === "" ? null : Number(v));
  const ativoCfg = (cfg) => !!cfg && cfg.destino === "caixa";
  const nomeDe = (cfg) => (cfg && String(cfg.nome || "").trim()) || (TIPOS[cfg && cfg.tipo] || TIPOS.outro).nome;

  // última análise de cada base (pela lista de aportes), para o Salário saber
  // quanto de uma compra veio do caixa sem refazer a conta
  const cache = new WeakMap();

  function vazio(cfg) {
    return { ativo: false, nome: nomeDe(cfg), saldo: 0, saldoEm: () => 0, entradas: [], saidas: [], porId: {},
      aplicado: 0, rendimento: 0, meta: 0, falta: 0, pronto: false, usadoNoMes: () => 0 };
  }

  // Os proventos que entram no caixa: os pagos calculados pela posição
  // (FC.dividendos.analisa) e os lançados à mão/por extrato que não batem
  // com nenhum deles (ex.: ativo sem dados da fonte). "fluxo" marca os que
  // a rentabilidade já conta como dinheiro que voltou ao bolso.
  function entradasDe(base, pagamentos, cfg) {
    const exc = cfg.excecoes || {};
    const inicio = cfg.inicio || "";
    const vale = (ticker, data) => !!data && data >= inicio && !exc[ticker];
    const pagos = (pagamentos || []).filter((p) => p.status === "pago" && p.valor > 0);
    const out = [];
    for (const p of pagos) {
      const data = p.pagamento || p.data_com;
      if (vale(p.ticker, data)) out.push({ data, ticker: p.ticker, valor: p.valor, origem: p.origem, fluxo: true });
    }
    const origens = new Set(pagos.map((p) => p.origem));
    for (const a of base.aportes) {
      if (a.tipo !== "provento" || !(a.valor > 0)) continue;
      if (a.origem && origens.has(a.origem)) continue;
      if (pagos.some((p) => p.ticker === a.ticker && p.pagamento === a.data && Math.abs(p.valor - a.valor) <= 0.05)) continue;
      if (vale(a.ticker, a.data)) out.push({ data: a.data, ticker: a.ticker, valor: a.valor, origem: a.origem || a.id, fluxo: false });
    }
    return out;
  }

  function analisa(base, pagamentos, cfg, ix, hoje = D().hoje()) {
    if (!ativoCfg(cfg) || !base) { const v = vazio(cfg); if (base) cache.set(base.aportes, v); return v; }
    const indexador = cfg.indexador === "selic" ? "selic" : cfg.indexador === "nenhum" ? null : "cdi";
    const taxa = Number(cfg.taxa) || 0;
    // sem rendimento, o fator é 1: valorTituloEm sem índices
    const ixUsado = indexador && taxa > 0 ? ix : null;
    const lotes = [];
    const informado = num(cfg.saldo_informado);
    if (informado != null && Number.isFinite(informado) && informado >= 0) {
      lotes.manual = { valor: informado, data: cfg.saldo_informado_em || hoje };
    }
    const valorEm = (d) => Math.max(0, FC.rentab.valorTituloEm(lotes, ixUsado, d));

    const entradas = entradasDe(base, pagamentos, cfg);
    const pedidos = base.aportes.filter((a) => !a.historico && (a.tipo === "ativo" || a.tipo === "caixa") && Number(a.do_provento) > 0);
    // no mesmo dia, o provento entra antes da compra que o usa
    const evs = [
      ...entradas.map((e) => ({ data: e.data, ordem: 0, e })),
      ...pedidos.map((a) => ({ data: a.data, ordem: 1, a })),
    ].sort((x, y) => x.data.localeCompare(y.data) || x.ordem - y.ordem || String((x.a || {}).criado_em || "").localeCompare(String((y.a || {}).criado_em || "")));

    const saidas = [], porId = {};
    for (const ev of evs) {
      const lote = { data: ev.data, indexador: indexador || "cdi", taxa };
      if (ev.e) { lotes.push({ ...lote, id: ev.e.origem, origem: "provento", valor: ev.e.valor }); continue; }
      const a = ev.a;
      // não dá para tirar do caixa mais do que ele tem: o resto é dinheiro novo
      const pedido = Math.min(Number(a.do_provento), Math.abs(Number(a.valor) || 0));
      const usado = Math.min(pedido, valorEm(ev.data));
      if (usado > 0) lotes.push({ ...lote, id: a.id, origem: "reinvestimento", valor: -usado });
      const s = { id: a.id, data: a.data, tipo: a.tipo, ticker: a.ticker, titulo: a.titulo, valor: Number(a.valor) || 0, pedido, usado,
        novo: Math.max(0, (Number(a.valor) || 0) - usado) };
      saidas.push(s);
      if (a.id != null) porId[a.id] = s;
    }

    const saldo = valorEm(hoje);
    const aplicado = FC.soma(entradas, (e) => e.valor) - FC.soma(saidas, (s) => s.usado);
    const meta = Number(cfg.meta) || 0;
    const r = {
      ativo: true, nome: nomeDe(cfg), tipo: cfg.tipo, indexador, taxa,
      saldo, saldoEm: valorEm, entradas, saidas, porId, aplicado, rendimento: saldo - aplicado,
      meta, falta: meta > 0 ? Math.max(0, meta - saldo) : 0, pronto: meta > 0 && saldo >= meta - 0.005,
      usadoNoMes: (mes) => FC.soma(saidas.filter((s) => s.data.slice(0, 7) === mes), (s) => s.usado),
    };
    cache.set(base.aportes, r);
    return r;
  }

  // quanto de um aporte saiu do caixa de proventos (0 sem caixa ligado)
  function usado(base, aporte) {
    const r = base && cache.get(base.aportes);
    if (r) return r.ativo && aporte.id != null && r.porId[aporte.id] ? r.porId[aporte.id].usado : 0;
    return 0;
  }

  FC.caixaProventos = { analisa, usado, nome: nomeDe, ativo: ativoCfg, TIPOS };
})();


/* ---- modelo/desempenho.js */
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


/* ---- modelo/impostos.js */
/* Imposto de renda: quanto sobraria se resgatasse tudo hoje, e o rascunho
 * da declaração (DIRPF) de um ano-calendário.
 *
 * É ESTIMATIVA para conferência. O informe de rendimentos da corretora e
 * do banco é o que vale. Regras usadas:
 * - Renda fixa: tabela regressiva por lote (cada aporte conta os próprios
 *   dias) + IOF regressivo nos primeiros 29 dias. LCI, LCA, CRI, CRA,
 *   poupança e debênture incentivada: sem IR.
 * - Bolsa: ganho = venda − custo pelo PREÇO MÉDIO (é o que a Receita
 *   usa; a tela de rentabilidade usa PEPS, que serve para outra coisa).
 *   Ações 15% (isentas se as vendas do mês somam até R$ 20 mil), ETF 15%,
 *   FII 20%, exterior 15% (Lei 14.754/2023), cripto 15% acima de R$ 35 mil
 *   vendidos no mês.
 * - Bens e Direitos pelo CUSTO DE AQUISIÇÃO, nunca pelo valor de mercado. */
(function () {
  const FC = window.FC;
  const D = () => FC.datas;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---------------------------------------------------------------- tabelas
  // IR regressivo da renda fixa (Lei 11.033/2004)
  function aliquotaRF(dias) {
    const d = num(dias);
    return d <= 180 ? 22.5 : d <= 360 ? 20 : d <= 720 ? 17.5 : 15;
  }
  // IOF regressivo (Decreto 6.306/2007, anexo): % do rendimento que fica
  // com o IOF no resgate no dia n (1 a 29); a partir do 30º, zero
  const IOF = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0];
  function iof(dias) {
    const d = Math.floor(num(dias));
    if (d >= 30) return 0;
    return IOF[Math.max(1, d) - 1] / 100;           // no mesmo dia, como no 1º
  }

  // Códigos da DIRPF (vigentes desde a declaração de 2024; conferir a cada
  // ano no programa da Receita — é só corrigir aqui).
  const CODIGOS = {
    acao_br:   { grupo: "03", codigo: "01", nome: "Ações (inclusive as listadas em bolsa)" },
    acao_us:   { grupo: "03", codigo: "01", nome: "Ações (exterior: informar o país)" },
    fii:       { grupo: "07", codigo: "03", nome: "Fundos de Investimento Imobiliário (FII)" },
    etf_br:    { grupo: "07", codigo: "09", nome: "Fundos de índice (ETF) — conferir código", incerto: true },
    etf_us:    { grupo: "07", codigo: "09", nome: "Fundos de índice no exterior — conferir código", incerto: true },
    bitcoin:   { grupo: "08", codigo: "01", nome: "Criptoativo Bitcoin (BTC)" },
    stable:    { grupo: "08", codigo: "03", nome: "Stablecoins (USDT, USDC…)" },
    cripto:    { grupo: "08", codigo: "02", nome: "Outras criptomoedas (altcoins)" },
    poupanca:  { grupo: "04", codigo: "01", nome: "Depósito em conta poupança" },
    rf:        { grupo: "04", codigo: "02", nome: "Títulos sujeitos à tributação (Tesouro, CDB, RDB, LC, debêntures)" },
    rf_isento: { grupo: "04", codigo: "03", nome: "Títulos isentos (LCI, LCA, CRI, CRA, debênture incentivada)" },
  };
  // Fichas de rendimentos (conferir a cada ano)
  const FICHAS = {
    dividendos: { ficha: "Isentos", codigo: "09", nome: "Lucros e dividendos recebidos" },
    fii:        { ficha: "Isentos", codigo: "99", nome: "Outros — rendimentos de FII (conferir: versões antigas usavam 26)", incerto: true },
    lci:        { ficha: "Isentos", codigo: "12", nome: "Rendimentos de poupança, LCI, LCA, CRI, CRA" },
    jcp:        { ficha: "Exclusiva", codigo: "10", nome: "Juros sobre capital próprio" },
    rf:         { ficha: "Exclusiva", codigo: "06", nome: "Rendimentos de aplicações financeiras" },
    exterior:   { ficha: "Bens e Direitos / aplicações no exterior", codigo: "—", nome: "Dividendos do exterior (15% na declaração, Lei 14.754/2023)" },
  };
  const ALIQ_VENDA = { acao_br: 15, etf_br: 15, fii: 20, acao_us: 15, etf_us: 15, cripto: 15 };
  const ISENCAO_ACOES = 20000, ISENCAO_CRIPTO = 35000;

  // ---------------------------------------------------------------- renda fixa
  const metaDe = (id) => {
    try { return ((FC.estado && FC.estado.prefs && FC.estado.prefs.premissas && FC.estado.prefs.premissas.titulos) || {})[id] || {}; }
    catch (e) { return {}; }
  };
  const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ehPoupanca = (t) => /poupan/.test(sem(t && t.nome));
  // pelo nome: LCI/LCA/CRI/CRA, poupança e "incentivada" são isentos; LIG,
  // CDB, LC, RDB, Tesouro e debênture comum são tributados
  function isentoRF(titulo, meta) {
    if (meta && typeof meta.isento === "boolean") return meta.isento;
    const n = sem(titulo && titulo.nome);
    if (/\blig\b/.test(n)) return false;
    return /\b(lci|lca|cri|cra)\b/.test(n) || /poupan/.test(n) || /incentivad/.test(n);
  }

  // lotes {data, valor, valor_atual, rendimento, dias} do título; sem a
  // análise de rentabilidade, um lote só com o que se sabe
  function lotesHoje(t) {
    if (t && t.rent && Array.isArray(t.rent.lotes) && t.rent.lotes.length) return t.rent.lotes;
    const principal = num(t && (t.principal != null ? t.principal : t.valor_aplicado));
    const atual = num(t && t.valor_aplicado);
    const data = (t && (t.data_inicio || String(t.criado_em || "").slice(0, 10))) || D().hoje();
    return [{ data, valor: principal, valor_atual: atual, rendimento: atual - principal, dias: D().dias(data, D().hoje()) }];
  }

  // Resgates (lotes negativos) saem dos lotes MAIS ANTIGOS, pelo valor de
  // hoje, levando principal e rendimento na mesma proporção — é o que os
  // bancos fazem (PEPS) e é conservador: sobram os lotes novos, que têm a
  // alíquota maior.
  function titulo(t, meta) {
    meta = meta || metaDe(t && t.id);
    const isento = isentoRF(t, meta), poup = ehPoupanca(t);
    const lotes = lotesHoje(t).map((l) => ({ valor: num(l.valor), atual: num(l.valor_atual), dias: num(l.dias), data: l.data }));
    const pos = lotes.filter((l) => l.valor > 0).sort((a, b) => String(a.data).localeCompare(String(b.data)));
    let resgatar = -lotes.filter((l) => l.valor < 0).reduce((s, l) => s + l.atual, 0);
    for (const l of pos) {
      if (resgatar <= 1e-9) break;
      const usa = Math.min(l.atual, resgatar), fr = l.atual > 0 ? usa / l.atual : 1;
      l.valor *= 1 - fr; l.atual -= usa; resgatar -= usa;
    }
    let bruto = 0, ir = 0, vIof = 0, rend = 0;
    for (const l of pos) {
      const g = l.atual - l.valor;
      bruto += l.atual;
      if (g <= 0) continue;
      rend += g;
      const io = poup ? 0 : g * iof(l.dias);
      vIof += io;
      if (!isento) ir += (g - io) * aliquotaRF(l.dias) / 100;
    }
    return { bruto, ir, iof: vIof, liquido: bruto - ir - vIof, isento, rendimento: rend,
      aliquota_media: rend - vIof > 0 && !isento ? (ir / (rend - vIof)) * 100 : 0 };
  }

  // ---------------------------------------------------------------- resumo
  // "Se vendesse e resgatasse tudo hoje": bolsa e cripto pelo ganho sobre o
  // custo, renda fixa pela tabela, agro sem IR aqui. Dentro de um mesmo
  // grupo (ações+ETF BR, FII, exterior, cripto) ganho e perda se compensam
  // como numa venda no mesmo mês; perda que sobra não vira crédito.
  const GRUPO = { acao_br: "comum", etf_br: "comum", fii: "fii", acao_us: "exterior", etf_us: "exterior", cripto: "cripto" };
  function resumo(dados, base, opcoes) {
    opcoes = opcoes || {};
    dados = dados || {};
    const metas = opcoes.titulos || null;
    const por = { bolsa: { bruto: 0, ir: 0, liquido: 0 }, cripto: { bruto: 0, ir: 0, liquido: 0 },
      renda_fixa: { bruto: 0, ir: 0, liquido: 0 }, agro: { bruto: 0, ir: 0, liquido: 0 } };
    const ganhos = { comum: 0, fii: 0, exterior: 0, cripto: 0 };
    const semCusto = [];
    let custoAtivos = 0;
    for (const a of dados.ativos || []) {
      const p = a && a.posicao;
      if (!p || !(num(p.atual) > 0)) continue;
      const g = GRUPO[a.classe] || "comum";
      por[a.classe === "cripto" ? "cripto" : "bolsa"].bruto += num(p.atual);
      if (p.custo == null) { semCusto.push(a.ticker); continue; }
      custoAtivos += num(p.custo);
      ganhos[g] += num(p.atual) - num(p.custo);
    }
    const aliqG = { comum: 15, fii: 20, exterior: 15, cripto: 15 };
    for (const [g, v] of Object.entries(ganhos)) {
      if (v <= 0) continue;
      por[g === "cripto" ? "cripto" : "bolsa"].ir += (v * aliqG[g]) / 100;
    }
    let principalRF = 0, iofTotal = 0;
    const titulos = [];
    for (const t of dados.rendaFixa || []) {
      const meta = metas ? metas[t.id] || {} : metaDe(t.id);
      const r = titulo(t, meta);
      titulos.push({ id: t.id, nome: t.nome, ...r });
      por.renda_fixa.bruto += r.bruto;
      por.renda_fixa.ir += r.ir + r.iof;
      iofTotal += r.iof;
      principalRF += num(t.principal != null ? t.principal : t.valor_aplicado);
    }
    const res = dados.resumo || {};
    por.agro.bruto = num(res.agro);
    for (const c of Object.values(por)) c.liquido = c.bruto - c.ir;

    const bruto = por.bolsa.bruto + por.cripto.bruto + por.renda_fixa.bruto + por.agro.bruto;
    const ir = por.bolsa.ir + por.cripto.ir + por.renda_fixa.ir;
    const tot = dados.rentab && dados.rentab.total;
    const aplicado = tot && FC.ok(tot.aplicado) ? tot.aplicado - num(tot.devolvido) : custoAtivos + principalRF;
    const notas = [
      "Estimativa do que sobraria vendendo e resgatando tudo hoje. Confira com o informe da corretora/banco.",
      "Renda fixa: tabela regressiva por aporte (22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% depois) e IOF nos primeiros 29 dias. LCI, LCA, CRI, CRA, poupança e debênture incentivada sem IR.",
      "Resgates já feitos saem dos aportes mais antigos (como nos bancos): sobram os mais novos, de alíquota maior.",
      "Ações e ETF da B3: 15% sobre o ganho; FII: 20%; exterior: 15%; cripto: 15%. Ganhos e perdas se compensam dentro de cada grupo; perda não vira crédito aqui.",
      "Não aplicada: vendas de ações de até R$ 20 mil no mês são isentas, e de cripto até R$ 35 mil no mês — vendendo aos poucos, o imposto pode ser bem menor.",
      "Agro: atividade rural tem regra própria (livro-caixa, 20% da receita bruta ou resultado) — fica sem IR nesta conta.",
    ];
    if (semCusto.length) notas.push(`Sem preço médio, sem IR estimado: ${semCusto.join(", ")}.`);
    if (iofTotal > 0.005) notas.push(`Inclui ${FC.fmt.brlTexto(iofTotal)} de IOF de aplicações com menos de 30 dias.`);
    return { bruto, ir_estimado: ir, liquido: bruto - ir, aplicado, ganho_bruto: bruto - aplicado, ganho_liquido: bruto - ir - aplicado,
      por_classe: por, titulos, sem_custo: semCusto, notas };
  }

  // ---------------------------------------------------------------- posição numa data
  // eventos do ativo como em FC.rentab: posição inicial na data_base (ou no
  // cadastro), depois compras e vendas. Extrato importado traz a posição
  // inteira: a quantidade inicial não se soma.
  function eventosDoAtivo(item, aportes) {
    const ev = [];
    const importado = aportes.some((a) => a.tipo === "ativo" && a.ticker === item.ticker && a.origem);
    if (!importado && num(item.quantidade) > 0) {
      ev.push({ data: item.data_base || String(item.criado_em || D().hoje()).slice(0, 10), q: num(item.quantidade),
        preco: item.preco_medio != null ? num(item.preco_medio) : null, inicial: true });
    }
    for (const a of aportes) {
      if (a.tipo !== "ativo" || a.ticker !== item.ticker || !a.data) continue;
      ev.push({ data: a.data, q: num(a.quantidade), preco: a.preco != null ? num(a.preco) : null });
    }
    return ev.sort((a, b) => a.data.localeCompare(b.data) || (a.q < 0) - (b.q < 0));
  }
  // percorre os eventos com a regra do preço médio (igual a
  // FC.carteira.posicao): a venda tira a mesma fração de quantidade e custo.
  // aoVender recebe cada venda com o preço médio daquele momento.
  function percorre(ev, ate, aoVender) {
    let q = 0, custo = 0, qCusto = 0;
    for (const e of ev) {
      if (ate && e.data > ate) break;
      if (e.q > 0) {
        q += e.q;
        if (e.preco != null && e.preco > 0) { custo += e.q * e.preco; qCusto += e.q; }
      } else if (e.q < 0 && q > 1e-12) {
        const vend = Math.min(-e.q, q), fr = Math.min(1, vend / q);
        const pm = qCusto > 1e-12 ? custo / qCusto : null;
        if (aoVender) aoVender(e, vend, pm, qCusto >= q - 1e-9);
        custo -= custo * fr; qCusto -= qCusto * fr; q -= vend;
      }
    }
    if (q < 1e-9) { q = 0; custo = 0; qCusto = 0; }
    return { quantidade: q, custo, preco_medio: qCusto > 1e-12 ? custo / qCusto : null, completo: qCusto >= q - 1e-9 };
  }

  // renda fixa: principal até a data; resgate tira a fração do saldo
  // daquele dia (com os índices; sem eles, tira o valor resgatado)
  function principalRFEm(lotes, ix, dia) {
    let p = 0;
    const antes = [];
    for (const l of lotes) {
      if (l.data > dia) break;
      if (l.valor >= 0) { p += l.valor; antes.push(l); continue; }
      const saldo = FC.rentab && FC.rentab.valorTituloEm ? FC.rentab.valorTituloEm(antes, ix, l.data) : p;
      const fr = saldo > 0 ? Math.min(1, -l.valor / saldo) : 1;
      p *= 1 - fr;
      antes.push(l);
    }
    return Math.max(0, p);
  }

  const codigoAtivo = (classe, ticker) => {
    if (classe === "cripto") {
      const t = String(ticker || "").toUpperCase();
      if (/^BTC\b|^BTC-|BITCOIN/.test(t)) return CODIGOS.bitcoin;
      if (/^(USDT|USDC|DAI|BUSD)/.test(t)) return CODIGOS.stable;
      return CODIGOS.cripto;
    }
    return CODIGOS[classe] || CODIGOS.acao_br;
  };
  const unidadeDe = (classe) => (classe === "fii" || classe === "etf_br" || classe === "etf_us" ? "cotas" : classe === "cripto" ? "unidades" : "ações");

  function discrAtivo(a, pos, ano) {
    const f = FC.fmt;
    const nomeCls = (FC.CLASSES && FC.CLASSES[a.classe]) || a.classe;
    const un = a.classe === "cripto" ? String(a.ticker).split("-")[0] : unidadeDe(a.classe);
    const ext = a.classe === "acao_us" || a.classe === "etf_us" ? " Localização: Estados Unidos." : "";
    if (!pos.quantidade) return `${a.ticker} (${nomeCls}): posição zerada em 31/12/${ano}.${ext} Corretora/exchange: —`;
    return `${f.qtd(pos.quantidade)} ${un} ${a.ticker} (${nomeCls}), custo médio ${f.brlTexto(pos.preco_medio)}, custo total ${f.brlTexto(pos.custo)} em 31/12/${ano}.${ext} Corretora/exchange: —`;
  }

  // ---------------------------------------------------------------- proventos do ano
  const COM_JCP = /\bjcp\b|juros sobre capital/i;
  function proventosDoAno(base, dados, ano, pagamentos) {
    const a0 = String(ano);
    const classe = {};
    for (const x of base.ativos || []) classe[x.ticker] = x.classe;
    for (const x of (dados && dados.ativos) || []) classe[x.ticker] = classe[x.ticker] || x.classe;
    const itens = [];
    const pagos = (pagamentos || []).filter((p) => p.status === "pago" && String(p.pagamento || "").slice(0, 4) === a0);
    for (const p of pagos) {
      const jcp = p.tipo === "JCP";
      itens.push({ ticker: p.ticker, classe: classe[p.ticker], tipo: p.tipo, data: p.pagamento, liquido: num(p.valor),
        bruto: num(p.bruto != null ? p.bruto : p.valor), ir_fonte: jcp ? num(p.bruto) - num(p.valor) : 0, fonte: "calculado" });
    }
    // lançados em Aportes: entram os que não são o mesmo pagamento já calculado
    const origens = new Set(pagos.map((p) => p.origem));
    for (const m of base.aportes || []) {
      if (m.tipo !== "provento" || String(m.data || "").slice(0, 4) !== a0) continue;
      if (m.origem && origens.has(m.origem)) continue;
      if (pagos.some((p) => p.ticker === m.ticker && p.pagamento === m.data && Math.abs(num(p.valor) - num(m.valor)) <= 0.05)) continue;
      const cl = classe[m.ticker];
      const jcp = COM_JCP.test(String(m.observacao || "")) || /:JCP:/.test(String(m.origem || ""));
      const tipo = jcp ? "JCP" : cl === "fii" ? "Rendimento" : "Dividendo";
      const liq = num(m.valor);
      // JCP lançado à mão: o valor é o que caiu na conta (líquido dos 15%)
      const bruto = jcp ? liq / (1 - (FC.dividendos ? FC.dividendos.IR_JCP : 0.15)) : liq;
      itens.push({ ticker: m.ticker || "—", classe: cl, tipo, data: m.data, liquido: liq, bruto, ir_fonte: bruto - liq, fonte: "lançado" });
    }
    return itens;
  }

  // ---------------------------------------------------------------- declaração
  function irpf(base, dados, ano, opcoes) {
    opcoes = opcoes || {};
    base = base || {};
    const aportes = base.aportes || [];
    ano = Number(ano) || Number(D().hoje().slice(0, 4)) - 1;
    const fimAnt = `${ano - 1}-12-31`, fim = `${ano}-12-31`;
    const avisos = [];

    // ---- bens e direitos: ações, FIIs, ETFs, cripto
    const bens = [];
    for (const a of base.ativos || []) {
      const ev = eventosDoAtivo(a, aportes);
      if (!ev.length) continue;
      const p0 = percorre(ev, fimAnt), p1 = percorre(ev, fim);
      if (!p0.quantidade && !p1.quantidade) continue;
      const cod = codigoAtivo(a.classe, a.ticker);
      const parcial = (p0.quantidade && !p0.completo) || (p1.quantidade && !p1.completo);
      bens.push({ tipo: "ativo", ticker: a.ticker, nome: a.ticker, classe: a.classe, grupo: cod.grupo, codigo: cod.codigo,
        codigo_nome: cod.nome, codigo_incerto: !!cod.incerto,
        quantidade_anterior: p0.quantidade, quantidade: p1.quantidade,
        anterior: r2(p0.custo), atual: r2(p1.custo), preco_medio: p1.preco_medio, custo_parcial: !!parcial,
        discriminacao: discrAtivo(a, p1, ano) });
      if (parcial) avisos.push(`${a.ticker}: há compras sem preço — o custo declarado fica incompleto.`);
      if (ev[0].inicial && ev[0].data > fimAnt && ev[0].data <= fim) avisos.push(`${a.ticker}: a posição inicial conta a partir de ${D().br(ev[0].data)} (cadastro). Se você já tinha antes, ajuste a situação em 31/12/${ano - 1}.`);
    }
    // ---- bens e direitos: renda fixa
    const ix = opcoes.ix !== undefined ? opcoes.ix : (FC.estado && FC.estado.mercado && FC.estado.mercado.indices) || null;
    const rendIsentos = [];
    for (const t of base.rendaFixa || []) {
      const lotes = FC.rentab && FC.rentab.lotesDoTitulo ? FC.rentab.lotesDoTitulo(t, aportes)
        : [{ data: t.data_inicio || String(t.criado_em || "").slice(0, 10), valor: num(t.valor_aplicado) }];
      const v0 = principalRFEm(lotes, ix, fimAnt), v1 = principalRFEm(lotes, ix, fim);
      if (v0 < 0.005 && v1 < 0.005) continue;
      const meta = (opcoes.titulos ? opcoes.titulos[t.id] : metaDe(t.id)) || {};
      const isento = isentoRF(t, meta), poup = ehPoupanca(t);
      const cod = poup ? CODIGOS.poupanca : isento ? CODIGOS.rf_isento : CODIGOS.rf;
      const taxa = FC.rentab && FC.rentab.rotuloTaxa && t.tipo ? FC.rentab.rotuloTaxa(t.tipo, t.taxa != null ? Number(t.taxa) : (FC.rentab.PADRAO_TAXA || {})[t.tipo]) : "";
      const inst = meta.instituicao || "—";
      bens.push({ tipo: "renda_fixa", id: t.id, nome: t.nome, classe: "renda_fixa", grupo: cod.grupo, codigo: cod.codigo, codigo_nome: cod.nome,
        isento, anterior: r2(v0), atual: r2(v1), reserva: !!meta.reserva,
        discriminacao: `${t.nome}${taxa ? " — " + taxa : ""}${t.vencimento ? ", vencimento " + D().br(t.vencimento) : ""}. Valor aplicado (principal) em 31/12/${ano}: ${FC.fmt.brlTexto(v1)}. Instituição: ${inst}. CNPJ: —` });
      // rendimento isento do ano (LCI/LCA…): o que o saldo cresceu além do
      // que entrou. É acumulado — o informe mostra o que foi de fato pago.
      if (isento && ix && FC.rentab.valorTituloEm) {
        const s0 = FC.rentab.valorTituloEm(lotes, ix, fimAnt), s1 = FC.rentab.valorTituloEm(lotes, ix, fim);
        const fluxo = lotes.filter((l) => l.data > fimAnt && l.data <= fim).reduce((s, l) => s + l.valor, 0);
        const rend = s1 - s0 - fluxo;
        if (rend > 0.005) rendIsentos.push({ ticker: t.nome, classe: "renda_fixa", tipo: poup ? "Poupança" : "LCI/LCA", liquido: rend, bruto: rend,
          ficha: FICHAS.lci, estimado: true });
      }
    }
    bens.sort((a, b) => (a.grupo + a.codigo).localeCompare(b.grupo + b.codigo) || String(a.nome).localeCompare(String(b.nome)));

    // ---- rendimentos
    let pagamentos = opcoes.pagamentos || null;
    if (!pagamentos) {
      try { if (FC.estado && FC.estado.proventos && dados && FC.dividendos) pagamentos = FC.dividendos.analisa(dados, base, FC.estado.proventos).pagamentos; }
      catch (e) { console.error(e); }
    }
    if (!pagamentos) avisos.push("Os proventos calculados ainda não carregaram: entram só os lançados em Aportes.");
    const provs = proventosDoAno(base, dados, ano, pagamentos || []);
    const agrupa = (lista, ficha) => {
      const m = {};
      for (const p of lista) {
        const k = p.ticker;
        const d = (m[k] = m[k] || { ticker: k, classe: p.classe, tipo: p.tipo, liquido: 0, bruto: 0, ir_fonte: 0, n: 0, ficha: p.ficha || ficha, estimado: !!p.estimado });
        d.liquido += p.liquido; d.bruto += p.bruto; d.ir_fonte += p.ir_fonte || 0; d.n += 1;
      }
      return Object.values(m).sort((a, b) => b.liquido - a.liquido);
    };
    const exterior = (p) => p.classe === "acao_us" || p.classe === "etf_us";
    const isentos = agrupa(provs.filter((p) => p.tipo !== "JCP" && !exterior(p) && p.classe !== "fii"), FICHAS.dividendos)
      .concat(agrupa(provs.filter((p) => p.tipo !== "JCP" && !exterior(p) && p.classe === "fii"), FICHAS.fii))
      .concat(rendIsentos.map((r) => ({ ...r, n: 1, ir_fonte: 0 })));
    const exclusiva = agrupa(provs.filter((p) => p.tipo === "JCP" && !exterior(p)), FICHAS.jcp);
    const doExterior = agrupa(provs.filter(exterior), FICHAS.exterior);

    // ---- vendas no ano, mês a mês, pelo preço médio
    const vendas = [];
    for (const a of base.ativos || []) {
      percorre(eventosDoAtivo(a, aportes), fim, (e, q, pm, completo) => {
        if (String(e.data).slice(0, 4) !== String(ano)) return;
        const total = q * num(e.preco);
        vendas.push({ data: e.data, mes: e.data.slice(0, 7), ticker: a.ticker, classe: a.classe, quantidade: q, preco: num(e.preco),
          total, preco_medio: pm, custo: pm != null ? q * pm : null, ganho: pm != null && completo ? total - q * pm : null });
      });
    }
    vendas.sort((a, b) => a.data.localeCompare(b.data));
    const meses = [];
    let prejComum = 0, prejFii = 0;              // perdas do ano levadas para os meses seguintes
    for (let m = 1; m <= 12; m++) {
      const mes = `${ano}-${String(m).padStart(2, "0")}`;
      const vs = vendas.filter((v) => v.mes === mes);
      if (!vs.length) continue;
      const soma = (f, g) => vs.filter(f).reduce((s, v) => s + num(g(v)), 0);
      const ac = (v) => v.classe === "acao_br", etf = (v) => v.classe === "etf_br", fii = (v) => v.classe === "fii";
      const cri = (v) => v.classe === "cripto", ext = (v) => v.classe === "acao_us" || v.classe === "etf_us";
      const vendidoAcoes = soma(ac, (v) => v.total);
      const ganhoAcoes = soma(ac, (v) => v.ganho), ganhoEtf = soma(etf, (v) => v.ganho), ganhoFii = soma(fii, (v) => v.ganho);
      const isentoAcoes = vendidoAcoes <= ISENCAO_ACOES;
      // ações isentas: o ganho não entra, mas a perda entra na compensação
      let baseComum = ganhoEtf + (isentoAcoes ? Math.min(0, ganhoAcoes) : ganhoAcoes);
      baseComum -= prejComum;
      const tribComum = Math.max(0, baseComum);
      prejComum = Math.max(0, -baseComum);
      const baseFii = ganhoFii - prejFii;
      const tribFii = Math.max(0, baseFii);
      prejFii = Math.max(0, -baseFii);
      const vendidoCripto = soma(cri, (v) => v.total), ganhoCripto = soma(cri, (v) => v.ganho);
      const tribCripto = vendidoCripto > ISENCAO_CRIPTO ? Math.max(0, ganhoCripto) : 0;
      const darf = tribComum * 0.15 + tribFii * 0.2;
      meses.push({ mes, vendas: vs, vendido_acoes: vendidoAcoes, ganho_acoes: ganhoAcoes, isento_acoes: isentoAcoes,
        vendido_etf: soma(etf, (v) => v.total), ganho_etf: ganhoEtf, vendido_fii: soma(fii, (v) => v.total), ganho_fii: ganhoFii,
        vendido_cripto: vendidoCripto, ganho_cripto: ganhoCripto, isento_cripto: vendidoCripto <= ISENCAO_CRIPTO,
        vendido_exterior: soma(ext, (v) => v.total), ganho_exterior: soma(ext, (v) => v.ganho),
        base_comum: tribComum, base_fii: tribFii, prejuizo_comum: prejComum, prejuizo_fii: prejFii,
        darf_6015: darf, ir_cripto: tribCripto * 0.15, sem_custo: vs.some((v) => v.ganho == null) });
    }
    const ganhoExterior = vendas.filter((v) => v.classe === "acao_us" || v.classe === "etf_us").reduce((s, v) => s + num(v.ganho), 0);

    return {
      ano, fim_anterior: fimAnt, fim, bens,
      rendimentos: { isentos, exclusiva, exterior: doExterior },
      vendas, meses,
      totais: {
        bens_anterior: bens.reduce((s, b) => s + b.anterior, 0), bens_atual: bens.reduce((s, b) => s + b.atual, 0),
        isentos: isentos.reduce((s, x) => s + x.liquido, 0), exclusiva: exclusiva.reduce((s, x) => s + x.liquido, 0),
        exterior: doExterior.reduce((s, x) => s + x.liquido, 0),
        darf: meses.reduce((s, m) => s + m.darf_6015, 0), ir_cripto: meses.reduce((s, m) => s + m.ir_cripto, 0),
        ganho_exterior: ganhoExterior, ir_exterior: Math.max(0, ganhoExterior) * 0.15,
      },
      avisos,
      notas: [
        "Estimativa para conferência: confira com o informe de rendimentos da corretora/banco antes de declarar.",
        "Bens e Direitos pelo custo de aquisição (preço médio), não pelo valor de mercado. Corretagem e taxas não entram se não foram somadas ao preço.",
        "Renda fixa pelo principal aplicado; resgates tiram a fração do saldo do dia. O rendimento acumulado não entra em Bens e Direitos.",
        "DARF 6015 (ações/ETF/FII) vence no último dia útil do mês seguinte; abaixo de R$ 10 acumula para o próximo. Não desconta o IRRF de 0,005% (dedo-duro).",
        "Perdas compensadas só dentro do ano (ações+ETF juntos, FII à parte). Prejuízos de anos anteriores não entram.",
        "Exterior (Lei 14.754/2023): ganhos e dividendos tributados a 15% na declaração anual, sem isenção mensal; câmbio de cada data não é aplicado aqui.",
        "Cripto: venda acima de R$ 35 mil no mês paga 15% sobre o ganho (DARF de ganho de capital) — conferir a regra para exchanges no exterior.",
      ],
    };
  }

  FC.impostos = { aliquotaRF, iof, isentoRF, titulo, resumo, irpf, CODIGOS, FICHAS, ALIQ_VENDA, ISENCAO_ACOES, ISENCAO_CRIPTO,
    _interno: { eventosDoAtivo, percorre, principalRFEm, proventosDoAno } };
})();


/* ---- modelo/alertas.js */
/* Alertas: o que merece atenção na carteira, em linguagem de gente.
 * Concentração, títulos vencendo, limite do FGC, reserva de emergência e
 * exposição ao dólar. Só lê os dados: não grava nada.
 *
 * FC.alertas.calcula(dados, base, prefs) → [{ nivel, titulo, texto, link? }]
 * nivel: "alto" | "medio" | "info" — a lista sai com os altos primeiro. */
(function () {
  const FC = window.FC;

  const LIMITE_ATIVO = 20;          // % do investido em um só ativo
  const LIMITE_SETOR = 35;          // % do investido em um só setor
  const LIMITE_DOLAR = 30;          // % do investido atrelado ao dólar
  const FGC_POR_INSTITUICAO = 250000;
  const FGC_GLOBAL = 1000000;       // teto por CPF, renovado a cada 4 anos
  const FGC_PERTO = 0.8;            // avisa a partir de 80% do teto global
  const DIAS_VENCIMENTO = 30;

  // ETFs da B3 que andam com o dólar (bolsa lá fora, cripto)
  const ETF_DOLAR = new Set(["IVVB11", "NASD11", "SPXI11", "WRLD11", "ACWI11", "XINA11", "EURP11", "HASH11", "QBTC11", "BITH11", "ETHE11", "QETH11"]);

  const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  // garantido pelo FGC: CDB, RDB, LCI, LCA, LC, LIG e poupança.
  // Tesouro, debênture, CRI, CRA e fundos não têm a garantia.
  function garantidoFGC(nome) {
    const n = sem(nome);
    if (/TESOURO|\bLFT\b|\bNTN|\bLTN\b|DEBENTURE|\bCRI\b|\bCRA\b|\bFUNDO\b/.test(n)) return false;
    return /\b(CDB|RDB|LCI|LCA|LC|LIG|LH)\b|POUPANCA/.test(n);
  }
  // nome que sugere título isento de IR para pessoa física
  function sugereIsento(nome) {
    return /\b(LCI|LCA|CRI|CRA|LIG)\b|POUPANCA/.test(sem(nome));
  }

  const objetivosDe = (prefs) => (FC.objetivos ? FC.objetivos(prefs)
    : { meses_reserva: 6, ...(((prefs || {}).premissas || {}).objetivos || {}) });
  const titulosDe = (prefs) => ((prefs || {}).premissas || {}).titulos || {};
  const brl = (v) => FC.fmt.brlTexto(v, 0);
  const pct = (v) => FC.fmt.num(v, 0) + "%";
  const ORDEM = { alto: 0, medio: 1, info: 2 };

  function calcula(dados, base, prefs) {
    const saida = [];
    if (!dados) return saida;
    const hoje = FC.datas.hoje();
    const ativos = (dados.ativos || []).filter((a) => a.posicao && a.posicao.atual > 0);
    const rf = (dados.rendaFixa || []).filter((t) => (t.valor_aplicado || 0) > 0.005);
    const investido = FC.soma(ativos, (a) => a.posicao.atual) + FC.soma(rf, (t) => t.valor_aplicado);
    const meta = titulosDe(prefs);
    const obj = objetivosDe(prefs);

    // ---- concentração: um ativo (ETF de índice já é diversificado) ou um setor
    if (investido > 0) {
      for (const a of ativos) {
        if (a.classe === "etf_br" || a.classe === "etf_us") continue;
        const p = (a.posicao.atual / investido) * 100;
        if (p > LIMITE_ATIVO) saida.push({ nivel: p > 2 * LIMITE_ATIVO ? "alto" : "medio", titulo: `${a.ticker} é ${pct(p)} do que você tem investido`,
          texto: `Acima de ${LIMITE_ATIVO}% em um só ativo, um problema nele pesa muito no total. Considere direcionar os próximos aportes para outros.`,
          link: "#/ativos" });
      }
      const setores = {};
      for (const a of ativos) {
        if (!a.segmento || a.classe === "etf_br" || a.classe === "etf_us" || a.classe === "cripto") continue;
        setores[a.segmento] = (setores[a.segmento] || 0) + a.posicao.atual;
      }
      for (const [s, v] of Object.entries(setores)) {
        const p = (v / investido) * 100;
        if (p > LIMITE_SETOR) saida.push({ nivel: "medio", titulo: `${pct(p)} em um só setor (${s})`,
          texto: `Mais de ${LIMITE_SETOR}% do investido depende do mesmo setor. Uma crise nele afeta tudo de uma vez.`, link: "#/ativos" });
      }
    }

    // ---- títulos vencendo (ou já vencidos com saldo)
    for (const t of rf) {
      if (!t.vencimento) continue;
      const dias = FC.datas.dias(hoje, t.vencimento);
      if (dias < 0) saida.push({ nivel: "medio", titulo: `${t.nome} venceu em ${FC.datas.br(t.vencimento)}`,
        texto: `Ainda aparece com ${brl(t.valor_aplicado)}. Se o dinheiro já caiu na conta, registre o resgate ou atualize o título.`, link: "#/ativos" });
      else if (dias <= DIAS_VENCIMENTO) saida.push({ nivel: "medio", titulo: `${t.nome} vence ${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}`,
        texto: `Cerca de ${brl(t.valor_aplicado)} voltam para a conta em ${FC.datas.br(t.vencimento)}. Vale decidir antes para onde vai esse dinheiro.`, link: "#/ativos" });
    }

    // ---- FGC: até R$ 250 mil por instituição e R$ 1 milhão no total
    const garantidos = rf.filter((t) => garantidoFGC(t.nome));
    const porInst = {}, semInst = [];
    for (const t of garantidos) {
      const inst = String((meta[t.id] || {}).instituicao || "").trim();
      if (!inst) { semInst.push(t); continue; }
      const k = sem(inst);
      (porInst[k] = porInst[k] || { nome: inst, valor: 0, n: 0 }).valor += t.valor_aplicado;
      porInst[k].n++;
    }
    for (const g of Object.values(porInst)) {
      if (g.valor > FGC_POR_INSTITUICAO) saida.push({ nivel: "alto", titulo: `${brl(g.valor)} em ${g.nome}: acima da garantia do FGC`,
        texto: `O FGC cobre até ${brl(FGC_POR_INSTITUICAO)} por instituição. Se ${g.nome} quebrar, ${brl(g.valor - FGC_POR_INSTITUICAO)} ficariam sem garantia. Considere dividir entre bancos diferentes.`,
        link: "#/ativos" });
    }
    const semInstValor = FC.soma(semInst, (t) => t.valor_aplicado);
    if (semInst.length && semInstValor > FGC_POR_INSTITUICAO) saida.push({ nivel: "info", titulo: "Informe o banco dos seus títulos",
      texto: `${semInst.length} título(s) com garantia do FGC, somando ${brl(semInstValor)}, estão sem instituição. Sem ela não dá para conferir o limite de ${brl(FGC_POR_INSTITUICAO)} por banco.`,
      link: "#/ativos" });
    const totalGarantido = FC.soma(garantidos, (t) => t.valor_aplicado);
    if (totalGarantido > FGC_GLOBAL) saida.push({ nivel: "alto", titulo: "Acima do teto global do FGC",
      texto: `Você tem ${brl(totalGarantido)} em títulos garantidos; o FGC cobre no máximo ${brl(FGC_GLOBAL)} por pessoa somando todos os bancos. Tesouro Direto não depende do FGC.`, link: "#/ativos" });
    else if (totalGarantido >= FGC_GLOBAL * FGC_PERTO) saida.push({ nivel: "medio", titulo: "Perto do teto global do FGC",
      texto: `Você tem ${brl(totalGarantido)} em títulos garantidos; o teto do FGC é ${brl(FGC_GLOBAL)} por pessoa, somando todos os bancos.`, link: "#/ativos" });

    // ---- reserva de emergência
    const custo = Number(obj.custo_vida_mensal) || 0;
    const meses = Number(obj.meses_reserva) || 6;
    const daReserva = rf.filter((t) => (meta[t.id] || {}).reserva);
    if (custo > 0) {
      const alvo = custo * meses;
      const tem = FC.soma(daReserva, (t) => t.valor_aplicado);
      if (!daReserva.length) {
        if (rf.length) saida.push({ nivel: "info", titulo: "Qual título é a sua reserva de emergência?",
          texto: `Marque, ao editar cada título, os que são reserva. Assim o painel confere se você tem os ${brl(alvo)} (${meses} meses de custo de vida).`, link: "#/ativos" });
        else saida.push({ nivel: "medio", titulo: "Você ainda não tem reserva de emergência cadastrada",
          texto: `A meta é ${brl(alvo)} (${meses} meses de custo de vida), num título que dê para resgatar a qualquer momento.`, link: "#/ativos" });
      } else if (tem < alvo) {
        saida.push({ nivel: tem < alvo / 2 ? "alto" : "medio", titulo: `Reserva de emergência em ${pct((tem / alvo) * 100)} da meta`,
          texto: `Você tem ${brl(tem)} de ${brl(alvo)} (${meses} meses de custo de vida). Faltam ${brl(alvo - tem)} — vale completar antes de arriscar mais.`, link: "#/ativos" });
      }
    } else if (daReserva.length || rf.length) {
      saida.push({ nivel: "info", titulo: "Informe seu custo de vida",
        texto: "Com ele o painel mede se a reserva de emergência está completa e quanto falta para viver de renda.", link: "#/ajustes/criterios" });
    }

    // ---- caixa de proventos chegou à meta: hora de reinvestir
    const cx = dados.caixa_proventos;
    if (cx && cx.ativo && cx.pronto) {
      saida.push({ nivel: "info", titulo: `${cx.nome} tem ${FC.fmt.brlTexto(cx.saldo)} de proventos`,
        texto: `Passou da meta de ${FC.fmt.brlTexto(cx.meta)}. Hora de reinvestir: escolha o ativo e, se quiser, complete com um valor do bolso.`,
        link: "#/dividendos" });
    }

    // ---- agro: a cotação que dá o valor do rebanho ficou velha
    if (dados.agro && FC.agro && (!FC.modulo || FC.modulo("agro"))) {
      const v = FC.agro.cotacaoVelha(dados.agro, (prefs || {}).agro || {}, hoje);
      if (v) saida.push({ nivel: "info", titulo: v.dias == null ? "Informe a data da cotação do gado" : `A cotação do gado tem ${FC.fmt.int(v.dias)} dias`,
        texto: "O valor do rebanho no patrimônio vem dela. Atualize o preço por cabeça (ou da @) com o da sua praça.", link: "#/agro" });
    }

    // ---- exposição ao dólar (só informativo)
    if (investido > 0) {
      const dolar = FC.soma(ativos.filter((a) => a.classe === "acao_us" || a.classe === "etf_us" || a.classe === "cripto" || ETF_DOLAR.has(a.ticker)), (a) => a.posicao.atual);
      const p = (dolar / investido) * 100;
      if (p > LIMITE_DOLAR) saida.push({ nivel: "info", titulo: `${pct(p)} do investido acompanha o dólar`,
        texto: "Ações e ETFs de fora e cripto sobem e descem também com o câmbio. Não é problema — só saiba que uma queda do dólar reduz esse pedaço em reais." });
    }

    return saida.map((a, i) => ({ ...a, _i: i })).sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel] || a._i - b._i).map(({ _i, ...a }) => a);
  }

  FC.alertas = { calcula, garantidoFGC, sugereIsento, FGC_POR_INSTITUICAO, FGC_GLOBAL };
})();


/* ---- modelo/salario.js */
/* Salário e plano de investimento.
 *
 * A renda de um mês é a soma dos ganhos fixos que valem naquele mês
 * (entre início e fim) mais os avulsos com data no mês. O plano diz
 * quanto dessa renda vira investimento e para onde vai cada parte; o
 * guia do mês compara o planejado com o que você de fato aportou. */
(function () {
  const FC = window.FC;
  const ok = FC.ok;

  FC.CATEGORIAS_GANHO = {
    salario: "Salário", pro_labore: "Pró-labore", extra: "Renda extra / freela", bonus: "Bônus / PLR",
    decimo_terceiro: "13º salário", ferias: "Férias", aluguel: "Aluguel recebido", outros: "Outros",
  };

  FC.PADRAO_PLANO = {
    modo: "percentual",            // percentual da renda | valor fixo
    percentual: 30,
    valor: 1000,
    reinvestir_dividendos: true,   // dividendos do mês entram no valor a aportar
    destinos: [],                  // [{tipo: pilar|ativo|renda_fixa, alvo, pct}]
  };

  const mesDe = (iso) => iso.slice(0, 7);
  function valeNoMes(g, mes) {
    if (g.tipo === "avulso") return mesDe(g.inicio) === mes;
    return mesDe(g.inicio) <= mes && (!g.fim || mesDe(g.fim) >= mes);
  }

  function rendaDoMes(ganhos, mes) {
    const itens = ganhos.filter((g) => valeNoMes(g, mes));
    return { mes, total: FC.soma(itens, (g) => g.valor), fixa: FC.soma(itens.filter((g) => g.tipo === "recorrente"), (g) => g.valor),
      avulsa: FC.soma(itens.filter((g) => g.tipo === "avulso"), (g) => g.valor), itens };
  }

  function mesesAte(mes, n) {
    const saida = [];
    let [a, m] = mes.split("-").map(Number);
    for (let i = 0; i < n; i++) {
      saida.unshift(`${a}-${String(m).padStart(2, "0")}`);
      m--; if (!m) { m = 12; a--; }
    }
    return saida;
  }

  // ---------------------------------------------------------------- destinos
  function rotuloDestino(d) {
    if (d.tipo === "pilar") return FC.PILAR_NOME[d.alvo] || d.alvo;
    return d.alvo;
  }
  // o pilar de um destino — é o que a projeção usa para distribuir o aporte
  function pilarDoDestino(d, base) {
    if (d.tipo === "pilar") return d.alvo;
    if (d.tipo === "ativo") { const a = base.ativos.find((x) => x.ticker === d.alvo); return a ? a.pilar : "alternativos"; }
    const r = base.rendaFixa.find((x) => x.nome === d.alvo);
    return r ? r.pilar : "caixa";
  }

  // quanto já entrou em um destino dentro do mês
  function aportadoNoMes(d, base, mes) {
    const noMes = (x) => x.data && mesDe(x.data) === mes;
    const ap = base.aportes.filter(noMes);
    if (d.tipo === "ativo") return FC.soma(ap.filter((a) => a.tipo === "ativo" && a.ticker === d.alvo), (a) => a.valor);
    if (d.tipo === "renda_fixa") return FC.soma(ap.filter((a) => a.tipo === "caixa" && !a.historico && a.titulo === d.alvo), (a) => a.valor);
    // pilar: tudo o que foi para ativos/títulos daquele pilar (+ compras de gado, se agro)
    const pilarAtivo = Object.fromEntries(base.ativos.map((a) => [a.ticker, a.pilar]));
    const pilarRf = Object.fromEntries(base.rendaFixa.map((r) => [r.nome, r.pilar]));
    let v = FC.soma(ap.filter((a) => a.tipo === "ativo" && pilarAtivo[a.ticker] === d.alvo), (a) => a.valor)
      + FC.soma(ap.filter((a) => a.tipo === "caixa" && !a.historico && (pilarRf[a.titulo] || "caixa") === d.alvo), (a) => a.valor);
    if (d.alvo === "agro") {
      // só o dinheiro novo: o que veio do caixa de vendas reinvestidas não é aporte
      v += aporteAgroNoMes(base, mes);
    }
    return v;
  }

  // aporte novo no agro dentro do mês (compras e custos além do caixa da atividade)
  const cacheCaixa = new WeakMap();
  function aporteAgroNoMes(base, mes) {
    const movs = base.agro.movs || [];
    let cx = cacheCaixa.get(movs);
    if (!cx || cx.custos !== base.agro.custos) {
      cx = { custos: base.agro.custos, r: FC.agro.caixa(movs, base.agro.custos || []) };
      cacheCaixa.set(movs, cx);
    }
    return FC.soma(cx.r.fluxos.filter((f) => mesDe(f.data) === mes), (f) => f.aporte);
  }

  // tudo o que entrou em investimentos no mês, com ou sem plano
  // (a parte de uma compra paga com o caixa de proventos não é dinheiro novo)
  function investidoNoMes(base, mes) {
    const doCaixa = (a) => (FC.caixaProventos ? FC.caixaProventos.usado(base, a) : 0);
    return FC.soma(base.aportes.filter((a) => a.data && mesDe(a.data) === mes && (a.tipo === "ativo" || (a.tipo === "caixa" && !a.historico))), (a) => a.valor - doCaixa(a))
      + aporteAgroNoMes(base, mes);
  }

  // a meta de aporte de um mês: o valor base do plano (sem dividendos)
  function metaDoMes(plano, ganhos, mes) {
    if (!plano) return 0;
    if (plano.modo === "valor") return Number(plano.valor) || 0;
    return (rendaDoMes(ganhos, mes).total * (Number(plano.percentual) || 0)) / 100;
  }

  // ---------------------------------------------------------------- sequência
  // Meses seguidos batendo a meta do plano, estilo Duolingo. O mês atual
  // soma quando já bateu e, enquanto não bate, não quebra nada. Mês sem
  // meta (sem renda cadastrada) congela: não soma nem quebra.
  function streak({ plano, ganhos = [], base, hoje = FC.datas.hoje() }) {
    const atualMes = mesDe(hoje);
    const datas = [...base.aportes.map((a) => a.data), ...(base.agro.movs || []).map((m) => m.data),
      ...(base.agro.custos || []).map((c) => c.data), ...ganhos.map((g) => g.inicio)].filter(Boolean).sort();
    const primeiro = datas.length ? mesDe(datas[0]) : atualMes;
    const anterior = (m) => { const [a, n] = m.split("-").map(Number); return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, "0")}`; };
    const estadoDe = (mes) => {
      const meta = metaDoMes(plano, ganhos, mes), investido = investidoNoMes(base, mes);
      const batido = meta > 0 && investido >= meta - 0.5;
      const estado = meta <= 0 ? "sem_meta" : batido ? "batido" : mes === atualMes ? "andamento" : "abaixo";
      return { mes, meta, investido, pct: meta > 0 ? Math.min(100, (investido / meta) * 100) : 0, batido, estado };
    };
    const lista = [];
    for (let m = atualMes; m >= primeiro; m = anterior(m)) lista.push(estadoDe(m));
    // sequência atual: do mês atual para trás
    let atual = 0;
    for (const x of lista) {
      if (x.estado === "batido") atual++;
      else if (x.estado === "abaixo") break;
    }
    // recorde: a maior sequência em todo o histórico
    let recorde = 0, corre = 0;
    for (const x of [...lista].reverse()) {
      if (x.estado === "batido") recorde = Math.max(recorde, ++corre);
      else if (x.estado === "abaixo") corre = 0;
    }
    const meses = [];
    for (let i = 0, m = atualMes; i < 12; i++, m = anterior(m)) meses.unshift(lista.find((x) => x.mes === m) || { mes: m, estado: "sem_meta", meta: 0, investido: 0, pct: 0 });
    return { atual, recorde, mesAtual: lista[0], meses, tem_meta: lista.some((x) => x.meta > 0) };
  }

  // ---------------------------------------------------------------- plano do mês
  function planoDoMes({ plano, ganhos, base, mes, dividendosDoMes = 0 }) {
    const renda = rendaDoMes(ganhos, mes);
    const valorBase = plano.modo === "valor" ? Number(plano.valor) || 0 : (renda.total * (Number(plano.percentual) || 0)) / 100;
    const div = plano.reinvestir_dividendos ? dividendosDoMes : 0;
    const total = valorBase + div;
    const somaPct = FC.soma(plano.destinos, (d) => d.pct) || 0;
    const brutos = plano.destinos.map((d) => ({ ...d, rotulo: rotuloDestino(d), pilar: pilarDoDestino(d, base),
      valor: somaPct ? (total * (Number(d.pct) || 0)) / somaPct : 0, bruto: aportadoNoMes(d, base, mes) }));
    // o aporte conta primeiro no destino mais específico (ativo/título); no
    // pilar que o contém entra só o que passou do planejado para ele
    const destinos = brutos.map((d) => {
      let aportado = d.bruto;
      if (d.tipo === "pilar") {
        for (const x of brutos) if (x.tipo !== "pilar" && x.pilar === d.alvo) aportado -= Math.min(x.bruto, x.valor);
        aportado = Math.max(0, aportado);
      }
      return { ...d, aportado, falta: Math.max(0, d.valor - aportado), feito: d.valor > 0 ? Math.min(100, (aportado / d.valor) * 100) : 0 };
    });
    // cumprido: o que foi a cada destino até o planejado dele — excesso num
    // destino não cobre a falta de outro. O total real fica em "investido".
    const aportadoTotal = FC.soma(destinos, (d) => Math.min(d.valor, d.aportado));
    return { mes, renda, valor_base: valorBase, dividendos: div, total, destinos, soma_pct: somaPct,
      aportado: aportadoTotal, investido: investidoNoMes(base, mes), falta: FC.soma(destinos, (d) => d.falta),
      sobra_renda: renda.total - valorBase };
  }

  // proventos pagos no mês (os que o plano reinveste): pelos proventos
  // carregados ou, sem eles, pelos lançados à mão
  // Com caixa de proventos ligado, o que o plano reinveste no mês é o que
  // saiu do caixa para compras naquele mês (o resto continua guardado).
  function dividendosDoMes({ dados, base, proventos }, mes) {
    const cx = dados && dados.caixa_proventos;
    if (cx && cx.ativo) return cx.usadoNoMes(mes);
    if (proventos && dados) {
      const r = FC.dividendos.analisa(dados, base, proventos);
      return FC.soma(r.pagamentos.filter((p) => p.status === "pago" && p.quando.slice(0, 7) === mes), (p) => p.valor);
    }
    return FC.soma(base.aportes.filter((a) => a.tipo === "provento" && a.data && a.data.slice(0, 7) === mes), (a) => a.valor);
  }

  // o plano no formato da projeção: aporte mensal e peso de cada pilar
  function paraProjecao(plano, ganhos, base) {
    if (!plano || !plano.destinos || !plano.destinos.length) return null;
    const mes = FC.datas.hoje().slice(0, 7);
    const renda = rendaDoMes(ganhos, mes);
    // avulsos distorcem um mês só: a projeção usa a renda fixa
    const aporte = plano.modo === "valor" ? Number(plano.valor) || 0 : (renda.fixa * (Number(plano.percentual) || 0)) / 100;
    const pesos = {};
    const somaPct = FC.soma(plano.destinos, (d) => d.pct) || 1;
    for (const d of plano.destinos) {
      const p = pilarDoDestino(d, base);
      pesos[p] = (pesos[p] || 0) + (Number(d.pct) || 0) / somaPct;
    }
    return { aporte_mensal: aporte, pesos, renda_fixa_mensal: renda.fixa };
  }

  // ---------------------------------------------------------------- quando cai
  const REGRAS_DIA = { dia_util: "dia útil", dia_fixo: "dia fixo", ultimo_dia_util: "último dia útil" };
  function dataRecebimento(g, mes) {
    if (g.tipo === "avulso") return g.inicio;
    const n = Number(g.dia_numero) || 1;
    if (g.dia_regra === "dia_util") return FC.datas.diaUtil(mes, n);
    if (g.dia_regra === "ultimo_dia_util") return FC.datas.ultimoDiaUtil(mes);
    if (g.dia_regra === "dia_fixo") return `${mes}-${String(Math.min(n, FC.datas.ultimoDiaDoMes(mes))).padStart(2, "0")}`;
    return null;                  // sem regra: vale o mês, sem dia marcado
  }
  function descreveRegra(g) {
    if (g.tipo === "avulso") return null;
    if (g.dia_regra === "dia_util") return `${g.dia_numero || 1}º dia útil`;
    if (g.dia_regra === "ultimo_dia_util") return "último dia útil";
    if (g.dia_regra === "dia_fixo") return `todo dia ${g.dia_numero}`;
    return null;
  }
  // próximos recebimentos a partir de hoje (este mês e o seguinte)
  function proximos(ganhos, hojeIso, meses = 2) {
    const saida = [];
    let mes = hojeIso.slice(0, 7);
    for (let i = 0; i < meses; i++) {
      for (const g of ganhos.filter((x) => valeNoMes(x, mes))) {
        const d = dataRecebimento(g, mes);
        if (d && d >= hojeIso) saida.push({ ganho: g, data: d, valor: g.valor });
      }
      const [a, m] = mes.split("-").map(Number);
      mes = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    }
    return saida.sort((x, y) => x.data.localeCompare(y.data));
  }

  FC.salario = { streak, investidoNoMes, aporteAgroNoMes, metaDoMes, dataRecebimento, descreveRegra, proximos, REGRAS_DIA, rendaDoMes, mesesAte, planoDoMes, dividendosDoMes, paraProjecao, aportadoNoMes, rotuloDestino, pilarDoDestino, valeNoMes };
})();


/* ---- modelo/retrospectiva.js */
/* Retrospectivas do mês e do ano — contrato de dados e mocks.
 *
 * O vídeo é uma função pura dos dados: render(ctx, t, MonthRecap).
 * Tudo que é opcional (?) pode faltar; a cena correspondente some ou
 * vira outra, nunca mostra "R$ 0,00" solto. Valores em reais, % em
 * pontos percentuais (2.4 = 2,4%). Datas em ISO (AAAA-MM-DD). */
(function () {
  const FC = window.FC;

  /**
   * @typedef {Object} ItemValor
   * @property {string} rotulo
   * @property {number} valor
   */

  /**
   * @typedef {Object} MonthRecap
   * @property {"mes"|"ano"} [tipo]              padrão "mes"; "ano" usa o mesmo contrato para o ano inteiro
   * @property {string} mes                      "2026-09" (no ano: "2026")
   * @property {string} rotulo                   "Setembro de 2026" (no ano: "2026")
   * @property {number} seed                     derivada do mês; toda aleatoriedade do vídeo sai dela
   *
   * @property {Object}  patrimonio
   * @property {?number} patrimonio.inicial      último registro do mês anterior (null no 1º mês)
   * @property {number}  patrimonio.final        último registro do mês
   * @property {?number} patrimonio.variacao     final − inicial, em R$
   * @property {?number} patrimonio.variacao_pct
   * @property {?number} patrimonio.rendimento   variação sem o dinheiro novo: final − inicial − aportes líquidos
   * @property {?number} patrimonio.rendimento_pct  rendimento / inicial
   * @property {Array<[string, number]>} patrimonio.serie  [data, valor] diário — o fio que atravessa o vídeo
   *
   * @property {Object}  aportes
   * @property {number}  aportes.total           compras − vendas do mês (sem proventos)
   * @property {number}  aportes.quantidade      nº de lançamentos
   * @property {ItemValor[]} aportes.por_destino maiores destinos (ativo, título ou pilar)
   * @property {?{planejado: number, cumprido_pct: number}} aportes.plano  guia do mês do Salário
   *
   * @property {Object}  receitas
   * @property {number}  receitas.total          ganhos do mês (salário, extras…)
   * @property {Array<ItemValor & {categoria: string}>} receitas.por_categoria
   * @property {?number} receitas.taxa_investida_pct  aportes / receitas
   *
   * @property {?Object} despesas                o app ainda não registra gastos: hoje sempre null
   * @property {number}  despesas.total
   * @property {Array<ItemValor & {categoria: string}>} despesas.por_categoria
   * @property {?(ItemValor & {categoria: string})} despesas.campea
   * @property {Array<{categoria: string, rotulo: string, orcado: number, gasto: number}>} [despesas.orcamentos_estourados]
   *
   * @property {Object}  dividendos
   * @property {number}  dividendos.total
   * @property {number}  dividendos.pagamentos
   * @property {?{ticker: string, valor: number}} dividendos.maior
   *
   * @property {Array<{chave: string, nome: string, cor: string, pct: number, meta_pct: number}>} alocacao
   *           pilares do app: acoes, real_estate (FIIs), alternativos (cripto e ETFs), caixa (renda fixa), agro
   *
   * @property {Object}  destaques               variação do preço no mês, só ativos da carteira
   * @property {?{ticker: string, pct: number}} destaques.alta
   * @property {?{ticker: string, pct: number}} destaques.queda
   *
   * @property {Array<{nome: string, atual: number, alvo: number, pct: number}>} metas
   *           metas de valor (ex.: reserva de emergência); o app ainda não tem: hoje []
   *
   * @property {?{cabecas: number, variacao_cabecas: number, valor: number}} agro
   * @property {?{darf: number, vencimento: string, descricao: string}} ir   o app ainda não calcula: hoje null
   *
   * @property {Array<{mes: string, rotulo: string, variacao_pct: number}>} [meses]
   *           só no ano: a variação de cada mês (rendimento, sem aportes) — vira a etapa "mês a mês"
   */

  // semente estável por mês: mesmo mês, mesmo vídeo
  function seedDoMes(mes) {
    let h = 2166136261;
    for (const c of mes) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // série diária do mock: um passeio aleatório com semente fixa
  function serieMock(mes, inicial, final, seed) {
    let s = seed;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const dias = 30, pts = [];
    let v = inicial;
    for (let d = 1; d <= dias; d++) {
      const alvo = inicial + ((final - inicial) * d) / dias;
      v = alvo + (rnd() - 0.5) * inicial * 0.012;
      if (d === dias) v = final;
      pts.push([`${mes}-${String(d).padStart(2, "0")}`, Math.round(v * 100) / 100]);
    }
    return pts;
  }

  /** @type {MonthRecap} */
  const mes = "2026-09";
  const seed = seedDoMes(mes);
  FC.RECAP_MOCK = {
    mes, rotulo: "Setembro de 2026", seed,
    patrimonio: {
      inicial: 142380.55, final: 148320.4, variacao: 5939.85, variacao_pct: 4.17,
      rendimento: 3539.85, rendimento_pct: 2.49,
      serie: serieMock(mes, 142380.55, 148320.4, seed),
    },
    aportes: {
      total: 2400, quantidade: 5,
      por_destino: [{ rotulo: "ITSA4", valor: 1080 }, { rotulo: "Tesouro Selic", valor: 720 }, { rotulo: "BTC", valor: 600 }],
      plano: { planejado: 2400, cumprido_pct: 100 },
    },
    receitas: {
      total: 8000, por_categoria: [{ categoria: "salario", rotulo: "Salário", valor: 8000 }], taxa_investida_pct: 30,
    },
    despesas: null,
    dividendos: { total: 312.4, pagamentos: 4, maior: { ticker: "TAEE11", valor: 148.2 } },
    alocacao: [
      { chave: "acoes", nome: "Ações", cor: "#0a84ff", pct: 31.2, meta_pct: 30 },
      { chave: "real_estate", nome: "FIIs", cor: "#bf5af2", pct: 18.4, meta_pct: 25 },
      { chave: "alternativos", nome: "Cripto e ETFs", cor: "#ff9f0a", pct: 12.9, meta_pct: 10 },
      { chave: "caixa", nome: "Renda fixa", cor: "#30d158", pct: 27.5, meta_pct: 25 },
      { chave: "agro", nome: "Agro", cor: "#c9a77c", pct: 10, meta_pct: 10 },
    ],
    destaques: { alta: { ticker: "SOL", pct: 18.6 }, queda: { ticker: "HGLG11", pct: -3.2 } },
    metas: [],
    agro: { cabecas: 6, variacao_cabecas: 0, valor: 14830 },
    ir: null,
  };

  // o ano: patrimônio no fim de cada mês e o rendimento de cada um
  const ANO = "2026", seedAno = seedDoMes(ANO);
  const VARS = [2.1, 1.4, -1.2, 3.3, 0.8, -0.6, 2.7, 1.9, 4.2, 1.1, -0.4, 2.3];
  const NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const serieAno = [];
  let pa = 101240;
  VARS.forEach((v, i) => { pa = pa * (1 + v / 100) + 2200; serieAno.push([`${ANO}-${String(i + 1).padStart(2, "0")}-28`, Math.round(pa * 100) / 100]); });
  FC.RECAP_ANO_MOCK = {
    tipo: "ano", mes: ANO, rotulo: ANO, seed: seedAno,
    patrimonio: {
      inicial: 101240, final: serieAno.at(-1)[1], variacao: serieAno.at(-1)[1] - 101240,
      variacao_pct: ((serieAno.at(-1)[1] / 101240) - 1) * 100,
      rendimento: serieAno.at(-1)[1] - 101240 - 26400, rendimento_pct: ((serieAno.at(-1)[1] - 101240 - 26400) / 101240) * 100,
      serie: [[`${ANO}-01-01`, 101240], ...serieAno],
    },
    aportes: {
      total: 26400, quantidade: 58,
      por_destino: [{ rotulo: "ITSA4", valor: 9600 }, { rotulo: "Tesouro Selic", valor: 7800 }, { rotulo: "BTC", valor: 4200 }],
      plano: { planejado: 28800, cumprido_pct: 92 },
    },
    receitas: { total: 104000, por_categoria: [{ categoria: "salario", rotulo: "Salário", valor: 96000 }, { categoria: "decimo_terceiro", rotulo: "13º salário", valor: 8000 }], taxa_investida_pct: 25 },
    despesas: null,
    dividendos: { total: 3480.6, pagamentos: 41, maior: { ticker: "TAEE11", valor: 1620.3 } },
    alocacao: FC.RECAP_MOCK.alocacao,
    destaques: { alta: { ticker: "SOL", pct: 142.3 }, queda: { ticker: "HGLG11", pct: -8.1 } },
    metas: [],
    agro: { cabecas: 6, variacao_cabecas: 6, valor: 14830 },
    ir: null,
    meses: VARS.map((v, i) => ({ mes: `${ANO}-${String(i + 1).padStart(2, "0")}`, rotulo: NOMES[i], variacao_pct: v })),
  };

  const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  // palavras que mudam entre a retrospectiva do mês e a do ano
  function periodo(d) {
    const ano = d.tipo === "ano";
    return ano
      ? { ano: true, nome: d.rotulo, o: "o ano", O: "O ano", do: "do ano", no: "no ano", Periodo: "Ano", primeiro: "Seu primeiro ano no painel" }
      : { ano: false, nome: d.rotulo.split(" ")[0], o: "o mês", O: "O mês", do: "do mês", no: "no mês", Periodo: "Mês", primeiro: "Seu primeiro mês no painel" };
  }

  // ---------------------------------------------------------------- formatos
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // valores grandes sem centavos: "R$ 148.320"; pequenos com: "R$ 312,40"
  const brl = (v, privado) => (privado ? "R$\u00a0•••" : "R$\u00a0" + (Math.abs(v) >= 1000 ? nf0 : nf2).format(v).replace("-", "−"));
  const pct = (v, sinal = true) => (sinal && v > 0 ? "+" : "") + nf1.format(v).replace("-", "−") + "%";
  const pontos = (v) => nf1.format(Math.abs(v)).replace(",0", "");

  // ---------------------------------------------------------------- extra
  // a cena 8 mostra o primeiro que existir, nesta ordem
  function escolheExtra(d) {
    if (d.agro && d.agro.cabecas > 0) return "agro";
    if (d.despesas && d.despesas.campea && d.despesas.campea.valor > 0) return "despesas";
    if (d.ir && d.ir.darf > 0) return "ir";
    if (d.metas && d.metas.some((m) => m.alvo > 0)) return "metas";
    return null;
  }

  // ---------------------------------------------------------------- linha do tempo
  // Uma etapa por cena (formato stories). Etapas sem dado somem. Cada uma
  // tem o tempo de leitura dela; a troca é uma "cortina" de 0,55 s.
  const DURACAO = { abertura: 5.5, resultado: 5.5, meses: 6, aportes: 5, renda: 5, dividendos: 5, destaques: 5.5, alocacao: 6, extra: 4.5, final: 4.5 };
  const TROCA = 0.55;
  // contador principal de cada etapa: [atraso depois da entrada, duração]
  const CONTADOR = { abertura: [2.0, 1.9], resultado: [0.7, 1.5], aportes: [0.9, 1.5], renda: [0.8, 1.5], dividendos: [0.9, 1.5], extra: [0.8, 1.2] };

  function plano(d, opts = {}) {
    const P = d.patrimonio, A = d.aportes, R = d.receitas, D = d.dividendos, X = d.destaques || {};
    const c = [{ id: "abertura" }];
    if (P.inicial != null && P.inicial > 0) c.push({ id: "resultado" });
    if (d.tipo === "ano" && (d.meses || []).filter((m) => m.variacao_pct != null).length >= 2) c.push({ id: "meses" });
    if (A.total > 0 || (A.plano && A.plano.planejado > 0)) c.push({ id: "aportes" });
    if (R.total > 0 && !(opts.privado && R.taxa_investida_pct == null)) c.push({ id: "renda" });
    if (D.total > 0) c.push({ id: "dividendos" });
    if ((X.alta && X.alta.pct > 0) || (X.queda && X.queda.pct < 0)) c.push({ id: "destaques" });
    if ((d.alocacao || []).some((a) => a.pct > 0)) c.push({ id: "alocacao" });
    const extra = escolheExtra(d);
    if (extra && !(opts.privado && extra === "ir")) c.push({ id: "extra", extra });
    c.push({ id: "final" });
    let t = 0;
    const cenas = c.map((x, i) => {
      const dur = DURACAO[x.id];
      const cena = { ...x, i, ini: t, fim: t + dur, dur };
      if (CONTADOR[x.id]) cena.contador = { ini: t + CONTADOR[x.id][0], dur: CONTADOR[x.id][1] };
      t += dur;
      return cena;
    });
    return { cenas, total: t, corpo: t - DURACAO.final, troca: TROCA };
  }

  // ---------------------------------------------------------------- textos
  // Templates determinísticos. Mês positivo celebra; negativo é honesto.
  function textos(d, opts = {}) {
    const pv = !!opts.privado, P = d.patrimonio, A = d.aportes, R = d.receitas, D = d.dividendos, X = d.destaques || {};
    const t = {}, pe = periodo(d);
    const primeiro = P.inicial == null || !(P.inicial > 0);
    t.abertura = { rotulo: d.rotulo, sub: primeiro ? pe.primeiro : "Seu patrimônio" };

    if (!primeiro) {
      // a manchete é o RENDIMENTO, sem o dinheiro novo: crescer porque você
      // aportou não é ganho. O crescimento total fica como complemento.
      const v = P.rendimento_pct ?? P.variacao_pct ?? 0, rend = P.rendimento;
      const cresceu = !pv && A.total > 0 && P.variacao != null ? ` Com os aportes, o patrimônio ${P.variacao >= 0 ? "cresceu" : "mudou"} ${brl(P.variacao)}.` : "";
      let frase;
      if (Math.abs(v) < 0.05) frase = `${pe.Periodo} estável: o dinheiro aplicado ficou onde estava.${cresceu}`;
      else if (v > 0) frase = `${pe.Periodo} de alta: ${pct(v)} de rendimento${pv ? "" : ` (${brl(rend)})`}, fora os aportes.${cresceu}`;
      else {
        frase = `O que estava aplicado rendeu ${pct(v)}${pv ? "" : ` (${brl(rend)})`}.`;
        if (A.total > 0) frase += pv ? " Você seguiu aportando — é assim que se compra mais barato." : ` Você seguiu aportando ${brl(A.total)} — é assim que se compra mais barato.`;
        else frase += " Queda de mercado faz parte; o que conta é o prazo.";
      }
      t.resultado = { rotulo: `${pe.O} em uma linha`, frase, positivo: v >= 0, valor: v };
    }

    if (A.total > 0) {
      const n = A.quantidade;
      let frase = `${n} ${n === 1 ? "aporte" : "aportes"}.`;
      if (A.plano && A.plano.planejado > 0) frase += A.plano.cumprido_pct >= 100 ? " 100% do plano cumprido." : ` ${nf0.format(A.plano.cumprido_pct)}% do plano cumprido.`;
      t.aportes = { rotulo: "Você investiu", frase, pausa: false };
    } else if (A.plano && A.plano.planejado > 0) {
      t.aportes = { rotulo: "Aportes", frase: pv ? `${pe.Periodo} de pausa nos aportes — o plano segue de pé.` : `${pe.Periodo} de pausa — o plano pedia ${brl(A.plano.planejado)}.`, pausa: true };
    }

    if (R.total > 0) {
      const tx = R.taxa_investida_pct;
      t.renda = { rotulo: "Da sua renda",
        frase: tx != null ? (pv ? `${nf0.format(tx)}% de tudo que você recebeu virou investimento.` : `De ${brl(R.total)} recebidos, ${nf0.format(tx)}% ${tx === 1 ? "virou" : "viraram"} investimento.`) : `${brl(R.total, pv)} recebidos ${pe.no}.` };
    }

    if (D.total > 0) {
      let frase = `${D.pagamentos} ${D.pagamentos === 1 ? "pagamento" : "pagamentos"}.`;
      if (D.maior && D.pagamentos > 1) frase += pv ? ` ${D.maior.ticker} foi quem mais pagou.` : ` ${D.maior.ticker} pagou mais: ${brl(D.maior.valor)}.`;
      t.dividendos = { rotulo: "Dividendos recebidos", frase };
    }

    const alta = X.alta && X.alta.pct > 0 ? X.alta : null, queda = X.queda && X.queda.pct < 0 ? X.queda : null;
    if (alta || queda) {
      const partes = [];
      if (alta) partes.push(`${alta.ticker} subiu ${pct(alta.pct, false)}.`);
      if (queda) partes.push(`${queda.ticker} caiu ${pct(Math.abs(queda.pct), false)}.`);
      else partes.push("Nenhum ativo da carteira caiu.");
      t.destaques = { rotulo: `Os extremos ${pe.do}`, frase: partes.join(" "), alta, queda };
    }

    const al = (d.alocacao || []).filter((a) => a.pct > 0 || a.meta_pct > 0);
    if (al.length) {
      const comMeta = al.filter((a) => a.meta_pct > 0);
      let frase = "Como seu dinheiro está dividido.";
      if (comMeta.length) {
        const pior = comMeta.slice().sort((a, b) => Math.abs(b.pct - b.meta_pct) - Math.abs(a.pct - a.meta_pct))[0];
        const desvio = pior.pct - pior.meta_pct;
        if (Math.abs(desvio) < 1) frase = "Tudo dentro da meta. Carteira equilibrada.";
        else if (desvio < 0) frase = `${pior.nome} ${pior.nome.endsWith("s") ? "estão" : "está"} ${pontos(desvio)} pontos abaixo da meta — é por onde o próximo aporte rende mais.`;
        else frase = `${pior.nome} ${pior.nome.endsWith("s") ? "estão" : "está"} ${pontos(desvio)} pontos acima da meta.`;
      }
      t.alocacao = { rotulo: "Como está dividido", frase };
    }

    const ex = escolheExtra(d);
    if (ex === "agro") {
      const g = d.agro, dv = g.variacao_cabecas;
      t.extra = { rotulo: "No pasto", frase: `${g.cabecas} ${g.cabecas === 1 ? "cabeça" : "cabeças"} no pasto${pv ? "" : `, ${brl(g.valor, pv)} em rebanho`}.${dv > 0 ? ` +${dv} ${pe.no}.` : dv < 0 ? ` ${dv} ${pe.no}.` : ""}` };
    } else if (ex === "despesas") {
      const c = d.despesas.campea, n = (d.despesas.orcamentos_estourados || []).length;
      t.extra = { rotulo: "Onde mais foi dinheiro", frase: `${c.rotulo} liderou os gastos${pv ? "" : `: ${brl(c.valor, pv)}`}.${n ? ` ${n} ${n === 1 ? "orçamento estourou" : "orçamentos estouraram"}.` : " Nenhum orçamento estourado."}` };
    } else if (ex === "ir") {
      const [, m, dia] = d.ir.vencimento.split("-");
      t.extra = { rotulo: "Imposto do mês", frase: `DARF ${pv ? "" : `de ${brl(d.ir.darf)} `}vence em ${dia}/${m}. ${d.ir.descricao}` };
    } else if (ex === "metas") {
      const m = d.metas.filter((x) => x.alvo > 0).sort((a, b) => b.pct - a.pct)[0];
      t.extra = { rotulo: "Sua meta", frase: `${m.nome}: ${nf0.format(Math.min(100, m.pct))}% do caminho.` };
    }
    // só no ano: mês a mês
    const ms = (d.meses || []).filter((m) => m.variacao_pct != null);
    if (pe.ano && ms.length >= 2) {
      const melhor = ms.reduce((a, b) => (b.variacao_pct > a.variacao_pct ? b : a));
      const pior = ms.reduce((a, b) => (b.variacao_pct < a.variacao_pct ? b : a));
      const azul = ms.filter((m) => m.variacao_pct > 0).length;
      t.meses = { rotulo: "Mês a mês", melhor, pior, azul, total: ms.length,
        frase: azul === ms.length ? `Todos os ${ms.length} meses no azul.` : `${azul} de ${ms.length} meses no azul. ${pior.variacao_pct < 0 ? `O pior foi ${MES_LONGO[Number(pior.mes.slice(5, 7)) - 1]}, e o ano seguiu.` : ""}`.trim() };
    }
    t.final = { rotulo: d.rotulo, periodo: pe };
    return t;
  }

  // ---------------------------------------------------------------- som
  // Eventos sonoros derivados da mesma linha do tempo do vídeo.
  function eventos(d, opts = {}) {
    const pl = plano(d, opts);
    const ev = [];
    pl.cenas.forEach((c, i) => {
      if (i > 0) ev.push({ t: c.ini, tipo: "whoosh" });
      if (c.contador) {
        const { ini, dur } = c.contador;
        const n = Math.floor(dur / 0.075);
        for (let k = 0; k < n; k++) {
          // os ticks desaceleram junto com o easing do contador
          const q = k / n, tq = ini + dur * (1 - Math.pow(1 - q, 0.55)) * 0.98;
          ev.push({ t: tq, tipo: "tick", freq: 620 + 900 * q });
        }
        ev.push({ t: ini + dur, tipo: "ding" });
      }
      if (c.id === "final") ev.push({ t: c.ini + 0.1, tipo: "acorde" });
    });
    const ref = d.patrimonio.rendimento_pct ?? d.patrimonio.variacao_pct;
    const positivo = ref == null || ref >= 0;
    return { eventos: ev.sort((a, b) => a.t - b.t), total: pl.total, positivo };
  }

  // ---------------------------------------------------------------- dados reais
  // O MonthRecap montado com os números da conta aberta (FC.estado):
  // patrimônio e rendimento pela série reconstruída dia a dia, aportes e
  // ganhos do período, plano do Salário, proventos pagos, alocação contra a
  // meta, maior alta e maior queda pelo preço histórico e o rebanho.
  const MES_NOME = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const COR_PILAR = { acoes: "#0a84ff", real_estate: "#bf5af2", alternativos: "#ff9f0a", caixa: "#30d158", agro: "#c9a77c" };
  const NOME_PILAR = { acoes: "Ações", real_estate: "FIIs", alternativos: "Cripto e ETFs", caixa: "Renda fixa", agro: "Agro" };

  // qual mês e qual ano mostrar: dentro da janela, o período corrente;
  // fora dela, o último completo (o ano corrente até hoje, salvo em janeiro)
  function periodoDe(tipo, hoje = FC.datas.hoje()) {
    if (tipo === "ano") {
      const ano = hoje.slice(5, 7) === "01" ? String(Number(hoje.slice(0, 4)) - 1) : hoje.slice(0, 4);
      return { tipo, chave: ano, ini: `${ano}-01-01`, fim: `${ano}-12-31` < hoje ? `${ano}-12-31` : hoje, rotulo: ano };
    }
    const mes = naJanela("mes", hoje) ? hoje.slice(0, 7) : FC.datas.soma(hoje.slice(0, 8) + "01", -1).slice(0, 7);
    const ult = `${mes}-${String(FC.datas.ultimoDiaDoMes(mes)).padStart(2, "0")}`;
    return { tipo, chave: mes, ini: `${mes}-01`, fim: ult < hoje ? ult : hoje, rotulo: `${MES_NOME[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}` };
  }

  function montaRecap(per) {
    const e = FC.estado, d = e.dados, base = e.base, prefs = e.prefs, hoje = FC.datas.hoje();
    const antes = FC.datas.soma(per.ini, -1);
    // proventos pagos: entram na série como dinheiro que voltou ao bolso,
    // então o rendimento do período já os conta (queda na data-ex + provento = 0)
    let pagamentos = [];
    try { pagamentos = FC.dividendos.analisa(d, base, e.proventos || {}).pagamentos; } catch (err) { console.error(err); }
    let pontos = [];
    try { pontos = FC.rentab.serieDiaria(base, e.mercado, e.mercado.indices, prefs, d.resumo.patrimonio, pagamentos).pontos; } catch (err) { console.error(err); }
    const ponto = (dia) => { let r = null; for (const p of pontos) { if (p.data > dia) break; r = p; } return r; };
    const p0 = ponto(antes), p1 = ponto(per.fim) || pontos.at(-1);
    const noPer = pontos.filter((p) => p.data >= per.ini && p.data <= per.fim);
    const inicial = p0 && p0.valor > 0 ? p0.valor : null;
    const final = p1 ? p1.valor : d.resumo.patrimonio || 0;
    const fluxo = p1 ? p1.fluxo - (p0 ? p0.fluxo : 0) : 0;
    const variacao = inicial != null ? final - inicial : null;
    const rendimento = inicial != null ? final - inicial - fluxo : null;
    const capitalMedio = inicial != null ? inicial + fluxo / 2 : null;

    // ---- aportes do período (compras − vendas e renda fixa, sem proventos)
    const dentro = (dt) => dt && dt >= per.ini && dt <= per.fim;
    const lanc = base.aportes.filter((a) => dentro(a.data) && (a.tipo === "ativo" || (a.tipo === "caixa" && !a.historico)));
    const porDestino = {};
    for (const a of lanc) if (a.valor > 0) { const k = a.ticker || a.titulo || "—"; porDestino[k] = (porDestino[k] || 0) + a.valor; }
    const totalAportes = lanc.reduce((s, a) => s + a.valor, 0);
    let plano = null;
    const pl = prefs.plano;
    if (pl && pl.destinos && pl.destinos.length) {
      let planejado = 0, aportado = 0;
      for (let m = per.ini.slice(0, 7); m <= per.fim.slice(0, 7); m = FC.datas.soma(m + "-28", 5).slice(0, 7)) {
        // a mesma conta do Salário: dividendos do mês e cumprido por destino
        try {
          const dv = FC.salario.dividendosDoMes({ dados: d, base, proventos: e.proventos }, m);
          const g = FC.salario.planoDoMes({ plano: pl, ganhos: base.ganhos || [], base, mes: m, dividendosDoMes: dv });
          planejado += g.total; aportado += g.aportado;
        } catch (err) { /* segue */ }
      }
      if (planejado > 0) plano = { planejado, cumprido_pct: Math.min(100, (aportado / planejado) * 100) };
    }

    // ---- receitas do período (ganhos mês a mês)
    const porCat = {};
    let receitas = 0;
    for (let m = per.ini.slice(0, 7); m <= per.fim.slice(0, 7); m = FC.datas.soma(m + "-28", 5).slice(0, 7)) {
      const r = FC.salario.rendaDoMes(base.ganhos || [], m);
      receitas += r.total;
      for (const g of r.itens) porCat[g.categoria] = (porCat[g.categoria] || 0) + g.valor;
    }

    // ---- proventos pagos no período
    let div = { total: 0, pagamentos: 0, maior: null };
    try {
      const pagos = pagamentos.filter((p) => p.status === "pago" && dentro(p.pagamento || p.quando));
      const porT = {};
      for (const p of pagos) porT[p.ticker] = (porT[p.ticker] || 0) + p.valor;
      const top = Object.entries(porT).sort((x, y) => y[1] - x[1])[0];
      div = { total: pagos.reduce((s, p) => s + p.valor, 0), pagamentos: pagos.length, maior: top ? { ticker: top[0], valor: top[1] } : null };
    } catch (err) { console.error(err); }

    // ---- maior alta e maior queda: preço do fim do período contra o do início
    const hist = e.mercado.historicos || {};
    const vars = d.ativos.filter((a) => a.posicao && !a.erro).map((a) => {
      const h = hist[a.ticker];
      if (!h || h.erro || !h.precos || !h.precos.length) return null;
      const de = FC.carteira.precoEm(h.precos, antes) ?? h.precos[0][1];
      const ate = per.fim >= hoje ? a.preco : FC.carteira.precoEm(h.precos, per.fim);
      return de && ate ? { ticker: a.ticker, pct: (ate / de - 1) * 100 } : null;
    }).filter(Boolean).sort((x, y) => y.pct - x.pct);

    // ---- rebanho: cabeças no fim e a variação no período
    let agro = null;
    if (FC.modulo("agro") && d.agro && d.agro.tem_dados && d.agro.total > 0) {
      const ag = base.agro, ate = (dt) => (x) => x.data <= dt;
      let ini = 0;
      try { ini = FC.agro.analisa({ movs: ag.movs.filter(ate(antes)), custos: ag.custos.filter(ate(antes)), pesagens: ag.pesagens.filter(ate(antes)) }, prefs.agro).total || 0; } catch (err) { /* segue */ }
      agro = { cabecas: d.agro.total, variacao_cabecas: d.agro.total - ini, valor: d.agro.valorRebanho || 0 };
    }

    // ---- mês a mês (só no ano): rendimento de cada mês, sem os aportes
    let meses;
    if (per.tipo === "ano") {
      meses = [];
      for (let m = per.ini.slice(0, 7); m <= per.fim.slice(0, 7); m = FC.datas.soma(m + "-28", 5).slice(0, 7)) {
        const a = ponto(FC.datas.soma(m + "-01", -1)), fimM = `${m}-${String(FC.datas.ultimoDiaDoMes(m)).padStart(2, "0")}`, b = ponto(fimM < hoje ? fimM : hoje);
        if (!a || !b || !(a.valor > 0)) continue;
        const fl = b.fluxo - a.fluxo, cap = a.valor + fl / 2;
        if (cap > 0) meses.push({ mes: m, rotulo: CURTO[Number(m.slice(5, 7)) - 1], variacao_pct: ((b.valor - a.valor - fl) / cap) * 100 });
      }
    }

    return {
      tipo: per.tipo, mes: per.chave, rotulo: per.rotulo, seed: seedDoMes(per.chave),
      patrimonio: {
        inicial, final, variacao, variacao_pct: inicial ? (variacao / inicial) * 100 : null,
        rendimento, rendimento_pct: capitalMedio > 0 ? (rendimento / capitalMedio) * 100 : null,
        serie: noPer.map((p) => [p.data, p.valor]),
      },
      aportes: {
        total: totalAportes, quantidade: lanc.filter((a) => a.valor > 0).length,
        por_destino: Object.entries(porDestino).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([rotulo, valor]) => ({ rotulo, valor })),
        plano,
      },
      receitas: {
        total: receitas, por_categoria: Object.entries(porCat).map(([categoria, valor]) => ({ categoria, rotulo: (FC.CATEGORIAS_GANHO || {})[categoria] || categoria, valor })),
        taxa_investida_pct: receitas > 0 && totalAportes > 0 ? (totalAportes / receitas) * 100 : null,
      },
      despesas: null,
      dividendos: div,
      alocacao: (d.alocacao || []).map((l) => ({ chave: l.chave, nome: NOME_PILAR[l.chave] || l.nome, cor: COR_PILAR[l.chave] || "#8e8e93", pct: l.pct, meta_pct: l.alvo_no_patrimonio ?? l.alvo_pct })),
      destaques: { alta: vars[0] && vars[0].pct > 0 ? vars[0] : null, queda: vars.length && vars.at(-1).pct < 0 ? vars.at(-1) : null },
      metas: [], agro, ir: null, meses,
      tem_dados: pontos.length > 0,
      // período ainda em curso (o ano até hoje, o mês na última semana)
      parcial: per.fim < (per.tipo === "ano" ? `${per.chave}-12-31` : `${per.chave}-${String(FC.datas.ultimoDiaDoMes(per.chave)).padStart(2, "0")}`),
    };
  }

  // Pontos de integração (o userId fica para quando o cálculo for ao servidor)
  async function getMonthRecap(userId, quando) { void userId; return montaRecap(periodoDe("mes", quando)); }
  async function getYearRecap(userId, quando) { void userId; return montaRecap(periodoDe("ano", quando)); }

  // quando o cartão aparece no Início: últimos 5 dias do mês / do ano
  function naJanela(tipo, hoje = FC.datas.hoje()) {
    if (tipo === "ano") return hoje.slice(5) >= "12-27";
    const mes = hoje.slice(0, 7), ultimo = FC.datas.ultimoDiaDoMes(mes);
    return Number(hoje.slice(8)) > ultimo - 5;
  }

  FC.recap = { seedDoMes, plano, textos, eventos, getMonthRecap, getYearRecap, naJanela, periodo, periodoDe, brl, pct };
})();


  return FC;
}
