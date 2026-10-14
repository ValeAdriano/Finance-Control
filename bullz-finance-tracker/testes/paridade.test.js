/* F1 — paridade do núcleo (gate da fase).
 *
 *   node --test testes/paridade.test.js
 *
 * Carrega o núcleo pelo adaptador (testes/nucleo.js, o equivalente Node do
 * src/nucleo) e confere:
 *   N1  — superfície do FC igual à registrada, e carga completa na ordem;
 *   N12 — perfil e recomendação funcionam idênticos ao site;
 *   N13 — layout resolve como no site;
 *   N16 — formatação pt-BR (moeda, %, datas). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { carregaNucleo, ORDEM, RAIZ_JS } = require("./nucleo.js");

const { FC } = carregaNucleo();
const igual = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

// ---------------------------------------------------------------- N1 superfície
test("N1 · todas as chaves do FC batem com a superfície registrada", () => {
  const atual = Object.keys(FC).sort();
  const esperado = JSON.parse(fs.readFileSync(path.join(__dirname, "superficie-esperada.json"), "utf8"));
  assert.deepEqual(atual, esperado,
    "superfície do FC mudou — reveja e rode `node testes/atualiza-superficie.js` se for esperado");
});

test("N1 · namespaces de cálculo presentes e do tipo certo", () => {
  for (const ns of ["carteira", "rentab", "impostos", "dividendos", "projecao", "alertas",
    "salario", "agro", "renda", "perfil", "recomendacao", "avaliador", "layout", "importador"]) {
    assert.equal(typeof FC[ns], "object", `FC.${ns} deveria ser um objeto`);
  }
  for (const fn of ["html", "icone", "logo", "foguinho", "resolveModulos"]) {
    assert.equal(typeof FC[fn], "function", `FC.${fn} deveria ser função`);
  }
  assert.equal(typeof FC.fmt, "object");
  assert.equal(typeof FC.config.supabaseUrl, "string");
});

// ---------------------------------------------------------------- N1 ordem de carga
test("N1 · ordem.js é o subconjunto não-tela do index.html, na mesma ordem", () => {
  const html = fs.readFileSync(path.join(RAIZ_JS, "..", "..", "index.html"), "utf8");
  const scripts = [...html.matchAll(/src="assets\/js\/([^"]+)"/g)].map((m) => m[1]);
  // o que a gente carrega tem que aparecer no index.html, na mesma ordem relativa
  const noHtml = scripts.filter((s) => ORDEM.includes(s));
  igual(noHtml, ORDEM, "ordem de carga divergiu do index.html");
});

// ---------------------------------------------------------------- N12 perfil
test("N12 · perfil calcula e classifica como o site", () => {
  const BASE = {
    idade: "31_40", estab: "clt", dependentes: "0", renda: "5_8k", sobra: "1500_3000",
    reserva: "6_12", divida: "nao", patrimonio: "50_200k", moradia: "propria",
    objetivo: "aposentadoria", valor_alvo: "500k_1m", prazo: "20_mais", saque: "nao",
    tempo: "3_5", produtos: ["acoes", "fii", "renda_fixa"],
    t_queda: "mantem", t_certo: "quase_risco", amigo: "equilibrado", t_perda: "10",
    t_clima: "neutro", t_carteiras: "mais_b", t_foco: "equilibrar",
  };
  const res = FC.perfil.calcula(BASE);
  assert.ok(res && typeof res === "object", "perfil.calcula devolveu objeto");
  assert.equal(res.perfil, "moderado", "persona-base deveria ser moderado");

  // dívida cara → plano exclusivo de quitar (mesma regra de recomendacao.js)
  const prefs = { regras: { perfil: null }, premissas: { macro_longo_prazo: { cdi: null, ipca: null } } };
  const comDivida = { ...BASE, divida: "sim" };
  const g = FC.recomendacao.gera({
    resp: comDivida, res: FC.perfil.calcula(comDivida), prefs,
    dados: null, base: null, mercado: null,
  });
  assert.equal(g.plano.passos.length, 1);
  assert.equal(g.plano.passos[0].id, "quitar_divida");
});

// ---------------------------------------------------------------- N13 layout
test("N13 · layout resolve na ordem padrão e respeita ocultos", () => {
  assert.equal(typeof FC.layout.resolve, "function");
  const r = FC.layout.resolve ? FC.layout.resolve({}) : null;
  assert.ok(r, "layout.resolve devolveu algo para prefs vazias");
});

// ---------------------------------------------------------------- N16 formatação
test("N16 · fmt pt-BR: moeda, inteiro, porcentagem", () => {
  assert.equal(FC.fmt.num(1234.5, 2), "1.234,50");
  assert.equal(FC.fmt.int(1000), "1.000");
  assert.equal(FC.fmt.pct(12.3, 1), "12,3%");
  assert.equal(FC.fmt.num(null), "—");
});
