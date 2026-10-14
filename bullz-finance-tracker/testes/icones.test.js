/* F1 — paridade de ícones (T4): src/ui/icones.gen.ts tem que ser idêntico ao
 * dicionário `P` de ../investimentos-compartilhar/assets/js/util.js.
 *
 *   node --test testes/icones.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function dicionarioDoSite() {
  const util = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "investimentos-compartilhar", "assets", "js", "util.js"), "utf8");
  const ini = util.indexOf("const P = {");
  let i = util.indexOf("{", ini), nivel = 0, fim = -1;
  for (let j = i; j < util.length; j++) {
    if (util[j] === "{") nivel++;
    else if (util[j] === "}") { if (--nivel === 0) { fim = j + 1; break; } }
  }
  return vm.runInNewContext("(" + util.slice(i, fim) + ")", {});
}

function iconesGerados() {
  const ts = fs.readFileSync(path.resolve(__dirname, "..", "src", "ui", "icones.gen.ts"), "utf8");
  const ini = ts.indexOf("export const ICONES = {");
  let i = ts.indexOf("{", ini), nivel = 0, fim = -1;
  for (let j = i; j < ts.length; j++) {
    if (ts[j] === "{") nivel++;
    else if (ts[j] === "}") { if (--nivel === 0) { fim = j + 1; break; } }
  }
  return vm.runInNewContext("(" + ts.slice(i, fim) + ")", {});
}

test("T4 · ICONES tem exatamente os mesmos nomes e paths do util.js", () => {
  const site = dicionarioDoSite();
  const app = iconesGerados();
  assert.deepEqual(Object.keys(app).sort(), Object.keys(site).sort(), "conjunto de ícones divergiu");
  for (const nome of Object.keys(site)) {
    assert.equal(app[nome], site[nome], "path divergiu no ícone " + nome);
  }
});
