/* Marco 7 — projeção mensal por ativo com eventos e cenários.
 *   node --test testes/projecoes-m7.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { requisicao } = require("./mcp-req.js");
const { contaAdriano } = require("./conta-adriano.js");
const { carregaNucleo } = require("./nucleo.js");

// meses do mês que vem até junho de 2027
const ate = (alvo) => { const h = new Date().toISOString().slice(0, 7); const [a, m] = h.split("-").map(Number), [b, n] = alvo.split("-").map(Number); return (b - a) * 12 + (n - m); };
const dentro = (v, alvo, tol, msg) => assert.ok(Math.abs(v - alvo) <= alvo * tol, `${msg}: ${v} fora de ${alvo} ± ${tol * 100}%`);

async function projetaAdriano(eventos) {
  const { FC, chama } = await requisicao({ db: contaAdriano() });
  const e = await FC.base.carrega({ comMercado: true, comProventos: true });
  // taxas fixas: o teste confere o motor, não a fixture de mercado
  const r = FC.projecaoMensal.projeta(e, { meses: ate("2027-06"), cenario: "historico", taxas: { acoes: 12, cripto: 15 }, eventos });
  return { r, chama, e, FC };
}

test("M7 · carteira e plano do Adriano até 06/2027, cenário histórico, sem vender o gado → total sem agro em torno de R$ 33 mil", { skip: ate("2027-06") < 1 && "depois de jun/2027" }, async () => {
  const { r } = await projetaAdriano([]);
  assert.equal(r.final.mes, "2027-06");
  console.log("# M7 sem venda: total sem agro em", r.final.mes, "=", r.final.total_sem_agro.toFixed(2));
  dentro(r.final.total_sem_agro, 33000, 0.03, "total sem agro");
  // o aporte de dezembro é o do plano fixo + sobra com estágio e PJ proporcionais
  const dez = r.serie.find((p) => p.mes === "2026-12");
  if (dez) assert.ok(Math.abs(dez.aporte - 1507.28) < 0.02, `aporte de dezembro ${dez.aporte}`);
  const jan = r.serie.find((p) => p.mes === "2027-01");
  if (jan) assert.ok(Math.abs(jan.aporte - 3193.95) < 0.02, `aporte de janeiro ${jan.aporte}`);
});

test("M7 · com a venda do gado em fevereiro (6 × R$ 6.000) → em torno de R$ 70 mil", { skip: ate("2027-06") < 1 && "depois de jun/2027" }, async () => {
  const { r } = await projetaAdriano([{ data: "2027-02-15", tipo: "venda_agro", parametros: { valor: 36000, cabecas: 6 }, descricao: "venda do gado" }]);
  console.log("# M7 com venda: total sem agro em", r.final.mes, "=", r.final.total_sem_agro.toFixed(2));
  dentro(r.final.total_sem_agro, 70000, 0.03, "total sem agro com a venda");
  assert.equal(Math.round(r.final.por_categoria.agro), 0, "o rebanho todo foi vendido");
  assert.ok(r.serie.find((p) => p.mes === "2027-02").eventos.length === 1);
});

test("M7 · cenários: só proventos rende menos que o histórico; estresse aplica o choque na cripto", async () => {
  const { FC } = await requisicao({ db: contaAdriano() });
  const e = await FC.base.carrega({ comMercado: true });
  const taxas = { acoes: 12, cripto: 15, "dy:ITSA4": 8, "dy:MXRF11": 12, "dy:BTC": 0 };
  const h = FC.projecaoMensal.projeta(e, { meses: 6, cenario: "historico", taxas });
  const p = FC.projecaoMensal.projeta(e, { meses: 6, cenario: "so_proventos", taxas });
  const s = FC.projecaoMensal.projeta(e, { meses: 6, cenario: "estresse", taxas });
  assert.ok(p.final.total < h.final.total);
  const cripto = (x) => x.serie[0].por_categoria.cripto;
  assert.ok(Math.abs(cripto(s) / cripto(h) - 0.7) < 0.05, "choque de −30% no 1º mês");
});

test("M7 · taxa histórica com proventos reinvestidos", () => {
  const { FC } = carregaNucleo();
  // 2 anos subindo de 10 para 12,1 (10% a.a.) e 1 real de provento por ano
  const precos = [], dividendos = [];
  for (let i = 0; i <= 730; i++) { const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10); precos.push([d, 10 * Math.pow(1.1, i / 365)]); }
  dividendos.push([precos[200][0], 1], [precos[565][0], 1]);
  const t = FC.projecaoMensal.taxaHistorica({ precos, dividendos }, 5);
  assert.ok(t.retorno_aa > 14 && t.retorno_aa < 20, String(t.retorno_aa));
  assert.ok(t.dy_aa > 8 && t.dy_aa < 10, String(t.dy_aa));
  assert.equal(FC.projecaoMensal.taxaHistorica({ precos: precos.slice(0, 100) }), null, "menos de um ano não vira taxa");
});

test("M7 · MCP: projetar por meses e por anos; vendas planejadas viram eventos; registrar_evento simula e grava", async () => {
  const db = contaAdriano();
  const { chama } = await requisicao({ db });
  const m = await chama("projetar", { meses: 6 });
  assert.equal(m.serie.length, 6);
  const a = await chama("projetar", { anos: 2 });
  assert.ok(a.serie.length >= 2 && a.serie[0].ano);
  const lote = (await chama("agro_resumo")).lotes[0];
  await chama("planejar_venda_agro", { lote: lote.chave, data_prevista: "2027-02-15", preco_esperado_cabeca: 6000, nome: "Lote maio" });
  const ev = await chama("listar_eventos");
  assert.ok(ev.eventos.some((x) => x.tipo === "venda_agro" && x.origem === "venda_planejada"));
  const sim = await chama("registrar_evento", { data: "2027-03-10", tipo: "aporte_extra", valor: 5000, simular: true });
  assert.ok(sim.diferenca > 4999, JSON.stringify(sim));
  assert.equal((db.eventos_futuros || []).length, 0);
  await chama("registrar_evento", { data: "2027-03-10", tipo: "aporte_extra", valor: 5000 });
  assert.equal(db.eventos_futuros.length, 1);
});
