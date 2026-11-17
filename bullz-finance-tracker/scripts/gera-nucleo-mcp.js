/* Empacota o núcleo de cálculo para a Edge Function do MCP — os mesmos
 * arquivos de nucleo/, na ordem de src/nucleo/ordem.js, sem cópia à mão:
 *
 *   node scripts/gera-nucleo-mcp.js            grava supabase/functions/mcp/nucleo.gen.mjs
 *   node scripts/gera-nucleo-mcp.js --confere  falha se o gerado estiver velho
 *
 * A função roda em Deno, onde não há `vm` nem Metro. O gerado é um módulo
 * com uma fábrica, `criaNucleo({ supabase })`, que devolve um `FC` NOVO a
 * cada chamada: o núcleo guarda a conta aberta em `FC.estado`, e a mesma
 * instância da função atende vários usuários. Um FC por requisição é o que
 * impede a carteira de um aparecer na resposta de outro.
 *
 * Como funciona: os arquivos do núcleo são scripts de navegador que escrevem
 * em `window.FC`. Aqui eles entram, inteiros, no corpo da fábrica, com
 * `window` e os poucos globais de navegador que tocam declarados como
 * variáveis locais (o mesmo shim do app e dos testes, src/nucleo/shim.js).
 *
 * Rode de novo sempre que mexer em nucleo/ (o `npm test` confere). */
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const NUCLEO = path.join(RAIZ, "nucleo");
const SAIDA = path.join(RAIZ, "supabase", "functions", "mcp", "nucleo.gen.mjs");
const ORDEM = require(path.join(RAIZ, "src", "nucleo", "ordem.js"));

function gera() {
  let shim = fs.readFileSync(path.join(RAIZ, "src", "nucleo", "shim.js"), "utf8");
  if (!/^module\.exports = \{ aplicaShim, localStorageMemoria \};\s*$/m.test(shim)) throw new Error("shim.js mudou o export: revise o gerador");
  shim = shim.replace(/^module\.exports = .*$/m, "");

  const partes = ORDEM.map((arq) => {
    const src = fs.readFileSync(path.join(NUCLEO, arq), "utf8");
    // o corpo da fábrica é um módulo (modo estrito): `with` e octais não passam
    if (/^\s*import\s|^\s*export\s/m.test(src)) throw new Error(`${arq} virou módulo ES: revise o gerador`);
    return `/* ---- ${arq} */\n${src}\n`;
  });

  return `/* GERADO por scripts/gera-nucleo-mcp.js — não edite à mão.
 * Fontes: src/nucleo/shim.js e, de nucleo/: ${ORDEM.join(", ")}. */
/* eslint-disable */
// deno-lint-ignore-file
// deno-fmt-ignore-file
${shim}
/** Um núcleo novo, isolado dos outros. \`ext.supabase\` é o módulo que o
 *  núcleo espera em window.supabase ({ createClient }); \`ext.localStorage\`,
 *  opcional, onde o cache de mercado fica (padrão: memória desta instância). */
export function criaNucleo(ext = {}) {
  const window = aplicaShim({}, {
    localStorage: ext.localStorage || localStorageMemoria(),
    supabase: ext.supabase || { createClient: () => ({ auth: {}, from: () => ({}) }) },
    zip: {},
  });
  const self = window;
  const { document, navigator, localStorage, matchMedia, requestAnimationFrame, cancelAnimationFrame, Image, supabase, zip } = window;
  const addEventListener = window.addEventListener, removeEventListener = window.removeEventListener;
  const FC = window.FC;

${partes.join("\n")}
  return FC;
}
`;
}

const novo = gera();
if (process.argv.includes("--confere")) {
  const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, "utf8") : "";
  if (atual !== novo) { console.error("nucleo.gen.mjs está velho: rode `npm run gera:mcp`"); process.exit(1); }
  console.log("nucleo.gen.mjs em dia");
} else {
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, novo);
  console.log(`núcleo do MCP: ${ORDEM.length} arquivos, ${(novo.length / 1024).toFixed(0)} KB → supabase/functions/mcp/nucleo.gen.mjs`);
}

