/* Kit de interface — cada peça espelha uma classe do app.css do site.
 *
 *   T            tipografia (h1…h4, sub, texto-p, rot)
 *   Cartao       .cartao            Secao/Cabecalho  .secao/.cabecalho
 *   Grade        .grade g2/g3/g4/auto
 *   Kpis/Kpi     .kpis/.kpi         Chip  .chip
 *   Pilula/Ponto .pilula/.ponto-e   Anel  .anel
 *   Lista/Item   .lista > .item     Mensagem .mensagem
 *   Botao        .botao (sec, perigo, texto, pequeno, cheio)
 *   Rs/Num       .rs (modo privado e carregamento em blur)
 *   Vazio, Detalhes, Tabela, Trilha, BarraAlocacao, Composicao, Legenda,
 *   Roda, Ajuda, Indicadores
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, Text, View,
  type StyleProp, type TextStyle, type ViewStyle, type TextProps,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { corCss, useTema, type Tema } from "../tema";
import { useApp } from "../estado/app";
import { useMedidas } from "./medidas";
import { Icone, type NomeIcone } from "./icone";
import FC from "../nucleo";


/** tela de toque (celular/tablet no navegador, ou app nativo) */
const toque = Platform.OS !== "web" || (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);

// ---------------------------------------------------------------- cores nomeadas
/** cor de estado (verde/amarelo/vermelho/cinza/azul/terra) → [texto, fundo] */
export function corEstado(t: Tema, cor?: string | null): [string, string] {
  const c = t.cores;
  switch (cor) {
    case "verde": return [c.verde, c.verdeSuave];
    case "amarelo": return [c.amarelo, c.amareloSuave];
    case "vermelho": return [c.vermelho, c.vermelhoSuave];
    case "azul": return [c.acento, c.acentoSuave];
    case "terra": return [c.terra, c.terraSuave];
    default: return [c.ink2, c.cinzaSuave];
  }
}
/** .ponto-e: amarelo usa --s3 e cinza usa --ink-3 */
export function corPonto(t: Tema, cor?: string | null): string {
  const c = t.cores;
  return ({ verde: c.verde, amarelo: c.s3, vermelho: c.vermelho, azul: c.acento, terra: c.terra } as any)[cor || ""] || c.ink3;
}
/** classes pos/neg/fraco/muito-fraco */
export function corClasse(t: Tema, cls?: string | null): string | undefined {
  if (cls === "pos") return t.cores.verde;
  if (cls === "neg") return t.cores.vermelho;
  if (cls === "fraco") return t.cores.ink2;
  if (cls === "muito-fraco") return t.cores.ink3;
  return undefined;
}
export const clsSinal = (v: number | null | undefined) => (FC.ok(v) ? ((v as number) >= 0 ? "pos" : "neg") : "fraco");

// ---------------------------------------------------------------- texto
type Variante = "h1" | "h2" | "h3" | "h4" | "sub" | "p" | "corpo" | "rot" | "peq" | "dica";
export interface TProps extends TextProps {
  v?: Variante;
  cor?: string;
  cls?: "pos" | "neg" | "fraco" | "muito-fraco" | string | null;
  peso?: TextStyle["fontWeight"];
  tam?: number;
  centro?: boolean;
  num?: boolean;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}
export function T({ v = "corpo", cor, cls, peso, tam, centro, num, style, children, ...resto }: TProps) {
  const t = useTema();
  const { estreito } = useMedidas();
  const base: TextStyle = (() => {
    switch (v) {
      case "h1": return { fontSize: estreito ? 26 : 34, lineHeight: (estreito ? 26 : 34) * 1.12, fontWeight: "600", letterSpacing: estreito ? -0.65 : -0.75, color: t.cores.ink };
      case "h2": return { fontSize: 22, lineHeight: 27, fontWeight: "600", letterSpacing: -0.48, color: t.cores.ink };
      case "h3": return { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.37, color: t.cores.ink };
      case "h4": return { fontSize: 16, lineHeight: 21, fontWeight: "600", letterSpacing: -0.35, color: t.cores.ink };
      case "sub": return { fontSize: 14, lineHeight: 20, color: t.cores.ink2 };
      case "p": return { fontSize: 13, lineHeight: 20.8, color: t.cores.ink2 };
      case "rot": return { fontSize: 13, lineHeight: 18, color: t.cores.ink2, fontWeight: "500" };
      case "peq": return { fontSize: 12.5, lineHeight: 17, color: t.cores.ink2 };
      case "dica": return { fontSize: 12, lineHeight: 16, color: t.cores.ink3 };
      default: return { fontSize: 15, lineHeight: 22, color: t.cores.ink, letterSpacing: -0.15 };
    }
  })();
  const extra: TextStyle = {};
  const cc = corClasse(t, cls);
  if (cc) extra.color = cc;
  if (cor) extra.color = cor;
  if (peso) extra.fontWeight = peso;
  if (tam) { extra.fontSize = tam; extra.lineHeight = Math.round(tam * 1.35); }
  if (centro) extra.textAlign = "center";
  if (num) extra.fontVariant = ["tabular-nums"];
  return <Text {...resto} style={[base, extra, style]}>{children}</Text>;
}

