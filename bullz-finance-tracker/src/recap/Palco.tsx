/* Hospeda o HTML do palco: iframe no navegador, WebView no celular. O vídeo
 * exportado chega em pedaços base64 e vira um arquivo no cache, entregue à
 * folha de compartilhar do sistema (salvar no rolo, mandar no WhatsApp…). */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, View } from "react-native";
import { ui } from "../ui/folha";
import FC from "../nucleo";
import { htmlPalco, type CfgPalco } from "./palco";

export interface PalcoRef { envia: (cmd: Record<string, any>) => void }
interface Props { cfg: CfgPalco; aoMensagem?: (m: any) => void; fundo?: string }

// recebe o vídeo do palco (só no app nativo; no navegador o iframe baixa direto)
function receptorDeVideo() {
  let arq: any = null, nome = "", mime = "";
  return async (m: any) => {
    try {
      const { File, Paths } = require("expo-file-system"); // eslint-disable-line @typescript-eslint/no-require-imports
      if (m.ev === "video-ini") {
        nome = m.nome; mime = m.mime;
        arq = new File(Paths.cache, nome);
        if (arq.exists) arq.delete();
        arq.create();
      } else if (m.ev === "video-parte" && arq) {
        arq.write(m.b64, { encoding: "base64", append: true });
      } else if (m.ev === "video-fim" && arq) {
        const Sharing = require("expo-sharing"); // eslint-disable-line @typescript-eslint/no-require-imports
        ui.aviso(`Vídeo pronto (${(m.tamanho / 1048576).toFixed(1)} MB)`);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(arq.uri, { mimeType: mime, dialogTitle: nome, UTI: mime.includes("mp4") ? "public.mpeg-4" : undefined });
        arq = null;
      } else if (m.ev === "video-erro") {
        arq = null; ui.aviso("Não deu para preparar o vídeo.", "erro");
      }
    } catch (e) { arq = null; ui.erro(e); }
  };
}

function trataComum(m: any) {
  if (m.ev === "aviso") ui.aviso(m.texto, m.tipo);
  else if (m.ev === "pref") FC.local.gravar(m.chave, m.valor);
}

export const Palco = forwardRef<PalcoRef, Props>(function Palco({ cfg, aoMensagem, fundo = "transparent" }, ref) {
  const recebe = useRef(aoMensagem); recebe.current = aoMensagem;
  // a configuração vale a da abertura: depois, tudo vai por comandos
  const inicial = useRef(cfg).current;
  const html = useMemo(() => (Platform.OS === "web" ? "" : htmlPalco(inicial)), [inicial]);
  const video = useMemo(receptorDeVideo, []);
  const nativo = useRef<any>(null), quadro = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    envia: (cmd) => {
      if (Platform.OS === "web") quadro.current?.contentWindow?.postMessage(cmd, location.origin);
      else nativo.current?.injectJavaScript(`window.__cmd && window.__cmd(${JSON.stringify(cmd)}); true;`);
    },
  }), []);

  const trata = (m: any) => {
    if (!m || !m.ev) return;
    // web: o palco.html carregou e espera a configuração
    if (m.ev === "carregado") { if (Platform.OS === "web") quadro.current?.contentWindow?.postMessage({ cmd: "inicia", cfg: inicial }, location.origin); return; }
    if (m.ev.startsWith("video-")) return void video(m);
    trataComum(m);
    recebe.current?.(m);
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const ouve = (e: MessageEvent) => {
      if (!quadro.current || e.source !== quadro.current.contentWindow || !e.data || typeof e.data.palco !== "string") return;
      try { trata(JSON.parse(e.data.palco)); } catch { /* mensagem de outro lugar */ }
    };
    window.addEventListener("message", ouve);
    return () => window.removeEventListener("message", ouve);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, backgroundColor: fundo }}>
        {React.createElement("iframe", {
          ref: quadro, src: "/palco.html", title: "Player", allow: "autoplay",
          style: { border: 0, width: "100%", height: "100%", display: "block", background: "transparent" },
        })}
      </View>
    );
  }
  const { WebView } = require("react-native-webview"); // eslint-disable-line @typescript-eslint/no-require-imports
  return (
    <WebView
      ref={nativo}
      originWhitelist={["*"]}
      source={{ html, baseUrl: "https://bullz.local/" }}
      style={{ flex: 1, backgroundColor: fundo }}
      containerStyle={{ backgroundColor: fundo }}
      javaScriptEnabled
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(r: any) => r.url === "about:blank" || r.url.startsWith("https://bullz.local") || r.url.startsWith("data:") || r.url.startsWith("blob:")}
      onMessage={(e: any) => { try { trata(JSON.parse(e.nativeEvent.data)); } catch { /* ignora */ } }}
    />
  );
});
