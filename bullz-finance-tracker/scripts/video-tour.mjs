/* npm run video:render — regrava o tour do Bullz (Marco 12) do zero.
 *
 * 1. build web com a conta demo (o mesmo das capturas, .capturas-build/);
 * 2. para cada capítulo de content/tour.ts, abre a tela no Chromium do
 *    Playwright (1280×720), rola até a seção e grava quadro a quadro, com o
 *    título do capítulo e a legenda em português na própria página;
 * 3. o ffmpeg junta os quadros: tour.mp4 (H.264), tour.webm (VP9),
 *    tour-poster.webp; e o tour.vtt sai das mesmas legendas.
 * Tudo em public/video/. Falha se passar de 8 MB ou houver erro de console. */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { capitulos, duracao } from "../content/tour.ts";

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch {
  console.error("Playwright não encontrado: npm i -D playwright && npx playwright install chromium"); process.exit(1);
}
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(RAIZ, ".capturas-build");
const SAIDA = path.join(RAIZ, "public", "video");
const FPS = 20, L = 1280, A = 720, LIMITE = 8 * 1024 * 1024;

if (!process.env.VIDEO_SEM_BUILD || !fs.existsSync(path.join(BUILD, "index.html"))) {
  console.log("build web com a conta demo…");
  const r = spawnSync("npx", ["expo", "export", "-p", "web", "--output-dir", BUILD], { cwd: RAIZ, stdio: "inherit", env: { ...process.env, EXPO_PUBLIC_FIXTURE: "demo", CI: "1" } });
  if (r.status !== 0) process.exit(r.status || 1);
}
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf" };
const servidor = http.createServer((req, res) => {
  let arq = path.join(BUILD, decodeURIComponent((req.url || "/").split("?")[0]));
  if (!arq.startsWith(BUILD) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) arq = path.join(BUILD, "index.html");
  res.writeHead(200, { "Content-Type": TIPOS[path.extname(arq)] || "application/octet-stream" });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${servidor.address().port}`;

const QUADROS = fs.mkdtempSync(path.join(os.tmpdir(), "bullz-tour-"));
fs.mkdirSync(SAIDA, { recursive: true });
const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: L, height: A }, deviceScaleFactor: 1, colorScheme: "dark", locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const pagina = await ctx.newPage();
const erros = [];
pagina.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
pagina.on("pageerror", (e) => erros.push(e.message));

let quadro = 0;
const suave = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
for (let i = 0; i < capitulos.length; i++) {
  const c = capitulos[i];
  const fim = i + 1 < capitulos.length ? capitulos[i + 1].inicio : duracao;
  const n = Math.round((fim - c.inicio) * FPS);
  await pagina.goto(`${base}${c.rota}?fixture=demo`, { waitUntil: "networkidle" });
  await pagina.waitForTimeout(1200);
  // onde a rolagem começa e termina, e o título e a legenda do capítulo
  const faixa = await pagina.evaluate(({ alvo, titulo, legenda }) => {
    const acha = () => [...document.querySelectorAll("div, span, h1, h2, h3")].find((el) => el.childElementCount === 0 && el.textContent.trim() === alvo);
    const el = alvo ? acha() : null;
    let rolador = el ? el.parentElement : null;
    while (rolador && !(rolador.scrollHeight > rolador.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(rolador).overflowY))) rolador = rolador.parentElement;
    if (!rolador) rolador = [...document.querySelectorAll("div")].find((d) => d.scrollHeight > d.clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(d).overflowY)) || document.scrollingElement;
    rolador.setAttribute("data-tour-rolador", "1");
    const topo = el ? el.getBoundingClientRect().top + rolador.scrollTop - 110 : 0;
    const max = rolador.scrollHeight - rolador.clientHeight;
    const caixa = document.createElement("div");
    caixa.innerHTML = `<div style="position:fixed;right:32px;top:72px;z-index:99999;padding:8px 14px;border-radius:999px;background:rgba(10,10,12,.82);color:#fff;font:600 15px Inter,system-ui,sans-serif;letter-spacing:.2px">${titulo}</div>
      <div style="position:fixed;left:50%;bottom:36px;transform:translateX(-50%);z-index:99999;max-width:80%;padding:10px 18px;border-radius:12px;background:rgba(10,10,12,.82);color:#fff;font:500 22px/1.35 Inter,system-ui,sans-serif;text-align:center">${legenda}</div>`;
    document.body.appendChild(caixa);
    return { de: Math.max(0, Math.min(max, topo - 40)), ate: Math.max(0, Math.min(max, topo + 220)) };
  }, { alvo: c.alvo || null, titulo: c.titulo, legenda: c.legenda });
  for (let k = 0; k < n; k++) {
    const t = suave(Math.min(1, k / Math.max(1, n - FPS)));   // o último segundo fica parado
    await pagina.evaluate((y) => { document.querySelector("[data-tour-rolador]").scrollTop = y; }, faixa.de + (faixa.ate - faixa.de) * t);
    await pagina.screenshot({ path: path.join(QUADROS, String(quadro++).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 85 });
  }
  console.log(`capítulo ${i + 1}/${capitulos.length}: ${c.titulo} (${n} quadros)`);
}
await navegador.close();
servidor.close();
if (erros.length) { console.error("erros de console:\n" + erros.join("\n")); process.exit(1); }

const ff = (args) => { const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" }); if (r.status !== 0) process.exit(r.status || 1); };
const entrada = ["-framerate", String(FPS), "-i", path.join(QUADROS, "%05d.jpg")];
ff([...entrada, "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(SAIDA, "tour.mp4")]);
ff([...entrada, "-c:v", "libvpx-vp9", "-crf", "42", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", path.join(SAIDA, "tour.webm")]);
ff(["-i", path.join(QUADROS, String(FPS).padStart(5, "0") + ".jpg"), "-c:v", "libwebp", "-quality", "75", path.join(SAIDA, "tour-poster.webp")]);
fs.rmSync(QUADROS, { recursive: true, force: true });

// legendas: o mesmo texto que está gravado no vídeo
const hms = (s) => `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.round((s % 1) * 1000)).padStart(3, "0")}`;
const vtt = ["WEBVTT", ""];
capitulos.forEach((c, i) => { const fim = i + 1 < capitulos.length ? capitulos[i + 1].inicio : duracao; vtt.push(`${i + 1}`, `${hms(c.inicio)} --> ${hms(fim)}`, `${c.titulo}: ${c.legenda}`, ""); });
fs.writeFileSync(path.join(SAIDA, "tour.vtt"), vtt.join("\n"));

const total = ["tour.mp4", "tour.webm", "tour-poster.webp", "tour.vtt"].reduce((s, f) => s + fs.statSync(path.join(SAIDA, f)).size, 0);
console.log(`tour: ${quadro} quadros, ${duracao} s, ${(total / 1024 / 1024).toFixed(2)} MB em public/video/`);
if (total > LIMITE) { console.error("passou de 8 MB"); process.exit(1); }
