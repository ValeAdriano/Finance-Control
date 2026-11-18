/* MCP — as ferramentas da Edge Function supabase/functions/mcp.
 *
 *   node --test testes/mcp.test.js
 *
 * Roda as ferramentas de verdade (ferramentas.mjs + nucleo.gen.mjs) contra
 * uma conta de demonstração em memória (testes/mcp-fixture.js). Confere:
 *   - o núcleo empacotado está em dia e calcula igual ao do app;
 *   - um núcleo por requisição: nada de uma conta vaza para a outra;
 *   - cada ferramenta de leitura responde, e com os números do núcleo;
 *   - as de escrita gravam o que dizem, auditam e respeitam "só consulta";
 *   - os schemas aceitam o mesmo que os `check` do supabase/schema.sql. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { z } = require("zod");
const { carregaNucleo } = require("./nucleo.js");
const { supabaseFalso, baseDemo, dia, HOJE } = require("./mcp-fixture.js");

const RAIZ = path.resolve(__dirname, "..");
const FUNCAO = path.join(RAIZ, "supabase", "functions", "mcp");
const mods = Promise.all([
  import(path.join(FUNCAO, "nucleo.gen.mjs")),
  import(path.join(FUNCAO, "ferramentas.mjs")),
  import(path.join(FUNCAO, "esquemas.mjs")),
]);

/** uma "requisição": núcleo novo, conta de demonstração e o acesso pedido */
async function requisicao({ escrita = true, db, opcoes } = {}) {
  const [{ criaNucleo }, { ferramentas, ErroMcp }] = await mods;
  const sb = supabaseFalso(db || baseDemo(), opcoes);
  const FC = criaNucleo({ supabase: sb.modulo });
  FC.auth.usuario = { id: "u-demo" };
  const ctx = { FC, usuario: { id: "u-demo" }, acesso: { cliente: "cli-1", autorizado: true, escrita, nome: "Assistente de teste" } };
  const lista = ferramentas(z);
  // como o SDK faz: valida a entrada pelo schema (aplica os padrões) e só então executa
  const chama = (nome, args = {}) => {
    const f = lista.find((x) => x.nome === nome);
    assert.ok(f, `ferramenta ${nome} não existe`);
    return f.executa(ctx, z.object(f.entrada()).strict().parse(args));
  };
  return { chama, ctx, db: sb.db, FC, lista, ErroMcp };
}
const recusa = (p, padrao) => assert.rejects(p, (e) => { assert.equal(e.constructor.name, "ErroMcp", `esperava ErroMcp, veio ${e.constructor.name}: ${e.message}`); assert.match(e.message, padrao); return true; });

// ---------------------------------------------------------------- núcleo empacotado
test("MCP · nucleo.gen.mjs está em dia com nucleo/", () => {
  execFileSync(process.execPath, [path.join(RAIZ, "scripts", "gera-nucleo-mcp.js"), "--confere"], { stdio: "pipe" });
});

test("MCP · o núcleo empacotado calcula igual ao do app", async () => {
  const [{ criaNucleo }] = await mods;
  const a = criaNucleo({ supabase: supabaseFalso().modulo });
  const { FC: b } = carregaNucleo({ supabase: supabaseFalso().modulo });
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), "superfície do FC diferente");
  const [ea, eb] = await Promise.all([a.base.carrega({ comProventos: true }), b.base.carrega({ comProventos: true })]);
  assert.equal(ea.erroMercado, null);
  assert.ok(ea.dados.resumo.patrimonio > 0);
  assert.equal(JSON.stringify(ea.dados.resumo), JSON.stringify(eb.dados.resumo));
  assert.equal(JSON.stringify(ea.dados.rentab.total), JSON.stringify(eb.dados.rentab.total));
});

