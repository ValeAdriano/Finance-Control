/* Agro (FC.agro.analisa): valor do rebanho sem peso, quem usa peso e os
 * indicadores que saem só dos lançamentos.
 *
 *   node --test testes/agro.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");

const { FC } = carregaNucleo();
const perto = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
const hoje = FC.datas.hoje();
const dia = (n) => FC.datas.soma(hoje, n);

let seq = 0;
const mov = (tipo, categoria, cabecas, extra = {}) => ({
  id: "m" + ++seq, tipo, categoria, cabecas, data: extra.data || dia(-100), criado_em: String(seq).padStart(4, "0"),
  valor_total: 0, despesas: 0, peso_medio_kg: null, ...extra,
});
const cfg = (extra = {}) => ({ preco_arroba: 300, rendimento_carcaca: 52, ...extra });
const analisa = (movs, opcoes = {}) => FC.agro.analisa({ movs, custos: opcoes.custos || [], pesagens: opcoes.pesagens || [] }, cfg(opcoes.cfg));

test("sem peso informado, ninguém 'usa peso' e o valor vem das suas operações", () => {
  const ag = analisa([
    mov("compra", "boi_magro", 10, { valor_total: 30000, data: dia(-200) }),
    mov("compra", "boi_magro", 10, { valor_total: 36000, data: dia(-50) }),
  ]);
  assert.equal(ag.usa_peso, false);
  const c = ag.porCategoria.find((x) => x.categoria === "boi_magro");
  assert.equal(c.origem_valor, "operacoes");
  perto(c.valor_cabeca, (30000 + 36000) / 20, 1e-6);
  perto(ag.valorRebanho, 66000, 1e-6);
});

test("valor por cabeça da Cotação vale antes das operações", () => {
  const ag = analisa([mov("compra", "boi_magro", 10, { valor_total: 30000 })], { cfg: { valor_cabeca_por_categoria: { boi_magro: 4000 } } });
  const c = ag.porCategoria[0];
  assert.equal(c.origem_valor, "por_cabeca");
  perto(ag.valorRebanho, 40000, 1e-6);
});

test("sem nada, cai no peso típico × @, marcado como estimado", () => {
  const ag = analisa([mov("nascimento", "bezerro", 5)]);
  const c = ag.porCategoria[0];
  assert.equal(c.origem_valor, "tipico");
  perto(c.valor_cabeca, FC.agro.valorCabeca("bezerro", FC.PESO_TIPICO.bezerro, cfg()), 1e-6);
});

test("com peso no lançamento, a categoria vai pela arroba e o módulo 'usa peso'", () => {
  const ag = analisa([mov("compra", "boi_gordo", 10, { valor_total: 50000, peso_medio_kg: 520 })]);
  assert.equal(ag.usa_peso, true);
  const c = ag.porCategoria[0];
  assert.equal(c.origem_valor, "arroba");
  perto(c.valor_cabeca, FC.agro.arrobas(520, 52) * 300, 1e-6);
});

test("uma pesagem sozinha já liga o peso", () => {
  const ag = analisa([mov("compra", "boi_magro", 10, { valor_total: 30000 })],
    { pesagens: [{ data: dia(-10), categoria: "boi_magro", cabecas: 10, peso_medio_kg: 400 }] });
  assert.equal(ag.usa_peso, true);
});

test("tempo no pasto e margem por cabeça vendida", () => {
  const ag = analisa([
    mov("compra", "boi_magro", 10, { valor_total: 30000, data: dia(-300) }),
    mov("venda", "boi_gordo", 10, { valor_total: 50000, despesas: 2000, data: dia(-120) }),
  ], { custos: [{ data: dia(-200), categoria: "nutricao", valor: 6000 }] });
  const f = ag.financeiro;
  perto(f.tempo_medio_dias, 180, 1e-6);
  // 48.000 líquidos − 30.000 de compra − custo de manter (por cabeça/mês × meses)
  assert.ok(f.custo_cabeca_mes > 0);
  perto(f.margem_cabeca, 4800 - 3000 - f.custo_cabeca_mes * (180 / 30.44), 1e-6);
});

test("natalidade: nascimentos dos últimos 12 meses sobre as vacas", () => {
  const ag = analisa([
    mov("entrada", "vaca", 20, { valor_total: 100000, data: dia(-500) }),
    mov("nascimento", "bezerro", 15, { data: dia(-60) }),
    mov("nascimento", "bezerro", 5, { data: dia(-400) }),
  ]);
  perto(ag.financeiro.natalidade_pct, 75, 1e-6);
});
