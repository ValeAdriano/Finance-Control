/* Dividendos: quanto cai por mês, quando cai, e de qual ação — port de
 * telas/dividendos.js. */
import React, { useEffect, useState } from "react";
import { Pressable, View, Text } from "react-native";
import { router } from "expo-router";
import { useTema } from "../tema";
import { useEstado, rerender } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import { B, Botao, Cabecalho, Cartao, Chip, Conta, Item, Legenda, Lista, Num, Pilula, Roda, Rs, Secao, T, Tabela, Vazio } from "../ui/kit";
import { Grafico } from "../ui/grafico";
import { Icone } from "../ui/icone";
import { ui } from "../ui/folha";
import { EstadoMercado } from "./comum/alertas";
import { abreAtivo } from "./comum/ativo";
import { depoisDeMudar } from "./comum/dados";
import { CartaoCaixaProventos, ConfigCaixaProventos } from "./comum/caixa-proventos";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const COR_TIPO: Record<string, string> = { Dividendo: "verde", JCP: "azul", Rendimento: "terra" };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;

function LinhaPagamento({ p, comAcao, aoLancar }: { p: any; comAcao: boolean; aoLancar?: (p: any) => Promise<void> }) {
  const t = useTema();
  const { estreito } = useMedidas();
  // "lançado" (pílula) e "Lançar" (botão) têm larguras diferentes: na coluna da
  // direita eles empurravam o valor e cada linha ficava num alinhamento. No
  // celular a ação vai para baixo do valor; no computador, numa coluna fixa.
  const acao = comAcao ? (p.lancado ? <Pilula cor="verde">lançado</Pilula>
    : <Botao variante="texto" pequeno rotuloA11y="Registrar em Aportes como provento" onPress={() => aoLancar && aoLancar(p)}>Lançar</Botao>) : null;
  const quando = p.pagamento ? FC.datas.br(p.pagamento) : "a definir";
  const dia = p.pagamento || p.data_com;
  return (
    <Item detalheLinhas={2}
      esquerda={<View style={{ width: 48, alignItems: "center" }}>
        <T style={{ fontSize: 17, lineHeight: 18, fontWeight: "600" }}>{dia.slice(8, 10)}</T>
        <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>{FC.datas.mesAno(dia)}</T>
      </View>}
      titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <T style={{ fontWeight: "600", fontSize: 15 }}>{p.ticker}</T>
        <Pilula cor={COR_TIPO[p.tipo] || "cinza"}>{p.tipo}</Pilula>
        {p.status === "anunciado" ? <Pilula cor="amarelo">{"data com " + FC.datas.br(p.data_com).slice(0, 5)}</Pilula> : null}
      </View>}
      detalhe={`${FC.fmt.qtd(p.quantidade)} × ${FC.fmt.preco(p.valor_por_acao)}${p.tipo === "JCP" ? " (−15% IR)" : ""} · data com ${FC.datas.br(p.data_com)} · paga ${quando}${p.estimado_base ? " · pela posição inicial" : ""}`}
      valores={<View style={{ alignItems: "flex-end" }}>
        <Rs cls="pos" style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(p.valor)}</Rs>
        <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{p.status === "pago" ? "recebido" : p.status}</T>
        {estreito && acao ? <View style={{ marginTop: 6, alignItems: "flex-end" }}>{acao}</View> : null}
      </View>}
      direita={!estreito && acao ? <View style={{ width: 96, alignItems: "flex-end" }}>{acao}</View> : null} />
  );
}