test("MCP · um núcleo por requisição: o estado de uma conta não aparece na outra", async () => {
  const vazia = Object.fromEntries(Object.keys(baseDemo()).map((k) => [k, k === "indices_diarios" ? baseDemo()[k] : []]));
  const cheia = await requisicao();
  const outra = await requisicao({ db: vazia });
  const [r1, r2] = await Promise.all([cheia.chama("resumo_patrimonio"), outra.chama("resumo_patrimonio")]);
  assert.ok(r1.patrimonio > 1000);
  assert.equal(r2.patrimonio, 0);
  assert.notEqual(cheia.FC, outra.FC);
  assert.notEqual(cheia.FC.estado, outra.FC.estado);
  assert.equal(outra.FC.estado.base.ativos.length, 0);
});

// ---------------------------------------------------------------- leitura
test("MCP · resumo_patrimonio traz o total, as classes, a alocação e a rentabilidade", async () => {
  const { chama, FC } = await requisicao();
  const r = await chama("resumo_patrimonio");
  const d = FC.estado.dados.resumo;
  assert.equal(r.patrimonio, Math.round(d.patrimonio * 100) / 100);
  const soma = Object.values(r.por_classe).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(soma - r.patrimonio) < 0.05, `classes (${soma}) não somam o patrimônio (${r.patrimonio})`);
  assert.deepEqual(r.alocacao.map((l) => l.pilar).sort(), ["acoes", "agro", "alternativos", "caixa", "real_estate"]);
  assert.equal(r.alocacao.find((l) => l.pilar === "acoes").meta_pct, 40);
  assert.ok(r.rentabilidade_desde_o_inicio.tir_anual_pct != null);
  assert.ok(Array.isArray(r.alertas));
  assert.equal(r.aviso, undefined);
});

test("MCP · com o mercado fora do ar a leitura continua e avisa", async () => {
  const { chama } = await requisicao({ opcoes: { semMercado: true } });
  const r = await chama("resumo_patrimonio");
  assert.match(r.aviso, /Cotações indisponíveis/);
  assert.ok(r.por_classe.agro > 0, "agro não depende de cotação");
  const l = await chama("listar_lancamentos", { limite: 5 });
  assert.equal(l.lancamentos.length, 5);
});

test("MCP · listar_posicoes filtra por lista e classe", async () => {
  const { chama } = await requisicao();
  const c = await chama("listar_posicoes");
  assert.deepEqual(c.posicoes.map((p) => p.ticker).sort(), ["BBAS3", "BTC", "ITSA4", "MXRF11"]);
  const itsa = c.posicoes.find((p) => p.ticker === "ITSA4");
  assert.equal(itsa.quantidade, 540); // 400 de base + 12 × 20 − 100 vendidas
  assert.equal(itsa.valor, 5626.8);
  const w = await chama("listar_posicoes", { lista: "watchlist" });
  assert.deepEqual(w.posicoes.map((p) => p.ticker), ["HGLG11"]);
  const k = await chama("listar_posicoes", { classe: "cripto", lista: "todas" });
  assert.deepEqual(k.posicoes.map((p) => p.ticker), ["BTC"]);
  assert.equal(k.posicoes[0].quantidade, 0.021);
});

test("MCP · detalhar_ativo: posição, lotes, vendas e proventos", async () => {
  const { chama } = await requisicao();
  const r = await chama("detalhar_ativo", { ticker: "itsa4" }); // o schema põe em maiúsculas
  assert.equal(r.ticker, "ITSA4");
  assert.ok(r.lotes.length > 1);
  assert.equal(r.vendas_realizadas.length, 1);
  assert.ok(r.rentabilidade.proventos_recebidos > 0);
  assert.ok(r.proventos.ultimos_pagos.length > 0);
  assert.ok(r.indicadores.some((i) => i.indicador === "P/L"));
  await recusa(chama("detalhar_ativo", { ticker: "XPTO3" }), /não está cadastrado/);
});

