/* Gráficos — os MESMOS SVGs do graficos.js do site.
 *
 * FC.graficos.linhas/colunas/regua devolvem um marcador <div data-g="gN">; a
 * função de desenho fica em FC.graficos.registro[gN]. Aqui:
 *   1. medimos a largura real (onLayout) e chamamos desenha(largura);
 *   2. trocamos as classes CSS do SVG (l1, grade-l, trilho…) pelos atributos
 *      que o app.css daria, e as var(--x) pelas cores do tema;
 *   3. desenhamos com react-native-svg;
 *   4. refazemos o hover/toque: cursor, pontos e a dica com os valores.
 * sparkline e faixa52 já devolvem o <svg> pronto: só passam pelo passo 2. */
import React, { useMemo, useState } from "react";
import { Platform, View, Text, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Circle, SvgXml } from "react-native-svg";
import { corCss, useTema, type Tema } from "../tema";
import { useApp } from "../estado/app";
import { T } from "./kit";
import FC from "../nucleo";

type Attrs = Record<string, string | number>;
const FONTE_SVG = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

// regras do app.css por tipo de svg (classe da raiz) e classe do elemento
const REGRAS: Record<string, (c: Tema["cores"]) => Record<string, Attrs>> = {
  grafico: (c) => ({
    eixo: { stroke: c.linha, "stroke-width": 1 },
    "grade-l": { stroke: c.linha, "stroke-width": 1, "stroke-dasharray": "2 4" },
    l1: { fill: "none", stroke: c.s1, "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" },
    l2: { fill: "none", stroke: c.s2, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" },
    l3: { fill: "none", stroke: c.s3, "stroke-width": 2, "stroke-linejoin": "round" },
    l4: { fill: "none", stroke: c.s4, "stroke-width": 2, "stroke-linejoin": "round" },
    lref: { fill: "none", stroke: c.sref, "stroke-width": 1.8, "stroke-dasharray": "5 4", "stroke-linejoin": "round" },
    lref2: { fill: "none", stroke: c.sref, "stroke-width": 1.5, "stroke-dasharray": "1 3", "stroke-linecap": "round" },
    lselic: { fill: "none", stroke: c.s3, "stroke-width": 2, "stroke-dasharray": "6 4", "stroke-linejoin": "round" },
    libov: { fill: "none", stroke: c.s4, "stroke-width": 2, "stroke-dasharray": "6 4", "stroke-linejoin": "round" },
    area: { fill: "url(#grad-s1)", opacity: 0.9 },
    banda: { fill: c.s1, "fill-opacity": 0.14 },
    banda2: { fill: c.s1, "fill-opacity": 0.16 },
    alvo: { stroke: c.verde, "stroke-width": 1.5, "stroke-dasharray": "6 4" },
    "alvo-rot": { fill: c.verde, "font-size": 11, "font-weight": 600 },
    zero: { stroke: c.ink3, "stroke-width": 1 },
    col: { fill: c.s1 },
    cursor: { opacity: 0 },
    "ponto-hover": { opacity: 0 },
    // sparkline
    "anel-r": { fill: c.bg2 },
    ponta: { fill: c.s1 },
  }),
  regua: (c) => ({
    trilho: { fill: c.campo },
    "faixa-boa": { fill: c.verde, opacity: 0.28 },
    direcao: { "font-size": 10.5, fill: c.ink3 },
    tick: { stroke: c.ink3, "stroke-width": 1 },
    rot: { "font-size": 10.5, fill: c.ink2 },
    agulha: { stroke: c.ink, "stroke-width": 1.5 },
    "anel-r": { fill: c.bg2 },
    agora: { fill: c.ink },
    "agora-alt": { fill: "none", stroke: c.ink2, "stroke-width": 1.5 },
    hoje: { "font-size": 10.5, fill: c.ink, "font-weight": 600 },
  }),
  faixa52: (c) => ({
    trilho: { fill: c.campo },
    agora: { fill: c.acento },
  }),
};

const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, x) => x.toUpperCase());

/** troca var(--x) pelas cores do tema */
function trocaVars(svg: string, c: Tema["cores"]) {
  return svg.replace(/var\(--([a-z0-9-]+)\)/g, (_m, nome) => (c as any)[camel(nome)] ?? "#888");
}

