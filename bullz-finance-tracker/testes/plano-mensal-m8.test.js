/* Marco 8 — plano mensal com snapshot, execução e histórico.
 *   node --test testes/plano-mensal-m8.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { requisicao, recusa } = require("./mcp-req.js");
const { contaAdriano } = require("./conta-adriano.js");

const perto = (a, b, tol = 0.01, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} esperava ${b}, veio ${a}`);
const HOJE = new Date().toISOString().slice(0, 10), MES = HOJE.slice(0, 7);
let seq = 0;
const ap = (campos) => ({ id: "ap-m8-" + ++seq, ticker: null, quantidade: null, preco: null, titulo: null, observacao: "", origem: null, historico: false,
  venda: false, indexador: null, taxa: null, do_provento: null, criado_em: campos.data, ...campos });

/** a conta com novembro de 2026 como o plano descreve: renda 2.580, plano de 50% e os 5 aportes */
function contaNovembro() {
  const db = contaAdriano();
  db.ativos.push({ id: 4, ticker: "ITUB4", classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 0, preco_medio: null, criado_em: "2026-06-01" },
    { id: 5, ticker: "ETH", classe: "cripto", pilar: "alternativos", lista: "carteira", quantidade: 0, preco_medio: null, criado_em: "2026-06-01" },
    { id: 6, ticker: "BNB", classe: "cripto", pilar: "alternativos", lista: "carteira", quantidade: 0, preco_medio: null, criado_em: "2026-06-01" });
  db.preferencias[0].plano = { modo: "percentual", percentual: 50, destino_proventos: "mesmo_ativo",
    destinos: [{ tipo: "renda_fixa", alvo: "CDB Liquidez", pct: 25 }, { tipo: "pilar", alvo: "acoes", pct: 60 }, { tipo: "ativo", alvo: "BTC", pct: 10 }, { tipo: "ativo", alvo: "ETH", pct: 5 }] };
  db.aportes = [
    ap({ tipo: "caixa", data: "2026-11-06", titulo: "CDB Liquidez", valor: 322.5 }),
    ap({ tipo: "ativo", data: "2026-11-07", ticker: "MXRF11", quantidade: 50, preco: 9.6922, valor: 484.61 }),
    ap({ tipo: "ativo", data: "2026-11-07", ticker: "ITUB4", quantidade: 10, preco: 36.045, valor: 360.45 }),
    ap({ tipo: "ativo", data: "2026-11-08", ticker: "BTC", quantidade: 0.0002, preco: 645000, valor: 129 }),
    ap({ tipo: "ativo", data: "2026-11-08", ticker: "ETH", quantidade: 0.004, preco: 16125, valor: 64.5 }),
  ];
  return db;
}

test("M8 · backfill de nov/2026: meta R$ 1.290, aportado R$ 1.290 (100%) e os 5 destinos", async () => {
  const db = contaNovembro();
  const { chama } = await requisicao({ db });
  const r = await chama("reconstruir_planos_mensais", { meses: ["2026-11"] });
  const p = r.planos[0];
  assert.equal(p.status, "fechado");
  assert.equal(p.origem, "reconstruido");
  assert.equal(p.meta, 1290);
  assert.equal(p.aportado, 1290);
  assert.equal(p.pct_executado, 100);
  const exec = Object.fromEntries(p.destinos.map((d) => [d.alvo, d.aportado]));
  assert.deepEqual(exec, { "CDB Liquidez": 322.5, MXRF11: 484.61, ITUB4: 360.45, BTC: 129, ETH: 64.5 });
  assert.ok(p.selos.includes("100% executado"));
  // o que passou do previsto aparece no investido, e a hierarquia violada diz o porquê
  perto(p.investido, 1361.06);
  assert.equal(p.hierarquia_respeitada, false);
  assert.match(p.hierarquia_violacoes[0], /^Ações \(62\.1%\) acima da renda fixa \(23\.7%\)$/);
  // rodar de novo não duplica
  const de2 = await chama("reconstruir_planos_mensais", { meses: ["2026-11"] });
  assert.equal(de2.planos[0].pulado, "já tem plano");
  assert.equal(db.planos_mensais.length, 1);
});