test("MCP · listar_lancamentos: filtros, tipo derivado e paginação", async () => {
  const { chama } = await requisicao();
  const todos = await chama("listar_lancamentos", { limite: 200 });
  assert.equal(todos.total, todos.lancamentos.length);
  assert.ok(todos.lancamentos.every((l, i, a) => !i || a[i - 1].data >= l.data), "deveria vir do mais recente para o mais antigo");
  const vendas = await chama("listar_lancamentos", { tipo: "venda" });
  assert.equal(vendas.total, 1);
  assert.equal(vendas.lancamentos[0].quantidade, -100);
  const rf = await chama("listar_lancamentos", { titulo: "lci banco demo" });
  assert.equal(rf.total, 6);
  assert.ok(rf.lancamentos.every((l) => l.tipo === "aporte_renda_fixa"));
  const p2 = await chama("listar_lancamentos", { limite: 5, pagina: 2 });
  assert.equal(p2.lancamentos[0].id, todos.lancamentos[5].id);
  const recente = await chama("listar_lancamentos", { de: dia(-31) });
  assert.ok(recente.total > 0 && recente.lancamentos.every((l) => l.data >= dia(-31)));
});

test("MCP · renda fixa, rentabilidade, dividendos, agro, salário, histórico e preferências respondem", async () => {
  const { chama } = await requisicao();
  const rf = await chama("listar_renda_fixa");
  assert.equal(rf.total, 2);
  const cdb = rf.titulos.find((t) => t.nome.startsWith("CDB"));
  assert.ok(cdb.saldo_hoje > cdb.aplicado, "o CDB deveria ter rendido");
  assert.ok(cdb.ir_estimado > 0 && cdb.liquido_estimado < cdb.saldo_hoje);

  const re = await chama("rentabilidade");
  assert.ok(re.total.valor_atual > 0);
  assert.ok(re.por_ativo.some((a) => a.ticker === "ITSA4"));
  assert.deepEqual(Object.keys(re.por_classe).sort(), ["agro", "bolsa", "cripto", "renda_fixa"]);

  const dv = await chama("dividendos");
  assert.ok(dv.resumo.recebido_12m > 0);
  assert.ok(dv.por_ativo.some((a) => a.ticker === "MXRF11"));
  assert.ok(dv.por_mes.every((m) => m.mes.startsWith(HOJE.slice(0, 4))));

  const ag = await chama("agro_resumo");
  assert.equal(ag.cabecas, 30);
  assert.equal(ag.por_categoria[0].categoria, "bezerro");
  assert.ok(ag.financeiro.receita_vendas > 0);
  const al = await chama("agro_lancamentos", { especie: "custos" });
  assert.deepEqual(Object.keys(al), ["custos"]);
  assert.equal(al.custos[0].tabela, "agro_custos");
  assert.equal(al.custos[0].user_id, undefined);

  const sa = await chama("salario_e_plano");
  assert.equal(sa.renda.total, 9800);
  assert.equal(sa.ganhos.length, 1);

  const hi = await chama("historico_patrimonio", { max_pontos: 10 });
  assert.equal(hi.pontos.length, 10);
  assert.equal(hi.pontos.at(-1).data, hi.ate);

  const pr = await chama("preferencias");
  assert.equal(pr.metas_de_alocacao_pct.acoes, 40);
  assert.equal(pr.regras, undefined);
  assert.ok((await chama("preferencias", { incluir_regras: true })).regras);
});

test("MCP · nenhuma resposta leva user_id nem número com cauda de ponto flutuante", async () => {
  const { chama, lista } = await requisicao();
  const args = { detalhar_ativo: { ticker: "ITSA4" } };
  for (const f of lista.filter((x) => !x.escreve)) {
    const txt = JSON.stringify(await chama(f.nome, args[f.nome] || {}));
    assert.ok(!txt.includes("user_id"), `${f.nome} devolveu user_id`);
    assert.ok(!/\d\.\d{9,}/.test(txt), `${f.nome} devolveu número sem arredondar: ${(/[^,{]*\d\.\d{9,}/.exec(txt) || [""])[0]}`);
  }
});

