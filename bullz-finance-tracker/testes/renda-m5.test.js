/* Marco 5 — renda PJ, despesas, plano fixo + sobra e aporte parcelado.
 *   node --test testes/renda-m5.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");
const { baseDemo } = require("./mcp-fixture.js");
const { requisicao } = require("./mcp-req.js");

const PARAMS = [{ chave: "das_mei_servicos", valor: 86.05, vigencia_inicio: "2026-01-01", vigencia_fim: null, fonte: "fixture" }];
const perto = (a, b, tol = 0.005, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} esperava ${b}, veio ${a}`);
const PJ = { id: "pj", nome: "PJ", categoria: "pj", regime: "mei", tipo: "recorrente", valor: 4500, inicio: "2026-01-05", fim: null };
const VAGA = { id: "vaga", nome: "Vaga de garagem", categoria: "aluguel", tipo: "recorrente", valor: 280, inicio: "2026-01-10", fim: null };

test("M5 · renda R$ 4.500 + R$ 280, DAS R$ 86,05, despesas R$ 1.500 e fixo R$ 2.000 → sobra R$ 1.193,95 e total R$ 3.193,95", () => {
  const { FC } = carregaNucleo();
  const base = { parametros: PARAMS, despesas: [{ data: "2026-10-03", categoria: "moradia", valor: 1500, recorrente: false }] };
  const plano = { modo: "fixo_mais_sobra", valor_fixo: 2000 };
  const r = FC.salario.fixoMaisSobraDoMes(plano, [PJ, VAGA], base, "2026-10");
  assert.equal(r.renda, 4780);
  perto(r.impostos, 86.05);
  assert.equal(r.despesas, 1500);
  perto(r.sobra, 1193.95);
  perto(r.total, 3193.95);
  assert.equal(r.apurado, true, "mês fechado: despesas reais");
  // o mesmo pelo plano do mês e pela meta
  perto(FC.salario.metaDoMes(plano, [PJ, VAGA], "2026-10", base), 3193.95);
});

test("M5 · estágio de R$ 2.300 encerrado em 23/11 → proporcional de R$ 1.763,33", () => {
  const { FC } = carregaNucleo();
  const est = { nome: "Estágio", categoria: "salario", tipo: "recorrente", valor: 2300, inicio: "2026-03-01", data_fim_contrato: "2026-11-23", proporcional: true };
  const v = FC.rendaMes.valorNoMes(est, "2026-11");
  perto(v.valor, 1763.33);
  assert.equal(FC.rendaMes.valorNoMes(est, "2026-12").valor, 0, "depois do contrato não paga");
  assert.equal(FC.rendaMes.valorNoMes(est, "2026-10").valor, 2300);
  // pago no mês seguinte: o proporcional de novembro cai em dezembro
  const seguinte = { ...est, pagamento_mes_seguinte: true };
  perto(FC.rendaMes.valorNoMes(seguinte, "2026-12").valor, 1763.33);
  assert.equal(FC.rendaMes.valorNoMes(seguinte, "2027-01").valor, 0);
});

test("M5 · dezembro: estágio até 23/11 e PJ a partir de 24/11, pagos no mês seguinte, + vaga R$ 280", () => {
  const { FC } = carregaNucleo();
  const est = { nome: "Estágio", categoria: "salario", tipo: "recorrente", valor: 2300, inicio: "2026-03-01", data_fim_contrato: "2026-11-23", proporcional: true, pagamento_mes_seguinte: true };
  const pj = { ...PJ, inicio: "2026-11-24", proporcional: true, pagamento_mes_seguinte: true };
  const r = FC.rendaMes.rendaDoMes([est, pj, VAGA], "2026-12", PARAMS);
  perto(r.total, 1763.33 + 1050 + 280, 0.01);
  perto(r.impostos, 86.05);
});

test("M5 · custo de vida = média dos últimos 3 meses de despesas; sem dados, a premissa", () => {
  const { FC } = carregaNucleo();
  const desp = [
    { data: "2026-08-02", categoria: "moradia", valor: 1200, recorrente: true },
    { data: "2026-09-10", categoria: "lazer", valor: 300, recorrente: false },
    { data: "2026-10-10", categoria: "saude", valor: 600, recorrente: false },
  ];
  const c = FC.rendaMes.custoDeVida(desp, "2026-11", 9999);
  perto(c.valor, (1200 + 1500 + 1800) / 3);
  assert.deepEqual(JSON.parse(JSON.stringify(c.meses)), ["2026-10", "2026-09", "2026-08"]);
  assert.equal(FC.rendaMes.custoDeVida([], "2026-11", 3000).valor, 3000);
});

test("M5 · aporte parcelado: parcela pendente no mês; executar é movimento interno (não é aporte)", async () => {
  const db = baseDemo();
  const id = (n) => "00000000-0000-4000-9000-00000000000" + n;
  db.potes = [{ id: id(2), user_id: "u-demo", nome: "Oportunidade", tipo: "oportunidade", criado_em: "2026-01-01" }, { id: id(5), user_id: "u-demo", nome: "Livre", tipo: "livre", criado_em: "2026-01-01" }];
  db.potes_movimentos = [{ id: "m0", user_id: "u-demo", pote_id: id(2), data: "2026-01-01", valor: 3000, descricao: "saldo", transferencia_id: null }];
  db.ganhos.push({ ...PJ, id: "pj" });
  db.parametros_fiscais = PARAMS;
  const { chama } = await requisicao({ db });
  const hoje = new Date().toISOString().slice(0, 7);
  await chama("registrar_parcelamento", { valor_total: 1500, n_parcelas: 3, inicio: hoje + "-01", destino_tipo: "titulo_rf", destino_id: "LCI Banco Demo", pote: "oportunidade" });
  db.parcelamentos[0].id = "00000000-0000-4000-9000-0000000000aa";   // o banco falso não gera uuid
  let s = await chama("salario_e_plano", { mes: hoje });
  assert.equal(s.parcelas_pendentes.length, 1);
  assert.equal(s.parcelas_pendentes[0].valor, 500);
  const aportado = s.plano_do_mes.ja_aportado;
  await chama("registrar_movimento_interno", { origem_tipo: "pote", origem_id: "oportunidade", origem_quantidade: 500, destino_tipo: "titulo_rf",
    destino_id: "LCI Banco Demo", parcelamento_id: db.parcelamentos[0].id });
  s = await chama("salario_e_plano", { mes: hoje });
  assert.equal(s.parcelas_pendentes.length, 0);
  assert.equal(s.plano_do_mes.ja_aportado, aportado, "a parcela executada não é aporte novo");
  // o PJ aparece com o imposto do mês
  const pj = s.renda.itens.find((g) => g.categoria === "pj");
  assert.equal(pj.imposto, 86.05);
});
