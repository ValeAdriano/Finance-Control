/* Investimentos › Ativos: pesquisar o mercado por tipo. Ações e FIIs vêm do
 * Fundamentus (todo o universo), a renda fixa do Tesouro Direto e os outros
 * tipos pela análise de qualquer código. Cada tipo abre a sua análise. */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import { Botao, Cartao, Item, Lista, Num, Pilula, Roda, T, Vazio } from "../ui/kit";
import { Campo, Entrada, Segmentado, Seletor } from "../ui/campos";
import { Icone } from "../ui/icone";
import { ui } from "../ui/folha";
import { EstadoMercado } from "./comum/alertas";
import { abreAtivo, analisaAvulso } from "./comum/ativo";
import { acharAtivo, adivinhaClasse } from "./comum/dados";
import { CabecalhoInvestimentos } from "./comum/investimentos";
import { Pagadoras } from "./comum/pagadoras";
import { Variacao } from "./comum/preco";
import { ListaTesouro } from "./comum/tesouro";
import { abreComparar } from "./comum/comparar";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);

type Tipo = "acoes" | "fiis" | "renda_fixa" | "outros";
type Modo = "indicadores" | "dividendos";
// estado da tela que sobrevive entre visitas
const mem: { tipo: Tipo; modo: Modo; busca: string; ordem: Record<string, string>; liq: Record<string, string>; segmento: string } = {
  tipo: "acoes", modo: "indicadores", busca: "", ordem: { acoes: "liquidez", fiis: "liquidez" }, liq: { acoes: "1", fiis: "0.5" }, segmento: "todos",
};
const PAGINA = 30;

const ORDENS: Record<"acoes" | "fiis", Array<{ v: string; rotulo: string; f: (x: any) => number | null; asc?: boolean }>> = {
  acoes: [
    { v: "liquidez", rotulo: "Mais negociadas", f: (x) => x.liquidez },
    { v: "dy", rotulo: "Maior DY", f: (x) => x.dy },
    { v: "pl", rotulo: "Menor P/L", f: (x) => (x.pl > 0 ? x.pl : null), asc: true },
    { v: "pvp", rotulo: "Menor P/VP", f: (x) => (x.pvp > 0 ? x.pvp : null), asc: true },
    { v: "graham", rotulo: "Maior margem de Graham", f: (x) => (x.graham && ok(x.graham.valor) ? x.graham.margem : null) },
    { v: "roe", rotulo: "Maior ROE", f: (x) => x.roe },
  ],
  fiis: [
    { v: "liquidez", rotulo: "Mais negociados", f: (x) => x.liquidez },
    { v: "dy", rotulo: "Maior DY", f: (x) => x.dy },
    { v: "pvp", rotulo: "Menor P/VP", f: (x) => (x.pvp > 0 ? x.pvp : null), asc: true },
    { v: "vacancia", rotulo: "Menor vacância", f: (x) => x.vacancia, asc: true },
    { v: "valor_mercado", rotulo: "Maior patrimônio", f: (x) => x.valor_mercado },
  ],
};
const LIQUIDEZ = [{ v: "0", rotulo: "Qualquer" }, { v: "0.1", rotulo: "> R$ 100 mil/dia" }, { v: "0.5", rotulo: "> R$ 500 mil/dia" },
  { v: "1", rotulo: "> R$ 1 mi/dia" }, { v: "10", rotulo: "> R$ 10 mi/dia" }];

const fmtPct = (v: any, casas = 1) => (ok(v) ? FC.fmt.num(v, casas) + "%" : "—");
const fmtNum = (v: any) => (ok(v) ? FC.fmt.num(v, 2) : "—");
const curto = (v: number) => (v >= 1e9 ? FC.fmt.num(v / 1e9, 1) + " bi" : v >= 1e6 ? FC.fmt.num(v / 1e6, 1) + " mi" : FC.fmt.num(v / 1e3, 0) + " mil");

