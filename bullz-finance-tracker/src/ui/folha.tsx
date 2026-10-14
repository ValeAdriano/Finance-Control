/* Folha, aviso e confirmação — a mesma API do FC.ui do site.
 *
 *   ui.folha({ titulo, corpo, rodape, larga, aoFechar }) → { fechar }
 *   ui.aviso(texto, "ok" | "erro")
 *   ui.erro(e)
 *   ui.confirma(texto, { titulo, botao, perigo }) → Promise<boolean>
 *
 * A folha sobe de baixo no celular (≤640, arrastar o puxador fecha) e surge
 * no centro no computador. `corpo`/`rodape` podem ser nós ou funções que
 * recebem a api ({ fechar }), para formulários fecharem a própria folha.
 * Todas as folhas abertas repintam junto com o app (`FC.rerender`). */
import React, { useEffect, useRef } from "react";
import {
  Animated, Easing, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, View, Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { useTema } from "../tema";
import { useApp, ocupado } from "../estado/app";
import { useMedidas } from "./medidas";
import { Icone } from "./icone";
import { Botao, T } from "./kit";
import FC from "../nucleo";

export interface ApiFolha { fechar: () => void; id: number }
type Conteudo = React.ReactNode | ((api: ApiFolha) => React.ReactNode);
export interface OpcoesFolha {
  titulo?: string;
  corpo: Conteudo;
  rodape?: Conteudo;
  larga?: boolean;
  aoFechar?: () => void;
}
interface FolhaAberta extends OpcoesFolha { id: number; fechando: boolean; api: ApiFolha }
interface Aviso { id: number; texto: string; tipo: "ok" | "erro"; saindo: boolean }

const useFolhas = create<{ folhas: FolhaAberta[]; avisos: Aviso[] }>(() => ({ folhas: [], avisos: [] }));
let seq = 0;

function folha(op: OpcoesFolha): ApiFolha {
  const id = ++seq;
  const api: ApiFolha = {
    id,
    fechar: () => {
      const f = useFolhas.getState().folhas.find((x) => x.id === id);
      if (!f || f.fechando) return;
      useFolhas.setState((s) => ({ folhas: s.folhas.map((x) => (x.id === id ? { ...x, fechando: true } : x)) }));
    },
  };
  ocupado.folhas++;
  useFolhas.setState((s) => ({ folhas: [...s.folhas, { ...op, id, fechando: false, api }] }));
  return api;
}

function remove(id: number) {
  const f = useFolhas.getState().folhas.find((x) => x.id === id);
  ocupado.folhas = Math.max(0, ocupado.folhas - 1);
  useFolhas.setState((s) => ({ folhas: s.folhas.filter((x) => x.id !== id) }));
  f?.aoFechar?.();
}

function aviso(texto: string, tipo: "ok" | "erro" = "ok") {
  const id = ++seq;
  useFolhas.setState((s) => ({ avisos: [...s.avisos, { id, texto, tipo, saindo: false }] }));
  setTimeout(() => {
    useFolhas.setState((s) => ({ avisos: s.avisos.map((a) => (a.id === id ? { ...a, saindo: true } : a)) }));
    setTimeout(() => useFolhas.setState((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) })), 260);
  }, tipo === "erro" ? 5200 : 3000);
}

function erro(e: any) {
  console.error(e);
  const msg = (e && (e.message || e.error_description || e.msg)) || String(e);
  aviso(FC.ui.traduzErro(msg), "erro");
}

function confirma(texto: React.ReactNode, { titulo = "Confirmar", botao = "Confirmar", perigo = false } = {}): Promise<boolean> {
  return new Promise((ok) => {
    let resposta = false;
    folha({
      titulo,
      corpo: typeof texto === "string" ? <T style={{ fontSize: 15 }} cor={undefined}>{texto}</T> : texto,
      rodape: (api) => (
        <>
          <Botao variante="sec" onPress={() => { resposta = false; api.fechar(); }}>Cancelar</Botao>
          <Botao variante={perigo ? "perigo" : "primario"} onPress={() => { resposta = true; api.fechar(); }}>{botao}</Botao>
        </>
      ),
      aoFechar: () => ok(resposta),
    });
  });
}

/** botão com estado de carregando enquanto a promessa roda (no app, o Botao já faz isso) */
async function ocupadoFn<R>(_botao: any, fn: () => Promise<R>): Promise<R> { return fn(); }

export const ui = { folha, aviso, erro, confirma, ocupado: ocupadoFn, traduzErro: (m: string) => FC.ui.traduzErro(m) };
// o código compartilhado chama FC.ui.* — passa a cair na versão do app
Object.assign(FC.ui, { folha, aviso, erro, confirma, ocupado: ocupadoFn });

