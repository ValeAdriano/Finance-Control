/* Marco 10 — IR estimado com parâmetros fiscais.  node --test testes/ir-m10.test.js
 * Os parâmetros são de FIXTURE (não a lei vigente): o teste confere a regra
 * e que trocar um parâmetro muda o cálculo sem mexer no código. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");
const { requisicao } = require("./mcp-req.js");
const { baseDemo } = require("./mcp-fixture.js");

const PARAMS = [
  ["ir_acoes_isencao_vendas_mes", 20000], ["ir_acoes_aliquota", 15], ["ir_etf_aliquota", 15], ["ir_daytrade_aliquota", 20], ["ir_fii_aliquota", 20],
  ["ir_cripto_isencao_vendas_mes", 35000], ["ir_cripto_aliquota", 15], ["darf_valor_minimo", 10], ["darf_codigo_renda_variavel", 6015], ["darf_codigo_cripto", 4600],
].map(([chave, valor]) => ({ chave, valor, vigencia_inicio: "2000-01-01", vigencia_fim: null, fonte: "fixture" }));
const troca = (chave, valor) => PARAMS.map((p) => (p.chave === chave ? { ...p, valor } : p));
const ativos = [["ITSA4", "acao_br"], ["BOVA11", "etf_br"], ["MXRF11", "fii"], ["BTC", "cripto"]].map(([ticker, classe], i) => ({ id: i + 1, ticker, classe, quantidade: 0, preco_medio: null }));
const op = (data, ticker, quantidade, preco) => ({ tipo: "ativo", data, ticker, quantidade, preco, valor: quantidade * preco });
const apura = (FC, aportes, parametros = PARAMS) => FC.ir.apura({ ativos, aportes, parametros }, { ano: 2026 });

test("M10 · ações: vendas até R$ 20 mil no mês são isentas; acima, 15% sobre o ganho", () => {
  const { FC } = carregaNucleo();
  let r = apura(FC, [op("2026-01-10", "ITSA4", 2000, 8), op("2026-02-10", "ITSA4", -1500, 10)]);   // vende 15 mil, ganho 3 mil
  const fev = r.meses.find((m) => m.mes === "2026-02");
  assert.equal(fev.acoes_isentas, true);
  assert.equal(fev.ir.comum, 0);
  assert.equal(r.darfs.length, 0);
  r = apura(FC, [op("2026-01-10", "ITSA4", 3000, 8), op("2026-02-10", "ITSA4", -2500, 10)]);       // vende 25 mil, ganho 5 mil
  assert.equal(r.meses.find((m) => m.mes === "2026-02").ir.comum, 750);
  assert.deepEqual(JSON.parse(JSON.stringify(r.darfs)), [{ mes: "2026-02", tipo: "renda_variavel", codigo: 6015, valor: 750, vencimento: FC.datas.ultimoDiaUtil("2026-03"), estimativa: true }]);
  assert.equal(r.estimativa, true);
  assert.ok(r.parametros_usados.some((p) => p.chave === "ir_acoes_aliquota" && p.valor === 15));
});

test("M10 · day trade 20%, FII 20% sem isenção, ETF sem isenção", () => {
  const { FC } = carregaNucleo();
  const r = apura(FC, [
    op("2026-03-05", "ITSA4", 100, 10), op("2026-03-05", "ITSA4", -100, 12),     // day trade: ganho 200
    op("2026-04-01", "MXRF11", 100, 10), op("2026-04-20", "MXRF11", -100, 11),   // FII: ganho 100, venda de só 1.100
    op("2026-05-01", "BOVA11", 10, 100), op("2026-05-20", "BOVA11", -10, 120),   // ETF: ganho 200, venda de 1.200
  ]);
  const m = (x) => r.meses.find((y) => y.mes === x);
  assert.equal(m("2026-03").ganho.daytrade, 200);
  assert.equal(m("2026-03").ir.daytrade, 40);
  assert.equal(m("2026-04").ir.fii, 20);
  assert.equal(m("2026-05").ir.comum, 30);
});

test("M10 · cripto: isenta até R$ 35 mil vendidos no mês; prejuízo compensa ganho da mesma natureza", () => {
  const { FC } = carregaNucleo();
  let r = apura(FC, [op("2026-01-05", "BTC", 0.1, 300000), op("2026-02-05", "BTC", -0.1, 340000)]);   // vende 34 mil
  assert.equal(r.meses.find((m) => m.mes === "2026-02").ir.cripto, 0);
  r = apura(FC, [op("2026-01-05", "BTC", 0.2, 300000), op("2026-02-05", "BTC", -0.2, 340000)]);       // vende 68 mil, ganho 8 mil
  assert.equal(r.meses.find((m) => m.mes === "2026-02").ir.cripto, 1200);
  assert.equal(r.darfs[0].codigo, 4600);
  // prejuízo em ações num mês tributável abate o ganho do mês seguinte
  r = apura(FC, [op("2026-01-02", "ITSA4", 5000, 10), op("2026-01-20", "ITSA4", -2500, 9), op("2026-02-20", "ITSA4", -2500, 11)]);
  assert.equal(r.meses.find((m) => m.mes === "2026-01").prejuizo_a_compensar.comum, 2500);
  assert.equal(r.meses.find((m) => m.mes === "2026-02").ir.comum, 0, "ganho de 2.500 compensado pelo prejuízo de 2.500");
});

test("M10 · trocar um parâmetro muda o cálculo sem mexer no código; DARF pequeno acumula", () => {
  const { FC } = carregaNucleo();
  const ops = [op("2026-01-10", "ITSA4", 3000, 8), op("2026-02-10", "ITSA4", -2500, 10)];
  assert.equal(apura(FC, ops).meses.find((m) => m.mes === "2026-02").ir.comum, 750);
  assert.equal(apura(FC, ops, troca("ir_acoes_aliquota", 17.5)).meses.find((m) => m.mes === "2026-02").ir.comum, 875);
  assert.equal(apura(FC, ops, troca("ir_acoes_isencao_vendas_mes", 30000)).meses.find((m) => m.mes === "2026-02").ir.comum, 0, "isenção maior: o mês fica isento");
  // vigência: a alíquota nova só vale da data dela em diante
  const nova = [...PARAMS, { chave: "ir_acoes_aliquota", valor: 10, vigencia_inicio: "2026-06-01", vigencia_fim: null }];
  assert.equal(apura(FC, ops, nova).meses.find((m) => m.mes === "2026-02").ir.comum, 750);
  // DARF abaixo do mínimo acumula para o mês seguinte
  const peq = apura(FC, [op("2026-01-02", "MXRF11", 100, 10), op("2026-01-20", "MXRF11", -100, 10.3), op("2026-02-02", "MXRF11", 100, 10), op("2026-02-20", "MXRF11", -100, 10.3)]);
  assert.equal(peq.darfs.length, 1);
  assert.equal(peq.darfs[0].mes, "2026-02");
  assert.equal(peq.darfs[0].valor, 12);
});

test("M10 · sem a tabela no banco valem os valores embutidos, marcados; MCP apurar_ir com relatório e rural", async () => {
  const { FC } = carregaNucleo();
  const sem = FC.ir.apura({ ativos, aportes: [op("2026-01-10", "ITSA4", 3000, 8), op("2026-02-10", "ITSA4", -2500, 10)], parametros: [] }, { ano: 2026, temTabela: false });
  assert.equal(sem.parametros_embutidos, true);
  assert.equal(sem.meses.find((m) => m.mes === "2026-02").ir.comum, 750);
  const db = baseDemo();
  db.parametros_fiscais = [...PARAMS, { chave: "funrural_pf_aliquota", valor: 1.5, vigencia_inicio: "2018-01-01" },
    { chave: "ir_rural_presuncao_pct", valor: 20, vigencia_inicio: "1990-01-01" }, { chave: "ir_rural_aliquota_padrao", valor: 27.5, vigencia_inicio: "2015-01-01" }];
  const { chama } = await requisicao({ db });
  const ano = Number(new Date().toISOString().slice(0, 4));
  const r = await chama("apurar_ir", { ano });
  assert.equal(r.estimativa, true);
  assert.equal(r.parametros_embutidos, false);
  assert.ok(r.rural.receita_bruta > 0, "a venda do gado da conta de demonstração entra no IR rural");
  assert.equal(r.rural.ir_estimado, Math.round(r.rural.receita_bruta * 0.2 * 0.275 * 100) / 100);
  const rel = await chama("apurar_ir", { ano, relatorio: true });
  assert.ok(Array.isArray(rel.bens_e_direitos));
  assert.ok(rel.rural && rel.renda_variavel);
});