test("M8 · mudar preferencias.plano depois de fechar nov/2026 não muda nenhum número de nov/2026", async () => {
  const db = contaNovembro();
  const { chama } = await requisicao({ db });
  await chama("reconstruir_planos_mensais", { meses: ["2026-11"] });
  const antes = await chama("detalhar_plano_mensal", { mes: "2026-11" });
  db.preferencias[0].plano = { modo: "fixo_mais_sobra", valor_fixo: 2000, destinos: [{ tipo: "pilar", alvo: "alternativos", pct: 100 }] };
  db.preferencias[0].hierarquia = { modo_alocacao: "metas_fixas" };
  const depois = await chama("detalhar_plano_mensal", { mes: "2026-11" });
  const sem = (x) => { const { log, ...r } = x; return r; };
  assert.deepEqual(sem(depois), sem(antes));
  const s = await chama("salario_e_plano", { mes: "2026-11" });
  assert.equal(s.plano_salvo, true);
  assert.equal(s.plano_mensal.meta, 1290);
});

test("M8 · gerar_plano_mensal(2026-12): estágio até 23/11, PJ de R$ 4.500 desde 24/11, vaga, DAS e despesas → R$ 1.507,28 e 70/25/5", async () => {
  const db = contaAdriano();
  const { chama } = await requisicao({ db });
  const r = await chama("gerar_plano_mensal", { mes: "2026-12" });
  assert.equal(r.status, "rascunho");
  perto(r.meta, 1507.28, 0.005, "a investir");
  const pct = Object.fromEntries(r.destinos.filter((d) => d.tipo === "categoria").map((d) => [d.alvo, d.pct]));
  assert.deepEqual(pct, { rf: 70, acoes: 25, cripto: 5 });
  // de onde vem cada número
  assert.ok(r.renda_detalhe.some((x) => /23|novembro/.test(x.origem)), JSON.stringify(r.renda_detalhe));
  assert.equal(r.impostos_previstos, 86.05);
  assert.equal(r.despesas_previstas, 1500);
  // gerar de novo devolve o existente
  assert.equal((await chama("gerar_plano_mensal", { mes: "2026-12" })).existente, true);
});

test("M8 · rascunho 25% RF / 60% Ações / 15% Cripto não ativa sem aceitar_violacao", async () => {
  const db = contaAdriano();
  const { chama } = await requisicao({ db });
  await chama("gerar_plano_mensal", { mes: "2026-12" });
  const destinos = [{ tipo: "categoria", alvo: "rf", pct: 25, valor: 376.82 }, { tipo: "categoria", alvo: "acoes", pct: 60, valor: 904.37 }, { tipo: "categoria", alvo: "cripto", pct: 15, valor: 226.09 }];
  const ed = await chama("editar_plano_mensal", { mes: "2026-12", destinos });
  assert.ok(ed.alerta_hierarquia, "a edição já avisa");
  await recusa(chama("ativar_plano_mensal", { mes: "2026-12" }), /viola a hierarquia.*mais próxima/);
  assert.equal(db.planos_mensais[0].status, "rascunho");
  const ok = await chama("ativar_plano_mensal", { mes: "2026-12", aceitar_violacao: true });
  assert.equal(ok.status, "ativo");
  assert.equal(db.planos_mensais[0].regras_snapshot.aceitar_violacao, true);
});

