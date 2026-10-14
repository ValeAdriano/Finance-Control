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

/* Nativo: MMKV cifrado (PLANO-SEGURANCA S1.1). A chave é aleatória, gerada
 * no primeiro uso e guardada no Keychain/Keystore pelo SecureStore — só este
 * aparelho, só com ele desbloqueado. Copiar os arquivos do app não revela a
 * sessão nem o cache.
 *
 * A sessão não vai direto para o SecureStore porque algumas versões do
 * Android limitam o tamanho de cada valor, e a do Supabase pode passar dele.
 *
 * Chave em texto: o MMKV aceita até 32 bytes com AES-256; 32 caracteres
 * base64url de bytes aleatórios dão 192 bits de entropia. */
const CHAVE_SECURE = "bullz-mmkv-chave";
const MARCA = "__bullz_cifrado";

function chaveDoAparelho(): string {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const SecureStore = require("expo-secure-store");
  const Crypto = require("expo-crypto");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const opcoes = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  let chave: string | null = SecureStore.getItem(CHAVE_SECURE, opcoes);
  if (!chave) {
    const bytes: Uint8Array = Crypto.getRandomBytes(24);
    const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    chave = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      chave += b64[(n >> 18) & 63] + b64[(n >> 12) & 63] + b64[(n >> 6) & 63] + b64[n & 63];
    }
    SecureStore.setItem(CHAVE_SECURE, chave, opcoes);
  }
  return chave;
}

function abreMmkv() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMMKV } = require("react-native-mmkv");
  const kv = createMMKV({ id: "bullz-cifrado", encryptionKey: chaveDoAparelho(), encryptionType: "AES-256" });
  // Sem a marca: arquivo novo, ou cifrado com outra chave (backup restaurado
  // em outro aparelho, chave apagada). O conteúdo não se lê: recomeça vazio.
  if (kv.getString(MARCA) !== "1") {
    kv.clearAll();
    kv.set(MARCA, "1");
  }
  // migração: o armazenamento antigo, sem criptografia, é copiado e apagado
  const antigo = createMMKV({ id: "bullz" });
  const chaves: string[] = antigo.getAllKeys();
  if (chaves.length) {
    for (const k of chaves) {
      const v = antigo.getString(k);
      if (v != null && !kv.contains(k)) kv.set(k, v);
    }
    antigo.clearAll();
    try { antigo.trim(); } catch { /* versões sem trim */ }
  }
  return kv;
}

function criaNativo(): ArmazenamentoSincrono {
  const kv = abreMmkv();
  const visivel = () => kv.getAllKeys().filter((k: string) => k !== MARCA);
  const api: ArmazenamentoSincrono = {
    getItem: (k) => kv.getString(k) ?? null,
    setItem: (k, v) => kv.set(k, String(v)),
    removeItem: (k) => { kv.remove(k); },
    clear: () => { kv.clearAll(); kv.set(MARCA, "1"); },
    key: (i) => visivel()[i] ?? null,
    get length() { return visivel().length; },
  };
  const metodos = new Set(Object.keys(api).concat("length"));
  return new Proxy(api, {
    ownKeys: () => visivel(),
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
