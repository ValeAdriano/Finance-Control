/* Campos de formulário — .form, .campo, .entrada, .interruptor, .segmentado.
 *
 * No web o seletor e a data usam os elementos nativos do navegador (<select>,
 * <input type=date>), como o site. No celular, o seletor abre uma folha com
 * as opções e a data abre um calendário. */
import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, Platform, Pressable, ScrollView, TextInput, View, Text, type TextInputProps, type StyleProp, type ViewStyle,
} from "react-native";
import { useTema } from "../tema";
import { useMedidas } from "./medidas";
import { Icone } from "./icone";
import { T } from "./kit";
import { ui } from "./folha";
import FC from "../nucleo";
import { vibra } from "../plataforma/vibra";

/** .form: coluna com espaço de 16 */
export function Form({ children, gap, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  return <View style={[{ gap: gap ?? t.espaco.e3 }, style]}>{children}</View>;
}

/** .linha2/.linha3: lado a lado; em tela estreita, empilha */
export function LinhaCampos({ children, n = 2 }: { children: React.ReactNode; n?: 2 | 3 }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const filhos = React.Children.toArray(children).filter(Boolean);
  if (estreito) return <View style={{ gap: t.espaco.e3 }}>{filhos}</View>;
  return (
    <View style={{ flexDirection: "row", gap: t.espaco.e3 }}>
      {filhos.map((f, i) => <View key={i} style={{ flex: 1, minWidth: 0 }}>{f}</View>)}
      {filhos.length < n ? Array.from({ length: n - filhos.length }).map((_, i) => <View key={"v" + i} style={{ flex: 1 }} />) : null}
    </View>
  );
}

export function Campo({ rotulo, dica, children, erro }: { rotulo?: React.ReactNode; dica?: React.ReactNode; children: React.ReactNode; erro?: string | null }) {
  const t = useTema();
  return (
    <View style={{ gap: 6, minWidth: 0 }}>
      {rotulo ? <T v="rot">{rotulo}</T> : null}
      {children}
      {dica ? <T v="dica">{dica}</T> : null}
      {erro ? <T style={{ color: t.cores.vermelho, fontSize: 13 }}>{erro}</T> : null}
    </View>
  );
}

/** a pilha de fontes do body do site (para os elementos nativos do navegador) */
/** estilo RN → CSS para os elementos nativos do navegador (sem paddingHorizontal etc.) */
function paraCss(b: any) {
  const { paddingHorizontal: ph, paddingVertical: pv, fontVariant, ...resto } = b;
  return { ...resto, paddingLeft: ph, paddingRight: ph, paddingTop: pv, paddingBottom: pv, boxSizing: "border-box", border: `1px solid ${b.borderColor}`,
    fontVariantNumeric: fontVariant ? "tabular-nums" : undefined };
}

export const FONTE_SISTEMA = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

function useEstiloEntrada(foco: boolean, compacto = false) {
  const t = useTema();
  return {
    minHeight: compacto ? 36 : 44, paddingVertical: compacto ? 6 : 10, paddingHorizontal: compacto ? 12 : 14,
    borderRadius: compacto ? 10 : t.raios.sm, borderWidth: 1,
    borderColor: foco ? t.cores.acento : "transparent", backgroundColor: foco ? t.cores.bg2 : t.cores.campo,
    color: t.cores.ink, fontSize: compacto ? 14 : 16, letterSpacing: -0.16, fontVariant: ["tabular-nums"] as any,
    boxShadow: foco ? `0 0 0 4px ${t.cores.campoFoco}` : undefined,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  } as any;
}

export interface EntradaProps extends TextInputProps {
  valor?: string;
  aoMudar?: (v: string) => void;
  decimal?: boolean;
  compacto?: boolean;
  maiusculas?: boolean;
  monoespaco?: boolean;
}
export const Entrada = React.forwardRef<TextInput, EntradaProps>(function Entrada(
  { valor, aoMudar, decimal, compacto, maiusculas, monoespaco, style, multiline, ...resto }, ref,
) {
  const t = useTema();
  const [foco, setFoco] = useState(false);
  const base = useEstiloEntrada(foco, compacto);
  return (
    <TextInput ref={ref} value={valor} onChangeText={(v) => aoMudar?.(maiusculas ? v.toUpperCase() : v)}
      placeholderTextColor={t.cores.ink3} keyboardType={decimal ? "decimal-pad" : resto.keyboardType}
      autoCapitalize={maiusculas ? "characters" : resto.autoCapitalize ?? "none"} autoCorrect={false}
      onFocus={(e) => { setFoco(true); resto.onFocus?.(e); }} onBlur={(e) => { setFoco(false); resto.onBlur?.(e); }}
      multiline={multiline}
      style={[base, multiline ? { minHeight: 120, textAlignVertical: "top", fontSize: 13, lineHeight: 19.5,
        fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, SF Mono, Menlo, monospace" }) } : null,
        monoespaco ? { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) } : null, style]}
      {...resto} />
  );
});

// ---------------------------------------------------------------- seletor
export interface Opcao { v: string; rotulo: string }
export function Seletor({ valor, opcoes, aoMudar, compacto, rotuloA11y, titulo }: {
  valor: string; opcoes: Opcao[]; aoMudar: (v: string) => void; compacto?: boolean; rotuloA11y?: string; titulo?: string;
}) {
  const t = useTema();
  const [foco, setFoco] = useState(false);
  const base = useEstiloEntrada(foco, compacto);
  if (Platform.OS === "web") {
    return React.createElement("select", {
      value: valor, "aria-label": rotuloA11y,
      onChange: (e: any) => aoMudar(e.target.value),
      onFocus: () => setFoco(true), onBlur: () => setFoco(false),
      style: {
        ...paraCss(base), width: "100%", appearance: "none", WebkitAppearance: "none", fontFamily: FONTE_SISTEMA,
        paddingRight: compacto ? 32 : 36, cursor: "pointer",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%2386868b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat", backgroundPosition: `right ${compacto ? 12 : 14}px center`,
        boxShadow: base.boxShadow, outline: "none",
      },
    }, opcoes.map((o) => React.createElement("option", { key: o.v, value: o.v }, o.rotulo)));
  }
  const atual = opcoes.find((o) => o.v === valor);
  const abre = () => {
    ui.folha({
      titulo: titulo || rotuloA11y || "Escolha",
      corpo: (api) => (
        <View style={{ borderRadius: t.raios.r, borderWidth: 1, borderColor: t.cores.linha, overflow: "hidden" }}>
          {opcoes.map((o, i) => (
            <Pressable key={o.v} onPress={() => { if (o.v !== valor) vibra.toque(); aoMudar(o.v); api.fechar(); }} accessibilityRole="button" accessibilityState={{ selected: o.v === valor }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingHorizontal: 16,
                borderTopWidth: i ? 1 : 0, borderTopColor: t.cores.linha, backgroundColor: pressed ? t.cores.campo : t.cores.bg2 })}>
              <T style={{ flex: 1, fontWeight: o.v === valor ? "600" : "400" }}>{o.rotulo}</T>
              {o.v === valor ? <Icone nome="check" tam={18} cor={t.cores.acento} /> : null}
            </Pressable>
          ))}
        </View>
      ),
    });
  };
  return (
    <Pressable onPress={abre} accessibilityRole="button" accessibilityLabel={rotuloA11y}
      style={[base, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
      <Text style={{ color: t.cores.ink, fontSize: compacto ? 14 : 16, flexShrink: 1 }} numberOfLines={1}>{atual ? atual.rotulo : ""}</Text>
      <View style={{ transform: [{ rotate: "90deg" }] }}><Icone nome="chevron" tam={14} cor={t.cores.ink3} /></View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- data
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function Calendario({ valor, max, min, aoEscolher }: { valor: string; max?: string; min?: string; aoEscolher: (iso: string) => void }) {
  const t = useTema();
  const ini = valor || FC.datas.hoje();
  const [mes, setMes] = useState(ini.slice(0, 7));
  const [a, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const dias = FC.datas.ultimoDiaDoMes(mes);
  const celulas: Array<number | null> = [...Array(primeiro).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  const anda = (d: number) => { const x = new Date(Date.UTC(a, m - 1 + d, 1)); setMes(x.toISOString().slice(0, 7)); };
  const hoje = FC.datas.hoje();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => anda(-12)} hitSlop={8} accessibilityLabel="Ano anterior"><T cor={t.cores.acento}>«</T></Pressable>
        <Pressable onPress={() => anda(-1)} hitSlop={8} accessibilityLabel="Mês anterior"><Icone nome="voltar" tam={20} cor={t.cores.acento} /></Pressable>
        <T style={{ fontWeight: "600", fontSize: 16 }}>{MESES[m - 1]} de {a}</T>
        <Pressable onPress={() => anda(1)} hitSlop={8} accessibilityLabel="Próximo mês"><Icone nome="chevron" tam={20} cor={t.cores.acento} /></Pressable>
        <Pressable onPress={() => anda(12)} hitSlop={8} accessibilityLabel="Próximo ano"><T cor={t.cores.acento}>»</T></Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <T key={i} v="dica" centro style={{ flex: 1 }}>{d}</T>)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {celulas.map((d, i) => {
          if (d == null) return <View key={i} style={{ width: `${100 / 7}%`, height: 42 }} />;
          const iso = `${mes}-${String(d).padStart(2, "0")}`;
          const fora = (max && iso > max) || (min && iso < min);
          const sel = iso === valor;
          return (
            <Pressable key={i} disabled={!!fora} onPress={() => aoEscolher(iso)} accessibilityLabel={FC.datas.br(iso)}
              style={{ width: `${100 / 7}%`, height: 42, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
                backgroundColor: sel ? t.cores.acento : "transparent", borderWidth: iso === hoje && !sel ? 1 : 0, borderColor: t.cores.acento }}>
                <Text style={{ color: sel ? "#fff" : fora ? t.cores.ink3 : t.cores.ink, fontSize: 15, opacity: fora ? 0.4 : 1 }}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CampoData({ valor, aoMudar, max, min, rotuloA11y, compacto }: {
  valor: string; aoMudar: (iso: string) => void; max?: string; min?: string; rotuloA11y?: string; compacto?: boolean;
}) {
  const t = useTema();
  const [foco, setFoco] = useState(false);
  const base = useEstiloEntrada(foco, compacto);
  if (Platform.OS === "web") {
    return React.createElement("input", {
      type: "date", value: valor || "", max, min, "aria-label": rotuloA11y,
      onChange: (e: any) => aoMudar(e.target.value), onFocus: () => setFoco(true), onBlur: () => setFoco(false),
      style: { ...paraCss(base), width: "100%", fontFamily: FONTE_SISTEMA, outline: "none", colorScheme: t.esquema === "escuro" ? "dark" : "light" },
    });
  }
  const abre = () => ui.folha({
    titulo: rotuloA11y || "Data",
    corpo: (api) => <Calendario valor={valor} max={max} min={min} aoEscolher={(iso) => { aoMudar(iso); api.fechar(); }} />,
    rodape: valor ? (api) => <Pressable onPress={() => { aoMudar(""); api.fechar(); }}><T cor={t.cores.vermelho}>Limpar</T></Pressable> : undefined,
  });
  return (
    <Pressable onPress={abre} accessibilityRole="button" accessibilityLabel={rotuloA11y} style={[base, { justifyContent: "center" }]}>
      <Text style={{ color: valor ? t.cores.ink : t.cores.ink3, fontSize: compacto ? 14 : 16 }}>{valor ? FC.datas.br(valor) : "dd/mm/aaaa"}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- interruptor
export function Interruptor({ valor, aoMudar, rotulo, desabilitado }: { valor: boolean; aoMudar: (v: boolean) => void; rotulo?: React.ReactNode; desabilitado?: boolean }) {
  const t = useTema();
  const a = useRef(new Animated.Value(valor ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: valor ? 1 : 0, duration: 300, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }).start();
  }, [valor, a]);
  const fundo = a.interpolate({ inputRange: [0, 1], outputRange: [t.cores.campo, "#34c759"] });
  const x = a.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  return (
    <Pressable onPress={() => { if (desabilitado) return; vibra.toque(); aoMudar(!valor); }} accessibilityRole="switch" accessibilityState={{ checked: valor, disabled: desabilitado }}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, opacity: desabilitado ? 0.5 : 1 }}>
      <Animated.View style={{ width: 51, height: 31, borderRadius: 16, backgroundColor: fundo, padding: 2 }}>
        <Animated.View style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: "#fff", transform: [{ translateX: x }],
          boxShadow: "0 3px 8px rgba(0,0,0,.15), 0 3px 1px rgba(0,0,0,.06)" } as any} />
      </Animated.View>
      {rotulo != null ? (typeof rotulo === "string" ? <T style={{ fontSize: 15, flexShrink: 1 }}>{rotulo}</T> : rotulo) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- segmentado
export function Segmentado<V extends string>({ opcoes, valor, aoMudar, cheio: cheioPedido, rotuloA11y }: {
  opcoes: Array<{ v: V; rotulo: string }>; valor: V; aoMudar: (v: V) => void; cheio?: boolean; rotuloA11y?: string;
}) {
  const t = useTema();
  const { estreito } = useMedidas();
  // no celular, até 5 opções cabem na largura disponível: cada uma encolhe (e a
  // fonte também) só se faltar espaço, em vez de passar da borda da tela. Não é
  // `flex: 1` — dentro de uma linha sem largura (ex.: à direita de um Item) isso
  // encolhia o controle até sumir. Com mais opções, o controle rola.
  const dividido = estreito && opcoes.length <= 5 && !cheioPedido;
  const cheio = !!cheioPedido;
  const rolagem = useRef<ScrollView>(null);
  const pos = useRef<Record<string, { x: number; w: number }>>({}).current;
  const left = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const [pronto, setPronto] = useState(false);
  const move = (anima: boolean) => {
    const p = pos[valor];
    if (!p) return;
    if (!anima) { left.setValue(p.x); width.setValue(p.w); setPronto(true); return; }
    Animated.parallel([
      Animated.timing(left, { toValue: p.x, duration: 350, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }),
      Animated.timing(width, { toValue: p.w, duration: 350, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }),
    ]).start();
  };
  useEffect(() => {
    move(pronto);
    // a opção escolhida fica sempre à vista quando o controle rola
    const p = pos[valor];
    if (p && rolagem.current) rolagem.current.scrollTo({ x: Math.max(0, p.x - 24), animated: pronto });
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  const controle = (
    <View accessibilityRole="tablist" accessibilityLabel={rotuloA11y}
      style={{ flexDirection: "row", alignSelf: cheio ? "stretch" : "flex-start", maxWidth: "100%", backgroundColor: t.cores.campo, borderRadius: 10, padding: 2 }}>
      {pronto ? (
        <Animated.View style={{ position: "absolute", top: 2, bottom: 2, left, width, borderRadius: 8, backgroundColor: t.deslizante,
          boxShadow: "0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04)" } as any} />
      ) : null}
      {opcoes.map((o) => (
        <Pressable key={o.v} onPress={() => { if (o.v !== valor) vibra.toque(); aoMudar(o.v); }} accessibilityRole="tab" accessibilityState={{ selected: o.v === valor }}
          onLayout={(e) => { pos[o.v] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width }; if (o.v === valor) move(false); }}
          style={[{ paddingVertical: 6, paddingHorizontal: dividido ? 10 : 16, borderRadius: 8, minHeight: 32, justifyContent: "center", alignItems: "center" },
            cheio ? { flex: 1, minWidth: 0 } : dividido ? { flexShrink: 1, minWidth: 0 } : null]}>
          <Text style={{ fontSize: dividido ? 13 : 13.5, color: t.cores.ink, fontWeight: o.v === valor ? "600" : "400" }} numberOfLines={1}
            adjustsFontSizeToFit={dividido} minimumFontScale={0.75}>{o.rotulo}</Text>
        </Pressable>
      ))}
    </View>
  );
  if (cheio || dividido) return controle;
  // largo demais para a tela: rola na horizontal em vez de quebrar
  return (
    <ScrollView ref={rolagem} horizontal showsHorizontalScrollIndicator={Platform.OS !== "web"}
      style={{ flexGrow: 0, flexShrink: 1, maxWidth: "100%", alignSelf: "stretch" }} contentContainerStyle={{ flexGrow: 0 }}>
      {controle}
    </ScrollView>
  );
}

/** checkbox simples (quadrado com check), para listas de escolha múltipla */
export function Caixinha({ valor, aoMudar, rotulo }: { valor: boolean; aoMudar: (v: boolean) => void; rotulo?: React.ReactNode }) {
  const t = useTema();
  return (
    <Pressable onPress={() => aoMudar(!valor)} accessibilityRole="checkbox" accessibilityState={{ checked: valor }}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: valor ? t.cores.acento : t.cores.linha2,
        backgroundColor: valor ? t.cores.acento : "transparent", alignItems: "center", justifyContent: "center" }}>
        {valor ? <Icone nome="check" tam={15} cor="#fff" /> : null}
      </View>
      {typeof rotulo === "string" ? <T style={{ flexShrink: 1 }}>{rotulo}</T> : rotulo}
    </Pressable>
  );
}
