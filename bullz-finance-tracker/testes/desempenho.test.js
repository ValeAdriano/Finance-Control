/* Desempenho (FC.desempenho): a nota 0–100 do velocímetro do Início.
 *
 *   node --test testes/desempenho.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");

const { FC } = carregaNucleo();
const hoje = FC.datas.hoje();
const dia = (n) => FC.datas.soma(hoje, n);

// série sintética: rv e rf crescem a taxas diárias dadas, sem aportes no meio
function serie(dias, { rv = 0, rf = 0, vRv = 1000, vRf = 1000 } = {}) {
  const pontos = [];
  for (let i = dias; i >= 0; i--) {
    const k = dias - i;
    const a = vRv * Math.pow(1 + rv, k), b = vRf * Math.pow(1 + rf, k);
    pontos.push({ data: dia(-i), valor: a + b, fluxo: vRv + vRf,
      partes: { rv: { valor: a, fluxo: vRv }, rf: { valor: b, fluxo: vRf }, agro: { valor: 0, fluxo: 0 } } });
  }
  return pontos;
}
// referências na mesma moeda: CDI a `cdi` ao dia e Ibov a `ibov` ao dia
function refs(dias, cdi, ibov) {
  const ix = { fator: (ind, taxa, de, ate) => ({ f: de < ate ? Math.pow(1 + cdi, FC.datas.dias(de, ate)) : 1 }) };
  const serieIbov = [];
  for (let i = dias + 5; i >= 0; i--) serieIbov.push([dia(-i), 100000 * Math.pow(1 + ibov, dias + 5 - i)]);
  return { ix, ibov: serieIbov };
}
const perto = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test("igual às referências · nota ≈ 50, no ritmo", () => {
  const r = FC.desempenho.calcula({ pontos: serie(40, { rv: 0.001, rf: 0.0004 }), ...refs(40, 0.0004, 0.001), periodo: "mes" });
  assert.equal(r.suficiente, true);
  perto(r.score, 50, 1);
  assert.equal(r.faixa.chave, "no_ritmo");
  assert.equal(r.partes.length, 2);
});

test("renda variável bem acima do Ibov no mês · faixa Acima", () => {
  // ~+15 p.p. acima do Ibov em 30 dias, só renda variável
  const r = FC.desempenho.calcula({ pontos: serie(40, { rv: 0.005, vRf: 0 }), ...refs(40, 0.0004, 0), periodo: "mes" });
  assert.ok(r.score > 66, String(r.score));
  assert.equal(r.faixa.chave, "acima");
  assert.equal(r.partes.map((p) => p.chave).join(), "rv");
});

test("abaixo das referências · faixa Abaixo", () => {
  const r = FC.desempenho.calcula({ pontos: serie(40, { rv: -0.004, rf: 0 }), ...refs(40, 0.0004, 0.001), periodo: "mes" });
  assert.ok(r.score < 34, String(r.score));
  assert.equal(r.faixa.chave, "abaixo");
});

test("peso pelo valor · a parte maior puxa a nota", () => {
  // rv bem acima (peso 10%) e rf igual ao CDI (peso 90%)
  const r = FC.desempenho.calcula({ pontos: serie(40, { rv: 0.005, rf: 0.0004, vRv: 100, vRf: 900 }), ...refs(40, 0.0004, 0), periodo: "mes" });
  const rv = r.partes.find((p) => p.chave === "rv"), rf = r.partes.find((p) => p.chave === "rf");
  assert.ok(rf.peso > 0.8 && rv.peso < 0.2);
  perto(r.score, rv.nota * rv.peso + rf.nota * rf.peso, 1e-6);
  assert.ok(r.score < 60);
});

test("aporte no meio do período não conta como rendimento", () => {
  const p = serie(40, { rv: 0, rf: 0.0004 });
  // aporte de 5000 no dia 20, que dali em diante rende à mesma taxa
  p.slice(20).forEach((x, k) => { x.partes.rf.valor += 5000 * Math.pow(1.0004, k); x.partes.rf.fluxo += 5000; });
  const r = FC.desempenho.calcula({ pontos: p, ...refs(40, 0.0004, 0), periodo: "mes" });
  const rf = r.partes.find((x) => x.chave === "rf");
  perto(rf.retorno, rf.retorno_ref, 0.05);
});

test("sem dados · insuficiente, arco em 50", () => {
  const r = FC.desempenho.calcula({ pontos: serie(0), ...refs(5, 0.0004, 0.001), periodo: "mes" });
  assert.equal(r.suficiente, false);
  assert.equal(r.score, 50);
  // referências sem dados no período (Ibov não carregou, sem índices)
  const s = FC.desempenho.calcula({ pontos: serie(40, { rv: 0.001, vRf: 0 }), ix: null, ibov: [], periodo: "mes" });
  assert.equal(s.suficiente, false);
});

test("tendência · um ponto por dia do período, terminando na nota final", () => {
  const r = FC.desempenho.calcula({ pontos: serie(40, { rv: 0.002, rf: 0.0004 }), ...refs(40, 0.0004, 0.001), periodo: "mes" });
  assert.equal(r.tendencia.length, 30);
  perto(r.tendencia.at(-1).score, r.score, 1e-9);
});

test("série diária · as partes somam valor e fluxo do total", () => {
  const titulo = { id: 1, nome: "CDB", tipo: "prefixado", taxa: 0, valor_aplicado: 0, pilar: "caixa", criado_em: dia(-20) };
  const base = { ativos: [], rendaFixa: [titulo], agro: { movs: [], custos: [] },
    aportes: [{ id: "a", tipo: "caixa", titulo: "CDB", data: dia(-20), valor: 1000 }, { id: "b", tipo: "caixa", titulo: "CDB", data: dia(-5), valor: 300 }] };
  const { pontos } = FC.rentab.serieDiaria(base, {}, null, { agro: FC.PADRAO_AGRO, proventos: FC.PADRAO_PROVENTOS }, null, []);
  for (const p of pontos) {
    const P = p.partes;
    perto(P.rv.valor + P.rf.valor + P.agro.valor, p.valor, 1e-6);
    perto(P.rv.fluxo + P.rf.fluxo + P.agro.fluxo, p.fluxo, 1e-6);
  }
  perto(pontos.at(-1).partes.rf.valor, 1300, 1e-6);
});
