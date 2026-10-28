/* Projeção (FC.projecao): Monte Carlo, juro convergindo, vencimento,
 * IR no resgate e independência financeira.
 *
 *   node --test testes/projecao.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");

const { FC } = carregaNucleo();
const HOJE = "2026-01-15";
const perto = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);

// série diária sintética com volatilidade anual `vol` (sorteio fixo)
function serie(dias, vol, semente = 7) {
  const rnd = FC.projecao._interno.mulberry32(semente), s = [];
  let p = 100;
  for (let i = 0; i < dias; i++) {
    const z = Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
    p *= Math.exp((vol / Math.sqrt(252)) * z);
    s.push([new Date(Date.UTC(2023, 0, 1) + i * 86400000).toISOString().slice(0, 10), p]);
  }
  return s;
}

function dados(extra = {}) {
  return {
    ativos: [
      { ticker: "AAA3", pilar: "acoes", posicao: { atual: 10000, custo: 8000 }, metricas: [{ chave: "dy", valor: 6 }], serie_preco: serie(900, 0.3) },
      { ticker: "FII11", pilar: "real_estate", posicao: { atual: 5000, custo: 5000 }, metricas: [{ chave: "dy", valor: 10 }], serie_preco: serie(900, 0.12, 3) },
    ],
    rendaFixa: [{ nome: "CDB Banco", tipo: "cdi", taxa: 100, valor_aplicado: 20000, principal: 18000 }],
    macro: { cdi: 14.9, ipca_12m: 5 }, alocacao_alvo: { acoes: 40, real_estate: 30, caixa: 30 }, resumo: { agro: 0 },
    ...extra,
  };
}
const prem = (extra = {}) => ({ ...FC.PADRAO_PREMISSAS, aporte_mensal: 2000, horizonte_anos: 20, ...extra });
const projeta = (d, p, o = {}) => FC.projecao.projeta(d, p, { hoje: HOJE, caminhos: 300, ...o });

test("sem volatilidade, todos os caminhos são o determinístico", () => {
  const p = projeta(dados(), prem({ volatilidade: { acoes: 0, real_estate: 0 } }));
  // o caixa ainda tem o choque mínimo de inflação: tolerância pequena
  perto(p.mc.p50.final, p.base.final, p.base.final * 0.01);
  perto(p.mc.p10.final, p.mc.p90.final, p.base.final * 0.03);
});

test("mesmo dado, mesmo resultado (sorteio fixo)", () => {
  const a = projeta(dados(), prem()), b = projeta(dados(), prem());
  assert.equal(a.mc.p10.final, b.mc.p10.final);
  assert.equal(a.mc.p90.final, b.mc.p90.final);
});

test("mais volatilidade abre o leque", () => {
  const baixa = projeta(dados(), prem({ volatilidade: { acoes: 10, real_estate: 5 } }));
  const alta = projeta(dados(), prem({ volatilidade: { acoes: 40, real_estate: 20 } }));
  assert.ok(alta.mc.p90.final - alta.mc.p10.final > 1.5 * (baixa.mc.p90.final - baixa.mc.p10.final));
  // rebalancear entre pilares voláteis rende um pouco acima da soma das
  // medianas (retorno de diversificação), mas não a ponto de virar outra conta
  assert.ok(alta.mc.p50.final >= alta.base.final * 0.95 && alta.mc.p50.final <= alta.base.final * 1.35);
});

test("a volatilidade observada entra misturada à referência", () => {
  const p = projeta(dados(), prem());
  const acoes = p.pilares.find((l) => l.chave === "acoes");
  // a série sintética anda todo dia corrido: ~36% ao ano, mais o ruído da amostra
  assert.ok(acoes.vol_observada > 25 && acoes.vol_observada < 55, String(acoes.vol_observada));
  // a mistura fica entre a observada e a referência de 25%
  const lo = Math.min(acoes.vol_observada, 25), hi = Math.max(acoes.vol_observada, 25);
  assert.ok(acoes.volatilidade >= lo - 1e-9 && acoes.volatilidade <= hi + 1e-9);
  assert.match(acoes.vol_origem, /meses/);
});

test("o CDI converge para o longo prazo e o caixa rende menos no fim", () => {
  const p = projeta(dados(), prem());
  perto(p.macro_lp.juro_real, FC.projecao.LONGO_PRAZO.juro_real, 1e-6);
  const cx = p.pilares.find((l) => l.chave === "caixa");
  assert.ok(cx.total > cx.total_lp, `${cx.total} > ${cx.total_lp}`);
  perto(cx.total_lp, FC.projecao.LONGO_PRAZO.juro_real, 0.05);
});

test("prefixado segue a taxa até vencer e depois vira CDI", () => {
  const d = dados({ rendaFixa: [{ nome: "CDB pré", tipo: "prefixado", taxa: 20, valor_aplicado: 10000, vencimento: "2027-01-15" }] });
  const p = projeta(d, prem({ aporte_mensal: 0 }));
  const t = p.titulos_caixa[0];
  assert.equal(t.vence_em_meses, 12);
  const cx = p.pilares.find((l) => l.chave === "caixa");
  // 20% nominal com IPCA de ~5% dá ~14% real no começo; no fim, o CDI real
  assert.ok(cx.total > 12);
  perto(cx.total_lp, FC.projecao.LONGO_PRAZO.juro_real, 0.05);
});

test("IR: título isento não paga; ganho em FII paga 20%", () => {
  const so = (rf, ativos) => projeta(dados({ rendaFixa: rf, ativos, alocacao_alvo: {} }), prem({ aporte_mensal: 0, horizonte_anos: 10 }), { aporte_para: false });
  const lca = so([{ nome: "LCA Banco", tipo: "cdi", taxa: 100, valor_aplicado: 10000 }], []);
  perto(lca.base.final_liquido, lca.base.final, 1e-6);
  const cdb = so([{ nome: "CDB Banco", tipo: "cdi", taxa: 100, valor_aplicado: 10000 }], []);
  perto(cdb.base.final - cdb.base.final_liquido, (cdb.base.final - 10000) * 0.15, 1);
  const fii = so([], [{ ticker: "FII11", pilar: "real_estate", posicao: { atual: 10000, custo: 10000 }, metricas: [], serie_preco: [] }]);
  perto(fii.base.final - fii.base.final_liquido, (fii.base.final - 10000) * 0.2, 1);
});

test("independência: patrimônio-alvo e chance nos extremos", () => {
  const p = projeta(dados({ objetivos: { renda_desejada_mensal: 5000 } }), prem({ taxa_saque: 4 }));
  assert.equal(p.independencia.patrimonio_alvo, (5000 * 12) / 0.04);
  assert.equal(p.independencia.renda_alvo_origem, "objetivos");
  const facil = projeta(dados(), prem({ renda_alvo: 10 }));
  assert.equal(facil.independencia.chance_no_horizonte, 100);
  assert.equal(facil.independencia.ja_atingido, true);
  const impossivel = projeta(dados(), prem({ renda_alvo: 10000000 }), { aporte_para: false });
  assert.equal(impossivel.independencia.chance_no_horizonte, 0);
  assert.equal(projeta(dados(), prem()).independencia, null);
});

test("o aporte para 80% de chance de fato chega lá", () => {
  const d = dados({ objetivos: { renda_desejada_mensal: 8000 } });
  const p = projeta(d, prem());
  const ap = p.independencia.aporte_para_80;
  assert.ok(ap > 2000, String(ap));
  const com = projeta(d, prem({ aporte_mensal: ap * 1.03 }), { aporte_para: false });
  assert.ok(com.independencia.chance_no_horizonte >= 75, String(com.independencia.chance_no_horizonte));
});

test("aporte crescendo acima da inflação aumenta o total aportado", () => {
  const fixo = projeta(dados(), prem(), { aporte_para: false });
  const cresce = projeta(dados(), prem({ crescimento_aporte_real: 2 }), { aporte_para: false });
  perto(fixo.base.aportado, 2000 * 240, 1e-6);
  assert.ok(cresce.base.aportado > fixo.base.aportado * 1.2);
});
