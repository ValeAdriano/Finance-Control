/* Marco 3 — movimento interno.  node --test testes/movimentos-m3.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { baseDemo, dia, HOJE } = require("./mcp-fixture.js");
const { requisicao, recusa } = require("./mcp-req.js");

const n2 = (v) => Math.round(v * 100) / 100;
const perto = (a, b, tol = 0.02, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} esperava ${b}, veio ${a}`);

// a conta de demonstração com BNB na carteira (cripto com cotação fixa na fixture: BTC)
function base() {
  const db = baseDemo();
  return db;
}

test("M3 · trocar BTC por CDB: patrimônio igual menos os custos, aporte do mês e TIR total intactos", async () => {
  const db = base();
  const { chama } = await requisicao({ db });
  const mes = HOJE.slice(0, 7);
  const antes = await chama("resumo_patrimonio");
  const salAntes = await chama("salario_e_plano", { mes });
  const rentAntes = await chama("rentabilidade");
  const btc = (await chama("listar_posicoes")).posicoes.find((p) => p.ticker === "BTC");
  const q = 0.005, custo = 12;
  const sim = await chama("registrar_movimento_interno", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: q, destino_tipo: "titulo_rf",
    destino_id: "CDB Banco Demo 2027", custos: { taxa: custo }, simular: true });
  assert.equal(sim.simulado, true);
  assert.equal((db.movimentos_internos || []).length, 0, "simular não grava");
  const r = await chama("registrar_movimento_interno", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: q, destino_tipo: "titulo_rf",
    destino_id: "CDB Banco Demo 2027", custos: { taxa: custo } });
  assert.equal(r.ok, true);
  assert.equal(db.movimentos_internos.length, 1);
  const geradas = db.aportes.filter((a) => a.movimento_interno_id === r.movimento_id);
  assert.equal(geradas.length, 2, "a baixa e a entrada ficam ligadas ao movimento");
  const depois = await chama("resumo_patrimonio");
  perto(depois.patrimonio, antes.patrimonio - custo, 0.05, "patrimônio");
  const salDepois = await chama("salario_e_plano", { mes });
  assert.equal(salDepois.plano_do_mes.ja_aportado, salAntes.plano_do_mes.ja_aportado, "movimento interno não é aporte");
  // TIR total: só o custo da operação muda o resultado; sem custo, nada muda
  const rentDepois = await chama("rentabilidade");
  assert.equal(rentDepois.total.aplicado, rentAntes.total.aplicado, "aplicado total");
  assert.equal(rentDepois.total.devolvido, rentAntes.total.devolvido, "devolvido total");
  perto(rentDepois.total.ganho, rentAntes.total.ganho - custo, 0.05, "ganho total");
  // o resultado realizado da origem
  perto(r.resultado_realizado, (btc.preco - btc.preco_medio) * q - custo, 0.05, "resultado realizado");
});

test("M3 · sem custos a TIR total não se mexe", async () => {
  const { chama } = await requisicao({ db: base() });
  const rentAntes = await chama("rentabilidade");
  // destino sem proventos (ação comprada hoje receberia o provento com data-com hoje, o que é legítimo)
  await chama("registrar_movimento_interno", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.004, destino_tipo: "titulo_rf", destino_id: "LCI Banco Demo" });
  const rentDepois = await chama("rentabilidade");
  assert.equal(rentDepois.total.tir_anual_pct, rentAntes.total.tir_anual_pct);
  assert.equal(rentDepois.total.retorno_pct, rentAntes.total.retorno_pct);
});

test("M3 · resultado realizado = (preço de venda − preço médio) × quantidade − custos; destino herda o líquido", async () => {
  const { chama, db } = await requisicao({ db: base() });
  const r = await chama("registrar_movimento_interno", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.01, origem_preco: 400000,
    destino_tipo: "ativo", destino_id: "ITSA4", destino_preco: 10, custos: { spread: 30, saque: 10 } });
  assert.equal(r.bruto, 4000);
  assert.equal(r.liquido, 3960);
  perto(r.resultado_realizado, (400000 - r.preco_medio_da_baixa) * 0.01 - 40, 0.01);
  const compra = db.aportes.find((a) => a.movimento_interno_id === r.movimento_id && a.quantidade > 0);
  assert.equal(n2(compra.valor), 3960);
  assert.equal(n2(compra.quantidade), 396);
});

test("M3 · destino pote: o líquido vira saldo do pote; simular_realocacao avalia a ordem", async () => {
  const db = base();
  const id = "00000000-0000-4000-9000-000000000003";
  db.potes = [{ id, user_id: "u-demo", nome: "Oportunidade", tipo: "oportunidade", criado_em: "2026-01-01" },
    { id: id.slice(0, -1) + "5", user_id: "u-demo", nome: "Livre", tipo: "livre", criado_em: "2026-01-01" }];
  db.potes_movimentos = [];
  const { chama } = await requisicao({ db });
  const s = await chama("simular_realocacao", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.01, destino_tipo: "pote", destino_id: "oportunidade" });
  assert.equal(s.simulado, true);
  assert.ok(["melhora", "igual", "piora"].includes(s.ordem_rf_acoes_cripto.efeito));
  assert.ok(s.alocacao_depois_pct.alternativos < s.alocacao_antes_pct.alternativos);
  const antes = await chama("resumo_patrimonio");
  await chama("registrar_movimento_interno", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.01, destino_tipo: "pote", destino_id: "oportunidade" });
  const p = await chama("listar_potes");
  perto(p.potes.find((x) => x.tipo === "oportunidade").saldo, s.liquido, 0.01);
  const depois = await chama("resumo_patrimonio");
  perto(depois.patrimonio, antes.patrimonio, 0.05, "patrimônio");
  const rent = await chama("rentabilidade");
  assert.ok(rent.total.aplicado > 0);
});

test("M3 · não tira mais do que a posição; ativo novo precisa da classe", async () => {
  const { chama } = await requisicao({ db: base() });
  await recusa(chama("registrar_movimento_interno", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 5, destino_tipo: "ativo", destino_id: "ITSA4" }), /não dá para tirar/);
  await recusa(chama("registrar_movimento_interno", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.001, destino_tipo: "ativo", destino_id: "WEGE3", destino_preco: 50 }), /destino_classe/);
});