// ---------------------------------------------------------------- host
function UmaFolha({ f, topo }: { f: FolhaAberta; topo: boolean }) {
  const t = useTema();
  const { estreito, altura } = useMedidas();
  const insets = useSafeAreaInsets();
  useApp((s) => s.versao); // repinta com o app
  const fundo = useRef(new Animated.Value(0)).current;
  const prog = useRef(new Animated.Value(0)).current;
  const arraste = useRef(new Animated.Value(0)).current;
  const nd = Platform.OS !== "web";

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fundo, { toValue: 1, duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: nd }),
      Animated.timing(prog, { toValue: 1, duration: 450, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: nd }),
    ]).start();
  }, [fundo, prog, nd]);

  useEffect(() => {
    if (!f.fechando) return;
    Animated.parallel([
      Animated.timing(fundo, { toValue: 0, duration: 220, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: nd }),
      Animated.timing(prog, { toValue: 0, duration: 220, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: nd }),
    ]).start(() => remove(f.id));
  }, [f.fechando, f.id, fundo, prog, nd]);

  // Esc fecha a folha de cima (web)
  useEffect(() => {
    if (Platform.OS !== "web" || !topo) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") f.api.fechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [topo, f.api]);

  const puxa = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 4,
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_e, g) => { if (g.dy > 0) arraste.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 60) f.api.fechar();
      Animated.spring(arraste, { toValue: 0, useNativeDriver: nd }).start();
    },
  })).current;

  const corpo = typeof f.corpo === "function" ? (f.corpo as any)(f.api) : f.corpo;
  const rodape = typeof f.rodape === "function" ? (f.rodape as any)(f.api) : f.rodape;

  const transform = estreito
    ? [{ translateY: Animated.add(prog.interpolate({ inputRange: [0, 1], outputRange: [altura, 0] }), arraste) }]
    : [{ translateY: prog.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: prog.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }];

  return (
    <Modal transparent visible animationType="none" onRequestClose={f.api.fechar} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: estreito ? "flex-end" : "center", padding: estreito ? 0 : t.espaco.e4 }}>
          <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.32)", opacity: fundo }}>
            <Pressable style={{ flex: 1 }} onPress={f.api.fechar} accessibilityLabel="Fechar" />
          </Animated.View>
          <Animated.View accessibilityViewIsModal accessibilityLabel={f.titulo}
            style={[{
              backgroundColor: t.cores.bg2, width: "100%", maxWidth: estreito ? undefined : f.larga ? 880 : 560,
              maxHeight: estreito ? altura * 0.92 : altura - 48, borderRadius: 22,
              borderBottomLeftRadius: estreito ? 0 : 22, borderBottomRightRadius: estreito ? 0 : 22,
              overflow: "hidden", boxShadow: t.cores.sombraAlta, transform,
              opacity: estreito ? 1 : prog,
            } as any]}>
            {estreito ? (
              <View {...puxa.panHandlers} style={{ paddingTop: 8, paddingBottom: 2, alignItems: "center" }}>
                <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: t.cores.linha2 }} />
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.espaco.e3, paddingTop: 18, paddingHorizontal: t.espaco.e4, paddingBottom: 12 }}>
              <T style={{ fontSize: 19, fontWeight: "600", flex: 1 }} accessibilityRole="header" numberOfLines={2}>{f.titulo || ""}</T>
              <Pressable onPress={f.api.fechar} accessibilityRole="button" accessibilityLabel="Fechar"
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.cores.campo, alignItems: "center", justifyContent: "center" }}>
                <Icone nome="fechar" tam={16} cor={t.cores.ink2} />
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8, paddingHorizontal: t.espaco.e4, paddingBottom: t.espaco.e4 + (estreito && !rodape ? insets.bottom : 0) }}>
              {corpo}
            </ScrollView>
            {rodape ? (
              <View style={{ paddingTop: 12, paddingHorizontal: t.espaco.e4, paddingBottom: t.espaco.e4 + (estreito ? insets.bottom : 0),
                flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2, justifyContent: "flex-end", borderTopWidth: 1, borderTopColor: t.cores.linha }}>
                {rodape}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      {topo ? <AvisosVista /> : null}
    </Modal>
  );
}

function UmAviso({ a }: { a: Aviso }) {
  const t = useTema();
  const p = useRef(new Animated.Value(0)).current;
  const nd = Platform.OS !== "web";
  useEffect(() => {
    Animated.timing(p, { toValue: a.saindo ? 0 : 1, duration: a.saindo ? 250 : 450, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: nd }).start();
  }, [a.saindo, p, nd]);
  return (
    <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite"
      style={{ opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        backgroundColor: t.cores.vidroForte, borderWidth: 1, borderColor: t.cores.linha, boxShadow: t.cores.sombraAlta,
        paddingVertical: 12, paddingHorizontal: 18, borderRadius: 980, flexDirection: "row", gap: 10, alignItems: "center", maxWidth: "92%" } as any}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.tipo === "erro" ? t.cores.vermelho : t.cores.verde }} />
      <Text style={{ color: t.cores.ink, fontSize: 14, flexShrink: 1 }}>{a.texto}</Text>
    </Animated.View>
  );
}

