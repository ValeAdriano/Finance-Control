/* O topo comum de Investimentos: título, o seletor "Ativos | Minha lista"
 * (cada um é uma rota: /ativos e /ativos/lista) e o botão de cadastrar. */
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { Botao, Cabecalho, T } from "../../ui/kit";
import { Campo, Segmentado } from "../../ui/campos";
import { formAtivo } from "./formularios";

export type AbaInvest = "ativos" | "lista";

export function CabecalhoInvestimentos({ aba, sub }: { aba: AbaInvest; sub: string }) {
  const t = useTema();
  return (
    <>
      <Cabecalho titulo="Investimentos" sub={sub} direita={<Botao icone="aportes" onPress={() => formAtivo()}>Ativo</Botao>} />
      <View style={{ marginBottom: t.espaco.e4 }}>
        <Segmentado rotuloA11y="Seção de investimentos" valor={aba}
          aoMudar={(v) => { if (v !== aba) router.replace((v === "lista" ? "/ativos/lista" : "/ativos") as any); }}
          opcoes={[{ v: "ativos", rotulo: "Ativos" }, { v: "lista", rotulo: "Minha lista" }]} />
      </View>
    </>
  );
}

// ---------------------------------------------------------------- padrão dos filtros
// Uma barra só para todos os filtros das duas telas: campos com rótulo em
// cima, mesma largura, alinhados pela base e com o mesmo espaço entre si.
export function BarraFiltros({ children }: { children: React.ReactNode }) {
  const t = useTema();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3, alignItems: "flex-end", marginBottom: t.espaco.e3 }}>{children}</View>;
}

export function Filtro({ rotulo, children, estreito }: { rotulo: string; children: React.ReactNode; estreito?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: estreito ? 120 : 160, maxWidth: estreito ? 170 : 240 }}>
      <Campo rotulo={rotulo}>{children}</Campo>
    </View>
  );
}

/** a linha entre os filtros e a lista: quantos resultados e, à direita, uma ação */
export function ContagemResultados({ children, direita }: { children: React.ReactNode; direita?: React.ReactNode }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.espaco.e3, minHeight: 36, marginBottom: t.espaco.e2 }}>
      <T style={{ fontSize: 13, color: t.cores.ink2, flexShrink: 1 }}>{children}</T>
      {direita}
    </View>
  );
}

/** título de um grupo dentro de uma seção (um nível abaixo do T h2): nome, resumo e uma ação */
export function CabecalhoGrupo({ titulo, resumo, direita, children }: { titulo: string; resumo?: React.ReactNode; direita?: React.ReactNode; children: React.ReactNode }) {
  const t = useTema();
  return (
    <View style={{ marginTop: t.espaco.e4 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: t.espaco.e3, marginBottom: t.espaco.e2 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h3" accessibilityRole="header">{titulo}</T>
          {resumo ? <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: 2 }}>{resumo}</T> : null}
        </View>
        {direita}
      </View>
      {children}
    </View>
  );
}
