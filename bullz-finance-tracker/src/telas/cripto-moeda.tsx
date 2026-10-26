/* Cripto › moeda: a página de uma moeda, no jeito do CoinMarketCap. Preço ao
 * vivo, o gráfico (preço ou market cap) de 1 dia a toda a história com o
 * volume embaixo, os números do mercado (supply, máxima e mínima históricas,
 * faixa do dia), a sua posição, se tiver, e as manchetes de cripto. */
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { aoPuxar, Pagina } from "../casca/casca";
import { B, Botao, Cartao, Detalhes, Grade, Kpi, Kpis, Linha, Pilula, Roda, Rs, Secao, T, Trilha, Vazio } from "../ui/kit";
import { Segmentado } from "../ui/campos";
import { Icone } from "../ui/icone";
import { GraficoCripto, eixoBrl, type Ponto } from "../ui/grafico-cripto";
import { LogoMoeda, SeloAoVivo, Var } from "./comum/ao-vivo";
import { ListaNoticias } from "./noticias";
import { atualizaMercadoCripto, atualizaNoticias, simboloBase, useAoVivo, useCripto, useNoticias } from "../estado/cripto";
import FC from "../nucleo";

type Dias = "1" | "7" | "30" | "90" | "365" | "max";
type Serie = "preco" | "market_cap";
const PERIODOS: Array<{ v: Dias; rotulo: string; extenso: string }> = [
  { v: "1", rotulo: "1D", extenso: "em 24 h" }, { v: "7", rotulo: "7D", extenso: "em 7 dias" }, { v: "30", rotulo: "1M", extenso: "em 1 mês" },
  { v: "90", rotulo: "3M", extenso: "em 3 meses" }, { v: "365", rotulo: "1A", extenso: "em 1 ano" }, { v: "max", rotulo: "Tudo", extenso: "desde o início" },
];
const mem: { dias: Dias; serie: Serie } = { dias: "7", serie: "preco" };
const preco = (v: any) => (FC.ok(v) ? "R$ " + FC.fmt.preco(v) : "—");
const qtd = (v: any, s: string) => (FC.ok(v) ? `${FC.fmt.num(v, v >= 1e6 ? 0 : 2)} ${s}` : "—");

/** a faixa min–máx com a bolinha no preço de agora */
function Faixa({ min, max, agora }: { min: number; max: number; agora: number }) {
  const t = useTema();
  const pct = max > min ? Math.max(0, Math.min(100, ((agora - min) / (max - min)) * 100)) : 50;
  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.cores.campo }}>
        <View style={{ position: "absolute", left: `${pct}%` as any, top: -3, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: t.cores.ink, borderWidth: 2, borderColor: t.cores.bg2 }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <T v="peq" num>{preco(min)}</T><T v="peq" num>{preco(max)}</T>
      </View>
    </View>
  );
}

