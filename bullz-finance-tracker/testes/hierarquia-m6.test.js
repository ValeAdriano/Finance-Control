/* Marco 6 — hierarquia RF › Ações › Cripto.  node --test testes/hierarquia-m6.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");
const { requisicao } = require("./mcp-req.js");
const js = (x) => JSON.parse(JSON.stringify(x));

test("M6 · carteira real (RF 1.493, Ações 1.905, Cripto 7.112) fora da ordem; plano 25/60/15 gera violação", () => {
  const { FC } = carregaNucleo();
  const H = FC.hierarquia;
  const ordem = H.ordemDaCarteira({ caixa: 1493, acoes: 1500, real_estate: 405, alternativos: 7112, agro: 50000 });
  assert.equal(ordem.respeitada, false);
  assert.equal(Math.round(ordem.valores.acoes), 1905, "ações + FIIs");
  const base = { ativos: [{ ticker: "ITUB4", pilar: "acoes" }, { ticker: "BTC", pilar: "alternativos" }], rendaFixa: [{ nome: "CDB", pilar: "caixa" }] };
  const plano = { destinos: [{ tipo: "renda_fixa", alvo: "CDB", pct: 25 }, { tipo: "ativo", alvo: "ITUB4", pct: 60 }, { tipo: "ativo", alvo: "BTC", pct: 15 }] };
  const d = H.divisaoDoPlano(plano, base);
  assert.deepEqual(js(d), { rf: 25, acoes: 60, cripto: 15 });
  const v = H.valida(d);
  assert.equal(v.ok, false);
  assert.ok(v.violacoes.some((x) => x.regra === "ordem"));
  const m = v.mais_proxima;
  assert.ok(m.rf >= m.acoes && m.acoes >= m.cripto && Math.abs(m.rf + m.acoes + m.cripto - 100) < 1e-9, JSON.stringify(m));
  assert.equal(H.valida(m).ok, true);
});

test("M6 · divisão sugerida: RF no topo com a reserva abaixo da meta, cripto no piso fora da ordem", () => {
  const { FC } = carregaNucleo();
  const s = FC.hierarquia.divisaoSugerida({ reservaAbaixo: true, foraDaOrdem: true });
  assert.deepEqual(js({ rf: s.rf, acoes: s.acoes, cripto: s.cripto }), { rf: 70, acoes: 25, cripto: 5 });
  const n = FC.hierarquia.divisaoSugerida({ reservaAbaixo: false, foraDaOrdem: false });
  assert.equal(FC.hierarquia.valida(n).ok, true);
});

test("M6 · previsão: com o aporte e os preços parados, a ordem se corrige em N meses", () => {
  const { FC } = carregaNucleo();
  const p = { caixa: 1493, acoes: 1905, alternativos: 7112 };
  const n = FC.hierarquia.mesesParaCorrigir(p, 1500, { rf: 70, acoes: 25, cripto: 5 });
  assert.ok(n > 0 && n < 60, String(n));
  // conferência à mão: no mês n vale a ordem; no n−1, não
  const g = (k) => ({ rf: 1493 + 1050 * k, acoes: 1905 + 375 * k, cripto: 7112 + 75 * k });
  const ok = (x) => x.rf >= x.acoes && x.acoes >= x.cripto && x.rf / (x.rf + x.acoes + x.cripto) >= 0.4;
  assert.equal(ok(g(n)), true);
  assert.equal(ok(g(n - 1)), false);
  assert.equal(FC.hierarquia.mesesParaCorrigir(p, 0, { rf: 70, acoes: 25, cripto: 5 }), null);
});

test("M6 · reserva dinâmica: PJ sem 13º sugere mais meses sem trocar a meta", () => {
  const { FC } = carregaNucleo();
  const prefs = FC.base.montaPrefs({ premissas: { objetivos: { meses_reserva: 6 } } });
  const pj = [{ nome: "PJ", categoria: "pj", tipo: "recorrente", valor: 4500, inicio: "2026-01-01" }];
  const r = FC.hierarquia.reservaSugerida(pj, prefs, "2026-11");
  assert.equal(r.aumentar, true);
  assert.equal(r.meses_sugerido, 12);
  assert.equal(FC.objetivos(prefs).meses_reserva, 6, "a meta não muda sozinha");
  assert.equal(FC.hierarquia.reservaSugerida([], prefs, "2026-11").aumentar, false);
});

test("M6 · MCP: resumo_patrimonio traz ordem_respeitada, meses_para_corrigir e divisao_sugerida_aporte; configurar_alocacao grava", async () => {
  const { chama, db } = await requisicao();
  const r = await chama("resumo_patrimonio");
  assert.equal(typeof r.ordem_respeitada, "boolean");
  assert.ok("meses_para_corrigir" in r);
  assert.ok(r.divisao_sugerida_aporte.rf > 0);
  const sim = await chama("configurar_alocacao", { modo_alocacao: "hierarquia", simular: true });
  assert.equal(sim.simulado, true);
  assert.equal(db.preferencias[0].hierarquia, undefined);
  await chama("configurar_alocacao", { modo_alocacao: "hierarquia" });
  assert.equal(db.preferencias[0].hierarquia.modo_alocacao, "hierarquia");
  assert.equal((await chama("resumo_patrimonio")).modo_alocacao, "hierarquia");
});
