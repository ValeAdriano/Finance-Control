/* Editor de layout no próprio Início (/inicio/editar) — port de
 * telas/layout-editor.js. Os blocos de verdade ganham uma barra com alça
 * (arrastar), nome e olho (ocultar). O menu (topo e barra do celular) se edita
 * numa folha com a prévia do celular. Tudo salva em preferencias.layout a
 * cada soltar. */
import React, { useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTema } from "../tema";
import { useApp, ocupado, rerender, ROTAS } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Botao, T } from "../ui/kit";
import { Icone, type NomeIcone } from "../ui/icone";
import { ui } from "../ui/folha";
import { Isolado, useBlocosInicio } from "./inicio";
import FC from "../nucleo";

const padrao = () => FC.layout.resolve(null, { rotas: ROTAS, ligada: FC.rotaLigada });
const nomeRota = (id: string) => (ROTAS.find((r) => r.id === id) || ({} as any)).nome || id;
const iconeRota = (id: string) => ((ROTAS.find((r) => r.id === id) || ({} as any)).icone || "ativos") as NomeIcone;
let gravando: Promise<any> = Promise.resolve();

async function salva(novo: any) {
  const guardar = FC.layout.paraSalvar(novo, padrao());
  FC.estado.prefs.layout = guardar;
  FC.estado.base.prefsBrutas.layout = guardar;
  FC.local.gravar("ultimo-cache-base", FC.estado.base);
  rerender();
  gravando = gravando.then(() => FC.db.gravaPrefs({ layout: guardar }).catch((e: any) => ui.erro(e)));
  return gravando;
}

// ---------------------------------------------------------------- bloco
function Bloco({ id, conteudo, oculto, arrastando, outroArrastando, dy, alca, aoOlho, aoMover }: {
  id: string; conteudo: React.ReactNode; oculto: boolean; arrastando: boolean; outroArrastando: boolean; dy: Animated.Value;
  alca: any; aoOlho: () => void; aoMover: (d: -1 | 1) => void;
}) {
  const t = useTema();
  const b = FC.LAYOUT_INICIO.find((x: any) => x.id === id);
  return (
    <Animated.View
      style={{ borderWidth: 1.5, borderStyle: arrastando ? "solid" : "dashed", borderColor: arrastando ? t.cores.acento : t.cores.linha2, borderRadius: t.raios.r,
        paddingTop: 6, paddingHorizontal: 10, paddingBottom: 10, backgroundColor: arrastando ? t.cores.bg2 : t.cores.bg3,
        opacity: oculto ? 0.55 : outroArrastando ? 0.7 : 1, zIndex: arrastando ? 5 : 0, boxShadow: arrastando ? t.cores.sombraAlta : undefined,
        transform: arrastando ? [{ translateY: dy }] : [] } as any}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 }}>
        <View {...alca} accessible accessibilityRole="adjustable" accessibilityLabel={`Mover ${b.nome}`}
          accessibilityActions={[{ name: "increment", label: "Descer" }, { name: "decrement", label: "Subir" }]}
          onAccessibilityAction={(e: any) => aoMover(e.nativeEvent.actionName === "increment" ? 1 : -1)}
          style={{ width: 40, height: 40, borderRadius: t.raios.xs, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acentoSuave,
            ...(Platform.OS === "web" ? { cursor: arrastando ? "grabbing" : "grab", touchAction: "none", userSelect: "none" } : {}) } as any}>
          <Icone nome="ordenar" tam={18} cor={t.cores.acento} />
        </View>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
          <Icone nome={b.icone} tam={15} cor={t.cores.ink2} />
          <T style={{ fontSize: 13.5, fontWeight: "600", color: t.cores.ink2 }} numberOfLines={1}>{b.nome}</T>
        </View>
        {b.fixo ? <View style={{ width: 40, alignItems: "center" }} accessibilityLabel="Sempre visível"><Icone nome="cadeado" tam={15} cor={t.cores.ink3} /></View> : (
          <Pressable onPress={aoOlho} accessibilityRole="button" accessibilityState={{ selected: !oculto }} accessibilityLabel={`${oculto ? "Mostrar" : "Ocultar"} ${b.nome}`}
            style={({ hovered }: any) => ({ width: 40, height: 40, borderRadius: t.raios.xs, alignItems: "center", justifyContent: "center", backgroundColor: hovered ? t.cores.campo : "transparent" })}>
            <Icone nome={oculto ? "olhoFechado" : "olho"} tam={18} cor={oculto ? t.cores.ink3 : t.cores.acento} />
          </Pressable>
        )}
      </View>
      <View pointerEvents="none" style={{ maxHeight: 240, overflow: "hidden", borderRadius: t.raios.sm }}>
        {oculto ? <T style={{ padding: 16, fontSize: 13.5, color: t.cores.ink2, textAlign: "center" }}>Oculto no Início</T>
          : conteudo || <T style={{ padding: 16, fontSize: 13.5, color: t.cores.ink2, textAlign: "center" }}>{b.desc}. Sem conteúdo agora: aparece quando houver.</T>}
        {!oculto && conteudo ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 56, backgroundColor: t.cores.bg3, opacity: 0.85,
          ...(Platform.OS === "web" ? { backgroundColor: "transparent", opacity: 1, backgroundImage: `linear-gradient(transparent, ${t.cores.bg3})` } : {}) } as any} /> : null}
      </View>
    </Animated.View>
  );
}

