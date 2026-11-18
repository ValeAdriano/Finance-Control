/* Uma "requisição" ao MCP para os testes dos marcos: núcleo novo, conta em
 * memória (testes/mcp-fixture.js) e as ferramentas de verdade. */
const assert = require("node:assert/strict");
const path = require("path");
const { z } = require("zod");
const { supabaseFalso, baseDemo } = require("./mcp-fixture.js");

const FUNCAO = path.resolve(__dirname, "..", "supabase", "functions", "mcp");
const mods = Promise.all([import(path.join(FUNCAO, "nucleo.gen.mjs")), import(path.join(FUNCAO, "ferramentas.mjs"))]);

async function requisicao({ escrita = true, db, opcoes } = {}) {
  const [{ criaNucleo }, { ferramentas, ErroMcp }] = await mods;
  const sb = supabaseFalso(db || baseDemo(), opcoes);
  const FC = criaNucleo({ supabase: sb.modulo });
  FC.auth.usuario = { id: "u-demo" };
  const ctx = { FC, usuario: { id: "u-demo" }, acesso: { cliente: "cli-1", autorizado: true, escrita, nome: "Assistente de teste" } };
  const lista = ferramentas(z);
  const chama = (nome, args = {}) => {
    const f = lista.find((x) => x.nome === nome);
    assert.ok(f, `ferramenta ${nome} não existe`);
    return f.executa(ctx, z.object(f.entrada()).strict().parse(args));
  };
  return { chama, ctx, db: sb.db, FC, lista, ErroMcp };
}
const recusa = (p, padrao) => assert.rejects(p, (e) => { assert.equal(e.constructor.name, "ErroMcp", `esperava ErroMcp, veio ${e.constructor.name}: ${e.message}`); assert.match(e.message, padrao); return true; });

module.exports = { requisicao, recusa };