// ---------------------------------------------------------------- escrita
test("MCP · registrar_lancamento grava a compra, audita e a posição muda", async () => {
  const { chama, db } = await requisicao();
  const antes = db.aportes.length;
  const r = await chama("registrar_lancamento", { operacao: "compra", ticker: "ITSA4", quantidade: 10, preco: 10.5, data: dia(-1), observacao: "teste" });
  assert.equal(r.registro.tipo, "compra");
  assert.equal(r.registro.valor, 105);
  assert.equal(db.aportes.length, antes + 1);
  const linha = db.aportes.at(-1);
  assert.deepEqual({ tipo: linha.tipo, ticker: linha.ticker, quantidade: linha.quantidade, preco: linha.preco, valor: linha.valor, venda: linha.venda },
    { tipo: "ativo", ticker: "ITSA4", quantidade: 10, preco: 10.5, valor: 105, venda: false });
  const log = db.log_sistema.at(-1);
  assert.equal(log.origem, "mcp");
  assert.equal(log.evento, "mcp_lancamento");
  assert.equal(log.detalhe.cliente, "Assistente de teste");
  assert.equal((await chama("listar_posicoes")).posicoes.find((p) => p.ticker === "ITSA4").quantidade, 550);
});

test("MCP · venda: sinal negativo, e acima da posição só com confirmação", async () => {
  const { chama, db } = await requisicao();
  await recusa(chama("registrar_lancamento", { operacao: "venda", ticker: "ITSA4", quantidade: 9999, valor: 1 }), /posição registrada de ITSA4 é 540/);
  await recusa(chama("registrar_lancamento", { operacao: "venda", ticker: "WEGE3", quantidade: 1, preco: 1 }), /não está na carteira/);
  const r = await chama("registrar_lancamento", { operacao: "venda", ticker: "ITSA4", quantidade: 40, valor: 420 });
  assert.equal(r.registro.tipo, "venda");
  const linha = db.aportes.at(-1);
  assert.deepEqual([linha.quantidade, linha.valor, linha.preco, linha.venda], [-40, -420, 10.5, true]);
  await chama("registrar_lancamento", { operacao: "venda", ticker: "ITSA4", quantidade: 9999, valor: 1, vender_acima_da_posicao: true });
});

test("MCP · compra de ativo novo pede a classe, cadastra e tira da watchlist", async () => {
  const { chama, db } = await requisicao();
  await recusa(chama("registrar_lancamento", { operacao: "compra", ticker: "WEGE3", quantidade: 5, preco: 44 }), /informe a classe/);
  await chama("registrar_lancamento", { operacao: "compra", ticker: "WEGE3", quantidade: 5, preco: 44, classe: "acao_br" });
  assert.deepEqual((({ classe, pilar, lista, quantidade }) => ({ classe, pilar, lista, quantidade }))(db.ativos.find((a) => a.ticker === "WEGE3")),
    { classe: "acao_br", pilar: "acoes", lista: "carteira", quantidade: 0 });
  await chama("registrar_lancamento", { operacao: "compra", ticker: "HGLG11", quantidade: 1, preco: 158 });
  assert.equal(db.ativos.find((a) => a.ticker === "HGLG11").lista, "carteira");
});

test("MCP · provento e renda fixa: resgate negativo e título precisa existir", async () => {
  const { chama, db } = await requisicao();
  await chama("registrar_lancamento", { operacao: "provento", ticker: "MXRF11", valor: 80 });
  assert.deepEqual((({ tipo, ticker, valor }) => ({ tipo, ticker, valor }))(db.aportes.at(-1)), { tipo: "provento", ticker: "MXRF11", valor: 80 });
  await chama("registrar_lancamento", { operacao: "resgate_renda_fixa", titulo: "lci banco demo", valor: 500 });
  assert.deepEqual((({ tipo, titulo, valor }) => ({ tipo, titulo, valor }))(db.aportes.at(-1)), { tipo: "caixa", titulo: "LCI Banco Demo", valor: -500 });
  await recusa(chama("registrar_lancamento", { operacao: "aporte_renda_fixa", titulo: "Não existe", valor: 10 }), /não encontrado/);
  await recusa(chama("registrar_lancamento", { operacao: "compra", ticker: "ITSA4", quantidade: 1 }), /preço por cota ou o valor total/);
});

