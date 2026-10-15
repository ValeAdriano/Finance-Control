/* O preço de um jeito que se lê de relance: valor grande, a variação como
 * seta colorida, quanto custa comprar e o gráfico com os períodos. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTema } from "../../tema";
import { Num, T } from "../../ui/kit";
import { Segmentado } from "../../ui/campos";
import { Grafico } from "../../ui/grafico";
import FC from "../../nucleo";

const ok = (v: any) => FC.ok(v);

/** variação em %, com seta e fundo verde ou vermelho */
export function Variacao({ v, sufixo, pequeno }: { v: number | null | undefined; sufixo?: string; pequeno?: boolean }) {
  const t = useTema();
  if (!ok(v)) return null;
  const sobe = (v as number) >= 0;
  const cor = sobe ? t.cores.verde : t.cores.vermelho;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 3, paddingVertical: pequeno ? 1 : 2, paddingHorizontal: pequeno ? 6 : 8,
      borderRadius: 980, backgroundColor: sobe ? t.cores.verdeSuave : t.cores.vermelhoSuave }}>
      <T style={{ fontSize: pequeno ? 12 : 13, fontWeight: "600", color: cor }}>
        {sobe ? "▲" : "▼"} {FC.fmt.num(Math.abs(v as number), 2)}%{sufixo ? " " + sufixo : ""}
      </T>
    </View>
  );
}

/** preço à direita de uma linha de lista: valor e variação do dia */
export function PrecoLinha({ preco, variacao, sufixo = "hoje" }: { preco: number | null | undefined; variacao?: number | null; sufixo?: string }) {
  return (
    <View style={{ alignItems: "flex-end", gap: 3, minWidth: 86 }}>
      <Num style={{ fontWeight: "600", fontSize: 15 }}>{ok(preco) ? FC.fmt.preco(preco) : "—"}</Num>
      {ok(variacao) ? <Variacao v={variacao} sufixo={sufixo} pequeno /> : null}
    </View>
  );
}

const unidade = (classe: string) => (classe === "fii" ? ["cota", "cotas"] : classe === "cripto" ? null : ["ação", "ações"]);

