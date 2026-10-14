/* Vídeo de divulgação — port do FC.abrePromo de promo/promo.js. Os
 * controles (formato, esconder valores, frase final, endereço, tocar,
 * posição, exportar) são do app; o desenho, a trilha e a gravação rodam no
 * palco com o mesmo promo.js do site. Os dados saem de FC.promo.montaDados(). */
import React, { useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "../tema";
import { useMedidas } from "../ui/medidas";
import { Botao, BotaoIcone, T } from "../ui/kit";
import { Campo, Entrada, Interruptor, Segmentado } from "../ui/campos";
import { ui, telaCheia, type ApiFolha } from "../ui/folha";
import { Palco, type PalcoRef } from "../recap/Palco";
import type { CfgPalco } from "../recap/palco";
import FC from "../nucleo";

type Formato = "vertical" | "horizontal";

function Barra({ t: tempo, total, aoIr }: { t: number; total: number; aoIr: (t: number) => void }) {
  const t = useTema();
  const larg = useRef(1);
  const vai = (x: number) => aoIr(Math.max(0, Math.min(1, x / larg.current)) * total);
  const p = total ? Math.min(1, tempo / total) : 0;
  return (
    <View onLayout={(e) => { larg.current = e.nativeEvent.layout.width || 1; }} accessible accessibilityRole="adjustable" accessibilityLabel="Posição"
      accessibilityValue={{ min: 0, max: Math.round(total), now: Math.round(tempo) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => aoIr(Math.max(0, Math.min(total, tempo + (e.nativeEvent.actionName === "increment" ? 2 : -2))))}
      style={{ flex: 1, height: 32, justifyContent: "center" }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.cores.campo, overflow: "hidden" }}>
        <View style={{ width: `${p * 100}%`, height: "100%", backgroundColor: t.cores.acento }} />
      </View>
      <View style={{ position: "absolute", left: `${p * 100}%`, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", boxShadow: t.cores.sombra } as any} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => vai(e.nativeEvent.locationX)} onResponderMove={(e) => vai(e.nativeEvent.locationX)} />
    </View>
  );
}

function Promo({ api }: { api: ApiFolha }) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { estreito, celular } = useMedidas();
  const palco = useRef<PalcoRef>(null);
  const [formato, setFormato] = useState<Formato>(FC.local.ler("promo-formato", "vertical"));
  const [privado, setPrivado] = useState(!!FC.local.ler("promo-privado", false));
  const [chamada, setChamada] = useState<string>(FC.local.ler("promo-chamada", "Comece hoje."));
  const sitePadrao = typeof location !== "undefined" && location.hostname && !/^(localhost|127\.)/.test(location.hostname) ? location.hostname : "";
  const [site, setSite] = useState<string>(FC.local.ler("promo-site", sitePadrao));
  const [mudo, setMudo] = useState(false);
  const [pos, setPos] = useState({ t: 1.6, tocando: false });
  const [gravando, setGravando] = useState(false);
  const TOTAL = FC.promo.TOTAL;

  // a configuração vale a da abertura; depois tudo vai por comandos
  const cfg = useMemo<CfgPalco>(() => {
    const dados = FC.promo.montaDados();
    if (!FC.estado.bench) FC.mercado.benchmarks(5).then((b: any) => { FC.estado.bench = b; palco.current?.envia({ cmd: "dados", dados: FC.promo.montaDados() }); }).catch(() => {});
    return { modo: "promo", dados, formato, opts: { privado, chamada, site }, t: 1.6 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const opts = (o: Partial<{ privado: boolean; chamada: string; site: string }>) => palco.current?.envia({ cmd: "opts", opts: { privado, chamada, site, ...o } });
  const fecha = () => { if (gravando) return; palco.current?.envia({ cmd: "fecha" }); api.fechar(); };
  const vertical = formato === "vertical";
  const lado = !estreito && !celular;

  const vista = (
    <View style={{ width: lado ? (vertical ? undefined : "60%") : "100%", height: lado && vertical ? "100%" : undefined, aspectRatio: vertical ? 9 / 16 : 16 / 9,
      maxHeight: lado ? 760 : estreito ? 520 : undefined, alignSelf: lado ? "flex-start" : "center", borderRadius: 18, overflow: "hidden", backgroundColor: "#050f2b" }}>
      <Palco ref={palco} cfg={cfg} fundo="#050f2b" aoMensagem={(m) => {
        if (m.ev === "t") setPos({ t: m.t, tocando: m.tocando });
        else if (m.ev === "gravando") setGravando(!!m.ligado);
      }} />
    </View>
  );
  const controles = (
    <View style={{ gap: 16, flex: lado ? 1 : undefined, minWidth: lado ? 260 : undefined, opacity: gravando ? 0.5 : 1 }} pointerEvents={gravando ? "none" : "auto"}>
      <Campo rotulo="Formato">
        <Segmentado cheio valor={formato} rotuloA11y="Formato" opcoes={[{ v: "vertical", rotulo: "Vertical 9:16" }, { v: "horizontal", rotulo: "Horizontal 16:9" }]}
          aoMudar={(v) => { setFormato(v); FC.local.gravar("promo-formato", v); palco.current?.envia({ cmd: "formato", formato: v }); }} />
      </Campo>
      <Interruptor valor={privado} rotulo="Esconder valores em reais" aoMudar={(v) => { setPrivado(v); FC.local.gravar("promo-privado", v); opts({ privado: v }); }} />
      <Campo rotulo="Frase final">
        <Entrada value={chamada} maxLength={40} onChangeText={(v) => { setChamada(v); FC.local.gravar("promo-chamada", v); opts({ chamada: v }); }} />
      </Campo>
      <Campo rotulo="Endereço no botão final">
        <Entrada value={site} maxLength={40} placeholder="seusite.com.br" autoCapitalize="none" keyboardType="url"
          onChangeText={(v) => { const s = v.trim(); setSite(s); FC.local.gravar("promo-site", s); opts({ site: s }); }} />
      </Campo>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Botao variante="sec" icone={pos.tocando ? "pausa" : "play"} onPress={() => palco.current?.envia({ cmd: pos.tocando ? "pausa" : "toca" })}>{pos.tocando ? "Pausar" : "Assistir"}</Botao>
        <BotaoIcone nome={mudo ? "somDesligado" : "som"} rotulo={mudo ? "Ligar o som" : "Tirar o som"} onPress={() => { setMudo(!mudo); palco.current?.envia({ cmd: "mudo", mudo: !mudo }); }} />
        <Barra t={pos.t} total={TOTAL} aoIr={(x) => { setPos((p) => ({ ...p, t: x })); palco.current?.envia({ cmd: "vai", t: x }); }} />
      </View>
      <Botao icone="exportar" carregando={gravando} onPress={() => palco.current?.envia({ cmd: "exporta" })}>{gravando ? "Gravando…" : "Exportar vídeo"}</Botao>
      <T v="p">{Math.round(TOTAL)} s com trilha. A gravação leva o tempo do vídeo — mantenha esta tela aberta. Para divulgar, prefira a conta de demonstração ou esconda os valores.</T>
    </View>
  );
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: lado ? 20 : 0, paddingTop: lado ? 20 : insets.top, paddingBottom: lado ? 20 : 0 }}>
      <View style={{ width: "100%", maxWidth: 1180, maxHeight: "100%", flex: lado ? undefined : 1, backgroundColor: t.cores.bg2, borderRadius: lado ? 26 : 0, boxShadow: t.cores.sombraAlta } as any}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 18, paddingHorizontal: 22, paddingBottom: 14, flexWrap: "wrap" }}>
          <T style={{ fontSize: 19, fontWeight: "700" }}>Vídeo de divulgação</T>
          <T style={{ color: t.cores.ink2, fontSize: 13.5, flex: 1 }} numberOfLines={1}>feito no aparelho com os números desta conta</T>
          <BotaoIcone nome="fechar" rotulo="Fechar" onPress={fecha} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 22 + (lado ? 0 : insets.bottom), gap: 24, flexDirection: lado ? "row" : "column", alignItems: "flex-start" }}>
          {vista}
          {controles}
        </ScrollView>
      </View>
    </View>
  );
}

export function abrePromo() {
  try { FC.promo.montaDados(); } catch (e) { return ui.erro(e); }
  telaCheia((api) => <Promo api={api} />, { fundo: "rgba(0,0,0,0.55)" });
}
FC.abrePromo = abrePromo;
