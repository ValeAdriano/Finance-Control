/* Investimentos › Minha lista: "Meus ativos" (o que está na carteira),
 * agrupado por tipo com subtotal e renda, e o que você acompanha.
 *
 * Os grupos vêm do registro SECOES. Para incluir fundos de investimento:
 * aceitar a classe "fundo" em ativos.classe (schema.sql), buscar a cota
 * diária na CVM pela função "mercado" e ligar a entrada "fundos" abaixo. */
import React, { useEffect } from "react";
import { View } from "react-native";
import { useTema } from "../tema";
import { rerender, useEstado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import { Anel, Botao, Cartao, Item, Kpi, Kpis, Lista, Num, Pilula, Rs, Secao, T, Vazio } from "../ui/kit";
import { Icone } from "../ui/icone";
import { EstadoMercado } from "./comum/alertas";
import { abreAtivo } from "./comum/ativo";
import { formAtivo, formRendaFixa } from "./comum/formularios";
import { CabecalhoGrupo, CabecalhoInvestimentos } from "./comum/investimentos";
import { MiniGrafico, Variacao } from "./comum/preco";
import { ResumoInvestido } from "./comum/rentab";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const sinal = (v: number) => (v >= 0 ? "+" : "−");

interface SecaoLista { chave: string; titulo: string; classes: string[]; ligada: () => boolean }
export const SECOES: SecaoLista[] = [
  { chave: "acoes", titulo: "Ações e ETFs", classes: ["acao_br", "etf_br", "acao_us", "etf_us"], ligada: () => true },
  { chave: "fiis", titulo: "Fundos imobiliários", classes: ["fii"], ligada: () => true },
  { chave: "renda_fixa", titulo: "Renda fixa", classes: [], ligada: () => true },
  { chave: "cripto", titulo: "Cripto", classes: ["cripto"], ligada: () => true },
  // ainda não existe a classe no banco: fica desligada até lá
  { chave: "fundos", titulo: "Fundos de investimento", classes: ["fundo"], ligada: () => false },
];

// ---------------------------------------------------------------- linha de um ativo meu
function LinhaMeu({ a, renda, total }: { a: any; renda: any; total: number }) {
  const t = useTema();
  const { estreito } = useMedidas();
  if (a.erro) {
    return <Item onPress={() => formAtivo(a.item)} chevron esquerda={<Anel score={null} cor="cinza" />} titulo={a.ticker} detalhe={a.erro} />;
  }
  const p = a.posicao;
  const rt = FC.estado.dados.rentab && FC.estado.dados.rentab.ativos.find((x: any) => x.ticker === a.ticker);
  const res = rt && ok(rt.periodo_pct) ? rt.periodo_pct : p && ok(p.variacao) ? p.variacao : null;
  return (
    <Item onPress={() => abreAtivo(a.ticker)} chevron detalheLinhas={2} esquerda={<Anel score={a.score} cor={a.cor} />}
      titulo={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <T style={{ fontWeight: "600", fontSize: 15 }}>{a.ticker}</T>
          <Num style={{ fontSize: 13, color: t.cores.ink2 }}>{FC.fmt.preco(a.preco)}</Num>
          <Variacao v={a.variacao_dia} pequeno />
        </View>}
      detalhe={
        <View style={{ gap: 2 }}>
          <T style={{ fontSize: 13, color: t.cores.ink2 }} numberOfLines={1}>
            {p ? `${FC.fmt.qtd(p.quantidade)} ${FC.unidade(a, p.quantidade)}` : "sem posição"}{ok(p && p.preco_medio) ? ` · PM ${FC.fmt.preco(p.preco_medio)}` : ""}{total && p ? ` · ${FC.fmt.num((p.atual / total) * 100, 1)}% da carteira` : ""}
          </T>
          {renda && renda.recebido_12m > 0 ? (
            <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>
              rendeu <Rs style={{ fontSize: 12.5, color: t.cores.verde, fontWeight: "600" }}>{FC.fmt.brlTexto(renda.recebido_12m)}</Rs> em 12 meses
              {ok(renda.dy_12m) ? ` · DY ${FC.fmt.num(renda.dy_12m)}%` : ""}{ok(renda.yoc) ? ` · YoC ${FC.fmt.num(renda.yoc)}%` : ""}
            </T>
          ) : null}
        </View>}
      direita={estreito ? null : <View style={{ width: 90 }}><MiniGrafico serie={a.serie_preco} /></View>}
      valores={p ? (
        <View style={{ alignItems: "flex-end" }}>
          <Rs style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(p.atual)}</Rs>
          {res != null ? <Num cls={res >= 0 ? "pos" : "neg"} style={{ fontSize: 12.5 }}>{FC.fmt.delta(res)}%</Num> : null}
        </View>) : undefined} />
  );
}