/** <b> dentro de texto */
export const B = ({ children, cor, cls, style }: { children: React.ReactNode; cor?: string; cls?: string | null; style?: StyleProp<TextStyle> }) => {
  const t = useTema();
  return <Text style={[{ fontWeight: "600" }, cls ? { color: corClasse(t, cls) } : null, cor ? { color: cor } : null, style]}>{children}</Text>;
};

// ---------------------------------------------------------------- blur de valores
/** estilo que borra um texto (modo privado / carregando) em cada plataforma */
function estiloBorrado(cor: string, raio: number): TextStyle {
  if (Platform.OS === "web") return { filter: `blur(${raio}px)`, userSelect: "none" } as any;
  return { color: "transparent", textShadowColor: cor, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: raio + 3 };
}

/** Dinheiro do usuário (.rs): borra no modo privado e no carregamento inicial. */
export function Rs({ children, style, cls, cor, peso, tam, ...resto }: TProps) {
  const t = useTema();
  const privado = useApp((s) => s.privado);
  const veu = useApp((s) => s.carregandoDados);
  const base = corClasse(t, cls) || cor || ((style as any) && (style as any).color) || t.cores.ink;
  const b = privado || veu;
  return (
    <T {...resto} cls={cls} cor={cor} peso={peso} tam={tam} num
      style={[style, b ? estiloBorrado(base, privado ? 9 : 8) : null, veu && !privado ? { opacity: 0.65 } : null]}>
      {children}
    </T>
  );
}

/** Número que só borra durante o carregamento inicial (kpi dd, td.n, .num). */
export function Num({ children, style, cls, cor, ...resto }: TProps) {
  const t = useTema();
  const veu = useApp((s) => s.carregandoDados);
  const base = corClasse(t, cls) || cor || t.cores.ink;
  return (
    <T {...resto} cls={cls} cor={cor} num style={[style, veu ? [estiloBorrado(base, 8), { opacity: 0.65 }] : null]}>
      {children}
    </T>
  );
}

/** fmt.brl do site: o texto em reais, marcado como dinheiro do usuário */
export const brl = (v: number | null | undefined, casas = 2) => FC.fmt.brlTexto(v, casas);

/** Valor que conta até o alvo (data-conta) — 1,1 s com ease-out. */
export function Conta({ valor, modo = "brl", casas = 2, ...resto }: TProps & { valor: number; modo?: "brl" | "int" | "num"; casas?: number }) {
  const veu = useApp((s) => s.carregandoDados);
  const [v, setV] = useState(valor);
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    if (!FC.ok(valor) || veu || anterior.current === valor) { setV(valor); anterior.current = valor; return; }
    anterior.current = valor;
    const t0 = Date.now(), dur = 1100;
    let raf = 0;
    const passo = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      setV(valor * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor, veu]);
  const txt = modo === "brl" ? FC.fmt.brlTexto(v) : modo === "int" ? FC.fmt.int(v) : FC.fmt.num(v, casas);
  return modo === "brl" ? <Rs {...resto}>{txt}</Rs> : <Num {...resto}>{txt}</Num>;
}

// ---------------------------------------------------------------- página
export function Cabecalho({ titulo, sub, direita }: { titulo: React.ReactNode; sub?: React.ReactNode; direita?: React.ReactNode }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: t.espaco.e3, marginBottom: t.espaco.e4 }}>
      <View style={{ flexShrink: 1 }}>
        <T v="h1" accessibilityRole="header">{titulo}</T>
        {sub ? <T style={{ color: t.cores.ink2, fontSize: 15, marginTop: 4 }}>{sub}</T> : null}
      </View>
      {direita ? <View style={{ marginLeft: "auto", flexDirection: "row", gap: t.espaco.e2, flexWrap: "wrap" }}>{direita}</View> : null}
    </View>
  );
}

