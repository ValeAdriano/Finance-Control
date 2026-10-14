/* F1 — paridade de tema (T1/T2): cada token em src/tema/tokens.ts tem que
 * bater, var a var, com ../investimentos-compartilhar/assets/css/app.css.
 *
 *   node --test testes/tema.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const CSS = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "investimentos-compartilhar", "assets", "css", "app.css"), "utf8");

// carrega os tokens transpilando o TS na unha (só precisamos dos literais)
function carregaTokens() {
  const ts = fs.readFileSync(path.resolve(__dirname, "..", "src", "tema", "tokens.ts"), "utf8");
  const pega = (nome) => {
    const re = new RegExp("export const " + nome + "\\s*:\\s*Record<string, string>\\s*=\\s*\\{");
    const m = re.exec(ts);
    if (!m) throw new Error("não achei " + nome);
    let i = ts.indexOf("{", m.index), nivel = 0, fim = -1;
    for (let j = i; j < ts.length; j++) {
      if (ts[j] === "{") nivel++;
      else if (ts[j] === "}") { if (--nivel === 0) { fim = j + 1; break; } }
    }
    // resolve o spread `...CLARO` manualmente
    let corpo = ts.slice(i, fim).replace(/\.\.\.CLARO,?/g, "");
    const obj = new Function("return (" + corpo + ")")();
    return obj;
  };
  const CLARO = pega("CLARO");
  const ESCURO_RAW = pega("ESCURO");
  return { CLARO, ESCURO: { ...CLARO, ...ESCURO_RAW } };
}

// extrai um bloco `<seletor> { --x: val; ... }` do CSS em { xCamel: "val" }
function varsDoBloco(css, abre) {
  const i = css.indexOf(abre);
  assert.ok(i >= 0, "bloco não encontrado: " + abre);
  const ini = css.indexOf("{", i);
  let nivel = 0, fim = -1;
  for (let j = ini; j < css.length; j++) {
    if (css[j] === "{") nivel++;
    else if (css[j] === "}") { if (--nivel === 0) { fim = j; break; } }
  }
  const corpo = css.slice(ini + 1, fim);
  const out = {};
  for (const m of corpo.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const chave = m[1].replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
    out[chave] = m[2].trim();
  }
  return out;
}

const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const { CLARO, ESCURO } = carregaTokens();

test("T1/T2 · tokens claros batem com :root do app.css", () => {
  const css = varsDoBloco(CSS, ":root {");
  for (const [chave, val] of Object.entries(css)) {
    if (chave === "colorScheme") continue;
    assert.ok(chave in CLARO, "token claro faltando: " + chave);
    assert.equal(norm(CLARO[chave]), norm(val), "divergência em --" + chave + " (claro)");
  }
});

test("T1/T2 · tokens escuros batem com [data-tema=\"escuro\"] do app.css", () => {
  const css = varsDoBloco(CSS, ':root[data-tema="escuro"] {');
  for (const [chave, val] of Object.entries(css)) {
    if (chave === "colorScheme") continue;
    assert.ok(chave in ESCURO, "token escuro faltando: " + chave);
    assert.equal(norm(ESCURO[chave]), norm(val), "divergência em --" + chave + " (escuro)");
  }
});
