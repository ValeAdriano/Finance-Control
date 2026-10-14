/* Carrega o núcleo compartilhado num contexto de `vm` — o adaptador do app
 * traduzido para o Node, para os testes de paridade rodarem sem depender de
 * Metro nem de React Native. Mesma ordem, mesmo shim, mesmo resultado. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { aplicaShim, localStorageMemoria } = require("../src/nucleo/shim.js");
const ORDEM = require("../src/nucleo/ordem.js");

const RAIZ_JS = path.resolve(__dirname, "..", "..", "investimentos-compartilhar", "assets", "js");

/** Carrega o núcleo e devolve { FC, contexto }. `extras` injeta supabase/zip. */
function carregaNucleo(extras = {}) {
  const base = {
    console, Math, Date, JSON, Object, Array, Number, String, Boolean,
    Set, Map, WeakMap, WeakSet, Symbol, Promise, Proxy, Reflect,
    Infinity, NaN, isFinite, isNaN, parseInt, parseFloat,
    RegExp, Error, TypeError, RangeError,
    Intl, encodeURIComponent, decodeURIComponent, escape, unescape,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    structuredClone: typeof structuredClone === "function" ? structuredClone : undefined,
  };
  const g = vm.createContext(base);
  aplicaShim(g, {
    localStorage: localStorageMemoria(),
    supabase: extras.supabase || { createClient: () => ({ auth: {}, from: () => ({}) }) },
    zip: extras.zip || {},
  });

  for (const arquivo of ORDEM) {
    const codigo = fs.readFileSync(path.join(RAIZ_JS, arquivo), "utf8");
    vm.runInContext(codigo, g, { filename: arquivo });
  }
  return { FC: g.FC, contexto: g, RAIZ_JS };
}

module.exports = { carregaNucleo, ORDEM, RAIZ_JS };
