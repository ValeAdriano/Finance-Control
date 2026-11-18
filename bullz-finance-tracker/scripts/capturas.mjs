/* npm run capturas — grava as telas do app com a conta demo (Marco 11).
 *
 * 1. Gera o build web com o modo demo ligado (EXPO_PUBLIC_FIXTURE=demo) em
 *    .capturas-build/ (pula com CAPTURAS_SEM_BUILD=1 se já existir);
 * 2. serve o build num servidor local (SPA: tudo cai no index.html);
 * 3. abre cada tela de scripts/capturas.config.ts no Chromium do Playwright,
 *    em desktop (1440) e celular (390), tema claro e escuro;
 * 4. salva em public/capturas/<tela>-<tamanho>-<tema>.webp (ffmpeg) e falha
 *    se aparecer erro de console. Nada de dado real: só a conta demo. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import telas, { tamanhos, temas } from "./capturas.config.ts";

// o Playwright vem do ambiente (npx playwright install chromium), não das dependências do app
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch {
  console.error("Playwright não encontrado: npm i -D playwright && npx playwright install chromium"); process.exit(1);
}
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(RAIZ, ".capturas-build");
const SAIDA = path.join(RAIZ, "public", "capturas");
const SO = process.env.CAPTURAS_SO ? process.env.CAPTURAS_SO.split(",") : null;

if (!process.env.CAPTURAS_SEM_BUILD || !fs.existsSync(path.join(BUILD, "index.html"))) {
  console.log("build web com a conta demo…");
  const r = spawnSync("npx", ["expo", "export", "-p", "web", "--output-dir", BUILD], { cwd: RAIZ, stdio: "inherit", env: { ...process.env, EXPO_PUBLIC_FIXTURE: "demo", CI: "1" } });
  if (r.status !== 0) process.exit(r.status || 1);
}

const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".ttf": "font/ttf", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let arq = path.join(BUILD, url);
  if (!arq.startsWith(BUILD) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) arq = path.join(BUILD, "index.html");
  res.writeHead(200, { "Content-Type": TIPOS[path.extname(arq)] || "application/octet-stream" });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${servidor.address().port}`;
fs.mkdirSync(SAIDA, { recursive: true });

const navegador = await chromium.launch();
const erros = [];
let n = 0;
for (const tam of tamanhos) {
  for (const tema of temas) {
    const ctx = await navegador.newContext({ viewport: { width: tam.largura, height: tam.altura }, deviceScaleFactor: 1, colorScheme: tema === "escuro" ? "dark" : "light",
      reducedMotion: "reduce", locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const pagina = await ctx.newPage();
    pagina.on("console", (m) => { if (m.type() === "error") erros.push(`${tam.nome}/${tema}: ${m.text()}`); });
    pagina.on("pageerror", (e) => erros.push(`${tam.nome}/${tema}: ${e.message}`));
    for (const tela of telas) {
      if (SO && !SO.includes(tela.nome)) continue;
      await pagina.goto(`${base}${tela.rota}?fixture=demo`, { waitUntil: "networkidle" });
      await pagina.waitForTimeout(1500);
      if (tela.alvo) {
        const alvo = pagina.getByText(tela.alvo, { exact: true }).first();
        try {
          await alvo.waitFor({ timeout: 5000 });
          // título da seção no alto da tela, abaixo da barra fixa
          await alvo.evaluate((el) => {
            el.scrollIntoView({ block: "start" });
            let p = el.parentElement;
            while (p && !(p.scrollHeight > p.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
            (p || document.scrollingElement).scrollTop -= 96;
          });
          await pagina.waitForTimeout(400);
        }
        catch { erros.push(`${tela.nome} (${tam.nome}/${tema}): não achei "${tela.alvo}" na tela`); }
      }
      const png = path.join(SAIDA, `${tela.nome}-${tam.nome}-${tema}.png`);
      await pagina.screenshot({ path: png });
      const webp = png.replace(/\.png$/, ".webp");
      const f = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-c:v", "libwebp", "-quality", "78", webp]);
      if (f.status !== 0) erros.push(`ffmpeg falhou em ${png}: ${f.stderr}`);
      fs.unlinkSync(png);
      n++;
    }
    await ctx.close();
  }
}
await navegador.close();
servidor.close();
console.log(`capturas: ${n} telas em public/capturas/`);
if (erros.length) { console.error("erros:\n" + erros.join("\n")); process.exit(1); }
