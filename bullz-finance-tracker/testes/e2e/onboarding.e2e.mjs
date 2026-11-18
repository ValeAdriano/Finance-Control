/* e2e do onboarding (Marco 14), no build com o modo fixture (o das capturas:
 * `npm run capturas` ou `npm run video:render` geram .capturas-build/).
 *   node testes/e2e/onboarding.e2e.mjs
 * 1. conta nova completa o onboarding e termina com potes, plano em rascunho
 *    e o modo de alocação salvos;
 * 2. sair no passo 4 e voltar retoma no passo 4;
 * 3. conta que já existia não vê o onboarding, só o checklist. */
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { sobe } from "./servidor-vercel.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { chromium } = createRequire(import.meta.url)("playwright");
// o build do modo fixture é o app puro (sem a home gerada): tudo reescreve para o index.html
const srv = await sobe(path.join(RAIZ, ".capturas-build"), path.join(RAIZ, "vercel.json"), { rewritePara: "/index.html" });
const nav = await chromium.launch();
let ok = 0;
const caso = async (nome, f) => {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  try { await f(p); assert.deepEqual(erros, []); ok++; console.log("ok -", nome); }
  catch (e) { console.error("FALHOU -", nome, "\n", e.message); await p.screenshot({ path: path.join(RAIZ, ".capturas-build", "falha-e2e.png") }).catch(() => {}); process.exitCode = 1; }
  finally { await ctx.close(); }
};
const passo = (p, n) => p.getByText(new RegExp(`^Passo ${n} de 9`)).waitFor({ timeout: 20000 });
const botao = (p, texto) => p.getByRole("button", { name: texto, exact: true }).first().click();
const campo = (p, rotulo, valor) => p.getByLabel(rotulo, { exact: true }).fill(valor);

await caso("conta nova completa o onboarding: potes, plano em rascunho e modo de alocação salvos", async (p) => {
  await p.goto(srv.url + "/inicio?fixture=vazia", { waitUntil: "networkidle" });
  await p.waitForURL(/\/configurar$/, { timeout: 20000 });
  await passo(p, 1); await botao(p, "Começar");
  await passo(p, 2); await botao(p, "Salvar e continuar");
  await passo(p, 3); await campo(p, "Salário", "6000"); await botao(p, "Salvar e continuar");
  await passo(p, 4); await campo(p, "Custo de vida", "3500"); await botao(p, "Salvar e criar os potes");
  await passo(p, 5); await botao(p, "Salvar e continuar");
  await passo(p, 6); await botao(p, "Entendi");
  await passo(p, 7); await p.getByText("Não tenho", { exact: true }).first().click(); await botao(p, "Salvar e continuar");
  await passo(p, 8); await botao(p, "Deixar como rascunho");
  await passo(p, 9); await botao(p, "Continuar");
  await p.waitForURL(/\/inicio$/, { timeout: 20000 });
  const r = await p.evaluate(() => { const b = window.FC.estado.base; return { potes: b.potes.length, planos: b.planosMensais.map((x) => x.status), modo: (b.prefsBrutas.hierarquia || {}).modo_alocacao, ganhos: b.ganhos.length }; });
  assert.equal(r.potes, 5);
  assert.deepEqual(r.planos, ["rascunho"]);
  assert.equal(r.modo, "hierarquia");
  assert.equal(r.ganhos, 1);
});

await caso("sair no passo 4 e voltar retoma no passo 4", async (p) => {
  await p.goto(srv.url + "/inicio?fixture=vazia", { waitUntil: "networkidle" });
  await passo(p, 1); await botao(p, "Começar");
  await passo(p, 2); await botao(p, "Pular este passo");
  await passo(p, 3); await botao(p, "Pular este passo");
  await passo(p, 4);
  await botao(p, "Sair e continuar depois");
  await p.waitForURL(/\/inicio$/);
  await p.goto(srv.url + "/inicio", { waitUntil: "networkidle" });
  await p.waitForURL(/\/configurar$/, { timeout: 20000 });
  await passo(p, 4);
});

await caso("conta que já existia não vê o onboarding, só o checklist", async (p) => {
  await p.goto(srv.url + "/inicio?fixture=1", { waitUntil: "networkidle" });
  await p.getByText("Complete a configuração").waitFor({ timeout: 20000 });
  assert.match(p.url(), /\/inicio/);
  await p.getByText("Potes com finalidade").waitFor();
});

await nav.close();
srv.fecha();
console.log(`e2e onboarding: ${ok} de 3 casos`);
