/* Marco 1 — correção dos bugs de dados.
 *
 *   node --test testes/dados-m1.test.js
 *
 * Fixtures que reproduzem os sintomas vistos na conta real (com números
 * fictícios): custo nulo com preço médio (BTC, SOL, BNB), resultado de bolsa
 * e cripto que não fecha, retorno absurdo por venda sem preço, aplicado
 * divergente, cotação zerada com nota alta, premissa de aporte duplicada,
 * proventos em dois lugares e salário com fim divergente. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");
const { mercado: mercadoFixture, dia } = require("./mcp-fixture.js");

const js = (x) => JSON.parse(JSON.stringify(x));   // arrays do vm são de outro realm
const perto = (a, b, tol = 0.01, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} esperava ${b}, veio ${a}`);

/** monta o retrato com uma base e preços controlados */
function retrato(FC, { ativos = [], aportes = [], precos = {}, prefsBrutas = {}, ganhos = [] }) {
  const itens = ativos.map((a) => ({ ticker: a.ticker, classe: a.classe }));
  const historicos = mercadoFixture({ acao: "historicos", itens, anos: 2 });
  const spot = {};
  for (const [t, p] of Object.entries(precos)) {
    if (p > 0) spot[t] = { preco: p, variacao_dia: 0, quando: dia(0) + "T12:00:00Z", fonte: "teste" };
    else if (historicos[t]) { historicos[t].preco = p; historicos[t].precos = historicos[t].precos.map(([d]) => [d, p]); }
  }
  const base = { ativos: ativos.map((a, i) => ({ id: i + 1, lista: "carteira", quantidade: 0, preco_medio: null, criado_em: dia(-800), ...a })),
    rendaFixa: [], aportes: aportes.map((a, i) => ({ id: "ap" + i, tipo: "ativo", origem: null, historico: false, ...a })),
    prefsBrutas, ganhos, historico: [], agro: { movs: [], custos: [], pesagens: [] } };
  const prefs = FC.base.montaPrefs(prefsBrutas);
  const merc = { universo: mercadoFixture({ acao: "universo" }), historicos, spot };
  FC.estado = { base, prefs, mercado: merc };
  const dados = FC.carteira.monta(base, merc, prefs);
  FC.estado.dados = dados;
  return { base, prefs, dados, estado: FC.estado };
}

// ---------------------------------------------------------------- 1. custo nulo
test("M1.1 · extrato sem preço por cota: o custo sai dos lançamentos (BTC, SOL)", () => {
  const { FC } = carregaNucleo();
  const { dados } = retrato(FC, {
    ativos: [{ ticker: "BTC", classe: "cripto", pilar: "alternativos" }, { ticker: "SOL", classe: "cripto", pilar: "alternativos" }],
    aportes: [
      // Binance importada: só o total da operação
      { data: dia(-200), ticker: "BTC", quantidade: 0.004, preco: null, valor: 1400 },
      { data: dia(-100), ticker: "BTC", quantidade: 0.002, preco: null, valor: 800 },
      { data: dia(-150), ticker: "SOL", quantidade: 2, preco: null, valor: 1700 },
    ],
    precos: { BTC: 600000, SOL: 900 },
  });
  const btc = dados.ativos.find((a) => a.ticker === "BTC").posicao;
  perto(btc.custo, 2200, 0.001, "custo do BTC");
  perto(btc.preco_medio, 2200 / 0.006, 0.001);
  assert.equal(btc.custo_estimado, false);
  const sol = dados.ativos.find((a) => a.ticker === "SOL").posicao;
  perto(sol.custo, 1700, 0.001, "custo do SOL");
});

test("M1.1 · sem lançamento com preço: custo = preço médio × quantidade, marcado como estimado (BNB)", () => {
  const { FC } = carregaNucleo();
  const { dados } = retrato(FC, {
    ativos: [{ ticker: "BNB", classe: "cripto", pilar: "alternativos", quantidade: 0.1, preco_medio: 4000 }],
    // compra sem preço nem valor (só a quantidade chegou)
    aportes: [{ data: dia(-50), ticker: "BNB", quantidade: 0.05, preco: null, valor: 0 }],
    precos: { BNB: 4500 },
  });
  const p = dados.ativos[0].posicao;
  perto(p.custo, 4000 * 0.15, 0.001);
  assert.equal(p.custo_estimado, true);
});

