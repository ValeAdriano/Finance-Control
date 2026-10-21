/* Medidores do Início: o velocímetro de 270° da nota da carteira, os anéis
 * de meta, a linha de tendência e a rosca da alocação. SVG desenhado aqui e
 * animado à mão (como o Anel do kit: o traço animado do svg gera avisos no web). */
import React, { useEffect, useRef, useState } from "react";
import { Easing, Pressable, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Stop } from "react-native-svg";
import { useTema } from "../tema";
import { Num, T } from "./kit";
import FC from "../nucleo";
import { reduzMovimento } from "./movimento";

const CURVA = Easing.bezier(0.32, 0.72, 0, 1);

/** anima até v em `dur` ms, com a curva do app. Na primeira vez sai do 0;
 * depois, de onde o valor está agora (trocar o período vai de 80 a 50, não
 * zera e sobe), inclusive se a troca chegar no meio de uma animação */
function useAnima(v: number, dur = 1000) {
  const [x, setX] = useState(0);
  const atual = useRef(0);
  useEffect(() => {
    if (reduzMovimento()) { atual.current = v; setX(v); return; }
    const t0 = Date.now(), de = atual.current;
    let raf = 0;
    const passo = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      atual.current = de + (v - de) * CURVA(p);
      setX(atual.current);
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [v, dur]);
  return x;
}

/** cor de uma faixa do desempenho (FC.desempenho.FAIXAS) */
export function corFaixa(t: ReturnType<typeof useTema>, cor?: string | null) {
  return cor === "verde" ? t.cores.verde : cor === "amarelo" ? t.cores.s3 : cor === "vermelho" ? t.cores.vermelho : t.cores.ink3;
}

// ponto no círculo: ângulo em graus, 0 = direita, crescendo no sentido horário
const ponto = (c: number, r: number, g: number) => [c + r * Math.cos((g * Math.PI) / 180), c + r * Math.sin((g * Math.PI) / 180)];
function arco(c: number, r: number, de: number, ate: number) {
  const [x0, y0] = ponto(c, r, de), [x1, y1] = ponto(c, r, ate);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${ate - de > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// ---------------------------------------------------------------- velocímetro
/** arco de 270°, de baixo à esquerda até baixo à direita, preenchido até a nota */
export function Velocimetro({ valor, cor, rotulo, sub, tam = 220, onPress, rotuloA11y }: {
  valor: number; cor: string; rotulo: string; sub?: string; tam?: number; onPress?: () => void; rotuloA11y?: string;
}) {
  const t = useTema();
  const v = useAnima(Math.max(0, Math.min(100, valor)));
  const w = tam * 0.085, r = (tam - w) / 2 - 2, c = tam / 2;
  const L = r * Math.PI * 1.5;
  const caminho = arco(c, r, 135, 405);
  const corpo = (
    <View style={{ width: tam, height: tam * 0.88, alignItems: "center" }}>
      <Svg width={tam} height={tam}>
        <Path d={caminho} stroke={t.cores.campo} strokeWidth={w} strokeLinecap="round" fill="none" />
        {v > 0.2 ? <Path d={caminho} stroke={cor} strokeWidth={w} strokeLinecap="round" fill="none"
          strokeDasharray={`${((L * v) / 100).toFixed(2)} ${L.toFixed(2)}`} /> : null}
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: tam, alignItems: "center", justifyContent: "center" }}>
        <Num style={{ fontSize: tam * 0.27, lineHeight: tam * 0.3, fontWeight: "700", letterSpacing: -tam * 0.01 }}>{Math.round(v)}</Num>
        <T style={{ fontSize: tam * 0.075, fontWeight: "600", color: cor, marginTop: 2 }}>{rotulo}</T>
        {sub ? <T style={{ fontSize: Math.max(11, tam * 0.055), color: t.cores.ink2, marginTop: 2, textAlign: "center", maxWidth: tam * 0.6 }}>{sub}</T> : null}
      </View>
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotuloA11y} style={{ alignItems: "center" }}>{corpo}</Pressable>
    : <View accessibilityRole="image" accessibilityLabel={rotuloA11y} style={{ alignItems: "center" }}>{corpo}</View>;
}

// ---------------------------------------------------------------- anel de meta
/** anel de 360° preenchido até `pct`; `centro` troca o "x%" do meio (uma nota,
 * um "118%" que passa do arco); sem valor, cinza com "definir" */
export function AnelMeta({ pct, rotulo, sub, cor, tam = 76, onPress, centro }: {
  pct: number | null; rotulo: string; sub?: string; cor?: string; tam?: number; onPress?: () => void; centro?: string;
}) {
  const t = useTema();
  const tem = pct != null && Number.isFinite(pct);
  const alvo = tem ? Math.max(0, Math.min(100, pct as number)) : 0;
  const v = useAnima(alvo);
  const w = tam * 0.11, r = (tam - w) / 2, c = tam / 2, L = 2 * Math.PI * r;
  const corArco = cor || (alvo >= 99.5 ? t.cores.verde : t.cores.acento);
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : "image"}
      accessibilityLabel={`${rotulo}: ${centro || (tem ? Math.round(pct as number) + "%" : "sem dados")}${sub ? ", " + sub : ""}`}
      style={{ alignItems: "center", flex: 1, minWidth: 0, gap: 4 }}>
      <View style={{ width: tam, height: tam }}>
        <Svg width={tam} height={tam} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={c} cy={c} r={r} stroke={t.cores.campo} strokeWidth={w} fill="none" />
          {tem && v > 0.2 ? <Circle cx={c} cy={c} r={r} stroke={corArco} strokeWidth={w} fill="none" strokeLinecap="round"
            strokeDasharray={`${((L * v) / 100).toFixed(2)} ${L.toFixed(2)}`} /> : null}
        </Svg>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          {centro
            ? <Num style={{ fontSize: tam * (centro.length > 4 ? 0.2 : 0.26), fontWeight: "700" }}>{centro}</Num>
            : tem
            ? <Num style={{ fontSize: tam * 0.24, fontWeight: "700" }}>{Math.round(pct as number)}<Num style={{ fontSize: tam * 0.14, fontWeight: "600" }}>%</Num></Num>
            : <T style={{ fontSize: tam * 0.16, color: t.cores.acento, fontWeight: "600" }}>definir</T>}
        </View>
      </View>
      <T style={{ fontSize: 13, fontWeight: "600", textAlign: "center" }} numberOfLines={1}>{rotulo}</T>
      {sub ? <T style={{ fontSize: 11.5, color: t.cores.ink2, textAlign: "center", marginTop: -2 }} numberOfLines={1}>{sub}</T> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- tendência
/** linha da nota no período, com área suave por baixo e a ponta marcada */
export function LinhaTendencia({ pontos, cor, largura, altura = 44 }: { pontos: number[]; cor: string; largura: number; altura?: number }) {
  const t = useTema();
  if (pontos.length < 2 || !(largura > 20)) return null;
  // escala fixa de 0 a 100, com folga: a altura da linha diz a faixa
  const pad = 4, h = altura - pad * 2, passo = (largura - pad * 2) / (pontos.length - 1);
  const xy = pontos.map((v, i) => [pad + i * passo, pad + h - (Math.max(0, Math.min(100, v)) / 100) * h]);
  const linha = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M ${xy[0][0].toFixed(1)} ${altura} L ${xy.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} L ${xy.at(-1)![0].toFixed(1)} ${altura} Z`;
  const [ux, uy] = xy.at(-1)!;
  const meio = pad + h / 2;
  return (
    <Svg width={largura} height={altura} accessibilityLabel="tendência da nota no período">
      <Defs>
        <LinearGradient id="tend" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={cor} stopOpacity={0.22} />
          <Stop offset="1" stopColor={cor} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={`M ${pad} ${meio} L ${largura - pad} ${meio}`} stroke={t.cores.linha} strokeWidth={1} strokeDasharray="2 4" />
      <Path d={area} fill="url(#tend)" />
      <Polyline points={linha} fill="none" stroke={cor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={ux} cy={uy} r={3.6} fill={cor} />
    </Svg>
  );
}

// ---------------------------------------------------------------- rosca
/** rosca por fatia ({ valor, cor }), com a meta num anel fino por fora */
export function Rosca({ fatias, metas, tam = 180, centro, sub }: {
  fatias: Array<{ valor: number; cor: string }>; metas?: Array<{ valor: number; cor: string }>; tam?: number; centro?: React.ReactNode; sub?: string;
}) {
  const t = useTema();
  const p = useAnima(1, 900);
  const total = FC.soma(fatias, (f: any) => f.valor) || 1;
  const w = tam * 0.13, r = (tam - w) / 2 - tam * 0.06, c = tam / 2, L = 2 * Math.PI * r;
  const rm = tam / 2 - 3, Lm = 2 * Math.PI * rm, totalM = metas ? FC.soma(metas, (f: any) => f.valor) || 1 : 1;
  // um respiro entre as fatias (só quando há mais de uma)
  const folga = fatias.filter((f) => f.valor > 0).length > 1 ? Math.min(4, L * 0.01) : 0;
  let ac = 0, acM = 0;
  return (
    <View style={{ width: tam, height: tam }}>
      <Svg width={tam} height={tam} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={c} cy={c} r={r} stroke={t.cores.campo} strokeWidth={w} fill="none" />
        {fatias.map((f, i) => {
          const len = (f.valor / total) * L * p;
          const el = len > folga + 0.5
            ? <Circle key={i} cx={c} cy={c} r={r} stroke={f.cor} strokeWidth={w} fill="none"
              strokeDasharray={`${(len - folga).toFixed(2)} ${L.toFixed(2)}`} strokeDashoffset={(-ac).toFixed(2)} />
            : null;
          ac += len;
          return el;
        })}
        {(metas || []).map((f, i) => {
          const len = (f.valor / totalM) * Lm * p;
          const el = len > 2.5
            ? <Circle key={"m" + i} cx={c} cy={c} r={rm} stroke={f.cor} strokeOpacity={0.55} strokeWidth={3} fill="none"
              strokeDasharray={`${(len - 2).toFixed(2)} ${Lm.toFixed(2)}`} strokeDashoffset={(-acM).toFixed(2)} />
            : null;
          acM += len;
          return el;
        })}
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        {centro}
        {sub ? <T style={{ fontSize: 12, color: t.cores.ink2, marginTop: 2 }}>{sub}</T> : null}
      </View>
    </View>
  );
}
