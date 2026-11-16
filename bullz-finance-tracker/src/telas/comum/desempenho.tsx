/* Desempenho contra as referências, por período: a nota do Início aberta em
 * cada parte da carteira. Para cada parte, o quanto ela rendeu, o quanto a
 * referência rendeu e a diferença em pontos percentuais, colorida pelo que
 * importa (bateu ou não a referência), não pelo sinal do retorno. */
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTema } from "../../tema";
import { useMedidas } from "../../ui/medidas";
import { B, Cartao, Num, Pilula, Secao, T } from "../../ui/kit";
import { desempenhoDoPainel } from "./blocos";
import FC from "../../nucleo";
import { vibra } from "../../plataforma/vibra";

export type Periodo = "dia" | "mes" | "ano" | "tudo";

// chips de período, compartilhados com o Início
export function ChipsPeriodo<P extends string>({ opcoes, valor, aoMudar, centro = true }: {
  opcoes: Array<{ v: P; rotulo: string }>; valor: P; aoMudar: (p: P) => void; centro?: boolean;
}) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: centro ? "center" : "flex-start" }} accessibilityRole="tablist" accessibilityLabel="Período">
      {opcoes.map((p) => {
        const sel = p.v === valor;
        return (
          <Pressable key={p.v} onPress={() => { if (!sel) vibra.toque(); aoMudar(p.v); }} accessibilityRole="tab" accessibilityState={{ selected: sel }}
            style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 980, minHeight: 32, justifyContent: "center",
              backgroundColor: sel ? t.cores.ink : t.cores.campo }}>
            <Text style={{ fontSize: 13.5, fontWeight: sel ? "600" : "400", color: sel ? t.cores.bg : t.cores.ink2 }}>{p.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const PERIODOS: Array<{ v: Periodo; rotulo: string }> = [
  { v: "dia", rotulo: "Dia" }, { v: "mes", rotulo: "30 dias" }, { v: "ano", rotulo: "12 meses" }, { v: "tudo", rotulo: "Tudo" },
];
const pct = (v: number) => `${FC.fmt.delta(v, 2)}%`;
const pp = (v: number) => `${FC.fmt.num(Math.abs(v), 2)} p.p.`;
// abaixo disso a diferença é ruído de arredondamento: "empatou"
const EMPATE = 0.005;

const MOTIVOS: Record<string, string> = {
  "sem histórico": "Ainda não há histórico da carteira para comparar.",
  "sem dias suficientes no período": "A carteira ainda não tem dias suficientes neste período.",
  "sem pregão no período": "Ainda não houve um pregão fechado com dados para comparar.",
  "a referência do período ainda não tem dados": "O Ibovespa e o CDI deste período ainda não carregaram. Tente de novo em instantes.",
};

function quando(des: any) {
  if (des.periodo === "tudo") return `desde o início · ${FC.datas.br(des.de)} a ${FC.datas.br(des.ate)}`;
  if (des.periodo === "dia") return `último pregão · ${FC.datas.br(des.ate)}, contra o fechamento de ${FC.datas.br(des.de)}`;
  return `${FC.datas.br(des.de)} a ${FC.datas.br(des.ate)}`;
}

// a frase do veredito: o geral pela faixa e o que mais pesou nele
function veredito(des: any): React.ReactNode {
  const partes = des.partes as any[];
  const uma = (p: any) => {
    const dif = p.retorno - p.retorno_ref;
    const nome = p.chave === "agro" ? "O agro (vendas)" : `A ${p.nome.toLowerCase()}`;
    if (Math.abs(dif) < EMPATE) return <>{nome} rendeu o mesmo que o {p.nome_ref}.</>;
    return <>{nome} {dif > 0 ? "rendeu" : "ficou"} <B>{pp(dif)}</B> {dif > 0 ? "acima" : "atrás"} do {p.nome_ref}.</>;
  };
  if (partes.length === 1) return uma(partes[0]);
  const geral = des.faixa.chave === "acima" ? "Sua carteira foi melhor que as referências."
    : des.faixa.chave === "abaixo" ? "Sua carteira ficou atrás das referências." : "Sua carteira andou junto com as referências.";
  // o que mais puxa a nota para longe dos 50
  const puxa = [...partes].sort((a, b) => Math.abs(b.peso * (b.nota - 50)) - Math.abs(a.peso * (a.nota - 50)))[0];
  return <>{geral} {uma(puxa)}</>;
}

function LinhaParte({ p, ultima }: { p: any; ultima: boolean }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const dif = p.retorno - p.retorno_ref;
  const empate = Math.abs(dif) < EMPATE;
  const cor = empate ? t.cores.ink2 : dif > 0 ? t.cores.verde : t.cores.vermelho;
  const seta = empate ? "=" : dif > 0 ? "▲" : "▼";
  // o peso é o da nota: o agro entra pelo valor vendido, não pelo rebanho
  const peso = `peso ${FC.fmt.num(p.peso * 100, 0)}% na nota`;
  const contexto = p.vendas ? `${p.vendas} venda${p.vendas > 1 ? "s" : ""} no período · ${peso}` : peso;
  const valor = (rotulo: string, v: number, forte?: boolean) => (
    <View style={{ minWidth: estreito ? 0 : 110, flexGrow: estreito ? 1 : 0, flexShrink: 0 }}>
      <T v="dica">{rotulo}</T>
      <Num numberOfLines={1} style={{ fontSize: 15, fontWeight: forte ? "600" : "400", color: t.cores.ink }}>{pct(v)}</Num>
    </View>
  );
  return (
    <View style={{ flexDirection: estreito ? "column" : "row", alignItems: estreito ? "stretch" : "center", gap: estreito ? 8 : 16,
      paddingVertical: 14, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: t.cores.linha }}
      accessible accessibilityLabel={`${p.nome}: você ${pct(p.retorno)}, ${p.nome_ref} ${pct(p.retorno_ref)}, ${empate ? "igual" : `${pp(dif)} ${dif > 0 ? "acima" : "abaixo"}`}. ${contexto}.`}>
      <View style={{ flex: estreito ? undefined : 1, minWidth: 0 }}>
        <T style={{ fontSize: 15, fontWeight: "600" }}>{p.nome}</T>
        <T v="peq">{contexto}</T>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        {valor("Você", p.retorno, true)}
        {valor(p.nome_ref, p.retorno_ref)}
        <View style={{ minWidth: estreito ? 0 : 120, flexShrink: 0, flexGrow: estreito ? 1 : 0, alignItems: "flex-end" }}>
          <T v="dica">Diferença</T>
          <Num numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: cor }}>{empate ? "empate" : `${seta} ${dif > 0 ? "+" : "−"}${pp(dif)}`}</Num>
        </View>
      </View>
    </View>
  );
}

// parte que existe na carteira mas não entrou na nota do período
function LinhaFora({ nome, texto }: { nome: string; texto: string }) {
  const t = useTema();
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.cores.linha, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      <T style={{ fontSize: 14, color: t.cores.ink2, fontWeight: "500" }}>{nome}</T>
      <T style={{ fontSize: 14, color: t.cores.ink3 }}>{texto}</T>
    </View>
  );
}

