/* Estado das telas ao vivo: o mercado cripto (ranking estilo CoinMarketCap)
 * e as manchetes. Fica fora do `FC.estado` de propósito: nada aqui entra no
 * cálculo da carteira, então atualizar não dispara `FC.recalcula()` nem
 * repinta as outras telas.
 *
 * As telas pedem a atualização automática com `useAoVivo(fn, ms)`: roda na
 * hora, repete a cada `ms` enquanto a tela está montada e o app em primeiro
 * plano, e para quando a tela sai (o Slot desmonta a rota anterior). */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { create } from "zustand";
import FC from "../nucleo";

// ---------------------------------------------------------------- mercado cripto
interface EstadoCripto {
  mercado: { moedas: any[]; global: any; em?: string; velho?: boolean } | null;
  erro: string | null;
  carregando: boolean;
  atualizadoEm: number;
}
export const useCripto = create<EstadoCripto>(() => ({ mercado: null, erro: null, carregando: false, atualizadoEm: 0 }));

/** códigos de cripto da carteira e da lista de acompanhamento (BTC, ETH…) */
export function criptosDoUsuario(): string[] {
  const ativos: any[] = ((FC.estado || {}).base || {}).ativos || [];
  return [...new Set(ativos.filter((a) => a.classe === "cripto").map((a) => String(a.ticker).toUpperCase()))];
}
/** "BTC-USD" e "PEPE24478-USD" → o símbolo que o CoinGecko usa */
export const simboloBase = (ticker: string) => String(ticker).split("-")[0].replace(/\d+$/, "").toUpperCase();

let pedindoCripto: Promise<void> | null = null;
export function atualizaMercadoCripto(): Promise<void> {
  if (pedindoCripto) return pedindoCripto;
  useCripto.setState({ carregando: true });
  pedindoCripto = (async () => {
    try {
      const m = await FC.mercado.criptoMercado(criptosDoUsuario());
      useCripto.setState({ mercado: m, erro: null, atualizadoEm: Date.now() });
    } catch (e: any) {
      useCripto.setState({ erro: e.message || String(e) });
    } finally {
      useCripto.setState({ carregando: false });
      pedindoCripto = null;
    }
  })();
  return pedindoCripto;
}

// ---------------------------------------------------------------- notícias
export type Tema = "mercado" | "cripto";
export interface Noticia { titulo: string; link: string; quando: string | null; imagem: string | null; resumo: string; fonte: string }
interface Feed {
  /** o que está na tela */
  itens: Noticia[];
  /** chegaram depois: ficam esperando o toque em "N novas" para a lista não pular */
  pendentes: Noticia[];
  /** links que entraram na última leva mostrada (ganham o destaque de novo) */
  novos: string[];
  fontes: Record<string, boolean>;
  em: string | null;
  velho: boolean;
  erro: string | null;
  carregando: boolean;
}
const feedVazio = (): Feed => ({ itens: [], pendentes: [], novos: [], fontes: {}, em: null, velho: false, erro: null, carregando: false });
export const useNoticias = create<Record<Tema, Feed>>(() => ({ mercado: feedVazio(), cripto: feedVazio() }));

const muda = (tema: Tema, f: Partial<Feed>) => useNoticias.setState((s) => ({ [tema]: { ...s[tema], ...f } } as any));

/** as que chegaram e ainda não estão na tela nem esperando */
export function separaNovas(atuais: Noticia[], pendentes: Noticia[], chegaram: Noticia[]): Noticia[] {
  const conhecidos = new Set([...atuais, ...pendentes].map((n) => n.link));
  return chegaram.filter((n) => !conhecidos.has(n.link));
}

const pedindoNoticias: Partial<Record<Tema, Promise<void>>> = {};
export function atualizaNoticias(tema: Tema): Promise<void> {
  if (pedindoNoticias[tema]) return pedindoNoticias[tema]!;
  muda(tema, { carregando: true });
  pedindoNoticias[tema] = (async () => {
    try {
      const r = await FC.mercado.noticias(tema);
      const chegaram: Noticia[] = r.itens || [];
      const f = useNoticias.getState()[tema];
      if (!f.itens.length) muda(tema, { itens: chegaram, novos: [] });
      else {
        const novas = separaNovas(f.itens, f.pendentes, chegaram);
        if (novas.length) muda(tema, { pendentes: [...novas, ...f.pendentes] });
      }
      muda(tema, { fontes: r.fontes || {}, em: r.em || new Date().toISOString(), velho: !!r.velho, erro: null });
    } catch (e: any) {
      muda(tema, { erro: e.message || String(e) });
    } finally {
      muda(tema, { carregando: false });
      delete pedindoNoticias[tema];
    }
  })();
  return pedindoNoticias[tema]!;
}

/** "N novas": as pendentes sobem para o topo, marcadas como novas */
export function mostraPendentes(tema: Tema) {
  const f = useNoticias.getState()[tema];
  if (!f.pendentes.length) return;
  const links = new Set(f.pendentes.map((n) => n.link));
  const itens = [...f.pendentes, ...f.itens.filter((n) => !links.has(n.link))]
    .sort((a, b) => (b.quando || "").localeCompare(a.quando || "")).slice(0, 80);
  muda(tema, { itens, pendentes: [], novos: [...links] });
}

// ---------------------------------------------------------------- ao vivo
/** roda `fn` agora e a cada `ms`, só com a tela montada e o app à vista */
export function useAoVivo(fn: () => unknown, ms: number, chave: unknown = null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let visivel = AppState.currentState === "active" || AppState.currentState == null;
    let ultima = 0;
    const roda = () => { ultima = Date.now(); try { ref.current(); } catch (e) { console.error(e); } };
    roda();
    const relogio = setInterval(() => { if (visivel) roda(); }, ms);
    // voltou para o app depois do intervalo: atualiza na hora
    const sub = AppState.addEventListener("change", (st) => {
      visivel = st === "active";
      if (visivel && Date.now() - ultima >= ms) roda();
    });
    return () => { clearInterval(relogio); sub.remove(); };
  }, [ms, chave]);
}