export default function Dividendos() {
  const t = useTema();
  const e = useEstado();
  const { estreito } = useMedidas();
  const [recebidosAbertos, setRecebidosAbertos] = useState(false);
  const [configCaixa, setConfigCaixa] = useState(false);
  const pronto = !!(e.proventos && e.mercado.universo);
  useEffect(() => { if (!e.proventos && e.mercado.universo) FC.carregaProventos().then(() => rerender()); }, [e.proventos, e.mercado.universo]);
  const cab = (direita?: React.ReactNode) => <Cabecalho titulo="Dividendos" sub="Quanto suas ações e FIIs pagam, e quando." direita={direita} />;
  if (!pronto || !e.dados) {
    return (
      <Pagina>
        {cab()}<EstadoMercado />
        <View style={{ minHeight: 240, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Roda /><T style={{ color: t.cores.ink2 }}>Buscando os proventos de cada ativo…</T>
        </View>
      </Pagina>
    );
  }
  const r = FC.dividendos.analisa(e.dados, e.base, e.proventos);
  const s = r.resumo;
  const hoje = FC.datas.hoje();
  if (!r.porAtivo.length) {
    return (
      <Pagina>
        {cab()}
        <Lista><Vazio icone="💸" titulo="Nenhuma ação ou FII na carteira"
          texto="Quando você tiver ações, FIIs ou ETFs, esta tela mostra quanto cada um paga por mês, as próximas datas de pagamento e o total recebido."
          acao={<Botao onPress={() => router.push("/aportes" as any)}>Registrar uma compra</Botao>} /></Lista>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Cripto não paga dividendos e fica fora desta tela.</T>
      </Pagina>
    );
  }
  const maxMes = Math.max(...r.serie.map((m: any) => m.total), 0);
  const lanca = async (p: any) => {
    try {
      await FC.db.inserirVarios("aportes", [{ tipo: "provento", ticker: p.ticker, valor: Number(p.valor.toFixed(2)),
        data: p.pagamento || p.data_com, observacao: `${p.tipo} · ${FC.fmt.qtd(p.quantidade)} × ${FC.fmt.preco(p.valor_por_acao)}`, origem: p.origem }], "user_id,origem");
      await depoisDeMudar(`${p.tipo} de ${p.ticker} lançado`);
    } catch (err) { ui.erro(err); }
  };
  const chip = (rotulo: string, valor: string, dinheiro = true) => (
    <Chip><Text style={{ fontSize: 13, color: t.cores.ink2 }}>{rotulo} </Text>
      {dinheiro ? <Rs style={{ fontSize: 13, fontWeight: "600" }}>{valor}</Rs> : <Num style={{ fontSize: 13, fontWeight: "600" }}>{valor}</Num>}</Chip>
  );
  const tam = estreito ? 38 : 56;
  return (
    <Pagina>
      {cab(<Botao variante="sec" icone="atualizar" onPress={async () => { await FC.carregaProventos(true); rerender(); ui.aviso("Proventos atualizados"); }}>Atualizar</Botao>)}
      <Cartao style={{ paddingTop: estreito ? 24 : 48, paddingHorizontal: estreito ? 24 : 48, paddingBottom: 24 }}>
        <T style={{ fontSize: 15, color: t.cores.ink2 }}>Renda mensal estimada</T>
        <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 16 }}>
          <Conta valor={s.mensal_estimado} style={{ fontSize: tam, lineHeight: tam * 1.08, fontWeight: "600", letterSpacing: -tam * 0.035 }} />
          <T style={{ fontSize: tam * 0.4, color: t.cores.ink2, fontWeight: "500" }}>por mês</T>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2 }}>
          {chip("Próximos 30 dias", FC.fmt.brlTexto(s.proximos_30d))}
          {chip(`Recebido em ${hoje.slice(0, 4)}`, FC.fmt.brlTexto(s.no_ano))}
          {chip("Últimos 12 meses", FC.fmt.brlTexto(s.recebido_12m))}
          {ok(s.dy_carteira) ? chip("DY das posições", `${FC.fmt.num(s.dy_carteira)}%`, false) : null}
        </View>
      </Cartao>
      <T v="p" style={{ marginTop: t.espaco.e3 }}>Estimativa = o que cada ação pagou por cota nos últimos 12 meses × a quantidade que você tem hoje ÷ 12. JCP entra líquido do IR de 15%. Fonte: Fundamentus (data com e data de pagamento de cada provento).</T>

      <Secao titulo="Para onde vão os proventos" sub="direto para você ou guardados até reinvestir">
        {configCaixa ? <ConfigCaixaProventos aoFechar={() => setConfigCaixa(false)} /> : <CartaoCaixaProventos aoConfigurar={() => setConfigCaixa(true)} />}
      </Secao>

      <Secao titulo="Por mês" sub="pela data de pagamento · meses futuros com o que já foi anunciado">
        <Cartao>
          {maxMes > 0
            ? <Grafico marcador={FC.graficos.colunas({ barras: r.serie.map((m: any) => ({ rotulo: FC.datas.mesAno(m.mes + "-01"), titulo: nomeMes(m.mes) + (m.futuro ? " · a receber" : ""), valor: m.total, detalhe: m.itens, cor: m.futuro ? "var(--s3)" : "var(--s2)" })) })} />
            : <T v="p">Nenhum pagamento nos últimos 12 meses para a sua posição.</T>}
          <Legenda itens={[{ cor: t.cores.s2, rotulo: "recebido", tipo: "quadrado" }, { cor: t.cores.s3, rotulo: "a receber (anunciado)", tipo: "quadrado" }]} />
        </Cartao>
      </Secao>

      <Secao titulo="Próximos pagamentos" sub="anunciados pelas empresas e fundos">
        <Lista>
          {r.proximos.length ? r.proximos.map((p: any, i: number) => <LinhaPagamento key={i} p={p} comAcao={false} />)
            : <Vazio icone="📅" titulo="Nada anunciado ainda" texto="Quando uma empresa ou FII anunciar o próximo provento, ele aparece aqui com a data com e a data de pagamento." />}
        </Lista>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Para receber, é preciso ter a ação no fim da <B>data com</B>. Quando a data com ainda não passou, o valor usa a quantidade que você tem hoje.</T>
      </Secao>

      <Secao titulo="Por ativo" sub="o que cada um paga, com a sua quantidade">
        <Cartao semPad>
          <Tabela minimo={860} onLinha={(i) => abreAtivo(r.porAtivo[i].ticker)}
            cabecas={[{ t: "Ativo", largura: 160 }, { t: "Quantidade", n: true }, { t: "Por mês", n: true }, { t: "12 meses", n: true, largura: 130 }, { t: "DY", n: true, largura: 80 },
              { t: "Sobre seu PM", n: true }, { t: "Frequência" }, { t: "Próximo" }]}
            linhas={r.porAtivo.map((a: any) => [
              { v: <B>{a.ticker}</B>, leg: `${a.tipo_rotulo}${a.erro ? " · sem dados da fonte" : a.sem_dados ? " · nenhum provento registrado" : ""}` },
              FC.fmt.qtd(a.quantidade),
              { v: FC.fmt.brlTexto(a.mensal_estimado), dinheiro: true, peso: "600" },
              { v: FC.fmt.brlTexto(a.recebido_12m), dinheiro: true, leg: `${FC.fmt.preco(a.por_acao_12m)} por cota` },
              ok(a.dy_12m) ? FC.fmt.num(a.dy_12m) + "%" : "—",
              ok(a.yoc) ? FC.fmt.num(a.yoc) + "%" : "—",
              a.frequencia,
              a.proximo ? { v: <B>{a.proximo.pagamento ? FC.datas.br(a.proximo.pagamento).slice(0, 5) : "a definir"}</B>, leg: <Rs style={{ fontSize: 12, color: t.cores.ink2 }}>{FC.fmt.brlTexto(a.proximo.valor)}</Rs> } : { v: "—", cls: "muito-fraco" },
            ])} />
        </Cartao>
        <T v="p" style={{ marginTop: t.espaco.e3 }}><B>Sobre seu PM</B> (yield on cost) é o que a ação pagou em 12 meses dividido pelo seu preço médio — quanto o dinheiro que você colocou está rendendo em proventos.</T>
      </Secao>

      <View style={{ marginTop: t.espaco.e5 }}>
        <Pressable onPress={() => setRecebidosAbertos(!recebidosAbertos)} accessibilityRole="button" accessibilityState={{ expanded: recebidosAbertos }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ transform: [{ rotate: recebidosAbertos ? "90deg" : "0deg" }] }}><Icone nome="chevron" tam={16} cor={t.cores.ink} /></View>
          <T style={{ fontSize: 20, fontWeight: "600", letterSpacing: -0.4 }}>Recebidos <Text style={{ fontSize: 14, fontWeight: "400", color: t.cores.ink2 }}>· {r.recebidos.length} pagamento{r.recebidos.length === 1 ? "" : "s"}</Text></T>
        </Pressable>
        {recebidosAbertos ? (
          <View>
            <T v="p" style={{ marginTop: t.espaco.e3, marginBottom: t.espaco.e3 }}>Calculados pela sua posição em cada data com. <B>Lançar</B> registra o pagamento em Aportes como provento (sem duplicar), para ele entrar no histórico de proventos do Início.</T>
            <Lista>
              {r.recebidos.length ? r.recebidos.slice(0, 120).map((p: any, i: number) => <LinhaPagamento key={i} p={p} comAcao aoLancar={lanca} />)
                : <Vazio icone="🧾" titulo="Nenhum recebido" texto="Os pagamentos já feitos para a sua posição aparecem aqui." />}
            </Lista>
          </View>
        ) : null}
      </View>
    </Pagina>
  );
}
