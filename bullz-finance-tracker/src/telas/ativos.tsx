/* Investimentos: ações, FIIs, ETFs e renda fixa, avaliados pelos seus
 * critérios — port de telas/ativos.js. É também onde se cadastra e edita. */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTema } from "../tema";
import { useEstado, rerender } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import {
  Anel, B, Botao, Cabecalho, Cartao, Indicadores, Item, Kpi, Kpis, Lista, Mensagem, Num, Pilula, Rs, Roda, Secao, T, Tabela, Trilha, Vazio, Valores,
} from "../ui/kit";
import { Campo, Entrada, Segmentado, Seletor } from "../ui/campos";
import { Grafico } from "../ui/grafico";
import { Icone } from "../ui/icone";
import { ui } from "../ui/folha";
import { EstadoMercado } from "./comum/alertas";
import { abreAtivo, analisaAvulso } from "./comum/ativo";
import { formAtivo, formRendaFixa } from "./comum/formularios";
import { acharAtivo, adivinhaClasse } from "./comum/dados";
import { ResumoInvestido } from "./comum/rentab";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const sinal = (v: number) => (v >= 0 ? "+" : "−");

// estado da tela que sobrevive entre visitas (como as variáveis do módulo no site)
const mem = { filtro: "todos", aba: "lista" };
const ranking: any = { tipo: "acoes", freq: "qualquer", dyMin: 4, liqMin: 1, ordem: "nota", resultado: null, chave: null, carregando: false, progresso: 0 };

// ---------------------------------------------------------------- linha do ativo
function LinhaAtivo({ a }: { a: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  if (a.erro) {
    return <Item onPress={() => formAtivo(a.item)} chevron esquerda={<Anel score={null} cor="cinza" />} titulo={a.ticker} detalhe={a.erro} />;
  }
  const p = a.posicao, g = a.graham;
  const rt = FC.estado.dados.rentab && FC.estado.dados.rentab.ativos.find((x: any) => x.ticker === a.ticker);
  return (
    <Item onPress={() => abreAtivo(a.ticker)} chevron esquerda={<Anel score={a.score} cor={a.cor} />}
      titulo={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><T style={{ fontWeight: "600", fontSize: 15 }}>{a.ticker}</T>{a.na_carteira ? null : <Pilula cor="cinza">watchlist</Pilula>}</View>}
      detalhe={
        <View>
          <T style={{ fontSize: 13, color: t.cores.ink2 }} numberOfLines={1}>{a.tipo_rotulo}{a.segmento ? " · " + a.segmento : ""} · {FC.PILAR_NOME[a.pilar] || ""}</T>
          {estreito && g && g.valor != null ? (
            <Num style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: 2 }}>Graham {FC.fmt.preco(g.valor)} · <Text style={{ color: g.margem >= 0 ? t.cores.verde : t.cores.vermelho }}>{FC.fmt.delta(g.margem, 0)}%</Text></Num>
          ) : null}
        </View>}
      direita={estreito ? (
        <View style={{ alignItems: "flex-end", minWidth: 92 }}>
          <Num style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.preco(a.preco)}</Num>
          <Num cls={ok(a.variacao_dia) ? (a.variacao_dia >= 0 ? "pos" : "neg") : null} style={{ fontSize: 12.5, color: ok(a.variacao_dia) ? undefined : t.cores.ink2 }}>
            {ok(a.variacao_dia) ? FC.fmt.delta(a.variacao_dia, 2) + "% hoje" : "preço"}</Num>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 }}>
          <View style={{ flex: 1.2, minWidth: 0, maxWidth: 300 }}><Indicadores ativo={a} /></View>
          <View style={{ alignItems: "flex-end", minWidth: 92 }}>
            <Num style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.preco(a.preco)}</Num>
            <Num cls={ok(a.variacao_dia) ? (a.variacao_dia >= 0 ? "pos" : "neg") : null} style={{ fontSize: 12.5, color: ok(a.variacao_dia) ? undefined : t.cores.ink2 }}>
              {ok(a.variacao_dia) ? FC.fmt.delta(a.variacao_dia, 2) + "% hoje" : "preço"}</Num>
          </View>
          <View style={{ alignItems: "flex-end", minWidth: 104 }} accessibilityLabel="Preço justo de Graham e a margem de segurança">
            {g && g.valor != null ? (
              <><Num style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.preco(g.valor)}</Num>
                <Num cls={g.margem >= 0 ? "pos" : "neg"} style={{ fontSize: 12.5 }}>{FC.fmt.delta(g.margem, 0)}% Graham</Num></>
            ) : <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>{g ? (/bancos/.test(g.motivo || "") ? "Graham não se aplica" : "Graham n/a") : "—"}</T>}
          </View>
          <View style={{ alignItems: "flex-end", minWidth: 120 }}>
            {p ? (
              <><Rs style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(p.atual)}</Rs>
                <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.qtd(p.quantidade)} {FC.unidade(a, p.quantidade)}{ok(rt && rt.periodo_pct)
                  ? <> · <Text style={{ color: rt.periodo_pct >= 0 ? t.cores.verde : t.cores.vermelho }}>{FC.fmt.delta(rt.periodo_pct)}%</Text></> : null}</T></>
            ) : <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>sem posição</T>}
          </View>
          <View style={{ width: 120, alignItems: "flex-end" }}><Pilula cor={a.cor}>{a.veredito_curto}</Pilula></View>
        </View>
      )} />
  );
}

