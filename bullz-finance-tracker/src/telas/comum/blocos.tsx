/* Os blocos de números do Início (detalhes técnicos, alocação em barras,
 * proventos, renda passiva, próximos 30 dias, agro, crescimento…). Cada um
 * é um módulo opcional do Início (Ajustes → Layout) e tem o seu lugar fixo
 * na tela do assunto: Investimentos › Rentabilidade, Minha lista, Dividendos,
 * Agro e Salário. */
import React, { useState } from "react";
import { Pressable, View, Text } from "react-native";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { rerender } from "../../estado/app";
import { useMedidas } from "../../ui/medidas";
import {
  Ajuda, Anel, B, BarraAlocacao, Botao, Cartao, Detalhes, Indicadores, Item, Kpi, KpiValor, Kpis, Legenda,
  Lista, Mensagem, Num, Pilula, Ponto, Rs, Secao, T, Trilha, Valores,
} from "../../ui/kit";
import { CampoData, Segmentado } from "../../ui/campos";
import { Grafico } from "../../ui/grafico";
import { Icone } from "../../ui/icone";
import { caixaAtual } from "./caixa-proventos";
import { abreAtivo } from "./ativo";
import FC from "../../nucleo";

const ok = (v: any) => FC.ok(v);
const sinal = (v: number) => (v >= 0 ? "+" : "−");
const vai = (c: string) => router.push(c as any);

