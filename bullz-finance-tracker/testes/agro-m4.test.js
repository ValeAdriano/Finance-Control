/* Marco 4 — agro por lote, permuta, venda planejada e impostos rurais.
 *   node --test testes/agro-m4.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { baseDemo } = require("./mcp-fixture.js");
const { requisicao, recusa } = require("./mcp-req.js");
const { carregaNucleo } = require("./nucleo.js");

const perto = (a, b, tol = 0.01, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} esperava ${b}, veio ${a}`);
const PARAMS = [
  { chave: "funrural_pf_aliquota", valor: 1.5, vigencia_inicio: "2018-01-01", vigencia_fim: null, fonte: "fixture" },
  { chave: "ir_rural_presuncao_pct", valor: 20, vigencia_inicio: "1990-01-01", vigencia_fim: null, fonte: "fixture" },
  { chave: "ir_rural_aliquota_padrao", valor: 27.5, vigencia_inicio: "2015-01-01", vigencia_fim: null, fonte: "fixture" },
];
const pid = (n) => "00000000-0000-4000-9000-00000000000" + n;

/** conta só com o gado do Adriano (fictício): nada de agro da demo */
function contaGado() {
  const db = baseDemo();
  db.agro_movimentos = []; db.agro_custos = []; db.agro_pesagens = [];
  db.parametros_fiscais = PARAMS.map((p, i) => ({ id: i + 1, ...p }));
  db.potes = [["reserva_emergencia", "Reserva de emergência"], ["oportunidade", "Oportunidade"], ["oportunidade_agro", "Oportunidade do agro"], ["ir_a_pagar", "IR a pagar"], ["livre", "Livre"]]
    .map(([tipo, nome], i) => ({ id: pid(i + 1), user_id: "u-demo", nome, tipo, meta_valor: null, criado_em: "2026-01-01" }));
  db.potes_movimentos = [];
  db.preferencias[0].agro = { avaliar_pelo_custo: true };
  return db;
}

test("M4 · compra de 6 a R$ 2.580 → troca de 3 por 6 pequenos (R$ 18.000 de referência): lote 1 realiza R$ 10.260, lote 2 abre com R$ 18.000", async () => {
  const db = contaGado();
  const { chama } = await requisicao({ db });
  await chama("registrar_agro", { especie: "movimento", tipo: "compra", categoria: "boi_magro", cabecas: 6, preco_cabeca: 2580, data: "2026-03-10" });
  await chama("registrar_agro", { especie: "movimento", tipo: "troca", categoria: "boi_magro", categoria_destino: "bezerro", cabecas_saida: 3, cabecas_entrada: 6,
    valor_referencia_saida: 18000, valor_referencia_entrada: 18000, data: "2026-08-20" });
  const r = await chama("agro_resumo");
  assert.equal(r.lotes.length, 2);
  const [l1, l2] = r.lotes;
  assert.equal(l1.resultado_realizado, 10260);
  assert.equal(l1.cabecas, 3);
  assert.equal(l2.custo_total, 18000);
  assert.equal(l2.cabecas, 6);
  assert.equal(r.cabecas, 9, "rebanho: 3 grandes + 6 pequenos");
  // troca não é aporte nem saque do agro
  const rt = await chama("rentabilidade");
  assert.equal(rt.por_classe.agro.aplicado, 15480);
  assert.equal(rt.por_classe.agro.devolvido, 0);
});

test("M4 · venda de 3 a R$ 6.000 com destino oportunidade_agro: o pote recebe o líquido de Funrural e o IR estimado vai para IR a pagar", async () => {
  const db = contaGado();
  const { chama } = await requisicao({ db });
  await chama("registrar_agro", { especie: "movimento", tipo: "compra", categoria: "boi_magro", cabecas: 3, preco_cabeca: 2580, data: "2026-03-10" });
  const totalAntes = (await chama("rentabilidade")).total;
  const sim = await chama("registrar_agro", { especie: "movimento", tipo: "venda", categoria: "boi_gordo", cabecas: 3, preco_cabeca: 6000, destino: "oportunidade_agro", simular: true });
  assert.equal(sim.venda.funrural, 270);
  assert.equal(sim.venda.liquido, 17730);
  assert.equal(sim.venda.ir_estimado, 990);
  assert.equal(db.agro_movimentos.length, 1, "simular não grava");
  const v = await chama("registrar_agro", { especie: "movimento", tipo: "venda", categoria: "boi_gordo", cabecas: 3, preco_cabeca: 6000, destino: "oportunidade_agro" });
  assert.equal(v.ok, true);
  const dep = db.potes_movimentos.find((m) => m.movimento_interno_id && m.valor > 0);
  assert.equal(dep.valor, 17730, "o pote recebe o líquido de Funrural");
  assert.equal(dep.pote_id, pid(3));
  const p = await chama("listar_potes");
  assert.equal(p.potes.find((x) => x.tipo === "ir_a_pagar").saldo, 990);
  assert.equal(p.potes.find((x) => x.tipo === "oportunidade_agro").saldo, 17730 - 990);
  const lote = (await chama("agro_resumo")).lotes[0];
  assert.equal(lote.aberto, false);
  assert.equal(lote.resultado_realizado, 17730 - 3 * 2580);
  // a venda virou movimento interno: no total, nada de "devolvido" em dobro
  const totalDepois = (await chama("rentabilidade")).total;
  assert.equal(totalDepois.devolvido, totalAntes.devolvido);
  assert.equal(totalDepois.aplicado, totalAntes.aplicado);
});

