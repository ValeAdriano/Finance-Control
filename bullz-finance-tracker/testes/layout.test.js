/* node testes/layout.test.js */
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const ctx = { window: { FC: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "nucleo", "layout.js"), "utf8"), ctx);
const FC = ctx.window.FC;
const igual = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0, f = 0;
const t = (nome, fn) => { n++; try { fn(); } catch (e) { f++; console.error("✗ " + nome + "\n  " + e.message); } };

const rotas = ["inicio", "ativos", "agro", "aportes", "dividendos", "salario"].map((id) => ({ id })).concat([{ id: "ajustes", oculta: true }]);
const tudo = { rotas, ligada: () => true };
const semAgro = { rotas, ligada: (id) => id !== "agro" };

t("sem layout salvo vale o padrão", () => {
  const l = FC.layout.resolve(null, tudo);
  igual(l.nav.ordem, ["inicio", "ativos", "agro", "aportes", "dividendos", "salario"]);
  igual(l.nav.celular, ["inicio", "ativos", "agro", "aportes"]);
  igual(l.inicio.ordem, FC.LAYOUT_INICIO.map((b) => b.id));
  igual(l.inicio.ocultos, FC.LAYOUT_INICIO.filter((b) => b.padraoOculto).map((b) => b.id));
  assert.ok(l.inicio.ocultos.includes("detalhes") && !l.inicio.ocultos.includes("curva"));
});
t("módulo desligado sai do menu e o celular preenche", () => {
  igual(FC.layout.resolve(null, semAgro).nav.celular, ["inicio", "ativos", "aportes", "dividendos"]);
});
t("ordem salva é respeitada e as 4 primeiras viram a barra", () => {
  const l = FC.layout.resolve({ nav: { ordem: ["salario", "inicio", "dividendos"] } }, tudo);
  igual(l.nav.ordem, ["salario", "inicio", "dividendos", "ativos", "agro", "aportes"]);
  igual(l.nav.celular, ["salario", "inicio", "dividendos", "ativos"]);
});
t("ids inválidos, repetidos e rotas ocultas são descartados", () => {
  const l = FC.layout.resolve({ nav: { ordem: ["x", "ativos", "ativos", "ajustes"] } }, tudo);
  igual(l.nav.ordem, ["ativos", "inicio", "agro", "aportes", "dividendos", "salario"]);
});
t("aba de módulo desligado salva na ordem não aparece", () => {
  igual(FC.layout.resolve({ nav: { ordem: ["agro", "inicio"] } }, semAgro).nav.ordem, ["inicio", "ativos", "aportes", "dividendos", "salario"]);
});
t("bloco novo entra no fim; fixo nunca fica oculto; lixo é ignorado", () => {
  const l = FC.layout.resolve({ inicio: { ordem: ["melhores", "zzz", "alocacao"], ocultos: ["topo", "agro", "nada"] } }, tudo);
  assert.strictEqual(l.inicio.ordem[0], "melhores");
  assert.strictEqual(l.inicio.ordem[1], "alocacao");
  assert.strictEqual(l.inicio.ordem.length, FC.LAYOUT_INICIO.length);
  igual(l.inicio.ocultos, ["agro"]);
});
t("paraSalvar: padrão vira null e só guarda o que difere", () => {
  const padrao = FC.layout.resolve(null, tudo);
  assert.strictEqual(FC.layout.paraSalvar(padrao, padrao), null);
  const mexido = FC.layout.resolve({ nav: { ordem: ["salario"] }, inicio: { ocultos: ["agro"] } }, tudo);
  const s = FC.layout.paraSalvar(mexido, padrao);
  igual(Object.keys(s).sort(), ["inicio", "nav"]);
  igual(s.inicio, { ocultos: ["agro"] });
  igual(FC.layout.resolve(s, tudo), mexido);
});
t("layout já salvo é respeitado: brutos que estavam visíveis continuam; os novos entram no fim, visíveis", () => {
  const antigo = { inicio: { ordem: ["topo", "detalhes", "alocacao"], ocultos: ["agro"] } };
  const l = FC.layout.resolve(antigo, tudo);
  igual(l.inicio.ocultos, ["agro"]);
  igual(l.inicio.ordem.slice(0, 3), ["topo", "detalhes", "alocacao"]);
  assert.ok(l.inicio.ordem.includes("curva") && !l.inicio.ocultos.includes("curva"));
  // salvo só com a ordem (formato antigo, sem ocultos): nenhum oculto
  igual(FC.layout.resolve({ inicio: { ordem: ["melhores"] } }, tudo).inicio.ocultos, []);
});
t("paraSalvar: mostrar um bruto e mexer na ordem sobrevive à volta", () => {
  const padrao = FC.layout.resolve(null, tudo);
  const tudoVisivel = { ...padrao, inicio: { ordem: padrao.inicio.ordem, ocultos: [] } };
  const s = FC.layout.paraSalvar(tudoVisivel, padrao);
  igual(s.inicio, { ocultos: [] });
  igual(FC.layout.resolve(s, tudo).inicio.ocultos, []);
  const reordenado = { ...padrao, inicio: { ordem: FC.layout.move(padrao.inicio.ordem, 4, 2), ocultos: padrao.inicio.ocultos } };
  const s2 = FC.layout.paraSalvar(reordenado, padrao);
  igual(FC.layout.resolve(s2, tudo).inicio, reordenado.inicio);
});
t("move reordena sem mutar", () => {
  const a = ["a", "b", "c", "d"];
  igual(FC.layout.move(a, 0, 2), ["b", "c", "a", "d"]);
  igual(a, ["a", "b", "c", "d"]);
});
t("entrada inesperada não quebra", () => {
  for (const v of [undefined, 1, "x", [], { nav: "x", inicio: 5 }, { nav: { ordem: "a" } }]) FC.layout.resolve(v, tudo);
});
console.log(`${n - f}/${n} testes passaram`);
process.exit(f ? 1 : 0);