test("MCP · conexão só de consulta não grava nada, por nenhuma ferramenta", async () => {
  const { chama, db, lista } = await requisicao({ escrita: false });
  const foto = JSON.stringify(db);
  const args = {
    registrar_lancamento: { operacao: "provento", ticker: "ITSA4", valor: 1 }, salvar_ativo: { ticker: "ABCD3", classe: "acao_br" },
    salvar_titulo: { nome: "Novo", tipo: "cdi" }, salvar_ganho: { nome: "X", tipo: "avulso", valor: 1 },
    registrar_agro: { especie: "custo", categoria_custo: "frete", valor: 1 }, atualizar_metas: { metas: { acoes: 50, caixa: 20 } },
    editar_registro: { tabela: "ativos", id: 1, campos: { lista: "watchlist" } }, apagar_registro: { tabela: "ativos", id: 1 },
    // as do plano de evolução (sem simular: true)
    ...require("./mcp-escritas.js"),
  };
  const escritas = lista.filter((f) => f.escreve);
  assert.deepEqual(escritas.map((f) => f.nome).sort(), Object.keys(args).sort(), "ferramenta de escrita sem caso neste teste");
  for (const f of escritas) await recusa(chama(f.nome, args[f.nome]), /só para consulta/);
  assert.equal(JSON.stringify(db), foto, "algo foi gravado numa conexão só de consulta");
  assert.ok((await chama("resumo_patrimonio")).patrimonio > 0, "a leitura continua");
});

test("MCP · quando é o banco que recusa (RLS), o erro volta legível", async () => {
  // a função acha que pode gravar, mas a política do banco diz que não
  const { chama } = await requisicao({ escrita: true, opcoes: { somenteLeitura: true } });
  await recusa(chama("registrar_lancamento", { operacao: "provento", ticker: "ITSA4", valor: 1 }), /só para consulta/);
  await recusa(chama("atualizar_metas", { metas: { acoes: 50, caixa: 20 } }), /só para consulta/);
});

test("MCP · salvar_ativo, salvar_titulo e salvar_ganho criam e atualizam pela chave", async () => {
  const { chama, db } = await requisicao();
  const novo = await chama("salvar_ativo", { ticker: "ethx", classe: "cripto", lista: "watchlist", quantidade: 3 });
  assert.equal(novo.criado, true);
  assert.deepEqual((({ ticker, pilar, quantidade }) => ({ ticker, pilar, quantidade }))(db.ativos.at(-1)), { ticker: "ETHX", pilar: "alternativos", quantidade: 0 });
  const upd = await chama("salvar_ativo", { ticker: "ITSA4", preco_medio: 9.2 });
  assert.equal(upd.criado, false);
  assert.equal(db.ativos.find((a) => a.ticker === "ITSA4").preco_medio, 9.2);
  await recusa(chama("salvar_ativo", { ticker: "ZZZZ3" }), /informe a classe/);

  await chama("salvar_titulo", { nome: "Tesouro Selic 2029", tipo: "cdi", taxa: 100 });
  assert.equal(db.renda_fixa.at(-1).valor_aplicado, 0);
  await chama("salvar_titulo", { nome: "tesouro selic 2029", novo_nome: "Tesouro Selic 2031", taxa: 101 });
  assert.deepEqual((({ nome, taxa }) => ({ nome, taxa }))(db.renda_fixa.at(-1)), { nome: "Tesouro Selic 2031", taxa: 101 });

  const g = await chama("salvar_ganho", { nome: "Bônus", tipo: "avulso", valor: 3000, categoria: "bonus", inicio: dia(-3), fim: dia(10) });
  assert.equal(db.ganhos.at(-1).fim, null, "avulso não tem fim");
  await chama("salvar_ganho", { id: g.registro.id, valor: 3500 });
  assert.equal(db.ganhos.at(-1).valor, 3500);
  await recusa(chama("salvar_ganho", { nome: "Sem valor", tipo: "avulso" }), /nome, tipo e valor/);
});

