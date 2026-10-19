/* Caixa de proventos (FC.caixaProventos): para onde vão os dividendos até
 * serem reinvestidos, e como isso aparece no patrimônio e no Salário.
 *
 *   node --test testes/caixa-proventos.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");

const { FC } = carregaNucleo();
const hoje = FC.datas.hoje();
const dia = (n) => FC.datas.soma(hoje, n);
const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

// índice falso: 0,1% ao dia útil corrido, proporcional à taxa
const ix = { fator: (ind, taxa, de, ate) => ({ f: de < ate ? Math.pow(1 + 0.001 * (taxa / 100), FC.datas.dias(de, ate)) : 1, estimado: false }) };
const cfg = (extra = {}) => FC.mescla(FC.PADRAO_PROVENTOS, { destino: "caixa", indexador: "nenhum", meta: 500, ...extra });
const provento = (ticker, data, valor, id) => ({ id: id || `p-${ticker}-${data}`, tipo: "provento", ticker, data, valor });
const compra = (ticker, data, valor, doProvento, id) => ({ id: id || `c-${ticker}-${data}`, tipo: "ativo", ticker, data, quantidade: 10, preco: valor / 10, valor, do_provento: doProvento });
const base = (aportes) => ({ ativos: [], rendaFixa: [], aportes, agro: { movs: [], custos: [] }, ganhos: [] });

test("direto (padrão) · nada muda: caixa desligado e saldo zero", () => {
  const b = base([provento("TAEE11", dia(-10), 100)]);
  const r = FC.caixaProventos.analisa(b, [], FC.PADRAO_PROVENTOS, ix);
  assert.equal(r.ativo, false);
  assert.equal(r.saldo, 0);
  assert.equal(FC.caixaProventos.usado(b, compra("X", hoje, 10, 5)), 0);
});

test("proventos lançados entram no caixa e somam o saldo", () => {
  const b = base([provento("TAEE11", dia(-30), 100), provento("HGLG11", dia(-20), 100), provento("ITSA4", dia(-10), 100)]);
  const r = FC.caixaProventos.analisa(b, [], cfg(), ix);
  assert.equal(r.ativo, true);
  perto(r.saldo, 300);
  assert.equal(r.entradas.length, 3);
  assert.equal(r.pronto, false);
  perto(r.falta, 200);
});

test("rendendo % do CDI, o saldo passa do que entrou e a diferença é rendimento", () => {
  const b = base([provento("TAEE11", dia(-30), 100), provento("HGLG11", dia(-20), 100), provento("ITSA4", dia(-10), 100)]);
  const r = FC.caixaProventos.analisa(b, [], cfg({ indexador: "cdi", taxa: 100 }), ix);
  assert.ok(r.saldo > 300);
  perto(r.aplicado, 300);
  perto(r.rendimento, r.saldo - 300);
});

test("pagamentos calculados entram; lançado igual a um calculado não conta duas vezes", () => {
  const pagos = [{ ticker: "TAEE11", status: "pago", pagamento: dia(-15), data_com: dia(-40), valor: 120, origem: "div:TAEE11:x" }];
  const b = base([provento("TAEE11", dia(-15), 120.03), provento("BBAS3", dia(-5), 80)]);
  const r = FC.caixaProventos.analisa(b, pagos, cfg(), ix);
  perto(r.saldo, 200);
  assert.equal(r.entradas.map((e) => e.fluxo).join(), "true,false");
});

test("reinvestir com valor extra · só o que passa do caixa é dinheiro novo", () => {
  const b = base([provento("TAEE11", dia(-30), 150), provento("HGLG11", dia(-20), 150), compra("ITSA4", dia(-5), 500, 300)]);
  const r = FC.caixaProventos.analisa(b, [], cfg(), ix);
  perto(r.saldo, 0);
  const s = r.saidas[0];
  perto(s.usado, 300);
  perto(s.novo, 200);
  perto(FC.caixaProventos.usado(b, b.aportes[2]), 300);
  perto(FC.salario.investidoNoMes(b, dia(-5).slice(0, 7)), 200);
  perto(r.usadoNoMes(dia(-5).slice(0, 7)), 300);
});

test("pedir mais do que o caixa tem · usa só o saldo e o resto é novo", () => {
  const b = base([provento("TAEE11", dia(-30), 100), compra("ITSA4", dia(-5), 500, 400)]);
  const r = FC.caixaProventos.analisa(b, [], cfg(), ix);
  perto(r.saidas[0].usado, 100);
  perto(r.saidas[0].novo, 400);
  perto(r.saldo, 0);
});

test("compra antes do provento não usa o provento que ainda não caiu", () => {
  const b = base([compra("ITSA4", dia(-20), 500, 100), provento("TAEE11", dia(-10), 100)]);
  const r = FC.caixaProventos.analisa(b, [], cfg(), ix);
  perto(r.saidas[0].usado, 0);
  perto(r.saldo, 100);
});

test("exceções e data de início · ficam fora do caixa", () => {
  const b = base([provento("TAEE11", dia(-60), 100), provento("HGLG11", dia(-10), 100), provento("ITSA4", dia(-5), 100)]);
  const r = FC.caixaProventos.analisa(b, [], cfg({ inicio: dia(-30), excecoes: { HGLG11: true } }), ix);
  assert.equal(r.entradas.map((e) => e.ticker).join(), "ITSA4");
  perto(r.saldo, 100);
});

test("saldo informado · substitui o calculado na data e o que entra depois soma", () => {
  const b = base([provento("TAEE11", dia(-30), 100), provento("HGLG11", dia(-5), 50)]);
  const r = FC.caixaProventos.analisa(b, [], cfg({ saldo_informado: 130, saldo_informado_em: dia(-10) }), ix);
  perto(r.saldo, 180);
  perto(r.rendimento, 30);
});

test("meta atingida · pronto e alerta de reinvestir", () => {
  const b = base([provento("TAEE11", dia(-10), 600)]);
  const r = FC.caixaProventos.analisa(b, [], cfg({ nome: "Porquinho Inter" }), ix);
  assert.equal(r.pronto, true);
  assert.equal(r.nome, "Porquinho Inter");
  const alertas = FC.alertas.calcula({ ativos: [], rendaFixa: [], caixa_proventos: r }, b, { premissas: {} });
  assert.ok(alertas.some((a) => /Porquinho Inter/.test(a.titulo) && a.link === "#/dividendos"));
});

test("nome vazio usa o do tipo escolhido", () => {
  assert.equal(FC.caixaProventos.nome(cfg({ tipo: "corretora" })), "Saldo na corretora");
  assert.equal(FC.caixaProventos.nome(cfg({ tipo: "porquinho", nome: "  " })), "Porquinho / cofrinho");
});

test("Salário · com caixa, o dividendo reinvestido do mês é o que saiu do caixa", () => {
  const mes = dia(-5).slice(0, 7);
  const b = base([provento("TAEE11", dia(-30), 300), compra("ITSA4", dia(-5), 500, 300)]);
  const r = FC.caixaProventos.analisa(b, [], cfg(), ix);
  perto(FC.salario.dividendosDoMes({ dados: { caixa_proventos: r }, base: b, proventos: null }, mes), 300);
  const desl = FC.caixaProventos.analisa(b, [], FC.PADRAO_PROVENTOS, ix);
  perto(FC.salario.dividendosDoMes({ dados: { caixa_proventos: desl }, base: b, proventos: null }, mes), dia(-30).slice(0, 7) === mes ? 300 : 0);
  perto(FC.salario.investidoNoMes(b, mes), 500, 0.01);
});

// renda fixa: dá para montar a série diária sem cotações
const titulo = { id: 1, nome: "CDB", tipo: "prefixado", taxa: 0, valor_aplicado: 0, pilar: "caixa", criado_em: dia(-40) };
const aporteRf = (data, valor, doProvento) => ({ id: `rf-${data}`, tipo: "caixa", titulo: "CDB", data, valor, do_provento: doProvento });
const prefs = (proventos) => ({ proventos, agro: FC.PADRAO_AGRO || {} });

test("série diária · com caixa, o provento fica no patrimônio e o reinvestimento não é aporte", () => {
  const b = { ...base([aporteRf(dia(-40), 1000), provento("TAEE11", dia(-20), 200), aporteRf(dia(-10), 300, 200)]), rendaFixa: [titulo] };
  const com = FC.rentab.serieDiaria(b, {}, null, prefs(cfg()), null, []).pontos;
  const fim = com.at(-1);
  perto(fim.valor, 1300);
  perto(fim.fluxo, 1100, 0.01);
  // no dia do reinvestimento o patrimônio não pula: o caixa vira CDB
  const antes = com.find((p) => p.data === dia(-11)), depois = com.find((p) => p.data === dia(-10));
  perto(antes.valor, 1200);
  perto(depois.valor, 1300);
  perto(depois.fluxo - antes.fluxo, 100);
});

test("série diária · com destino direto, nada muda", () => {
  const b = { ...base([aporteRf(dia(-40), 1000), aporteRf(dia(-10), 300)]), rendaFixa: [titulo] };
  const a = FC.rentab.serieDiaria(b, {}, null, prefs(FC.PADRAO_PROVENTOS), null, []).pontos;
  const c = FC.rentab.serieDiaria(b, {}, null, prefs(undefined), null, []).pontos;
  assert.equal(JSON.stringify(a), JSON.stringify(c));
  perto(a.at(-1).valor, 1300);
  perto(a.at(-1).fluxo, 1300);
});

test("carteira · o saldo do caixa entra no patrimônio, no pilar caixa e na TIR", () => {
  const b = { ...base([aporteRf(dia(-40), 1000), provento("TAEE11", dia(-20), 200), aporteRf(dia(-10), 300, 200)]), rendaFixa: [titulo], historico: [] };
  const p = { alocacao_alvo: FC.PADRAO_ALOCACAO, regras: FC.PADRAO_REGRAS, agro: FC.PADRAO_AGRO, plano: FC.PADRAO_PLANO };
  const semCaixa = FC.carteira.monta(b, { universo: null, indices: null }, { ...p, proventos: FC.PADRAO_PROVENTOS });
  const comCaixa = FC.carteira.monta(b, { universo: null, indices: null }, { ...p, proventos: cfg() });
  perto(semCaixa.resumo.patrimonio, 1300);
  perto(comCaixa.resumo.patrimonio, 1300, 0.01);
  perto(comCaixa.resumo.caixa_proventos, 0);
  // o reinvestimento só põe 100 do bolso: aplicado 1100 e 200 de ganho
  perto(semCaixa.rentab.total.aplicado, 1300);
  perto(comCaixa.rentab.total.aplicado, 1100);

  const guardado = { ...b, aportes: b.aportes.slice(0, 2) };
  const g = FC.carteira.monta(guardado, { universo: null, indices: null }, { ...p, proventos: cfg() });
  perto(g.resumo.caixa_proventos, 200);
  perto(g.resumo.patrimonio, 1200);
  const linhaCaixa = g.alocacao.find((l) => l.chave === "caixa");
  assert.ok(linhaCaixa.composicao.some((x) => x.tipo === "proventos à espera do reinvestimento"));
});
