/* Seções das funcionalidades do plano de evolução: projeção mês a mês com
 * cenários (Marco 7), lotes do agro (Marco 4) e a ordem RF › Ações › Cripto
 * (Marco 6). Leem o núcleo; não gravam nada. */
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { corCss, useTema } from "../../tema";
import { Cartao, Composicao, Item, Kpi, Kpis, Lista, Pilula, Rs, Secao, T } from "../../ui/kit";
import { Segmentado } from "../../ui/campos";
import FC from "../../nucleo";

const COR_GRUPO: Record<string, string> = { rf: "var(--s2)", acoes: "var(--s1)", cripto: "var(--s4)", agro: "var(--s5)" };
const NOME_GRUPO: Record<string, string> = { rf: "Renda fixa", acoes: "Ações e FIIs", cripto: "Cripto", agro: "Agro" };
const brl0 = (v: number) => FC.fmt.brlTexto(v, 0);
const ALTURA = 160;
const pct0 = (v: number) => `${FC.fmt.num(v, 0)}%`;

// ---------------------------------------------------------------- projeção mês a mês
export function ProjecaoMensal({ e }: { e: any }) {
  const t = useTema();
  const [cenario, setCenario] = useState<"historico" | "so_proventos" | "estresse">("historico");
  const [meses, setMeses] = useState<"6" | "12" | "24">("12");
  const r = useMemo(() => {
    try { return FC.projecaoMensal.projeta(e, { meses: Number(meses), cenario }); } catch (err) { console.error(err); return null; }
  }, [e.dados, cenario, meses]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!r || !r.serie.length) return null;
  const max = Math.max(1, ...r.serie.map((p: any) => p.total));
  return (
    <Secao titulo="Mês a mês" sub="por categoria, com o aporte do plano e os eventos (venda do gado, aporte extra)">
      <Cartao>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Segmentado valor={cenario} aoMudar={setCenario} rotuloA11y="Cenário"
            opcoes={[{ v: "historico", rotulo: "Histórico" }, { v: "so_proventos", rotulo: "Só proventos" }, { v: "estresse", rotulo: "Estresse" }]} />
          <Segmentado valor={meses} aoMudar={setMeses} rotuloA11y="Horizonte" opcoes={[{ v: "6", rotulo: "6 meses" }, { v: "12", rotulo: "12" }, { v: "24", rotulo: "24" }]} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: ALTURA }}>
          {r.serie.map((p: any) => (
            <View key={p.mes} style={{ flex: 1, alignItems: "stretch", justifyContent: "flex-end", height: ALTURA }}>
              {(["agro", "cripto", "acoes", "rf"] as const).map((g) => (
                <View key={g} style={{ height: Math.max(0, ((p.por_categoria[g] || 0) / max) * ALTURA), backgroundColor: corCss(t.cores, COR_GRUPO[g]) } as any} />
              ))}
              {p.eventos.length ? <View style={{ position: "absolute", top: -6, alignSelf: "center", width: 6, height: 6, borderRadius: 3, backgroundColor: t.cores.amarelo }} /> : null}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <T style={{ fontSize: 11, color: t.cores.ink2 }}>{r.serie[0].mes}</T><T style={{ fontSize: 11, color: t.cores.ink2 }}>{r.final.mes}</T>
        </View>
        <Kpis style={{ marginTop: 16 }}>
          <Kpi rotulo={`Total em ${r.final.mes}`} valor={brl0(r.final.total)} dinheiro />
          <Kpi rotulo="Sem o agro" valor={brl0(r.final.total_sem_agro)} dinheiro />
          <Kpi rotulo="Aportes no período" valor={brl0(r.serie.reduce((s: number, p: any) => s + p.aporte, 0))} dinheiro />
        </Kpis>
        {r.eventos.length ? <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: 8 }}>{"Eventos: " + r.eventos.map((x: any) => `${x.data.slice(0, 7)} ${x.descricao || x.tipo}`).join(" · ")}</T> : null}
        <T style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: 8 }}>{`Estimativa. CDI ${FC.fmt.num(r.indicadores.cdi, 1)}% e IPCA ${FC.fmt.num(r.indicadores.ipca, 1)}% (${r.indicadores.fonte}); divisão: ${r.divisao}.`}</T>
      </Cartao>
    </Secao>
  );
}

