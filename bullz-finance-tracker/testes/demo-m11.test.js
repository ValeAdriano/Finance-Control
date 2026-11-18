/* Marco 11 — conta demo.  node --test testes/demo-m11.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { montaDemo, semeia } = require("../seed/demo/dados.js");
const { supabaseFalso, baseDemo, HOJE } = require("./mcp-fixture.js");
const { requisicao } = require("./mcp-req.js");

test("M11 · seed:demo roda duas vezes sem duplicar dados", async () => {
  const sb = supabaseFalso({});
  const a = await semeia(sb.cliente, "u-demo", HOJE);
  const conta1 = Object.fromEntries(Object.entries(sb.db).map(([t, l]) => [t, l.length]));
  const b = await semeia(sb.cliente, "u-demo", HOJE);
  const conta2 = Object.fromEntries(Object.entries(sb.db).map(([t, l]) => [t, l.length]));
  assert.deepEqual(conta2, conta1);
  assert.deepEqual(b, a);
  assert.equal(sb.db.ativos.length, 7);
});

test("M11 · nenhum valor nem identificador da conta real aparece no seed", () => {
  const txt = JSON.stringify(montaDemo({ hoje: HOJE }));
  // números e nomes citados no plano de evolução sobre a conta real
  const PROIBIDOS = [/\b1\.?493\b/, /\b1\.?905\b/, /\b7\.?112\b/, /\b4\.?313\b/, /\b2\.?580\b/, /\b2\.?300\b/, /\b4\.?500\b/, /\b280\b/, /86\.05/, /1507\.28/, /3193\.95/,
    /1763\.33/, /10260/, /\b995\.8/, /\b1\.?019\b/, /\b1\.?290\b/, /322\.5/, /484\.61/, /360\.45/, /\b129\b/, /64\.5\b/, /AGVS/i, /VCJR11/, /"BNB"/, /"SOL"/, /ITUB4/,
    /adriano/i, /acsvale/i, /est[aá]gio/i, /garagem/i];
  for (const re of PROIBIDOS) assert.ok(!re.test(txt), `o seed contém ${re}: ${(txt.match(re) || [""])[0]}`);
});

test("M11 · a conta demo exercita as funcionalidades novas e passa na auditoria", async () => {
  const db = { ...montaDemo({ hoje: HOJE, uid: "u-demo" }), indices_diarios: baseDemo().indices_diarios, log_sistema: [] };
  const { chama } = await requisicao({ db });
  const r = await chama("resumo_patrimonio");
  assert.ok(r.patrimonio > 0);
  assert.equal(r.modo_alocacao, "hierarquia");
  assert.ok(r.potes.potes.find((p) => p.tipo === "reserva_emergencia").saldo > 0);
  assert.ok(r.potes.comprometido_com_ir > 0, "IR a pagar comprometido");
  const pos = (await chama("listar_posicoes")).posicoes;
  assert.ok(pos.find((p) => p.ticker === "ETH").resultado < 0, "cripto no prejuízo");
  assert.ok(pos.find((p) => p.ticker === "ETH").alta_necessaria_pct > 0);
  const ag = await chama("agro_resumo");
  assert.equal(ag.lotes.length, 2, "lote comprado e lote da troca");
  assert.equal(ag.vendas_planejadas.length, 1);
  const pl = await chama("listar_planos_mensais");
  assert.deepEqual(pl.planos.map((p) => p.status), ["ativo", "fechado", "fechado", "fechado"]);
  const al = await chama("listar_alertas");
  assert.ok(al.alertas.some((a) => a.ticker === "ETH" && a.condicao === "empate"));
  const s = await chama("salario_e_plano");
  assert.ok(s.renda.itens.some((g) => g.categoria === "pj"));
  assert.ok(s.renda.itens.some((g) => g.categoria === "aluguel"));
  const au = await chama("auditar_dados");
  assert.deepEqual(au.inconsistencias, [], JSON.stringify(au.inconsistencias));
});