export function Secao({ titulo, sub, direita, children, style, topo = true }: {
  titulo?: React.ReactNode; sub?: React.ReactNode; direita?: React.ReactNode; children?: React.ReactNode;
  style?: StyleProp<ViewStyle>; topo?: boolean;
}) {
  const t = useTema();
  return (
    <View style={[{ marginTop: topo ? t.espaco.e5 : 0 }, style]}>
      {titulo || sub || direita ? (
        // título e subtítulo quebram juntos à esquerda; a ação fica presa ao título, à direita
        // (antes ela caía sozinha numa linha quando o subtítulo era longo)
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: t.espaco.e3, marginBottom: t.espaco.e3 }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: t.espaco.e3, rowGap: 4 }}>
            {titulo ? <T v="h2" accessibilityRole="header">{titulo}</T> : null}
            {sub ? <T v="sub">{sub}</T> : null}
          </View>
          {direita ? <View style={{ flexShrink: 0, flexDirection: "row", gap: t.espaco.e2, alignItems: "center", marginTop: -4 }}>{direita}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Cartao({ children, style, onPress, semPad, destaque }: {
  children?: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; semPad?: boolean; destaque?: boolean;
}) {
  const t = useTema();
  const { estreito } = useMedidas();
  const base: ViewStyle = {
    backgroundColor: t.cores.bg2, borderRadius: t.raios.r, borderWidth: 1, borderColor: destaque ? t.cores.acento : t.cores.linha,
    padding: semPad ? 0 : estreito ? 16 : t.espaco.e4, overflow: semPad ? "hidden" : undefined,
    boxShadow: t.cores.sombra,
  } as any;
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [base, pressed ? { transform: [{ scale: 0.99 }] } : null, style]}>
      {children}
    </Pressable>
  );
}

/** .grade: colunas responsivas como no CSS */
export function Grade({ colunas = 2, children, style, gap }: { colunas?: 1 | 2 | 3 | 4 | "auto"; children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  const t = useTema();
  const { celular, estreito, largura } = useMedidas();
  let n: number;
  if (colunas === "auto") n = Math.max(1, Math.floor((Math.min(largura, 1180) - 48) / 236));
  else if (colunas === 4) n = celular ? 2 : 4;
  else if (colunas === 3) n = celular ? 1 : 3;
  else if (colunas === 2) n = estreito ? 1 : 2;
  else n = 1;
  const g = gap ?? t.espaco.e3;
  const filhos = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: g }, style]}>
      {filhos.map((f, i) => (
        <View key={i} style={{ flexBasis: n === 1 ? "100%" : `${100 / n - 1}%` as any, flexGrow: 1, minWidth: 0 }}>{f}</View>
      ))}
    </View>
  );
}

export function Linha({ children, gap, entre, quebra, alinhar = "center", style }: {
  children: React.ReactNode; gap?: number; entre?: boolean; quebra?: boolean; alinhar?: ViewStyle["alignItems"]; style?: StyleProp<ViewStyle>;
}) {
  const t = useTema();
  return (
    <View style={[{ flexDirection: "row", alignItems: alinhar, gap: gap ?? t.espaco.e3 },
      entre ? { justifyContent: "space-between" } : null, quebra ? { flexWrap: "wrap" } : null, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- indicadores
export function Kpis({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  const { estreito } = useMedidas();
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", rowGap: estreito ? t.espaco.e3 : t.espaco.e4, columnGap: estreito ? t.espaco.e4 : t.espaco.e5 }, style]}>
      {children}
    </View>
  );
}

export function Kpi({ rotulo, valor, peq, pequeno, cls, dinheiro, ajuda, children }: {
  rotulo: React.ReactNode; valor?: React.ReactNode; peq?: React.ReactNode; pequeno?: boolean; cls?: string | null;
  dinheiro?: boolean; ajuda?: string; children?: React.ReactNode;
}) {
  const t = useTema();
  const tam = pequeno ? 19 : 24;
  const estiloValor: TextStyle = { fontSize: tam, lineHeight: tam * 1.25, fontWeight: "600", letterSpacing: -tam * 0.025 };
  const Comp = dinheiro ? Rs : Num;
  return (
    <View style={{ minWidth: 0 }}>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 2 }}>
        <T v="rot" style={{ fontWeight: "400" }}>{rotulo}</T>
        {ajuda ? <Ajuda texto={ajuda} /> : null}
      </View>
      {valor != null ? (typeof valor === "string" || typeof valor === "number"
        ? <Comp cls={cls} style={estiloValor}>{valor}</Comp>
        : <View>{valor}</View>) : null}
      {children}
      {peq ? <T style={{ fontSize: 12.5, lineHeight: 17, color: t.cores.ink2, marginTop: 1 }}>{peq}</T> : null}
    </View>
  );
}
/** o número grande de um Kpi, para compor com outros nós */
export function KpiValor({ children, pequeno, cls, dinheiro }: { children: React.ReactNode; pequeno?: boolean; cls?: string | null; dinheiro?: boolean }) {
  const tam = pequeno ? 19 : 24;
  const Comp = dinheiro ? Rs : Num;
  return <Comp cls={cls} style={{ fontSize: tam, lineHeight: tam * 1.25, fontWeight: "600", letterSpacing: -tam * 0.025 }}>{children}</Comp>;
}

export function Chip({ children, onPress, icone }: { children: React.ReactNode; onPress?: () => void; icone?: React.ReactNode }) {
  const t = useTema();
  const corpo = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 980, backgroundColor: t.cores.campo }}>
      {icone}
      {typeof children === "string" ? <T style={{ fontSize: 13, color: t.cores.ink2 }}>{children}</T> : children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{corpo}</Pressable> : corpo;
}

export function Pilula({ cor, children, semPonto }: { cor?: string | null; children: React.ReactNode; semPonto?: boolean }) {
  const t = useTema();
  const [fg, bg] = corEstado(t, cor);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
      paddingVertical: 3, paddingLeft: semPonto ? 10 : 8, paddingRight: 10, borderRadius: 980, backgroundColor: bg }}>
      {semPonto ? null : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: fg }} />}
      <T style={{ fontSize: 12.5, lineHeight: 17, fontWeight: "500", color: fg }} numberOfLines={1}>{children}</T>
    </View>
  );
}