test("M4 · sem lote informado, a saída baixa dos lotes mais antigos (PEPS), sem exigir a categoria", () => {
  const { FC } = carregaNucleo();
  const movs = [
    { id: "a", data: "2026-01-05", tipo: "compra", categoria: "bezerro", cabecas: 10, valor_total: 10000, despesas: 0 },
    { id: "b", data: "2026-02-05", tipo: "compra", categoria: "garrote", cabecas: 5, valor_total: 7500, despesas: 0 },
    { id: "c", data: "2026-09-05", tipo: "venda", categoria: "boi_gordo", cabecas: 12, valor_total: 30000, despesas: 0 },
  ];
  const r = FC.lotes.monta(movs, [], [], {}, null, "2026-10-01");
  const [la, lb] = r.lotes;
  assert.equal(la.aberto, false);
  assert.equal(la.fechado_em, "2026-09-05");
  assert.equal(lb.cabecas, 3);
  perto(la.resultado_realizado, 25000 - 10000);
  perto(lb.resultado_realizado, 5000 - 3000);
  assert.ok(r.suposicoes.length >= 1, "a suposição do PEPS fica registrada");
});

test("M4 · avaliação: estimativa manual > custo; custos inclusos no preço não alertam", () => {
  const { FC } = carregaNucleo();
  const movs = [{ id: "a", data: "2026-01-05", tipo: "compra", categoria: "bezerro", cabecas: 10, valor_total: 10000, despesas: 0, lote_id: "L" }];
  let r = FC.lotes.monta(movs, [], [{ id: "L", nome: "Lote A" }], {}, null, "2026-10-01");
  assert.equal(r.lotes[0].origem_valor, "custo");
  assert.equal(r.lotes[0].alerta_custos, true);
  r = FC.lotes.monta(movs, [], [{ id: "L", nome: "Lote A", valor_estimado_cabeca: 1800, custos_inclusos_no_preco: true }], {}, null, "2026-10-01");
  assert.equal(r.lotes[0].origem_valor, "estimativa");
  assert.equal(r.lotes[0].valor_estimado, 18000);
  assert.equal(r.lotes[0].alerta_custos, false);
});

test("M4 · impostos: parâmetro ausente devolve null com motivo; trocar o parâmetro muda o cálculo", () => {
  const { FC } = carregaNucleo();
  const sem = FC.lotes.impostosVenda(18000, { parametros: [] });
  assert.equal(sem.funrural, null);
  assert.equal(sem.ir_estimado, null);
  assert.match(sem.motivo, /parametros_fiscais/);
  const outro = PARAMS.map((p) => (p.chave === "funrural_pf_aliquota" ? { ...p, valor: 2.0 } : p));
  assert.equal(FC.lotes.impostosVenda(18000, { parametros: outro }).funrural, 360);
  // vigência: a linha nova vale a partir da data dela
  const comVigencia = [...PARAMS, { chave: "funrural_pf_aliquota", valor: 1.0, vigencia_inicio: "2027-01-01", vigencia_fim: null }];
  assert.equal(FC.lotes.impostosVenda(10000, { parametros: comVigencia, data: "2026-12-31" }).funrural, 150);
  assert.equal(FC.lotes.impostosVenda(10000, { parametros: comVigencia, data: "2027-01-02" }).funrural, 100);
});

test("M4 · planejar_venda_agro grava a venda prevista no lote e aparece em vendas_planejadas", async () => {
  const db = contaGado();
  const { chama } = await requisicao({ db });
  await chama("registrar_agro", { especie: "movimento", tipo: "compra", categoria: "boi_magro", cabecas: 6, preco_cabeca: 2580, data: "2026-03-10" });
  const lote = (await chama("agro_resumo")).lotes[0];
  const sim = await chama("planejar_venda_agro", { lote: lote.chave, data_prevista: "2027-02-15", preco_esperado_cabeca: 6000, destino_planejado: "oportunidade_agro", nome: "Lote março", simular: true });
  assert.equal(sim.receita_esperada, 36000);
  assert.equal((db.agro_lotes || []).length, 0);
  const r = await chama("planejar_venda_agro", { lote: lote.chave, data_prevista: "2027-02-15", preco_esperado_cabeca: 6000, destino_planejado: "oportunidade_agro", nome: "Lote março" });
  assert.ok(r.lote_id);
  assert.equal(db.agro_movimentos[0].lote_id, r.lote_id, "a compra que abriu o lote fica ligada à linha");
  const res = await chama("agro_resumo");
  assert.equal(res.vendas_planejadas.length, 1);
  assert.equal(res.vendas_planejadas[0].receita_esperada, 36000);
  assert.equal(res.lotes[0].nome, "Lote março");
  await recusa(chama("planejar_venda_agro", { lote: "não existe", preco_esperado_cabeca: 1 }), /não encontrado/);
});
