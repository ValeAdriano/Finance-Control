/* Cripto: o mercado inteiro, no jeito do CoinMarketCap. Números do mercado
 * (market cap total, volume, dominância), maiores altas e quedas e o ranking
 * das 100 maiores com preço, 1 h, 24 h, 7 dias, market cap, volume e a linha
 * de 7 dias. As moedas da carteira aparecem marcadas (e entram no fim, se
 * estiverem fora do top 100). Atualiza sozinho a cada minuto. */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../tema";
import { useMedidas } from "../ui/medidas";
import { aoPuxar, Pagina } from "../casca/casca";
import { Botao, Cabecalho, Cartao, Grade, Kpi, Kpis, Mensagem, Pilula, Roda, Secao, T, Vazio } from "../ui/kit";
import { Entrada, Segmentado } from "../ui/campos";
import { Sparkline, eixoBrl } from "../ui/grafico-cripto";
import { LogoMoeda, SeloAoVivo, Var } from "./comum/ao-vivo";
import { atualizaMercadoCripto, criptosDoUsuario, simboloBase, useAoVivo, useCripto } from "../estado/cripto";
import FC from "../nucleo";

type Ordem = "rank" | "alta" | "queda" | "volume";
type Filtro = "todas" | "minhas";
// estado da tela que sobrevive entre visitas
const mem: { ordem: Ordem; filtro: Filtro; busca: string } = { ordem: "rank", filtro: "todas", busca: "" };
const PAGINA = 50;

export const abreMoeda = (id: string) => router.push(`/cripto/${encodeURIComponent(id)}` as any);
const preco = (v: number | null) => (FC.ok(v) ? "R$ " + FC.fmt.preco(v) : "—");

// ---------------------------------------------------------------- linha do ranking
// colunas da tabela larga: [largura, alinhamento]
const COLS = { rank: 36, preco: 128, v: 76, mcap: 132, vol: 120, spark: 124 };

function LinhaMoeda({ m, minha, largo }: { m: any; minha: boolean; largo: boolean }) {
  const t = useTema();
  const nome = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
      <LogoMoeda url={m.imagem} simbolo={m.simbolo} tam={largo ? 26 : 30} />
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <T style={{ fontWeight: "600", fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{m.nome}</T>
          {minha ? <Pilula cor="azul" semPonto>sua</Pilula> : null}
        </View>
        <T style={{ fontSize: 12.5, color: t.cores.ink2 }} numberOfLines={1}>
          {largo ? m.simbolo : `${m.rank ? "#" + m.rank + " · " : ""}${m.simbolo} · ${eixoBrl(m.market_cap)}`}
        </T>
      </View>
    </View>
  );
  const estilo = ({ pressed, hovered }: any) => ({
    flexDirection: "row" as const, alignItems: "center" as const, gap: largo ? 8 : 12, minHeight: 60,
    paddingVertical: 10, paddingHorizontal: largo ? 16 : 14, borderTopWidth: 1, borderTopColor: t.cores.linha,
    backgroundColor: pressed ? t.cores.campo : hovered ? t.cores.bg3 : minha ? t.cores.acentoSuave : "transparent",
  });
  if (!largo) {
    return (
      <Pressable onPress={() => abreMoeda(m.id)} accessibilityRole="button" accessibilityLabel={`${m.nome}, ${preco(m.preco)}`} style={estilo}>
        {nome}
        <View style={{ alignItems: "flex-end" }}>
          <T num style={{ fontWeight: "600", fontSize: 14.5 }}>{preco(m.preco)}</T>
          <Var v={m.var_24h} tam={12.5} seta />
        </View>
        <Sparkline valores={m.spark} largura={56} altura={28} />
      </Pressable>
    );
  }
  const num = (w: number, filho: React.ReactNode) => <View style={{ width: w, alignItems: "flex-end" }}>{filho}</View>;
  return (
    <Pressable onPress={() => abreMoeda(m.id)} accessibilityRole="button" accessibilityLabel={`${m.nome}, ${preco(m.preco)}`} style={estilo}>
      <T num style={{ width: COLS.rank, fontSize: 13, color: t.cores.ink2 }}>{m.rank ?? "—"}</T>
      {nome}
      {num(COLS.preco, <T num style={{ fontWeight: "600", fontSize: 14.5 }}>{preco(m.preco)}</T>)}
      {num(COLS.v, <Var v={m.var_1h} seta />)}
      {num(COLS.v, <Var v={m.var_24h} seta />)}
      {num(COLS.v, <Var v={m.var_7d} seta />)}
      {num(COLS.mcap, <T num style={{ fontSize: 14 }}>{eixoBrl(m.market_cap)}</T>)}
      {num(COLS.vol, <T num style={{ fontSize: 14 }}>{eixoBrl(m.volume)}</T>)}
      <View style={{ width: COLS.spark, alignItems: "flex-end" }}><Sparkline valores={m.spark} largura={112} altura={36} /></View>
    </Pressable>
  );
}

function CabecaTabela() {
  const t = useTema();
  const c = (w: number | null, txt: string, esq = false) => (
    <View style={w ? { width: w, alignItems: esq ? "flex-start" : "flex-end" } : { flex: 1 }}>
      <T style={{ fontSize: 12, fontWeight: "600", color: t.cores.ink2 }}>{txt}</T>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16 }}>
      {c(COLS.rank, "#", true)}{c(null, "Moeda")}{c(COLS.preco, "Preço")}{c(COLS.v, "1 h")}{c(COLS.v, "24 h")}{c(COLS.v, "7 dias")}
      {c(COLS.mcap, "Market cap")}{c(COLS.vol, "Volume 24 h")}{c(COLS.spark, "Últimos 7 dias")}
    </View>
  );
}

