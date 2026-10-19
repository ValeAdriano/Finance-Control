/* F6 — o palco (retrospectiva e vídeo de divulgação) roda os fontes do núcleo.
 * O motor gerado tem que conter, sem alteração, os arquivos atuais do núcleo e
 * do src/recap/motor*.js; se não contiver, rode `npm run gera:palco`.
 *
 *   node --test testes/palco.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "..");
const NUCLEO = path.resolve(RAIZ, "nucleo");
const le = (...p) => fs.readFileSync(path.join(...p), "utf8");
const motor = le(RAIZ, "public", "palco.js");
const gen = le(RAIZ, "src", "recap", "palco.gen.ts");

test("R12 · public/palco.js traz os fontes atuais do núcleo", () => {
  for (const f of ["modelo/retrospectiva.js", "recap/render.js", "recap/audio.js"]) {
    assert.ok(motor.includes(le(NUCLEO, f)), `${f} mudou no núcleo: rode npm run gera:palco`);
  }
  const promo = le(NUCLEO, "promo/promo.js").replace('"assets/img/icone-512.png"', "LOGO_PALCO");
  assert.ok(motor.includes(promo), "promo/promo.js mudou no núcleo: rode npm run gera:palco");
  assert.ok(motor.includes(le(RAIZ, "src", "recap", "motor.js")), "src/recap/motor.js mudou: rode npm run gera:palco");
});

test("R12 · o motor embutido (WebView) é o mesmo do palco.html (web)", () => {
  const MOTOR = JSON.parse(gen.match(/^export const MOTOR = (".*");$/m)[1]);
  assert.ok(motor.endsWith(MOTOR), "palco.gen.ts e public/palco.js divergiram: rode npm run gera:palco");
  assert.ok(!MOTOR.includes("</script"), "o motor não pode conter </script>");
});

test("R12 · o motor é JS válido e define o player", () => {
  new vm.Script(motor, { filename: "palco.js" });
  assert.match(motor, /window\.__inicia = function/);
});
