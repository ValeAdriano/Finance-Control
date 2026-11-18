/* Marco 12 — o tour: capítulos num arquivo só, vídeo e legendas em dia.
 *   node --test testes/tour-m12.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const VIDEO = path.join(RAIZ, "public", "video");

test("M12 · capítulos: 30 a 45 s, em ordem, com título, legenda e tela", async () => {
  const { capitulos, duracao, arquivos } = await import(path.join(RAIZ, "content", "tour.ts"));
  assert.ok(duracao >= 30 && duracao <= 45, String(duracao));
  assert.equal(capitulos[0].inicio, 0);
  for (let i = 1; i < capitulos.length; i++) assert.ok(capitulos[i].inicio > capitulos[i - 1].inicio);
  assert.ok(capitulos.at(-1).inicio < duracao);
  for (const c of capitulos) assert.ok(c.titulo && c.legenda && c.rota.startsWith("/"));
  for (const a of Object.values(arquivos)) assert.ok(fs.existsSync(path.join(RAIZ, "public", a)), `${a} não foi gerado: rode npm run video:render`);
});

test("M12 · o .vtt tem as mesmas legendas e tempos do content/tour.ts; tudo cabe em 8 MB", async () => {
  const { capitulos } = await import(path.join(RAIZ, "content", "tour.ts"));
  const vtt = fs.readFileSync(path.join(VIDEO, "tour.vtt"), "utf8");
  assert.match(vtt, /^WEBVTT/);
  for (const c of capitulos) {
    const s = `00:${String(Math.floor(c.inicio / 60)).padStart(2, "0")}:${String(c.inicio % 60).padStart(2, "0")}.000`;
    assert.ok(vtt.includes(s + " -->"), `cue de ${c.titulo} fora do tempo ${s}`);
    assert.ok(vtt.includes(`${c.titulo}: ${c.legenda}`), `legenda de ${c.titulo} diferente: rode npm run video:render`);
  }
  const total = ["tour.mp4", "tour.webm", "tour-poster.webp", "tour.vtt"].reduce((s, f) => s + fs.statSync(path.join(VIDEO, f)).size, 0);
  assert.ok(total <= 8 * 1024 * 1024, `${total} bytes`);
});
