/* Investimentos › Rentabilidade: os números brutos do desempenho — a nota
 * do Início aberta por período e por parte, a frase contra CDI e inflação,
 * as medidas técnicas (TIR, Dietz, TWR, por classe, juros do dia) e o
 * crescimento do patrimônio com Selic e Ibovespa. */
import React, { useState } from "react";
import { View } from "react-native";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { Pagina } from "../casca/casca";
import { Cartao, Pilula, Secao, T, Tabela } from "../ui/kit";
import { EstadoMercado } from "./comum/alertas";
import { CabecalhoInvestimentos } from "./comum/investimentos";
import { CRESC_PADRAO, Crescimento, DetalhesTecnicos, Frase, Macro, comparativo, desempenhoDoPainel, resumoIR } from "./comum/blocos";
import FC from "../nucleo";

const PERIODOS: Array<[string, string]> = [["dia", "Dia"], ["mes", "30 dias"], ["ano", "12 meses"], ["tudo", "Desde o início"]];
const pct = (v: any) => (FC.ok(v) ? `${FC.fmt.delta(v, 2)}%` : "—");

function PorPeriodo({ d }: { d: any }) {
  const t = useTema();
  const linhas: any[] = [];
  for (const [p, nome] of PERIODOS) {
    const des = desempenhoDoPainel(d, p);
    if (!des.suficiente) { linhas.push([{ v: nome }, { v: "sem dados", cls: "muito-fraco" }, "—", "—", "—", "—"]); continue; }
    const parte = (k: string) => des.partes.find((x: any) => x.chave === k);
    const rv = parte("rv"), rf = parte("rf");
    linhas.push([
      { v: nome, leg: `${FC.datas.br(des.de)} a ${FC.datas.br(des.ate)}` },
      { v: <Pilula cor={des.faixa.cor}>{`${Math.round(des.score)} · ${des.faixa.nome}`}</Pilula> },
      rv ? { v: pct(rv.retorno), cls: rv.retorno >= 0 ? "pos" : "neg", leg: `peso ${FC.fmt.num(rv.peso * 100, 0)}%` } : "—",
      rv ? pct(rv.retorno_ref) : "—",
      rf ? { v: pct(rf.retorno), cls: rf.retorno >= 0 ? "pos" : "neg", leg: `peso ${FC.fmt.num(rf.peso * 100, 0)}%` } : "—",
      rf ? pct(rf.retorno_ref) : "—",
    ]);
  }
  return (
    <Secao titulo="Desempenho contra as referências" sub="a nota do Início, aberta por período e por parte">
      <Cartao semPad>
        <Tabela minimo={720}
          cabecas={[{ t: "Período", largura: 170 }, { t: "Nota", largura: 150 }, { t: "Renda variável", n: true }, { t: "Ibovespa", n: true }, { t: "Renda fixa", n: true }, { t: "CDI", n: true }]}
          linhas={linhas} />
      </Cartao>
      <T v="p" style={{ marginTop: t.espaco.e3 }}>Retorno ponderado pelo tempo (aportes e resgates não contam como rendimento). Renda variável inclui ações, FIIs, ETFs e cripto, com os proventos; renda fixa inclui o caixa de proventos. Agro entra na nota contra o CDI.</T>
    </Secao>
  );
}

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
      <PorPeriodo d={d} />
      <Secao titulo="Medidas técnicas" sub="TIR, retorno no período e TWR; por classe; juros do dia">
        {tt ? <DetalhesTecnicos d={d} imp={imp} aberto /> : <View style={{ marginTop: t.espaco.e2 }}><Macro m={d.macro} /></View>}
      </Secao>
      <Crescimento d={d} cresc={cresc} setCresc={setCresc} />
    </Pagina>
  );
}
