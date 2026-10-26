/* Gráficos do módulo Cripto, no jeito do CoinMarketCap.
 *
 *   GraficoCripto  área com degradê (verde se subiu no período, vermelho se
 *                  caiu), linha tracejada no preço de abertura, barras de
 *                  volume embaixo, eixo de preço à direita e cursor com dica
 *                  (data, valor e volume) no toque ou no mouse.
 *   Sparkline      a linha de 7 dias da tabela, sem eixo.
 *
 * Diferente de ui/grafico.tsx (que desenha o SVG do graficos.js do site), este
 * é desenhado aqui com react-native-svg: o site não tinha volume nem troca de
 * período. Segue o mesmo esquema de medir a largura (onLayout), do cursor e da
 * dica em vidro. */
import React, { useMemo, useState } from "react";
import { Platform, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Rect, Stop, Text as SvgText } from "react-native-svg";
import { useTema } from "../tema";
import { useMedidas } from "./medidas";
import FC from "../nucleo";

export type Ponto = [number, number];

const FONTE = Platform.OS === "web" ? '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' : undefined;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dois = (n: number) => String(n).padStart(2, "0");

/** valor curto: R$ 612 mil, R$ 1,2 tri, R$ 0,0042 (sem o "R$" na régua do gráfico) */
export function eixoBrl(v: number, semMoeda = false): string {
  if (!FC.ok(v)) return "—";
  const a = Math.abs(v), rs = semMoeda ? "" : "R$ ";
  if (a >= 1e12) return rs + FC.fmt.num(v / 1e12, 2) + " tri";
  if (a >= 1e9) return rs + FC.fmt.num(v / 1e9, a >= 1e11 ? 0 : 1) + " bi";
  if (a >= 1e6) return rs + FC.fmt.num(v / 1e6, a >= 1e8 ? 0 : 1) + " mi";
  if (a >= 1e4) return rs + FC.fmt.num(v / 1e3, a >= 1e5 ? 0 : 1) + " mil";
  if (a >= 100) return rs + FC.fmt.num(v, 0);
  return rs + FC.fmt.preco(v);
}

