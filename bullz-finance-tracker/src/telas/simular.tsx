/* Simular: monta uma cesta de compra e mostra o efeito na alocação antes de
 * comprar — com dinheiro novo ou tirando do caixa. Port de telas/simular.js. */
import React, { useState } from "react";
import { View } from "react-native";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import { B, Botao, Cabecalho, Cartao, Grade, Indicadores, Kpi, Kpis, Lista, Num, Ponto, Rs, Secao, T, Tabela, Trilha, Vazio } from "../ui/kit";
import { Entrada } from "../ui/campos";
import { ui } from "../ui/folha";
import { EstadoMercado } from "./comum/alertas";
import { depoisDeMudar } from "./comum/dados";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const cesta: Record<string, string> = {};

export default function Simular() {
  const t = useTema();
  const e = useEstado();
  const { celular, estreito } = useMedidas();
  const [, setTick] = useState(0);
  if (!e.dados) return <Pagina><EstadoMercado /></Pagina>;
  const d = e.dados;
  const ativos = d.ativos.filter((a: any) => !a.erro && ok(a.preco)).sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1));
  const base = d.alocacao;
  const cab = <Cabecalho titulo="Simular aporte" sub="Monte a cesta e veja o efeito na alocação antes de comprar." />;
  if (!ativos.length) return <Pagina>{cab}<EstadoMercado /><Lista><Vazio icone="🧺" titulo="Nada para simular ainda" texto="Adicione ativos em Investimentos. Eles aparecem aqui com a cotação de hoje." /></Lista></Pagina>;
  const mapa: Record<string, any> = Object.fromEntries(ativos.map((a: any) => [a.ticker, a]));

  let total = 0, n = 0, somaScore = 0;
  const porPilar: Record<string, number> = {};
  for (const a of ativos) {
    const q = FC.lerNum(cesta[a.ticker]) || 0;
    if (q > 0) { const v = q * a.preco; total += v; n++; somaScore += (a.score || 0) * v; porPilar[a.pilar] = (porPilar[a.pilar] || 0) + v; }
  }
  const cenario = (novo: boolean) => {
    // pilar com meta 0% fica fora do equilíbrio: as % são sobre os outros
    const alvos = d.alocacao_alvo || {};
    const algumaMeta = FC.PILARES.some((p: any) => Number(alvos[p.chave]) > 0);
    const conta = (k: string) => !algumaMeta || Number(alvos[k]) > 0;
    const brutas = FC.PILARES.map((p: any) => {
      const b = base.find((l: any) => l.chave === p.chave) || { valor: 0, pct: 0, pct_meta: 0, alvo_pct: Number(alvos[p.chave]) || 0 };
      let v = b.valor + (porPilar[p.chave] || 0);
      if (!novo && p.chave === "caixa") v = b.valor - total;
      return { p, b, v };
    });
    const totDepois = FC.soma(brutas.filter((x: any) => conta(x.p.chave)), (x: any) => x.v);
    const linhas = brutas.map(({ p, b, v }: any) => {
      if (!conta(p.chave)) return { nome: p.nome, cor: p.cor, hoje: null, pct: null, desvio: null, alvo: 0, v, fora: true };
      const pctD = totDepois ? (v / totDepois) * 100 : 0;
      return { nome: p.nome, cor: p.cor, hoje: b.pct_meta ?? b.pct, pct: pctD, desvio: pctD - b.alvo_pct, alvo: b.alvo_pct, v };
    }).filter((l: any) => l.v > 0 || l.alvo > 0 || l.hoje > 0);
    const comMeta = linhas.filter((l: any) => !l.fora);
    const pior = comMeta.reduce((m: any, l: any) => (Math.abs(l.desvio) > Math.abs(m.desvio) ? l : m), comMeta[0]);
    return (
      <Tabela minimo={360} cabecas={[{ t: "Pilar", largura: 150 }, { t: "Hoje", n: true, largura: 70 }, { t: "Depois", n: true, largura: 80 }, { t: "vs meta", n: true, largura: 90 }]}
        linhas={linhas.map((l: any) => l.fora
          ? [{ v: <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ponto cor={l.cor} /><T style={{ fontSize: 14 }}>{l.nome}</T></View> }, { v: "fora da meta (0%)", cls: "fraco" }, "", ""]
          : [{ v: <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ponto cor={l.cor} /><T style={{ fontSize: 14 }}>{l.nome}</T></View> },
            { v: `${FC.fmt.num(l.hoje, 1)}%`, cls: "fraco" }, { v: `${FC.fmt.num(l.pct, 1)}%`, peso: "600" },
            { v: FC.fmt.delta(l.desvio, 1, " p.p."), cls: l === pior && Math.abs(l.desvio) >= 1 ? "neg" : "fraco" }])} />
    );
  };
  const caixa = (base.find((l: any) => l.chave === "caixa") || { valor: 0 }).valor;
  const registrar = async () => {
    const itens = Object.entries(cesta).filter(([tk, q]) => FC.lerNum(q) > 0 && mapa[tk]).map(([tk, q]) => {
      const qq = FC.lerNum(q);
      return { tipo: "ativo", ticker: tk, quantidade: qq, preco: mapa[tk].preco, valor: qq * mapa[tk].preco, data: FC.datas.hoje(), observacao: "cesta simulada" };
    });
    if (!(await ui.confirma(`Registrar ${itens.length} compra(s) com data de hoje e a cotação atual? Dá para ajustar o preço depois, em Aportes.`, { botao: "Registrar" }))) return;
    try {
      await FC.db.inserirVarios("aportes", itens);
      Object.keys(cesta).forEach((k) => delete cesta[k]);
      await depoisDeMudar(`${itens.length} compra(s) registrada(s)`);
    } catch (err) { ui.erro(err); }
  };
  const corScore = (cor: string) => (cor === "verde" ? t.cores.verde : cor === "vermelho" ? t.cores.vermelho : cor === "amarelo" ? t.cores.s3 : t.cores.ink3);
  return (
    <Pagina>
      {cab}
      <EstadoMercado />
      <Cartao semPad>
        <Tabela minimo={estreito ? 560 : 900}
          cabecas={[{ t: "Ativo", largura: 170 }, { t: "Score", largura: 120 }, { t: "Preço", n: true }, { t: "Cotas", n: true, largura: 120 }, { t: "Valor", n: true }, ...(estreito ? [] : [{ t: "Indicadores", largura: 260 }])]}
          linhas={ativos.map((a: any) => {
            const q = FC.lerNum(cesta[a.ticker]) || 0;
            return { estilo: q > 0 ? "tem-cota" : undefined, celulas: [
              { v: <B>{a.ticker}</B>, leg: `${a.tipo_rotulo} · ${FC.PILAR_NOME[a.pilar] || ""}` },
              { v: <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 70 }}><Trilha pct={Math.round(a.score || 0)} cor={corScore(a.cor)} /></View><Num style={{ fontWeight: "600" }}>{ok(a.score) ? Math.round(a.score) : "—"}</Num></View> },
              FC.fmt.preco(a.preco),
              { v: <Entrada compacto valor={cesta[a.ticker] || ""} aoMudar={(v) => { cesta[a.ticker] = v; setTick((x) => x + 1); }} decimal placeholder="0"
                style={{ width: 96, textAlign: "right" }} accessibilityLabel={`cotas de ${a.ticker}`} /> },
              { v: q > 0 ? FC.fmt.brlTexto(q * a.preco) : "—", dinheiro: true },
              ...(estreito ? [] : [{ v: <Indicadores ativo={a} /> }]),
            ] };
          })} />
      </Cartao>
      <Cartao style={{ marginTop: t.espaco.e3, ...(celular ? {} : {}) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: t.espaco.e3, alignItems: "center" }}>
          <Kpis>
            <Kpi rotulo="Total da cesta" valor={FC.fmt.brlTexto(total)} dinheiro />
            <Kpi rotulo="Ativos" valor={String(n)} />
            <Kpi rotulo="Score médio ponderado" valor={total ? String(Math.round(somaScore / total)) : "—"} />
          </Kpis>
          <View style={{ flexDirection: "row", gap: t.espaco.e3 }}>
            <Botao variante="sec" onPress={() => { Object.keys(cesta).forEach((k) => delete cesta[k]); setTick((x) => x + 1); }}>Limpar</Botao>
            <Botao desabilitado={!total} onPress={registrar}>Registrar como compras</Botao>
          </View>
        </View>
      </Cartao>
      <Secao titulo="Efeito na alocação" sub="a mesma cesta, conforme de onde sai o dinheiro">
        {!total ? <Lista><Vazio icone="📊" titulo="Digite as cotas acima" texto="A alocação depois da compra aparece aqui, nos dois cenários." /></Lista> : (
          <>
            <Grade colunas={2}>
              <Cartao><T v="h3">A · Dinheiro novo</T><T style={{ fontSize: 13, color: t.cores.ink2, marginBottom: t.espaco.e3 }}>o patrimônio cresce e o caixa fica onde está</T>{cenario(true)}</Cartao>
              <Cartao><T v="h3">B · Saindo do caixa</T>
                <T style={{ fontSize: 13, color: t.cores.ink2, marginBottom: t.espaco.e3 }}>{caixa < total ? <T cls="neg" style={{ fontSize: 13 }}>o caixa atual (<Rs cls="neg" style={{ fontSize: 13 }}>{FC.fmt.brlTexto(caixa)}</Rs>) não cobre a cesta</T> : "o patrimônio não muda, só a composição"}</T>
                {cenario(false)}</Cartao>
            </Grade>
            <T v="p" style={{ marginTop: t.espaco.e3 }}>O desvio em vermelho marca o pilar que fica mais distante da meta depois da compra.</T>
          </>
        )}
      </Secao>
    </Pagina>
  );
}
