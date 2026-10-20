/* Início: o retrato do patrimônio em uma tela, visual. No topo, o patrimônio,
 * o velocímetro do desempenho (FC.desempenho) e os anéis das metas; abaixo,
 * módulos de gráficos. Os números brutos têm o seu lugar nas outras telas e
 * continuam disponíveis aqui como módulos (src/telas/comum/blocos.tsx).
 * Cada bloco é independente: a ordem e o que fica oculto vêm do layout salvo
 * (Ajustes → Layout), e um bloco que falha não derruba a tela. */
import React, { useMemo, useState } from "react";
import { Pressable, View, Text, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import { Ajuda, B, Botao, Cartao, Chip, Conta, Grade, Kpi, KpiValor, Kpis, Lista, Item, Num, Pilula, Ponto, Rs, Secao, T, degrade } from "../ui/kit";
import { Grafico } from "../ui/grafico";
import { Icone } from "../ui/icone";
import { ui } from "../ui/folha";
import { AnelMeta, LinhaTendencia, Rosca, Velocimetro, corFaixa } from "../ui/medidores";
import { EstadoMercado } from "./comum/alertas";
import { abreAtivo } from "./comum/ativo";
import {
  AgroResumo, Alocacao, CRESC_PADRAO, Crescimento, DetalhesTecnicos, Frase, Macro, Melhores, Proventos, Proximos30, RendaPassiva,
  comparativo, desempenhoDoPainel, espaca, granularidade, resumoIR, serieDoPainel,
} from "./comum/blocos";
import { formAtivo, formRendaFixa } from "./comum/formularios";
import { CartaoPerfil, CartaoPlanoRealidade, ChecklistAtivacao } from "./comum/perfil";
import { ChipSequencia, sequencia } from "./comum/sequencia";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const sinal = (v: number) => (v >= 0 ? "+" : "−");
const vai = (c: string) => router.push(c as any);
const pctTxt = (v: number, c = 1) => `${FC.fmt.delta(v, c)}%`;

function saudacao() {
  const h = new Date().getHours();
  return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

// ---------------------------------------------------------------- período do Início
// o mesmo período vale para o velocímetro, a curva e os destaques
type Periodo = "dia" | "mes" | "ano" | "tudo";
const PERIODOS: Array<{ v: Periodo; rotulo: string }> = [{ v: "dia", rotulo: "Dia" }, { v: "mes", rotulo: "Mês" }, { v: "ano", rotulo: "Ano" }, { v: "tudo", rotulo: "Tudo" }];
const NOME_PERIODO: Record<Periodo, string> = { dia: "hoje", mes: "nos últimos 30 dias", ano: "nos últimos 12 meses", tudo: "desde o início" };
function inicioDoPeriodo(p: Periodo, primeiro: string | null) {
  const hoje = FC.datas.hoje();
  const d = p === "dia" ? FC.datas.soma(hoje, -1) : p === "mes" ? FC.datas.soma(hoje, -30) : p === "ano" ? FC.datas.soma(hoje, -365) : primeiro || hoje;
  return primeiro && d < primeiro ? primeiro : d;
}

function ChipsPeriodo({ valor, aoMudar }: { valor: Periodo; aoMudar: (p: Periodo) => void }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" }} accessibilityRole="tablist" accessibilityLabel="Período">
      {PERIODOS.map((p) => {
        const sel = p.v === valor;
        return (
          <Pressable key={p.v} onPress={() => aoMudar(p.v)} accessibilityRole="tab" accessibilityState={{ selected: sel }}
            style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 980, minHeight: 32, justifyContent: "center",
              backgroundColor: sel ? t.cores.ink : t.cores.campo }}>
            <Text style={{ fontSize: 13.5, fontWeight: sel ? "600" : "400", color: sel ? t.cores.bg : t.cores.ink2 }}>{p.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- anéis
// três leituras que toda carteira tem, sem depender de meta configurada
type Anel = { pct: number | null; centro?: string; sub: string; cor: string };
const faixa3 = (t: ReturnType<typeof useTema>, v: number, amarelo: number, verde: number) =>
  v >= verde ? t.cores.verde : v >= amarelo ? t.cores.s3 : t.cores.vermelho;

// quanto a carteira rendeu (TWR) em 12 meses, como % do CDI do mesmo trecho
function cdiNoAno(t: ReturnType<typeof useTema>, d: any): Anel {
  const ser = serieDoPainel(d), ix = FC.estado.mercado && FC.estado.mercado.indices;
  const vazio = { pct: null, centro: "—", sub: "sem dados", cor: t.cores.ink3 };
  if (ser.pontos.length < 2 || !ix || typeof ix.fator !== "function") return vazio;
  const de = FC.datas.soma(FC.datas.hoje(), -365);
  const trecho = ser.pontos.filter((p: any) => p.data >= de);
  if (trecho.length < 2) return vazio;
  const cdi = (ix.fator("cdi", 100, trecho[0].data, trecho.at(-1).data).f - 1) * 100;
  if (!(cdi > 0)) return vazio;
  const r = FC.rentab.twr(trecho), pct = (r / cdi) * 100;
  const sub = trecho[0].data > de ? `desde ${FC.datas.br(trecho[0].data).slice(0, 5)}` : "12 meses";
  if (r < 0) return { pct: 0, centro: "<0%", sub, cor: t.cores.vermelho };
  return { pct: Math.min(100, pct), centro: `${FC.fmt.num(pct, 0)}%`, sub, cor: faixa3(t, pct, 70, 100) };
}

// a nota média dos ativos da carteira (as 4 lentes), pesando pelo valor
function qualidade(t: ReturnType<typeof useTema>, d: any): Anel {
  const com = (d.ativos || []).filter((a: any) => a.posicao && a.posicao.atual > 0 && ok(a.score));
  const peso = FC.soma(com, (a: any) => a.posicao.atual);
  if (!com.length || !(peso > 0)) return { pct: null, centro: "—", sub: "sem ativos avaliados", cor: t.cores.ink3 };
  const nota = FC.soma(com, (a: any) => a.score * a.posicao.atual) / peso;
  return { pct: nota, centro: String(Math.round(nota)), sub: `${com.length} ativo${com.length > 1 ? "s" : ""} avaliado${com.length > 1 ? "s" : ""}`, cor: faixa3(t, nota, 34, 67) };
}

// concentração pelo HHI (soma dos pesos ao quadrado): ETF de índice vale por
// 10 partes iguais, o agro conta como um bloco só
function diversificacao(t: ReturnType<typeof useTema>, d: any): Anel {
  const partes: number[] = [];
  for (const a of d.ativos || []) {
    if (!a.posicao || !(a.posicao.atual > 0)) continue;
    const n = a.classe === "etf_br" || a.classe === "etf_us" ? 10 : 1;
    for (let i = 0; i < n; i++) partes.push(a.posicao.atual / n);
  }
  for (const r of d.rendaFixa || []) if (r.valor_aplicado > 0) partes.push(r.valor_aplicado);
  if (d.resumo && d.resumo.agro > 0) partes.push(d.resumo.agro);
  const total = partes.reduce((s, v) => s + v, 0);
  if (!(total > 0)) return { pct: null, centro: "—", sub: "carteira vazia", cor: t.cores.ink3 };
  const hhi = partes.reduce((s, v) => s + (v / total) ** 2, 0);
  const nota = Math.max(0, Math.min(100, 100 * (1 - hhi)));
  return { pct: nota, centro: String(Math.round(nota)), sub: `peso de ${FC.fmt.num(1 / hhi, 1)} ativos`, cor: faixa3(t, nota, 60, 80) };
}

// ---------------------------------------------------------------- folha do desempenho
function ComposicaoDesempenho({ des, d, imp }: { des: any; d: any; imp: any }) {
  const t = useTema();
  const tt = d.rentab && d.rentab.total;
  const colocou = tt ? tt.aplicado - (tt.devolvido || 0) : null;
  const ganho = tt ? (imp && ok(imp.ganho_liquido) ? imp.ganho_liquido : tt.ganho) : null;
  const ganhoPct = ok(ganho) && (colocou as number) > 0.005 ? (ganho / (colocou as number)) * 100 : null;
  const cor = corFaixa(t, des.suficiente ? des.faixa.cor : null);
  // o que mais puxa a nota para longe dos 50
  const puxa = des.suficiente ? [...des.partes].sort((a: any, b: any) => Math.abs(b.peso * (b.nota - 50)) - Math.abs(a.peso * (a.nota - 50)))[0] : null;
  return (
    <View style={{ gap: t.espaco.e4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Num style={{ fontSize: 44, fontWeight: "700", color: cor }}>{Math.round(des.score)}</Num>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 17, fontWeight: "600", color: cor }}>{des.suficiente ? des.faixa.nome : "Sem dados suficientes"}</T>
          <T style={{ fontSize: 13, color: t.cores.ink2 }}>
            {des.suficiente ? `${FC.datas.br(des.de)} a ${FC.datas.br(des.ate)} · 50 = igual à referência` : "Ainda não há dias suficientes neste período para comparar. Veja o mês."}
          </T>
        </View>
      </View>
      {des.suficiente ? (
        <Lista>
          {des.partes.map((p: any) => (
            <Item key={p.chave} titulo={p.nome}
              detalhe={`rendeu ${pctTxt(p.retorno, 2)} · ${p.nome_ref} ${pctTxt(p.retorno_ref, 2)} · ${FC.fmt.num(p.peso * 100, 0)}% do peso`}
              valores={<Pilula cor={FC.desempenho.faixaDe(p.nota).cor}>{Math.round(p.nota)}</Pilula>} />
          ))}
        </Lista>
      ) : null}
      {puxa ? (
        <T v="p">
          {puxa.nota >= 50 ? "O que mais puxa a nota para cima: " : "O que mais puxa a nota para baixo: "}<B>{puxa.nome.toLowerCase()}</B>,
          {` ${puxa.retorno >= puxa.retorno_ref ? "acima" : "abaixo"} do ${puxa.nome_ref} por ${FC.fmt.num(Math.abs(puxa.retorno - puxa.retorno_ref), 2)} p.p.`}
        </T>
      ) : null}
      {tt ? (
        <Kpis>
          <Kpi pequeno rotulo="Quanto eu coloquei" valor={FC.fmt.brlTexto(colocou)} dinheiro
            peq={tt.devolvido > 0.005 ? `já descontados ${FC.fmt.brlTexto(tt.devolvido, 0)} que voltaram` : "o que saiu do seu bolso"} />
          <Kpi pequeno rotulo="Quanto ganhei" valor={<KpiValor pequeno dinheiro cls={ganho >= 0 ? "pos" : "neg"}>{sinal(ganho)}{FC.fmt.brlTexto(Math.abs(ganho))}</KpiValor>}
            peq={ok(ganhoPct) ? `${FC.fmt.delta(ganhoPct, 1)}% sobre o que você colocou${imp && ok(imp.ganho_liquido) ? ", já sem IR" : ""}` : undefined} />
        </Kpis>
      ) : null}
      <T v="p">Cada parte da carteira é comparada com a sua referência no período: renda variável (ações, FIIs, ETFs e cripto) com o Ibovespa, renda fixa e agro com o CDI. Igual à referência vale 50; acima, a nota sobe; abaixo, cai. A nota final pondera pelo valor de cada parte. Aportes e resgates não contam como rendimento.</T>
      <Pressable onPress={() => vai("/ativos/rentabilidade")}><T style={{ fontSize: 14, color: t.cores.acento }}>Ver a rentabilidade completa ›</T></Pressable>
    </View>
  );
}
function abreComposicao(des: any, d: any, imp: any) {
  ui.folha({ titulo: "Desempenho da carteira", corpo: <ComposicaoDesempenho des={des} d={d} imp={imp} /> });
}

// ---------------------------------------------------------------- topo
function Topo({ d, imp, seq, des, periodo, setPeriodo }: { d: any; imp: any; seq: any; des: any; periodo: Periodo; setPeriodo: (p: Periodo) => void }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const [larg, setLarg] = useState(0);
  const r = d.resumo;
  const bruto = imp && ok(imp.bruto) ? imp.bruto : r.patrimonio;
  const tenho = imp && ok(imp.liquido) ? imp.liquido : bruto;
  const temIR = !!imp && ok(imp.ir_estimado) && imp.ir_estimado > 0.005;
  const dica = imp
    ? "Estimativa do que ficaria com você se resgatasse tudo hoje: o patrimônio a preço de agora menos o imposto de renda sobre o ganho (e o IOF, nos primeiros 30 dias). Isenções, como LCI, LCA e ações até o limite mensal, já entram na conta."
    : "Soma de tudo a preço de agora: bolsa, cripto, renda fixa com rendimento e rebanho. Ainda sem descontar o imposto de renda.";
  const tamValor = estreito ? 32 : 40;
  const cor = corFaixa(t, des.suficiente ? des.faixa.cor : null);
  const aneis: Array<[string, Anel, string]> = [
    ["% do CDI", cdiNoAno(t, d), "/ativos/rentabilidade"],
    ["Qualidade", qualidade(t, d), "/ativos"],
    ["Diversificação", diversificacao(t, d), "/ativos"],
  ];
  const anel = estreito ? 54 : 60;
  return (
    <Cartao style={{ paddingTop: estreito ? 18 : 24, paddingHorizontal: estreito ? 16 : 32, paddingBottom: estreito ? 16 : 20, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: -170, left: "50%", marginLeft: -210, width: 420, height: 420,
        ...degrade(`radial-gradient(closest-side, ${des.suficiente ? cor + "26" : t.cores.acentoSuave}, transparent 70%)`) } as any} />
      <View style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <T style={{ fontSize: 14, color: t.cores.ink2 }}>Quanto eu tenho</T><Ajuda texto={dica} />
        </View>
        <Conta valor={tenho} style={{ fontSize: tamValor, lineHeight: tamValor * 1.1, fontWeight: "600", letterSpacing: -tamValor * 0.035, marginTop: 2, textAlign: "center" }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2, marginTop: 8, justifyContent: "center", alignItems: "center" }}>
          {temIR ? <T style={{ fontSize: 12, color: t.cores.ink2 }}>líquido · bruto <Rs style={{ fontSize: 12, color: t.cores.ink2 }}>{FC.fmt.brlTexto(bruto)}</Rs></T> : null}
          {r.variacao_hoje ? <Chip><Text style={{ fontSize: 13, color: t.cores.ink2 }}>Hoje </Text><Rs cls={r.variacao_hoje >= 0 ? "pos" : "neg"} style={{ fontSize: 13, fontWeight: "600" }}>{`${sinal(r.variacao_hoje)}${FC.fmt.brlTexto(Math.abs(r.variacao_hoje))}`}</Rs></Chip> : null}
          {seq ? <ChipSequencia st={seq} /> : null}
        </View>
      </View>

      <View style={{ marginTop: t.espaco.e3, alignItems: "center", gap: t.espaco.e2 }} onLayout={(ev: LayoutChangeEvent) => setLarg(ev.nativeEvent.layout.width)}>
        <ChipsPeriodo valor={periodo} aoMudar={setPeriodo} />
        <Velocimetro valor={des.score} cor={cor} tam={estreito ? 150 : 170}
          rotulo={des.suficiente ? des.faixa.nome : "Sem dados"}
          onPress={() => abreComposicao(des, d, imp)}
          rotuloA11y={`Desempenho ${NOME_PERIODO[periodo]}: ${Math.round(des.score)}, ${des.suficiente ? des.faixa.nome : "sem dados suficientes para o período"}. Toque para ver a composição.`} />
        {des.suficiente && des.tendencia.length >= 2 ? (
          <View style={{ marginTop: -t.espaco.e2 }}>
            <LinhaTendencia pontos={des.tendencia.map((x: any) => x.score)} cor={cor} altura={26} largura={Math.min(240, Math.max(140, larg - 40))} />
          </View>
        ) : !des.suficiente ? <T style={{ fontSize: 12, color: t.cores.ink2, marginTop: -t.espaco.e2 }}>sem dados suficientes para o período</T> : null}
      </View>

      <View style={{ flexDirection: "row", marginTop: t.espaco.e3, paddingTop: t.espaco.e3, borderTopWidth: 1, borderTopColor: t.cores.linha, gap: estreito ? 4 : 16 }}>
        {aneis.map(([rotulo, a, rota]) => (
          <AnelMeta key={rotulo} tam={anel} rotulo={rotulo} pct={a.pct} centro={a.centro} sub={a.sub} cor={a.cor} onPress={() => vai(rota)} />
        ))}
      </View>
    </Cartao>
  );
}

// ---------------------------------------------------------------- módulos visuais
function Curva({ d, periodo }: { d: any; periodo: Periodo }) {
  const t = useTema();
  const ser = serieDoPainel(d);
  if (ser.pontos.length < 2) return null;
  // no "dia" a curva mostra a semana: um dia não faz curva
  const de = inicioDoPeriodo(periodo === "dia" ? "mes" : periodo, ser.inicio);
  const ini = periodo === "dia" ? FC.datas.soma(FC.datas.hoje(), -7) : de;
  const trecho = ser.pontos.filter((p: any) => p.data >= ini);
  if (trecho.length < 2) return null;
  const p0 = trecho[0], p1 = trecho.at(-1);
  const rend = p1.valor - p0.valor - (p1.fluxo - p0.fluxo);
  const grao = granularidade(trecho[0].data, p1.data);
  return (
    <Secao titulo="Curva do patrimônio" sub={periodo === "dia" ? "últimos 7 dias" : NOME_PERIODO[periodo]}
      direita={<Botao variante="texto" pequeno onPress={() => vai("/ativos/rentabilidade")}>Detalhes ›</Botao>}>
      <Cartao>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: t.espaco.e3 }}>
          <Rs cls={rend >= 0 ? "pos" : "neg"} style={{ fontSize: 24, fontWeight: "600" }}>{`${sinal(rend)}${FC.fmt.brlTexto(Math.abs(rend))}`}</Rs>
          <T style={{ fontSize: 13, color: t.cores.ink2 }}>de rendimento, sem contar aportes</T>
        </View>
        <Grafico marcador={FC.graficos.linhas({ series: [{ nome: "Patrimônio", pontos: espaca(trecho.map((p: any) => [p.data, p.valor]), grao), classe: "l1", area: true }], altura: 180 })} />
      </Cartao>
    </Secao>
  );
}

const corPilar = (t: ReturnType<typeof useTema>, cor: string) => {
  const m = /^var\(--([a-z0-9]+)\)$/.exec(cor || "");
  return m ? (t.cores as any)[m[1]] || t.cores.ink3 : cor || t.cores.ink3;
};
function RoscaAlocacao({ d }: { d: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const linhas = (d.alocacao || []).filter((l: any) => l.valor > 0 || l.alvo_pct > 0);
  if (!linhas.length) return null;
  const temMeta = linhas.some((l: any) => l.alvo_pct > 0);
  const maiorDesvio = temMeta ? [...linhas].filter((l: any) => !l.fora_meta).sort((a: any, b: any) => Math.abs(b.desvio_pct) - Math.abs(a.desvio_pct))[0] : null;
  return (
    <Secao titulo="Alocação" sub={temMeta ? "o anel de dentro é o que você tem; o fino, por fora, a meta" : "por pilar"}
      direita={<Botao variante="texto" pequeno onPress={() => vai("/ativos/lista")}>Detalhes ›</Botao>}>
      <Cartao>
        <View style={{ flexDirection: estreito ? "column" : "row", alignItems: "center", gap: t.espaco.e5 }}>
          <Rosca tam={estreito ? 180 : 200}
            fatias={linhas.map((l: any) => ({ valor: l.valor, cor: corPilar(t, l.cor) }))}
            metas={temMeta ? linhas.map((l: any) => ({ valor: l.alvo_no_patrimonio, cor: corPilar(t, l.cor) })) : undefined}
            centro={maiorDesvio && Math.abs(maiorDesvio.desvio_pct) >= 1
              ? <Num style={{ fontSize: 22, fontWeight: "700" }}>{FC.fmt.delta(maiorDesvio.desvio_pct, 0)} p.p.</Num>
              : <T style={{ fontSize: 15, fontWeight: "600" }}>{temMeta ? "na meta" : `${linhas.length} pilares`}</T>}
            sub={maiorDesvio && Math.abs(maiorDesvio.desvio_pct) >= 1 ? maiorDesvio.nome : undefined} />
          <View style={{ flex: estreito ? undefined : 1, alignSelf: "stretch", gap: 10 }}>
            {linhas.map((l: any) => (
              <View key={l.chave} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ponto cor={l.cor} tam={10} />
                <T style={{ flex: 1, fontSize: 14 }}>{l.nome}</T>
                {/* com meta, o % é sobre a base da meta (como em Minha lista); sem, sobre o total */}
                <Num style={{ fontSize: 14, fontWeight: "600" }}>{FC.fmt.num(temMeta && !l.fora_meta ? l.pct_meta : l.pct, 0)}%</Num>
                {temMeta ? <T style={{ fontSize: 12.5, color: t.cores.ink3, width: 74, textAlign: "right" }}>{l.fora_meta ? "fora da meta" : `meta ${FC.fmt.num(l.alvo_pct, 0)}%`}</T> : null}
              </View>
            ))}
          </View>
        </View>
      </Cartao>
    </Secao>
  );
}

function BarrasProventos({ d, div }: { d: any; div: any }) {
  const t = useTema();
  if (!FC.modulo("dividendos")) return null;
  let meses: any[] = [];
  if (div) meses = div.serie.filter((m: any) => !m.futuro).map((m: any) => ({ mes: m.mes, total: m.total, itens: m.itens }));
  else if (d.historico.renda_mensal && d.historico.renda_mensal.meses) meses = d.historico.renda_mensal.meses.slice(-12);
  while (meses.length && !(meses[0].total > 0)) meses.shift();
  if (meses.length < 2) return null;
  const total = FC.soma(meses, (m: any) => m.total);
  return (
    <Secao titulo="Proventos" sub="o que caiu em cada mês" direita={<Botao variante="texto" pequeno onPress={() => vai("/dividendos")}>Detalhes ›</Botao>}>
      <Cartao>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: t.espaco.e3 }}>
          <Rs cls="pos" style={{ fontSize: 24, fontWeight: "600" }}>{FC.fmt.brlTexto(total)}</Rs>
          <T style={{ fontSize: 13, color: t.cores.ink2 }}>em {meses.length} meses · média de {FC.fmt.brlTexto(total / meses.length, 0)}</T>
        </View>
        <Grafico marcador={FC.graficos.colunas({ altura: 170, cor: "var(--s2)", barras: meses.map((m: any) => ({ rotulo: FC.datas.mesAno(m.mes + "-01"), titulo: FC.datas.mesAno(m.mes + "-01"), valor: m.total, detalhe: m.itens })) })} />
      </Cartao>
    </Secao>
  );
}

// variação de cada posição no período: preço de agora contra o do início
function variacoes(d: any, periodo: Periodo) {
  const hist = (FC.estado.mercado && FC.estado.mercado.historicos) || {};
  const de = inicioDoPeriodo(periodo, null);
  const out: any[] = [];
  for (const a of d.ativos || []) {
    if (!a.posicao || !ok(a.preco)) continue;
    let pct: number | null = null;
    if (periodo === "dia") pct = ok(a.variacao_dia) ? a.variacao_dia : null;
    else if (periodo === "tudo") pct = ok(a.posicao.variacao) ? a.posicao.variacao : null;
    else {
      const h = hist[a.ticker];
      const p0 = h && !h.erro && h.precos && h.precos.length ? FC.carteira.precoEm(h.precos, de) : null;
      pct = ok(p0) && p0 > 0 ? (a.preco / p0 - 1) * 100 : null;
    }
    if (ok(pct)) out.push({ ticker: a.ticker, pct, valor: a.posicao.atual });
  }
  return out.sort((x, y) => y.pct - x.pct);
}
function Destaques({ d, periodo }: { d: any; periodo: Periodo }) {
  const t = useTema();
  const v = variacoes(d, periodo);
  if (v.length < 2) return null;
  const n = Math.min(3, Math.floor(v.length / 2) || 1);
  const sobe = v.slice(0, n).filter((x) => x.pct > 0), cai = v.slice(-n).reverse().filter((x) => x.pct < 0);
  if (!sobe.length && !cai.length) return null;
  const escala = Math.max(...[...sobe, ...cai].map((x) => Math.abs(x.pct)), 0.01);
  const barra = (x: any) => (
    <Pressable key={x.ticker} onPress={() => abreAtivo(x.ticker)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <T style={{ width: 64, fontSize: 14, fontWeight: "600" }}>{x.ticker}</T>
      <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: t.cores.campo, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(3, (Math.abs(x.pct) / escala) * 100)}%`, height: "100%", borderRadius: 5, backgroundColor: x.pct >= 0 ? t.cores.verde : t.cores.vermelho }} />
      </View>
      <Num cls={x.pct >= 0 ? "pos" : "neg"} style={{ width: 70, textAlign: "right", fontSize: 14, fontWeight: "600" }}>{pctTxt(x.pct)}</Num>
    </Pressable>
  );
  return (
    <Secao titulo="Melhores e piores" sub={NOME_PERIODO[periodo]} direita={<Botao variante="texto" pequeno onPress={() => vai("/ativos")}>Detalhes ›</Botao>}>
      <Cartao>
        {sobe.length ? <><T style={{ fontSize: 12.5, color: t.cores.ink3, marginBottom: 2 }}>SUBIRAM</T>{sobe.map(barra)}</> : null}
        {cai.length ? <><T style={{ fontSize: 12.5, color: t.cores.ink3, marginTop: sobe.length ? t.espaco.e3 : 0, marginBottom: 2 }}>CAÍRAM</T>{cai.map(barra)}</> : null}
      </Cartao>
    </Secao>
  );
}

// os cartões das retrospectivas só aparecem no fim do período
function Retrospectivas() {
  const itens: Array<[string, string, string]> = [];
  if (FC.recap.naJanela("ano")) itens.push(["ano", `Seu ${FC.recap.periodoDe("ano").rotulo} em retrospectiva`, "o ano inteiro contado em etapas"]);
  if (FC.recap.naJanela("mes")) itens.push(["mes", `Retrospectiva de ${FC.recap.periodoDe("mes").rotulo.split(" ")[0].toLowerCase()}`, "seu mês contado em etapas"]);
  if (!itens.length) return null;
  return (
    <>
      {itens.map(([tipo, titulo, s]) => <EntradaRecap key={tipo} tipo={tipo} titulo={titulo} sub={`${s}, com os seus números`} />)}
    </>
  );
}
export function EntradaRecap({ tipo, titulo, sub }: { tipo: string; titulo: string; sub: string }) {
  const t = useTema();
  const ano = tipo === "ano";
  return (
    <Cartao onPress={() => vai(`/retrospectiva/${tipo}`)} style={{ marginTop: t.espaco.e4, flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 1,
        ...degrade(ano ? "linear-gradient(135deg, rgba(255,225,77,.35), rgba(42,27,255,.18))" : "linear-gradient(135deg, rgba(10,132,255,.14), rgba(94,92,230,.14))") } as any} />
      <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: ano ? "#2a1bff" : "#0a84ff",
        boxShadow: "0 8px 20px rgba(10,132,255,.3)" } as any}>
        <Icone nome="play" tam={22} cor={ano ? "#ffe14d" : "#fff"} />
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 16, fontWeight: "600" }}>{titulo}</T>
        <T style={{ fontSize: 13, color: t.cores.ink2 }}>{sub}</T>
      </View>
      <Icone nome="chevron" tam={18} cor={t.cores.ink3} />
    </Cartao>
  );
}

function Comecar() {
  const t = useTema();
  const agro = FC.modulo("agro");
  const card = (icone: any, cor: string, titulo: string, texto: string, onPress: () => void) => (
    <Cartao onPress={onPress}>
      <Icone nome={icone} tam={28} cor={cor} />
      <T v="h3" style={{ marginTop: t.espaco.e3 }}>{titulo}</T>
      <T style={{ fontSize: 13, color: t.cores.ink2 }}>{texto}</T>
    </Cartao>
  );
  return (
    <Secao titulo="Comece por aqui" sub="cadastre o que você tem; o resto o painel calcula">
      <Grade colunas={agro ? 3 : 2}>
        {card("ativos", t.cores.acento, `Ações, FIIs e ETFs${FC.modulo("cripto") ? " e cripto" : ""}`, "Adicione o que você tem ou acompanha. O painel busca cotações e avalia cada um.", () => formAtivo())}
        {card("moeda", t.cores.verde, "Renda fixa", "CDBs, Tesouro e caixa, comparados com o CDI do dia.", () => formRendaFixa())}
        {agro ? card("boi", t.cores.terra, "Rebanho", "Compras, vendas, custos e pesagens do gado.", () => vai("/agro")) : null}
      </Grade>
    </Secao>
  );
}

/** Um bloco por id do layout (layout.js: LAYOUT_INICIO) */
export function useBlocosInicio() {
  const e = useEstado();
  const [cresc, setCresc] = useState({ ...CRESC_PADRAO });
  const [periodo, setPeriodoEstado] = useState<Periodo>(() => FC.local.ler("inicio-periodo", "mes"));
  const setPeriodo = (p: Periodo) => { FC.local.gravar("inicio-periodo", p); setPeriodoEstado(p); };
  const d = e.dados;
  return useMemo(() => {
    if (!d) return { blocos: {} as Record<string, () => React.ReactNode>, d };
    const vazio = !d.ativos.length && !d.rendaFixa.length && !d.agro.tem_dados;
    const seq = sequencia();
    const tt = d.rentab && d.rentab.total;
    const imp = resumoIR(d);
    let div: any = null;
    try { if (e.proventos) div = FC.dividendos.analisa(d, e.base, e.proventos); } catch (err) { console.error(err); }
    const des = desempenhoDoPainel(d, periodo);
    const blocos: Record<string, () => React.ReactNode> = {
      perfil: () => <CartaoPerfil />,
      topo: () => <Topo d={d} imp={imp} seq={seq} des={des} periodo={periodo} setPeriodo={setPeriodo} />,
      checklist: () => <ChecklistAtivacao />,
      comecar: () => (vazio ? <Comecar /> : null),
      curva: () => <Curva d={d} periodo={periodo} />,
      rosca: () => <RoscaAlocacao d={d} />,
      barras_proventos: () => <BarrasProventos d={d} div={div} />,
      destaques: () => <Destaques d={d} periodo={periodo} />,
      retrospectivas: () => <Retrospectivas />,
      plano_realidade: () => <CartaoPlanoRealidade />,
      frase: () => (tt ? <Frase c={comparativo(tt)} /> : null),
      detalhes: () => (tt ? <DetalhesTecnicos d={d} imp={imp} /> : <View style={{ marginTop: 24 }}><Macro m={d.macro} /></View>),
      proximos30: () => <Proximos30 d={d} div={div} />,
      renda_passiva: () => <RendaPassiva div={div} />,
      alocacao: () => <Alocacao d={d} />,
      crescimento: () => <Crescimento d={d} cresc={cresc} setCresc={setCresc} />,
      proventos: () => <Proventos r={d.historico.renda_mensal} div={div} />,
      agro: () => <AgroResumo ag={d.agro} />,
      melhores: () => <Melhores d={d} />,
    };
    return { blocos, d };
  }, [d, e.proventos, e.perfil, e.bench, e.spotEm, cresc, periodo]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** um bloco que falha não derruba a tela */
export class Isolado extends React.Component<{ id: string; children: React.ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(e: any) { console.error("bloco do Início", this.props.id, e); }
  render() { return this.state.erro ? null : this.props.children; }
}

export default function Inicio() {
  const t = useTema();
  const e = useEstado();
  const { blocos, d } = useBlocosInicio();
  if (!d) return <Pagina><EstadoMercado /></Pagina>;
  const nome = (((FC.auth.usuario || {}).user_metadata || {}).nome || "").trim();
  const layout = FC.layoutAtual().inicio;
  const ids: string[] = layout.ordem.filter((id: string) => !layout.ocultos.includes(id));
  return (
    <Pagina>
      <EstadoMercado />
      <T style={{ fontSize: 15, color: t.cores.ink2, marginBottom: 8 }}>{saudacao()}{nome ? ", " + nome : ""}.</T>
      {ids.map((id) => <Isolado key={id} id={id}>{blocos[id] ? blocos[id]() : null}</Isolado>)}
      {d.atualizado ? (
        <T v="p" centro style={{ marginTop: 48, alignSelf: "center", maxWidth: 640 }}>
          Preços atualizados {FC.datas.ha(e.spotEm) || "—"} (a cada minuto com o app aberto) · cripto pelo CoinGecko, bolsa pelo Yahoo Finance, fundamentos pelo Fundamentus e juros pelo Banco Central.
        </T>
      ) : null}
    </Pagina>
  );
}
