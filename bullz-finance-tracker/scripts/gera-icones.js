/* Gera src/ui/icones.gen.ts a partir do dicionário `P` de
 * ../investimentos-compartilhar/assets/js/util.js — fonte única dos ícones.
 *
 *   node scripts/gera-icones.js
 *
 * Extrai o bloco `const P = { ... };` (os paths SVG, grade 24, traço 1.6) e
 * emite um mapa nome -> string de <path>/<circle>/<rect>. O componente
 * src/ui/icone.tsx desenha isso com react-native-svg usando os mesmos
 * atributos do FC.icone do site (viewBox 0 0 24 24, stroke currentColor 1.6). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const UTIL = path.resolve(__dirname, "..", "..", "investimentos-compartilhar", "assets", "js", "util.js");
const SAIDA = path.resolve(__dirname, "..", "src", "ui", "icones.gen.ts");

const fonte = fs.readFileSync(UTIL, "utf8");

// localiza "const P = {" e casa até o "};" no mesmo nível de chaves
const inicio = fonte.indexOf("const P = {");
if (inicio < 0) throw new Error("não achei `const P = {` em util.js");
let i = fonte.indexOf("{", inicio);
let nivel = 0, fim = -1;
for (let j = i; j < fonte.length; j++) {
  const c = fonte[j];
  if (c === "{") nivel++;
  else if (c === "}") { nivel--; if (nivel === 0) { fim = j + 1; break; } }
}
if (fim < 0) throw new Error("bloco de ícones não fechou");
const objeto = fonte.slice(i, fim);

// avalia o literal num sandbox mínimo (só strings)
const P = vm.runInNewContext("(" + objeto + ")", {});
const nomes = Object.keys(P);
if (!nomes.length) throw new Error("dicionário de ícones vazio");

const linhas = nomes.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(P[n])},`).join("\n");
const ts = `/* GERADO por scripts/gera-icones.js — não edite à mão.
 * Fonte: ../investimentos-compartilhar/assets/js/util.js (dicionário P).
 * ${nomes.length} ícones. Rode o gerador de novo quando o site mudar os ícones. */

export const ICONES = {
${linhas}
} as const;

export type NomeIcone = keyof typeof ICONES;
`;

fs.writeFileSync(SAIDA, ts);
console.log(`icones.gen.ts: ${nomes.length} ícones escritos`);