// ---------------------------------------------------------------- lotes do agro
export function LotesAgro({ ag }: { ag: any }) {
  const t = useTema();
  const L = ag && ag.lotes;
  if (!L || !L.lotes.length) return null;
  return (
    <Secao titulo="Por lote" sub="cada compra é um lote; venda e troca fecham o ciclo das cabeças que saem">
      <Lista>
        {L.lotes.map((l: any) => (
          <Item key={l.chave} detalheLinhas={2}
            titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <T style={{ fontWeight: "600", fontSize: 15 }}>{l.nome || "Lote"}</T>
              <Pilula cor={l.aberto ? "azul" : "cinza"}>{l.aberto ? `${l.cabecas} cabeças` : "fechado"}</Pilula>
              {l.venda_planejada ? <Pilula cor="amarelo">{`venda em ${FC.datas.br(l.venda_planejada.data_prevista)}`}</Pilula> : null}
              {l.alerta_custos ? <Pilula cor="vermelho">sem custos lançados</Pilula> : null}
            </View>}
            detalhe={`${l.dias} dias · custo ${brl0(l.custo_total)}${l.receita ? ` · recebido ${brl0(l.receita)}` : ""}${l.aberto ? ` · vale ${brl0(l.valor_estimado)} (${l.origem_valor === "estimativa" ? "estimativa sua" : l.origem_valor === "arroba" ? "pela @" : "pelo custo"})` : ""}`}
            valores={<View style={{ alignItems: "flex-end" }}>
              <Rs cls={l.resultado_total >= 0 ? "pos" : "neg"} style={{ fontWeight: "600", fontSize: 15 }}>{brl0(l.resultado_total)}</Rs>
              <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{l.resultado_realizado ? `realizado ${brl0(l.resultado_realizado)}` : "resultado estimado"}</T>
            </View>} />
        ))}
      </Lista>
    </Secao>
  );
}

// ---------------------------------------------------------------- a ordem certa
export function OrdemCerta({ e }: { e: any }) {
  const t = useTema();
  const h = useMemo(() => { try { return FC.hierarquia.analisa(e); } catch (err) { console.error(err); return null; } }, [e.dados]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!h || h.modo !== "hierarquia") return null;
  const c = h.carteira.pct, s = h.divisao_sugerida_aporte;
  const barra = (d: any) => <Composicao altura={12} partes={(["rf", "acoes", "cripto"] as const).map((g) => ({ valor: d[g], cor: COR_GRUPO[g] }))} />;
  return (
    <Secao titulo="A ordem certa" sub="renda fixa › ações › cripto, com as suas faixas">
      <Cartao>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {h.ordem_respeitada ? <Pilula cor="verde">ordem respeitada</Pilula> : <Pilula cor="amarelo">fora da ordem</Pilula>}
          {!h.ordem_respeitada && h.meses_para_corrigir != null ? <Pilula cor="cinza" semPonto>{`corrige em ${h.meses_para_corrigir} ${h.meses_para_corrigir === 1 ? "mês" : "meses"} com o aporte atual`}</Pilula> : null}
          {h.plano && !h.plano.ok ? <Pilula cor="vermelho">o plano quebra a ordem</Pilula> : null}
        </View>
        <T style={{ fontSize: 13, color: t.cores.ink2, marginBottom: 6 }}>{`Carteira hoje: RF ${pct0(c.rf)} · Ações ${pct0(c.acoes)} · Cripto ${pct0(c.cripto)}`}</T>
        {barra(c)}
        <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: 14, marginBottom: 6 }}>{`Divisão sugerida do aporte: RF ${pct0(s.rf)} · Ações ${pct0(s.acoes)} · Cripto ${pct0(s.cripto)}`}</T>
        {barra(s)}
        <T style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: 10 }}>{s.motivo.join("; ")}.</T>
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          {(["rf", "acoes", "cripto"] as const).map((g) => (
            <View key={g} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: corCss(t.cores, COR_GRUPO[g]) } as any} />
              <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`${NOME_GRUPO[g]} ${h.faixas[g].min}–${h.faixas[g].max}%`}</T>
            </View>
          ))}
        </View>
      </Cartao>
    </Secao>
  );
}