// ---------------------------------------------------------------- linha do mercado
function LinhaMercado({ x, tipo }: { x: any; tipo: "acoes" | "fiis" }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const meu = acharAtivo(x.ticker);
  const classe = tipo === "fiis" ? "fii" : "acao_br";
  const abre = () => (meu && !meu.erro ? abreAtivo(x.ticker) : analisaAvulso(x.ticker, classe));
  const preco = meu && ok(meu.preco) ? meu.preco : x.cotacao;
  const g = x.graham;
  const resumo = tipo === "acoes"
    ? `P/L ${fmtNum(x.pl)} · P/VP ${fmtNum(x.pvp)} · DY ${fmtPct(x.dy)}${estreito ? "" : ` · ROE ${fmtPct(x.roe)}`}`
    : `${x.segmento || "—"} · P/VP ${fmtNum(x.pvp)} · DY ${fmtPct(x.dy)}${ok(x.vacancia) && x.vacancia > 0 ? ` · vacância ${fmtPct(x.vacancia)}` : ""}`;
  return (
    <Item onPress={abre} chevron detalheLinhas={2}
      titulo={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <T style={{ fontWeight: "600", fontSize: 15 }}>{x.ticker}</T>
          {meu ? <Pilula cor={meu.na_carteira ? "azul" : "cinza"}>{meu.na_carteira ? "na carteira" : "acompanhando"}</Pilula> : null}
        </View>}
      detalhe={
        <View style={{ gap: 4 }}>
          <T style={{ fontSize: 13, color: t.cores.ink2 }} numberOfLines={2}>{resumo}</T>
          {tipo === "acoes" && g ? (
            g.valor != null ? <Pilula cor={g.cor}>{`Graham ${FC.fmt.preco(g.valor)} · ${g.leitura}`}</Pilula> : null
          ) : null}
          {tipo === "fiis" && ok(x.pvp) ? <Pilula cor={x.pvp < 0.95 ? "verde" : x.pvp <= 1.05 ? "azul" : "amarelo"}>{x.pvp < 0.95 ? "abaixo do patrimônio" : x.pvp <= 1.05 ? "perto do patrimônio" : "acima do patrimônio"}</Pilula> : null}
        </View>}
      valores={
        <View style={{ alignItems: "flex-end", gap: 3, minWidth: 86 }}>
          <Num style={{ fontWeight: "600", fontSize: 15 }}>{ok(preco) ? FC.fmt.preco(preco) : "—"}</Num>
          {meu && ok(meu.variacao_dia) ? <Variacao v={meu.variacao_dia} sufixo="hoje" pequeno />
            : <T style={{ fontSize: 12, color: t.cores.ink3 }}>{ok(x.liquidez) ? `R$ ${curto(x.liquidez)}/dia` : ""}</T>}
        </View>} />
  );
}