/** a data do eixo e da dica, conforme o período */
export function rotuloTempo(ms: number, dias: string, dica = false): string {
  const d = new Date(ms);
  const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  const dia = `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
  if (dica) return dias === "1" || dias === "7" || dias === "30" ? `${dia}/${d.getFullYear()} · ${hora}` : `${dia}/${d.getFullYear()}`;
  if (dias === "1") return hora;
  if (dias === "7" || dias === "30" || dias === "90") return dia;
  return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

/** de 4 a 6 marcas "redondas" entre min e max */
export function marcas(min: number, max: number, alvo = 5): number[] {
  if (!(max > min)) return [min];
  const passoBruto = (max - min) / alvo;
  const pot = Math.pow(10, Math.floor(Math.log10(passoBruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => (max - min) / p <= alvo + 0.5) || 10 * pot;
  const out: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + passo * 1e-9; v += passo) out.push(Number(v.toPrecision(12)));
  return out;
}

/** no máximo `n` pontos (sempre com o primeiro e o último): o "Tudo" do BTC tem milhares */
export function reduz<P>(l: P[], n: number): P[] {
  if (l.length <= n) return l;
  const passo = l.length / n, out: P[] = [];
  for (let i = 0; i < n; i++) out.push(l[Math.floor(i * passo)]);
  out[out.length - 1] = l[l.length - 1];
  return out;
}

/** índice do ponto mais perto de `alvo` (lista ordenada pelo tempo) */
function maisPerto(l: Ponto[], alvo: number): number {
  let a = 0, b = l.length - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (l[m][0] < alvo) a = m; else b = m; }
  return Math.abs(l[a][0] - alvo) <= Math.abs(l[b][0] - alvo) ? a : b;
}

interface Props {
  pontos: Ponto[];
  volumes?: Ponto[];
  dias: string;
  altura?: number;
  /** "Preço" ou "Market cap": o nome na dica */
  nome?: string;
  carregando?: boolean;
}

export function GraficoCripto({ pontos, volumes = [], dias, altura = 320, nome = "Preço", carregando }: Props) {
  const t = useTema();
  const { estreito } = useMedidas();
  const [W, setW] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const mD = estreito ? 56 : 68, mT = 10, alturaVol = volumes.length ? Math.round(altura * 0.16) : 0, mB = 22;
  const hPlot = altura - mT - mB - alturaVol - (alturaVol ? 6 : 0);
  const larg = Math.max(1, W - mD);

  const g = useMemo(() => {
    if (!W || pontos.length < 2) return null;
    const ps = reduz(pontos, Math.max(60, Math.round(larg * 1.5)));
    const t0 = ps[0][0], t1 = ps[ps.length - 1][0];
    let min = Infinity, max = -Infinity;
    for (const p of ps) { if (p[1] < min) min = p[1]; if (p[1] > max) max = p[1]; }
    const folga = (max - min) * 0.08 || Math.abs(max) * 0.01 || 1;
    const y0 = min - folga, y1 = max + folga;
    const px = (ms: number) => ((ms - t0) / Math.max(1, t1 - t0)) * larg;
    const py = (v: number) => mT + (1 - (v - y0) / (y1 - y0)) * hPlot;
    const linha = ps.map((p, i) => `${i ? "L" : "M"}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join("");
    const area = `${linha}L${px(t1).toFixed(1)},${mT + hPlot}L0,${mT + hPlot}Z`;
    const abertura = pontos[0][1], ultimo = pontos[pontos.length - 1][1];
    // volume: barras agregadas em colunas de ~4 px
    const nBarras = Math.max(10, Math.floor(larg / 4));
    const somas = new Array(nBarras).fill(0);
    for (const v of volumes) {
      if (v[0] < t0 || v[0] > t1) continue;
      const k = Math.min(nBarras - 1, Math.floor(((v[0] - t0) / Math.max(1, t1 - t0)) * nBarras));
      somas[k] = Math.max(somas[k], v[1]);
    }
    const maxVol = Math.max(...somas, 0);
    const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + f * (t1 - t0));
    return { ps, px, py, linha, area, abertura, ultimo, subiu: ultimo >= abertura, ys: marcas(min, max, estreito ? 4 : 5),
      somas, maxVol, larguraBarra: larg / nBarras, xt };
  }, [W, pontos, volumes, larg, hPlot, estreito]);

  const onLayout = (e: LayoutChangeEvent) => { const w = Math.round(e.nativeEvent.layout.width); if (w && w !== W) setW(w); };
  const mover = (mx: number) => {
    if (!g) return;
    const alvo = g.ps[0][0] + (Math.max(0, Math.min(larg, mx)) / larg) * (g.ps[g.ps.length - 1][0] - g.ps[0][0]);
    setCursor(maisPerto(pontos, alvo));
  };

  const cor = g ? (g.subiu ? t.cores.verde : t.cores.vermelho) : t.cores.ink3;
  const p = g && cursor != null ? pontos[cursor] : null;
  const vol = p && volumes.length ? volumes[maisPerto(volumes, p[0])] : null;
  const rot = g ? `${nome}: de ${eixoBrl(g.abertura)} para ${eixoBrl(g.ultimo)} no período` : undefined;
  const yBase = mT + hPlot + (alturaVol ? 6 : 0);

  return (
    <View onLayout={onLayout} style={{ height: altura, opacity: carregando ? 0.55 : 1 }} accessibilityRole={rot ? "image" : undefined} accessibilityLabel={rot}
      {...(g ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderTerminationRequest: () => true,
        onResponderGrant: (e: any) => mover(e.nativeEvent.locationX),
        onResponderMove: (e: any) => mover(e.nativeEvent.locationX),
        onResponderRelease: () => setTimeout(() => setCursor(null), 1600),
        onPointerMove: (e: any) => { if (e.nativeEvent.pointerType === "mouse") mover(e.nativeEvent.offsetX ?? e.nativeEvent.locationX); },
        onPointerLeave: () => setCursor(null),
      } : {})}>
      {g ? (
        <Svg width={W} height={altura}>
          <Defs>
            <LinearGradient id="cg-area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={cor} stopOpacity={0.26} />
              <Stop offset="1" stopColor={cor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {g.ys.map((v) => (
            <React.Fragment key={v}>
              <Line x1={0} x2={larg} y1={g.py(v)} y2={g.py(v)} stroke={t.cores.linha} strokeWidth={1} />
              {/* a marca que cairia embaixo do selo do preço some */}
              {Math.abs(g.py(v) - g.py(p ? p[1] : g.ultimo)) < 16 ? null
                : <SvgText x={larg + 8} y={g.py(v) + 4} fontSize={11} fill={t.cores.ink3} fontFamily={FONTE}>{eixoBrl(v, true)}</SvgText>}
            </React.Fragment>
          ))}
          <Path d={g.area} fill="url(#cg-area)" />
          <Line x1={0} x2={larg} y1={g.py(g.abertura)} y2={g.py(g.abertura)} stroke={t.cores.ink3} strokeWidth={1} strokeDasharray="2 4" />
          <Path d={g.linha} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {alturaVol && g.maxVol > 0 ? g.somas.map((s, i) => s > 0 ? (
            <Rect key={i} x={i * g.larguraBarra + 0.5} width={Math.max(1, g.larguraBarra - 1)} y={yBase + alturaVol - (s / g.maxVol) * alturaVol}
              height={(s / g.maxVol) * alturaVol} fill={t.cores.ink3} opacity={0.28} />
          ) : null) : null}
          {g.xt.map((ms, i) => (
            <SvgText key={i} x={Math.max(0, Math.min(larg, g.px(ms)))} y={altura - 5} fontSize={11} fill={t.cores.ink3} fontFamily={FONTE}
              textAnchor={i === 0 ? "start" : i === g.xt.length - 1 ? "end" : "middle"}>{rotuloTempo(ms, dias)}</SvgText>
          ))}
          {/* preço de agora na régua, como no CMC */}
          {p ? null : (
            <>
              <Rect x={larg + 2} y={g.py(g.ultimo) - 10} width={mD - 4} height={20} rx={5} fill={cor} />
              <SvgText x={larg + 8} y={g.py(g.ultimo) + 4} fontSize={11} fontWeight="600" fill="#fff" fontFamily={FONTE}>{eixoBrl(g.ultimo, true)}</SvgText>
            </>
          )}
          {p ? (
            <>
              <Line x1={g.px(p[0])} x2={g.px(p[0])} y1={mT} y2={yBase + alturaVol} stroke={t.cores.ink3} strokeWidth={1} strokeDasharray="3 3" />
              <Line x1={0} x2={larg} y1={g.py(p[1])} y2={g.py(p[1])} stroke={t.cores.ink3} strokeWidth={1} strokeDasharray="3 3" />
              <Circle cx={g.px(p[0])} cy={g.py(p[1])} r={5} fill={t.cores.bg2} stroke={cor} strokeWidth={2.5} />
              <Rect x={larg + 2} y={g.py(p[1]) - 10} width={mD - 4} height={20} rx={5} fill={t.cores.ink} />
              <SvgText x={larg + 8} y={g.py(p[1]) + 4} fontSize={11} fontWeight="600" fill={t.cores.bg2} fontFamily={FONTE}>{eixoBrl(p[1], true)}</SvgText>
            </>
          ) : null}
        </Svg>
      ) : null}
      {g && p ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 4, left: Math.max(0, Math.min(larg - 190, g.px(p[0]) - 95)), width: 190, zIndex: 5,
          backgroundColor: t.cores.vidroForte, borderWidth: 1, borderColor: t.cores.linha, boxShadow: t.cores.sombra, borderRadius: 12,
          paddingVertical: 9, paddingHorizontal: 12 } as any}>
          <Text style={{ color: t.cores.ink2, fontSize: 12, marginBottom: 4 }}>{rotuloTempo(p[0], dias, true)}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ color: t.cores.ink2, fontSize: 12.5 }}>{nome}</Text>
            <Text style={{ color: t.cores.ink, fontSize: 12.5, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
              {nome === "Preço" ? "R$ " + FC.fmt.preco(p[1]) : eixoBrl(p[1])}
            </Text>
          </View>
          {vol ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ color: t.cores.ink2, fontSize: 12.5 }}>Volume 24 h</Text>
              <Text style={{ color: t.cores.ink, fontSize: 12.5, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{eixoBrl(vol[1])}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** linha de 7 dias, verde ou vermelha pelo saldo do período */
export function Sparkline({ valores, largura = 112, altura = 36 }: { valores: number[]; largura?: number; altura?: number }) {
  const t = useTema();
  if (!valores || valores.length < 2) return <View style={{ width: largura, height: altura }} />;
  let min = Infinity, max = -Infinity;
  for (const v of valores) { if (v < min) min = v; if (v > max) max = v; }
  const fy = (v: number) => 2 + (1 - (v - min) / (max - min || 1)) * (altura - 4);
  const pts = valores.map((v, i) => `${((i / (valores.length - 1)) * largura).toFixed(1)},${fy(v).toFixed(1)}`).join(" ");
  const cor = valores[valores.length - 1] >= valores[0] ? t.cores.verde : t.cores.vermelho;
  return (
    <Svg width={largura} height={altura}>
      <Polyline points={pts} fill="none" stroke={cor} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
