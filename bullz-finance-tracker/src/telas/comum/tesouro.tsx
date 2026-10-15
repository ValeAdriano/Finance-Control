/* Renda fixa na tela Ativos: os títulos do Tesouro Direto com a taxa de
 * hoje, lidos contra o CDI e o IPCA, e uma simulação até o vencimento. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTema } from "../../tema";
import { rerender } from "../../estado/app";
import { Botao, Cartao, GrupoTitulo, Item, Kpi, Kpis, Lista, Mensagem, Num, Pilula, Roda, T } from "../../ui/kit";
import { Campo, Entrada, Segmentado } from "../../ui/campos";
import { ui } from "../../ui/folha";
import { formRendaFixa } from "./formularios";
import FC from "../../nucleo";

const ok = (v: any) => FC.ok(v);

// a lista do Tesouro, guardada entre visitas
export const tesouroMem: { dados: any; erro: string | null; carregando: boolean } = { dados: null, erro: null, carregando: false };
export async function carregaTesouro(forcar = false) {
  if (tesouroMem.carregando || (tesouroMem.dados && !forcar)) return;
  tesouroMem.carregando = true; tesouroMem.erro = null;
  try { tesouroMem.dados = await FC.mercado.tesouro(forcar); } catch (e: any) { tesouroMem.erro = String(e.message || e); } finally { tesouroMem.carregando = false; rerender(); }
}

type Indexador = "selic" | "pre" | "ipca";
const indexador = (tipo: string): Indexador => (/selic/i.test(tipo) ? "selic" : /prefixado/i.test(tipo) ? "pre" : "ipca");
const ROTULO_IDX: Record<Indexador, string> = { selic: "Pós-fixado (Selic)", pre: "Prefixado", ipca: "Inflação (IPCA+)" };

/** contas de um título: taxa nominal esperada, % do CDI, juro real e IR no vencimento */
export function analisaTitulo(x: any, macro: any) {
  const idx = indexador(x.tipo);
  const selic = ok(macro && macro.selic_meta) ? macro.selic_meta : null;
  const cdi = ok(macro && macro.cdi) ? macro.cdi : selic;
  const ipca = ok(macro && macro.ipca_12m) ? macro.ipca_12m : null;
  const taxa = x.taxa_compra;
  const comp = (a: number, b: number) => ((1 + a / 100) * (1 + b / 100) - 1) * 100;
  const nominal = idx === "pre" ? taxa : idx === "selic" ? (selic != null ? comp(selic, taxa) : null) : ipca != null ? comp(ipca, taxa) : null;
  const real = idx === "ipca" ? taxa : nominal != null && ipca != null ? ((1 + nominal / 100) / (1 + ipca / 100) - 1) * 100 : null;
  const pctCdi = nominal != null && cdi ? (nominal / cdi) * 100 : null;
  const hoje = FC.datas.hoje();
  const dias = Math.max(0, Math.round((new Date(x.vencimento).getTime() - new Date(hoje).getTime()) / 864e5));
  const anos = dias / 365;
  const aliquota = FC.impostos ? FC.impostos.aliquotaRF(dias) : dias <= 180 ? 22.5 : dias <= 360 ? 20 : dias <= 720 ? 17.5 : 15;
  const minimo = ok(x.pu_compra) && x.pu_compra > 0 ? Math.max(x.pu_compra * 0.01, 30) : null;
  const semestral = /semestra/i.test(x.tipo);
  const especial = /renda\+/i.test(x.tipo) ? "renda" : /educa\+/i.test(x.tipo) ? "educa" : null;
  const leitura = pctCdi == null ? ["sem CDI para comparar", "cinza"] : pctCdi >= 110 ? ["acima do CDI", "verde"] : pctCdi >= 95 ? ["perto do CDI", "azul"] : ["abaixo do CDI hoje", "amarelo"];
  return { ...x, idx, nominal, real, pct_cdi: pctCdi, dias, anos, aliquota, minimo, semestral, especial, leitura: leitura[0], cor: leitura[1] };
}

/** quanto R$ v aplicados hoje viram no vencimento, se a taxa e os índices de hoje se mantiverem */
export function simula(v: number, r: any) {
  if (!(v > 0) || r.nominal == null) return null;
  const bruto = v * Math.pow(1 + r.nominal / 100, r.anos);
  const ganho = bruto - v;
  const liquido = v + ganho * (1 - r.aliquota / 100);
  return { bruto, liquido, ganho, ir: ganho * (r.aliquota / 100) };
}