function AvisosVista() {
  const avisos = useFolhas((s) => s.avisos);
  const { celular } = useMedidas();
  const insets = useSafeAreaInsets();
  if (!avisos.length) return null;
  return (
    <View dataSet={{ imprimir: "nao" }} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: celular ? 80 + insets.bottom : 28, alignItems: "center", gap: 8, zIndex: 100 }}>
      {avisos.map((a) => <UmAviso key={a.id} a={a} />)}
    </View>
  );
}

/** Monte uma vez, na raiz: desenha as folhas e os avisos abertos (o aviso vai
 * dentro da folha do topo, senão o Modal nativo o cobriria). */
export function HostFolhas() {
  const folhas = useFolhas((s) => s.folhas);
  return (
    <>
      {folhas.map((f, i) => <UmaFolha key={f.id} f={f} topo={i === folhas.length - 1} />)}
      {folhas.length ? null : <AvisosVista />}
    </>
  );
}

// ---------------------------------------------------------------- folha com formulário
const acoesForm = new Map<number, () => any>();
/** Folha de formulário com Cancelar/Salvar (e Excluir, se `apagar`). O corpo
 * registra a ação de salvar com `defineSalvar(fn)` a cada render. */
export function folhaForm({ titulo, larga, corpo, salvar = "Salvar", apagar, rotuloApagar = "Excluir", cancelar = "Cancelar", aoFechar }: {
  titulo: string; larga?: boolean; salvar?: string; rotuloApagar?: string; cancelar?: string; aoFechar?: () => void;
  corpo: (api: ApiFolha, defineSalvar: (fn: () => any) => void) => React.ReactNode;
  apagar?: (api: ApiFolha) => any;
}) {
  return folha({
    titulo, larga,
    corpo: (api) => corpo(api, (fn) => acoesForm.set(api.id, fn)),
    rodape: (api) => (
      <>
        {apagar ? <Botao variante="perigo" icone="lixo" style={{ marginRight: "auto" }} onPress={() => apagar(api)}>{rotuloApagar}</Botao> : null}
        <Botao variante="sec" onPress={api.fechar}>{cancelar}</Botao>
        <Botao onPress={() => acoesForm.get(api.id)?.()}>{salvar}</Botao>
      </>
    ),
    aoFechar,
  });
}

// ---------------------------------------------------------------- tela cheia
interface TelaCheiaAberta { id: number; render: (api: ApiFolha) => React.ReactNode; fechando: boolean; api: ApiFolha; fundo?: string }
const useTelas = create<{ telas: TelaCheiaAberta[] }>(() => ({ telas: [] }));
/** Camada em tela cheia (questionário do perfil, apresentação, retrospectiva). */
export function telaCheia(render: (api: ApiFolha) => React.ReactNode, { fundo }: { fundo?: string } = {}): ApiFolha {
  const id = ++seq;
  const api: ApiFolha = {
    id,
    fechar: () => useTelas.setState((s) => ({ telas: s.telas.map((x) => (x.id === id ? { ...x, fechando: true } : x)) })),
  };
  ocupado.folhas++;
  useTelas.setState((s) => ({ telas: [...s.telas, { id, render, fechando: false, api, fundo }] }));
  return api;
}
function UmaTela({ tc }: { tc: TelaCheiaAberta }) {
  const t = useTema();
  useApp((s) => s.versao);
  const op = useRef(new Animated.Value(0)).current;
  const nd = Platform.OS !== "web";
  useEffect(() => {
    Animated.timing(op, { toValue: tc.fechando ? 0 : 1, duration: tc.fechando ? 260 : 280, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: nd }).start(() => {
      if (tc.fechando) { ocupado.folhas = Math.max(0, ocupado.folhas - 1); useTelas.setState((s) => ({ telas: s.telas.filter((x) => x.id !== tc.id) })); }
    });
  }, [tc.fechando, tc.id, op, nd]);
  return (
    <Modal transparent visible animationType="none" onRequestClose={tc.api.fechar} statusBarTranslucent>
      <Animated.View style={{ flex: 1, backgroundColor: tc.fundo || t.cores.bg, opacity: op }}>{tc.render(tc.api)}</Animated.View>
      <AvisosVista />
    </Modal>
  );
}
export function HostTelas() {
  const telas = useTelas((s) => s.telas);
  return <>{telas.map((tc) => <UmaTela key={tc.id} tc={tc} />)}</>;
}
Object.assign(ui, { telaCheia });