test("MCP · registrar_agro: valor pela arroba, custo e pesagem", async () => {
  const { chama, db } = await requisicao();
  const m = await chama("registrar_agro", { especie: "movimento", tipo: "compra", categoria: "garrote", cabecas: 10, peso_medio_kg: 300, preco_arroba: 300, despesas: 500 });
  // 10 cabeças × (300 kg × 52% ÷ 15) @ × R$ 300
  assert.equal(m.registro.valor_total, 31200);
  assert.deepEqual((({ preco_cabeca, despesas, reinvestido }) => ({ preco_cabeca, despesas, reinvestido }))(db.agro_movimentos.at(-1)), { preco_cabeca: null, despesas: 500, reinvestido: null });
  await recusa(chama("registrar_agro", { especie: "movimento", tipo: "venda", categoria: "garrote", cabecas: 2, preco_arroba: 300 }), /informe o peso médio/);
  await recusa(chama("registrar_agro", { especie: "movimento", tipo: "reclassificacao", categoria: "bezerro", cabecas: 2 }), /categoria_destino/);
  await chama("registrar_agro", { especie: "movimento", tipo: "morte", categoria: "bezerro", cabecas: 1 });
  assert.equal(db.agro_movimentos.at(-1).valor_total, 0);
  await chama("registrar_agro", { especie: "custo", categoria_custo: "sanidade", valor: 250, descricao: "Vacinas" });
  assert.equal(db.agro_custos.at(-1).categoria, "sanidade");
  await chama("registrar_agro", { especie: "pesagem", categoria: "bezerro", cabecas: 29, peso_medio_kg: 400 });
  assert.equal(db.agro_pesagens.at(-1).peso_medio_kg, 400);
  assert.equal((await chama("agro_resumo")).cabecas, 39);
});

test("MCP · atualizar_metas mescla com as atuais e exige 100%", async () => {
  const { chama, db } = await requisicao();
  await recusa(chama("atualizar_metas", { metas: { acoes: 60 } }), /somar 100% e somam 120%/);
  const r = await chama("atualizar_metas", { metas: { acoes: 50, caixa: 20 } });
  assert.deepEqual(r.depois, { acoes: 50, real_estate: 20, alternativos: 10, caixa: 20, agro: 0 });
  assert.deepEqual(db.preferencias[0].alocacao_alvo, r.depois);
  assert.throws(() => z.object({ metas: z.object({ acoes: z.number() }).strict() }).parse({ metas: { imoveis: 10 } }));
});

test("MCP · editar_registro só aceita campos da tabela, com os valores do banco", async () => {
  const { chama, db } = await requisicao();
  const id = db.aportes[0].id;
  await chama("editar_registro", { tabela: "aportes", id, campos: { preco: 9.5, observacao: "corrigido" } });
  assert.deepEqual([db.aportes[0].preco, db.aportes[0].observacao], [9.5, "corrigido"]);
  await recusa(chama("editar_registro", { tabela: "aportes", id, campos: { user_id: "outro" } }), /Campos inválidos/);
  await recusa(chama("editar_registro", { tabela: "ativos", id: 1, campos: { pilar: "imoveis" } }), /Campos inválidos: pilar/);
  await recusa(chama("editar_registro", { tabela: "aportes", id, campos: { data: "2026-02-30" } }), /data no formato/);
  await recusa(chama("editar_registro", { tabela: "aportes", id, campos: {} }), /Nada para atualizar/);
  await recusa(chama("editar_registro", { tabela: "aportes", id: "nao-existe", campos: { preco: 1 } }), /não encontrado/);
  assert.equal(db.log_sistema.filter((l) => l.evento === "mcp_edicao").length, 1);
});

