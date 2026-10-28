/* Baralho de notícias (celular): uma manchete por carta. Arrastar para
 * qualquer lado passa para a próxima, tocar abre a notícia inteira. Todo
 * gesto tem um botão equivalente embaixo (Voltar, Salvar, Próxima), e o
 * Voltar desfaz o arrasto acidental. No web, ← e → também andam e Enter abre. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Share, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, { interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "../../tema";
import { T } from "../../ui/kit";
import { Icone, type NomeIcone } from "../../ui/icone";
import { telaCheia, ui } from "../../ui/folha";
import { vibra } from "../../plataforma/vibra";
import { imagemSegura, useRelogio } from "./ao-vivo";
import { alternaSalva, estaSalva, useSalvas } from "../../estado/noticias-salvas";
import type { Noticia } from "../../estado/cripto";
import FC from "../../nucleo";

export type Carta = { tipo: "noticia"; n: Noticia } | { tipo: "aovivo"; url: string };

// solta além de 28% da largura (ou num gesto rápido) e a carta sai
const LIMIAR = 0.28, VELOCIDADE = 800;
const MOLA = { damping: 18, stiffness: 180 };

const abre = (url: string) => { Linking.openURL(url).catch(() => {}); };

async function compartilha(n: Noticia) {
  try {
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav && nav.share) { await nav.share({ title: n.titulo, url: n.link }); return; }
      if (nav && nav.clipboard) { await nav.clipboard.writeText(n.link); ui.aviso("Link copiado"); }
      return;
    }
    await Share.share({ message: `${n.titulo}\n${n.link}`, url: n.link, title: n.titulo });
  } catch { /* cancelado */ }
}

function salva(n: Noticia) {
  const ficou = alternaSalva(n);
  vibra.toque();
  ui.aviso(ficou ? "Salva para ler depois" : "Tirada das salvas");
}

// ---------------------------------------------------------------- conteúdo da carta
// cada portal ganha sempre a mesma cor da série do tema
type Cores = ReturnType<typeof useTema>["cores"];
export function corDaFonte(nome: string, c: Cores): string {
  let h = 0;
  for (let k = 0; k < nome.length; k++) h = (h * 31 + nome.charCodeAt(k)) >>> 0;
  return [c.s1, c.s2, c.s3, c.s4, c.s5][h % 5];
}

// imagem da matéria, se houver e carregar; sem ela, a carta vira capa tipográfica
function useImagem(n: Noticia) {
  const url = imagemSegura(n.imagem);
  const [falhou, setFalhou] = useState(false);
  return { url: url && !falhou ? url : null, falhou: () => setFalhou(true) };
}

function Capa({ url, altura, aoFalhar }: { url: string; altura: number; aoFalhar: () => void }) {
  const t = useTema();
  return <Image source={{ uri: url }} style={{ width: "100%", height: altura, backgroundColor: t.cores.campo }} contentFit="cover" transition={150}
    onError={aoFalhar} accessibilityIgnoresInvertColors />;
}

function PilulaFonte({ n, cor }: { n: Noticia; cor: string }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 980, backgroundColor: cor + "2e", flexShrink: 1 }}>
        <T style={{ fontSize: 12.5, fontWeight: "700", color: cor, letterSpacing: 0.2 }} numberOfLines={1}>{n.fonte}</T>
      </View>
      <T style={{ fontSize: 13, color: t.cores.ink3 }}>{n.quando ? FC.datas.ha(n.quando) : ""}</T>
    </View>
  );
}