export function Ponto({ cor, tam = 10, style }: { cor?: string | null; tam?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  const c = cor && /^(#|rgb|var\()/.test(cor) ? corCss(t.cores, cor) : corPonto(t, cor);
  return <View style={[{ width: tam, height: tam, borderRadius: tam / 2, backgroundColor: c as string }, style]} />;
}

/** Anel do score: arco que se fecha até o valor (1 s, curva mola). */
export function Anel({ score, cor, grande }: { score: number | null | undefined; cor?: string | null; grande?: boolean }) {
  const t = useTema();
  const tam = grande ? 84 : 48;
  const r = 20, c = 2 * Math.PI * r;
  const v = FC.ok(score) ? Math.max(0, Math.min(100, score as number)) : 0;
  const alvo = c * (1 - v / 100);
  const [off, setOff] = useState(c);
  useEffect(() => {
    // anima à mão (o círculo animado do svg gera avisos no web)
    const de = c, t0 = Date.now(), dur = 1000;
    const curva = Easing.bezier(0.32, 0.72, 0, 1);
    let raf = 0;
    const passo = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      setOff(de + (alvo - de) * curva(p));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, c]);
  const corArco = ({ verde: t.cores.verde, amarelo: t.cores.s3, vermelho: t.cores.vermelho } as any)[cor || ""] || t.cores.ink3;
  return (
    <View style={{ width: tam, height: tam }} accessibilityRole="image" accessibilityLabel={`score ${FC.ok(score) ? Math.round(score as number) : "sem dados"}`}>
      <Svg width={tam} height={tam} viewBox="0 0 48 48" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={24} cy={24} r={r} fill="none" stroke={t.cores.campo} strokeWidth={5} />
        <Circle cx={24} cy={24} r={r} fill="none" stroke={corArco} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${c.toFixed(2)}`} strokeDashoffset={off} />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Num style={{ fontSize: grande ? 26 : 14, fontWeight: "600", letterSpacing: -0.3 }}>{FC.ok(score) ? Math.round(score as number) : "—"}</Num>
      </View>
    </View>
  );
}

/** .trilha: barra de progresso */
export function Trilha({ pct, cor, altura = 6 }: { pct: number; cor?: string; altura?: number }) {
  const t = useTema();
  return (
    <View style={{ height: altura, borderRadius: altura / 2, backgroundColor: t.cores.campo, overflow: "hidden" }}>
      <Estica pct={Math.max(0, Math.min(100, pct))} style={{ height: "100%", borderRadius: altura / 2, backgroundColor: corCss(t.cores, cor) || t.cores.acento }} />
    </View>
  );
}

/** largura que estica da esquerda (animação "estica" .9s mola) */
export function Estica({ pct, style, atraso = 0 }: { pct: number; style?: StyleProp<ViewStyle>; atraso?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 900, delay: atraso, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }).start();
  }, [a, atraso]);
  const largura = a.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${pct}%`] });
  return <Animated.View style={[style, { width: largura }]} />;
}

/** barra de alocação: o que você tem × o traço da meta */
export function BarraAlocacao({ pct, alvo, escala, cor }: { pct: number; alvo: number | null; escala: number; cor: string }) {
  const t = useTema();
  const w = Math.min(100, (pct / escala) * 100), m = alvo == null ? null : Math.min(100, (alvo / escala) * 100);
  return (
    <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: t.cores.campo }}>
      <Estica pct={w} style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 5, backgroundColor: corCss(t.cores, cor) }} />
      {m == null ? null : <View style={{ position: "absolute", top: -5, bottom: -5, width: 2, borderRadius: 1, backgroundColor: t.cores.ink, opacity: 0.75, left: `${m}%` as any, marginLeft: -1 }} />}
    </View>
  );
}