test("MCP · apagar_registro apaga um, audita e não alcança tabela fora da lista", async () => {
  const { chama, db, lista } = await requisicao();
  const alvo = db.aportes[3], antes = db.aportes.length;
  const r = await chama("apagar_registro", { tabela: "aportes", id: alvo.id });
  assert.equal(r.apagado.id, alvo.id);
  assert.equal(db.aportes.length, antes - 1);
  assert.equal(db.log_sistema.at(-1).evento, "mcp_exclusao");
  await recusa(chama("apagar_registro", { tabela: "aportes", id: alvo.id }), /Nada foi apagado/);
  for (const t of ["preferencias", "patrimonio_historico", "log_sistema", "perfil_investidor", "mcp_acessos", "admins"]) {
    assert.throws(() => z.object(lista.find((f) => f.nome === "apagar_registro").entrada()).parse({ tabela: t, id: 1 }), `apagar_registro aceitou a tabela ${t}`);
    assert.throws(() => z.object(lista.find((f) => f.nome === "editar_registro").entrada()).parse({ tabela: t, id: 1, campos: {} }), `editar_registro aceitou a tabela ${t}`);
  }
});

// ---------------------------------------------------------------- catálogo e schemas
test("MCP · catálogo: nomes únicos, descrições e schemas que viram JSON Schema", async () => {
  const { lista } = await requisicao();
  assert.equal(new Set(lista.map((f) => f.nome)).size, lista.length);
  // contrato: as 20 ferramentas originais continuam lá, com o mesmo papel (só se adiciona)
  const ORIGINAIS_LEITURA = ["resumo_patrimonio", "listar_posicoes", "detalhar_ativo", "listar_lancamentos", "listar_renda_fixa", "rentabilidade",
    "dividendos", "agro_resumo", "agro_lancamentos", "salario_e_plano", "historico_patrimonio", "preferencias"];
  const ORIGINAIS_ESCRITA = ["registrar_lancamento", "salvar_ativo", "salvar_titulo", "salvar_ganho", "registrar_agro", "atualizar_metas", "editar_registro", "apagar_registro"];
  for (const n of ORIGINAIS_LEITURA) assert.equal(lista.find((f) => f.nome === n)?.escreve, false, `${n} sumiu ou passou a gravar`);
  for (const n of ORIGINAIS_ESCRITA) assert.equal(lista.find((f) => f.nome === n)?.escreve, true, `${n} sumiu ou deixou de gravar`);
  // ferramenta nova de gravação tem o modo simular
  for (const f of lista.filter((x) => x.escreve && !ORIGINAIS_ESCRITA.includes(x.nome))) {
    assert.ok("simular" in f.entrada(), `${f.nome} grava e não tem \`simular\``);
  }
  assert.deepEqual(lista.filter((f) => f.destrutiva).map((f) => f.nome), ["apagar_registro"]);
  for (const f of lista) {
    assert.match(f.nome, /^[a-z_]{3,40}$/);
    assert.ok(f.titulo && f.descricao.length > 40, `${f.nome} sem descrição útil`);
    const js = z.toJSONSchema(z.object(f.entrada()), { io: "input" });
    assert.equal(js.type, "object", `${f.nome}: schema não é objeto`);
  }
});

