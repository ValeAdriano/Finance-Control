/* Gera os ícones do app a partir de assets/img/app/logo-fonte.png (os chifres
 * sobre fundo transparente): logo sobre branco liso, centralizada pela área
 * real do desenho, com o respiro certo para cada uso.
 *
 *   node scripts/gera-icones-app.js
 *
 * Saídas:
 *   public/favicon.ico                       16, 32 e 48 (PNG dentro do ICO)
 *   public/assets/img/favicon-32.png, icone.svg
 *   public/assets/img/icone-app-*.png         PWA "any"
 *   public/assets/img/icone-app-maskable-*.png PWA "maskable" (zona segura)
 *   public/assets/img/apple-touch-icon.png
 *   assets/img/app/icone-app-1024.png, android-frente.png, android-fundo.png
 *
 * "logo" é o maior lado do desenho ÷ o lado do ícone. */
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp-compact");

const RAIZ = path.resolve(__dirname, "..");
const FONTE = path.join(RAIZ, "assets", "img", "app", "logo-fonte.png");
const PUB = path.join(RAIZ, "public");
const IMG = path.join(PUB, "assets", "img");
const APP = path.join(RAIZ, "assets", "img", "app");
const BRANCO = 0xffffffff;
const CANTO_FAVICON = 0.22; // raio dos cantos do favicon, em fração do lado

// caixa do desenho (pixels com alpha > 8), não a borda da imagem
function caixa(img) {
  const { width: w, height: h, data } = img.bitmap;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// o redimensionamento mistura canal a canal: com a cor multiplicada pelo
// alpha, o preto dos pixels transparentes não vaza como franja na borda
function multiplica(img, volta) {
  const d = img.bitmap.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    for (let c = 0; c < 3; c++) d[i + c] = volta ? (a ? Math.min(255, Math.round(d[i + c] / a)) : 0) : Math.round(d[i + c] * a);
  }
  return img;
}

// reduzir de uma vez só serrilha o traço: vai pela metade até perto do alvo
function reduz(img, w, h) {
  const r = multiplica(img.clone(), false);
  while (r.bitmap.width / 2 >= w && r.bitmap.height / 2 >= h) r.resize(Math.round(r.bitmap.width / 2), Math.round(r.bitmap.height / 2), Jimp.RESIZE_BICUBIC);
  r.resize(w, h, Jimp.RESIZE_BICUBIC);
  // o bicúbico passa um pouco do limite: a cor não pode ficar acima do alpha
  const d = r.bitmap.data;
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.min(d[i + c], d[i + 3]);
  return multiplica(r, true);
}

// cantos arredondados com borda suave (o resto do quadro fica como está)
function arredonda(img, raio) {
  const { width: S, data } = img.bitmap;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cx = x + 0.5 < raio ? raio : x + 0.5 > S - raio ? S - raio : null;
    const cy = y + 0.5 < raio ? raio : y + 0.5 > S - raio ? S - raio : null;
    if (cx == null || cy == null) continue;
    const cobre = Math.max(0, Math.min(1, raio - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
    data[(y * S + x) * 4 + 3] = Math.round(data[(y * S + x) * 4 + 3] * cobre);
  }
  return img;
}

// um ícone S×S: fundo (ou transparente), logo centralizada ocupando `fr` do lado
function icone(logo, cx, S, fr, { fundo = BRANCO, cantos = 0 } = {}) {
  const k = (fr * S) / Math.max(cx.w, cx.h);
  const w = Math.max(1, Math.round(cx.w * k)), h = Math.max(1, Math.round(cx.h * k));
  const desenho = reduz(logo.clone().crop(cx.x, cx.y, cx.w, cx.h), w, h);
  const img = new Jimp(S, S, fundo);
  img.composite(desenho, Math.round((S - w) / 2), Math.round((S - h) / 2));
  return cantos ? arredonda(img, cantos * S) : img;
}

// ICO com PNGs dentro: cabeçalho, uma entrada por tamanho e os PNGs em sequência
function ico(pngs) {
  const cab = Buffer.alloc(6 + 16 * pngs.length);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(pngs.length, 4);
  let pos = cab.length;
  pngs.forEach(({ S, buf }, i) => {
    const o = 6 + 16 * i;
    cab.writeUInt8(S >= 256 ? 0 : S, o); cab.writeUInt8(S >= 256 ? 0 : S, o + 1);
    cab.writeUInt8(0, o + 2); cab.writeUInt8(0, o + 3);
    cab.writeUInt16LE(1, o + 4); cab.writeUInt16LE(32, o + 6);
    cab.writeUInt32LE(buf.length, o + 8); cab.writeUInt32LE(pos, o + 12);
    pos += buf.length;
  });
  return Buffer.concat([cab, ...pngs.map((p) => p.buf)]);
}

const png = (img) => img.getBufferAsync(Jimp.MIME_PNG);
async function grava(arquivo, img) {
  const buf = Buffer.isBuffer(img) ? img : await png(img);
  fs.writeFileSync(arquivo, buf);
  console.log(path.relative(RAIZ, arquivo), buf.length, "bytes");
  return buf;
}

(async () => {
  const logo = await Jimp.read(FONTE);
  const cx = caixa(logo);

  // favicon: quadrado branco de cantos redondos, logo grande para ler na aba
  const fav = (S) => icone(logo, cx, S, 0.78, { cantos: CANTO_FAVICON });
  const pngsIco = [];
  for (const S of [16, 32, 48]) pngsIco.push({ S, buf: await png(fav(S)) });
  await grava(path.join(PUB, "favicon.ico"), ico(pngsIco));
  await grava(path.join(IMG, "favicon-32.png"), pngsIco[1].buf);
  const b64 = (await png(fav(192))).toString("base64");
  fs.writeFileSync(path.join(IMG, "icone.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="100%" height="100%">\n  <image width="192" height="192" href="data:image/png;base64,${b64}"/>\n</svg>\n`);
  console.log("public/assets/img/icone.svg");

  // PWA "any" e iOS: branco até a borda (o sistema recorta o canto)
  for (const S of [192, 512]) await grava(path.join(IMG, `icone-app-${S}.png`), icone(logo, cx, S, 0.6));
  await grava(path.join(IMG, "apple-touch-icon.png"), icone(logo, cx, 180, 0.6));
  await grava(path.join(APP, "icone-app-1024.png"), icone(logo, cx, 1024, 0.6));

  // PWA "maskable": a máscara pode ser um círculo de 80% do lado; 50% cabe com folga
  for (const S of [192, 512]) await grava(path.join(IMG, `icone-app-maskable-${S}.png`), icone(logo, cx, S, 0.5));

  // Android adaptativo: fundo branco e a frente só com os chifres na zona segura (66/108)
  await grava(path.join(APP, "android-fundo.png"), new Jimp(1024, 1024, BRANCO));
  await grava(path.join(APP, "android-frente.png"), icone(logo, cx, 1024, 0.44, { fundo: 0x00000000 }));
})().catch((e) => { console.error(e); process.exit(1); });