// ---------------------------------------------------------------- renda fixa
function impostoDo(r: any) {
  if (!FC.impostos || typeof FC.impostos.titulo !== "function") return null;
  try { return FC.impostos.titulo(r, ((FC.estado.prefs.premissas || {}).titulos || {})[r.id]) || null; } catch (e) { console.error(e); return null; }
}

function RendaFixa({ d, total }: { d: any; total: number }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const impostos: Record<string, any> = Object.fromEntries(d.rendaFixa.map((r: any) => [r.id, impostoDo(r)]));
  const algumIsento = Object.values(impostos).some((x: any) => x && x.isento);
  const soma = FC.soma(d.rendaFixa, (r: any) => r.valor_aplicado || 0);
  return (
    <CabecalhoGrupo titulo="Renda fixa" resumo={<>{d.rendaFixa.length ? <><Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(soma)}</Rs>{total ? ` · ${FC.fmt.num((soma / total) * 100, 1)}% da carteira` : ""} · </> : null}{ok(d.macro && d.macro.cdi) ? `CDI de hoje ${FC.fmt.num(d.macro.cdi)}%` : "CDBs, Tesouro e caixa"}</>}
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
            O valor de cada título é o que ele vale hoje: cada aporte rende da própria data, pela própria taxa, com o CDI, a Selic ou o IPCA de cada dia útil (valor bruto, antes de IR{FC.impostos ? "; o líquido ao lado é uma estimativa de IR e IOF se você resgatasse hoje" : ""}). A comparação com o CDI ao lado é bruta e é a foto de hoje.{algumIsento ? " Nos títulos isentos de IR (LCI, LCA, debêntures incentivadas), a comparação justa é com o CDI líquido de IR, que rende menos que o CDI bruto." : ""}
          </T>
        </>
      ) : (
        <Lista>
          <Vazio icone="🏦" titulo="Nenhum título" texto="Cadastre CDBs, Tesouro Direto ou a conta remunerada para eles entrarem no patrimônio e na alocação. Os títulos do Tesouro com a taxa de hoje estão em Ativos › Renda fixa."
            acao={<Botao onPress={() => formRendaFixa()}>Adicionar título</Botao>} />
        </Lista>
      )}
    </CabecalhoGrupo>
  );
}

// ---------------------------------------------------------------- acompanhando
function Acompanhando({ ativos }: { ativos: any[] }) {
  const t = useTema();
  if (!ativos.length) return null;
  return (
    <Secao titulo="Acompanhando" sub="ativos que você observa e ainda não tem">
      <Lista>
        {ativos.map((a) => a.erro ? (
          <Item key={a.ticker} onPress={() => formAtivo(a.item)} chevron esquerda={<Anel score={null} cor="cinza" />} titulo={a.ticker} detalhe={a.erro} />
        ) : (
          <Item key={a.ticker} onPress={() => abreAtivo(a.ticker)} chevron esquerda={<Anel score={a.score} cor={a.cor} />} detalheLinhas={2}
            titulo={a.ticker}
            detalhe={
              <View style={{ gap: 4 }}>
                <T style={{ fontSize: 13, color: t.cores.ink2 }} numberOfLines={1}>{a.tipo_rotulo}{a.segmento ? " · " + a.segmento : ""}</T>
                {a.graham && a.graham.valor != null ? <Pilula cor={a.graham.cor}>{`Graham ${FC.fmt.preco(a.graham.valor)} · ${a.graham.leitura}`}</Pilula> : <Pilula cor={a.cor}>{a.veredito_curto}</Pilula>}
              </View>}
            valores={<View style={{ alignItems: "flex-end", gap: 3 }}><Num style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.preco(a.preco)}</Num><Variacao v={a.variacao_dia} pequeno sufixo="hoje" /></View>} />
        ))}
      </Lista>
    </Secao>
  );
}