test("M8 · aporte em BNB num mês sem BNB nos destinos vai para fora_do_plano; movimento interno não muda o aportado", async () => {
  const db = contaNovembro();
  const { chama } = await requisicao({ db });
  await chama("gerar_plano_mensal", { mes: MES });
  await chama("editar_plano_mensal", { mes: MES, destinos: [{ tipo: "categoria", alvo: "rf", pct: 70, valor: 700 }, { tipo: "ativo", alvo: "ITSA4", pct: 25, valor: 250 }, { tipo: "ativo", alvo: "BTC", pct: 5, valor: 50 }], meta_total: 1000 });
  await chama("ativar_plano_mensal", { mes: MES, aceitar_violacao: true });
  db.aportes = [ap({ tipo: "ativo", data: HOJE, ticker: "BNB", quantidade: 0.01, preco: 4313, valor: 43.13 }), ap({ tipo: "ativo", data: HOJE, ticker: "ITSA4", quantidade: 10, preco: 10.42, valor: 104.2 })];
  let d = await chama("detalhar_plano_mensal", { mes: MES });
  assert.deepEqual(d.fora_do_plano_itens.map((x) => x.ticker), ["BNB"]);
  assert.equal(d.fora_do_plano, 43.13);
  assert.equal(d.aportado, 104.2);
  // um movimento interno no mês (BTC → CDB) não mexe no aportado
  await chama("registrar_movimento_interno", { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.001, destino_tipo: "titulo_rf", destino_id: "CDB Liquidez" });
  d = await chama("detalhar_plano_mensal", { mes: MES });
  assert.equal(d.aportado, 104.2);
  assert.equal(d.destinos[0].aportado, 0, "o CDB recebido pelo movimento interno não é aporte do plano");
});

test("M8 · um ativo por vez, fechar apura o realizado e reabrir exige motivo e fica no log", async () => {
  const db = contaAdriano();
  const { chama } = await requisicao({ db });
  await chama("gerar_plano_mensal", { mes: "2026-12" });
  await chama("ativar_plano_mensal", { mes: "2026-12" });
  await chama("gerar_plano_mensal", { mes: "2027-01" });
  const a = await chama("ativar_plano_mensal", { mes: "2027-01" });
  assert.match(a.avisos[0], /2026-12 estava ativo e foi fechado/);
  assert.equal(db.planos_mensais.find((p) => p.mes === "2026-12").status, "fechado");
  await recusa(chama("reabrir_plano_mensal", { mes: "2026-12", motivo: "corrigir" }), /está ativo/);
  await chama("fechar_plano_mensal", { mes: "2027-01" });
  await chama("reabrir_plano_mensal", { mes: "2026-12", motivo: "lançamento esquecido" });
  const d = await chama("detalhar_plano_mensal", { mes: "2026-12" });
  assert.equal(d.status, "ativo");
  assert.ok(d.log.some((l) => l.acao === "reabrir" && l.motivo === "lançamento esquecido"));
  const l = await chama("listar_planos_mensais");
  assert.deepEqual(l.planos.map((p) => p.mes), ["2027-01", "2026-12"]);
});

test("M8 · o rascunho gravado só leva colunas que existem em planos_mensais (erro despesas_origem)", async () => {
  const { supabaseFalso } = require("./mcp-fixture.js");
  // o banco falso recusa coluna inexistente, como o PostgREST
  const sb = supabaseFalso({ planos_mensais: [] });
  const r = await sb.cliente.from("planos_mensais").insert({ mes: "2026-12", despesas_origem: "premissa" }).select().single();
  assert.equal(r.error.code, "PGRST204");
  assert.match(r.error.message, /despesas_origem/);
  // o que o app e o MCP gravam passa
  const db = contaAdriano();
  const { chama, FC } = await requisicao({ db });
  const g = await chama("gerar_plano_mensal", { mes: "2026-12" });
  assert.equal(g.status, "rascunho");
  const linha = FC.planoMensal.paraBanco({ ...FC.planoMensal.gera(await FC.base.carrega({ comMercado: false }), "2027-01"), despesas_origem: "x", renda_total: 1 });
  assert.equal(linha.despesas_origem, undefined);
  assert.equal(linha.contexto.despesas_origem, "x");
  assert.ok(Object.keys(linha).every((k) => FC.planoMensal.COLUNAS.includes(k)));
});