/** FC.graficos.composicao: faixa com as partes */
export function Composicao({ partes, altura = 14 }: { partes: Array<{ valor: number; cor: string }>; altura?: number }) {
  const t = useTema();
  const total = partes.reduce((s, p) => s + Math.max(0, p.valor), 0) || 1;
  return (
    <View style={{ flexDirection: "row", height: altura, borderRadius: altura / 2, overflow: "hidden", gap: 2 }}>
      {partes.map((p, i) => <View key={i} style={{ flex: Math.max(0, p.valor) / total, backgroundColor: corCss(t.cores, p.cor) }} />)}
    </View>
  );
}

export function Legenda({ itens }: { itens: Array<{ cor: string; rotulo: React.ReactNode; tipo?: "linha" | "quadrado" | "tracejado" | "pontilhado" | "banda" }> }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6, columnGap: 18, marginTop: 12 }}>
      {itens.map((it, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          {it.tipo === "quadrado" ? <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: corCss(t.cores, it.cor) }} />
            : it.tipo === "banda" ? <View style={{ width: 16, height: 10, borderRadius: 2, backgroundColor: corCss(t.cores, it.cor), opacity: 0.25 }} />
            : it.tipo === "tracejado" || it.tipo === "pontilhado" ? (
              <View style={{ width: 16, height: 3, flexDirection: "row", gap: it.tipo === "tracejado" ? 4 : 3 }}>
                {[0, 1, 2].map((k) => <View key={k} style={{ width: it.tipo === "tracejado" ? 5 : 2, height: 3, borderRadius: 1, backgroundColor: corCss(t.cores, it.cor) }} />)}
              </View>)
            : <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: corCss(t.cores, it.cor) }} />}
          <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{it.rotulo}</T>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- listas
export function Lista({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTema();
  const filhos = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ backgroundColor: t.cores.bg2, borderRadius: t.raios.r, borderWidth: 1, borderColor: t.cores.linha, overflow: "hidden", boxShadow: t.cores.sombra } as any, style]}>
      {filhos.map((f, i) => (
        <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: t.cores.linha } : null}>{f}</View>
      ))}
    </View>
  );
}

export function Item({ esquerda, titulo, detalhe, valores, direita, chevron, onPress, children, alinhar = "center", detalheLinhas = 1 }: {
  esquerda?: React.ReactNode; titulo?: React.ReactNode; detalhe?: React.ReactNode; valores?: React.ReactNode; direita?: React.ReactNode;
  chevron?: boolean; onPress?: () => void; children?: React.ReactNode; alinhar?: ViewStyle["alignItems"]; detalheLinhas?: number;
}) {
  const t = useTema();
  const { estreito } = useMedidas();
  const miolo = (
    <>
      {esquerda}
      <View style={{ flex: 1, minWidth: 0 }}>
        {titulo != null ? (typeof titulo === "string"
          ? <T style={{ fontWeight: "600", fontSize: 15, letterSpacing: -0.22 }} numberOfLines={1}>{titulo}</T>
          : titulo) : null}
        {detalhe != null ? (typeof detalhe === "string"
          ? <T style={{ fontSize: 13, color: t.cores.ink2 }} numberOfLines={detalheLinhas}>{detalhe}</T>
          : detalhe) : null}
        {children}
      </View>
      {valores ? <View style={{ alignItems: "flex-end" }}>{valores}</View> : null}
      {direita}
      {chevron ? <Icone nome="chevron" tam={18} cor={t.cores.ink3} /> : null}
    </>
  );
  const estilo: ViewStyle = { flexDirection: "row", alignItems: alinhar, gap: t.espaco.e3, paddingVertical: estreito ? 12 : 14, paddingHorizontal: estreito ? 14 : t.espaco.e4, minHeight: 60 };
  if (!onPress) return <View style={estilo}>{miolo}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed, hovered }: any) => [estilo, pressed ? { backgroundColor: t.cores.campo } : hovered ? { backgroundColor: t.cores.bg3 } : null]}>
      {miolo}
    </Pressable>
  );
}
/** .valores: número em negrito e linha menor */
export function Valores({ b, small, cls, dinheiro = true, smallCls }: { b: React.ReactNode; small?: React.ReactNode; cls?: string | null; dinheiro?: boolean; smallCls?: string | null }) {
  const t = useTema();
  const Comp = dinheiro ? Rs : Num;
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Comp cls={cls} style={{ fontWeight: "600", fontSize: 15 }}>{b}</Comp>
      {small != null ? <Num cls={smallCls} style={{ fontSize: 12.5, color: smallCls ? undefined : t.cores.ink2 }}>{small}</Num> : null}
    </View>
  );
}
export function GrupoTitulo({ children }: { children: React.ReactNode }) {
  const t = useTema();
  return <View style={{ paddingVertical: 10, paddingHorizontal: t.espaco.e4, backgroundColor: t.cores.bg3 }}><T style={{ fontSize: 12.5, color: t.cores.ink2, fontWeight: "500" }}>{children}</T></View>;
}