// ---------------------------------------------------------------- macro
export function Macro({ m }: { m: any }) {
  const t = useTema();
  const { celular } = useMedidas();
  const itens: Array<[string, string]> = [["selic_meta", "Selic"], ["cdi", "CDI"], ["ipca_12m", "IPCA 12m"], ["juro_real", "Juro real"]];
  const fontes = (m && m.fontes) || {};
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, backgroundColor: t.cores.linha, borderRadius: t.raios.r, overflow: "hidden",
      borderWidth: 1, borderColor: t.cores.linha, boxShadow: t.cores.sombra } as any}>
      {itens.map(([k, r]) => {
        const f = fontes[k] || {};
        let quando = "", atrasado = false;
        if (f.data) {
          const iso = FC.datas.deBr(f.data);
          if (iso) {
            const d = FC.datas.dias(iso, FC.datas.hoje());
            quando = d < 0 ? "vigente a partir de " + f.data : "apurado em " + f.data;
            atrasado = d > 40;
          }
        }
        return (
          <View key={k} style={{ flexBasis: celular ? "49.5%" : "24.6%", flexGrow: 1, backgroundColor: t.cores.bg2, paddingVertical: t.espaco.e3, paddingHorizontal: t.espaco.e4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <T style={{ fontSize: 13, color: t.cores.ink2 }}>{r}</T>
              <Ajuda texto={`${f.descricao || ""}. Fonte: ${f.origem || "—"}.`} />
            </View>
            <Num style={{ marginTop: 2, fontSize: 22, fontWeight: "600", letterSpacing: -0.44 }}>{m && ok(m[k]) ? FC.fmt.num(m[k]) + "%" : "—"}</Num>
            <T style={{ fontSize: 11.5, color: atrasado ? t.cores.amarelo : t.cores.ink3 }}>{quando || " "}</T>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- alocação
export function Alocacao({ d }: { d: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const [aberto, setAberto] = useState<string | null>(null);
  if (!d.alocacao.length) return null;
  // barra e traço na escala do patrimônio todo; a meta vale sobre os pilares
  // com meta (alvo_no_patrimonio) e o texto continua medido só sobre eles
  const mostra = (l: any) => l.pct;
  const fora = d.alocacao.filter((l: any) => l.fora_meta);
  const escala = Math.max(...d.alocacao.map((l: any) => Math.max(mostra(l), l.alvo_no_patrimonio || 0))) * 1.12 || 100;
  const sub = `a barra é a fatia do patrimônio total; o traço, a sua meta${fora.length ? `. ${fora.map((l: any) => l.nome).join(" e ")} ${fora.length === 1 ? "tem" : "têm"} meta 0% e ${fora.length === 1 ? "fica" : "ficam"} fora da conta da meta` : ""}`;
  return (
    <Secao titulo="Alocação por pilar" sub={sub} direita={<Botao variante="texto" pequeno onPress={() => vai("/ajustes/criterios")}>Mudar metas</Botao>}>
      <Lista>
        {d.alocacao.map((l: any) => (
          <View key={l.chave}>
            <Item onPress={() => setAberto(aberto === l.chave ? null : l.chave)}
              esquerda={<Ponto cor={l.cor} tam={12} />}
              titulo={
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <T style={{ fontWeight: "600", fontSize: 15 }}>{l.nome}</T>
                  <T style={{ fontSize: 13, color: t.cores.ink3 }}>{l.composicao.length} {l.composicao.length === 1 ? "item" : "itens"}</T>
                </View>}
              detalhe={<View style={{ marginTop: t.espaco.e2, flexDirection: "row" }}><BarraAlocacao pct={mostra(l)} alvo={l.fora_meta ? null : l.alvo_no_patrimonio} escala={escala} cor={l.cor} /></View>}
              valores={
                <View style={{ alignItems: "flex-end", minWidth: 120 }}>
                  {l.fora_meta ? (
                    <>
                      <Num style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.num(l.pct, 1)}%<Text style={{ color: t.cores.ink3, fontWeight: "400" }}> do total</Text></Num>
                      <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>fora da meta</T>
                    </>
                  ) : (
                    <>
                      <Num style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.num(l.pct_meta, 1)}%<Text style={{ color: t.cores.ink3, fontWeight: "400" }}> / {FC.fmt.num(l.alvo_pct, 0)}%</Text></Num>
                      <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>
                        {Math.abs(l.desvio_pct) < 1 ? "na meta" : l.desvio_reais > 0
                          ? <>aportar <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(l.desvio_reais, 0)}</Rs></>
                          : <><Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(-l.desvio_reais, 0)}</Rs> acima</>}
                      </T>
                    </>
                  )}
                </View>} />
            {aberto === l.chave ? (
              <View style={{ backgroundColor: t.cores.bg3, borderTopWidth: 1, borderTopColor: t.cores.linha }}>
                {l.composicao.map((x: any, i: number) => (
                  <Pressable key={i} disabled={!x.ticker} onPress={() => x.ticker && abreAtivo(x.ticker)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: estreito ? 30 : 52, paddingRight: estreito ? 14 : 24 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={{ fontSize: 14 }}><B>{x.nome}</B> <Text style={{ fontSize: 12.5, color: t.cores.ink2 }}>{x.tipo || ""}</Text></T>
                      <View style={{ maxWidth: 260, marginTop: t.espaco.e2 }}><Trilha pct={x.peso} cor={l.cor} /></View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Rs style={{ fontSize: 13.5 }}>{FC.fmt.brlTexto(x.valor)}</Rs>
                      <T style={{ fontSize: 12, color: t.cores.ink2 }}>{FC.fmt.num(x.peso, 1)}% do pilar</T>
                    </View>
                    <View style={{ width: 90, alignItems: "flex-end" }}>
                      {ok(x.score) ? <Pilula cor={x.cor}>{Math.round(x.score)}</Pilula>
                        : ok(x.variacao) ? <Num cls={x.variacao >= 0 ? "pos" : "neg"} style={{ fontSize: 14 }}>{FC.fmt.delta(x.variacao)}%</Num> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </Lista>
    </Secao>
  );
}

// ---------------------------------------------------------------- proventos por mês
export function Proventos({ r, div }: { r: any; div: any }) {
  if (!FC.modulo("dividendos")) return null;
  if ((!r || r.n_meses < 2) && div) {
    const meses = div.serie.filter((m: any) => !m.futuro).map((m: any) => ({ mes: m.mes, total: m.total, itens: m.itens }));
    while (meses.length && !(meses[0].total > 0)) meses.shift();
    if (meses.length >= 2) {
      const total = FC.soma(meses, (m: any) => m.total), ult = meses.slice(-3);
      r = { meses, total, ultimo: meses.at(-1).total, media_recente: FC.soma(ult, (m: any) => m.total) / ult.length, n_meses: meses.length };
    }
  }
  if (!r || r.n_meses < 2) return null;
  return (
    <Secao titulo="Proventos por mês" sub="o que a carteira deposita sem você vender nada">
      <Cartao>
        <Kpis style={{ marginBottom: 24 }}>
          <Kpi rotulo="Último mês" valor={FC.fmt.brlTexto(r.ultimo)} dinheiro />
          <Kpi rotulo="Média dos 3 últimos" valor={FC.fmt.brlTexto(r.media_recente)} dinheiro />
          <Kpi rotulo="Total recebido" valor={FC.fmt.brlTexto(r.total)} dinheiro peq={`em ${r.n_meses} meses`} />
        </Kpis>
        <Grafico marcador={FC.graficos.colunas({ barras: r.meses.map((m: any) => ({ rotulo: FC.datas.mesAno(m.mes + "-01"), titulo: FC.datas.mesAno(m.mes + "-01"), valor: m.total, detalhe: m.itens })) })} />
      </Cartao>
    </Secao>
  );
}

export function AgroResumo({ ag }: { ag: any }) {
  const t = useTema();
  if (!ag.tem_dados || !FC.modulo("agro")) return null;
  return (
    <Secao titulo="Agronegócio" sub="rebanho e resultado da atividade"
      direita={<Botao variante="texto" pequeno onPress={() => vai("/agro")}>Abrir ›</Botao>}>
      <Cartao onPress={() => vai("/agro")}>
        <Kpis>
          <Kpi rotulo={<View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><Icone nome="boi" tam={16} cor={t.cores.ink2} /><T v="rot" style={{ fontWeight: "400" }}>Rebanho</T></View>}
            valor={FC.fmt.int(ag.total)} peq="cabeças" />
          <Kpi rotulo="Valor estimado" valor={FC.fmt.brlTexto(ag.valorRebanho, 0)} dinheiro />
          <Kpi rotulo="Resultado da atividade" valor={FC.fmt.brlTexto(ag.financeiro.resultado, 0)} dinheiro cls={ag.financeiro.resultado >= 0 ? "pos" : "neg"}
            peq={ok(ag.financeiro.retorno_pct) ? `${FC.fmt.delta(ag.financeiro.retorno_pct)}% sobre o capital aportado` : undefined} />
        </Kpis>
      </Cartao>
    </Secao>
  );
}

// ---------------------------------------------------------------- crescimento
export const CRESC_PADRAO = { periodo: "tudo", vista: "patrimonio", de: null as string | null, ate: null as string | null };
// Espaçamento do gráfico conforme o tamanho do período: com anos de histórico,
// um ponto por mês; em meses, um por semana; no curto prazo, um por dia.
export function granularidade(de: string, ate: string) {
  const dias = FC.datas.dias(de, ate);
  return dias > 400 ? "mes" : dias > 75 ? "semana" : "dia";
}
export function espaca(pontos: any[], grao: string) {
  if (grao === "dia" || pontos.length < 3) return pontos;
  const chave = grao === "mes" ? (d: string) => d.slice(0, 7) : (d: string) => Math.floor(FC.datas.dias(pontos[0][0], d) / 7);
  const saida = [pontos[0]];
  for (let i = 1; i < pontos.length; i++) {
    const fimDoGrupo = i === pontos.length - 1 || chave(pontos[i + 1][0]) !== chave(pontos[i][0]);
    if (fimDoGrupo) saida.push(pontos[i]);
  }
  return saida;
}
// série reconstruída (cara de calcular): uma vez por montagem da carteira
const cacheSerie = new WeakMap<any, any>();
export function serieDoPainel(d: any) {
  const e = FC.estado;
  const c = cacheSerie.get(d);
  if (c && c.proventos === e.proventos) return c.r;
  let pagamentos: any[] = [];
  try { if (e.proventos) pagamentos = FC.dividendos.analisa(d, e.base, e.proventos).pagamentos; } catch (err) { console.error(err); }
  let r: any = { pontos: [], inicio: null };
  try { r = FC.rentab.serieDiaria(e.base, e.mercado, e.mercado.indices, e.prefs, d.resumo.patrimonio > 0 ? d.resumo.patrimonio : null, pagamentos); }
  catch (err) { console.error(err); }
  cacheSerie.set(d, { proventos: e.proventos, r });
  return r;
}
let benchPedido = false;
export function garanteIbov(anos: number) {
  const e = FC.estado;
  if (e.bench || benchPedido) return;
  benchPedido = true;
  FC.mercado.benchmarks(Math.min(10, Math.max(2, anos)))
    .then((b: any) => { e.bench = b; rerender(); })
    .catch((err: any) => { console.error(err); e.bench = { ibov: [], erro: true }; })
    .finally(() => { benchPedido = false; });
}
// a nota do velocímetro (cara: usa a série diária, que já fica em cache)
export function desempenhoDoPainel(d: any, periodo: string) {
  const e = FC.estado;
  const ser = serieDoPainel(d);
  // renda variável precisa do Ibovespa: pede o histórico se ainda não veio
  const temRv = ser.pontos.length && ser.pontos.at(-1).partes && ser.pontos.at(-1).partes.rv.valor > 0.5;
  if (temRv && !e.bench && ser.inicio) garanteIbov(Math.ceil(FC.datas.dias(ser.inicio, FC.datas.hoje()) / 365) + 1);
  try {
    return FC.desempenho.calcula({ pontos: ser.pontos, ciclos: ser.ciclos || [], ix: e.mercado.indices, ibov: e.bench && e.bench.ibov, periodo });
  } catch (err) {
    console.error(err);
    return { suficiente: false, score: 50, faixa: FC.desempenho.faixaDe(50), partes: [], tendencia: [] };
  }
}

// valor dia a dia de uma carteira que só tivesse o índice
function simula(trecho: any[], retorno: (a: string, b: string) => number | null) {
  let v = trecho[0].valor;
  const out: any[] = [[trecho[0].data, v]];
  for (let i = 1; i < trecho.length; i++) {
    const r = retorno(trecho[i - 1].data, trecho[i].data);
    v = v * (r == null ? 1 : r) + (trecho[i].fluxo - trecho[i - 1].fluxo);
    out.push([trecho[i].data, v]);
  }
  return out;
}

function BotaoComparar({ k, ativo, onPress }: { k: "selic" | "ibov"; ativo: boolean; onPress: () => void }) {
  const t = useTema();
  const [borda, cor, fundo] = k === "selic" ? [t.cores.s3, t.cores.amarelo, t.cores.amareloSuave] : [t.cores.s4, t.cores.s4, "rgba(175,82,222,.12)"];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: ativo }}
      style={{ borderWidth: 1.5, borderColor: ativo ? borda : t.cores.linha2, backgroundColor: ativo ? fundo : "transparent",
        borderRadius: 980, paddingVertical: 5, paddingHorizontal: 12, minHeight: 32, justifyContent: "center" }}>
      <Text style={{ fontSize: 13.5, color: ativo ? cor : t.cores.ink2, fontWeight: ativo ? "600" : "400" }}>{k === "selic" ? "Selic" : "Ibovespa"}</Text>
    </Pressable>
  );
}

export function Crescimento({ d, cresc, setCresc }: { d: any; cresc: typeof CRESC_PADRAO; setCresc: (c: typeof CRESC_PADRAO) => void }) {
  const t = useTema();
  const [cmp, setCmp] = useState(() => FC.local.ler("cresc-comparar", { selic: false, ibov: false }));
  const hoje = FC.datas.hoje();
  const ser = serieDoPainel(d);
  const painel = ser.pontos;
  const anotados = (d.registros || []).filter((r: any) => r.origem === "importado").map((r: any) => ({ data: r.data, valor: r.patrimonio }));
  if (!painel.length && !anotados.length) return null;
  const primeiroDia = [anotados[0] && anotados[0].data, ser.inicio].filter(Boolean).sort()[0];
  const periodos: Record<string, [string, string]> = { ano: [FC.datas.soma(hoje, -365), hoje], mes: [FC.datas.soma(hoje, -30), hoje], tudo: [primeiroDia, hoje],
    custom: [cresc.de || FC.datas.soma(hoje, -90), cresc.ate || hoje] };
  const [de, ate] = periodos[cresc.periodo] || periodos.tudo;
  const grao = granularidade(de < primeiroDia ? primeiroDia : de, ate);
  const trecho = painel.filter((p: any) => p.data >= de && p.data <= ate);
  const dentroAnot = anotados.filter((r: any) => r.data >= de && r.data <= ate);
  const antesAnot = dentroAnot.length ? [...anotados].reverse().find((r: any) => r.data < de) : null;
  const trechoAnot = (antesAnot ? [antesAnot] : []).concat(dentroAnot);

  // rendimento = variação do patrimônio menos o dinheiro que entrou no período
  let rend: any = null, serieRend: any[] = [], cdiPer: number | null = null;
  const p0 = trecho[0], p1 = trecho.at(-1);
  if (trecho.length >= 2) {
    const fluxo = p1.fluxo - p0.fluxo;
    const abs = p1.valor - p0.valor - fluxo;
    const capital = p0.valor + Math.max(0, fluxo);
    rend = { abs, pct: capital > 0 ? (abs / capital) * 100 : null };
    serieRend = trecho.map((p: any) => [p.data, p.valor - p0.valor - (p.fluxo - p0.fluxo)]);
    const ix = FC.estado.mercado.indices;
    if (ix && typeof ix.fator === "function") cdiPer = (ix.fator("cdi", 100, p0.data, p1.data).f - 1) * 100;
  }
  const provPer = trecho.length >= 2 ? (p1.proventos || 0) - (p0.proventos || 0) : 0;
  const fluxoPer = trecho.length >= 2 ? p1.fluxo - p0.fluxo + provPer : 0;

  const refs: any[] = [];
  if (trecho.length >= 2) {
    const ix = FC.estado.mercado.indices;
    if (cmp.selic && ix && typeof ix.fator === "function") {
      const estimada = !ix.ultimo || !ix.ultimo.selic;
      refs.push({ k: "selic", nome: estimada ? "Selic (pelo CDI)" : "Selic", classe: "lselic",
        pontos: simula(trecho, (a, b) => ix.fator("selic", 100, a, b).f), indice: (ix.fator("selic", 100, p0.data, p1.data).f - 1) * 100 });
    }
    if (cmp.ibov) {
      const b = FC.estado.bench;
      if (!b) garanteIbov(Math.ceil(FC.datas.dias(p0.data, hoje) / 365) + 1);
      const serie = b && b.ibov && b.ibov.length ? b.ibov : null;
      if (serie) {
        const pt = (x: string) => FC.carteira.precoEm(serie, x) ?? serie[0][1];
        refs.push({ k: "ibov", nome: "Ibovespa", classe: "libov", pontos: simula(trecho, (a, c) => pt(c) / pt(a)), indice: (pt(p1.data) / pt(p0.data) - 1) * 100 });
      } else refs.push({ k: "ibov", nome: "Ibovespa", carregando: !(b && b.erro), erro: !!(b && b.erro) });
    }
  }
  const refsProntas = refs.filter((r) => r.pontos);
  const corRef = (k: string) => (k === "selic" ? t.cores.s3 : t.cores.s4);

  const series: any[] = [];
  if (trechoAnot.length >= 2) series.push({ nome: "Anotado à parte", pontos: espaca(trechoAnot.map((r: any) => [r.data, r.valor]), "dia"), classe: "lref" });
  for (const r of refsProntas) series.push({ nome: r.nome, pontos: espaca(r.pontos, grao), classe: r.classe });
  if (trecho.length >= 2) series.push({ nome: "Patrimônio", pontos: espaca(trecho.map((p: any) => [p.data, p.valor]), grao), classe: "l1", area: true });
  const lacuna = trechoAnot.length >= 2 && trecho.length >= 2 && FC.datas.dias(trechoAnot.at(-1).data, trecho[0].data) > 45;

  const alternaCmp = (k: "selic" | "ibov") => { const c = { ...cmp, [k]: !cmp[k] }; FC.local.gravar("cresc-comparar", c); setCmp(c); };

  const grafico = cresc.vista === "rendimento"
    ? (serieRend.length >= 2 ? (
      <>
        <Grafico marcador={FC.graficos.linhas({ series: [
          ...refsProntas.map((r) => ({ nome: r.nome, pontos: espaca(r.pontos.map(([dt, v]: any, i: number) => [dt, v - p0.valor - (trecho[i].fluxo - p0.fluxo)]), grao), classe: r.classe })),
          { nome: "Rendimento", pontos: espaca(serieRend, grao), classe: "l2", area: false }], altura: 240, zero: true })} />
        {refsProntas.length ? <Legenda itens={[{ cor: t.cores.s2, rotulo: "sua carteira" }, ...refsProntas.map((r) => ({ cor: corRef(r.k), rotulo: `${r.nome}, com os mesmos aportes`, tipo: "tracejado" as const }))]} /> : null}
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Quanto o patrimônio rendeu no período, já sem o dinheiro que você aportou ou retirou.</T>
      </>
    ) : <Mensagem tipo="info" icone="info">O painel ainda não tem dias suficientes neste período para medir o rendimento. Escolha um período maior.</Mensagem>)
    : (series.length ? (
      <>
        <Grafico marcador={FC.graficos.linhas({ series, altura: 240 })} />
        <Legenda itens={[
          ...(trecho.length >= 2 ? [{ cor: t.cores.s1, rotulo: "calculado pelo painel, dia a dia, com o que está cadastrado nele" }] : []),
          ...(trechoAnot.length >= 2 ? [{ cor: t.cores.sref, rotulo: "total anotado à parte (Notion), mês a mês", tipo: "tracejado" as const }] : []),
          ...refsProntas.map((r) => ({ cor: corRef(r.k), rotulo: `${r.nome}, com os mesmos aportes`, tipo: "tracejado" as const })),
        ]} />
        {trechoAnot.length >= 2 && trecho.length >= 2 && !lacuna ? <T v="p" style={{ marginTop: t.espaco.e3 }}>As duas linhas medem coisas diferentes: a tracejada é o total que você anotava; a cheia só conhece o que já foi cadastrado no painel em cada data.</T> : null}
        {lacuna ? <T v="p" style={{ marginTop: t.espaco.e3 }}>Entre {FC.datas.mesAno(trechoAnot.at(-1).data)} e {FC.datas.mesAno(trecho[0].data)} não há registro — o gráfico deixa o intervalo em branco em vez de inventar a linha.</T> : null}
      </>
    ) : <Mensagem tipo="info" icone="info">Só há um registro neste período.</Mensagem>);

  const subtitulo = `${cresc.periodo === "tudo" ? "desde " + FC.datas.mesAno(primeiroDia) : cresc.periodo === "ano" ? "últimos 12 meses" : FC.datas.br(de) + " a " + FC.datas.br(ate)} · um ponto por ${grao === "mes" ? "mês" : grao}`;
  return (
    <Secao titulo="Crescimento do patrimônio" sub={subtitulo}>
      <Cartao>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24, alignItems: "center" }}>
          <Segmentado rotuloA11y="Período" valor={cresc.periodo} aoMudar={(p) => setCresc({ ...cresc, periodo: p })}
            opcoes={[{ v: "tudo", rotulo: "Tudo" }, { v: "ano", rotulo: "Ano" }, { v: "mes", rotulo: "Mês" }, { v: "custom", rotulo: "Personalizado" }]} />
          {cresc.periodo === "custom" ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ width: 170 }}><CampoData compacto valor={de} min={primeiroDia} max={hoje} rotuloA11y="De"
                aoMudar={(v) => { let a = v || null, b = cresc.ate; if (a && b && a > b) [a, b] = [b, a]; setCresc({ ...cresc, de: a, ate: b }); }} /></View>
              <T style={{ color: t.cores.ink2 }}>até</T>
              <View style={{ width: 170 }}><CampoData compacto valor={ate} min={primeiroDia} max={hoje} rotuloA11y="Até"
                aoMudar={(v) => { let a = cresc.de, b = v || null; if (a && b && a > b) [a, b] = [b, a]; setCresc({ ...cresc, de: a, ate: b }); }} /></View>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLabel="Comparar com">
            <T style={{ fontSize: 13.5, color: t.cores.ink2 }}>Comparar com</T>
            <BotaoComparar k="selic" ativo={!!cmp.selic} onPress={() => alternaCmp("selic")} />
            <BotaoComparar k="ibov" ativo={!!cmp.ibov} onPress={() => alternaCmp("ibov")} />
          </View>
          <View style={{ marginLeft: "auto" }}>
            <Segmentado rotuloA11y="O que mostrar" valor={cresc.vista} aoMudar={(v) => setCresc({ ...cresc, vista: v })}
              opcoes={[{ v: "patrimonio", rotulo: "Patrimônio" }, { v: "rendimento", rotulo: "Rendimento" }]} />
          </View>
        </View>
        <Kpis style={{ marginBottom: 24 }}>
          <Kpi rotulo="Rendimento no período"
            valor={<KpiValor dinheiro cls={rend ? (rend.abs >= 0 ? "pos" : "neg") : "fraco"}>{rend ? `${sinal(rend.abs)}${FC.fmt.brlTexto(Math.abs(rend.abs))}` : "—"}</KpiValor>}
            peq={rend && ok(rend.pct) ? FC.fmt.delta(rend.pct, 2) + "% sem contar aportes" + (provPer > 0.005 ? `, com ${FC.fmt.brlTexto(provPer)} de proventos` : "") : "sem dias suficientes"} />
          <Kpi pequeno rotulo="Aportes no período" dinheiro
            valor={Math.abs(fluxoPer) > 0.005 ? `${sinal(fluxoPer)}${FC.fmt.brlTexto(Math.abs(fluxoPer))}` : FC.fmt.brlTexto(0)}
            peq={fluxoPer < 0 ? "saiu mais do que entrou" : "dinheiro novo que entrou"} />
          {ok(cdiPer) ? <Kpi pequeno rotulo="CDI no período" valor={`${FC.fmt.num(cdiPer, 2)}%`} peq="para comparar com o rendimento" /> : null}
          <Kpi pequeno rotulo={`Patrimônio ${p1 && p1.data === hoje ? "agora" : "no fim"}`} dinheiro
            valor={FC.fmt.brlTexto(p1 ? p1.valor : (trechoAnot.at(-1) || {}).valor || 0)}
            peq={trecho.length >= 2 ? <><Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{sinal(p1.valor - p0.valor)}{FC.fmt.brlTexto(Math.abs(p1.valor - p0.valor))}</Rs> no período, com aportes</> : undefined} />
        </Kpis>
        {refs.some((r) => r.carregando) ? <T v="p" style={{ marginBottom: t.espaco.e3 }}>Buscando o histórico do Ibovespa…</T> : null}
        {refs.some((r) => r.erro) ? <T v="p" style={{ marginBottom: t.espaco.e3 }}>O histórico do Ibovespa não veio agora. Tente atualizar daqui a pouco.</T> : null}
        {refsProntas.length ? (
          <View style={{ paddingTop: 4, borderTopWidth: 1, borderTopColor: t.cores.linha, marginBottom: 24 }}>
            <Kpis>
              {refsProntas.map((r) => {
                const fim = r.pontos.at(-1)[1], dif = p1.valor - fim;
                return (
                  <View key={r.k}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: corRef(r.k), marginRight: 6 }} />
                      <T v="rot" style={{ fontWeight: "400" }}>Se fosse {r.nome}</T>
                    </View>
                    <KpiValor pequeno dinheiro>{FC.fmt.brlTexto(fim)}</KpiValor>
                    <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{r.nome.split(" ")[0]} no período: {FC.fmt.delta(r.indice, 2)}% · você está <Rs cls={dif >= 0 ? "pos" : "neg"} style={{ fontSize: 12.5, fontWeight: "600" }}>{sinal(dif)}{FC.fmt.brlTexto(Math.abs(dif))}</Rs> {dif >= 0 ? "acima" : "abaixo"}</T>
                  </View>
                );
              })}
            </Kpis>
          </View>
        ) : null}
        {grafico}
      </Cartao>
    </Secao>
  );
}

// ---------------------------------------------------------------- topo
// o IR vem de FC.impostos; sem ele, valores brutos
export function resumoIR(d: any) {
  if (typeof FC.impostos === "undefined" || !FC.impostos.resumo) return null;
  try { return FC.impostos.resumo(d, FC.estado.base); } catch (err) { console.error(err); return null; }
}

// a TIR contra o CDI e a inflação do mesmo período; com menos de 90 dias, tudo no período
export function comparativo(tt: any) {
  if (!tt || !tt.desde) return null;
  const hoje = FC.datas.hoje(), dias = FC.datas.dias(tt.desde, hoje);
  const anual = ok(tt.xirr) && dias >= 90;
  const meu = anual ? tt.xirr : tt.periodo_pct;
  if (!ok(meu) || dias < 1) return null;
  const ix = FC.estado.mercado && FC.estado.mercado.indices;
  let cdi = null, ipca = null;
  if (ix && !ix.vazio && typeof ix.fator === "function") {
    const taxa = (f: number) => (anual ? (Math.pow(f, 365 / dias) - 1) * 100 : (f - 1) * 100);
    try {
      const fc = ix.fator("cdi", 100, tt.desde, hoje).f, fi = ix.fator("ipca", 0, tt.desde, hoje).f;
      if (fc !== 1 || dias < 5) cdi = taxa(fc);
      if (fi !== 1 || dias < 5) ipca = taxa(fi);
    } catch (err) { console.error(err); }
  }
  return { meu, anual, dias, cdi, ipca, desde: tt.desde };
}

export function Frase({ c }: { c: any }) {
  const t = useTema();
  if (!c) return null;
  const n = (v: number) => FC.fmt.num(v, 1) + "%";
  const quando = c.anual ? "ao ano" : `nos ${FC.fmt.int(c.dias)} dias desde ${FC.datas.br(c.desde)}`;
  if (!ok(c.cdi) || !ok(c.ipca)) {
    return <Mensagem tipo="info" icone="info" style={{ marginTop: t.espaco.e4 }}><T style={{ fontSize: 14 }}>Seu dinheiro rendeu <B>{n(c.meu)}</B> {quando}.</T></Mensagem>;
  }
  const cls = c.meu >= c.cdi ? "ok" : c.meu >= c.ipca ? "alerta" : "erro";
  const leitura = cls === "ok" ? "Você está ganhando do CDI." : cls === "alerta" ? "Ganhou da inflação, mas ficou abaixo do CDI." : "Ficou abaixo da inflação: o dinheiro perdeu poder de compra.";
  const cor = cls === "ok" ? t.cores.verde : cls === "erro" ? t.cores.vermelho : t.cores.ink;
  return (
    <Mensagem tipo={cls as any} icone={cls === "ok" ? "check" : cls === "alerta" ? "info" : "alerta"} style={{ marginTop: t.espaco.e4 }}>
      <T style={{ fontSize: 14, lineHeight: 20, color: cor }}>
        Seu dinheiro rendeu <B>{n(c.meu)}</B> {quando}. O CDI rendeu <B>{n(c.cdi)}</B> e a inflação <B>{n(c.ipca)}</B> no mesmo período.
        {c.anual ? "" : " Com menos de 90 dias de história, os números são do período, sem anualizar."} {leitura}
      </T>
    </Mensagem>
  );
}

// "ver detalhes": as medidas técnicas, por classe, e os juros do dia
const CLASSES_RT: Array<[string, string, string]> = [["bolsa", "Ações, FIIs e ETFs", "s1"], ["cripto", "Cripto", "s3"],
  ["renda_fixa", "Renda fixa", "s2"], ["agro", "Agronegócio", "s5"]];
export function DetalhesTecnicos({ d, imp, aberto }: { d: any; imp: any; aberto?: boolean }) {
  const t = useTema();
  const rt = d.rentab, tt = rt && rt.total;
  const p = (v: any) => (ok(v) ? `${FC.fmt.delta(v, 2)}%` : "—");
  const cor = (v: any) => (ok(v) ? (v >= 0 ? "pos" : "neg") : "fraco");
  let twr = null;
  try { const s = serieDoPainel(d).pontos; if (s.length >= 2) twr = FC.rentab.twr(s); } catch (err) { console.error(err); }
  const Caixa = aberto ? View : Detalhes;
  const classes = tt ? CLASSES_RT.filter(([k]) => rt.classes[k] && (k !== "agro" || FC.modulo("agro"))) : [];
  return (
    <Caixa>
      {tt ? (
        <Kpis>
          <Kpi pequeno rotulo="TIR" ajuda="Taxa interna de retorno com a data de cada aporte, resgate e provento (XIRR): a taxa anual que o dinheiro rendeu. Aparece a partir de 90 dias."
            valor={p(tt.xirr)} cls={cor(tt.xirr)} peq={ok(tt.xirr) ? "ao ano" : "precisa de 90 dias"} />
          <Kpi pequeno rotulo="No período" ajuda="Ganho dividido pelo capital médio que ficou aplicado, ponderado pelo tempo de cada aporte (Modified Dietz)."
            valor={p(tt.periodo_pct)} cls={cor(tt.periodo_pct)} peq={`desde ${FC.datas.br(tt.desde)}`} />
          <Kpi pequeno rotulo="TWR" ajuda="Retorno ponderado pelo tempo: encadeia o rendimento de cada dia e ignora o tamanho dos aportes. É a medida usada por fundos para comparar com o CDI ou o Ibovespa."
            valor={p(twr)} cls={cor(twr)} peq="pela série diária do painel" />
        </Kpis>
      ) : null}
      {classes.length ? (
        <Lista style={{ marginTop: t.espaco.e3, boxShadow: "none" } as any}>
          {classes.map(([k, nome, c]) => {
            const x = rt.classes[k], ir = imp && imp.por_classe && imp.por_classe[k];
            return (
              <Item key={k} esquerda={<Ponto cor={(t.cores as any)[c]} tam={12} />} titulo={nome} detalheLinhas={2}
                detalhe={`colocou ${FC.fmt.brlTexto(x.aplicado - (x.devolvido || 0))} · vale ${FC.fmt.brlTexto(x.valor_atual)}${ir && ir.ir > 0.005 ? ` · IR estimado ${FC.fmt.brlTexto(ir.ir)}` : ""}`}
                valores={<Valores cls={x.ganho >= 0 ? "pos" : "neg"} b={`${sinal(x.ganho)}${FC.fmt.brlTexto(Math.abs(x.ganho))}`}
                  small={ok(x.xirr) ? `${p(x.xirr)} ao ano` : `${p(x.periodo_pct)} no período`} />} />
            );
          })}
        </Lista>
      ) : null}
      {imp && imp.notas && imp.notas.length ? (
        <View style={{ marginTop: t.espaco.e3, paddingLeft: 4, gap: 4 }}>
          {imp.notas.map((n: string, i: number) => <T key={i} v="p">•  {n}</T>)}
        </View>
      ) : null}
      <View style={{ marginTop: t.espaco.e4 }}><Macro m={d.macro} /></View>
      <T v="p" style={{ marginTop: t.espaco.e3 }}>A frase de cima usa a TIR (o rendimento ao ano, com a data de cada aporte) e compara com o CDI e o IPCA acumulados desde o primeiro aporte. Os valores ainda não descontam o IR, que aparece no total líquido.</T>
      <Pressable onPress={() => vai("/irpf")} style={{ marginTop: t.espaco.e2 }}><T style={{ fontSize: 13, color: t.cores.acento }}>Relatório para a declaração do IR ›</T></Pressable>
    </Caixa>
  );
}

// ---------------------------------------------------------------- próximos 30 dias
export function Proximos30({ d, div }: { d: any; div: any }) {
  const t = useTema();
  const hoje = FC.datas.hoje(), lim = FC.datas.soma(hoje, 30);
  const itens: any[] = [];
  for (const tt of d.rendaFixa || []) {
    if (!tt.vencimento || tt.vencimento < hoje || tt.vencimento > lim || !(tt.valor_aplicado > 0.005)) continue;
    let valor = tt.valor_aplicado, liq = false;
    if (typeof FC.impostos !== "undefined" && FC.impostos.titulo) {
      try { const x = FC.impostos.titulo(tt, FC.infoTitulo(FC.estado.prefs, tt.id)); if (x && ok(x.liquido)) { valor = x.liquido; liq = true; } } catch (err) { console.error(err); }
    }
    itens.push({ data: tt.vencimento, titulo: tt.nome, detalhe: liq ? "vence · valor líquido estimado" : "vence · valor estimado", valor, ic: "calendario" });
  }
  for (const p of (div && div.proximos) || []) {
    if (!p.pagamento || p.pagamento < hoje || p.pagamento > lim) continue;
    itens.push({ data: p.pagamento, titulo: p.ticker, detalhe: `${p.tipo ? String(p.tipo).toLowerCase() : "provento"} a receber`, valor: p.valor, ic: "moeda" });
  }
  if (!itens.length) return null;
  itens.sort((a, b) => a.data.localeCompare(b.data));
  const quando = (iso: string) => { const n = FC.datas.dias(hoje, iso); return n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`; };
  return (
    <Secao titulo="Próximos 30 dias" sub="dinheiro que deve cair na conta">
      <Lista>
        {itens.map((x, i) => (
          <Item key={i} esquerda={<Icone nome={x.ic} tam={20} cor={x.ic === "moeda" ? t.cores.verde : t.cores.acento} />}
            titulo={x.titulo} detalhe={`${x.detalhe} · ${FC.datas.br(x.data)}`}
            valores={<Valores b={FC.fmt.brlTexto(x.valor)} small={quando(x.data)} />} />
        ))}
      </Lista>
    </Secao>
  );
}

// ---------------------------------------------------------------- renda passiva
export function RendaPassiva({ div, semLink }: { div: any; semLink?: boolean }) {
  const t = useTema();
  if (!div || !FC.modulo("dividendos")) return null;
  const res = div.resumo;
  const media = res.recebido_12m > 0 ? res.recebido_12m / 12 : 0;
  const mensal = media > 0 ? media : res.mensal_estimado || 0;
  const alvo = FC.objetivos(FC.estado.prefs).renda_desejada_mensal;
  if (!(mensal > 0) && !alvo) return null;
  const pct = alvo ? Math.min(100, (mensal / alvo) * 100) : null;
  const cx = caixaAtual();
  return (
    <Secao titulo="Renda passiva" sub="o que a carteira deposita sem você vender nada"
      direita={semLink ? undefined : <Botao variante="texto" pequeno onPress={() => vai("/dividendos")}>Dividendos ›</Botao>}>
      <Cartao>
        <Kpis>
          <Kpi rotulo="Você recebe por mês" ajuda="Média mensal dos proventos dos últimos 12 meses, já sem o IR do JCP. Sem pagamentos no período, a estimativa pelos proventos de cada ativo."
            valor={FC.fmt.brlTexto(mensal)} dinheiro cls="pos" peq={media > 0 ? "média dos últimos 12 meses, líquida" : "estimado pelos proventos de 12 meses"} />
          {alvo ? <Kpi rotulo="Sua meta" valor={FC.fmt.brlTexto(alvo)} dinheiro peq="por mês, para viver de renda" /> : null}
          {cx ? <Kpi rotulo={`No ${cx.nome}`} valor={FC.fmt.brlTexto(cx.saldo)} dinheiro
            peq={cx.pronto ? "passou da meta: hora de reinvestir" : cx.meta > 0 ? `faltam ${FC.fmt.brlTexto(cx.falta)} para reinvestir` : "esperando o reinvestimento"} /> : null}
        </Kpis>
        {alvo ? (
          <>
            <View style={{ marginTop: t.espaco.e4 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct as number) }}>
              <Trilha pct={pct as number} cor={t.cores.verde} altura={10} />
            </View>
            <T v="p" style={{ marginTop: t.espaco.e2 }}>
              <B>{FC.fmt.num(pct, (pct as number) < 10 ? 1 : 0)}%</B> do caminho para viver de renda
              {(pct as number) < 100 ? <> · faltam <Rs style={{ fontSize: 13, color: t.cores.ink2 }}>{FC.fmt.brlTexto(alvo - mensal)}</Rs> por mês</> : " — meta alcançada!"}
            </T>
          </>
        ) : (
          <T v="p" style={{ marginTop: t.espaco.e3 }}>Quanto você quer receber por mês para viver de renda? <Text style={{ color: t.cores.acento }} onPress={() => vai("/ajustes/criterios")}>Defina em Ajustes → Objetivos</Text> e acompanhe aqui o caminho.</T>
        )}
      </Cartao>
    </Secao>
  );
}

export function Melhores({ d }: { d: any }) {
  const { estreito } = useMedidas();
  const top = d.ativos.filter((a: any) => ok(a.score)).sort((a: any, b: any) => b.score - a.score).slice(0, 5);
  if (!top.length) return null;
  return (
    <Secao titulo="Mais aderentes aos seus critérios" sub="carteira e watchlist, pelo score"
      direita={<Botao variante="texto" pequeno onPress={() => vai("/ativos")}>Ver todos ›</Botao>}>
      <Lista>
        {top.map((a: any) => (
          <Item key={a.ticker} chevron onPress={() => abreAtivo(a.ticker)} esquerda={<Anel score={a.score} cor={a.cor} />}
            titulo={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><T style={{ fontWeight: "600", fontSize: 15 }}>{a.ticker}</T>{a.na_carteira ? null : <Pilula cor="cinza">watchlist</Pilula>}</View>}
            detalhe={`${a.tipo_rotulo}${a.segmento ? " · " + a.segmento : ""}`}
            direita={estreito ? null : <View style={{ maxWidth: 260 }}><Indicadores ativo={a} /></View>}
            valores={<Valores dinheiro={false} b={FC.fmt.preco(a.preco)} small={a.veredito_curto} />} />
        ))}
      </Lista>
    </Secao>
  );
}