function ListaAtivos({ d, filtro }: { d: any; filtro: string }) {
  let ativos = [...d.ativos];
  if (filtro === "carteira") ativos = ativos.filter((a) => a.na_carteira);
  if (filtro === "watchlist") ativos = ativos.filter((a) => !a.na_carteira);
  if (filtro === "dividendos") {
    const pr = FC.estado.proventos || {};
    const ha12 = FC.datas.soma(FC.datas.hoje(), -365);
    ativos = ativos.filter((a) => ((pr[a.ticker] || {}).lista || []).some((p: any) => p.data_com > ha12));
  }
  ativos.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  if (!ativos.length) {
    return (
      <Lista>
        <Vazio icone="📈" titulo={d.ativos.length ? "Nada neste filtro" : "Nenhum ativo ainda"}
          texto={d.ativos.length ? "Troque o filtro acima para ver os outros." : "Adicione ações, FIIs, ETFs ou criptomoedas. O painel busca as cotações e avalia cada um pelas quatro lentes."}
          acao={d.ativos.length ? undefined : <Botao onPress={() => formAtivo()}>Adicionar ativo</Botao>} />
      </Lista>
    );
  }
  return <Lista>{ativos.map((a) => <LinhaAtivo key={a.ticker} a={a} />)}</Lista>;
}

// ---------------------------------------------------------------- renda fixa
function impostoDo(r: any) {
  if (!FC.impostos || typeof FC.impostos.titulo !== "function") return null;
  try { return FC.impostos.titulo(r, ((FC.estado.prefs.premissas || {}).titulos || {})[r.id]) || null; } catch (e) { console.error(e); return null; }
}

