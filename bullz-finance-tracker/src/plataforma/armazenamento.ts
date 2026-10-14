/* `localStorage` síncrono para o núcleo.
 *
 * Web: o próprio `window.localStorage`.
 * Nativo: um objeto com a mesma API sobre o MMKV. É um Proxy para que
 * `Object.keys(localStorage)` (usado por `FC.mercado.limpaCacheLocal`) devolva
 * as chaves guardadas, como no navegador.
 *
 * Também fornece o `storage` da sessão do Supabase (mesma instância). */
import { Platform } from "react-native";

export interface ArmazenamentoSincrono {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  clear(): void;
  key(i: number): string | null;
  readonly length: number;
}

function criaNativo(): ArmazenamentoSincrono {
  // import tardio: no web o módulo nativo não existe
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMMKV } = require("react-native-mmkv");
  const kv = createMMKV({ id: "bullz" });
  const api: ArmazenamentoSincrono = {
    getItem: (k) => kv.getString(k) ?? null,
    setItem: (k, v) => kv.set(k, String(v)),
    removeItem: (k) => { kv.remove(k); },
    clear: () => kv.clearAll(),
    key: (i) => kv.getAllKeys()[i] ?? null,
    get length() { return kv.getAllKeys().length; },
  };
  const metodos = new Set(Object.keys(api).concat("length"));
  return new Proxy(api, {
    ownKeys: () => kv.getAllKeys(),
    getOwnPropertyDescriptor: (_alvo, p) =>
      typeof p === "string" && kv.contains(p)
        ? { enumerable: true, configurable: true, value: kv.getString(p) }
        : undefined,
    get: (alvo, p, r) => (typeof p === "string" && !metodos.has(p) && kv.contains(p) ? kv.getString(p) : Reflect.get(alvo, p, r)),
  });
}

function criaMemoria(): ArmazenamentoSincrono {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  };
}

function criaWeb(): ArmazenamentoSincrono {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* modo privado sem storage */
  }
  return criaMemoria();
}

export const armazenamento: ArmazenamentoSincrono =
  Platform.OS === "web" ? criaWeb() : criaNativo();

/** Adaptador assíncrono no formato que o supabase-js espera. */
export const armazenamentoSessao = {
  getItem: async (k: string) => armazenamento.getItem(k),
  setItem: async (k: string, v: string) => armazenamento.setItem(k, v),
  removeItem: async (k: string) => armazenamento.removeItem(k),
};