test("MCP · as listas de esquemas.mjs são as dos `check` do schema.sql", async () => {
  const [, , e] = await mods;
  const sql = fs.readFileSync(path.join(RAIZ, "supabase", "schema.sql"), "utf8");
  // a ÚLTIMA definição vale (o schema redefine constraints mais abaixo)
  const doCheck = (re) => { const m = [...sql.matchAll(re)].at(-1); assert.ok(m, `não achei ${re} no schema.sql`); return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]); };
  const igual = (a, b, o) => assert.deepEqual([...a].sort(), [...b].sort(), o);
  igual(e.CLASSES, doCheck(/check \(classe in \(([^)]+)\)\)/g), "classes");
  igual(e.PILARES, doCheck(/pilar\s+text not null check \(pilar in \(([^)]+)\)\)/g), "pilares");
  igual(e.LISTAS, doCheck(/check \(lista in \(([^)]+)\)\)/g), "listas");
  igual(e.TIPOS_RF, doCheck(/check \(tipo in \(('cdi'[^)]+)\)\)/g), "tipos de renda fixa");
  igual(e.INDEXADORES, doCheck(/check \(indexador in \(([^)]+)\)\)/g), "indexadores");
  igual(e.TIPOS_GANHO, doCheck(/check \(tipo in \(('recorrente'[^)]+)\)\)/g), "tipos de ganho");
  igual(e.CATEGORIAS_GANHO, doCheck(/check \(categoria in\s*\(('salario'[^)]+)\)\)/g), "categorias de ganho");
  igual(e.REGRAS_DIA, doCheck(/dia_regra in \(([^)]+)\)\)/g), "regras de dia");
  igual(e.TIPOS_MOV, doCheck(/check \(tipo in\s*\(('compra'[^)]+)\)\)/g), "tipos de movimento");
  igual(e.CATEGORIAS_GADO, doCheck(/check \(categoria in\s*\(('bezerro'[^)]+)\)\)/g), "categorias de gado");
  igual(e.CATEGORIAS_CUSTO, doCheck(/check \(categoria in\s*\(('nutricao'[^)]+)\)\)/g), "categorias de custo");
});

test("MCP · o banco só libera ao cliente de IA as tabelas que as ferramentas usam", async () => {
  const [, , e] = await mods;
  const sql = fs.readFileSync(path.join(RAIZ, "supabase", "schema.sql"), "utf8");
  const bloco = sql.slice(sql.indexOf("CONEXÃO COM IA (MCP)"));
  const listas = [...bloco.matchAll(/foreach t in array array\[([^\]]+)\]/g)].map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  assert.equal(listas.length, 2, "esperava a lista liberada e a lista bloqueada");
  const [liberadas, bloqueadas] = listas;
  // tabelas novas (migrations) usam privado.politicas_padrao, que aplica as mesmas políticas "mcp"
  const padrao = [...sql.matchAll(/politicas_padrao\('([a-z_]+)'\)/g)].map((m) => m[1]);
  for (const t of e.TABELAS) assert.ok(liberadas.includes(t) || padrao.includes(t), `${t} é editável pelo MCP mas não tem política "mcp" no schema`);
  for (const t of ["perfil_rascunho", "perfil_investidor", "plano_investimento", "onboarding_eventos"]) assert.ok(bloqueadas.includes(t), `${t} deveria estar bloqueada`);
  assert.equal(liberadas.filter((t) => bloqueadas.includes(t)).length, 0);
});

test("MCP · auditar_dados: lista vazia na conta de demonstração e aponta o que quebra", async () => {
  const { chama } = await requisicao();
  const r = await chama("auditar_dados");
  assert.equal(r.total, 0, JSON.stringify(r.inconsistencias));
  const db = baseDemo();
  db.preferencias[0].premissas = { aporte_mensal: 2000 };
  db.preferencias[0].plano = { modo: "percentual", percentual: 50, destinos: [{ tipo: "pilar", alvo: "caixa", pct: 100 }], reinvestir_dividendos: true };
  const { chama: c2 } = await requisicao({ db });
  const r2 = await c2("auditar_dados");
  assert.deepEqual(r2.inconsistencias.map((x) => x.tipo).sort(), ["premissa_duplicada", "proventos_ambiguos"]);
});

test("MCP · resumo_patrimonio: bolsa e cripto fecham (resultado = valor − custo)", async () => {
  const { chama } = await requisicao();
  const r = await chama("resumo_patrimonio");
  const b = r.bolsa_e_cripto;
  assert.ok(Math.abs(b.resultado - (b.valor - b.custo)) <= 0.02, JSON.stringify(b));
  assert.ok(b.valor_total >= b.valor);
});