// ---------------------------------------------------------------- 2. resultado
test("M1.2 · bolsa e cripto: resultado = valor − custo sobre o mesmo conjunto", () => {
  const { FC } = carregaNucleo();
  const { dados, estado } = retrato(FC, {
    ativos: [
      { ticker: "ITSA4", classe: "acao_br", pilar: "acoes", quantidade: 100, preco_medio: 9 },
      // posição sem custo nenhum (nem preço médio): entra no valor total, não no resultado
      { ticker: "ETH", classe: "cripto", pilar: "alternativos", quantidade: 1 },
    ],
    precos: { ITSA4: 10.42, ETH: 18000 },
  });
  const r = dados.resumo;
  perto(r.investido, 900);
  perto(r.atual_com_custo, 1042);
  perto(r.resultado, r.atual_com_custo - r.investido);
  assert.ok(r.resultado > 0, "custo menor que o valor tem de dar resultado positivo");
  assert.deepEqual(js([...r.sem_custo]), ["ETH"]);
  assert.equal(FC.auditoria.verifica(estado).filter((x) => x.tipo === "resultado_incoerente").length, 0);
});

// ---------------------------------------------------------------- 3. retornos
test("M1.3 · venda importada sem preço não derruba o retorno (SOL: −97% era erro)", () => {
  const { FC } = carregaNucleo();
  const hoje = FC.datas.hoje();
  const { dados } = retrato(FC, {
    ativos: [{ ticker: "SOL", classe: "cripto", pilar: "alternativos" }],
    aportes: [
      { data: dia(-300), ticker: "SOL", quantidade: 10, preco: 1000, valor: 10000 },
      { data: dia(-150), ticker: "SOL", quantidade: -4, preco: null, valor: -3000, venda: true },
    ],
    precos: { SOL: 430 },
  });
  const r = dados.rentab.ativos.find((a) => a.ticker === "SOL");
  // Modified Dietz à mão: ganho = 6×430 + 3000 − 10000; capital médio = 10000×1 − 3000×(150/300)
  const T = FC.datas.dias(dia(-300), hoje), w = FC.datas.dias(dia(-150), hoje) / T;
  const esperado = ((6 * 430 + 3000 - 10000) / (10000 - 3000 * w)) * 100;
  perto(r.periodo_pct, esperado, 0.05, "retorno do SOL");
  assert.ok(r.periodo_pct > -70 && r.periodo_pct < -40, `retorno fora do plausível: ${r.periodo_pct}`);
  perto(r.devolvido, 3000, 0.001, "a venda volta como dinheiro devolvido");
});

test("M1.3 · capital médio pequeno demais: retorno null com motivo, não um percentual absurdo", () => {
  const { FC } = carregaNucleo();
  const hoje = FC.datas.hoje();
  // aplicou 10 mil, tirou quase tudo logo depois e voltou com 50 reais na véspera
  const fluxos = [{ data: dia(-365), valor: -10000 }, { data: dia(-364), valor: 9990 }, { data: dia(-1), valor: -50 }];
  const d = FC.rentab.dietzDetalhe(fluxos, 30, hoje);
  assert.equal(d.pct, null);
  assert.match(d.motivo, /capital médio/);
  const r = FC.rentab.dietzDetalhe([{ data: dia(-365), valor: -1000 }], 1100, hoje);
  perto(r.pct, 10, 1e-9);
});

// ---------------------------------------------------------------- 4. aplicado
test("M1.4 · reconciliação: aplicado da rentabilidade = custo da posição (BNB)", () => {
  const { FC } = carregaNucleo();
  const { dados, estado } = retrato(FC, {
    ativos: [{ ticker: "BNB", classe: "cripto", pilar: "alternativos" }],
    aportes: [
      { data: dia(-120), ticker: "BNB", quantidade: 0.1, preco: null, valor: 431.3 },
      { data: dia(-60), ticker: "BNB", quantidade: 0.1361, preco: 4313, valor: 587.0 },
    ],
    precos: { BNB: 4100 },
  });
  const pos = dados.ativos[0].posicao, r = dados.rentab.ativos[0];
  perto(r.aplicado, pos.custo, 0.005, "aplicado × custo");
  perto(pos.custo, 431.3 + 0.1361 * 4313, 0.005);
  assert.equal(FC.auditoria.verifica(estado).filter((x) => x.tipo === "aplicado_divergente").length, 0);
});

// ---------------------------------------------------------------- 5. cotação quebrada
test("M1.5 · cotação zerada: marcada, sem nota e fora das sugestões (VCJR11)", () => {
  const { FC } = carregaNucleo();
  const { dados, estado } = retrato(FC, {
    ativos: [{ ticker: "VCJR11", classe: "fii", pilar: "real_estate", quantidade: 10, preco_medio: 9.5 },
      { ticker: "MXRF11", classe: "fii", pilar: "real_estate", quantidade: 10, preco_medio: 9.5 }],
    precos: { VCJR11: 0, MXRF11: 9.68 },
  });
  const v = dados.ativos.find((a) => a.ticker === "VCJR11");
  assert.equal(v.cotacao_quebrada, true);
  assert.equal(v.score, null, "a nota de um ativo sem cotação não pode ranquear");
  assert.equal(v.posicao, null);
  assert.deepEqual(js([...dados.resumo.cotacao_quebrada]), ["VCJR11"]);
  const achados = FC.auditoria.verifica(estado);
  assert.deepEqual(js(achados.filter((x) => x.tipo === "cotacao_quebrada").map((x) => x.onde)), ["VCJR11"]);
  assert.equal(dados.ativos.find((a) => a.ticker === "MXRF11").cotacao_quebrada, undefined);
});

