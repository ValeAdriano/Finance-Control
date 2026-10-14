/* O "palco": roda os desenhos do site (recap/render.js, recap/audio.js,
 * promo/promo.js) num canvas de verdade. Canvas 2D, Web Audio e MediaRecorder
 * não existem no React Native; lá dentro eles são os do navegador, e o quadro
 * sai idêntico ao do site.
 *
 *   celular: WebView com o HTML de htmlPalco(cfg) (motor embutido)
 *   web:     iframe de public/palco.html (motor em palco.js, servido de 'self'
 *            por causa da CSP); a configuração vai por postMessage
 *
 * O motor (src/recap/motor*.js + fontes do site) é montado por
 * scripts/gera-palco.js. Mensagens palco → app (JSON): { ev: "carregado" |
 * "pronto" | "fechar" | "aviso" | "pref" | "t" | "cor" | "gravando" |
 * "video-ini" | "video-parte" | "video-fim" | "video-erro", … }.
 * App → palco: { cmd, … } por window.__cmd (WebView) ou postMessage (iframe). */
import { CSS, MOTOR } from "./palco.gen";

export type CfgPalco = { prefs?: Record<string, any> } & (
  | { modo: "retro"; data: any; privado: boolean; mudo: boolean; reduzido: boolean; seguro: { topo: number; base: number } }
  | { modo: "promo"; dados: any; formato: "vertical" | "horizontal"; opts: { privado: boolean; chamada: string; site: string }; t: number });

/** JSON seguro dentro de <script> */
const jsonScript = (x: any) => JSON.stringify(x).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export function htmlPalco(cfg: CfgPalco) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<style>${CSS}</style></head><body>
<script>${MOTOR}
window.__inicia(${jsonScript(cfg)});</script></body></html>`;
}