/** C.indicadores: "P/L 8,2 · DY 9,1%" */
export function Indicadores({ ativo }: { ativo: any }) {
  const t = useTema();
  const d = (ativo.destaques || []) as any[];
  if (!d.length) return null;
  return (
    <T style={{ fontSize: 12.5, color: t.cores.ink2 }} numberOfLines={1}>
      {d.map((m, i) => (
        <Text key={i}>
          {i ? <Text style={{ color: t.cores.ink3 }}>{"  ·  "}</Text> : null}
          {m.rotulo_curto} <Text style={{ color: t.cores.ink, fontWeight: "600" }}>{FC.fmt.metrica(m.valor, m.unidade)}</Text>
        </Text>
      ))}
    </T>
  );
}

// ---------------------------------------------------------------- botões
export type VarBotao = "primario" | "sec" | "perigo" | "texto";
export function Botao({ children, onPress, variante = "primario", pequeno, cheio, icone, carregando, desabilitado, style, rotuloA11y }: {
  children?: React.ReactNode; onPress?: () => any; variante?: VarBotao; pequeno?: boolean; cheio?: boolean; icone?: NomeIcone;
  carregando?: boolean; desabilitado?: boolean; style?: StyleProp<ViewStyle>; rotuloA11y?: string;
}) {
  const t = useTema();
  const [rodando, setRodando] = useState(false);
  const ocupado = carregando || rodando;
  const [bg, fg] = variante === "sec" ? [t.cores.campo, t.cores.ink]
    : variante === "perigo" ? [t.cores.vermelhoSuave, t.cores.vermelho]
    : variante === "texto" ? ["transparent", t.cores.acento]
    : [t.cores.acento, "#fff"];
  const aperta = async () => {
    if (!onPress || ocupado) return;
    const r = onPress();
    if (r && typeof r.then === "function") {
      setRodando(true);
      try { await r; } finally { setRodando(false); }
    }
  };
  return (
    <Pressable onPress={aperta} disabled={desabilitado || ocupado} accessibilityRole="button" accessibilityLabel={rotuloA11y}
      hitSlop={pequeno && (Platform.OS !== "web" || toque) ? 5 : undefined}
      accessibilityState={{ disabled: !!desabilitado, busy: !!ocupado }}
      style={({ pressed, hovered }: any) => [{
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        minHeight: pequeno ? 34 : 44, paddingHorizontal: variante === "texto" ? 10 : pequeno ? 14 : 22, borderRadius: 980,
        backgroundColor: hovered && variante === "texto" ? t.cores.acentoSuave : hovered && variante === "sec" ? t.cores.linha2 : bg,
        opacity: desabilitado ? 0.38 : 1, alignSelf: cheio ? "stretch" : "flex-start",
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }, style]}>
      {ocupado ? <ActivityIndicator size="small" color={fg} /> : (
        <>
          {icone ? <Icone nome={icone} tam={pequeno ? 15 : 16} cor={fg} /> : null}
          {typeof children === "string"
            ? <Text style={{ color: fg, fontSize: pequeno ? 13.5 : 15, fontWeight: "500", letterSpacing: -0.15 }} numberOfLines={1}>{children}</Text>
            : children}
        </>
      )}
    </Pressable>
  );
}

/** .icone-bt: botão redondo só com ícone */
export function BotaoIcone({ nome, onPress, rotulo, tam = 19, cor, girando, children, style }: {
  nome: NomeIcone; onPress?: () => void; rotulo: string; tam?: number; cor?: string; girando?: boolean; children?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const t = useTema();
  const { estreito } = useMedidas();
  const d = estreito ? 34 : 36;
  // o círculo continua de 34–36, mas o toque alcança 44 pt (accessibility.md › Mobility)
  const folga = Platform.OS === "web" && !toque ? 0 : Math.ceil((44 - d) / 2);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo} hitSlop={folga}
      style={({ pressed, hovered }: any) => [{ width: d, height: d, borderRadius: d / 2, alignItems: "center", justifyContent: "center",
        backgroundColor: pressed || hovered ? t.cores.campo : "transparent", transform: [{ scale: pressed ? 0.9 : 1 }] }, style]}>
      <Gira ativo={!!girando}><Icone nome={nome} tam={tam} cor={cor || t.cores.ink2} /></Gira>
      {children}
    </Pressable>
  );
}

