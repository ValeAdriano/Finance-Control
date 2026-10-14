/* Monta o "palco" da retrospectiva e do vídeo de divulgação com os fontes do
 * site — os mesmos arquivos, sem cópia à mão:
 *
 *   node scripts/gera-palco.js
 *
 *   modelo/retrospectiva.js  FC.recap (plano, textos, eventos, brl, pct…)
 *   recap/render.js          FC.recapRender (o quadro 1080×1920)
 *   recap/audio.js           FC.recapAudio (trilha em Web Audio)
 *   promo/promo.js           FC.promo (o vídeo de divulgação)
 *   img/icone-512.png        o logo, como data URI
 *
 * mais src/recap/motor-base.js (o FC mínimo), src/recap/motor.js (o player) e
 * src/recap/palco.css. Saídas:
 *
 *   src/recap/palco.gen.ts   MOTOR e CSS, embutidos no HTML da WebView (celular)
 *   public/palco.html + .js  a mesma coisa como arquivos, para o iframe da web:
 *                            a CSP do site (script-src 'self') não deixa rodar
 *                            script inline num iframe srcdoc
 *
 * Rode de novo quando o site mudar esses arquivos ou quando mexer no motor. */
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const SITE = path.resolve(RAIZ, "..", "investimentos-compartilhar", "assets");
const le = (...p) => fs.readFileSync(path.join(...p), "utf8");

// ícones que o player usa, do mesmo dicionário do app (src/ui/icones.gen.ts)
const NOMES = ["exportar", "fechar", "pausa", "play", "voltar", "chevron", "som", "somDesligado", "olho", "olhoFechado"];
const genIcones = le(RAIZ, "src", "ui", "icones.gen.ts");
const icones = {};
for (const n of NOMES) {
  const m = genIcones.match(new RegExp(`^\\s*${JSON.stringify(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: (".*"),$`, "m"));
  if (!m) throw new Error(`ícone ${n} não está em icones.gen.ts (rode npm run gera:icones)`);
  icones[n] = JSON.parse(m[1]);
}

const logo = "data:image/png;base64," + fs.readFileSync(path.join(SITE, "img", "icone-512.png")).toString("base64");
let promo = le(SITE, "js", "promo", "promo.js");
if (!promo.includes('"assets/img/icone-512.png"')) throw new Error("promo.js não carrega mais assets/img/icone-512.png: revise o gerador");
promo = promo.replace('"assets/img/icone-512.png"', "LOGO_PALCO");

const base = le(RAIZ, "src", "recap", "motor-base.js")
  .replace("var P = __ICONES__;", () => `var P = ${JSON.stringify(icones)};`)
  .replace("window.LOGO_PALCO = __LOGO__;", () => `window.LOGO_PALCO = ${JSON.stringify(logo)};`);
if (/= __(ICONES|LOGO)__/.test(base)) throw new Error("motor-base.js mudou: não achei onde pôr os ícones e o logo");
const partes = [
  ["motor-base.js", base],
  ["modelo/retrospectiva.js", le(SITE, "js", "modelo", "retrospectiva.js")],
  ["recap/render.js", le(SITE, "js", "recap", "render.js")],
  ["recap/audio.js", le(SITE, "js", "recap", "audio.js")],
  ["promo/promo.js", promo],
  ["motor.js", le(RAIZ, "src", "recap", "motor.js")],
];
// cada fonte isolado num bloco: um erro de sintaxe não derruba os outros
const MOTOR = partes.map(([nome, src]) => `/* ---- ${nome} */\n${src}\n`).join("\n");
if (MOTOR.includes("</script")) throw new Error("o motor contém </script>: não dá para embutir no HTML");
const CSS = le(RAIZ, "src", "recap", "palco.css");

const cab = "GERADO por scripts/gera-palco.js — não edite à mão.";
fs.writeFileSync(path.join(RAIZ, "src", "recap", "palco.gen.ts"),
  `/* ${cab}\n * Fontes: ../investimentos-compartilhar/assets (modelo/retrospectiva.js, recap/*, promo/promo.js,\n * img/icone-512.png) + src/recap/motor-base.js, motor.js e palco.css. */\n/* eslint-disable */\n` +
  `export const MOTOR = ${JSON.stringify(MOTOR)};\nexport const CSS = ${JSON.stringify(CSS)};\n`);

const PUB = path.join(RAIZ, "public");
fs.mkdirSync(PUB, { recursive: true });
fs.writeFileSync(path.join(PUB, "palco.js"), `/* ${cab} */\n${MOTOR}`);
fs.writeFileSync(path.join(PUB, "palco.html"), `<!doctype html>
<!-- ${cab} -->
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Bullz · player</title>
<style>${CSS}</style></head><body>
<script src="palco.js"></script></body></html>
`);
console.log(`palco: motor ${(MOTOR.length / 1024).toFixed(0)} KB (logo ${(logo.length / 1024).toFixed(0)} KB) → src/recap/palco.gen.ts, public/palco.html, public/palco.js`);
