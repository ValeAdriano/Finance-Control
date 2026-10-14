/* Shim do ambiente de navegador para o núcleo compartilhado.
 *
 * Os arquivos de `../investimentos-compartilhar/assets/js/` foram escritos para
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

module.exports = { aplicaShim, localStorageMemoria };