// ---------------------------------------------------------------- destaques
function Destaque({ titulo, lista }: { titulo: string; lista: any[] }) {
  const t = useTema();
  return (
    <Cartao>
      <T v="h4" style={{ marginBottom: 8 }}>{titulo}</T>
      {lista.map((m, i) => (
        <Pressable key={m.id} onPress={() => abreMoeda(m.id)} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, opacity: pressed ? 0.6 : 1 })}>
          <T num style={{ width: 14, fontSize: 12.5, color: t.cores.ink3 }}>{i + 1}</T>
          <LogoMoeda url={m.imagem} simbolo={m.simbolo} tam={22} />
          <T style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{m.nome} <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{m.simbolo}</T></T>
          <T num style={{ fontSize: 13.5 }}>{preco(m.preco)}</T>
          <View style={{ width: 76, alignItems: "flex-end" }}><Var v={m.var_24h} seta /></View>
        </Pressable>
      ))}
    </Cartao>
  );
}

// ---------------------------------------------------------------- busca no CoinGecko
function BuscaExterna({ q }: { q: string }) {
  const t = useTema();
  const [res, setRes] = useState<any[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { setRes(null); }, [q]);
  const busca = async () => {
    setCarregando(true);
    try { setRes(await FC.mercado.criptoBusca(q)); } catch { setRes([]); } finally { setCarregando(false); }
  };
  if (res == null) {
    return (
      <View style={{ alignItems: "center", paddingVertical: t.espaco.e4, gap: 10 }}>
        <T v="p">{`Nenhuma das 100 maiores bate com “${q}”.`}</T>
        <Botao variante="sec" pequeno carregando={carregando} onPress={busca}>Buscar em todas as moedas</Botao>
      </View>
    );
  }
  if (!res.length) return <T v="p" centro style={{ paddingVertical: t.espaco.e4 }}>Nada encontrado no CoinGecko.</T>;
  return (
    <View>
      {res.map((m) => (
        <Pressable key={m.id} onPress={() => abreMoeda(m.id)} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: t.cores.linha,
            backgroundColor: pressed ? t.cores.campo : "transparent" })}>
          <LogoMoeda url={m.imagem} simbolo={m.simbolo} />
          <T style={{ flex: 1, fontWeight: "600" }} numberOfLines={1}>{m.nome} <T style={{ fontWeight: "400", color: t.cores.ink2, fontSize: 13 }}>{m.simbolo}</T></T>
          {m.rank ? <T style={{ fontSize: 13, color: t.cores.ink2 }}>{"#" + m.rank}</T> : null}
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- tela
export default function Cripto() {
  const t = useTema();
  const { celular, estreito } = useMedidas();
  const { mercado, erro, carregando, atualizadoEm } = useCripto();
  const [ordem, setOrdem] = useState<Ordem>(mem.ordem);
  const [filtro, setFiltro] = useState<Filtro>(mem.filtro);
  const [busca, setBusca] = useState(mem.busca);
  const [limite, setLimite] = useState(PAGINA);
  useEffect(() => { Object.assign(mem, { ordem, filtro, busca }); }, [ordem, filtro, busca]);
  useEffect(() => { setLimite(PAGINA); }, [ordem, filtro, busca]);
  useAoVivo(atualizaMercadoCripto, 60 * 1000);
  useEffect(() => { aoPuxar.extra = atualizaMercadoCripto; return () => { aoPuxar.extra = null; }; }, []);

  const minhas = useMemo(() => new Set(criptosDoUsuario().map(simboloBase)), [mercado]); // eslint-disable-line react-hooks/exhaustive-deps
  const moedas: any[] = useMemo(() => (mercado && mercado.moedas) || [], [mercado]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let l = moedas.filter((m) => (filtro === "todas" || minhas.has(m.simbolo))
      && (!q || m.nome.toLowerCase().includes(q) || m.simbolo.toLowerCase().includes(q)));
    const n = (v: any) => (FC.ok(v) ? v : null);
    if (ordem === "alta") l = [...l].sort((a, b) => (n(b.var_24h) ?? -1e9) - (n(a.var_24h) ?? -1e9));
    else if (ordem === "queda") l = [...l].sort((a, b) => (n(a.var_24h) ?? 1e9) - (n(b.var_24h) ?? 1e9));
    else if (ordem === "volume") l = [...l].sort((a, b) => (n(b.volume) ?? 0) - (n(a.volume) ?? 0));
    else l = [...l].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
    return l;
  }, [moedas, busca, filtro, ordem, minhas]);

  const top = moedas.filter((m) => m.rank && m.rank <= 100 && FC.ok(m.var_24h));
  const altas = [...top].sort((a, b) => b.var_24h - a.var_24h).slice(0, 3);
  const quedas = [...top].sort((a, b) => a.var_24h - b.var_24h).slice(0, 3);
  const g = mercado && mercado.global;
  const largo = !celular;

  const cab = <Cabecalho titulo="Cripto" sub="O mercado de criptomoedas ao vivo, em reais."
    direita={mercado ? <SeloAoVivo em={atualizadoEm} velho={!!mercado.velho || !!erro} carregando={carregando} /> : null} />;

  if (!mercado) {
    return (
      <Pagina>
        {cab}
        {erro ? (
          <Vazio icone="cripto" titulo="Não consegui falar com o CoinGecko" texto={erro}
            acao={<Botao variante="sec" onPress={() => atualizaMercadoCripto()}>Tentar de novo</Botao>} />
        ) : (
          <View style={{ minHeight: 240, alignItems: "center", justifyContent: "center", gap: 16 }}>
            <Roda /><T style={{ color: t.cores.ink2 }}>Buscando as cotações…</T>
          </View>
        )}
      </Pagina>
    );
  }

  return (
    <Pagina>
      {cab}
      {erro ? <Mensagem tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e4 }}>{`Sem conexão com o CoinGecko agora (${erro}). Mostrando os últimos números.`}</Mensagem> : null}

      {g ? (
        <Cartao>
          <Kpis>
            <Kpi rotulo="Market cap total" valor={eixoBrl(g.market_cap)} peq={FC.ok(g.var_24h) ? `${FC.fmt.delta(g.var_24h, 2, "%")} em 24 h` : undefined} />
            <Kpi rotulo="Volume em 24 h" valor={eixoBrl(g.volume)} />
            {FC.ok((g.dominancia || {}).btc) ? <Kpi rotulo="Dominância do BTC" valor={FC.fmt.pct(g.dominancia.btc, 1)} /> : null}
            {FC.ok((g.dominancia || {}).eth) ? <Kpi rotulo="Dominância do ETH" valor={FC.fmt.pct(g.dominancia.eth, 1)} /> : null}
          </Kpis>
        </Cartao>
      ) : null}

      {altas.length ? (
        <Grade colunas={2} style={{ marginTop: t.espaco.e3 }}>
          <Destaque titulo="Maiores altas em 24 h" lista={altas} />
          <Destaque titulo="Maiores quedas em 24 h" lista={quedas} />
        </Grade>
      ) : null}

      <Secao titulo="Ranking" sub={estreito ? undefined : "por valor de mercado · toque numa moeda para ver o gráfico"}>
        <View style={{ flexDirection: estreito ? "column" : "row", gap: t.espaco.e2, marginBottom: t.espaco.e3, alignItems: estreito ? "stretch" : "center" }}>
          <View style={{ flex: estreito ? undefined : 1, maxWidth: estreito ? undefined : 320 }}>
            <Entrada valor={busca} aoMudar={setBusca} placeholder="Buscar moeda (nome ou código)" compacto accessibilityLabel="Buscar moeda" />
          </View>
          <Segmentado<Ordem> opcoes={[{ v: "rank", rotulo: "Ranking" }, { v: "alta", rotulo: "Altas" }, { v: "queda", rotulo: "Quedas" }, { v: "volume", rotulo: "Volume" }]}
            valor={ordem} aoMudar={setOrdem} rotuloA11y="Ordenar" />
          {minhas.size ? (
            <Segmentado<Filtro> opcoes={[{ v: "todas", rotulo: "Todas" }, { v: "minhas", rotulo: "Minhas" }]} valor={filtro} aoMudar={setFiltro} rotuloA11y="Filtrar" />
          ) : null}
        </View>
        <View style={{ backgroundColor: t.cores.bg2, borderRadius: t.raios.r, borderWidth: 1, borderColor: t.cores.linha, overflow: "hidden", boxShadow: t.cores.sombra } as any}>
          {largo ? <CabecaTabela /> : null}
          {lista.slice(0, limite).map((m) => <LinhaMoeda key={m.id} m={m} minha={minhas.has(m.simbolo)} largo={largo} />)}
          {!lista.length && busca.trim().length >= 2 ? <BuscaExterna q={busca.trim()} /> : null}
          {!lista.length && busca.trim().length < 2 ? <T v="p" centro style={{ padding: t.espaco.e4 }}>Nenhuma moeda neste filtro.</T> : null}
        </View>
        {lista.length > limite ? (
          <View style={{ alignItems: "center", marginTop: t.espaco.e3 }}>
            <Botao variante="texto" onPress={() => setLimite(limite + PAGINA)}>{`Mostrar mais ${Math.min(PAGINA, lista.length - limite)}`}</Botao>
          </View>
        ) : null}
      </Secao>

      <T v="dica" style={{ marginTop: t.espaco.e4 }}>
        Dados do CoinGecko, convertidos para reais. A lista se atualiza sozinha a cada minuto enquanto esta tela está aberta. Não é recomendação de investimento.
      </T>
    </Pagina>
  );
}