// ---------------------------------------------------------------- 6. premissa × plano
test("M1.6 · plano configurado é a fonte do aporte; premissa vira derivada", () => {
  const { FC } = carregaNucleo();
  const brutas = { premissas: { aporte_mensal: 2000 }, plano: { modo: "percentual", percentual: 50, destinos: [{ tipo: "pilar", alvo: "caixa", pct: 100 }] } };
  const prefs = FC.base.montaPrefs(brutas);
  assert.equal(prefs.premissas.aporte_mensal_fonte, "plano");
  assert.equal(FC.base.montaPrefs({ premissas: { aporte_mensal: 2000 } }).premissas.aporte_mensal_fonte, "premissa");
  const { estado } = retrato(FC, { prefsBrutas: brutas });
  assert.equal(FC.auditoria.verifica(estado).filter((x) => x.tipo === "premissa_duplicada").length, 1);
  const { estado: e2 } = retrato(FC, { prefsBrutas: { ...brutas, premissas: { aporte_mensal: 2000, aporte_mensal_obsoleta: true } } });
  assert.equal(FC.auditoria.verifica(e2).filter((x) => x.tipo === "premissa_duplicada").length, 0);
});

// ---------------------------------------------------------------- 7. proventos
test("M1.7 · destino dos proventos explícito; o booleano é derivado", () => {
  const { FC } = carregaNucleo();
  const caso = (plano, proventos) => FC.base.montaPrefs({ plano, proventos }).plano;
  // o caso da conta real: reinvestir true com caixa de proventos ligado
  let p = caso({ reinvestir_dividendos: true }, { destino: "caixa" });
  assert.equal(p.destino_proventos, "caixa");
  assert.equal(p.reinvestir_dividendos, true);
  p = caso({ reinvestir_dividendos: true }, null);
  assert.equal(p.destino_proventos, "mesmo_ativo");
  p = caso({ reinvestir_dividendos: false }, null);
  assert.equal(p.destino_proventos, "caixa");
  assert.equal(p.reinvestir_dividendos, false);
  p = caso({ destino_proventos: "pote:abc", reinvestir_dividendos: true }, null);
  assert.equal(p.destino_proventos, "pote:abc");
  assert.equal(p.reinvestir_dividendos, false);
  const { estado } = retrato(FC, { prefsBrutas: { plano: { reinvestir_dividendos: true }, proventos: { destino: "caixa" } } });
  assert.equal(FC.auditoria.verifica(estado).filter((x) => x.tipo === "proventos_ambiguos").length, 1);
});

// ---------------------------------------------------------------- 8. salário
test("M1.8 · fim do contrato separado do último pagamento", () => {
  const { FC } = carregaNucleo();
  const g = { nome: "Salário AGVS", tipo: "recorrente", valor: 2300, inicio: "2026-03-05", fim: "2026-11-06", data_fim_contrato: "2026-11-23" };
  const { estado } = retrato(FC, { ganhos: [g] });
  assert.deepEqual(js(FC.auditoria.verifica(estado).filter((x) => x.tipo === "ganho_fim_divergente").map((x) => x.onde)), ["Salário AGVS"]);
  const ok = { ...g, fim: "2026-11-23", data_ultimo_pagamento: "2026-12-05" };
  const { estado: e2 } = retrato(FC, { ganhos: [ok] });
  assert.equal(FC.auditoria.verifica(e2).length, 0);
  // a renda do mês segue o último pagamento, não o fim do contrato
  assert.equal(FC.salario.valeNoMes(ok, "2026-12"), true);
  assert.equal(FC.salario.valeNoMes(ok, "2027-01"), false);
});

// ---------------------------------------------------------------- 9. auditoria
test("M1.9 · auditar_dados não aponta nada numa base coerente", () => {
  const { FC } = carregaNucleo();
  const { estado } = retrato(FC, {
    ativos: [{ ticker: "ITSA4", classe: "acao_br", pilar: "acoes" }, { ticker: "BTC", classe: "cripto", pilar: "alternativos" }],
    aportes: [
      { data: dia(-200), ticker: "ITSA4", quantidade: 100, preco: 9, valor: 900 },
      { data: dia(-100), ticker: "BTC", quantidade: 0.004, preco: null, valor: 1400 },
    ],
    precos: { ITSA4: 10.42, BTC: 600000 },
    prefsBrutas: { plano: { destino_proventos: "mesmo_ativo", reinvestir_dividendos: true, destinos: [] } },
  });
  assert.deepEqual(js(FC.auditoria.verifica(estado)), []);
});
