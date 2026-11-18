/* e2e da home pública (Marco 13). Precisa do build: `npm run build` antes.
 *   npm run e2e
 * 1. "/" carrega deslogado, sem erro de console (com a CSP de verdade);
 * 2. cada capítulo do tour pula para o tempo certo;
 * 3. "Entrar" leva ao login;
 * 4. quem já tem sessão vai de "/" direto para o app;
 * 5. link antigo "/#/ativos" vai para "/ativos". */
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { sobe } from "./servidor-vercel.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { chromium } = createRequire(import.meta.url)("playwright");
const { capitulos } = await import(path.join(RAIZ, "content", "tour.ts"));
const srv = await sobe(path.join(RAIZ, "dist"), path.join(RAIZ, "vercel.json"));
const nav = await chromium.launch();
let ok = 0;
const caso = async (nome, f) => {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  const erros = [];
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR|supabase|fetch/i.test(m.text())) erros.push(m.text()); });
  p.on("pageerror", (e) => erros.push(e.message));
  try { await f(p, erros); ok++; console.log("ok -", nome); }
  catch (e) { console.error("FALHOU -", nome, "\n", e.message); process.exitCode = 1; }
  finally { await ctx.close(); }
};

await caso("/ carrega deslogado, sem erro de console nem violação da CSP", async (p, erros) => {
  await p.goto(srv.url + "/", { waitUntil: "load" });
  assert.equal(new URL(p.url()).pathname, "/");
  assert.match(await p.title(), /Bullz/);
  assert.equal(await p.locator("h1").innerText(), "Seu patrimônio inteiro, num lugar só.");
  assert.equal(await p.locator(".capitulos button").count(), capitulos.length);
  await p.waitForTimeout(500);
  assert.deepEqual(erros, []);
});

await caso("os capítulos do tour pulam para o tempo certo", async (p) => {
  await p.goto(srv.url + "/", { waitUntil: "load" });
  for (const c of [capitulos[3], capitulos[1], capitulos.at(-1)]) {
    await p.locator(`.capitulos button[data-t="${c.inicio}"]`).click();
    await p.waitForFunction((t) => { const v = document.getElementById("video-tour"); return v.readyState >= 1 && Math.abs(v.currentTime - t) < 1.2; }, c.inicio, { timeout: 15000 });
    assert.equal(await p.locator(`.capitulos button[data-t="${c.inicio}"]`).getAttribute("aria-current"), "true");
  }
});

await caso("Entrar leva ao login", async (p) => {
  await p.goto(srv.url + "/", { waitUntil: "load" });
  await p.locator("header .btn", { hasText: "Entrar" }).click();
  await p.waitForURL(/\/inicio$/);
  await p.waitForSelector('input[type="email"], input[autocomplete="email"], input[inputmode="email"]', { timeout: 30000 });
});

await caso("usuário logado em / vai para o app", async (p) => {
  await p.goto(srv.url + "/favicon.ico");
  await p.evaluate(() => localStorage.setItem("fc-sessao", JSON.stringify({ access_token: "x", refresh_token: "y", expires_at: 0 })));
  await p.goto(srv.url + "/", { waitUntil: "commit" });
  await p.waitForURL(/\/inicio$/, { timeout: 10000 });
});

await caso("link antigo /#/ativos vai para /ativos", async (p) => {
  await p.goto(srv.url + "/#/ativos", { waitUntil: "commit" });
  await p.waitForURL(/\/ativos$/, { timeout: 10000 });
});

await nav.close();
srv.fecha();
console.log(`e2e home: ${ok} de 5 casos`);
