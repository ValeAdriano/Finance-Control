/* Investimentos › Rentabilidade: os números brutos do desempenho: a nota
 * do Início aberta por período e por parte (comum/desempenho.tsx), a frase
 * contra CDI e inflação,
 * as medidas técnicas (TIR, Dietz, TWR, por classe, juros do dia) e o
 * crescimento do patrimônio com Selic e Ibovespa. */
import React, { useState } from "react";
import { View } from "react-native";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { Pagina } from "../casca/casca";
import { Secao } from "../ui/kit";
import { EstadoMercado } from "./comum/alertas";
import { CabecalhoInvestimentos } from "./comum/investimentos";
import { CRESC_PADRAO, Crescimento, DetalhesTecnicos, Frase, Macro, comparativo, resumoIR } from "./comum/blocos";
import { DesempenhoPorPeriodo } from "./comum/desempenho";

export default function Rentabilidade() {
  const t = useTema();
  const e = useEstado();
  const [cresc, setCresc] = useState({ ...CRESC_PADRAO });
  const d = e.dados;
  const cab = <CabecalhoInvestimentos aba="rentabilidade" sub="Quanto a carteira rendeu, por período e por classe, contra CDI, inflação e Ibovespa." />;
  if (!d) return <Pagina>{cab}<EstadoMercado /></Pagina>;
  const tt = d.rentab && d.rentab.total;
  const imp = resumoIR(d);
  return (
    <Pagina>
      {cab}
      <EstadoMercado />
      {tt ? <Frase c={comparativo(tt)} /> : null}
      <DesempenhoPorPeriodo d={d} />
      <Secao titulo="Medidas técnicas" sub="TIR, retorno no período e TWR; por classe; juros do dia">
        {tt ? <DetalhesTecnicos d={d} imp={imp} aberto /> : <View style={{ marginTop: t.espaco.e2 }}><Macro m={d.macro} /></View>}
      </Secao>
      <Crescimento d={d} cresc={cresc} setCresc={setCresc} />
    </Pagina>
  );
}
