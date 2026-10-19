/* Início: o retrato do patrimônio em uma tela — port de telas/inicio.js.
 * Cada bloco é independente: a ordem e o que fica oculto vêm do layout salvo
 * (Ajustes → Layout), e um bloco que falha não derruba a tela. */
import React, { useMemo, useState } from "react";
import { Pressable, View, Text } from "react-native";
import { router } from "expo-router";
import { useTema } from "../tema";
import { useEstado, rerender } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import {
  Ajuda, Anel, B, BarraAlocacao, Botao, Cartao, Chip, Conta, Detalhes, Grade, Indicadores, Item, Kpi, KpiValor, Kpis, Legenda,
  Lista, Mensagem, Num, Pilula, Ponto, Rs, Secao, T, Trilha, Valores, degrade,
} from "../ui/kit";
import { CampoData, Segmentado } from "../ui/campos";
import { Grafico } from "../ui/grafico";
import { Icone } from "../ui/icone";
import { EstadoMercado } from "./comum/alertas";
import { caixaAtual } from "./comum/caixa-proventos";
import { abreAtivo } from "./comum/ativo";
import { formAtivo, formRendaFixa } from "./comum/formularios";
import { CartaoPerfil, CartaoPlanoRealidade, ChecklistAtivacao } from "./comum/perfil";
import { ChipSequencia, sequencia } from "./comum/sequencia";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const sinal = (v: number) => (v >= 0 ? "+" : "−");
const vai = (c: string) => router.push(c as any);

