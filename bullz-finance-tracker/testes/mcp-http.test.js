/* A Edge Function do MCP de ponta a ponta, pelo protocolo: sobe o
 * supabase/functions/mcp/index.ts de verdade (em Deno) contra um Supabase
 * de mentira e fala com ele como um cliente MCP falaria, por HTTP.
 *
 *   MCP_DENO=/caminho/do/deno node testes/mcp-http.test.js
 * Sem MCP_DENO, o teste é ignorado (o `npm test` não depende de Deno).
 *
 * Confere o que os testes de ferramenta não alcançam: descoberta do OAuth,
 * 401 com o cabeçalho certo, CORS, o catálogo como o cliente o recebe (JSON
 * Schema), chamadas com token direto, de cliente autorizado, só de consulta
 * e sem autorização, e que nada de uma requisição vaza para a seguinte. */
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("node:assert/strict");
const { supabaseFalso, baseDemo } = require("./mcp-fixture.js");

if (!process.env.MCP_DENO) { console.log("MCP_DENO não definido: teste HTTP do MCP ignorado"); process.exit(0); }

const PORTA_SB = 54511, PORTA_MCP = 54512;
const SB = `http://127.0.0.1:${PORTA_SB}`, MCP = `http://127.0.0.1:${PORTA_MCP}/mcp`;

// ---------------------------------------------------------------- tokens e contas
const jwt = (claims) => "x." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".y";
const vazia = () => Object.fromEntries(Object.entries(baseDemo()).map(([k, v]) => [k, k === "indices_diarios" ? v : []]));
const CONTAS = { "u-demo": supabaseFalso(baseDemo()), "u-vazia": supabaseFalso(vazia()) };
const TOKENS = {
  direto: { token: jwt({ sub: "u-demo" }), uid: "u-demo", acesso: { cliente: "", autorizado: true, escrita: true, nome: null } },
  editor: { token: jwt({ sub: "u-demo", client_id: "c-edita" }), uid: "u-demo", acesso: { cliente: "c-edita", autorizado: true, escrita: true, nome: "Assistente A" } },
  leitor: { token: jwt({ sub: "u-demo", client_id: "c-le" }), uid: "u-demo", acesso: { cliente: "c-le", autorizado: true, escrita: false, nome: "Assistente B" } },
  estranho: { token: jwt({ sub: "u-demo", client_id: "c-nada" }), uid: "u-demo", acesso: { cliente: "c-nada", autorizado: false, escrita: false, nome: null } },
  outra: { token: jwt({ sub: "u-vazia", client_id: "c-edita" }), uid: "u-vazia", acesso: { cliente: "c-edita", autorizado: true, escrita: true, nome: "Assistente A" } },
};
const quem = (req) => Object.values(TOKENS).find((t) => "Bearer " + t.token === req.headers.authorization) || null;

// ---------------------------------------------------------------- Supabase de mentira (Auth, PostgREST, mercado)
const corpo = (req) => new Promise((ok) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => ok(s ? JSON.parse(s) : null)); });
const supabase = http.createServer(async (req, res) => {
  const url = new URL(req.url, SB);
  const responde = (status, obj) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (url.pathname === "/.well-known/oauth-authorization-server/auth/v1") return responde(200, { issuer: SB + "/auth/v1", authorization_endpoint: SB + "/auth/v1/oauth/authorize" });
  const t = quem(req);
  if (!t) return responde(401, { message: "invalid JWT" });
  if (url.pathname === "/auth/v1/user") return responde(200, { id: t.uid, aud: "authenticated", role: "authenticated", email: "demo@bullz.local" });
  if (url.pathname === "/rest/v1/rpc/mcp_acesso") return responde(200, t.acesso);
  const dados = await corpo(req);
  const conta = CONTAS[t.uid];
  if (url.pathname === "/functions/v1/mercado") {
    const r = await conta.cliente.functions.invoke("mercado", { body: dados });
    return r.error ? responde(500, { erro: r.error.message }) : responde(200, r.data);
  }
  const m = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
  if (!m) return responde(404, { message: "rota desconhecida: " + url.pathname });
  // a RLS, do jeito que o banco responderia a um cliente só de consulta
  if (req.method !== "GET" && !t.acesso.escrita && m[1] !== "log_sistema") return responde(403, { code: "42501", message: "new row violates row-level security policy" });
  let q = conta.cliente.from(m[1]);
  if (req.method === "GET") q = q.select();
  else if (req.method === "POST") q = (req.headers.prefer || "").includes("merge-duplicates") ? q.upsert(dados) : q.insert(dados);
  else if (req.method === "PATCH") q = q.update(dados);
  else if (req.method === "DELETE") q = q.delete();
  for (const [k, v] of url.searchParams) {
    if (k === "order") for (const o of v.split(",")) q = q.order(o.split(".")[0], { ascending: !o.endsWith(".desc") });
    else if (!["select", "offset", "limit", "on_conflict", "columns"].includes(k) && v.startsWith("eq.")) q = q.eq(k, v.slice(3));
  }
  if (url.searchParams.has("limit")) { const o = Number(url.searchParams.get("offset") || 0); q = q.range(o, o + Number(url.searchParams.get("limit")) - 1); }
  if ((req.headers.accept || "").includes("vnd.pgrst.object")) q = q.single();
  const { data, error } = await q;
  return error ? responde(error.code === "PGRST116" ? 406 : 400, error) : responde(req.method === "POST" ? 201 : 200, data);
});

