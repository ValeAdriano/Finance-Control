/* Investimentos — proventos por mês (FC.dividendos.porMes).
 *
 *   node --test testes/investimentos.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");

const { FC } = carregaNucleo();
const ano = Number(FC.datas.hoje().slice(0, 4));

test("porMes · soma por mês de pagamento, do ano mais novo ao mais velho", () => {
  const lista = [
    { data_com: `${ano - 1}-02-20`, pagamento: `${ano - 1}-03-10`, valor: 0.5, tipo: "Dividendo" },
    { data_com: `${ano - 1}-02-28`, pagamento: `${ano - 1}-03-25`, valor: 0.25, tipo: "JCP" },
    { data_com: `${ano - 2}-11-30`, pagamento: `${ano - 2}-12-15`, valor: 1, tipo: "Dividendo" },
  ];
  const r = FC.dividendos.porMes(lista);
  assert.equal(r.anos.map((l) => l.ano).join(), [ano, ano - 1, ano - 2, ano - 3, ano - 4].join());
  const passado = r.anos[1];
  assert.equal(passado.meses[2].valor, 0.75);
  assert.equal(passado.meses[2].eventos.length, 2);
  assert.equal(passado.meses[1].valor, 0, "a data com não conta quando há pagamento");
  assert.equal(passado.total, 0.75);
  assert.equal(r.anos[2].meses[11].valor, 1);
  assert.equal(r.max, 1);
  assert.equal(r.anos[0].total, 0);
});

test("porMes · sem data de pagamento usa a data com; fora da janela fica de fora", () => {
  const r = FC.dividendos.porMes([
    { data_com: `${ano - 1}-06-01`, pagamento: null, valor: 0.3, tipo: "Rendimento" },
    { data_com: `${ano - 9}-06-01`, pagamento: `${ano - 9}-06-15`, valor: 9, tipo: "Dividendo" },
    { data_com: `${ano - 1}-07-01`, pagamento: `${ano - 1}-07-15`, valor: 0, tipo: "Dividendo" },
  ], 3);
  assert.equal(r.anos.length, 3);
  assert.equal(r.anos[1].meses[5].valor, 0.3);
  assert.equal(r.anos[1].meses[6].eventos.length, 0, "valor zero é ignorado");
  assert.equal(r.max, 0.3);
});

test("porMes · pagamento anunciado e ainda não feito sai como futuro", () => {
  const amanha = FC.datas.soma(FC.datas.hoje(), 40);
  const r = FC.dividendos.porMes([{ data_com: FC.datas.hoje(), pagamento: amanha, valor: 1, tipo: "Dividendo" }]);
  const linha = r.anos.find((l) => l.ano === Number(amanha.slice(0, 4)));
  if (!linha) return; // virada de ano: o pagamento cai fora da janela
  assert.equal(linha.meses[Number(amanha.slice(5, 7)) - 1].futuro, true);
});

test("analisaPagadora devolve a tabela por mês", () => {
  const r = FC.dividendos.analisaPagadora({ ticker: "TEST3", classe: "acao_br", preco: 10,
    lista: [{ data_com: `${ano - 1}-04-01`, pagamento: `${ano - 1}-04-20`, valor: 1, tipo: "Dividendo" }] });
  assert.equal(r.por_mes.anos[1].meses[3].valor, 1);
});