function CorpoTitulo({ r }: { r: any }) {
  const t = useTema();
  const [valor, setValor] = useState("1.000");
  const v = FC.lerNum(valor) || 0;
  const s = simula(v, r);
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: t.espaco.e3 }}>
        <Pilula cor="azul">{ROTULO_IDX[r.idx as Indexador]}</Pilula>
        <Pilula cor={r.cor}>{r.leitura}</Pilula>
      </View>
      <Kpis style={{ marginBottom: t.espaco.e4 }}>
        <Kpi pequeno rotulo="Taxa de hoje" valor={r.idx === "pre" ? `${FC.fmt.num(r.taxa_compra)}% a.a.` : r.idx === "selic" ? `Selic + ${FC.fmt.num(r.taxa_compra)}%` : `IPCA + ${FC.fmt.num(r.taxa_compra)}%`} />
        <Kpi pequeno rotulo="Rende ao ano (estimado)" valor={ok(r.nominal) ? `${FC.fmt.num(r.nominal)}%` : "—"} peq="bruto, com os índices de hoje" />
        <Kpi pequeno rotulo="Frente ao CDI" valor={ok(r.pct_cdi) ? `${FC.fmt.num(r.pct_cdi, 0)}%` : "—"} peq="do CDI, bruto" />
        <Kpi pequeno rotulo="Acima da inflação" valor={ok(r.real) ? `${FC.fmt.num(r.real)}% a.a.` : "—"} />
        <Kpi pequeno rotulo="Vencimento" valor={FC.datas.br(r.vencimento)} peq={`${FC.fmt.num(r.anos, 1)} anos · IR de ${FC.fmt.num(r.aliquota, 1)}% no fim`} />
        <Kpi pequeno rotulo="Preço de 1 título" valor={ok(r.pu_compra) ? FC.fmt.brlTexto(r.pu_compra) : "—"} peq={r.minimo ? `mínimo ${FC.fmt.brlTexto(r.minimo)} (1% do título, ao menos R$ 30)` : undefined} />
      </Kpis>
      <Cartao style={{ marginBottom: t.espaco.e4 }}>
        <T style={{ fontSize: 17, fontWeight: "600", marginBottom: 8 }}>Simular</T>
        <View style={{ maxWidth: 220 }}><Campo rotulo="Se eu aplicar hoje (R$)"><Entrada valor={valor} aoMudar={setValor} decimal accessibilityLabel="Valor a aplicar" /></Campo></View>
        {s ? (
          <Kpis style={{ marginTop: t.espaco.e3 }}>
            <Kpi pequeno rotulo={`No vencimento (${FC.datas.br(r.vencimento)})`} valor={FC.fmt.brlTexto(s.bruto)} dinheiro peq="bruto" />
            <Kpi pequeno rotulo="Depois do IR" valor={FC.fmt.brlTexto(s.liquido)} dinheiro cls="pos" peq={`IR de ${FC.fmt.brlTexto(s.ir)}`} />
          </Kpis>
        ) : <T v="p" style={{ marginTop: t.espaco.e2 }}>Digite um valor.</T>}
      </Cartao>
      {r.semestral ? <Mensagem tipo="info" icone="info" style={{ marginBottom: t.espaco.e3 }}>Paga juros a cada 6 meses (com IR em cada pagamento). A simulação acima supõe que os juros são reinvestidos na mesma taxa.</Mensagem> : null}
      {r.especial === "renda" ? <Mensagem tipo="info" icone="info" style={{ marginBottom: t.espaco.e3 }}>Tesouro Renda+: a partir do vencimento paga uma renda mensal por 20 anos, corrigida pela inflação. A data acima é o início da renda.</Mensagem> : null}
      {r.especial === "educa" ? <Mensagem tipo="info" icone="info" style={{ marginBottom: t.espaco.e3 }}>Tesouro Educa+: a partir do vencimento paga 60 parcelas mensais (5 anos), corrigidas pela inflação. A data acima é o início dos pagamentos.</Mensagem> : null}
      {r.idx === "pre" ? <T v="p">Prefixado: a taxa fica travada até o vencimento. Se vender antes, o preço muda com os juros do mercado (pode ganhar ou perder).</T> : null}
      {r.idx === "ipca" ? <T v="p">IPCA+: protege da inflação e paga o juro real acima. A estimativa usa o IPCA dos últimos 12 meses; vender antes do vencimento sai pelo preço do dia.</T> : null}
      {r.idx === "selic" ? <T v="p">Tesouro Selic: acompanha a Selic de cada dia, quase sem oscilação. É a escolha comum para reserva de emergência.</T> : null}
      <T v="p" style={{ marginTop: t.espaco.e3 }}>Taxas e preços do Tesouro Transparente{r.data_base ? ` de ${FC.datas.br(r.data_base)}` : ""}. Estimativa, não promessa: os índices mudam. Não é recomendação.</T>
    </View>
  );
}