// ---------------------------------------------------------------- cliente MCP mínimo
let seq = 0;
async function rpc(token, method, params) {
  const r = await fetch(MCP, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method, params }),
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(token ? { Authorization: "Bearer " + token } : {}) } });
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch { /* corpo não-JSON */ }
  return { status: r.status, headers: r.headers, corpo: j, txt };
}
async function chama(quemChama, nome, args = {}) {
  const r = await rpc(TOKENS[quemChama].token, "tools/call", { name: nome, arguments: args });
  assert.equal(r.status, 200, `${nome}: HTTP ${r.status} ${r.txt}`);
  assert.ok(r.corpo && r.corpo.result, `${nome}: sem result: ${r.txt}`);
  return r.corpo.result;
}
const texto = (res) => res.content.map((c) => c.text).join("");

async function espera(url, ms = 240000) {
  const fim = Date.now() + ms;
  for (;;) {
    try { await fetch(url, { method: "OPTIONS" }); return; } catch { /* ainda subindo */ }
    if (Date.now() > fim) throw new Error("a função não subiu a tempo");
    await new Promise((r) => setTimeout(r, 400));
  }
}

// ---------------------------------------------------------------- roteiro
const passos = [];
const passo = (nome, f) => passos.push([nome, f]);

passo("descoberta: metadados do recurso apontam para o Auth do projeto", async () => {
  const r = await fetch(MCP + "/.well-known/oauth-protected-resource");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { resource: SB + "/functions/v1/mcp", authorization_servers: [SB + "/auth/v1"], bearer_methods_supported: ["header"], resource_name: "Bullz" });
  const as = await fetch(MCP + "/.well-known/oauth-authorization-server");
  assert.equal((await as.json()).issuer, SB + "/auth/v1");
});

passo("sem token: 401 com o cabeçalho que leva ao login", async () => {
  const r = await rpc(null, "tools/list");
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("www-authenticate"), `Bearer realm="bullz", resource_metadata="${SB}/functions/v1/mcp/.well-known/oauth-protected-resource"`);
  assert.match(r.headers.get("access-control-expose-headers"), /WWW-Authenticate/);
  const ruim = await rpc("x.e30.y", "tools/list");
  assert.equal(ruim.status, 401);
  assert.match(ruim.headers.get("www-authenticate"), /error="invalid_token"/);
});

passo("CORS e métodos", async () => {
  const o = await fetch(MCP, { method: "OPTIONS" });
  assert.equal(o.status, 204);
  assert.equal(o.headers.get("access-control-allow-origin"), "*");
  assert.match(o.headers.get("access-control-allow-headers"), /mcp-protocol-version/);
  const g = await fetch(MCP, { headers: { Authorization: "Bearer " + TOKENS.direto.token, Accept: "text/event-stream" } });
  assert.equal(g.status, 405);
});

passo("initialize devolve o servidor e as instruções", async () => {
  const r = await rpc(TOKENS.editor.token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "1" } });
  assert.equal(r.status, 200, r.txt);
  assert.equal(r.corpo.result.serverInfo.name, "bullz");
  assert.ok(r.corpo.result.capabilities.tools);
  assert.match(r.corpo.result.instructions, /espere a confirmação/);
});

passo("tools/list: 20 ferramentas, com schema e anotações", async () => {
  const r = await rpc(TOKENS.leitor.token, "tools/list");
  assert.equal(r.status, 200, r.txt);
  const fs = r.corpo.result.tools;
  assert.equal(fs.length, 20);
  for (const f of fs) { assert.equal(f.inputSchema.type, "object", f.name); assert.ok(f.description.length > 40, f.name); }
  const por = Object.fromEntries(fs.map((f) => [f.name, f]));
  assert.equal(por.resumo_patrimonio.annotations.readOnlyHint, true);
  assert.equal(por.registrar_lancamento.annotations.readOnlyHint, false);
  assert.equal(por.apagar_registro.annotations.destructiveHint, true);
  assert.deepEqual(por.registrar_lancamento.inputSchema.required, ["operacao"]);
  assert.deepEqual(por.editar_registro.inputSchema.properties.tabela.enum, ["aportes", "ativos", "renda_fixa", "ganhos", "agro_movimentos", "agro_custos", "agro_pesagens"]);
});

