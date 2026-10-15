/* Dividendos de um ativo qualquer: o ranking de pagadoras (ações ou FIIs),
 * a análise completa de uma pagadora e a tabela de quanto pagou em cada mês. */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTema } from "../../tema";
import { rerender } from "../../estado/app";
import { useMedidas } from "../../ui/medidas";
import { Anel, B, Botao, Cartao, Item, Kpi, Kpis, Lista, Mensagem, Num, Pilula, Roda, T, Tabela, Trilha, Valores } from "../../ui/kit";
import { Campo, Entrada, Seletor } from "../../ui/campos";
import { Grafico } from "../../ui/grafico";
import { ui } from "../../ui/folha";
import { abreAtivo, analisaAvulso } from "./ativo";
import { formAtivo } from "./formularios";
import { acharAtivo } from "./dados";
import FC from "../../nucleo";

const ok = (v: any) => FC.ok(v);

// ---------------------------------------------------------------- peças
export function Calendario({ meses, alto = 14, largo = 7, gap = 2, rotulos }: { meses: number[]; alto?: number; largo?: number; gap?: number; rotulos?: boolean }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", gap }} accessibilityLabel="meses em que costuma pagar">
      {meses.map((n, i) => (
        <View key={i} style={{ alignItems: "center", width: rotulos ? 44 : largo }}>
          <View style={{ width: rotulos ? 44 : largo, height: alto, borderRadius: rotulos ? 8 : 2, backgroundColor: n >= 2 ? t.cores.verde : n === 1 ? t.cores.verdeSuave : t.cores.campo }} />
          {rotulos ? <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.dividendos.NOMES_MES[i]}</T> : null}
        </View>
      ))}
    </View>
  );
}

/** barras horizontais (.barras-h): nome, barra e valor */
export function BarrasH({ itens, cor }: { itens: Array<{ nome: React.ReactNode; pct: number; valor: React.ReactNode }>; cor?: string }) {
  const t = useTema();
  const { estreito } = useMedidas();
  return (
    <View style={{ gap: 10 }}>
      {itens.map((x, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: estreito ? 96 : 130 }}>{typeof x.nome === "string" ? <T style={{ fontSize: 13.5 }}>{x.nome}</T> : x.nome}</View>
          <View style={{ flex: 1 }}><Trilha pct={x.pct} cor={cor || t.cores.terra} altura={10} /></View>
          <View style={{ width: estreito ? 90 : 110, alignItems: "flex-end" }}>{typeof x.valor === "string" ? <Num style={{ fontSize: 13.5, fontWeight: "500" }}>{x.valor}</Num> : x.valor}</View>
        </View>
      ))}
    </View>
  );
}