export function Gira({ ativo, children }: { ativo: boolean; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ativo) { a.stopAnimation(); a.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }));
    loop.start();
    return () => loop.stop();
  }, [ativo, a]);
  const rot = a.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={{ transform: [{ rotate: rot }] }}>{children}</Animated.View>;
}

// ---------------------------------------------------------------- mensagens
export function Mensagem({ tipo = "info", icone, children, style }: {
  tipo?: "erro" | "ok" | "info" | "alerta"; icone?: NomeIcone | null; children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const t = useTema();
  const [bg, fg] = tipo === "erro" ? [t.cores.vermelhoSuave, t.cores.vermelho]
    : tipo === "ok" ? [t.cores.verdeSuave, t.cores.verde]
    : tipo === "alerta" ? [t.cores.amareloSuave, t.cores.ink]
    : [t.cores.acentoSuave, t.cores.ink];
  return (
    <View accessibilityRole={tipo === "erro" ? "alert" : undefined}
      style={[{ borderRadius: t.raios.sm, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: bg }, style]}>
      {icone ? <View style={{ marginTop: 2 }}><Icone nome={icone} tam={18} cor={fg} /></View> : null}
      <View style={{ flex: 1 }}>
        {typeof children === "string" ? <T style={{ fontSize: 14, lineHeight: 20, color: fg }}>{children}</T> : children}
      </View>
    </View>
  );
}

export function Roda({ tam = 28 }: { tam?: number }) {
  const t = useTema();
  return <ActivityIndicator size={tam > 20 ? "large" : "small"} color={t.cores.acento} />;
}

// estados vazios: ícone da família do app num quadrado suave
const ICONE_VAZIO: Record<string, NomeIcone> = { "🧾": "recibo", "🧭": "bussola", "💼": "carteira", "🎁": "presente", "💸": "moeda", "📅": "calendario",
  "📈": "projecoes", "🏦": "renda", "🐂": "boi", "🐄": "boi", "⚖️": "balanca", "🧺": "cesta", "📊": "ativos" };
export function Vazio({ icone, titulo, texto, acao }: { icone: string; titulo: string; texto?: React.ReactNode; acao?: React.ReactNode }) {
  const t = useTema();
  const nome = (ICONE_VAZIO[icone] || icone) as NomeIcone;
  return (
    <View style={{ paddingVertical: t.espaco.e5, paddingHorizontal: t.espaco.e4, alignItems: "center" }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12, backgroundColor: t.cores.acentoSuave }}>
        <Icone nome={nome} tam={26} cor={t.cores.acento} />
      </View>
      <T style={{ fontSize: 19, fontWeight: "600", marginBottom: 6 }} centro>{titulo}</T>
      {texto ? <T v="p" centro style={{ marginBottom: 16, maxWidth: 520 }}>{texto}</T> : null}
      {acao}
    </View>
  );
}

/** <details>: "Ver detalhes" que abre o número técnico */
export function Detalhes({ rotulo = "Ver detalhes", children, tam = 14, style, inicial = false }: {
  rotulo?: string; children: React.ReactNode; tam?: number; style?: StyleProp<ViewStyle>; inicial?: boolean;
}) {
  const t = useTema();
  const [aberto, setAberto] = useState(inicial);
  return (
    <View style={[{ marginTop: t.espaco.e3 }, style]}>
      <Pressable onPress={() => setAberto(!aberto)} accessibilityRole="button" accessibilityState={{ expanded: aberto }}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
        <View style={{ transform: [{ rotate: aberto ? "90deg" : "0deg" }] }}><Icone nome="chevron" tam={13} cor={t.cores.acento} /></View>
        <T style={{ color: t.cores.acento, fontSize: tam }}>{rotulo}</T>
      </Pressable>
      {aberto ? <View style={{ marginTop: t.espaco.e3 }}>{children}</View> : null}
    </View>
  );
}