/** aplica as classes como atributos (o que o CSS faria) */
export function estilizaSvg(svg: string, t: Tema, privado: boolean): string {
  let s = trocaVars(svg, t.cores);
  const raiz = /<svg[^>]*class="([^"]*)"/.exec(s);
  const tipo = raiz && raiz[1].includes("regua") ? "regua" : raiz && raiz[1].includes("faixa52") ? "faixa52" : "grafico";
  // seletores por tag do app.css (.spark polyline): a linha da sparkline não tem classe de cor
  const porTag: Record<string, Attrs> = raiz && /\bspark\b/.test(raiz[1])
    ? { polyline: { fill: "none", stroke: t.cores.s1, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" } } : {};
  const regras = REGRAS[tipo](t.cores);
  const textoPadrao: Attrs = tipo === "faixa52" || tipo === "regua"
    ? { "font-size": 10.5, fill: t.cores.ink3 } : { "font-size": 11, fill: t.cores.ink3 };
  // <tag ... class="a b" ...> → atributos
  s = s.replace(/<(\w+)([^>]*?)\sclass="([^"]*)"([^>]*?)(\/?)>/g, (_m, tag, antes, classes, depois, fecha) => {
    if (tag === "svg") return `<${tag}${antes}${depois}${fecha}>`;
    const attrs: Attrs = tag === "text" ? { ...textoPadrao } : { ...(porTag[tag] || {}) };
    for (const c of String(classes).split(/\s+/)) Object.assign(attrs, regras[c] || {});
    const existentes = antes + depois;
    const extra = Object.entries(attrs)
      .filter(([k]) => !new RegExp(`\\s${k}=`).test(existentes))
      .map(([k, v]) => ` ${k}="${v}"`).join("");
    const marca = tag === "text" && /\brs\b/.test(classes) && privado ? ' data-rs="1"' : "";
    return `<${tag}${antes}${depois}${extra}${marca}${fecha}>`;
  });
  // no web, a fonte do sistema (o padrão do <svg> no navegador é serifada)
  if (Platform.OS === "web") s = s.replace(/<text\b/g, `<text font-family='${FONTE_SVG}'`);
  // textos sem classe recebem o padrão do .grafico text
  s = s.replace(/<text(?![^>]*\sfill=)([^>]*)>/g, (_m, a) => `<text${a} font-size="${textoPadrao["font-size"]}" fill="${textoPadrao.fill}">`);
  // modo privado: eixo em reais vira pontos
  if (privado) s = s.replace(/(<text[^>]*data-rs="1"[^>]*>)([^<]*)(<\/text>)/g, (_m, a, txt, b) => a + "•".repeat(Math.min(6, String(txt).length)) + b);
  // style="--i:3;fill:#x" → o react-native-svg ignora a custom property
  s = s.replace(/style="([^"]*)"/g, (_m, st) => `style="${String(st).split(";").filter((d) => d.trim() && !d.trim().startsWith("--")).join(";")}"`);
  return s;
}

// os data-* e o aria-* do site saem do SVG (o react-native-svg web vira em props inválidas
// no DOM, como ariaLabel); o rótulo acessível vai para o contêiner
const semDados = (svg: string) => svg.replace(/\s(?:data|aria)-[a-z-]+="[^"]*"/g, "").replace(/\srole="[^"]*"/g, "");
const rotuloDe = (svg: string) => /\saria-label="([^"]*)"/.exec(svg)?.[1];

const FORMATOS: Record<string, (v: number) => string> = {
  brl: (v) => FC.fmt.brlTexto(v), brlCheio: (v) => FC.fmt.brlTexto(v), pct: (v) => FC.fmt.num(v, 1) + "%",
  base100: (v) => FC.fmt.num(v, 0), int: (v) => FC.fmt.int(v), num: (v) => FC.fmt.num(v, 1),
};
const ts = (x: any) => (typeof x === "string" ? new Date(x.slice(0, 10) + "T12:00:00Z").getTime() : x);
const fmtAnos = (x: number) => (x === 0 ? "hoje" : FC.fmt.num(x, x % 1 ? 1 : 0) + (x === 1 ? " ano" : " anos"));

interface Dica { cx: number; quando: string; linhas: Array<{ nome: string; valor: string; cor?: string; privado: boolean }>; pontos?: Array<{ x: number; y: number; cor: string }> ; col?: number }

