/* Sequência de aportes (comum.js): só com o módulo "Sequência e vídeo"
 * ligado (Ajustes → Módulos). Chip do Início, cartão com os 12 meses e a
 * comemoração na primeira vez que a meta do mês é batida. */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { useMedidas } from "../../ui/medidas";
import { Cartao, Num, Rs, T, B } from "../../ui/kit";
import { Foguinho } from "../../ui/foguinho";
import { Icone } from "../../ui/icone";
import { ui } from "../../ui/folha";
import FC from "../../nucleo";

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const meses = (n: number) => (n === 1 ? "mês" : "meses");
const roxo = (escuro: boolean) => (escuro ? "#c084fc" : "#9333ea");

export function sequencia() {
  const e = FC.estado;
  if (!FC.modulo("engajamento")) return null;
  if (!e.base || !e.prefs || !e.prefs.plano) return null;
  const st = FC.salario.streak({ plano: e.prefs.plano, ganhos: e.base.ganhos || [], base: e.base });
  return st.tem_meta ? st : null;
}

export function FraseSequencia({ st }: { st: any }) {
  const m = st.mesAtual, nome = MES_LONGO[Number(m.mes.slice(5)) - 1];
  if (m.estado === "batido") return <>Meta de {nome} batida. A sequência segue acesa!</>;
  if (m.estado === "sem_meta") return <>Sem renda cadastrada em {nome}, o mês não conta nem quebra a sequência.</>;
  const falta = Math.max(0, m.meta - m.investido);
  return st.atual
    ? <>Faltam <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(falta)}</Rs> para manter a sequência em {nome}.</>
    : <>Aporte <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(falta)}</Rs> em {nome} para acender o foguinho.</>;
}

export function ChipSequencia({ st }: { st: any }) {
  const t = useTema();
  return (
    <Pressable onPress={() => router.push("/salario" as any)} accessibilityRole="link" accessibilityLabel="Meses seguidos batendo a meta de aporte do plano"
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 980, backgroundColor: t.cores.campo }}>
      <Foguinho tam={26} aceso={st.atual > 0} pct={st.mesAtual.pct} acende={useComemoracao(st)} />
      <Text style={{ fontSize: 13, color: t.cores.ink2 }}>
        <Text style={{ fontWeight: "600", color: roxo(t.esquema === "escuro") }}>{FC.fmt.int(st.atual)}</Text> {meses(st.atual)} seguido{st.atual === 1 ? "" : "s"}
      </Text>
    </Pressable>
  );
}

export function CartaoSequencia({ st }: { st: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const acende = useComemoracao(st);
  const bola = (x: any) => x.estado === "batido" ? <Foguinho tam={estreito ? 18 : 22} aceso />
    : x.estado === "andamento" ? <Foguinho tam={estreito ? 22 : 26} aceso={false} pct={x.pct} />
    : x.estado === "abaixo" ? (
      <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.linha }}>
        <Icone nome="fechar" tam={13} cor={t.cores.ink3} />
      </View>)
    : <View style={{ width: 10, height: 2, borderRadius: 2, backgroundColor: t.cores.linha }} />;
  const titulo = (x: any) => `${MES_LONGO[Number(x.mes.slice(5)) - 1]}: ${x.estado === "sem_meta" ? "sem meta" : `${FC.fmt.brlTexto(x.investido, 0)} de ${FC.fmt.brlTexto(x.meta, 0)}`}`;
  return (
    <Cartao style={{ overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
        <Foguinho tam={72} aceso={st.atual > 0} pct={st.mesAtual.pct} acende={acende} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Num style={{ fontSize: estreito ? 36 : 44, lineHeight: estreito ? 38 : 46, fontWeight: "700", letterSpacing: -0.9 }}>{FC.fmt.int(st.atual)}</Num>
          <T style={{ color: t.cores.ink2, fontSize: 14, marginTop: 4 }}>{meses(st.atual)} seguido{st.atual === 1 ? "" : "s"} batendo a meta</T>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <T style={{ fontSize: 12, color: t.cores.ink3 }}>Recorde</T>
          <B style={{ fontSize: 20 }}>{FC.fmt.int(st.recorde)}</B>
        </View>
      </View>
      <View style={{ flexDirection: "row", marginTop: 18, gap: estreito ? 2 : 4 }}>
        {st.meses.map((x: any) => (
          <View key={x.mes} style={{ flex: 1, alignItems: "center", gap: 4 }} accessibilityLabel={titulo(x)}>
            <View style={{ width: estreito ? 24 : 30, height: estreito ? 24 : 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
              backgroundColor: x.estado === "batido" ? "rgba(168, 85, 247, 0.12)" : "transparent" }}>{bola(x)}</View>
            <T style={{ fontSize: 11, color: x.estado === "andamento" ? "#9333ea" : t.cores.ink3, fontWeight: x.estado === "andamento" || estreito ? "600" : "400" }}>
              {MES_CURTO[Number(x.mes.slice(5)) - 1]}
            </T>
          </View>
        ))}
      </View>
      <T v="p" style={{ marginTop: t.espaco.e3 }}><FraseSequencia st={st} /></T>
    </Cartao>
  );
}

/** a primeira vez que a meta do mês é batida: a chama acende e avisa */
function useComemoracao(st: any): boolean {
  const [acende, setAcende] = useState(false);
  useEffect(() => {
    if (!st || st.mesAtual.estado !== "batido") return;
    const chave = "streak-comemorado:" + st.mesAtual.mes;
    if (FC.local.ler(chave, null)) return;
    FC.local.gravar(chave, "1");
    setAcende(true);
    ui.aviso(`Sequência de ${st.atual} ${meses(st.atual)}! Meta do mês batida.`);
    const id = setTimeout(() => setAcende(false), 1600);
    return () => clearTimeout(id);
  }, [st]);
  return acende;
}