passo("leitura com cliente autorizado", async () => {
  const res = await chama("leitor", "resumo_patrimonio");
  assert.ok(!res.isError, texto(res));
  assert.ok(res.structuredContent.patrimonio > 100000);
  assert.deepEqual(JSON.parse(texto(res)), res.structuredContent);
  const pos = await chama("leitor", "listar_posicoes", { classe: "fii" });
  assert.deepEqual(pos.structuredContent.posicoes.map((p) => p.ticker), ["MXRF11"]);
});

passo("cliente só de consulta: a gravação é recusada com explicação", async () => {
  const antes = CONTAS["u-demo"].db.aportes.length;
  const res = await chama("leitor", "registrar_lancamento", { operacao: "provento", ticker: "ITSA4", valor: 50 });
  assert.equal(res.isError, true);
  assert.match(texto(res), /só para consulta/);
  assert.equal(CONTAS["u-demo"].db.aportes.length, antes);
});

passo("cliente sem autorização: nenhuma ferramenta responde com dados", async () => {
  for (const n of ["resumo_patrimonio", "listar_lancamentos", "preferencias"]) {
    const res = await chama("estranho", n);
    assert.equal(res.isError, true, n);
    assert.match(texto(res), /não está autorizada/);
    assert.equal(res.structuredContent, undefined);
  }
});

passo("cliente com edição grava, e o que gravou aparece na leitura seguinte", async () => {
  const db = CONTAS["u-demo"].db;
  const res = await chama("editor", "registrar_lancamento", { operacao: "compra", ticker: "itsa4", quantidade: 10, preco: 10.5 });
  assert.ok(!res.isError, texto(res));
  assert.equal(db.aportes.at(-1).ticker, "ITSA4");
  assert.deepEqual((({ origem, evento }) => ({ origem, evento }))(db.log_sistema.at(-1)), { origem: "mcp", evento: "mcp_lancamento" });
  assert.equal(db.log_sistema.at(-1).detalhe.cliente, "Assistente A");
  const pos = await chama("editor", "listar_posicoes", { classe: "acao_br" });
  assert.equal(pos.structuredContent.posicoes.find((p) => p.ticker === "ITSA4").quantidade, 550);
  const apagado = await chama("editor", "apagar_registro", { tabela: "aportes", id: res.structuredContent.registro.id });
  assert.ok(!apagado.isError, texto(apagado));
});

passo("entrada inválida: o protocolo devolve o erro do schema, sem derrubar", async () => {
  const r = await rpc(TOKENS.editor.token, "tools/call", { name: "listar_posicoes", arguments: { classe: "imovel" } });
  const erro = r.corpo.error ? r.corpo.error.message : texto(r.corpo.result);
  assert.match(erro, /classe/);
  const naoExiste = await rpc(TOKENS.editor.token, "tools/call", { name: "apagar_tudo", arguments: {} });
  assert.ok(naoExiste.corpo.error || naoExiste.corpo.result.isError);
});

passo("isolamento: depois da conta cheia, a conta vazia continua vazia", async () => {
  await chama("editor", "resumo_patrimonio");
  const res = await chama("outra", "resumo_patrimonio");
  assert.ok(!res.isError, texto(res));
  assert.equal(res.structuredContent.patrimonio, 0);
  assert.equal((await chama("outra", "listar_lancamentos")).structuredContent.total, 0);
  // e em paralelo, intercalando as duas
  const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => chama(i % 2 ? "outra" : "editor", "listar_posicoes", { lista: "todas" })));
  rs.forEach((r, i) => assert.equal(r.structuredContent.total, i % 2 ? 0 : 5, `requisição ${i}`));
});

(async () => {
  await new Promise((r) => supabase.listen(PORTA_SB, "127.0.0.1", r));
  const indice = path.resolve(__dirname, "..", "supabase", "functions", "mcp", "index.ts");
  const deno = spawn(process.env.MCP_DENO, ["run", "--allow-net", "--allow-env", "--allow-read", "--no-prompt", indice], {
    env: { ...process.env, SUPABASE_URL: SB, SUPABASE_ANON_KEY: "chave-publica-de-teste", DENO_SERVE_ADDRESS: `tcp:127.0.0.1:${PORTA_MCP}`, NO_COLOR: "1",
      // as dependências são as `npm:` da própria função, não as do app
      DENO_NO_PACKAGE_JSON: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  deno.stdout.on("data", (d) => (log += d)); deno.stderr.on("data", (d) => (log += d));
  let falhas = 0;
  try {
    await espera(MCP);
    for (const [nome, f] of passos) {
      try { await f(); console.log("  ok  " + nome); } catch (e) { falhas++; console.error("  FALHOU: " + nome + "\n    " + String(e.message).replace(/\n/g, "\n    ")); }
    }
  } catch (e) { falhas++; console.error(e.message); }
  deno.kill();
  supabase.close();
  if (falhas) { console.error("--- saída da função ---\n" + log.slice(-3000)); console.error(`mcp-http: ${falhas} falha(s)`); process.exit(1); }
  console.log(`mcp-http: ${passos.length} passos, todos como esperado`);
  process.exit(0);
})();