// ---------------------------------------------------------------- tela
export default function MinhaLista() {
  const t = useTema();
  const e = useEstado();
  const temDados = !!e.dados;
  useEffect(() => { if (!FC.estado.proventos && temDados) FC.carregaProventos().then(() => rerender()).catch(() => {}); }, [temDados]);
  const d = e.dados;
  const cab = <CabecalhoInvestimentos aba="lista" sub="O que você tem, quanto vale e quanto rende — e o que acompanha." />;
  if (!d) return <Pagina>{cab}<EstadoMercado /></Pagina>;
  const carteira = d.ativos.filter((a: any) => a.na_carteira);
  const watch = d.ativos.filter((a: any) => !a.na_carteira).sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1));
  let div: any = null;
  try { if (e.proventos) div = FC.dividendos.analisa(d, e.base, e.proventos); } catch (err) { console.error(err); }
  const rendaDe = (tk: string) => (div ? div.porAtivo.find((x: any) => x.ticker === tk) : null);
  const valor = (a: any) => (a.posicao ? a.posicao.atual || 0 : 0);
  const total = FC.soma(carteira, valor) + FC.soma(d.rendaFixa, (r: any) => r.valor_aplicado || 0);
  const vazio = !d.ativos.length && !d.rendaFixa.length;
  return (
    <Pagina>
      {cab}
      <EstadoMercado />
      {vazio ? (
        <Lista>
          <Vazio icone="📈" titulo="Nada na sua lista ainda" texto="Cadastre o que você tem — ações, FIIs, ETFs, cripto ou títulos de renda fixa — ou pesquise em Ativos e toque em Acompanhar."
            acao={<View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" }}><Botao onPress={() => formAtivo()}>Adicionar ativo</Botao><Botao variante="sec" onPress={() => formRendaFixa()}>Adicionar título</Botao></View>} />
        </Lista>
      ) : (
        <>
          <ResumoInvestido d={d} />
          {div && div.resumo.n_pagadores ? (
            <Cartao style={{ marginTop: t.espaco.e4 }}>
              <Kpis>
                <Kpi rotulo="Renda por mês (estimada)" valor={FC.fmt.brlTexto(div.resumo.mensal_estimado)} dinheiro peq="se os próximos 12 meses repetirem os últimos" />
                <Kpi rotulo="Recebido em 12 meses" valor={FC.fmt.brlTexto(div.resumo.recebido_12m)} dinheiro peq={`${div.resumo.n_pagadores} ativo(s) pagaram`} />
                {ok(div.resumo.dy_carteira) ? <Kpi rotulo="DY da carteira" valor={`${FC.fmt.num(div.resumo.dy_carteira)}%`} peq="ações, FIIs e ETFs" /> : null}
              </Kpis>
            </Cartao>
          ) : null}
          <View style={{ marginTop: t.espaco.e5 }}><T v="h2" accessibilityRole="header">Meus ativos</T></View>
          {SECOES.filter((s) => s.ligada()).map((s) => {
            if (s.chave === "renda_fixa") return <RendaFixa key={s.chave} d={d} total={total} />;
            const itens = carteira.filter((a: any) => s.classes.includes(a.classe)).sort((a: any, b: any) => valor(b) - valor(a));
            if (!itens.length) return null;
            const soma = FC.soma(itens, valor);
            const renda12 = FC.soma(itens, (a: any) => (rendaDe(a.ticker) || {}).recebido_12m || 0);
            return (
              <CabecalhoGrupo key={s.chave} titulo={s.titulo}
                resumo={<><Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(soma)}</Rs>{total ? ` · ${FC.fmt.num((soma / total) * 100, 1)}% da carteira` : ""} · {itens.length} ativo{itens.length > 1 ? "s" : ""}{renda12 > 0 ? <> · rendeu <Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(renda12)}</Rs> em 12 meses</> : null}</>}>
                <Lista>{itens.map((a: any) => <LinhaMeu key={a.ticker} a={a} renda={rendaDe(a.ticker)} total={total} />)}</Lista>
              </CabecalhoGrupo>
            );
          })}
          {!carteira.length ? <T v="p" style={{ marginTop: t.espaco.e3 }}>Nenhum ativo de bolsa na carteira. Use “+ Ativo” para cadastrar o que você tem.</T> : null}
          <Acompanhando ativos={watch} />
          <T v="p" style={{ marginTop: t.espaco.e4 }}>A bolinha à esquerda é a aderência às suas regras (Ajustes → Regras). Toque num ativo para ver o gráfico, a análise e os dividendos mês a mês. Não é recomendação de compra ou venda.</T>
        </>
      )}
    </Pagina>
  );
}