// ---------------------------------------------------------------- ações e FIIs
function ListaMercado({ tipo, busca }: { tipo: "acoes" | "fiis"; busca: string }) {
  const t = useTema();
  const [ordem, setOrdem] = useState(mem.ordem[tipo]);
  const [liq, setLiq] = useState(mem.liq[tipo]);
  const [seg, setSeg] = useState(mem.segmento);
  const [qtd, setQtd] = useState(PAGINA);
  useEffect(() => { setOrdem(mem.ordem[tipo]); setLiq(mem.liq[tipo]); setQtd(PAGINA); }, [tipo]);
  useEffect(() => { setQtd(PAGINA); }, [busca, ordem, liq, seg]);
  const u = FC.estado.mercado.universo;
  const todos = useMemo(() => {
    if (!u) return [];
    const fonte = tipo === "fiis" ? u.fiis : u.acoes;
    return Object.values<any>(fonte).filter((x) => x.cotacao > 0)
      .map((x) => (tipo === "acoes" ? { ...x, graham: FC.graham(x.cotacao, x.pl, x.pvp, { ticker: x.ticker }) } : x));
  }, [u, tipo]);
  if (!u) return <View style={{ minHeight: 160, alignItems: "center", justifyContent: "center" }}><Roda /></View>;
  const segmentos = tipo === "fiis" ? [...new Set(todos.map((x) => x.segmento).filter(Boolean))].sort() : [];
  const q = busca.trim().toUpperCase();
  const minimo = (Number(liq) || 0) * 1e6;
  const o = ORDENS[tipo].find((x) => x.v === ordem) || ORDENS[tipo][0];
  let l = todos.filter((x) => (q ? x.ticker.startsWith(q) || (tipo === "fiis" && (x.segmento || "").toUpperCase().includes(q)) : (x.liquidez || 0) >= minimo));
  if (tipo === "fiis" && seg !== "todos") l = l.filter((x) => x.segmento === seg);
  l = l.filter((x) => q || o.f(x) != null).sort((a, b) => {
    const va = o.f(a), vb = o.f(b);
    if (va == null) return 1; if (vb == null) return -1;
    return o.asc ? va - vb : vb - va;
  });
  if (q) l.sort((a, b) => Number(b.ticker === q) - Number(a.ticker === q));
  const classe = tipo === "fiis" ? "fii" : "acao_br";
  const mudaOrdem = (v: string) => { mem.ordem[tipo] = v; setOrdem(v); };
  const mudaLiq = (v: string) => { mem.liq[tipo] = v; setLiq(v); };
  const mudaSeg = (v: string) => { mem.segmento = v; setSeg(v); };
  const qFormatoTicker = /^[A-Z]{4}\d{1,2}$/.test(q);
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: t.espaco.e3 }}>
        <View style={{ flexGrow: 1, flexBasis: 150, maxWidth: 260 }}><Campo rotulo="Ordenar"><Seletor valor={ordem} aoMudar={mudaOrdem} rotuloA11y="Ordenar" opcoes={ORDENS[tipo].map(({ v, rotulo }) => ({ v, rotulo }))} /></Campo></View>
        <View style={{ flexGrow: 1, flexBasis: 150, maxWidth: 260 }}><Campo rotulo="Liquidez"><Seletor valor={liq} aoMudar={mudaLiq} rotuloA11y="Liquidez mínima" opcoes={LIQUIDEZ} /></Campo></View>
        {tipo === "fiis" ? (
          <View style={{ flexGrow: 1, flexBasis: 150, maxWidth: 260 }}><Campo rotulo="Segmento"><Seletor valor={seg} aoMudar={mudaSeg} rotuloA11y="Segmento"
            opcoes={[{ v: "todos", rotulo: "Todos" }, ...segmentos.map((s) => ({ v: s, rotulo: s }))]} /></Campo></View>
        ) : null}
        <Botao variante="sec" icone="simular" onPress={() => abreComparar([], classe)}>Comparar</Botao>
      </View>
      {l.length ? (
        <>
          <T v="p" style={{ marginBottom: t.espaco.e2 }}>{l.length} {tipo === "fiis" ? "fundos" : "ações"}{q ? ` com “${busca.trim()}”` : ""}{!q && minimo ? " com essa liquidez" : ""}</T>
          <Lista>{l.slice(0, qtd).map((x) => <LinhaMercado key={x.ticker} x={x} tipo={tipo} />)}</Lista>
          {l.length > qtd ? <View style={{ alignItems: "center", marginTop: t.espaco.e3 }}><Botao variante="sec" onPress={() => setQtd(qtd + PAGINA)}>Ver mais {Math.min(PAGINA, l.length - qtd)}</Botao></View> : null}
        </>
      ) : (
        <Lista>
          <Vazio icone="🔎" titulo={q ? `Não achei “${busca.trim()}” entre as ${tipo === "fiis" ? "FIIs" : "ações"}` : "Nada com esses filtros"}
            texto={q ? (qFormatoTicker ? "Pode ser um ETF ou um papel fora do Fundamentus. Dá para analisar mesmo assim." : "Confira o código.") : "Baixe a liquidez mínima ou troque o segmento."}
            acao={q && qFormatoTicker ? <Botao onPress={() => analisaAvulso(q, adivinhaClasse(q))}>Analisar {q}</Botao> : undefined} />
        </Lista>
      )}
      <T v="p" style={{ marginTop: t.espaco.e3 }}>
        {tipo === "acoes"
          ? "Indicadores do Fundamentus (atualizados a cada 6 horas). Graham = √(22,5 × LPA × VPA), não vale para bancos nem para quem teve prejuízo. Toque numa ação para ver o gráfico, a análise pelas suas regras e os dividendos mês a mês."
          : "Indicadores do Fundamentus (atualizados a cada 6 horas). P/VP abaixo de 1: a cota custa menos que o patrimônio do fundo. Toque num FII para ver o raio-x da CVM, o gráfico e os rendimentos mês a mês."}
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- outros tipos
function Outros() {
  const t = useTema();
  const [cod, setCod] = useState("");
  const outras = FC.classesLigadas().filter(([k]: any) => !["acao_br", "fii"].includes(k));
  const [classe, setClasse] = useState(outras.length ? outras[0][0] : "etf_br");
  const analisa = async (bruto = cod) => {
    const ticker = bruto.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (ticker.length < 2) { ui.aviso("Digite um código.", "erro"); return; }
    if (acharAtivo(ticker)) { abreAtivo(ticker); return; }
    await analisaAvulso(ticker, classe);
  };
  const exemplos: Record<string, string[]> = { etf_br: ["BOVA11", "IVVB11", "SMAL11", "HASH11"], acao_us: ["AAPL", "MSFT", "KO", "JNJ"], etf_us: ["VOO", "QQQ", "VT", "SCHD"], cripto: ["BTC", "ETH", "SOL"] };
  const meus = ((FC.estado.dados && FC.estado.dados.ativos) || []).filter((a: any) => a.classe === classe);
  return (
    <View>
      <Cartao style={{ paddingVertical: 16, paddingHorizontal: 20, marginBottom: t.espaco.e4 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <View style={{ width: 190 }}>
            <Seletor valor={classe} aoMudar={setClasse} rotuloA11y="Tipo" opcoes={outras.map(([k, v]: any) => ({ v: k, rotulo: v }))} />
          </View>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Entrada valor={cod} aoMudar={setCod} maiusculas placeholder={`Código: ${(exemplos[classe] || []).slice(0, 2).join(", ")}…`}
              accessibilityLabel="Código para analisar" onSubmitEditing={() => analisa()} returnKeyType="search" />
          </View>
          <Botao onPress={() => analisa()}>Analisar</Botao>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {(exemplos[classe] || []).map((s) => (
            <Pressable key={s} onPress={() => { setCod(s); analisa(s); }}
              style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 980, backgroundColor: t.cores.campo }}>
              <Text style={{ fontSize: 13, color: t.cores.ink }}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>{classe === "cripto" ? "Criptomoedas são avaliadas pelo preço contra a própria história (CoinGecko, em reais)." : "ETFs e ações dos EUA são avaliados pelo preço contra a própria história (Yahoo Finance, convertido para reais)."}</T>
      </Cartao>
      {meus.length ? (
        <>
          <T v="h3" style={{ marginBottom: t.espaco.e2 }}>Na sua lista</T>
          <Lista>
            {meus.map((a: any) => (
              <Item key={a.ticker} chevron onPress={() => abreAtivo(a.ticker)} titulo={a.ticker} detalhe={a.tipo_rotulo}
                valores={<View style={{ alignItems: "flex-end", gap: 3 }}><Num style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.preco(a.preco)}</Num><Variacao v={a.variacao_dia} pequeno /></View>} />
            ))}
          </Lista>
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- tela
export default function Ativos() {
  const t = useTema();
  useEstado();
  const { ticker } = useLocalSearchParams<{ ticker?: string }>();
  const [tipo, setTipo] = useState<Tipo>(mem.tipo);
  const [modo, setModo] = useState<Modo>(mem.modo);
  const [busca, setBusca] = useState(mem.busca);
  useEffect(() => {
    if (!ticker) return;
    const c = String(ticker).toUpperCase();
    setTimeout(() => (acharAtivo(c) ? abreAtivo(c) : analisaAvulso(c, adivinhaClasse(c))), 200);
  }, [ticker]);
  useEffect(() => { const id = setTimeout(() => { mem.busca = busca; }, 300); return () => clearTimeout(id); }, [busca]);
  const tipos: Array<{ v: Tipo; rotulo: string }> = [{ v: "acoes", rotulo: "Ações" }];
  if (FC.classesLigadas().some(([k]: any) => k === "fii")) tipos.push({ v: "fiis", rotulo: "FIIs" });
  tipos.push({ v: "renda_fixa", rotulo: "Renda fixa" }, { v: "outros", rotulo: "ETFs e outros" });
  const tipoAtual = tipos.some((x) => x.v === tipo) ? tipo : "acoes";
  const mudaTipo = (v: Tipo) => { mem.tipo = v; setTipo(v); };
  const mudaModo = (v: Modo) => { mem.modo = v; setModo(v); };
  const bolsa = tipoAtual === "acoes" || tipoAtual === "fiis";
  return (
    <Pagina>
      <CabecalhoInvestimentos aba="ativos" sub="Pesquise o mercado: ações e FIIs do Fundamentus, o Tesouro Direto e qualquer outro código." />
      <EstadoMercado />
      <View style={{ gap: t.espaco.e3, marginBottom: t.espaco.e4 }}>
        <Segmentado rotuloA11y="Tipo de ativo" valor={tipoAtual} aoMudar={mudaTipo} opcoes={tipos} />
        {tipoAtual !== "outros" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icone nome="ativos" tam={20} cor={t.cores.ink3} />
            <View style={{ flex: 1 }}>
              <Entrada valor={busca} aoMudar={setBusca} maiusculas={tipoAtual !== "renda_fixa"} returnKeyType="search"
                accessibilityLabel="Pesquisar"
                placeholder={tipoAtual === "acoes" ? "Pesquisar pelo código: PETR4, ITSA4…" : tipoAtual === "fiis" ? "Código ou segmento: HGLG11, Logística…" : "Pesquisar: Selic, IPCA, 2035…"} />
            </View>
          </View>
        ) : null}
        {bolsa ? (
          <Segmentado rotuloA11y="Análise" valor={modo} aoMudar={mudaModo}
            opcoes={[{ v: "indicadores", rotulo: "Indicadores" }, { v: "dividendos", rotulo: "Pagadoras de dividendos" }]} />
        ) : null}
      </View>
      {bolsa && modo === "dividendos" ? <Pagadoras tipo={tipoAtual as "acoes" | "fiis"} />
        : bolsa ? <ListaMercado tipo={tipoAtual as "acoes" | "fiis"} busca={busca} />
          : tipoAtual === "renda_fixa" ? <ListaTesouro busca={busca} />
            : <Outros />}
    </Pagina>
  );
}