function RendaFixa({ d }: { d: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const impostos: Record<string, any> = Object.fromEntries(d.rendaFixa.map((r: any) => [r.id, impostoDo(r)]));
  const algumIsento = Object.values(impostos).some((x: any) => x && x.isento);
  return (
    <Secao titulo="Renda fixa" sub={ok(d.macro && d.macro.cdi) ? `taxa bruta comparada ao CDI de hoje (${FC.fmt.num(d.macro.cdi)}%)` : "CDBs, Tesouro e caixa"}
      direita={<Botao variante="sec" pequeno icone="aportes" onPress={() => formRendaFixa()}>Título</Botao>}>
      {d.rendaFixa.length ? (
        <>
          <Lista>
            {d.rendaFixa.map((r: any) => {
              const imp = impostos[r.id];
              return (
                <Item key={r.id} chevron detalheLinhas={2}
                  onPress={() => { const x = FC.estado.base.rendaFixa.find((y: any) => String(y.id) === String(r.id)); if (x) formRendaFixa(x); }}
                  esquerda={<Icone nome="moeda" tam={26} cor={t.cores.verde} />} titulo={r.nome}
                  detalhe={`${r.base}${r.rent && r.rent.manual ? " · valor informado em " + FC.datas.br(r.rent.manual.data) : ""}${r.vencimento ? " · vence " + FC.datas.br(r.vencimento) : ""}${ok(r.real) ? " · real " + FC.fmt.num(r.real) + "% a.a." : ""}`}
                  direita={estreito ? null : <Pilula cor={r.cor}>{ok(r.premio_cdi) ? r.leitura + (imp && imp.isento ? " (bruto; isento)" : " (bruto)") : r.leitura}</Pilula>}
                  valores={
                    <View style={{ alignItems: "flex-end" }}>
                      <Rs style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(r.valor_aplicado)}</Rs>
                      {imp ? <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{imp.isento ? "isento de IR" : ok(imp.liquido) ? <>líquido ~<Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(imp.liquido)}</Rs></> : ""}</T> : null}
                      {r.rent && r.rent.aplicado > 0 ? (
                        <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>aplicou <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(r.rent.aplicado)}</Rs> · <Rs cls={r.rent.ganho >= 0 ? "pos" : "neg"} style={{ fontSize: 12.5 }}>{sinal(r.rent.ganho)}{FC.fmt.brlTexto(Math.abs(r.rent.ganho))}</Rs></T>
                      ) : <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{ok(r.nominal) ? FC.fmt.num(r.nominal) + "% a.a." : ""}</T>}
                    </View>} />
              );
            })}
          </Lista>
          <T v="p" style={{ marginTop: t.espaco.e3 }}>
            O valor de cada título é o que ele vale hoje: cada aporte rende da própria data, pela própria taxa, com o CDI, a Selic ou o IPCA de cada dia útil (valor bruto, antes de IR{FC.impostos ? "; o líquido ao lado é uma estimativa de IR e IOF se você resgatasse hoje" : ""}). A comparação com o CDI ao lado é bruta e é a foto de hoje.{algumIsento ? " Nos títulos isentos de IR (LCI, LCA, debêntures incentivadas), a comparação justa é com o CDI líquido de IR, que rende menos que o CDI bruto." : ""} Um título IPCA+ rende menos que o CDI enquanto a Selic está alta e a inflação baixa, e a relação se inverte no cenário oposto.
          </T>
        </>
      ) : (
        <Lista>
          <Vazio icone="🏦" titulo="Nenhum título" texto="Cadastre CDBs, Tesouro Direto ou a conta remunerada para eles entrarem no patrimônio e na alocação."
            acao={<Botao onPress={() => formRendaFixa()}>Adicionar título</Botao>} />
        </Lista>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------- análise avulsa
function Analisar() {
  const t = useTema();
  const [cod, setCod] = useState("");
  const [classe, setClasse] = useState("auto");
  const uni = FC.estado.mercado.universo;
  const todos = useMemo(() => (uni ? [...Object.keys(uni.acoes), ...Object.keys(uni.fiis)].sort() : []), [uni]);
  const sugestoes = cod.length >= 2 ? todos.filter((x) => x.startsWith(cod.toUpperCase()) && x !== cod.toUpperCase()).slice(0, 6) : [];
  const analisa = async (bruto = cod) => {
    const ticker = bruto.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (ticker.length < 2) { ui.aviso("Digite um código.", "erro"); return; }
    if (acharAtivo(ticker)) { abreAtivo(ticker); return; }
    await analisaAvulso(ticker, classe === "auto" ? adivinhaClasse(ticker) : classe);
  };
  return (
    <Cartao style={{ paddingVertical: 16, paddingHorizontal: 20, marginBottom: t.espaco.e4 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Icone nome="ativos" tam={22} cor={t.cores.acento} />
        <View style={{ flex: 1, minWidth: 180 }}>
          <Entrada valor={cod} aoMudar={setCod} maiusculas placeholder="Analisar qualquer código: PETR4, HGLG11, BOVA11, BTC…"
            accessibilityLabel="Código para analisar" onSubmitEditing={() => analisa()} returnKeyType="search" />
        </View>
        <View style={{ width: 190 }}>
          <Seletor valor={classe} aoMudar={setClasse} rotuloA11y="Tipo"
            opcoes={[{ v: "auto", rotulo: "Tipo automático" }, ...FC.classesLigadas().map(([k, v]: any) => ({ v: k, rotulo: v }))]} />
        </View>
        <Botao onPress={() => analisa()}>Analisar</Botao>
      </View>
      {sugestoes.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {sugestoes.map((s) => (
            <Pressable key={s} onPress={() => { setCod(s); analisa(s); }}
              style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 980, backgroundColor: t.cores.campo }}>
              <Text style={{ fontSize: 13, color: t.cores.ink }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Cartao>
  );
}

// ---------------------------------------------------------------- pagadoras
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

function Calendario({ meses, alto = 14, largo = 7, gap = 2, rotulos }: { meses: number[]; alto?: number; largo?: number; gap?: number; rotulos?: boolean }) {
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

function Pagadoras() {
  const t = useTema();
  const [, setTick] = useState(0);
  const [dy, setDy] = useState(String(ranking.dyMin));
  const [liq, setLiq] = useState(String(ranking.liqMin));
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
          <Segmentado valor={ranking.tipo} aoMudar={(v) => { ranking.dyMin = v === "fiis" ? 8 : 4; setDy(String(ranking.dyMin)); muda("tipo", v); }}
            opcoes={[{ v: "acoes", rotulo: "Ações" }, { v: "fiis", rotulo: "FIIs" }]} />
          <View style={{ minWidth: 170 }}><Campo rotulo="Frequência"><Seletor valor={ranking.freq} aoMudar={(v) => muda("freq", v)} rotuloA11y="Frequência"
            opcoes={[{ v: "qualquer", rotulo: "Qualquer" }, { v: "mensal", rotulo: "Mensal" }, { v: "trimestral", rotulo: "Trimestral ou mais" }, { v: "regular", rotulo: "Pagou nos 5 últimos anos" }]} /></Campo></View>
          <View style={{ width: 120 }}><Campo rotulo="DY mínimo (%)"><Entrada valor={dy} aoMudar={setDy} decimal accessibilityLabel="DY mínimo" /></Campo></View>
          <View style={{ width: 150 }}><Campo rotulo="Liquidez (R$ mi/dia)"><Entrada valor={liq} aoMudar={setLiq} decimal accessibilityLabel="Liquidez mínima" /></Campo></View>
          <View style={{ minWidth: 150 }}><Campo rotulo="Ordenar por"><Seletor valor={ranking.ordem} aoMudar={(v) => muda("ordem", v)} rotuloA11y="Ordenar por"
            opcoes={[{ v: "nota", rotulo: "Nota de dividendos" }, { v: "dy", rotulo: "DY 12 meses" }, { v: "regularidade", rotulo: "Regularidade" }]} /></Campo></View>
        </View>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Pré-seleciona as {ranking.tipo === "fiis" ? "FIIs" : "ações"} líquidas de maior DY no Fundamentus e analisa os proventos reais de cada uma: frequência, meses de pagamento, 5 anos de histórico, crescimento e payout. Não é recomendação.</T>
      </Cartao>
      {!pronto ? (
        <Cartao>
          <T style={{ marginBottom: t.espaco.e3 }}>Analisando os proventos de cada {ranking.tipo === "fiis" ? "fundo" : "empresa"}… a primeira vez leva alguns segundos.</T>
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

// análise completa de uma pagadora
function abrePagadora(r: any) {
  if (!r) return;
  ui.folha({
    titulo: `${r.ticker} · dividendos`, larga: true,
    corpo: <CorpoPagadora r={r} />,
    rodape: (api) => (
      <>
        <Botao variante="sec" onPress={() => { api.fechar(); setTimeout(() => (acharAtivo(r.ticker) ? abreAtivo(r.ticker) : analisaAvulso(r.ticker, r.classe)), 240); }}>Análise das 4 lentes</Botao>
        <Botao onPress={() => { api.fechar(); setTimeout(() => formAtivo({ ticker: r.ticker, classe: r.classe, pilar: r.classe === "fii" ? "real_estate" : "acoes", lista: "watchlist", quantidade: 0, _novo: true }), 240); }}>Adicionar</Botao>
      </>
    ),
  });
}

function CorpoPagadora({ r }: { r: any }) {
  const t = useTema();
  const barrasAno = r.anos.map((a: any) => ({ rotulo: String(a.ano), titulo: `${a.ano} · ${a.eventos} pagamento(s)`, valor: a.valor, cor: "var(--s2)" }))
    .concat([{ rotulo: "12m", titulo: "últimos 12 meses", valor: r.soma12, cor: "var(--s1)" }]);
  const ultimos = [...(r.lista || [])].sort((a: any, b: any) => (b.pagamento || b.data_com).localeCompare(a.pagamento || a.data_com)).slice(0, 12);
  const notas: Array<[string, number, string]> = [["DY", r.notas.dy, "30%"], ["Anos pagando", r.notas.consistencia, "20%"], ["Frequência", r.notas.frequencia, "15%"],
    ["Estabilidade", r.notas.estabilidade, "15%"], ["Crescimento", r.notas.crescimento, "10%"], ["Payout", r.notas.payout, "10%"]];
  const h3 = (txt: string, topo = 22) => <T style={{ fontSize: 17, fontWeight: "600", marginTop: topo, marginBottom: 8 }}>{txt}</T>;
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20, marginBottom: 20, alignItems: "center" }}>
        <Anel score={r.nota} cor={r.cor} grande />
        <View style={{ flex: 1, minWidth: 180 }}>
          <T style={{ fontSize: 13, color: t.cores.ink2 }}>{r.segmento || (r.classe === "fii" ? "Fundo imobiliário" : "Ação")}</T>
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
      </Kpis>
      {r.alertas.map((a: string, i: number) => <Mensagem key={i} tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e3 }}>{a}</Mensagem>)}
      {h3("Proventos por cota, por ano", 18)}
      <T v="p" style={{ marginBottom: t.espaco.e3 }}>R$ pagos por cota em cada ano (pela data com) e nos últimos 12 meses.</T>
      <Grafico marcador={FC.graficos.colunas({ barras: barrasAno, y: "num", privado: false, altura: 200 })} />
      {h3("Meses em que paga")}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}><Calendario meses={r.meses} rotulos alto={34} gap={6} /></View>
      <T v="p" style={{ marginTop: t.espaco.e2 }}>Verde forte: pagou nesse mês em pelo menos 2 dos últimos 3 anos.</T>
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
    </View>
  );
}

// ---------------------------------------------------------------- tela
export default function Ativos() {
  const t = useTema();
  const e = useEstado();
  const { ticker } = useLocalSearchParams<{ ticker?: string }>();
  const [aba, setAba] = useState(mem.aba);
  const [filtro, setFiltro] = useState(mem.filtro);
  useEffect(() => { if (ticker) setTimeout(() => abreAtivo(String(ticker).toUpperCase()), 200); }, [ticker]);
  const d = e.dados;
  if (!d) return <Pagina><EstadoMercado /></Pagina>;
  const nCart = d.ativos.filter((a: any) => a.na_carteira).length;
  const mudaFiltro = async (f: string) => {
    mem.filtro = f; setFiltro(f);
    if (f === "dividendos" && !FC.estado.proventos) { await FC.carregaProventos(); rerender(); }
  };
  return (
    <Pagina>
      <Cabecalho titulo="Investimentos" sub="Ações, FIIs, ETFs e cripto pelos seus critérios, e a renda fixa contra o CDI."
        direita={<Botao icone="aportes" onPress={() => formAtivo()}>Ativo</Botao>} />
      <EstadoMercado />
      <View style={{ marginBottom: t.espaco.e4 }}>
        <Segmentado rotuloA11y="Seção" valor={aba} aoMudar={(v) => { mem.aba = v; setAba(v); }}
          opcoes={[{ v: "lista", rotulo: "Minha lista" }, { v: "pagadoras", rotulo: "Pagadoras de dividendos" }]} />
      </View>
      {aba === "pagadoras" ? <Pagadoras /> : (
        <View>
          <Analisar />
          <ResumoInvestido d={d} />
          <View style={{ marginTop: t.espaco.e4, marginBottom: t.espaco.e3 }}><T v="h2">Sua lista</T></View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: t.espaco.e3, marginBottom: t.espaco.e3 }}>
            <Segmentado rotuloA11y="Filtrar" valor={filtro} aoMudar={mudaFiltro}
              opcoes={[{ v: "todos", rotulo: `Todos · ${d.ativos.length}` }, { v: "carteira", rotulo: `Carteira · ${nCart}` },
                { v: "watchlist", rotulo: `Watchlist · ${d.ativos.length - nCart}` }, { v: "dividendos", rotulo: "Pagam dividendos" }]} />
            <T v="p">ordenados pela aderência aos seus critérios</T>
          </View>
          <ListaAtivos d={d} filtro={filtro} />
          <RendaFixa d={d} />
        </View>
      )}
    </Pagina>
  );
}