/** renderiza o bloco; null quando ele não teria conteúdo agora */
function ConteudoBloco({ render }: { render: () => React.ReactNode }) {
  return <>{render()}</>;
}

/** embutido: a aba "Layout" dos Ajustes — sem rolagem própria (a página rola) e sem
 * "Concluir", porque cada mudança já é salva na hora */
export default function EditorLayout({ embutido = false }: { embutido?: boolean } = {}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { estreito, celular } = useMedidas();
  useApp((s) => s.versao);
  const { blocos, d } = useBlocosInicio();
  const l = FC.estado.prefs ? FC.layoutAtual() : null;
  const [arr, setArr] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  const medidas = useRef<Record<string, { y: number; h: number }>>({}).current;
  const ordemRef = useRef<string[]>([]);
  const alcas = useRef<Record<string, any>>({}).current;
  if (!l || !d) return null;
  const ordem: string[] = l.inicio.ordem, ocultos: string[] = l.inicio.ocultos;
  ordemRef.current = ordem;

  const gravaOrdem = (nova: string[]) => salva({ ...l, inicio: { ...l.inicio, ordem: nova } });
  const move = (id: string, d2: -1 | 1) => {
    const o = [...ordem], k = o.indexOf(id), p = k + d2;
    if (p < 0 || p >= o.length) return;
    [o[k], o[p]] = [o[p], o[k]];
    gravaOrdem(o);
  };
  // para onde o bloco vai cair: o primeiro bloco cujo meio fica abaixo do centro arrastado
  const destino = (id: string, desl: number) => {
    const m = medidas[id]; if (!m) return null;
    const centro = m.y + m.h / 2 + desl;
    const outros = ordemRef.current.filter((x) => x !== id);
    const k = outros.findIndex((x) => medidas[x] && centro < medidas[x].y + medidas[x].h / 2);
    return k < 0 ? outros.length : k;
  };
  const respAlca = (id: string) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { setArr(id); ocupado.editandoLayout = true; dy.setValue(0); FC.layoutEditor.arrastando = true; },
    onPanResponderMove: (_e, g) => { dy.setValue(g.dy); setAlvo(destino(id, g.dy)); },
    onPanResponderRelease: (_e, g) => {
      const k = destino(id, g.dy);
      setArr(null); setAlvo(null); ocupado.editandoLayout = false; FC.layoutEditor.arrastando = false;
      if (k == null) return;
      const outros = ordemRef.current.filter((x) => x !== id);
      outros.splice(k, 0, id);
      if (outros.join() !== ordemRef.current.join()) gravaOrdem(outros);
    },
    onPanResponderTerminate: () => { setArr(null); setAlvo(null); ocupado.editandoLayout = false; FC.layoutEditor.arrastando = false; },
  });
  for (const id of ordem) if (!alcas[id]) alcas[id] = respAlca(id).panHandlers;

  const olho = async (id: string) => {
    const novos = ocultos.includes(id) ? ocultos.filter((x) => x !== id) : [...ocultos, id];
    await salva({ ...l, inicio: { ...l.inicio, ocultos: novos, ordem } });
  };
  const outrosOrdem = arr ? ordem.filter((x) => x !== arr) : ordem;
  const pad = estreito ? { paddingTop: 14, paddingHorizontal: 12, paddingBottom: 96 + insets.bottom } : celular ? { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 116 + insets.bottom } : { paddingTop: 48, paddingHorizontal: 24, paddingBottom: 96 };

  const conteudo = (
    <>
        <View style={{ maxWidth: 1180, width: "100%", alignSelf: "center" }}>
          <View accessibilityRole="toolbar" accessibilityLabel="Editar o Início"
            style={{ flexDirection: "row", alignItems: "center", gap: t.espaco.e3, flexWrap: "wrap", paddingVertical: 12, paddingHorizontal: 14, marginBottom: t.espaco.e3,
              borderRadius: t.raios.r, borderWidth: 1, borderColor: t.cores.acento, backgroundColor: t.cores.vidroForte, boxShadow: t.cores.sombra,
              ...(Platform.OS === "web" ? { backdropFilter: "blur(20px) saturate(180%)" } : {}) } as any}>
            <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
              <T style={{ fontWeight: "600" }}>{embutido ? "Blocos do Início e menu" : "Editando o Início"}</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <T style={{ fontSize: 13, color: t.cores.ink2 }}>Arraste pela alça</T><Icone nome="ordenar" tam={14} cor={t.cores.ink2} />
                <T style={{ fontSize: 13, color: t.cores.ink2 }}>e use o olho para ocultar.</T>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Botao variante="sec" pequeno icone="celular" onPress={abreMenu}>Menu</Botao>
              <Botao variante="texto" pequeno onPress={async () => {
                if (!(await ui.confirma("Voltar a ordem das abas e dos blocos do Início ao padrão?", { botao: "Voltar ao padrão" }))) return;
                await salva(padrao()); ui.aviso("Layout padrão restaurado");
              }}>Padrão</Botao>
              {embutido ? null : <Botao pequeno onPress={() => { router.replace("/inicio" as any); ui.aviso("Layout salvo"); }}>Concluir</Botao>}
            </View>
          </View>
        </View>
        <View style={{ maxWidth: 1180, width: "100%", alignSelf: "center", gap: t.espaco.e3 }}>
          {ordem.map((id) => {
            const k = outrosOrdem.indexOf(id);
            const linha = arr && alvo != null && arr !== id && k === alvo;
            return (
              <View key={id} onLayout={(e) => { medidas[id] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height }; }}>
                {linha ? <View style={{ height: 3, borderRadius: 2, backgroundColor: t.cores.acento, marginBottom: t.espaco.e3 }} /> : null}
                <Bloco id={id} oculto={ocultos.includes(id)} arrastando={arr === id} outroArrastando={!!arr && arr !== id} dy={dy} alca={alcas[id]}
                  aoOlho={() => olho(id)} aoMover={(d2) => move(id, d2)}
                  conteudo={ocultos.includes(id) || !blocos[id] ? null : <Isolado id={id}><ConteudoBloco render={blocos[id]} /></Isolado>} />
              </View>
            );
          })}
          {arr && alvo === outrosOrdem.length ? <View style={{ height: 3, borderRadius: 2, backgroundColor: t.cores.acento }} /> : null}
        </View>
    </>
  );
  return (
    <View style={embutido ? undefined : { flex: 1 }}>
      {embutido ? <View>{conteudo}</View> : (
        <ScrollView scrollEnabled={!arr} contentContainerStyle={pad} stickyHeaderIndices={[0]}>{conteudo}</ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- menu (folha com a prévia)
type Ret = { x: number; y: number; w: number; h: number };
function MenuLayout() {
  const t = useTema();
  const { width: largura } = useWindowDimensions();
  // a folha é larga, mas abaixo de ~700 px as duas prévias lado a lado ficam espremidas
  const empilha = largura < 700;
  useApp((s) => s.versao);
  const MAX = FC.layout.MAX_CELULAR;
  const ordem: string[] = FC.layoutAtual().nav.ordem;
  const naBarra = ordem.slice(0, MAX), emMais = ordem.slice(MAX);
  const refs = useRef<Record<string, any>>({}).current;
  const rets = useRef<Record<string, Ret>>({}).current;
  const [arr, setArr] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<any>(null);
  const pos = useRef(new Animated.ValueXY()).current;
  const mede = () => Promise.all(Object.entries(refs).map(([k, r]) => new Promise<void>((ok) => {
    if (!r || !r.measureInWindow) return ok();
    r.measureInWindow((x: number, y: number, w: number, h: number) => { rets[k] = { x, y, w, h }; ok(); });
  })));
  const dentro = (r: Ret | undefined, x: number, y: number) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const onde = (id: string, x: number, y: number) => {
    const chip = ordem.find((c) => c !== id && dentro(rets["c:" + c], x, y));
    if (chip) return { antes: chip };
    if (dentro(rets.barra, x, y)) return { fimBarra: true };
    if (dentro(rets.mais, x, y)) return { fimMais: true };
    return null;
  };
  const muda = (nova: string[]) => { const l = FC.layoutAtual(); salva({ ...l, nav: { ...l.nav, ordem: nova } }); };
  const resp = (id: string) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { mede(); setArr(id); pos.setValue({ x: 0, y: 0 }); },
    onPanResponderMove: (e, g) => { pos.setValue({ x: g.dx, y: g.dy }); setAlvo(onde(id, e.nativeEvent.pageX, e.nativeEvent.pageY)); },
    onPanResponderRelease: (e) => {
      const a = onde(id, e.nativeEvent.pageX, e.nativeEvent.pageY);
      setArr(null); setAlvo(null); pos.setValue({ x: 0, y: 0 });
      if (!a) return;
      const atual: string[] = FC.layoutAtual().nav.ordem.filter((x: string) => x !== id);
      const p = a.antes ? atual.indexOf(a.antes) : a.fimBarra ? Math.min(MAX - 1, atual.length) : atual.length;
      atual.splice(p, 0, id);
      muda(atual);
    },
    onPanResponderTerminate: () => { setArr(null); setAlvo(null); pos.setValue({ x: 0, y: 0 }); },
  });
  const handlers = useRef<Record<string, any>>({}).current;
  for (const id of ordem) if (!handlers[id]) handlers[id] = resp(id).panHandlers;

  const chip = (id: string, emLinha: boolean) => {
    const a = arr === id, alvoAqui = alvo && alvo.antes === id;
    return (
      <Animated.View key={id} ref={(r: any) => { refs["c:" + id] = r; }} {...handlers[id]}
        accessible accessibilityRole="adjustable" accessibilityLabel={nomeRota(id)}
        accessibilityActions={[{ name: "increment", label: "Mais para a direita" }, { name: "decrement", label: "Mais para a esquerda" }]}
        onAccessibilityAction={(ev: any) => {
          const de = ordem.indexOf(id), p = ev.nativeEvent.actionName === "increment" ? de + 1 : de - 1;
          if (p >= 0 && p < ordem.length) muda(FC.layout.move(ordem, de, p));
        }}
        style={{ flexDirection: emLinha ? "row" : "column", alignItems: "center", gap: emLinha ? 8 : 4, paddingVertical: 8, paddingHorizontal: emLinha ? 12 : 4,
          borderWidth: 1.5, borderRadius: t.raios.sm, borderColor: a || alvoAqui ? t.cores.acento : emLinha ? t.cores.linha : "transparent",
          backgroundColor: alvoAqui ? t.cores.acentoSuave : emLinha || a ? t.cores.bg2 : "transparent", zIndex: a ? 5 : 0,
          boxShadow: a ? t.cores.sombraAlta : undefined, flex: emLinha ? undefined : 1, minWidth: 0,
          transform: a ? pos.getTranslateTransform() : [], ...(Platform.OS === "web" ? { cursor: a ? "grabbing" : "grab", touchAction: "none", userSelect: "none" } : {}) } as any}>
        <Icone nome={iconeRota(id)} tam={20} cor={t.cores.acento} />
        <Text style={{ fontSize: emLinha ? 13 : 11, color: t.cores.ink }} numberOfLines={1}>{nomeRota(id)}</Text>
      </Animated.View>
    );
  };
  const rotulo = (txt: string, icone?: NomeIcone) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
      {icone ? <Icone nome={icone} tam={15} cor={t.cores.ink2} /> : null}
      <T style={{ fontSize: 12.5, fontWeight: "600", color: t.cores.ink2, letterSpacing: 0.5, textTransform: "uppercase" }}>{txt}</T>
    </View>
  );
  const esqueleto = (grande?: boolean) => (
    <View style={{ gap: 8, padding: 14 }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: t.cores.campo }} />
      {grande ? null : <View style={{ height: 10, borderRadius: 5, backgroundColor: t.cores.campo }} />}
      <View style={{ height: 10, width: "55%", borderRadius: 5, backgroundColor: t.cores.campo }} />
      <View style={{ height: grande ? 90 : 54, borderRadius: 12, backgroundColor: t.cores.campo }} />
    </View>
  );
  return (
    <View>
      <T v="p" style={{ marginBottom: t.espaco.e4 }}>Arraste as abas entre a barra do celular (até 4) e “Mais”. O menu do computador mostra todas, na mesma ordem.</T>
      {/* empilhado (celular), cada coluna tem a altura do próprio conteúdo: com flex: 1 numa
          coluna vertical a altura colapsava e "No computador" subia por cima de "Em Mais" */}
      <View style={{ flexDirection: empilha ? "column" : "row", gap: empilha ? t.espaco.e5 : t.espaco.e4, alignItems: empilha ? "stretch" : "flex-start" }}>
        <View style={empilha ? { width: "100%" } : { flex: 1, minWidth: 0 }}>
          {rotulo("No celular", "celular")}
          <View style={{ width: "100%", maxWidth: 260, alignSelf: "center", borderRadius: 34, padding: 8, backgroundColor: t.cores.ink, boxShadow: t.cores.sombra } as any}>
            <View style={{ minHeight: 300, borderRadius: 27, overflow: "hidden", backgroundColor: t.cores.bg, justifyContent: "space-between" }}>
              {esqueleto()}
              <View ref={(r: any) => { refs.barra = r; }} accessibilityLabel="Barra de baixo do celular"
                style={{ flexDirection: "row", gap: 4, paddingTop: 8, paddingHorizontal: 6, paddingBottom: 10, borderTopWidth: 1, borderTopColor: t.cores.linha,
                  backgroundColor: alvo && alvo.fimBarra ? t.cores.acentoSuave : t.cores.vidroForte }}>
                {naBarra.map((id) => chip(id, false))}
                {Array.from({ length: Math.max(0, MAX - naBarra.length) }, (_, i) => (
                  <View key={"v" + i} style={{ flex: 1, minHeight: 52, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.cores.linha2, borderRadius: t.raios.sm, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 11, color: t.cores.ink3 }}>vazio</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View style={{ marginTop: t.espaco.e3 }}>{rotulo("Em “Mais”")}</View>
          <View ref={(r: any) => { refs.mais = r; }} accessibilityLabel="Abas dentro de Mais"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, minHeight: 72, padding: 10, borderRadius: t.raios.r,
              backgroundColor: alvo && alvo.fimMais ? t.cores.acentoSuave : t.cores.campo, borderWidth: alvo && alvo.fimMais ? 2 : 0, borderStyle: "dashed", borderColor: t.cores.acento }}>
            {emMais.length ? emMais.map((id) => chip(id, true)) : (
              <View style={{ flex: 1, minHeight: 52, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.cores.linha2, borderRadius: t.raios.sm, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12.5, color: t.cores.ink3 }}>Nada aqui: todas as abas cabem na barra.</Text>
              </View>
            )}
          </View>
        </View>
        <View style={empilha ? { width: "100%" } : { flex: 1, minWidth: 0 }}>
          {rotulo("No computador", "ativos")}
          <View style={{ borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.sm, overflow: "hidden", backgroundColor: t.cores.bg, boxShadow: t.cores.sombra } as any}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: t.cores.linha, backgroundColor: t.cores.vidroForte }}>
              <View style={{ width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acentoSuave }}><Icone nome="inicio" tam={14} cor={t.cores.acento} /></View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, flex: 1 }}>
                {ordem.map((id) => (
                  <Text key={id} style={{ fontSize: 11.5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, overflow: "hidden",
                    color: naBarra.includes(id) ? t.cores.acento : t.cores.ink2, backgroundColor: naBarra.includes(id) ? t.cores.acentoSuave : "transparent" }}>{nomeRota(id)}</Text>
                ))}
              </View>
            </View>
            {esqueleto(true)}
          </View>
        </View>
      </View>
    </View>
  );
}
function abreMenu() {
  ui.folha({ titulo: "Menu e barra do celular", larga: true, corpo: () => <MenuLayout />, rodape: (api) => <Botao onPress={api.fechar}>Pronto</Botao> });
}

FC.layoutEditor = Object.assign(FC.layoutEditor || {}, { arrastando: false, abreMenu, salva });