/** Desenha o marcador devolvido por FC.graficos.* (ou um <svg> pronto). */
export function Grafico({ marcador, altura: alturaFixa }: { marcador: any; altura?: number }) {
  const t = useTema();
  const privado = useApp((s) => s.privado);
  const veu = useApp((s) => s.carregandoDados);
  const html = String(marcador ?? "");
  const id = /data-g="(g\d+)"/.exec(html)?.[1];
  const minAltura = Number(/min-height:(\d+)px/.exec(html)?.[1] || alturaFixa || 0);
  const [largura, setLargura] = useState(0);
  const [dica, setDica] = useState<Dica | null>(null);

  const reg = id ? FC.graficos.registro[id] : null;
  const geo = useMemo(() => (reg && largura ? reg.desenha(largura) : null), [reg, largura]);

  if (!id) {
    if (html.trim().startsWith("<svg")) {
      const w = Number(/width="([\d.]+)"/.exec(html)?.[1] || 0), h = Number(/height="([\d.]+)"/.exec(html)?.[1] || 0);
      const rot = rotuloDe(html);
      return (
        <View accessible={!!rot} accessibilityRole={rot ? "image" : undefined} accessibilityLabel={rot}>
          <SvgXml xml={semDados(estilizaSvg(html, t, privado))} width={w} height={h} />
        </View>
      );
    }
    const texto = html.replace(/<[^>]+>/g, "").trim();
    return texto ? <T v="p">{texto}</T> : null;
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w && w !== largura) setLargura(w);
  };

  const mover = (mx: number) => {
    if (!geo || !reg) return;
    if (reg.hover) {
      const { series, y, x } = reg.hover;
      const fY = FORMATOS[y === "brl" ? "brlCheio" : y] || FORMATOS.num;
      const alvo = geo.x0 + ((mx - geo.mE) / (geo.W - geo.mE - geo.mD)) * (geo.x1 - geo.x0);
      let ref: any = null;
      const linhas: Dica["linhas"] = [], pontos: Dica["pontos"] = [];
      series.forEach((se: any) => {
        let melhor: any = null, dist = Infinity;
        for (const p of se.pontos) { const d = Math.abs(ts(p[0]) - alvo); if (d < dist && FC.ok(p[1])) { dist = d; melhor = p; } }
        if (!melhor) return;
        ref = ref || melhor;
        const cls = se.classe || "l1";
        const cor = cls === "lref" || cls === "lref2" ? t.cores.sref : cls === "lselic" ? t.cores.s3 : cls === "libov" ? t.cores.s4 : (t.cores as any)["s" + cls.slice(1)] || t.cores.s1;
        pontos!.push({ x: geo.px(melhor[0]), y: geo.py(melhor[1]), cor });
        linhas.push({ nome: se.nome || "", valor: fY(melhor[1]), cor, privado: reg.hover.privado && y.startsWith("brl") });
      });
      if (!ref) return;
      const quando = x === "anos" ? fmtAnos(ref[0]) : FC.datas.br(String(new Date(ts(ref[0])).toISOString()).slice(0, 10));
      setDica({ cx: geo.px(ref[0]), quando, linhas, pontos });
    } else if (reg.colunas) {
      const { barras, y, privado: pv } = reg.colunas;
      const fY = FORMATOS[y === "brl" ? "brlCheio" : y] || FORMATOS.num;
      const i = Math.floor((mx - geo.mE) / geo.larg);
      const b = barras[i];
      if (!b) return;
      const det = (b.detalhe || []).slice(0, 6).map(([n, v]: any) => ({ nome: n, valor: fY(v), privado: pv }));
      setDica({ cx: geo.mE + i * geo.larg + geo.larg / 2, quando: b.titulo || b.rotulo, linhas: [{ nome: "Total", valor: fY(b.valor), privado: pv }, ...det], col: i });
    }
  };

  const interativo = !!(reg && (reg.hover || reg.colunas));
  const H = reg ? reg.altura : minAltura;
  let svg = geo ? estilizaSvg(geo.svg, t, privado) : null;
  if (svg && dica && dica.col != null) {
    // coluna tocada fica a 75% (.col.hover)
    svg = svg.replace(new RegExp(`(<rect[^>]*data-i="${dica.col}"[^>]*?)(/?>)`), '$1 opacity="0.75"$2');
  }
  const rotulo = svg ? rotuloDe(svg) : undefined;
  // os data-* do site já foram usados: fora do SVG (o react-native-svg web não os aceita)
  if (svg) svg = semDados(svg);

  return (
    <View onLayout={onLayout} style={{ minHeight: H, opacity: veu ? 0.6 : 1 }} accessibilityRole={rotulo ? "image" : undefined} accessibilityLabel={rotulo}
      {...(interativo ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderTerminationRequest: () => true,
        onResponderGrant: (e: any) => mover(e.nativeEvent.locationX),
        onResponderMove: (e: any) => mover(e.nativeEvent.locationX),
        onResponderRelease: () => setTimeout(() => setDica(null), 1600),
        onPointerMove: (e: any) => { if (e.nativeEvent.pointerType === "mouse") mover(e.nativeEvent.offsetX ?? e.nativeEvent.locationX); },
        onPointerLeave: () => setDica(null),
      } : {})}>
      {svg ? <SvgXml xml={svg} width={largura} height={H} /> : null}
      {dica && geo && reg.hover ? (
        <Svg width={largura} height={H} style={{ position: "absolute", left: 0, top: 0 }} pointerEvents="none">
          <Line x1={dica.cx} x2={dica.cx} y1={12} y2={H - 28} stroke={t.cores.ink3} strokeWidth={1} strokeDasharray="3 3" />
          {(dica.pontos || []).map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={4.5} fill={t.cores.bg2} stroke={p.cor} strokeWidth={2.5} />)}
        </Svg>
      ) : null}
      {dica ? (
        <View pointerEvents="none" style={{ position: "absolute", top: -8, left: Math.max(0, Math.min(largura - 170, dica.cx - 85)), width: 170,
          transform: [{ translateY: "-100%" as any }], zIndex: 5, backgroundColor: t.cores.vidroForte, borderWidth: 1, borderColor: t.cores.linha,
          boxShadow: t.cores.sombra, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 } as any}>
          <Text style={{ color: t.cores.ink2, fontSize: 12, marginBottom: 4 }}>{dica.quando}</Text>
          {dica.linhas.map((l, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                {l.cor ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: corCss(t.cores, l.cor) }} /> : null}
                <Text style={{ color: t.cores.ink2, fontSize: 12.5 }} numberOfLines={1}>{l.nome}</Text>
              </View>
              <Text style={{ color: t.cores.ink, fontSize: 12.5, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                {l.privado && privado ? "••••" : l.valor}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