/** o topo do detalhe: preço grande, variação, quanto custa comprar e a faixa de 52 semanas */
export function BlocoPreco({ a }: { a: any }) {
  const t = useTema();
  const u = unidade(a.classe);
  const lote = a.classe === "acao_br" ? 100 : a.classe === "fii" ? 10 : null;
  const faixa = FC.graficos.faixa52(a.preco, a.min_52s, a.max_52s);
  const pos52 = ok(a.min_52s) && ok(a.max_52s) && a.max_52s > a.min_52s ? ((a.preco - a.min_52s) / (a.max_52s - a.min_52s)) * 100 : null;
  return (
    <View style={{ gap: 6, marginBottom: t.espaco.e4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Num style={{ fontSize: 34, fontWeight: "700", letterSpacing: -1 }}>{FC.fmt.preco(a.preco)}</Num>
        <Variacao v={a.variacao_dia} sufixo={a.classe === "cripto" ? "em 24 h" : "hoje"} />
      </View>
      <T style={{ fontSize: 13, color: t.cores.ink2 }}>
        {u ? `1 ${u[0]} custa ${FC.fmt.brlTexto(a.preco)}` : "preço de 1 unidade"}
        {u && lote ? ` · ${lote} ${u[1]} custam ${FC.fmt.brlTexto(a.preco * lote, 0)}` : ""}
        {` · ${a.fonte_preco || "fechamento"}${a.preco_quando ? " " + FC.datas.ha(a.preco_quando) : ""}`}
      </T>
      {faixa ? (
        <View style={{ marginTop: 6, maxWidth: 420 }}>
          <T style={{ fontSize: 12.5, color: t.cores.ink2, marginBottom: 2 }}>
            Últimas 52 semanas{pos52 != null ? ` · ${pos52 < 20 ? "perto da mínima" : pos52 > 80 ? "perto da máxima" : "no meio da faixa"}` : ""}
          </T>
          <Grafico marcador={faixa} />
        </View>
      ) : null}
    </View>
  );
}

const PERIODOS = [{ v: "1m", rotulo: "1M", dias: 31 }, { v: "6m", rotulo: "6M", dias: 183 }, { v: "1a", rotulo: "1A", dias: 365 }, { v: "5a", rotulo: "5A", dias: 5 * 365 }] as const;
type Periodo = (typeof PERIODOS)[number]["v"];

/** gráfico do preço com 1M, 6M, 1A e 5A; o preço justo de Graham aparece como linha tracejada */
export function GraficoPreco({ a }: { a: any }) {
  const t = useTema();
  const [periodo, setPeriodo] = useState<Periodo>("1a");
  const [longa, setLonga] = useState<any[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const base: any[] = a.serie_preco || [];
  const temCincoAnos = base.length && base[0][0] <= FC.datas.soma(FC.datas.hoje(), -5 * 365 + 10);
  useEffect(() => {
    if (periodo !== "5a" || temCincoAnos || longa || carregando || a.classe === "renda_fixa") return;
    setCarregando(true);
    FC.mercado.historicos([{ ticker: a.ticker, classe: a.classe }], 5)
      .then((h: any) => setLonga((h[a.ticker] && h[a.ticker].precos) || []))
      .catch(() => setLonga([]))
      .finally(() => setCarregando(false));
  }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps
  const serie = periodo === "5a" && longa && longa.length ? longa : base;
  if (serie.length < 5) return null;
  const dias = PERIODOS.find((p) => p.v === periodo)!.dias;
  const corte = FC.datas.soma(FC.datas.hoje(), -dias);
  const pontos = serie.filter(([d]: any) => d >= corte);
  if (pontos.length < 2) return null;
  const ini = pontos[0][1], fim = a.preco || pontos[pontos.length - 1][1];
  const varPeriodo = ini ? ((fim / ini) - 1) * 100 : null;
  const g = a.graham && ok(a.graham.valor) ? a.graham.valor : null;
  const series: any[] = [{ nome: "Preço", pontos, classe: "l1", area: true }];
  if (g) series.push({ nome: "Preço justo", pontos: [[pontos[0][0], g], [pontos[pontos.length - 1][0], g]], classe: "lref" });
  return (
    <View style={{ marginBottom: t.espaco.e4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T style={{ fontSize: 17, fontWeight: "600" }}>Preço</T>
          <Variacao v={varPeriodo} sufixo={periodo === "1m" ? "no mês" : periodo === "6m" ? "em 6 meses" : periodo === "1a" ? "em 1 ano" : "em 5 anos"} />
        </View>
        <Segmentado rotuloA11y="Período do gráfico" valor={periodo} aoMudar={setPeriodo} opcoes={PERIODOS.map((p) => ({ v: p.v, rotulo: p.rotulo }))} />
      </View>
      {carregando ? <T v="p">Buscando 5 anos de histórico…</T> : null}
      <Grafico marcador={FC.graficos.linhas({ series, altura: 220, y: "brlCheio", privado: false })} />
      {g ? <T style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: 4 }}>Linha tracejada: preço justo de Graham ({FC.fmt.preco(g)}).</T> : null}
    </View>
  );
}

/** mini linha dos últimos 3 meses, para listas */
export function MiniGrafico({ serie }: { serie: any[] | undefined }) {
  if (!serie || serie.length < 5) return null;
  const corte = FC.datas.soma(FC.datas.hoje(), -92);
  const s = serie.filter(([d]: any) => d >= corte);
  const m = FC.graficos.sparkline(s.length >= 5 ? s : serie.slice(-60), 84, 28);
  return m ? <Grafico marcador={m} /> : null;
}
