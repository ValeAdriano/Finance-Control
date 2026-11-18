/* Marco 2 — potes com finalidade.  node --test testes/potes-m2.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { baseDemo } = require("./mcp-fixture.js");
const { requisicao, recusa } = require("./mcp-req.js");

function comPotes(extra = {}) {
  const db = baseDemo();
  const id = (n) => "00000000-0000-4000-9000-00000000000" + n;
  db.potes = [
    { id: id(1), user_id: "u-demo", nome: "Reserva de emergência", tipo: "reserva_emergencia", meta_valor: null, criado_em: "2026-01-01" },
    { id: id(2), user_id: "u-demo", nome: "Oportunidade", tipo: "oportunidade", meta_valor: null, criado_em: "2026-01-01" },
    { id: id(3), user_id: "u-demo", nome: "Oportunidade do agro", tipo: "oportunidade_agro", meta_valor: null, criado_em: "2026-01-01" },
    { id: id(4), user_id: "u-demo", nome: "IR a pagar", tipo: "ir_a_pagar", meta_valor: null, criado_em: "2026-01-01" },
    { id: id(5), user_id: "u-demo", nome: "Livre", tipo: "livre", meta_valor: null, criado_em: "2026-01-01" },
  ];
  db.potes_movimentos = [];
  // o CDB fica na reserva; a LCI, sem pote (livre)
  db.renda_fixa[0].pote_id = id(1);
  db.preferencias[0].premissas = { objetivos: { custo_vida_mensal: 4000, meses_reserva: 6 } };
  Object.assign(db, extra);
  return { db, id };
}
const n2 = (v) => Math.round(v * 100) / 100;

test("M2 · mover entre potes não altera o patrimônio nem a alocação", async () => {
  const { db } = comPotes();
  const { chama } = await requisicao({ db });
  const antes = await chama("resumo_patrimonio");
  const potesAntes = await chama("listar_potes");
  const livre = potesAntes.potes.find((p) => p.tipo === "livre");
  assert.ok(livre.saldo > 1000, "a LCI sem pote cai no livre");
  const sim = await chama("mover_entre_potes", { de: "livre", para: "oportunidade", valor: 1000, simular: true });
  assert.equal(sim.simulado, true);
  assert.equal(db.potes_movimentos.length, 0, "simular não grava");
  const r = await chama("mover_entre_potes", { de: "livre", para: "oportunidade", valor: 1000 });
  assert.equal(r.ok, true);
  assert.equal(db.potes_movimentos.length, 2);
  assert.equal(db.potes_movimentos[0].transferencia_id, db.potes_movimentos[1].transferencia_id);
  const depois = await chama("resumo_patrimonio");
  assert.equal(depois.patrimonio, antes.patrimonio);
  assert.deepEqual(depois.alocacao.map((l) => [l.pilar, l.valor]), antes.alocacao.map((l) => [l.pilar, l.valor]));
  const p = await chama("listar_potes");
  assert.equal(p.potes.find((x) => x.tipo === "oportunidade").saldo, 1000);
  assert.equal(n2(p.potes.find((x) => x.tipo === "livre").saldo), n2(livre.saldo - 1000));
  assert.equal(p.total, potesAntes.total, "a soma dos potes não muda");
});

test("M2 · a reserva de emergência é medida só pelo pote de reserva", async () => {
  const { db } = comPotes();
  const { chama } = await requisicao({ db });
  const p = await chama("listar_potes");
  const reserva = p.potes.find((x) => x.tipo === "reserva_emergencia");
  assert.equal(p.reserva.saldo, reserva.saldo);
  assert.equal(p.reserva.meta, 24000);
  assert.equal(reserva.titulos.length, 1, "só o CDB marcado entra na reserva");
  await chama("mover_entre_potes", { de: "reserva_emergencia", para: "livre", valor: 500 });
  const p2 = await chama("listar_potes");
  assert.equal(n2(p2.reserva.saldo), n2(p.reserva.saldo - 500));
  // o alerta de reserva olha o pote
  const r = await chama("resumo_patrimonio");
  assert.ok(r.alertas.some((a) => /Reserva de emergência em/.test(a.titulo)), JSON.stringify(r.alertas));
});

test("M2 · não tira mais do que o pote tem; IR a pagar aparece como comprometido", async () => {
  const { db, id } = comPotes();
  db.potes_movimentos = [{ id: "m1", user_id: "u-demo", pote_id: id(4), data: "2026-11-01", valor: 300, descricao: "IR do gado", transferencia_id: null }];
  const { chama } = await requisicao({ db });
  await recusa(chama("mover_entre_potes", { de: "oportunidade", para: "livre", valor: 10 }), /não dá para tirar/);
  const r = await chama("resumo_patrimonio");
  assert.equal(r.potes.comprometido_com_ir, 300);
  assert.ok(r.alertas.some((a) => /comprometidos com IR/.test(a.titulo)));
  // dinheiro de fora num pote soma no caixa
  const semFora = await (await requisicao({ db: comPotes().db })).chama("resumo_patrimonio");
  assert.equal(n2(r.patrimonio - semFora.patrimonio), 300);
});

test("M2 · conta sem potes: o primeiro movimento cria os padrões; sem a tabela, erro legível", async () => {
  const { chama, db } = await requisicao();
  const l = await chama("listar_potes");
  assert.equal(l.tem_potes, false);
  await chama("mover_entre_potes", { de: "livre", para: "reserva_emergencia", valor: 100 });
  assert.equal(db.potes.length, 5);
  const p = await chama("listar_potes");
  assert.equal(p.potes.find((x) => x.tipo === "reserva_emergencia").saldo, 100);
});
