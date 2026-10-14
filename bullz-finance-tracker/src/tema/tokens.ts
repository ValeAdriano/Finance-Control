/* Tokens visuais — espelho de ../investimentos-compartilhar/assets/css/app.css.
 *
 * CLARO e ESCURO guardam os valores EXATAMENTE como no CSS (strings, com os
 * mesmos espaços), para o teste de paridade T1/T2 (testes/tema.test.js) poder
 * comparar var a var com o `:root`. Os derivados numéricos (raios, espaço)
 * saem daqui para o uso no React Native. Uma só fonte, dois formatos. */

/** `:root` — claro. Chaves = nome da var CSS sem `--`, em camelCase. */
export const CLARO: Record<string, string> = {
  bg: "#f5f5f7",
  bg2: "#ffffff",
  bg3: "#fbfbfd",
  vidro: "rgba(255, 255, 255, 0.72)",
  vidroForte: "rgba(255, 255, 255, 0.86)",
  ink: "#1d1d1f",
  ink2: "#6a6a6f",
  ink3: "#6a6a6f",
  linha: "rgba(0, 0, 0, 0.08)",
  linha2: "rgba(0, 0, 0, 0.12)",
  campo: "rgba(118, 118, 128, 0.12)",
  campoFoco: "rgba(0, 113, 227, 0.18)",
  acento: "#0066cc",
  acento2: "#0071e3",
  acentoSuave: "rgba(0, 113, 227, 0.1)",
  verde: "#1f7a35",
  verdeSuave: "rgba(52, 199, 89, 0.14)",
  amarelo: "#b25000",
  amareloSuave: "rgba(255, 159, 10, 0.16)",
  vermelho: "#d70015",
  vermelhoSuave: "rgba(255, 59, 48, 0.12)",
  cinzaSuave: "rgba(118, 118, 128, 0.12)",
  terra: "#8a5a2b",
  terraSuave: "rgba(172, 115, 57, 0.14)",
  s1: "#0071e3",
  s2: "#34c759",
  s3: "#ff9f0a",
  s4: "#af52de",
  s5: "#a2845e",
  sref: "#6e6e73",
  sombra: "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 28px rgba(0, 0, 0, 0.06)",
  sombraAlta: "0 24px 80px rgba(0, 0, 0, 0.18)",
  r: "18px",
  rSm: "12px",
  rXs: "8px",
  curva: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  mola: "cubic-bezier(0.32, 0.72, 0, 1)",
  e1: "4px",
  e2: "8px",
  e3: "16px",
  e4: "24px",
  e5: "48px",
  e6: "96px",
};

/** `:root[data-tema="escuro"]` / `@media (prefers-color-scheme: dark)`. */
export const ESCURO: Record<string, string> = {
  ...CLARO,
  bg: "#000000",
  bg2: "#1c1c1e",
  bg3: "#111113",
  vidro: "rgba(28, 28, 30, 0.72)",
  vidroForte: "rgba(28, 28, 30, 0.9)",
  ink: "#f5f5f7",
  ink2: "#a1a1a6",
  ink3: "#98989d",
  linha: "rgba(255, 255, 255, 0.09)",
  linha2: "rgba(255, 255, 255, 0.14)",
  campo: "rgba(118, 118, 128, 0.24)",
  campoFoco: "rgba(10, 132, 255, 0.28)",
  acento: "#0a84ff",
  acento2: "#409cff",
  acentoSuave: "rgba(10, 132, 255, 0.16)",
  verde: "#30d158",
  verdeSuave: "rgba(48, 209, 88, 0.16)",
  amarelo: "#ffb340",
  amareloSuave: "rgba(255, 159, 10, 0.18)",
  vermelho: "#ff6961",
  vermelhoSuave: "rgba(255, 69, 58, 0.16)",
  cinzaSuave: "rgba(118, 118, 128, 0.24)",
  terra: "#d6a570",
  terraSuave: "rgba(214, 165, 112, 0.16)",
  s1: "#0a84ff",
  s2: "#30d158",
  s3: "#ffd60a",
  s4: "#bf5af2",
  s5: "#c9a77c",
  sref: "#98989d",
  sombra: "0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 28px rgba(0, 0, 0, 0.35)",
  sombraAlta: "0 24px 80px rgba(0, 0, 0, 0.6)",
};

/** Sobreposições de alto contraste (prefers-contrast: more). */
export const CONTRASTE_CLARO: Record<string, string> = {
  ink: "#000000",
  ink2: "#3a3a3c",
  ink3: "#48484a",
  linha: "rgba(0, 0, 0, 0.28)",
  linha2: "rgba(0, 0, 0, 0.45)",
  campo: "rgba(0, 0, 0, 0.16)",
  acento: "#0058b3",
};
export const CONTRASTE_ESCURO: Record<string, string> = {
  ink: "#ffffff",
  ink2: "#ebebf5",
  ink3: "#d1d1d6",
  linha: "rgba(255, 255, 255, 0.35)",
  linha2: "rgba(255, 255, 255, 0.55)",
  campo: "rgba(255, 255, 255, 0.22)",
  acento: "#409cff",
};

// --- derivados numéricos para o React Native -------------------------------
const px = (v: string) => parseFloat(v);

/** Raios em número (pt): r, sm, xs. */
export const raios = { r: px(CLARO.r), sm: px(CLARO.rSm), xs: px(CLARO.rXs) };

/** Espaçamento 4/8/16/24/48/96. */
export const espaco = {
  e1: px(CLARO.e1), e2: px(CLARO.e2), e3: px(CLARO.e3),
  e4: px(CLARO.e4), e5: px(CLARO.e5), e6: px(CLARO.e6),
};

/** Curvas de animação como pontos de Bézier (para Reanimated Easing.bezier). */
export const curvas = {
  curva: [0.25, 0.1, 0.25, 1] as const,
  mola: [0.32, 0.72, 0, 1] as const,
};

export type Cores = typeof CLARO;