// sem imagem: a manchete é a capa, sobre um fundo na cor do portal
function CapaTexto({ n, altura, salva: salvaNa }: { n: Noticia; altura: number; salva: boolean }) {
  const t = useTema();
  const cor = corDaFonte(n.fonte || "", t.cores);
  return (
    <View style={{ flex: 1, backgroundColor: cor + "1f" }}>
      <View style={{ height: 4, backgroundColor: cor }} />
      <T style={{ position: "absolute", top: -18, right: 14, fontSize: 180, lineHeight: 200, fontWeight: "800", color: cor, opacity: 0.12 }}
        accessibilityElementsHidden importantForAccessibility="no">{"\u201C"}</T>
      <View style={{ flex: 1, padding: 22, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <PilulaFonte n={n} cor={cor} />
          {salvaNa ? <View style={{ marginLeft: "auto" }}><Icone nome="check" tam={16} cor={t.cores.verde} /></View> : null}
        </View>
        <View style={{ flex: 1, justifyContent: "center", gap: 14 }}>
          <T style={{ fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 }} numberOfLines={6}>{n.titulo}</T>
          {n.resumo ? <T style={{ fontSize: 15.5, lineHeight: 23, color: t.cores.ink2 }} numberOfLines={altura > 600 ? 8 : altura > 480 ? 6 : 4}>{n.resumo}</T> : null}
        </View>
        <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>Toque para ler · arraste para passar</T>
      </View>
    </View>
  );
}

function Rosto({ c, altura, salva: salvaNa }: { c: Carta; altura: number; salva: boolean }) {
  const t = useTema();
  if (c.tipo === "aovivo") {
    return (
      <View style={{ flex: 1, backgroundColor: t.cores.vermelhoSuave, padding: 24, justifyContent: "flex-end", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.cores.vermelho }} />
          <T style={{ fontSize: 13, fontWeight: "700", color: t.cores.vermelho, letterSpacing: 0.6 }}>AO VIVO</T>
        </View>
        <T style={{ fontSize: 28, lineHeight: 33, fontWeight: "700", letterSpacing: -0.5 }}>Ibovespa hoje, minuto a minuto</T>
        <T v="p">Toque para abrir a cobertura ao vivo do InfoMoney. Arraste para seguir para as manchetes.</T>
      </View>
    );
  }
  return <RostoNoticia n={c.n} altura={altura} salva={salvaNa} />;
}

function RostoNoticia({ n, altura, salva: salvaNa }: { n: Noticia; altura: number; salva: boolean }) {
  const t = useTema();
  const img = useImagem(n);
  if (!img.url) return <CapaTexto n={n} altura={altura} salva={salvaNa} />;
  return (
    <View style={{ flex: 1 }}>
      <Capa url={img.url} altura={Math.round(altura * 0.42)} aoFalhar={img.falhou} />
      <View style={{ flex: 1, padding: 20, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T style={{ fontSize: 13, fontWeight: "600", color: t.cores.acento, flexShrink: 1 }} numberOfLines={1}>{n.fonte}</T>
          <T style={{ fontSize: 13, color: t.cores.ink3 }}>{n.quando ? FC.datas.ha(n.quando) : ""}</T>
          {salvaNa ? <View style={{ marginLeft: "auto" }}><Icone nome="check" tam={16} cor={t.cores.verde} /></View> : null}
        </View>
        <T style={{ fontSize: 22, lineHeight: 27, fontWeight: "700", letterSpacing: -0.4 }} numberOfLines={4}>{n.titulo}</T>
        {n.resumo ? <T v="p" numberOfLines={altura > 560 ? 5 : 3}>{n.resumo}</T> : null}
        <T style={{ marginTop: "auto", fontSize: 12.5, color: t.cores.ink3 }}>Toque para ler · arraste para passar</T>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- notícia aberta
function abreCarta(c: Carta) {
  if (c.tipo === "aovivo") return abre(c.url);
  const n = c.n;
  telaCheia((api) => <Aberta n={n} fechar={api.fechar} />);
}

function Aberta({ n, fechar }: { n: Noticia; fechar: () => void }) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const salvas = useSalvas((s) => s.itens);
  const ja = estaSalva(salvas, n.link);
  const img = useImagem(n);
  const cor = corDaFonte(n.fonte || "", t.cores);
  // arrastar para baixo fecha, como um cartão do sistema
  const y = useSharedValue(0);
  const pan = Gesture.Pan().activeOffsetY(12).failOffsetX([-20, 20])
    .onUpdate((e) => { y.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) runOnJS(fechar)();
      else y.value = withSpring(0, MOLA);
    });
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Reanimated.View style={[{ flex: 1, backgroundColor: t.cores.bg }, estilo]}>
      <GestureDetector gesture={pan}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: "row", justifyContent: "flex-end" }}>
          <Pressable onPress={fechar} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.campo }}>
            <Icone nome="fechar" tam={18} />
          </Pressable>
        </View>
      </GestureDetector>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {img.url ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <View style={{ borderRadius: t.raios.r, overflow: "hidden" }}><Capa url={img.url} altura={220} aoFalhar={img.falhou} /></View>
          </View>
        ) : (
          <View style={{ marginHorizontal: 20, marginTop: 8, height: 4, width: 48, borderRadius: 2, backgroundColor: cor }} />
        )}
        <View style={{ padding: 20, gap: 12 }}>
          <PilulaFonte n={n} cor={cor} />
          <T style={{ fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5 }}>{n.titulo}</T>
          {n.resumo ? <T style={{ fontSize: 17, lineHeight: 26, color: t.cores.ink2 }}>{n.resumo}</T> : null}
          <T v="dica" style={{ marginTop: 8 }}>O texto completo é do {n.fonte}; o botão abaixo abre a matéria no site do portal.</T>
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, padding: 16, paddingBottom: insets.bottom + 16,
        backgroundColor: t.cores.bg, borderTopWidth: 1, borderTopColor: t.cores.linha }}>
        <Pressable onPress={() => abre(n.link)} accessibilityRole="link"
          style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 980, backgroundColor: t.cores.acento, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}>
          <T style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>Ler no portal</T>
        </Pressable>
        <BotaoRedondo icone="compartilhar" rotulo="Compartilhar" onPress={() => compartilha(n)} />
        <BotaoRedondo icone="check" rotulo={ja ? "Tirar das salvas" : "Salvar"} ativo={ja} onPress={() => salva(n)} />
      </View>
    </Reanimated.View>
  );
}