export function DesempenhoPorPeriodo({ d }: { d: any }) {
  const t = useTema();
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const p = FC.local.ler("inicio-periodo", "mes");
    return PERIODOS.some((x) => x.v === p) ? p : "mes";
  });
  const des = desempenhoDoPainel(d, periodo);
  const temAgro = FC.modulo("agro") && d.resumo && d.resumo.agro > 0;
  const semAgro = des.suficiente && temAgro && !des.partes.some((p: any) => p.chave === "agro");
  return (
    <Secao titulo="Desempenho contra as referências" sub="cada parte da carteira contra a sua referência">
      <Cartao>
        <ChipsPeriodo opcoes={PERIODOS} valor={periodo} aoMudar={setPeriodo} centro={false} />
        {des.suficiente ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: t.espaco.e4 }}>
              <Pilula cor={des.faixa.cor}>{`${Math.round(des.score)} · ${des.faixa.nome}`}</Pilula>
              <T v="peq">{quando(des)}</T>
            </View>
            <T style={{ marginTop: t.espaco.e3, fontSize: 16, lineHeight: 23 }}>{veredito(des)}</T>
            <View style={{ marginTop: t.espaco.e2 }}>
              {des.partes.map((p: any, i: number) => <LinhaParte key={p.chave} p={p} ultima={i === des.partes.length - 1 && !semAgro} />)}
              {semAgro ? <LinhaFora nome="Agro" texto="sem venda no período: o gado só conta quando é vendido" /> : null}
            </View>
          </>
        ) : (
          <T v="p" style={{ marginTop: t.espaco.e4 }}>{MOTIVOS[des.motivo] || "Sem dados suficientes para este período."}</T>
        )}
      </Cartao>
      <T v="p" style={{ marginTop: t.espaco.e3 }}>
        Retorno sem contar aportes e resgates. Renda variável (ações, FIIs, ETFs e cripto) contra o Ibovespa, renda fixa contra o CDI e o agro só quando há venda, contra o CDI do mesmo prazo. A nota vai de 0 a 100: 50 é empatar com a referência.
      </T>
    </Secao>
  );
}
