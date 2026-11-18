/* Marco 9 — alertas de preço, preço de empate e revisões.  node --test testes/alertas-m9.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");
const { baseDemo, HOJE } = require("./mcp-fixture.js");
const { requisicao, recusa } = require("./mcp-req.js");

test("M9 · alerta de empate no BNB (preço médio R$ 4.313) dispara a R$ 4.313 e não a R$ 4.312", () => {
  const { FC } = carregaNucleo();
  const al = { ticker: "BNB", condicao: "empate", valor: null, ligado: true };
  assert.equal(FC.alertasPreco.dispara(al, 4313, 4313).dispara, true);
  assert.equal(FC.alertasPreco.dispara(al, 4312, 4313).dispara, false);
  assert.equal(FC.alertasPreco.dispara(al, 4312.99, 4313).dispara, false, "em centavos");
  assert.equal(FC.alertasPreco.dispara({ ...al, condicao: "acima", valor: 5000 }, 5000, null).dispara, true);
  assert.equal(FC.alertasPreco.dispara({ ...al, condicao: "abaixo", valor: 4000 }, 4000.01, null).dispara, false);
  const e = FC.alertasPreco.empate({ preco_medio: 4313 }, 3920.91);
  assert.equal(e.preco_empate, 4313);
  assert.ok(Math.abs(e.alta_necessaria_pct - 10) < 0.01);
});

test("M9 · MCP: listar_posicoes traz preco_empate e alta_necessaria_pct; o alerta aparece no resumo quando dispara", async () => {
  const db = baseDemo();
  db.ativos.find((a) => a.ticker === "BTC").preco_medio = 700000;   // BTC no prejuízo (cotação 612.000)
  const { chama } = await requisicao({ db });
  const btc = (await chama("listar_posicoes")).posicoes.find((p) => p.ticker === "BTC");
  assert.equal(btc.preco_empate, 700000);
  assert.ok(Math.abs(btc.alta_necessaria_pct - (700000 / 612000 - 1) * 100) < 0.01);
  const sim = await chama("criar_alerta_preco", { ticker: "BTC", condicao: "empate", simular: true });
  assert.equal(sim.dispararia_hoje, false);
  await chama("criar_alerta_preco", { ticker: "BTC", condicao: "abaixo", valor: 650000 });
  await chama("criar_alerta_preco", { ticker: "BTC", condicao: "empate" });
  const r = await chama("resumo_patrimonio");
  assert.ok(r.alertas.some((a) => /BTC caiu abaixo/.test(a.titulo)), JSON.stringify(r.alertas.map((a) => a.titulo)));
  assert.ok(!r.alertas.some((a) => /BTC voltou ao preço médio/.test(a.titulo)));
  const l = await chama("listar_alertas");
  assert.equal(l.alertas.length, 2);
  assert.ok(!l.sugestoes_de_empate.some((s) => s.ticker === "BTC"), "já tem alerta de empate no BTC");
  assert.ok(l.sugestoes_de_empate.some((s) => s.ticker === "MXRF11"), "MXRF11 está no prejuízo e sem alerta");
  await recusa(chama("criar_alerta_preco", { ticker: "BTC", condicao: "acima" }), /valor/);
});

test("M9 · revisão programada aparece nos alertas na data e some quando feita", async () => {
  const db = baseDemo();
  const { chama } = await requisicao({ db });
  await chama("criar_revisao", { ticker: "ITSA4", data: HOJE, pergunta: "Ainda vale manter ITSA4?" });
  await chama("criar_revisao", { tema: "Reserva", data: "2099-01-01", pergunta: "Reserva de 12 meses?" });
  let r = await chama("resumo_patrimonio");
  assert.ok(r.alertas.some((a) => a.titulo === "Revisão: ITSA4"));
  assert.ok(!r.alertas.some((a) => a.titulo === "Revisão: Reserva"), "a futura ainda não aparece");
  const id = db.revisoes[0].id;
  await chama("editar_registro", { tabela: "revisoes", id, campos: { feita: true } });
  r = await chama("resumo_patrimonio");
  assert.ok(!r.alertas.some((a) => a.titulo === "Revisão: ITSA4"));
});
