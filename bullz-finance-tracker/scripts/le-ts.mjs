/* Importa um módulo .ts simples (content/*.ts) em qualquer versão do Node:
 * transpila com o TypeScript do projeto para um .mjs temporário. Usado pelo
 * gerador da home, que roda no build da Vercel. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
export async function leTs(arquivo) {
  const ts = require("typescript");
  const fonte = fs.readFileSync(arquivo, "utf8");
  const js = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bullz-ts-")), path.basename(arquivo).replace(/\.ts$/, ".mjs"));
  fs.writeFileSync(tmp, js);
  try { return await import(pathToFileURL(tmp).href); } finally { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); }
}
