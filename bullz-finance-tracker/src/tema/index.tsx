/* Tema resolvido para o app: escolhe claro/escuro pelo esquema do sistema ou
 * pela preferência salva (a mesma chave `fc:tema` do site: auto/claro/escuro),
 * aplica alto contraste quando pedido, e entrega cores + derivados numéricos.
 *
 * `useTema()` funciona com ou sem Provider: sem ele, segue o sistema. */
import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { AccessibilityInfo, Platform, useColorScheme } from "react-native";
import {
  CLARO, ESCURO, CONTRASTE_CLARO, CONTRASTE_ESCURO,
  raios, espaco, curvas, type Cores,
} from "./tokens";

export type Esquema = "claro" | "escuro";
export type PrefTema = "auto" | "claro" | "escuro";

export interface Tema {
  esquema: Esquema;
  cores: Cores;
  raios: typeof raios;
  espaco: typeof espaco;
  curvas: typeof curvas;
  /** fundo do botão deslizante do segmentado (o CSS usa #636366 no escuro) */
  deslizante: string;
}

/** Monta o tema para um esquema, com alto contraste opcional. */
export function montaTema(esquema: Esquema, altoContraste = false): Tema {
  const base = esquema === "escuro" ? ESCURO : CLARO;
  const extra = altoContraste ? (esquema === "escuro" ? CONTRASTE_ESCURO : CONTRASTE_CLARO) : null;
  const cores = extra ? { ...base, ...extra } : base;
  return { esquema, cores, raios, espaco, curvas, deslizante: esquema === "escuro" ? "#636366" : cores.bg2 };
}

/** Resolve o esquema a partir da preferência e do sistema (igual ao site). */
export function resolveEsquema(pref: PrefTema, sistema: Esquema): Esquema {
  return pref === "auto" ? sistema : pref;
}

interface CtxTema { tema: Tema; pref: PrefTema; definePref: (p: PrefTema) => void }
const Ctx = createContext<CtxTema | null>(null);

function lePref(): PrefTema {
  try {
    const FC = (globalThis as any).FC;
    const v = FC && FC.local ? FC.local.ler("tema", "auto") : "auto";
    return v === "claro" || v === "escuro" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const sistema: Esquema = useColorScheme() === "dark" ? "escuro" : "claro";
  const [pref, setPref] = useState<PrefTema>(lePref);
  const [contraste, setContraste] = useState(false);

  useEffect(() => {
    // web: prefers-contrast; iOS: "Aumentar contraste" (darker system colors)
    if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-contrast: more)");
      setContraste(mq.matches);
      const f = (e: MediaQueryListEvent) => setContraste(e.matches);
      mq.addEventListener?.("change", f);
      return () => mq.removeEventListener?.("change", f);
    }
    if (Platform.OS === "ios") {
      AccessibilityInfo.isDarkerSystemColorsEnabled?.().then(setContraste).catch(() => {});
      const s = AccessibilityInfo.addEventListener?.("darkerSystemColorsChanged" as any, setContraste as any);
      return () => s?.remove?.();
    }
    return undefined;
  }, []);

  const definePref = useCallback((p: PrefTema) => {
    const FC = (globalThis as any).FC;
    try { FC.local.gravar("tema", p); } catch { /* sem armazenamento */ }
    setPref(p);
  }, []);

  const valor = useMemo(
    () => ({ tema: montaTema(resolveEsquema(pref, sistema), contraste), pref, definePref }),
    [pref, sistema, contraste, definePref],
  );
  // web: o esquema escolhido (inclusive o manual dos Ajustes) chega ao CSS — barra de
  // rolagem, controles nativos (date/select) e o fundo atrás do app seguem o tema
  const esquema = valor.tema.esquema;
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const r = document.documentElement;
    r.dataset.tema = esquema;
    r.style.colorScheme = esquema === "escuro" ? "dark" : "light";
    document.body.style.background = valor.tema.cores.bg;
  }, [esquema, valor.tema.cores.bg]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Hook de tema. Sem Provider, segue o esquema do sistema. */
export function useTema(): Tema {
  const c = useContext(Ctx);
  const sistema: Esquema = useColorScheme() === "dark" ? "escuro" : "claro";
  return c ? c.tema : montaTema(sistema);
}

/** Preferência do tema (auto/claro/escuro) e o setter que grava em fc:tema. */
export function usePrefTema(): [PrefTema, (p: PrefTema) => void] {
  const c = useContext(Ctx);
  return c ? [c.pref, c.definePref] : ["auto", () => {}];
}

/** as cores que o núcleo do site devolve vêm como CSS (`var(--s1)`, `var(--ink-3)`):
 * troca pela cor do tema atual. Hex, rgb() e nomes do CSS passam direto. */
export function corCss(cores: Cores, cor?: string | null): string | undefined {
  if (!cor) return undefined;
  const m = /^var\(--([a-z0-9-]+)\)$/.exec(cor.trim());
  if (!m) return cor;
  return (cores as any)[m[1].replace(/-([a-z0-9])/g, (_: string, x: string) => x.toUpperCase())];
}

export { CLARO, ESCURO, CONTRASTE_CLARO, CONTRASTE_ESCURO, raios, espaco, curvas };
export type { Cores };