function Numero({ rotulo, valor, children }: { rotulo: string; valor?: React.ReactNode; children?: React.ReactNode }) {
  const t = useTema();
  return (
    <View style={{ paddingVertical: 11, borderTopWidth: 1, borderTopColor: t.cores.linha }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <T style={{ fontSize: 14, color: t.cores.ink2 }}>{rotulo}</T>
        {typeof valor === "string" ? <T num style={{ fontSize: 14, fontWeight: "600" }}>{valor}</T> : valor}
      </View>
      {children}
    </View>
  );
}

/** a posição da carteira nesta moeda (pelo símbolo: BTC, BTC-USD…) */
function usePosicao(simbolo: string | undefined) {
  const e = useEstado();
  if (!simbolo || !e.dados) return null;
  return (e.dados.ativos || []).find((a: any) => a.classe === "cripto" && a.posicao && simboloBase(a.ticker) === simbolo) || null;
}

export default function CriptoMoeda() {
  const t = useTema();
  const { estreito } = useMedidas();
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const id = String(idParam || "").toLowerCase();
  const [dias, setDias] = useState<Dias>(mem.dias);
  const [serie, setSerie] = useState<Serie>(mem.serie);
  const [grafico, setGrafico] = useState<any>(null);
  const [carregandoGrafico, setCarregandoGrafico] = useState(false);
  const [detalhe, setDetalhe] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { mercado, atualizadoEm, carregando } = useCripto();
  const noticias = useNoticias((s) => s.cripto);
  useEffect(() => { Object.assign(mem, { dias, serie }); }, [dias, serie]);

  // gráfico: na troca de período, e de novo a cada minuto (1D) ou 5 min (os outros)
  const buscaGrafico = async () => {
    setCarregandoGrafico(true);
    try { const g = await FC.mercado.criptoGrafico(id, dias); setGrafico({ ...g, dias }); setErro(null); }
    catch (e: any) { setErro(e.message || String(e)); }
    finally { setCarregandoGrafico(false); }
  };
  const buscaDetalhe = async () => {
    try { setDetalhe(await FC.mercado.criptoDetalhe(id)); setErro(null); } catch (e: any) { setErro(e.message || String(e)); }
  };
  useAoVivo(buscaGrafico, dias === "1" ? 60 * 1000 : 5 * 60 * 1000, id + dias);
  useAoVivo(buscaDetalhe, 5 * 60 * 1000, id);
  useAoVivo(atualizaMercadoCripto, 60 * 1000);
  useAoVivo(() => atualizaNoticias("cripto"), 2 * 60 * 1000);
  useEffect(() => {
    aoPuxar.extra = () => Promise.all([atualizaMercadoCripto(), buscaGrafico(), buscaDetalhe()]);
    return () => { aoPuxar.extra = null; };
  });

  // o preço do ranking é o mais fresco (1 min); a ficha completa vem a cada 10 min
  const linha = ((mercado && mercado.moedas) || []).find((m: any) => m.id === id);
  const d = detalhe && detalhe.id === id ? detalhe : null;
  const m = { ...(d || {}), ...(linha ? { preco: linha.preco, var_24h: linha.var_24h, var_7d: linha.var_7d, market_cap: linha.market_cap,
    volume: linha.volume, max_24h: linha.max_24h, min_24h: linha.min_24h, rank: linha.rank, nome: linha.nome, simbolo: linha.simbolo, imagem: (d && d.imagem) || linha.imagem } : {}) };
  const posicao = usePosicao(m.simbolo);
  const pontos: Ponto[] = grafico && grafico.dias === dias ? (serie === "preco" ? grafico.precos : grafico.market_caps) || [] : [];
  const volumes: Ponto[] = grafico && grafico.dias === dias ? grafico.volumes || [] : [];
  const varPeriodo = pontos.length > 1 ? (pontos[pontos.length - 1][1] / pontos[0][1] - 1) * 100 : null;
  const extenso = PERIODOS.find((p) => p.v === dias)!.extenso;
  const relacionadas = useMemo(() => {
    if (!m.nome) return [];
    const termos = [m.nome, m.simbolo].filter(Boolean).map((s: string) => s.toLowerCase());
    return noticias.itens.filter((n) => termos.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(n.titulo)));
  }, [noticias.itens, m.nome, m.simbolo]);

  const voltar = (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/cripto" as any))} accessibilityRole="link"
      style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: t.espaco.e3 }}>
      <Icone nome="voltar" tam={16} cor={t.cores.acento} /><T style={{ color: t.cores.acento, fontSize: 15 }}>Cripto</T>
    </Pressable>
  );

  if (!m.nome) {
    return (
      <Pagina>
        {voltar}
        {erro ? <Vazio icone="cripto" titulo="Não achei esta moeda" texto={erro} acao={<Botao variante="sec" onPress={() => router.replace("/cripto" as any)}>Ver o ranking</Botao>} />
          : <View style={{ minHeight: 280, alignItems: "center", justifyContent: "center" }}><Roda /></View>}
      </Pagina>
    );
  }

  const circ = FC.ok(m.circulante) && FC.ok(m.maximo) && m.maximo > 0 ? (m.circulante / m.maximo) * 100 : null;
  return (
    <Pagina>
      {voltar}
      {/* cabeçalho: logo, nome, ranking e o preço grande */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <LogoMoeda url={m.imagem} simbolo={m.simbolo} tam={estreito ? 36 : 44} />
        <T v="h1" accessibilityRole="header">{m.nome}</T>
        <Pilula cor="cinza" semPonto>{m.simbolo}</Pilula>
        {m.rank ? <Pilula cor="azul" semPonto>{"#" + m.rank}</Pilula> : null}
        {posicao ? <Pilula cor="verde">na sua carteira</Pilula> : null}
        <View style={{ marginLeft: "auto" }}><SeloAoVivo em={atualizadoEm} carregando={carregando} velho={!!(mercado && mercado.velho)} /></View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: t.espaco.e3, flexWrap: "wrap" }}>
        <T num style={{ fontSize: estreito ? 32 : 40, lineHeight: estreito ? 38 : 48, fontWeight: "600", letterSpacing: -1 }}>{preco(m.preco)}</T>
        <Var v={m.var_24h} tam={17} peso="600" seta />
        <T v="peq">em 24 h</T>
      </View>

      {/* gráfico */}
      <Cartao style={{ marginTop: t.espaco.e4 }}>
        <View style={{ flexDirection: estreito ? "column" : "row", gap: t.espaco.e2, alignItems: estreito ? "stretch" : "center", marginBottom: t.espaco.e3 }}>
          <Segmentado<Serie> opcoes={[{ v: "preco", rotulo: "Preço" }, { v: "market_cap", rotulo: "Market cap" }]} valor={serie} aoMudar={setSerie} rotuloA11y="Série" />
          <View style={{ marginLeft: estreito ? 0 : "auto" }}>
            {/* no celular, 6 opções não cabem: o 3M sai (o 1M e o 1A cobrem) */}
            <Segmentado<Dias> opcoes={PERIODOS.filter((p) => !estreito || p.v !== "90" || dias === "90").map((p) => ({ v: p.v, rotulo: p.rotulo }))}
              valor={dias} aoMudar={setDias} rotuloA11y="Período" />
          </View>
        </View>
        {FC.ok(varPeriodo) ? (
          <Linha gap={6} style={{ marginBottom: 6 }}>
            <Var v={varPeriodo} tam={14} peso="600" seta /><T v="peq">{extenso}</T>
          </Linha>
        ) : null}
        {pontos.length > 1 ? (
          <GraficoCripto pontos={pontos} volumes={volumes} dias={dias} altura={estreito ? 260 : 340}
            nome={serie === "preco" ? "Preço" : "Market cap"} carregando={carregandoGrafico} />
        ) : (
          <View style={{ height: estreito ? 260 : 340, alignItems: "center", justifyContent: "center" }}>
            {carregandoGrafico || !grafico ? <Roda /> : <T v="p">Sem dados para este período.</T>}
          </View>
        )}
      </Cartao>

      <Grade colunas={2} style={{ marginTop: t.espaco.e3 }}>
        <Cartao>
          <T v="h4" style={{ marginBottom: 4 }}>Mercado</T>
          <Numero rotulo="Market cap" valor={eixoBrl(m.market_cap)} />
          <Numero rotulo="Volume em 24 h" valor={eixoBrl(m.volume)} />
          <Numero rotulo="Volume / market cap" valor={FC.ok(m.volume) && m.market_cap ? FC.fmt.pct((m.volume / m.market_cap) * 100, 2) : "—"} />
          {FC.ok(m.fdv) ? <Numero rotulo="Valor totalmente diluído" valor={eixoBrl(m.fdv)} /> : null}
          {FC.ok(m.min_24h) && FC.ok(m.max_24h) ? (
            <Numero rotulo="Faixa de 24 h"><Faixa min={m.min_24h} max={m.max_24h} agora={m.preco} /></Numero>
          ) : null}
        </Cartao>
        <Cartao>
          <T v="h4" style={{ marginBottom: 4 }}>Oferta e histórico</T>
          <Numero rotulo="Em circulação" valor={qtd(m.circulante, m.simbolo)}>
            {FC.ok(circ) ? <View style={{ marginTop: 8, gap: 4 }}><Trilha pct={circ as number} /><T v="dica">{`${FC.fmt.pct(circ, 1)} da oferta máxima`}</T></View> : null}
          </Numero>
          <Numero rotulo="Oferta total" valor={qtd(m.total, m.simbolo)} />
          <Numero rotulo="Oferta máxima" valor={FC.ok(m.maximo) ? qtd(m.maximo, m.simbolo) : "sem limite"} />
          {FC.ok(m.ath) ? (
            <Numero rotulo="Máxima histórica" valor={<View style={{ alignItems: "flex-end" }}>
              <T num style={{ fontSize: 14, fontWeight: "600" }}>{preco(m.ath)}</T>
              <T v="dica">{`${FC.datas.br(m.ath_data)} · `}<Var v={m.ath_var} tam={12} /></T>
            </View>} />
          ) : null}
          {FC.ok(m.atl) ? (
            <Numero rotulo="Mínima histórica" valor={<View style={{ alignItems: "flex-end" }}>
              <T num style={{ fontSize: 14, fontWeight: "600" }}>{preco(m.atl)}</T>
              <T v="dica">{`${FC.datas.br(m.atl_data)} · `}<Var v={m.atl_var} tam={12} /></T>
            </View>} />
          ) : null}
        </Cartao>
      </Grade>

      {d ? (
        <Cartao style={{ marginTop: t.espaco.e3 }}>
          <Kpis>
            <Kpi rotulo="7 dias" valor={<Var v={m.var_7d} tam={19} peso="600" />} />
            <Kpi rotulo="30 dias" valor={<Var v={d.var_30d} tam={19} peso="600" />} />
            <Kpi rotulo="1 ano" valor={<Var v={d.var_1a} tam={19} peso="600" />} />
          </Kpis>
        </Cartao>
      ) : null}

      {posicao ? (
        <Secao titulo="Sua posição">
          <Cartao>
            <Kpis>
              <Kpi rotulo="Quantidade" valor={`${FC.fmt.qtd(posicao.posicao.quantidade)} ${m.simbolo}`} pequeno />
              <Kpi rotulo="Vale hoje" valor={FC.fmt.brlTexto(posicao.posicao.atual)} dinheiro pequeno />
              {FC.ok(posicao.posicao.custo) && posicao.posicao.custo > 0 ? (
                <Kpi rotulo="Resultado" pequeno valor={<View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                  <Rs cls={posicao.posicao.atual >= posicao.posicao.custo ? "pos" : "neg"} style={{ fontSize: 19, fontWeight: "600" }}>
                    {FC.fmt.brlTexto(posicao.posicao.atual - posicao.posicao.custo)}</Rs>
                  <Var v={(posicao.posicao.atual / posicao.posicao.custo - 1) * 100} />
                </View>} />
              ) : null}
            </Kpis>
          </Cartao>
        </Secao>
      ) : null}

      {d && (d.descricao || d.site) ? (
        <Secao titulo={`Sobre ${m.nome}`}>
          <Cartao>
            {d.categorias && d.categorias.length ? (
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {d.categorias.map((c: string) => <Pilula key={c} cor="cinza" semPonto>{c}</Pilula>)}
              </View>
            ) : null}
            {d.descricao ? (
              d.descricao.length > 320 ? (
                <>
                  <T v="p">{d.descricao.slice(0, 320).replace(/\s+\S*$/, "") + "…"}</T>
                  <Detalhes rotulo="Ler tudo"><T v="p">{d.descricao}</T></Detalhes>
                </>
              ) : <T v="p">{d.descricao}</T>
            ) : null}
            {d.site ? (
              <Pressable onPress={() => Linking.openURL(d.site)} accessibilityRole="link" style={{ marginTop: 10, alignSelf: "flex-start" }}>
                <T style={{ color: t.cores.acento, fontSize: 14 }}>{d.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗</T>
              </Pressable>
            ) : null}
          </Cartao>
        </Secao>
      ) : null}

      <Secao titulo="Notícias" sub={relacionadas.length ? `sobre ${m.nome}` : "de cripto"}
        direita={<Botao variante="texto" pequeno onPress={() => router.push("/noticias?tema=cripto" as any)}>Ver todas</Botao>}>
        <ListaNoticias itens={(relacionadas.length ? relacionadas : noticias.itens).slice(0, 5)} novos={[]} compacta />
        {!noticias.itens.length ? <T v="p">{noticias.erro ? "As notícias não carregaram agora." : "Carregando as manchetes…"}</T> : null}
      </Secao>

      <T v="dica" style={{ marginTop: t.espaco.e4 }}>
        Dados do CoinGecko, em reais. <B>Não é recomendação de investimento.</B>
      </T>
    </Pagina>
  );
}