function saudacao() {
  const h = new Date().getHours();
  return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

// ---------------------------------------------------------------- macro
function Macro({ m }: { m: any }) {
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
function Alocacao({ d }: { d: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const [aberto, setAberto] = useState<string | null>(null);
  if (!d.alocacao.length) return null;
  // pilar com meta 0% fica fora do equilíbrio: aparece com a fatia do patrimônio todo
  const mostra = (l: any) => (l.fora_meta ? l.pct : l.pct_meta);
  const fora = d.alocacao.filter((l: any) => l.fora_meta);
  const escala = Math.max(...d.alocacao.map((l: any) => Math.max(mostra(l), l.alvo_pct))) * 1.12 || 100;
  const sub = `a barra é o que você tem; o traço, a sua meta${fora.length ? `. ${fora.map((l: any) => l.nome).join(" e ")} ${fora.length === 1 ? "tem" : "têm"} meta 0% e ${fora.length === 1 ? "fica" : "ficam"} fora da conta` : ""}`;
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
              detalhe={<View style={{ marginTop: t.espaco.e2, flexDirection: "row" }}><BarraAlocacao pct={mostra(l)} alvo={l.fora_meta ? null : l.alvo_pct} escala={escala} cor={l.cor} /></View>}
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
function Proventos({ r, div }: { r: any; div: any }) {
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

function AgroResumo({ ag }: { ag: any }) {
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
const CRESC_PADRAO = { periodo: "tudo", vista: "patrimonio", de: null as string | null, ate: null as string | null };
// Espaçamento do gráfico conforme o tamanho do período: com anos de histórico,
// um ponto por mês; em meses, um por semana; no curto prazo, um por dia.
function granularidade(de: string, ate: string) {
  const dias = FC.datas.dias(de, ate);
  return dias > 400 ? "mes" : dias > 75 ? "semana" : "dia";
}
function espaca(pontos: any[], grao: string) {
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
function serieDoPainel(d: any) {
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
function garanteIbov(anos: number) {
  const e = FC.estado;
  if (e.bench || benchPedido) return;
  benchPedido = true;
  FC.mercado.benchmarks(Math.min(10, Math.max(2, anos)))
    .then((b: any) => { e.bench = b; rerender(); })
    .catch((err: any) => { console.error(err); e.bench = { ibov: [], erro: true }; })
    .finally(() => { benchPedido = false; });
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

function Crescimento({ d, cresc, setCresc }: { d: any; cresc: typeof CRESC_PADRAO; setCresc: (c: typeof CRESC_PADRAO) => void }) {
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
function resumoIR(d: any) {
  if (typeof FC.impostos === "undefined" || !FC.impostos.resumo) return null;
  try { return FC.impostos.resumo(d, FC.estado.base); } catch (err) { console.error(err); return null; }
}

// a TIR contra o CDI e a inflação do mesmo período; com menos de 90 dias, tudo no período
function comparativo(tt: any) {
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

function Frase({ c }: { c: any }) {
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

function ChipValor({ cor, rotulo, valor, cls }: { cor?: string; rotulo: string; valor: string; cls?: string }) {
  const t = useTema();
  return (
    <Chip icone={cor ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} /> : undefined}>
      <Text style={{ fontSize: 13, color: t.cores.ink2 }}>{rotulo} </Text>
      <Rs cls={cls} style={{ fontSize: 13, fontWeight: "600", color: cls ? undefined : t.cores.ink }}>{valor}</Rs>
    </Chip>
  );
}

function Topo({ d, imp, seq }: { d: any; imp: any; seq: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const r = d.resumo, tt = d.rentab && d.rentab.total;
  const bruto = imp && ok(imp.bruto) ? imp.bruto : r.patrimonio;
  const tenho = imp && ok(imp.liquido) ? imp.liquido : bruto;
  const temIR = !!imp && ok(imp.ir_estimado) && imp.ir_estimado > 0.005;
  const colocou = tt ? tt.aplicado - (tt.devolvido || 0) : null;
  const ganho = tt ? (imp && ok(imp.ganho_liquido) ? imp.ganho_liquido : tt.ganho) : null;
  const ganhoPct = ok(ganho) && (colocou as number) > 0.005 ? (ganho / (colocou as number)) * 100 : null;
  const dica = imp
    ? "Estimativa do que ficaria com você se resgatasse tudo hoje: o patrimônio a preço de agora menos o imposto de renda sobre o ganho (e o IOF, nos primeiros 30 dias). Isenções, como LCI, LCA e ações até o limite mensal, já entram na conta."
    : "Soma de tudo a preço de agora: bolsa, cripto, renda fixa com rendimento e rebanho. Ainda sem descontar o imposto de renda.";
  const tamValor = estreito ? 38 : 56;
  return (
    <Cartao style={{ paddingTop: estreito ? 24 : 48, paddingHorizontal: estreito ? 24 : 48, paddingBottom: 24, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: -200, right: -60, width: 520, height: 520,
        ...degrade(`radial-gradient(closest-side, ${t.cores.acentoSuave}, transparent 70%)`) } as any} />
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        <T style={{ fontSize: 15, color: t.cores.ink2 }}>Quanto eu tenho</T><Ajuda texto={dica} />
      </View>
      <Conta valor={tenho} style={{ fontSize: tamValor, lineHeight: tamValor * 1.08, fontWeight: "600", letterSpacing: -tamValor * 0.035, marginTop: 6, marginBottom: 16 }} />
      {temIR ? (
        <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: -8, marginBottom: 14 }}>
          líquido estimado · bruto <Rs style={{ fontSize: 13, color: t.cores.ink2 }}>{FC.fmt.brlTexto(bruto)}</Rs>, IR estimado <Rs style={{ fontSize: 13, color: t.cores.ink2 }}>{FC.fmt.brlTexto(imp.ir_estimado)}</Rs>
        </T>
      ) : null}
      {tt ? (
        <Kpis style={{ marginBottom: 24 }}>
          <Kpi rotulo="Quanto eu coloquei" valor={FC.fmt.brlTexto(colocou)} dinheiro
            peq={tt.devolvido > 0.005 ? `o que saiu do bolso, já descontados ${FC.fmt.brlTexto(tt.devolvido, 0)} que voltaram` : "o que saiu do seu bolso"} />
          <Kpi rotulo="Quanto ganhei" valor={<KpiValor dinheiro cls={ganho >= 0 ? "pos" : "neg"}>{sinal(ganho)}{FC.fmt.brlTexto(Math.abs(ganho))}</KpiValor>}
            peq={<>{ok(ganhoPct) ? <><B cls={(ganhoPct as number) >= 0 ? "pos" : "neg"}>{FC.fmt.delta(ganhoPct, 1)}%</B> sobre o que você colocou</> : null}{imp && ok(imp.ganho_liquido) ? ", já sem IR" : ""}</>} />
        </Kpis>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2 }}>
        {r.bolsa || !r.cripto ? <ChipValor cor={t.cores.s1} rotulo="Bolsa" valor={FC.fmt.brlTexto(r.bolsa)} /> : null}
        {r.renda_fixa ? <ChipValor cor={t.cores.s2} rotulo="Renda fixa" valor={FC.fmt.brlTexto(r.renda_fixa)} /> : null}
        {r.agro ? <ChipValor cor={t.cores.s5} rotulo="Agro" valor={FC.fmt.brlTexto(r.agro)} /> : null}
        {r.cripto ? <ChipValor cor={t.cores.s3} rotulo="Cripto" valor={FC.fmt.brlTexto(r.cripto)} /> : null}
        {r.variacao_hoje ? <ChipValor rotulo="Hoje" cls={r.variacao_hoje >= 0 ? "pos" : "neg"} valor={`${sinal(r.variacao_hoje)}${FC.fmt.brlTexto(Math.abs(r.variacao_hoje))}`} /> : null}
        {seq ? <ChipSequencia st={seq} /> : null}
      </View>
    </Cartao>
  );
}

// "ver detalhes": as medidas técnicas, por classe, e os juros do dia
const CLASSES_RT: Array<[string, string, string]> = [["bolsa", "Ações, FIIs e ETFs", "s1"], ["cripto", "Cripto", "s3"],
  ["renda_fixa", "Renda fixa", "s2"], ["agro", "Agronegócio", "s5"]];
function DetalhesTecnicos({ d, imp }: { d: any; imp: any }) {
  const t = useTema();
  const rt = d.rentab, tt = rt && rt.total;
  const p = (v: any) => (ok(v) ? `${FC.fmt.delta(v, 2)}%` : "—");
  const cor = (v: any) => (ok(v) ? (v >= 0 ? "pos" : "neg") : "fraco");
  let twr = null;
  try { const s = serieDoPainel(d).pontos; if (s.length >= 2) twr = FC.rentab.twr(s); } catch (err) { console.error(err); }
  const classes = tt ? CLASSES_RT.filter(([k]) => rt.classes[k] && (k !== "agro" || FC.modulo("agro"))) : [];
  return (
    <Detalhes>
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
    </Detalhes>
  );
}

// ---------------------------------------------------------------- próximos 30 dias
function Proximos30({ d, div }: { d: any; div: any }) {
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
function RendaPassiva({ div }: { div: any }) {
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
      direita={<Botao variante="texto" pequeno onPress={() => vai("/dividendos")}>Dividendos ›</Botao>}>
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

function Melhores({ d }: { d: any }) {
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
  const d = e.dados;
  return useMemo(() => {
    if (!d) return { blocos: {} as Record<string, () => React.ReactNode>, d };
    const vazio = !d.ativos.length && !d.rendaFixa.length && !d.agro.tem_dados;
    const seq = sequencia();
    const tt = d.rentab && d.rentab.total;
    const imp = resumoIR(d);
    let div: any = null;
    try { if (e.proventos) div = FC.dividendos.analisa(d, e.base, e.proventos); } catch (err) { console.error(err); }
    const blocos: Record<string, () => React.ReactNode> = {
      perfil: () => <CartaoPerfil />,
      topo: () => <Topo d={d} imp={imp} seq={seq} />,
      checklist: () => <ChecklistAtivacao />,
      plano_realidade: () => <CartaoPlanoRealidade />,
      frase: () => (tt ? <Frase c={comparativo(tt)} /> : null),
      detalhes: () => (tt ? <DetalhesTecnicos d={d} imp={imp} /> : <View style={{ marginTop: 24 }}><Macro m={d.macro} /></View>),
      retrospectivas: () => <Retrospectivas />,
      comecar: () => (vazio ? <Comecar /> : null),
      proximos30: () => <Proximos30 d={d} div={div} />,
      renda_passiva: () => <RendaPassiva div={div} />,
      alocacao: () => <Alocacao d={d} />,
      crescimento: () => <Crescimento d={d} cresc={cresc} setCresc={setCresc} />,
      proventos: () => <Proventos r={d.historico.renda_mensal} div={div} />,
      agro: () => <AgroResumo ag={d.agro} />,
      melhores: () => <Melhores d={d} />,
    };
    return { blocos, d };
  }, [d, e.proventos, e.perfil, e.bench, e.spotEm, cresc]); // eslint-disable-line react-hooks/exhaustive-deps
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