/** quanto pagou por cota em cada mês: linhas = anos, colunas = meses; tocar mostra as datas */
export function ProventosPorMes({ porMes, preco }: { porMes: any; preco?: number | null }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const [sel, setSel] = useState<{ ano: number; mes: number } | null>(null);
  if (!porMes || !porMes.max) return <T v="p">Sem proventos nos últimos 5 anos.</T>;
  const NOMES: string[] = FC.dividendos.NOMES_MES;
  const cel = (m: any) => {
    const f = m.valor / porMes.max;
    return m.valor ? (m.futuro ? t.cores.amareloSuave : f > 0.66 ? t.cores.verde : f > 0.33 ? t.cores.verdeSuave : t.cores.bg3) : "transparent";
  };
  const celula = (m: any, ano: number, i: number) => (
    <Pressable onPress={() => setSel(m.valor ? { ano, mes: i } : null)} accessibilityRole="button"
      accessibilityLabel={`${NOMES[i]} de ${ano}: ${m.valor ? FC.fmt.preco(m.valor) : "não pagou"}`}
      style={{ alignSelf: "stretch", alignItems: "flex-end", borderRadius: 6, paddingVertical: 4, paddingHorizontal: 4, backgroundColor: cel(m),
        borderWidth: sel && sel.ano === ano && sel.mes === i ? 1.5 : 0, borderColor: t.cores.acento }}>
      <Num style={{ fontSize: 12, fontWeight: m.valor ? "600" : "400", color: m.valor ? (m.valor / porMes.max > 0.66 && !m.futuro ? "#fff" : t.cores.ink) : t.cores.ink3 }}>
        {m.valor ? FC.fmt.num(m.valor, m.valor < 0.1 ? 3 : 2) : "·"}
      </Num>
    </Pressable>
  );
  const total = (l: any) => <Num style={{ fontSize: 13, fontWeight: "600" }}>{l.total ? FC.fmt.num(l.total, 2) : "—"}</Num>;
  const anos: any[] = porMes.anos;
  // no celular, meses nas linhas e anos nas colunas: cabe sem rolar de lado
  const tabela = estreito ? (
    <Tabela minimo={0}
      cabecas={[{ t: "Mês", largura: 48 }, ...anos.map((l) => ({ t: String(l.ano), n: true, largura: 58 }))]}
      linhas={[
        ...NOMES.map((n, i) => [{ v: <T style={{ fontSize: 13, color: t.cores.ink2 }}>{n}</T> }, ...anos.map((l) => ({ n: true, v: celula(l.meses[i], l.ano, i) }))]),
        { estilo: "mediana" as const, celulas: [{ v: <B>Total</B> }, ...anos.map((l) => ({ n: true, v: total(l) }))] },
      ]} />
  ) : (
    <Tabela minimo={56 + 58 * 12 + 90}
      cabecas={[{ t: "Ano", largura: 56 }, ...NOMES.map((n) => ({ t: n, n: true, largura: 58 })), { t: "Total", n: true, largura: 90 }]}
      linhas={anos.map((l) => [{ v: <B>{String(l.ano)}</B> }, ...l.meses.map((m: any, i: number) => ({ v: celula(m, l.ano, i) })), { v: total(l), n: true }])} />
  );
  const escolhido = sel && anos.find((l: any) => l.ano === sel.ano)?.meses[sel.mes];
  return (
    <View>
      <View style={{ borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.r, overflow: "hidden" }}>{tabela}</View>
      <T v="p" style={{ marginTop: t.espaco.e2 }}>
        R$ por ação ou cota pagos em cada mês (pela data de pagamento). Verde mais forte: meses de maior pagamento; amarelo: anunciado, ainda não pago. Toque num mês para ver as datas.
      </T>
      {escolhido && escolhido.eventos.length ? (
        <Cartao style={{ marginTop: t.espaco.e3, paddingVertical: 12 }}>
          <T style={{ fontWeight: "600", marginBottom: 6 }}>{NOMES[sel!.mes]}/{sel!.ano} · {escolhido.eventos.length} pagamento{escolhido.eventos.length > 1 ? "s" : ""}</T>
          {escolhido.eventos.map((p: any, i: number) => (
            <T key={i} style={{ fontSize: 13, color: t.cores.ink2 }}>
              {p.tipo} · <Text style={{ fontWeight: "600", color: t.cores.ink }}>{FC.fmt.preco(p.valor)}</Text> · data com {FC.datas.br(p.data_com)} · paga {p.pagamento ? FC.datas.br(p.pagamento) : "a definir"}
              {preco ? ` · ${FC.fmt.num((p.valor / preco) * 100)}% do preço` : ""}
            </T>
          ))}
        </Cartao>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- análise de uma pagadora
export function CorpoPagadora({ r, resumo }: { r: any; resumo?: boolean }) {
  const t = useTema();
  const barrasAno = r.anos.map((a: any) => ({ rotulo: String(a.ano), titulo: `${a.ano} · ${a.eventos} pagamento(s)`, valor: a.valor, cor: "var(--s2)" }))
    .concat([{ rotulo: "12m", titulo: "últimos 12 meses", valor: r.soma12, cor: "var(--s1)" }]);
  const ultimos = [...(r.lista || [])].sort((a: any, b: any) => (b.pagamento || b.data_com).localeCompare(a.pagamento || a.data_com)).slice(0, 12);
  const notas: Array<[string, number, string]> = [["DY", r.notas.dy, "30%"], ["Anos pagando", r.notas.consistencia, "20%"], ["Frequência", r.notas.frequencia, "15%"],
    ["Estabilidade", r.notas.estabilidade, "15%"], ["Crescimento", r.notas.crescimento, "10%"], ["Payout", r.notas.payout, "10%"]];
  const h3 = (txt: string, topo = 22) => <T style={{ fontSize: 17, fontWeight: "600", marginTop: topo, marginBottom: 8 }}>{txt}</T>;
  if (!r.soma12 && !(r.por_mes && r.por_mes.max)) return resumo ? null : <T v="p">Não pagou proventos nos últimos 5 anos.</T>;
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20, marginBottom: 20, alignItems: "center" }}>
        <Anel score={r.nota} cor={r.cor} grande={!resumo} />
        <View style={{ flex: 1, minWidth: 180 }}>
          {resumo ? <T style={{ fontSize: 13, color: t.cores.ink2 }}>Nota de dividendos</T> : <T style={{ fontSize: 13, color: t.cores.ink2 }}>{r.segmento || (r.classe === "fii" ? "Fundo imobiliário" : "Ação")}</T>}
          <View style={{ marginTop: t.espaco.e2 }}><Pilula cor={r.cor}>{r.classificacao}</Pilula></View>
          <T v="p" style={{ marginTop: t.espaco.e2 }}>Paga {r.frequencia === "mensal" ? "todo mês" : r.frequencia}{r.meses_que_paga.length && r.frequencia !== "mensal" ? `, normalmente em ${r.meses_que_paga.join(", ")}` : ""}.</T>
        </View>
      </View>
      <Kpis style={{ marginBottom: 24 }}>
        <Kpi pequeno rotulo="DY 12 meses" valor={`${FC.fmt.num(r.dy12)}%`} peq={`${FC.fmt.preco(r.soma12)} por cota · preço ${FC.fmt.preco(r.preco)}`} />
        <Kpi pequeno rotulo="DY médio 5 anos" valor={ok(r.dy_medio5) ? FC.fmt.num(r.dy_medio5) + "%" : "—"} />
        <Kpi pequeno rotulo="Frequência" valor={r.frequencia} peq={`${r.eventos12} pagamento(s) em 12 meses`} />
        <Kpi pequeno rotulo="Anos pagando" valor={`${r.anos_com_pagamento} de 5`} />
        <Kpi pequeno rotulo="Crescimento" valor={ok(r.crescimento) ? FC.fmt.delta(r.crescimento) + "% a.a." : "—"} cls={ok(r.crescimento) ? (r.crescimento >= 0 ? "pos" : "neg") : null} peq="12m de hoje × 12m de 3 anos atrás" />
        {ok(r.payout) ? <Kpi pequeno rotulo="Payout" valor={`${FC.fmt.num(r.payout, 0)}%`} cls={r.payout > 100 ? "neg" : null} peq="do lucro vira provento" /> : null}
        {r.pct_jcp ? <Kpi pequeno rotulo="Em JCP" valor={`${FC.fmt.num(r.pct_jcp, 0)}%`} peq="15% de IR na fonte" /> : null}
        {r.proximo ? <Kpi pequeno rotulo="Próximo" valor={FC.datas.br(r.proximo.pagamento || r.proximo.data_com).slice(0, 5)} peq={`${FC.fmt.preco(r.proximo.valor)} por cota`} /> : null}
      </Kpis>
      {r.alertas.map((a: string, i: number) => <Mensagem key={i} tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e3 }}>{a}</Mensagem>)}
      {h3("Proventos por cota, por ano", 18)}
      <T v="p" style={{ marginBottom: t.espaco.e3 }}>R$ pagos por cota em cada ano (pela data com) e nos últimos 12 meses.</T>
      <Grafico marcador={FC.graficos.colunas({ barras: barrasAno, y: "num", privado: false, altura: 200 })} />
      {h3("Quanto pagou em cada mês")}
      <ProventosPorMes porMes={r.por_mes} preco={r.preco} />
      {resumo ? null : (
        <>
          {h3("Como a nota é formada")}
          <BarrasH cor={t.cores.acento} itens={notas.map(([n, v, peso]) => ({ nome: <T style={{ fontSize: 13.5 }}>{n} <Text style={{ color: t.cores.ink3, fontSize: 12 }}>{peso}</Text></T>, pct: Math.round(v), valor: String(Math.round(v)) }))} />
          {h3("Últimos proventos")}
          <Lista>
            {ultimos.map((p: any, i: number) => (
              <Item key={i} titulo={<Pilula cor={({ Dividendo: "verde", JCP: "azul", Rendimento: "terra" } as any)[p.tipo] || "cinza"}>{p.tipo}</Pilula>}
                detalhe={`data com ${FC.datas.br(p.data_com)} · paga ${p.pagamento ? FC.datas.br(p.pagamento) : "a definir"}`}
                valores={<Valores dinheiro={false} b={FC.fmt.preco(p.valor)} small={`por cota${r.preco ? " · " + FC.fmt.num((p.valor / r.preco) * 100) + "% do preço" : ""}`} />} />
            ))}
          </Lista>
          <T v="p" style={{ marginTop: t.espaco.e4 }}>Fonte: Fundamentus. Não é recomendação de compra ou venda.</T>
        </>
      )}
    </View>
  );
}

