/* Testes do motor de perfil e recomendação. Sem dependências:
 *   node tests/perfil.test.js
 * Carrega os mesmos arquivos do navegador num contexto com `window`. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const raiz = path.join(__dirname, "..", "assets", "js");
const ctx = { window: { FC: {} }, console, Math, Date, JSON, Object, Array, Number, String, Set, Map, Infinity, isFinite };
ctx.window.FC.ok = (v) => v != null && Number.isFinite(v);
vm.createContext(ctx);
for (const f of ["padroes.js", "modelo/perfil.js", "modelo/recomendacao.js"]) {
  vm.runInContext(fs.readFileSync(path.join(raiz, f), "utf8"), ctx, { filename: f });
}
const FC = ctx.window.FC;
// objetos criados dentro do vm têm outro protótipo: compara pelo JSON
const igual = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);

let n = 0, falhas = 0;
function teste(nome, fn) {
  n++;
  try { fn(); } catch (e) { falhas++; console.error("✗ " + nome + "\n   " + (e.message || e).split("\n").join("\n   ")); }
}

// ---------------------------------------------------------------- base de respostas
const BASE = {
  idade: "31_40", estab: "clt", dependentes: "0", renda: "5_8k", sobra: "1500_3000", reserva: "6_12", divida: "nao",
  patrimonio: "50_200k", moradia: "propria", objetivo: "aposentadoria", valor_alvo: "500k_1m", prazo: "20_mais", saque: "nao",
  tempo: "3_5", produtos: ["acoes", "fii", "renda_fixa"],
  t_queda: "mantem", t_certo: "quase_risco", amigo: "equilibrado", t_perda: "10", t_clima: "neutro", t_carteiras: "mais_b", t_foco: "equilibrar",
};
const com = (o) => ({ ...BASE, ...o });
const tolMax = { t_queda: "aporta", t_certo: "risco", amigo: "ousado", t_perda: "30", t_clima: "oportunidade", t_carteiras: "b", t_foco: "crescer" };
const tolMin = { t_queda: "vende", t_certo: "certo", amigo: "cauteloso", t_perda: "zero", t_clima: "angustia", t_carteiras: "a", t_foco: "preservar" };
const prefs = { regras: { perfil: null }, premissas: { macro_longo_prazo: { cdi: null, ipca: null } } };
const calc = (r, ctx2) => FC.perfil.calcula(r, ctx2);
const gera = (r, extra = {}) => FC.recomendacao.gera({ resp: r, res: calc(r), prefs, dados: null, base: null, mercado: null, ...extra });

// ---------------------------------------------------------------- 20 personas
const PERSONAS = [
  ["jovem arrojado, tudo em dia", com({ idade: "ate_30", estab: "estavel", ...tolMax, t_carteiras: "b", reserva: "12_mais", sobra: "3000_6000", renda: "8_15k", patrimonio: "200k_1m", tempo: "5_mais", produtos: ["acoes", "fii", "cripto"] }), "arrojado"],
  ["tolerante, mas com dívida cara", com({ ...tolMax, divida: "sim" }), "conservador", (r) => assert.ok(r.capacidade <= 20 && r.tetos.some((t) => t.regra === "teto.divida_cara"))],
  ["tolerante, mas reserva zero", com({ ...tolMax, reserva: "nenhuma" }), "conservador", (r) => assert.ok(r.capacidade <= 30)],
  ["tolerante, mas prazo curto", com({ ...tolMax, prazo: "menos_2" }), "conservador", (r) => assert.ok(r.capacidade <= 25)],
  ["tolerante, mas saque provável", com({ ...tolMax, saque: "provavel" }), "moderado", (r) => assert.ok(r.capacidade <= 40)],
  ["T alto e C baixo", com({ ...tolMax, estab: "sem_renda", idade: "61_mais", sobra: "nada", patrimonio: "nada", dependentes: "3_mais", moradia: "aluguel", reserva: "menos_3" }), "conservador", (r) => { assert.equal(r.limitado_por, "capacidade"); assert.ok(r.tolerancia >= 65); }],
  ["medroso com muita folga", com({ ...tolMin, idade: "ate_30", estab: "estavel", reserva: "12_mais", sobra: "6000_mais", renda: "15_30k", patrimonio: "1m_mais" }), "conservador", (r) => assert.equal(r.limitado_por, "tolerancia")],
  ["moderado típico", com({}), "moderado"],
  ["respostas contraditórias", com({ t_queda: "aporta", t_clima: "angustia" }), null, (r) => assert.equal(r.consistencia, "baixa")],
  ["respostas contraditórias (carteiras x certeza)", com({ t_certo: "certo", t_carteiras: "b" }), null, (r) => assert.equal(r.consistencia, "baixa")],
  ["degrau único não é contradição", com({ t_queda: "mantem", t_clima: "oportunidade" }), null, (r) => assert.equal(r.consistencia, "alta")],
  ["sem reserva informada (prefiro não dizer)", com({ reserva: "nd" }), null, (r) => { assert.ok(r.capacidade <= 30); assert.equal(r.precisao, "reduzida"); }],
  ["renda e sobra não informadas", com({ renda: "nd", sobra: "nd" }), null, (r) => assert.equal(r.precisao, "reduzida")],
  ["aposentado conservador", com({ idade: "61_mais", estab: "estavel", t_queda: "parte", t_certo: "quase_certo", amigo: "prudente", t_perda: "5", t_clima: "preocupa", t_carteiras: "mais_a", t_foco: "mais_preservar" }), "conservador"],
  ["autônomo moderado", com({ estab: "variavel", renda: "8_15k", sobra: "1500_3000" }), null],
  ["iniciante sem experiência", com({ tempo: "nunca", produtos: ["poupanca"] }), null, (r) => assert.equal(r.conhecimento, "nenhum")],
  ["experiente", com({ tempo: "5_mais", produtos: ["acoes", "fii", "cripto"] }), null, (r) => assert.equal(r.conhecimento, "experiente")],
  ["meta impossível", com({ patrimonio: "nada", sobra: "ate_500", valor_alvo: "3m_mais", prazo: "2_5" }), null, null, (g) => {
    const c = g.conflitos.find((x) => x.id === "meta_acima_perfil");
    assert.ok(c, "esperava conflito de meta acima do perfil");
    assert.ok(c.saidas.aporte_necessario > 0 && c.saidas.meta_possivel > 0);
  }],
  ["meta folgada", com({ patrimonio: "1m_mais", sobra: "6000_mais", renda: "30k_mais", valor_alvo: "ate_50k", prazo: "20_mais", ...tolMax }), null, null, (g) => {
    assert.ok(g.necessidade === 0 || g.necessidade < g.retorno_referencia);
  }],
  ["só reserva como objetivo", com({ objetivo: "reserva", valor_alvo: "ate_50k" }), null, null, (g) => assert.equal(g.necessidade, null)],
  ["dívida: plano exclusivo", com({ divida: "sim" }), null, null, (g) => {
    assert.equal(g.plano.passos.length, 1);
    assert.equal(g.plano.passos[0].id, "quitar_divida");
    assert.equal(g.candidatos.descartados.length, 0);
  }],
];
for (const [nome, resp, esperado, verificaCalc, verificaPlano] of PERSONAS) {
  teste("persona: " + nome, () => {
    const r = calc(resp);
    if (esperado) assert.equal(r.perfil, esperado, `T=${r.tolerancia} C=${r.capacidade} score=${r.score}`);
    if (verificaCalc) verificaCalc(r);
    if (verificaPlano) verificaPlano(gera(resp));
  });
}
teste("há ao menos 20 personas", () => assert.ok(PERSONAS.length >= 20, String(PERSONAS.length)));

// ---------------------------------------------------------------- regra do mínimo
teste("perfil é o mínimo entre tolerância e capacidade, nunca a média", () => {
  const r = calc(com({ ...tolMax, estab: "sem_renda", idade: "61_mais", sobra: "nada", patrimonio: "nada", reserva: "menos_3" }));
  assert.equal(r.score, Math.min(r.tolerancia, r.capacidade));
  assert.ok(r.score < (r.tolerancia + r.capacidade) / 2);
});
teste("faixas: 0-34, 35-64, 65-100", () => {
  assert.equal(FC.perfil.faixaDoScore(34).chave, "conservador");
  assert.equal(FC.perfil.faixaDoScore(35).chave, "moderado");
  assert.equal(FC.perfil.faixaDoScore(64).chave, "moderado");
  assert.equal(FC.perfil.faixaDoScore(65).chave, "arrojado");
  assert.equal(FC.perfil.faixaDoScore(100).chave, "arrojado");
});
teste("determinístico: mesma resposta, mesmo resultado", () => {
  igual(calc(BASE), calc({ ...BASE }));
});
teste("agro acima de 50% reduz a capacidade", () => {
  const a = calc(BASE).capacidade, b = calc(BASE, { agro_pct: 60 }).capacidade;
  assert.equal(a - b, FC.PERFIL.agro_alto.desconto);
  assert.equal(calc(BASE, { agro_pct: 50 }).capacidade, a);
});

// ---------------------------------------------------------------- necessidade
teste("necessidade: sem retorno necessário vale 0", () => {
  assert.equal(FC.perfil.necessidade({ vp: 100000, pmtMensal: 1000, anos: 10, alvo: 50000 }), 0);
});
teste("necessidade: bate com o valor futuro", () => {
  const r = FC.perfil.necessidade({ vp: 10000, pmtMensal: 500, anos: 10, alvo: 150000 });
  assert.ok(r > 0 && r < 1);
  const vf = FC.perfil.valorFuturo(r, 10000, 6000, 10);
  assert.ok(Math.abs(vf - 150000) < 1, String(vf));
});
teste("necessidade: impossível vira Infinity e faltando dado vira null", () => {
  assert.equal(FC.perfil.necessidade({ vp: 0, pmtMensal: 10, anos: 1, alvo: 1e9 }), Infinity);
  assert.equal(FC.perfil.necessidade({ vp: 0, pmtMensal: 10, anos: 0, alvo: 1000 }), null);
  assert.equal(FC.perfil.necessidade({ vp: 0, pmtMensal: 10, anos: 5, alvo: null }), null);
});
teste("aporte e prazo necessários fecham a meta", () => {
  const r = 0.05;
  const pmt = FC.perfil.aporteNecessario({ vp: 20000, anos: 15, alvo: 400000, r });
  assert.ok(Math.abs(FC.perfil.valorFuturo(r, 20000, pmt * 12, 15) - 400000) < 1);
  const anos = FC.perfil.prazoNecessario({ vp: 20000, pmtMensal: 1500, alvo: 400000, r });
  assert.ok(Math.abs(FC.perfil.valorFuturo(r, 20000, 18000, anos) - 400000) < 1);
});

// ---------------------------------------------------------------- hierarquia (propriedade)
function aleatorio(semente) {
  let s = semente;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
teste("propriedade: a alocação nunca viola a hierarquia nem passa de 100%", () => {
  const rnd = aleatorio(42);
  const escolhe = (arr) => arr[Math.floor(rnd() * arr.length)];
  let casos = 0;
  for (let i = 0; i < 4000; i++) {
    const resp = {};
    for (const q of FC.PERFIL.perguntas) {
      if (q.multipla) resp[q.id] = q.opcoes.filter(() => rnd() > 0.5).map((o) => o.id);
      else if (rnd() > 0.08 || q.essencial) resp[q.id] = escolhe(q.opcoes).id;
    }
    const res = FC.perfil.calcula(resp, { agro_pct: rnd() * 100 });
    // com e sem regras editadas à mão (faixas embaralhadas)
    const regras = JSON.parse(JSON.stringify(FC.PADRAO_REGRAS.perfil));
    if (i % 3 === 0) {
      for (const p of Object.values(regras.alocacao)) {
        for (const c of Object.keys(p)) { const a = Math.round(rnd() * 90), b = a + Math.round(rnd() * 10); p[c] = [a, Math.min(100, b)]; }
      }
    }
    const classesOff = rnd() > 0.7 ? ["cripto"] : rnd() > 0.7 ? ["fiis", "cripto"] : [];
    const a = FC.recomendacao.alocacao({ perfil: res.perfil, score: res.score, regras, conhecimento: res.conhecimento, classesOff });
    const c = a.classes;
    const soma = c.renda_fixa + c.fiis + c.acoes + c.cripto;
    assert.equal(soma, 100, JSON.stringify(c));
    for (const v of Object.values(c)) assert.ok(Number.isInteger(v) && v >= 0, JSON.stringify(c));
    assert.ok(c.renda_fixa > c.acoes, "renda fixa deve ser a maior que ações: " + JSON.stringify(c));
    assert.ok(c.acoes > c.cripto || c.cripto === 0, "ações acima de cripto: " + JSON.stringify(c));
    for (const off of classesOff) assert.equal(c[off], 0);
    const pilares = Object.values(a.pilares).reduce((s, x) => s + x, 0);
    assert.equal(pilares, 100);
    assert.equal(a.pilares.agro, 0);
    casos++;
  }
  assert.equal(casos, 4000);
});
teste("teto do conhecimento vale", () => {
  const r = gera(com({ tempo: "nunca", produtos: ["poupanca"], ...tolMax, idade: "ate_30", estab: "estavel", reserva: "12_mais", patrimonio: "1m_mais", sobra: "6000_mais", renda: "30k_mais" }));
  assert.equal(r.alocacao.classes.cripto, 0);
  assert.ok(r.alocacao.classes.acoes <= FC.PERFIL.conhecimento.nenhum.acoes);
  assert.ok(r.alocacao.classes.fiis <= FC.PERFIL.conhecimento.nenhum.fiis);
});
teste("o ponto dentro da faixa vem do score bruto", () => {
  const regras = FC.PADRAO_REGRAS.perfil;
  const baixo = FC.recomendacao.alocacao({ perfil: "moderado", score: 38, regras, conhecimento: "experiente" }).classes;
  const alto = FC.recomendacao.alocacao({ perfil: "moderado", score: 62, regras, conhecimento: "experiente" }).classes;
  assert.ok(alto.renda_fixa < baixo.renda_fixa, JSON.stringify({ baixo, alto }));
});
teste("cada plano é uma lista de passos ordenada com id de regra", () => {
  const g = gera(BASE);
  for (const p of g.plano.passos) assert.ok(p.regra && FC.PERFIL.regras[p.regra], p.id);
  for (const nota of g.alocacao.notas) assert.ok(nota.regra && nota.texto);
});
teste("reserva: 12 meses para renda variável, 6 para estável", () => {
  assert.equal(gera(com({ estab: "variavel", reserva: "nenhuma" })).plano.reserva.meses_alvo, 12);
  assert.equal(gera(com({ estab: "estavel", reserva: "nenhuma" })).plano.reserva.meses_alvo, 6);
});
teste("reserva completa não vira passo pendente", () => {
  const g = gera(com({ estab: "clt", reserva: "12_mais" }));
  assert.ok(g.plano.passos.some((p) => p.id === "reserva_ok"));
});
teste("modo educativo usa os rótulos de referência", () => {
  assert.equal(gera(BASE, { modo: "educativo" }).rotulos.candidatos, "Ativos que passam nos filtros do seu perfil");
  assert.notEqual(gera(BASE, { modo: "completo" }).rotulos.candidatos, "Ativos que passam nos filtros do seu perfil");
});

// ---------------------------------------------------------------- candidatos
teste("candidatos: os quatro filtros", () => {
  const mk = (ticker, classe, score, extra = {}) => ({ ticker, classe, score, perfil: classe === "fii" ? "fii_tijolo" : classe, cor: "verde", veredito_curto: "Nos critérios",
    tipo_rotulo: "x", metricas: [], destaques: [], posicao: null, na_carteira: false, ...extra });
  const itens = [
    mk("BOA3", "acao_br", 80), mk("FRACA3", "acao_br", 40), mk("LIGHT3", "acao_br", 90, { metricas: [{ chave: "liquidez", valor: 1000, nota: 90 }] }),
    mk("PESADA3", "acao_br", 85, { posicao: { atual: 20000 } }), mk("DOGE-USD", "cripto", 90), mk("BTC-USD", "cripto", 90),
  ];
  const res = calc(com({ ...tolMax, idade: "ate_30", estab: "estavel", reserva: "12_mais", patrimonio: "200k_1m", sobra: "3000_6000", renda: "8_15k", tempo: "5_mais", produtos: ["acoes", "cripto"] }));
  const regras = FC.PADRAO_REGRAS.perfil;
  const aloc = FC.recomendacao.alocacao({ perfil: res.perfil, score: res.score, regras, conhecimento: res.conhecimento });
  const c = FC.recomendacao.candidatos({ itens, res, regras, aloc, classesOff: [], investido: 100000, conhecimento: res.conhecimento });
  const tickers = c.por_classe.acoes.map((x) => x.ticker);
  igual(tickers, ["BOA3"]);
  const fora = Object.fromEntries(c.descartados.map((d) => [d.ticker, d.motivos.join(" | ")]));
  assert.match(fora.FRACA3, /abaixo do mínimo/);
  assert.match(fora.LIGHT3, /liquidez/);
  assert.match(fora.PESADA3, /já pesa/);
  assert.match(fora["DOGE-USD"], /maior capitalização/);
  igual(c.por_classe.cripto.map((x) => x.ticker), res.perfil === "conservador" ? [] : ["BTC-USD"].filter(() => aloc.classes.cripto > 0));
});
teste("candidatos: no máximo 5 por classe, do maior score para o menor", () => {
  const itens = Array.from({ length: 9 }, (_, i) => ({ ticker: "AAA" + i + "3", classe: "acao_br", score: 60 + i * 4, perfil: "acao_br", metricas: [], destaques: [], posicao: null }));
  const res = calc(com({ ...tolMax, idade: "ate_30", estab: "estavel", reserva: "12_mais", patrimonio: "200k_1m", sobra: "3000_6000", renda: "8_15k" }));
  const regras = FC.PADRAO_REGRAS.perfil;
  const aloc = FC.recomendacao.alocacao({ perfil: res.perfil, score: res.score, regras, conhecimento: "experiente" });
  const c = FC.recomendacao.candidatos({ itens, res, regras, aloc, classesOff: [], investido: 0, conhecimento: "experiente" });
  assert.equal(c.por_classe.acoes.length, 5);
  const s = c.por_classe.acoes.map((x) => x.score);
  igual(s, [...s].sort((a, b) => b - a));
});

// ---------------------------------------------------------------- revisão e pré-preenchimento
teste("revisão: sugerida em 12 meses, obrigatória em 24", () => {
  const reg = { criado_em: "2025-01-10T00:00:00Z", valido_ate: "2027-01-10", respostas: { renda: "5_8k" } };
  assert.equal(FC.perfil.revisao(reg, { hoje: "2025-06-01" }).estado, "ok");
  assert.equal(FC.perfil.revisao(reg, { hoje: "2026-02-01" }).estado, "sugerida");
  assert.equal(FC.perfil.revisao(reg, { hoje: "2027-02-01" }).estado, "obrigatoria");
  assert.equal(FC.perfil.revisao(reg, { hoje: "2025-06-01", rendaAtual: "8_15k" }).estado, "sugerida");
  assert.equal(FC.perfil.revisao(null).estado, "sem_perfil");
});
teste("pré-preenchimento: patrimônio e produtos vêm da carteira", () => {
  const s = FC.perfil.sugereRespostas({ ativos: [{ classe: "acao_br", lista: "carteira" }, { classe: "cripto", lista: "carteira", quantidade: 1 }], rendaFixa: [{}], historico: [] },
    { resumo: { patrimonio: 120000 } });
  assert.equal(s.patrimonio, "50_200k");
  igual(s.produtos.sort(), ["acoes", "cripto", "renda_fixa"]);
});
teste("pendências: essenciais bloqueiam, opcionais ficam para o checklist", () => {
  const { dependentes, moradia, patrimonio, valor_alvo, saque, produtos, ...essenciais } = BASE;
  igual(FC.perfil.faltantes(essenciais), []);
  assert.ok(FC.perfil.faltantes({}).length >= 10);
  assert.ok(FC.perfil.opcionaisEmAberto(essenciais).includes("valor_alvo"));
});
teste("espelhos apontam para perguntas que existem", () => {
  for (const [a, b] of FC.PERFIL.espelhos) { assert.ok(FC.perfil.pergunta(a)); assert.ok(FC.perfil.pergunta(b)); }
});
teste("o questionário tem de 6 a 8 itens de tolerância", () => {
  const itens = FC.PERFIL.perguntas.filter((q) => q.opcoes.some((o) => o.t != null));
  assert.ok(itens.length >= 6 && itens.length <= 8, String(itens.length));
});

console.log(`${n - falhas}/${n} testes passaram`);
process.exit(falhas ? 1 : 0);
