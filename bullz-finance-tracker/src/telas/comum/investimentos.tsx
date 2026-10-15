/* O topo comum de Investimentos: título, o seletor "Ativos | Minha lista"
 * (cada um é uma rota: /ativos e /ativos/lista) e o botão de cadastrar. */
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { Botao, Cabecalho } from "../../ui/kit";
import { Segmentado } from "../../ui/campos";
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