function BotaoRedondo({ icone, rotulo, onPress, ativo, desabilitado, grande }: { icone: NomeIcone; rotulo: string; onPress: () => void; ativo?: boolean; desabilitado?: boolean; grande?: boolean }) {
  const t = useTema();
  const tam = grande ? 56 : 48;
  return (
    <Pressable onPress={onPress} disabled={desabilitado} accessibilityRole="button" accessibilityLabel={rotulo} accessibilityState={{ disabled: !!desabilitado, selected: !!ativo }}
      style={({ pressed }) => ({ width: tam, height: tam, borderRadius: tam / 2, alignItems: "center", justifyContent: "center",
        backgroundColor: ativo ? t.cores.verde : t.cores.bg2, borderWidth: 1, borderColor: t.cores.linha, opacity: desabilitado ? 0.35 : pressed ? 0.7 : 1,
        boxShadow: t.cores.sombra } as any)}>
      <Icone nome={icone} tam={grande ? 22 : 19} cor={ativo ? "#fff" : t.cores.ink} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- cartas
// a de trás cresce enquanto você arrasta a da frente
function CartaAtras({ c, nivel, progresso, largura, altura, salva: s }: { c: Carta; nivel: 1 | 2; progresso: SharedValue<number>; largura: number; altura: number; salva: boolean }) {
  const t = useTema();
  const estilo = useAnimatedStyle(() => {
    const p = progresso.value;
    const escala = interpolate(p, [0, 1], nivel === 1 ? [0.95, 1] : [0.9, 0.95]);
    const desce = interpolate(p, [0, 1], nivel === 1 ? [14, 0] : [28, 14]);
    return { transform: [{ translateY: desce }, { scale: escala }], opacity: nivel === 2 ? interpolate(p, [0, 1], [0.6, 1]) : 1 };
  });
  return (
    <Reanimated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[{ position: "absolute", width: largura, height: altura, borderRadius: 22, overflow: "hidden", backgroundColor: t.cores.bg2, borderWidth: 1, borderColor: t.cores.linha }, estilo]}>
      <Rosto c={c} altura={altura} salva={s} />
    </Reanimated.View>
  );
}

function CartaFrente({ c, largura, altura, progresso, entrada, aoSair, aoTocar, salva: s, rotulo, aoProxima, aoVoltar }: {
  c: Carta; largura: number; altura: number; progresso: SharedValue<number>; entrada: { x: number; y: number } | null;
  aoSair: (dx: number, dy: number) => void; aoTocar: () => void; salva: boolean; rotulo: string; aoProxima: () => void; aoVoltar: () => void;
}) {
  const t = useTema();
  const reduz = useReducedMotion();
  // voltando com "Voltar", a carta entra pelo lado de onde saiu
  const x = useSharedValue(entrada && !reduz ? entrada.x : 0), y = useSharedValue(entrada && !reduz ? entrada.y : 0);
  useEffect(() => {
    if (entrada && !reduz) { x.value = withSpring(0, MOLA); y.value = withSpring(0, MOLA); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const longe = Math.hypot(largura, altura) * 1.3;
  const pan = Gesture.Pan().minDistance(6)
    .onUpdate((e) => {
      x.value = e.translationX; y.value = e.translationY;
      progresso.value = Math.min(1, Math.hypot(e.translationX, e.translationY) / (largura * LIMIAR));
    })
    .onEnd((e) => {
      const dist = Math.hypot(e.translationX, e.translationY), vel = Math.hypot(e.velocityX, e.velocityY);
      if (dist > largura * LIMIAR || (vel > VELOCIDADE && dist > 24)) {
        // sai na direção do arrasto (ou do gesto, se foi rápido e curto)
        const usaVel = dist < largura * LIMIAR;
        const vx = usaVel ? e.velocityX : e.translationX, vy = usaVel ? e.velocityY : e.translationY;
        const m = Math.hypot(vx, vy) || 1;
        const dx = (vx / m) * longe, dy = (vy / m) * longe;
        progresso.value = withTiming(1, { duration: 180 });
        x.value = withTiming(dx, { duration: reduz ? 1 : 220 });
        y.value = withTiming(dy, { duration: reduz ? 1 : 220 }, (fim) => { if (fim) runOnJS(aoSair)(dx, dy); });
      } else {
        x.value = withSpring(0, MOLA); y.value = withSpring(0, MOLA);
        progresso.value = withSpring(0, MOLA);
      }
    });
  const tap = Gesture.Tap().maxDuration(400).onEnd((_e, ok) => { if (ok) runOnJS(aoTocar)(); });
  const gesto = Gesture.Exclusive(pan, tap);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${interpolate(x.value, [-largura, 0, largura], [-12, 0, 12])}deg` }],
  }));
  return (
    <GestureDetector gesture={gesto}>
      <Reanimated.View accessible accessibilityRole="button" accessibilityLabel={rotulo} accessibilityHint="Toque duas vezes para abrir. Deslize com três dedos ou use as ações para passar."
        accessibilityActions={[{ name: "activate" }, { name: "next", label: "Próxima" }, { name: "previous", label: "Voltar" }]}
        onAccessibilityAction={(ev) => { const a = ev.nativeEvent.actionName; if (a === "activate") aoTocar(); else if (a === "next") aoProxima(); else if (a === "previous") aoVoltar(); }}
        style={[{ position: "absolute", width: largura, height: altura, borderRadius: 22, overflow: "hidden", backgroundColor: t.cores.bg2,
          borderWidth: 1, borderColor: t.cores.linha, boxShadow: t.cores.sombra, cursor: "grab" } as any, Platform.OS === "web" ? ({ touchAction: "none", userSelect: "none" } as any) : null, estilo]}>
        <Rosto c={c} altura={altura} salva={s} />
      </Reanimated.View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------- baralho
export function BaralhoNoticias({ cartas, chave, aoFim }: { cartas: Carta[]; chave: string; aoFim?: React.ReactNode }) {
  const t = useTema();
  useRelogio();
  const salvas = useSalvas((s) => s.itens);
  const [i, setI] = useState(0);
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  // por onde cada carta saiu, para o Voltar trazê-la do mesmo lado
  const saidas = useRef<Array<{ x: number; y: number }>>([]);
  const [entrada, setEntrada] = useState<{ x: number; y: number } | null>(null);
  const progresso = useSharedValue(0);

  // trocou o assunto ou o filtro: recomeça do topo
  useEffect(() => { setI(0); saidas.current = []; setEntrada(null); progresso.value = 0; }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  const aoSair = useCallback((dx: number, dy: number) => {
    saidas.current.push({ x: dx, y: dy });
    progresso.value = 0;
    setEntrada(null);
    setI((v) => v + 1);
    vibra.leve();
  }, [progresso]);
  const proxima = useCallback(() => {
    if (i >= cartas.length) return;
    // pelo botão, a carta sai para a esquerda
    aoSair(-(dim ? dim.w : 400) * 1.4, 0);
  }, [i, cartas.length, aoSair, dim]);
  const voltar = useCallback(() => {
    if (!i) return;
    const de = saidas.current.pop() || { x: -400, y: 0 };
    progresso.value = 0;
    setEntrada(de);
    setI((v) => Math.max(0, v - 1));
    vibra.toque();
  }, [i, progresso]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && /input|textarea|select/i.test(alvo.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); proxima(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); voltar(); }
      else if (e.key === "Enter" && cartas[i]) { e.preventDefault(); abreCarta(cartas[i]); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [proxima, voltar, cartas, i]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!dim || Math.abs(dim.w - width) > 1 || Math.abs(dim.h - height) > 1) setDim({ w: width, h: height });
  };
  const atual = cartas[i];
  const salvaDe = (c?: Carta) => !!c && c.tipo === "noticia" && estaSalva(salvas, c.n.link);
  const rotuloDe = (c: Carta) => (c.tipo === "aovivo" ? "Ibovespa hoje, ao vivo. Abre o InfoMoney." : `${c.n.titulo}. ${c.n.fonte}, ${c.n.quando ? FC.datas.ha(c.n.quando) : ""}`);
  const w = dim ? dim.w : 0, h = dim ? Math.max(0, dim.h - 28) : 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-start" }} onLayout={onLayout}>
        {dim && atual ? (
          <>
            {cartas[i + 2] ? <CartaAtras key={"c" + (i + 2)} c={cartas[i + 2]} nivel={2} progresso={progresso} largura={w} altura={h} salva={salvaDe(cartas[i + 2])} /> : null}
            {cartas[i + 1] ? <CartaAtras key={"c" + (i + 1)} c={cartas[i + 1]} nivel={1} progresso={progresso} largura={w} altura={h} salva={salvaDe(cartas[i + 1])} /> : null}
            <CartaFrente key={"f" + i + ":" + chave} c={atual} largura={w} altura={h} progresso={progresso} entrada={entrada}
              aoSair={aoSair} aoTocar={() => abreCarta(atual)} salva={salvaDe(atual)} rotulo={rotuloDe(atual)} aoProxima={proxima} aoVoltar={voltar} />
          </>
        ) : dim ? (
          <View style={{ width: w, height: h, borderRadius: 22, borderWidth: 1, borderColor: t.cores.linha, borderStyle: "dashed", alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
            <Icone nome="check" tam={32} cor={t.cores.verde} />
            <T style={{ fontSize: 20, fontWeight: "700", textAlign: "center" }}>Você viu tudo</T>
            <T v="p" style={{ textAlign: "center" }}>{cartas.length ? `As ${cartas.length} manchetes de agora. As novas chegam sozinhas a cada 2 minutos.` : "Nada por aqui ainda."}</T>
            {cartas.length ? (
              <Pressable onPress={() => { setI(0); saidas.current = []; setEntrada(null); }} accessibilityRole="button"
                style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 980, backgroundColor: t.cores.acento, opacity: pressed ? 0.8 : 1 })}>
                <T style={{ color: "#fff", fontWeight: "600" }}>Recomeçar</T>
              </Pressable>
            ) : null}
            {aoFim}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, paddingTop: 12 }}>
        <BotaoRedondo icone="voltar" rotulo="Voltar para a anterior" onPress={voltar} desabilitado={!i} />
        <BotaoRedondo icone="check" rotulo={salvaDe(atual) ? "Tirar das salvas" : "Salvar"} ativo={salvaDe(atual)} desabilitado={!atual || atual.tipo !== "noticia"}
          onPress={() => atual && atual.tipo === "noticia" && salva(atual.n)} grande />
        <BotaoRedondo icone="chevron" rotulo="Próxima" onPress={proxima} desabilitado={!atual} />
      </View>
      <T style={{ textAlign: "center", fontSize: 12.5, color: t.cores.ink3, marginTop: 8 }}>{cartas.length ? `${Math.min(i + 1, cartas.length)} de ${cartas.length}` : " "}</T>
    </View>
  );
}
