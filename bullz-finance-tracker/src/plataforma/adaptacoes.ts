/* Trocas de plataforma para o que, no site, depende do navegador.
 *
 *  - FC.auth.senhaVazada: o site usa crypto.subtle (SHA-1) — no nativo não
 *    existe; aqui o hash vem do expo-crypto. Mesmo k-anonimato: só os 5
 *    primeiros caracteres do hash saem do aparelho.
 *  - FC.baixar(nome, conteudo, tipo): no web baixa como o site; no nativo grava
 *    o arquivo e abre a folha de compartilhar do sistema.
 *  - FC.dispositivo: mobile/iOS/Android/instalado. */
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import FC from "../nucleo";

if (Platform.OS !== "web") {
  // o Hermes só decodifica UTF-8; os extratos de corretora vêm em Latin-1
  const Original: any = (globalThis as any).TextDecoder;
  if (Original) {
    (globalThis as any).TextDecoder = class TextDecoderBullz {
      private latin1: boolean;
      private fatal: boolean;
      private real: any;
      constructor(rotulo = "utf-8", opcoes?: any) {
        this.latin1 = /^(iso-8859-1|latin1|latin-1|windows-1252|cp1252)$/i.test(rotulo);
        this.fatal = !!(opcoes && opcoes.fatal);
        this.real = this.latin1 ? null : new Original(rotulo);
      }
      get encoding() { return this.latin1 ? "iso-8859-1" : this.real.encoding; }
      decode(buf?: any) {
        if (!this.latin1) {
          const s = this.real.decode(buf);
          // "fatal": byte inválido em UTF-8 tem de falhar (o importador cai para Latin-1)
          if (this.fatal && s.includes("�")) throw new TypeError("The encoded data was not valid for encoding utf-8");
          return s;
        }
        const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
        let s = "";
        for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 8192)));
        return s;
      }
    };
  }

  FC.auth.senhaVazada = async function (senha: string) {
    try {
      const hex = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, senha)).toUpperCase();
      const r = await fetch("https://api.pwnedpasswords.com/range/" + hex.slice(0, 5), { headers: { "Add-Padding": "true" } });
      if (!r.ok) return null;
      const linha = (await r.text()).split("\n").find((l) => l.startsWith(hex.slice(5)));
      return linha ? Number(linha.split(":")[1]) || 0 : 0;
    } catch {
      return null;
    }
  };

  FC.baixar = async function (nome: string, conteudo: string, tipo = "application/json") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File, Paths } = require("expo-file-system");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require("expo-sharing");
    const arq = new File(Paths.cache, nome);
    if (arq.exists) arq.delete();
    arq.create();
    arq.write(conteudo);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(arq.uri, { mimeType: tipo, dialogTitle: nome });
  };
}

const web = Platform.OS === "web";
const ua = web && typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
// o iPad no Safari se apresenta como Mac: denuncia-o a tela de toque (mesma regra do app.js)
const ehIOS = Platform.OS === "ios" || /iPad|iPhone|iPod/.test(ua)
  || (web && typeof navigator !== "undefined" && navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
const ehAndroid = Platform.OS === "android" || /Android/i.test(ua);
const instaladoWeb = web && typeof window !== "undefined" && (
  (window.navigator as any).standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));

// links do site antigo (favoritos, PWA instalada, e-mails): /#/ativos/carteira → /ativos/carteira.
// A rota "/" (app/index.tsx) e a de "não encontrado" redirecionam para cá.
/** a rota do site antigo pedida na URL (`#/ativos`), ou null */
export function rotaLegada(): string | null {
  if (!web || typeof window === "undefined" || !/^#\/[a-z]/.test(window.location.hash)) return null;
  return "/" + window.location.hash.replace(/^#\/+/, "");
}

let eventoInstall: any = null;
if (web && typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => { e.preventDefault(); eventoInstall = e; });
  window.addEventListener("appinstalled", () => {
    eventoInstall = null; FC.dispositivo.ehInstalado = true;
    if (FC.ui && FC.ui.aviso) FC.ui.aviso("Bullz instalado com sucesso!");
  });
}

FC.dispositivo = {
  ehMobile: !web || ehIOS || ehAndroid || /Mobi|Tablet/i.test(ua),
  // "Adicionar à Tela de Início" só faz sentido no navegador de um celular/tablet que ainda
  // não instalou: no computador não existe, e no app nativo já é o próprio app
  podeAdicionarATela: () => web && (ehIOS || ehAndroid || /Mobi|Tablet/i.test(ua)) && !FC.dispositivo.ehInstalado,
  ehIOS,
  ehAndroid,
  // o app nativo já é "instalado": nada de banner de Tela de Início
  ehInstalado: !web || !!instaladoWeb,
  obterEventoInstall: () => eventoInstall,
};