/** no detalhe de um ativo: busca os proventos e mostra a análise de dividendos */
export function BlocoProventos({ a }: { a: any }) {
  const t = useTema();
  const [r, setR] = useState<any>(undefined);
  const paga = FC.dividendos.COM_DIVIDENDO.has(a.classe);
  useEffect(() => {
    if (!paga) return;
    let vivo = true;
    FC.mercado.proventos([{ ticker: a.ticker, classe: a.classe }])
      .then((p: any) => {
        const lista = (p[a.ticker] || {}).lista || [];
        const u = FC.estado.mercado.universo || { acoes: {}, fiis: {} };
        const fund = a.classe === "acao_br" ? u.acoes[a.ticker] : null;
        if (vivo) setR({ ...FC.dividendos.analisaPagadora({ ticker: a.ticker, classe: a.classe, lista, preco: a.preco, fund }), lista });
      })
      .catch(() => vivo && setR(null));
    return () => { vivo = false; };
  }, [a.ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!paga) return null;
  return (
    <View style={{ marginTop: t.espaco.e4, marginBottom: t.espaco.e4 }}>
      <T style={{ fontSize: 20, fontWeight: "700", marginBottom: 10 }}>Dividendos</T>
      {r === undefined ? <View style={{ minHeight: 80, alignItems: "center", justifyContent: "center" }}><Roda /></View>
        : r === null ? <T v="p">Não consegui buscar os proventos agora.</T>
          : <CorpoPagadora r={r} resumo />}
    </View>
  );
}

// ---------------------------------------------------------------- ranking
export const ranking: any = { tipo: "acoes", freq: "qualquer", dyMin: 4, liqMin: 1, ordem: "nota", resultado: null, chave: null, carregando: false, progresso: 0 };
const chaveRanking = () => [ranking.tipo, ranking.liqMin].join("|");
function candidatos() {
  const u = FC.estado.mercado.universo;
  if (!u) return [];
  const fonte = ranking.tipo === "fiis" ? u.fiis : u.acoes;
  const liq = (Number(ranking.liqMin) || 0) * 1e6;
  return Object.values<any>(fonte).filter((x) => (x.liquidez || 0) >= liq && x.dy > 0 && x.dy < 40 && x.cotacao > 0)
    .sort((a, b) => b.dy - a.dy).slice(0, 45)
    .map((x) => ({ ticker: x.ticker, classe: ranking.tipo === "fiis" ? "fii" : "acao_br", fund: x }));
}
async function montaRanking(aoProgresso: () => void, forcar = false) {
  if (ranking.carregando) return;
  if (!forcar && ranking.resultado && ranking.chave === chaveRanking()) return;
  ranking.carregando = true; ranking.progresso = 0;
  const cands = candidatos();
  try {
    const provs: any = {};
    for (let i = 0; i < cands.length; i += 15) {
      Object.assign(provs, await FC.mercado.proventos(cands.slice(i, i + 15).map((c) => ({ ticker: c.ticker, classe: c.classe }))));
      ranking.progresso = Math.round(((i + 15) / cands.length) * 100); aoProgresso();
    }
    ranking.resultado = cands.map((c) => ({ ...FC.dividendos.analisaPagadora({ ticker: c.ticker, classe: c.classe, lista: (provs[c.ticker] || {}).lista,
      preco: c.fund.cotacao, fund: c.classe === "acao_br" ? c.fund : null }), segmento: c.fund.segmento || "", liquidez: c.fund.liquidez, lista: (provs[c.ticker] || {}).lista || [] }));
    ranking.chave = chaveRanking();
  } catch (e) { ui.erro(e); } finally { ranking.carregando = false; }
  rerender();
}
function filtrados() {
  const ordemFreq: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 4, anual: 5 };
  let l = (ranking.resultado || []).filter((r: any) => r.soma12 > 0 && (r.dy12 || 0) >= (Number(ranking.dyMin) || 0));
  if (ranking.freq === "mensal") l = l.filter((r: any) => r.frequencia === "mensal");
  if (ranking.freq === "trimestral") l = l.filter((r: any) => (ordemFreq[r.frequencia] || 9) <= 3);
  if (ranking.freq === "regular") l = l.filter((r: any) => r.anos_com_pagamento === 5);
  const ord: Record<string, (a: any, b: any) => number> = { nota: (a, b) => b.nota - a.nota, dy: (a, b) => b.dy12 - a.dy12,
    regularidade: (a, b) => b.anos_com_pagamento - a.anos_com_pagamento || (b.estabilidade || 0) - (a.estabilidade || 0) || b.nota - a.nota };
  return l.sort(ord[ranking.ordem]);
}