/** "?" com a explicação (tooltip ao tocar) */
export function Ajuda({ texto }: { texto: string }) {
  const t = useTema();
  const [aberto, setAberto] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setAberto(!aberto)} hitSlop={13} accessibilityRole="button" accessibilityLabel={texto}
        style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: t.cores.campo, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: t.cores.ink2 }}>?</Text>
      </Pressable>
      {aberto ? (
        <Pressable onPress={() => setAberto(false)}
          style={{ position: "absolute", bottom: 24, left: -110, width: 240, zIndex: 20, padding: 10, paddingHorizontal: 12, borderRadius: 12,
            backgroundColor: t.cores.vidroForte, borderWidth: 1, borderColor: t.cores.linha, boxShadow: t.cores.sombra } as any}>
          <T style={{ fontSize: 12, lineHeight: 17, color: t.cores.ink }}>{texto}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- tabela
export interface Celula { v: React.ReactNode; leg?: React.ReactNode; n?: boolean; cls?: string | null; dinheiro?: boolean; peso?: TextStyle["fontWeight"] }
export function Tabela({ cabecas, linhas, minimo = 560, destaque, onLinha }: {
  cabecas: Array<{ t: string; n?: boolean; largura?: number }>;
  linhas: Array<Array<Celula | React.ReactNode> | { celulas: Array<Celula | React.ReactNode>; estilo?: "mediana" | "meu" | "apagado" | "tem-cota" }>;
  minimo?: number; destaque?: (i: number) => boolean; onLinha?: (i: number) => void;
}) {
  const t = useTema();
  const { estreito } = useMedidas();
  const pad = estreito ? 10 : 14;
  const larg = (k: number) => cabecas[k].largura ?? (k === 0 ? 150 : 110);
  const celula = (c: any, k: number, estilo?: string) => {
    const n = cabecas[k]?.n;
    const conteudo = c && typeof c === "object" && "v" in c ? (c as Celula) : { v: c } as Celula;
    const Comp = conteudo.dinheiro ? Rs : n ? Num : T;
    return (
      <View key={k} style={{ width: larg(k), flexGrow: k === 0 ? 1 : 0, paddingHorizontal: pad, paddingVertical: estreito ? 11 : 13, alignItems: n ? "flex-end" : "flex-start", justifyContent: "center" }}>
        {typeof conteudo.v === "string" || typeof conteudo.v === "number"
          ? <Comp cls={conteudo.cls} style={{ fontSize: estilo === "mediana" ? 13 : 14, fontWeight: conteudo.peso, color: estilo === "mediana" && !conteudo.cls ? t.cores.ink2 : undefined, textAlign: n ? "right" : "left" }}>{conteudo.v}</Comp>
          : conteudo.v}
        {conteudo.leg != null ? <T style={{ fontSize: 12, color: t.cores.ink2, textAlign: n ? "right" : "left" }}>{conteudo.leg}</T> : null}
      </View>
    );
  };
  const total = cabecas.reduce((s, _c, k) => s + larg(k), 0);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: "100%" }}>
      <View style={{ minWidth: Math.max(minimo, total), flexGrow: 1 }}>
        <View style={{ flexDirection: "row", backgroundColor: t.cores.bg3, borderBottomWidth: 1, borderBottomColor: t.cores.linha }}>
          {cabecas.map((c, k) => (
            <View key={k} style={{ width: larg(k), flexGrow: k === 0 ? 1 : 0, paddingHorizontal: pad, paddingVertical: 12, alignItems: c.n ? "flex-end" : "flex-start" }}>
              <T style={{ fontSize: 12.5, fontWeight: "500", color: t.cores.ink2 }} numberOfLines={1}>{c.t}</T>
            </View>
          ))}
        </View>
        {linhas.map((l: any, i) => {
          const cel = Array.isArray(l) ? l : l.celulas;
          const estilo = Array.isArray(l) ? undefined : l.estilo;
          const fundo = estilo === "mediana" ? t.cores.bg3 : estilo === "tem-cota" ? t.cores.acentoSuave : undefined;
          const linhaV = (
            <View style={{ flexDirection: "row", borderTopWidth: i ? 1 : 0, borderTopColor: t.cores.linha, backgroundColor: fundo,
              opacity: estilo === "apagado" ? 0.5 : 1, borderLeftWidth: estilo === "meu" || (destaque && destaque(i)) ? 3 : 0, borderLeftColor: t.cores.acento }}>
              {cel.map((c: any, k: number) => celula(c, k, estilo))}
            </View>
          );
          return onLinha ? (
            <Pressable key={i} onPress={() => onLinha(i)} style={({ hovered }: any) => (hovered ? { backgroundColor: t.cores.bg3 } : null)}>{linhaV}</Pressable>
          ) : <View key={i}>{linhaV}</View>;
        })}
      </View>
    </ScrollView>
  );
}

/** separador hr.sep */
export function Separador() {
  const t = useTema();
  return <View style={{ height: 1, backgroundColor: t.cores.linha, marginVertical: t.espaco.e4 }} />;
}

/** <code>/<kbd> */
export function Codigo({ children }: { children: React.ReactNode }) {
  const t = useTema();
  return <Text style={{ fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, SF Mono, Menlo, monospace" }), fontSize: 12.5, backgroundColor: t.cores.campo, borderRadius: 5, paddingHorizontal: 6 }}>{children}</Text>;
}