export function abreTitulo(r: any) {
  ui.folha({
    titulo: `${r.tipo} ${r.vencimento.slice(0, 4)}`, larga: true,
    corpo: <CorpoTitulo r={r} />,
    rodape: (api) => (
      <Botao onPress={() => {
        api.fechar();
        setTimeout(() => formRendaFixa({ nome: `${r.tipo} ${r.vencimento.slice(0, 4)}`, tipo: r.idx === "selic" ? "cdi" : r.idx === "pre" ? "prefixado" : "ipca",
          taxa: r.idx === "selic" ? Math.round(r.pct_cdi || 100) : r.taxa_compra, vencimento: r.vencimento, valor_aplicado: 0, pilar: "caixa", _novo: true }), 240);
      }}>Já tenho / vou comprar</Botao>
    ),
  });
}

/** lista do Tesouro Direto, com filtro por indexador e a busca por nome */
export function ListaTesouro({ busca }: { busca: string }) {
  const t = useTema();
  const [idx, setIdx] = useState<"todos" | Indexador>("todos");
  useEffect(() => { carregaTesouro(); }, []);
  const d = tesouroMem.dados;
  if (!d) {
    return tesouroMem.erro ? (
      <Mensagem tipo="alerta" icone="alerta">Não consegui buscar os títulos do Tesouro agora ({tesouroMem.erro}). <T style={{ color: t.cores.acento, fontWeight: "600" }} onPress={() => carregaTesouro(true)}>Tentar de novo</T></Mensagem>
    ) : <View style={{ minHeight: 160, alignItems: "center", justifyContent: "center" }}><Roda /></View>;
  }
  const macro = (FC.estado.mercado.universo || {}).macro || {};
  const hoje = FC.datas.hoje();
  const q = busca.trim().toLowerCase();
  const todos = (d.titulos || []).filter((x: any) => x.vencimento > hoje && x.pu_compra > 0).map((x: any) => analisaTitulo({ ...x, data_base: d.data_base }, macro));
  const lista = todos.filter((r: any) => (idx === "todos" || r.idx === idx) && (!q || `${r.tipo} ${r.vencimento.slice(0, 4)}`.toLowerCase().includes(q)))
    .sort((a: any, b: any) => a.idx.localeCompare(b.idx) || a.tipo.localeCompare(b.tipo) || a.vencimento.localeCompare(b.vencimento));
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3, alignItems: "center", justifyContent: "space-between", marginBottom: t.espaco.e3 }}>
        <Segmentado rotuloA11y="Indexador" valor={idx} aoMudar={setIdx}
          opcoes={[{ v: "todos", rotulo: "Todos" }, { v: "selic", rotulo: "Selic" }, { v: "pre", rotulo: "Prefixado" }, { v: "ipca", rotulo: "IPCA+" }]} />
        <T v="p">CDI {ok(macro.cdi) ? FC.fmt.num(macro.cdi) + "%" : "—"} · IPCA 12m {ok(macro.ipca_12m) ? FC.fmt.num(macro.ipca_12m) + "%" : "—"}{d.data_base ? ` · taxas de ${FC.datas.br(d.data_base)}` : ""}{d.velho ? " (fonte fora do ar: último dado guardado)" : ""}</T>
      </View>
      {lista.length ? (
        <Lista>
          {lista.map((r: any, i: number) => (
            <React.Fragment key={i}>
              {i === 0 || lista[i - 1].idx !== r.idx ? <GrupoTitulo>{ROTULO_IDX[r.idx as Indexador]} · {lista.filter((x: any) => x.idx === r.idx).length} títulos</GrupoTitulo> : null}
              <Item chevron onPress={() => abreTitulo(r)} detalheLinhas={2}
                titulo={`${r.tipo} ${r.vencimento.slice(0, 4)}`}
                detalhe={`vence ${FC.datas.br(r.vencimento)} (${FC.fmt.num(r.anos, r.anos < 10 ? 1 : 0)} anos)${r.minimo ? " · mínimo " + FC.fmt.brlTexto(r.minimo) : ""}${r.semestral ? " · juros a cada 6 meses" : ""}`}
                valores={
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Num style={{ fontWeight: "600", fontSize: 15 }}>{r.idx === "pre" ? `${FC.fmt.num(r.taxa_compra)}% a.a.` : r.idx === "selic" ? `Selic + ${FC.fmt.num(r.taxa_compra)}%` : `IPCA + ${FC.fmt.num(r.taxa_compra)}%`}</Num>
                    <T style={{ fontSize: 13, color: t.cores.ink2 }}>{ok(r.nominal) ? `≈ ${FC.fmt.num(r.nominal, 1)}% a.a. · ${FC.fmt.num(r.pct_cdi, 0)}% do CDI` : ""}</T>
                  </View>} />
            </React.Fragment>
          ))}
        </Lista>
      ) : <Lista><T style={{ padding: 24, color: t.cores.ink2 }}>Nenhum título com esse filtro.</T></Lista>}
      <T v="p" style={{ marginTop: t.espaco.e3 }}>A taxa é a de compra do último dia útil. “% do CDI” compara a taxa bruta estimada (com a Selic e o IPCA de hoje) com o CDI de hoje. Toque num título para simular quanto rende até o vencimento.</T>
    </View>
  );
}