/** ranking de pagadoras de dividendos do tipo escolhido fora (ações ou FIIs) */
export function Pagadoras({ tipo }: { tipo: "acoes" | "fiis" }) {
  const t = useTema();
  const [, setTick] = useState(0);
  if (ranking.tipo !== tipo) { ranking.tipo = tipo; ranking.dyMin = tipo === "fiis" ? 8 : 4; }
  const [dy, setDy] = useState(String(ranking.dyMin));
  const [liq, setLiq] = useState(String(ranking.liqMin));
  useEffect(() => { setDy(String(ranking.dyMin)); }, [tipo]);
  const pronto = ranking.resultado && ranking.chave === chaveRanking();
  useEffect(() => { if (FC.estado.mercado.universo && !pronto) montaRanking(() => setTick((x) => x + 1)); });
  useEffect(() => {
    const id = setTimeout(() => {
      const a = FC.lerNum(dy), b = FC.lerNum(liq);
      let mudou = false;
      if (a != null && a !== ranking.dyMin) { ranking.dyMin = a; mudou = true; }
      if (b != null && b !== ranking.liqMin) { ranking.liqMin = b; mudou = true; }
      if (mudou) setTick((x) => x + 1);
    }, 600);
    return () => clearTimeout(id);
  }, [dy, liq]);
  if (!FC.estado.mercado.universo) return <View style={{ minHeight: 160, alignItems: "center", justifyContent: "center" }}><Roda /></View>;
  const l = pronto ? filtrados() : [];
  const meus = new Set(FC.estado.base.ativos.map((a: any) => a.ticker));
  const muda = (k: string, v: any) => { ranking[k] = v; setTick((x) => x + 1); };
  return (
    <View>
      <Cartao style={{ marginBottom: t.espaco.e4 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <View style={{ minWidth: 170 }}><Campo rotulo="Frequência"><Seletor valor={ranking.freq} aoMudar={(v) => muda("freq", v)} rotuloA11y="Frequência"
            opcoes={[{ v: "qualquer", rotulo: "Qualquer" }, { v: "mensal", rotulo: "Mensal" }, { v: "trimestral", rotulo: "Trimestral ou mais" }, { v: "regular", rotulo: "Pagou nos 5 últimos anos" }]} /></Campo></View>
          <View style={{ width: 120 }}><Campo rotulo="DY mínimo (%)"><Entrada valor={dy} aoMudar={setDy} decimal accessibilityLabel="DY mínimo" /></Campo></View>
          <View style={{ width: 150 }}><Campo rotulo="Liquidez (R$ mi/dia)"><Entrada valor={liq} aoMudar={setLiq} decimal accessibilityLabel="Liquidez mínima" /></Campo></View>
          <View style={{ minWidth: 150 }}><Campo rotulo="Ordenar por"><Seletor valor={ranking.ordem} aoMudar={(v) => muda("ordem", v)} rotuloA11y="Ordenar por"
            opcoes={[{ v: "nota", rotulo: "Nota de dividendos" }, { v: "dy", rotulo: "DY 12 meses" }, { v: "regularidade", rotulo: "Regularidade" }]} /></Campo></View>
        </View>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Pré-seleciona as {tipo === "fiis" ? "FIIs" : "ações"} líquidas de maior DY no Fundamentus e analisa os proventos reais de cada uma: frequência, meses de pagamento, 5 anos de histórico, crescimento e payout. Não é recomendação.</T>
      </Cartao>
      {!pronto ? (
        <Cartao>
          <T style={{ marginBottom: t.espaco.e3 }}>Analisando os proventos de cada {tipo === "fiis" ? "fundo" : "empresa"}… a primeira vez leva alguns segundos.</T>
          <Trilha pct={ranking.progresso} />
        </Cartao>
      ) : (
        <>
          <Cartao semPad>
            {l.length ? (
              <Tabela minimo={1000} onLinha={(i) => abrePagadora(l[i])}
                cabecas={[{ t: "#", largura: 44 }, { t: "Ativo", largura: 140 }, { t: "Nota", largura: 190 }, { t: "DY 12m", n: true }, { t: "Frequência", largura: 120 },
                  { t: "Meses em que paga", largura: 130 }, { t: "Anos pagando", n: true }, { t: "Crescimento", n: true }, { t: "Payout", n: true, largura: 80 }, { t: "Próximo", largura: 100 }]}
                linhas={l.map((r: any, i: number) => ({ estilo: meus.has(r.ticker) ? "meu" : undefined, celulas: [
                  { v: String(i + 1), cls: "fraco" },
                  { v: <B>{r.ticker}</B>, leg: r.segmento || (r.classe === "fii" ? "FII" : "Ação") },
                  { v: <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Anel score={r.nota} cor={r.cor} /><Pilula cor={r.cor} semPonto>{r.classificacao}</Pilula></View> },
                  { v: <Num style={{ fontWeight: "600", fontSize: 14 }}>{FC.fmt.num(r.dy12)}%</Num>, leg: `média 5a ${ok(r.dy_medio5) ? FC.fmt.num(r.dy_medio5) + "%" : "—"}`, n: true },
                  { v: r.frequencia, leg: r.intervalo_meses ? "a cada " + FC.fmt.num(r.intervalo_meses, r.intervalo_meses % 1 ? 1 : 0) + (r.intervalo_meses === 1 ? " mês" : " meses") : "" },
                  { v: <Calendario meses={r.meses} /> },
                  `${r.anos_com_pagamento}/5`,
                  { v: ok(r.crescimento) ? FC.fmt.delta(r.crescimento) + "% a.a." : "—", cls: ok(r.crescimento) ? (r.crescimento >= 0 ? "pos" : "neg") : null },
                  { v: ok(r.payout) ? FC.fmt.num(r.payout, 0) + "%" : "—", cls: ok(r.payout) && r.payout > 100 ? "neg" : null },
                  r.proximo ? { v: <B>{FC.datas.br(r.proximo.pagamento || r.proximo.data_com).slice(0, 5)}</B>, leg: `${FC.fmt.preco(r.proximo.valor)}/cota` } : { v: "—", cls: "muito-fraco" },
                ] }))} />
            ) : <T style={{ padding: 28, color: t.cores.ink2 }}>Nenhum ativo com esses filtros. Baixe o DY mínimo ou mude a frequência.</T>}
          </Cartao>
          <T v="p" style={{ marginTop: t.espaco.e3 }}><B>Nota de dividendos</B> (0–100): DY 30%, anos pagando 20%, frequência 15%, estabilidade 15%, crescimento 10%, payout 10%. Meses em verde forte: pagou nesse mês em 2 dos últimos 3 anos.</T>
        </>
      )}
    </View>
  );
}

// análise completa de uma pagadora
export function abrePagadora(r: any) {
  if (!r) return;
  ui.folha({
    titulo: `${r.ticker} · dividendos`, larga: true,
    corpo: <CorpoPagadora r={r} />,
    rodape: (api) => (
      <>
        <Botao variante="sec" onPress={() => { api.fechar(); setTimeout(() => (acharAtivo(r.ticker) ? abreAtivo(r.ticker) : analisaAvulso(r.ticker, r.classe)), 240); }}>Análise completa</Botao>
        <Botao onPress={() => { api.fechar(); setTimeout(() => formAtivo({ ticker: r.ticker, classe: r.classe, pilar: r.classe === "fii" ? "real_estate" : "acoes", lista: "watchlist", quantidade: 0, _novo: true }), 240); }}>Adicionar</Botao>
      </>
    ),
  });
}
