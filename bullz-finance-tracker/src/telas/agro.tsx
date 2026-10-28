/* Agronegócio: controle do rebanho como investimento — port de telas/agro.js.
 * Compras, vendas, nascimentos, mortes, mudanças de categoria, custos e
 * pesagens. O rebanho de hoje é a soma de tudo isso. Pesar o gado é
 * opcional: sem peso lançado, a tela não mostra o que depende dele. */
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import {
  B, Botao, Cabecalho, Cartao, Chip, Conta, Detalhes, Grade, Item, Kpi, KpiValor, Kpis, Legenda, Lista, Num, Rs, Secao, T, Vazio, Valores,
} from "../ui/kit";
import { Grafico } from "../ui/grafico";
import { Icone } from "../ui/icone";
import { ui } from "../ui/folha";
import { BarrasH } from "./comum/pagadoras";
import { escolher, formCotacao, formMovimento, formPesagem } from "./agro/formularios";
import { Historico, filtraCategoria } from "./agro/historico";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const ORIGEM_VALOR: Record<string, string> = {
  por_cabeca: "pela sua cotação por cabeça", arroba: "pela arroba", operacoes: "pelas suas compras e vendas", tipico: "estimado por peso típico", custo: "pelo que você pagou",
};

// pendências do rebanho num cartão só, cada uma abrindo o lançamento certo
function Pendencias({ ag }: { ag: any }) {
  const t = useTema();
  const movs = FC.estado.base.agro.movs;
  const itens: Array<{ texto: string; abrir?: () => void }> = [];
  for (const x of ag.ajustes) {
    const m = x.id ? movs.find((y: any) => y.id === x.id) : null;
    const de = FC.CATEGORIAS_GADO[x.de].toLowerCase(), para = FC.CATEGORIAS_GADO[x.para].toLowerCase();
    itens.push({
      texto: x.ignorado
        ? `${FC.datas.br(x.data)}: mudança de ${x.cabecas} ${de} a mais do que havia — só o que existia mudou.`
        : `${FC.datas.br(x.data)}: ${x.cabecas} ${de} saíram como ${para} (${FC.TIPOS_MOV[x.tipo].nome.toLowerCase()}), sem lançar a mudança.`,
      abrir: m ? () => formMovimento(m.tipo, m) : undefined,
    });
  }
  for (const c of ag.inconsistentes) {
    itens.push({ texto: `${FC.CATEGORIAS_GADO[c]}: saíram mais cabeças do que entraram. Se o gado já existia, lance o estoque inicial.`, abrir: () => formMovimento("entrada", undefined, { padrao: { categoria: c } }) });
  }
  if (!itens.length) return null;
  const alerta = ag.inconsistentes.length || ag.ajustes.some((x: any) => x.ignorado);
  return (
    <Cartao style={{ marginBottom: t.espaco.e4, paddingVertical: t.espaco.e3, borderColor: alerta ? t.cores.amarelo : t.cores.linha } as any}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icone nome={alerta ? "alerta" : "info"} tam={18} cor={alerta ? t.cores.amarelo : t.cores.ink2} />
        <T style={{ fontWeight: "600", fontSize: 15 }}>{`Confira ${itens.length} ${itens.length === 1 ? "ponto" : "pontos"} do rebanho`}</T>
      </View>
      <Detalhes rotulo="Ver o que é" tam={13.5}>
        <View style={{ gap: 4 }}>
          {itens.map((x, i) => (
            <Pressable key={i} onPress={x.abrir} disabled={!x.abrir} accessibilityRole={x.abrir ? "button" : undefined}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
              <T v="p" style={{ flex: 1 }}>{x.texto}</T>
              {x.abrir ? <Icone nome="chevron" tam={14} cor={t.cores.acento} /> : null}
            </Pressable>
          ))}
        </View>
      </Detalhes>
    </Cartao>
  );
}

// tocar no cartão da categoria: o que ela vale e o que dá para fazer
function abreCategoria(c: any, usaPeso: boolean) {
  ui.folha({
    titulo: c.nome,
    corpo: (api) => {
      const vai = (fn: () => void) => { api.fechar(); setTimeout(fn, 230); };
      return (
        <View style={{ gap: 16 }}>
          <Kpis>
            <Kpi rotulo="Cabeças" valor={FC.fmt.int(c.cabecas)} />
            <Kpi rotulo="Valor" valor={FC.fmt.brlTexto(c.valor, 0)} dinheiro peq={ORIGEM_VALOR[c.origem_valor] || ""} />
            {ok(c.valor_cabeca) ? <Kpi rotulo="Por cabeça" valor={FC.fmt.brlTexto(c.valor_cabeca, 0)} dinheiro /> : null}
          </Kpis>
          {usaPeso && c.fonte_peso !== "típico" ? <T v="p">{`${FC.fmt.num(c.kg, 0)} kg · ${FC.fmt.num(c.arrobas_cabeca, 1)} @/cab, ${c.fonte_peso === "pesagem" ? "da pesagem de " + FC.datas.br(c.data_peso) : "do último lançamento"}`}</T> : null}
          {c.origem_valor === "tipico" ? <T v="p">Sem preço para esta categoria: informe o valor por cabeça na Cotação ou lance uma compra ou venda dela.</T> : null}
          <Lista>
            <Item chevron titulo="Vender" onPress={() => vai(() => formMovimento("venda", undefined, { padrao: { categoria: c.categoria } }))} />
            <Item chevron titulo="Mudar de categoria" detalhe="ex.: bezerro → garrote" onPress={() => vai(() => formMovimento("reclassificacao", undefined, { padrao: { categoria: c.categoria } }))} />
            {usaPeso ? <Item chevron titulo="Pesar" onPress={() => vai(() => formPesagem(undefined, { padrao: { categoria: c.categoria } }))} /> : null}
            <Item chevron titulo="Ver no histórico" onPress={() => { filtraCategoria(c.categoria); api.fechar(); ui.aviso(`Histórico filtrado: ${c.nome}`); }} />
            {c.origem_valor !== "custo" ? <Item chevron titulo="Ajustar a cotação" onPress={() => vai(formCotacao)} /> : null}
          </Lista>
        </View>
      );
    },
  });
}

// "cada boi vendido deixou R$ 640 de margem, depois de 7 meses no pasto"
function ComoEsta({ fin }: { fin: any }) {
  const t = useTema();
  const itens: Array<[string, string, string?, string?]> = [];
  if (ok(fin.margem_cabeca)) itens.push(["Margem por cabeça vendida", FC.fmt.brlTexto(fin.margem_cabeca, 0), "venda líquida − custo de entrada − custo de manter", fin.margem_cabeca >= 0 ? "pos" : "neg"]);
  if (ok(fin.tempo_medio_dias)) itens.push(["Tempo médio no pasto", fin.tempo_medio_dias >= 60 ? `${FC.fmt.num(fin.tempo_medio_dias / 30.44, 1)} meses` : `${FC.fmt.int(fin.tempo_medio_dias)} dias`, "da entrada à venda"]);
  if (ok(fin.custo_cabeca_mes)) itens.push(["Custo por cabeça por mês", FC.fmt.brlTexto(fin.custo_cabeca_mes, 0), "custos ÷ cabeças médias ÷ meses"]);
  if (ok(fin.natalidade_pct)) itens.push(["Natalidade", `${FC.fmt.num(fin.natalidade_pct, 0)}%`, "nascimentos em 12 meses ÷ vacas"]);
  if (ok(fin.mortalidade_pct) && fin.mortes > 0) itens.push(["Mortalidade", `${FC.fmt.num(fin.mortalidade_pct, 1)}%`, "do que entrou"]);
  if (!itens.length) return null;
  const frase = ok(fin.margem_cabeca) && ok(fin.tempo_medio_dias)
    ? `Cada cabeça vendida deixou ${FC.fmt.brlTexto(fin.margem_cabeca, 0)} de ${fin.margem_cabeca >= 0 ? "margem" : "prejuízo"}, depois de ${fin.tempo_medio_dias >= 60 ? FC.fmt.num(fin.tempo_medio_dias / 30.44, 0) + " meses" : FC.fmt.int(fin.tempo_medio_dias) + " dias"} no pasto, em média.`
    : null;
  return (
    <Secao titulo="Como está o negócio" sub="tirado só dos seus lançamentos, sem precisar pesar o gado">
      <Cartao>
        {frase ? <T style={{ fontSize: 16, lineHeight: 23, marginBottom: t.espaco.e4 }}>{frase}</T> : null}
        <Kpis>{itens.map(([r, v, peq, cls]) => <Kpi key={r} pequeno rotulo={r} valor={v} peq={peq} cls={cls} dinheiro={v.startsWith("R$")} />)}</Kpis>
      </Cartao>
    </Secao>
  );
}

// ---------------------------------------------------------------- tela
export default function Agro() {
  const t = useTema();
  const e = useEstado();
  const { estreito } = useMedidas();
  const insets = useSafeAreaInsets();
  if (!e.dados || !e.prefs) return <Pagina>{null}</Pagina>;
  const ag = e.dados.agro;
  const cfg = e.prefs.agro;
  const fin = ag.financeiro;
  const custosCat = Object.entries<number>(fin.custos_por_categoria).sort((a, b) => b[1] - a[1]);
  const maxCusto = custosCat.length ? custosCat[0][1] : 1;
  const fazendas = Object.entries<any>(ag.porFazenda).map(([f, cats]) => [f, Object.values<number>(cats).reduce((s, n) => s + Math.max(0, n), 0)] as [string, number]).filter(([, n]) => n > 0);
  const tam = estreito ? 38 : 56;
  const usaPeso = !!ag.usa_peso;
  // de onde vem o valor do rebanho, numa frase (várias origens: "estimado")
  const origens = [...new Set(ag.porCategoria.map((c: any) => c.origem_valor))] as string[];
  const origemGeral = origens.length === 1 ? ORIGEM_VALOR[origens[0]] : "estimado por categoria";
  const velha = FC.agro.cotacaoVelha(ag, cfg);
  // valor do rebanho no tempo: as fotos diárias do patrimônio (campo agro)
  const fotos = (e.base.historico || []).filter((h: any) => h.agro > 0).map((h: any) => [h.data, h.agro]);
  const chipCotacao = ag.pelo_custo ? "pelo custo até vender"
    : velha ? (velha.dias == null ? "cotação sem data" : `cotação de ${FC.fmt.int(velha.dias)} dias`)
    : usaPeso ? null : "cotação por cabeça";
  const sub = (txt: string) => <T style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: 1 }}>{txt}</T>;
  const pagina = (
    <Pagina>
      <Cabecalho titulo="Agronegócio" sub="Seu rebanho como investimento: o que entra, o que sai e quanto vale."
        direita={estreito ? null : <Botao icone="aportes" onPress={escolher}>Lançamento</Botao>} />
      <Pendencias ag={ag} />

      <Cartao style={{ paddingTop: estreito ? 24 : 48, paddingHorizontal: estreito ? 24 : 48, paddingBottom: 24 }}>
        <T style={{ fontSize: 15, color: t.cores.ink2 }}>Rebanho</T>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6, marginBottom: 16 }}>
          <Conta valor={ag.total} modo="int" style={{ fontSize: tam, lineHeight: tam * 1.08, fontWeight: "600", letterSpacing: -tam * 0.035 }} />
          <T style={{ fontSize: tam * 0.45, color: t.cores.ink2, fontWeight: "500" }}>cabeças</T>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2 }}>
          <Chip><Text style={{ fontSize: 13, color: t.cores.ink2 }}>{ag.pelo_custo ? "Valor pago" : "Valor estimado"} </Text><Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(ag.valorRebanho, 0)}</Rs></Chip>
          <Pressable onPress={formCotacao} accessibilityRole="button" accessibilityLabel="Editar a cotação do gado"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 980,
              backgroundColor: velha ? t.cores.amareloSuave : t.cores.campo, opacity: pressed ? 0.7 : 1 })}>
            {velha ? <Icone nome="alerta" tam={13} cor={t.cores.amarelo} /> : null}
            <Text style={{ fontSize: 13, color: velha ? t.cores.amarelo : t.cores.ink2, fontWeight: velha ? "600" : "400" }}>
              {chipCotacao || <>@ <Text style={{ fontWeight: "600", color: t.cores.ink }}>{FC.fmt.brlTexto(cfg.preco_arroba)}</Text>{cfg.data_cotacao ? " em " + FC.datas.br(cfg.data_cotacao) : ""}</>}
            </Text>
            <Icone nome="editar" tam={13} cor={velha ? t.cores.amarelo : t.cores.ink2} />
          </Pressable>
          {ag.tem_dados ? <Chip><Text style={{ fontSize: 13, color: t.cores.ink2 }}>Resultado </Text><Rs cls={fin.resultado >= 0 ? "pos" : "neg"} style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(fin.resultado, 0)}</Rs></Chip> : null}
        </View>
      </Cartao>

      {!ag.tem_dados ? (
        <Secao>
          <Lista><Vazio icone="🐄" titulo="Comece seu controle do gado"
            texto="Lance o rebanho que você já tem como “Outra entrada” (estoque inicial) e, daqui para frente, cada compra, venda, nascimento, morte e custo. O painel conta o rebanho, estima o valor pela arroba e calcula o resultado."
            acao={<Botao onPress={() => formMovimento("entrada")}>Registrar estoque inicial</Botao>} /></Lista>
        </Secao>
      ) : (
        <>
          <Secao titulo="Resultado da atividade" sub="o que entrou, o que saiu e o que o rebanho vale hoje">
            <Cartao>
              <Kpis>
                <Kpi rotulo="Investido" ajuda="Compras (com frete, comissão e impostos da operação), o valor do gado que entrou como estoque inicial ou transferência, e todos os custos lançados."
                  valor={FC.fmt.brlTexto(fin.investido, 0)} dinheiro peq={<Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`${FC.fmt.brlTexto(fin.gasto_compras, 0)} em gado · ${FC.fmt.brlTexto(fin.custos, 0)} em custos`}</Rs>} />
                <Kpi rotulo="Recebido em vendas" valor={FC.fmt.brlTexto(fin.receita_vendas, 0)} dinheiro peq={`${FC.fmt.int(fin.cab_vendidas)} cabeças, já sem as despesas`} />
                <Kpi rotulo="Rebanho hoje" valor={FC.fmt.brlTexto(ag.valorRebanho, 0)} dinheiro peq={origemGeral} />
                <Kpi rotulo="Resultado" ajuda="Recebido em vendas + valor estimado do rebanho − tudo o que foi investido. É o ganho econômico, mesmo sem ter vendido tudo."
                  valor={<KpiValor dinheiro cls={fin.resultado >= 0 ? "pos" : "neg"}>{FC.fmt.brlTexto(fin.resultado, 0)}</KpiValor>}
                  peq={ok(fin.retorno_pct) ? `${FC.fmt.delta(fin.retorno_pct)}% sobre o capital aportado` : undefined} />
              </Kpis>
              <Detalhes rotulo="Ver detalhes" tam={14}>
              <T v="p" style={{ marginBottom: t.espaco.e3 }}>O <B>caixa do agro</B> é o dinheiro de vendas que você reinvestiu e ainda não virou gado. O <B>aporte novo</B> é só o que saiu do seu bolso além disso: é ele que conta como aporte na carteira.</T>
              <Kpis>
                {fin.caixa_agro > 0.5 ? <Kpi pequeno rotulo="Caixa do agro" ajuda="Dinheiro de vendas que você escolheu reinvestir e que ainda não virou gado. Conta no patrimônio e paga as próximas compras sem virar aporte." valor={FC.fmt.brlTexto(fin.caixa_agro, 0)} dinheiro /> : null}
                <Kpi pequeno rotulo="Aporte novo" ajuda="O que saiu do seu bolso para o agro, além do que as próprias vendas pagaram. É o que conta como aporte na carteira e no plano do mês."
                  valor={FC.fmt.brlTexto(fin.aportado, 0)} dinheiro peq={fin.sacado > 0.5 ? <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`${FC.fmt.brlTexto(fin.sacado, 0)} sacados`}</Rs> : undefined} />
                <Kpi pequeno rotulo="Caixa líquido" ajuda="Só o dinheiro que já entrou menos o que já saiu. Fica negativo enquanto o rebanho está em formação."
                  valor={FC.fmt.brlTexto(fin.caixa_liquido, 0)} dinheiro cls={fin.caixa_liquido >= 0 ? "pos" : "neg"} />
                {usaPeso && ok(fin.preco_medio_arroba_venda) ? <Kpi pequeno rotulo="Preço médio da @ vendida" valor={FC.fmt.brlTexto(fin.preco_medio_arroba_venda)} dinheiro /> : null}
                {ok(fin.custo_medio_cabeca_compra) ? <Kpi pequeno rotulo="Custo médio por cabeça comprada" valor={FC.fmt.brlTexto(fin.custo_medio_cabeca_compra, 0)} dinheiro /> : null}
                <Kpi pequeno rotulo="Nascimentos" valor={FC.fmt.int(fin.nascimentos)} />
                <Kpi pequeno rotulo="Mortes" valor={FC.fmt.int(fin.mortes)} peq={ok(fin.mortalidade_pct) ? `${FC.fmt.num(fin.mortalidade_pct, 1)}% do que entrou` : undefined} />
              </Kpis>
              </Detalhes>
            </Cartao>
          </Secao>

          <ComoEsta fin={fin} />

          {ag.porCategoria.length ? (
            <Secao titulo="Rebanho por categoria" sub="toque numa categoria para vender, mudar ou ver o histórico">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
                {ag.porCategoria.map((c: any) => (
                  <View key={c.nome} style={{ flexBasis: 150, flexGrow: 1 }}>
                    <Cartao onPress={() => abreCategoria(c, usaPeso)} style={{ paddingVertical: t.espaco.e3, paddingHorizontal: t.espaco.e4 }}>
                      <T style={{ fontSize: 13, color: t.cores.ink2 }}>{c.nome}</T>
                      <Num style={{ fontSize: 30, fontWeight: "600", letterSpacing: -0.9 }}>{FC.fmt.int(c.cabecas)}</Num>
                      <Rs style={{ marginTop: 4, fontWeight: "600" }}>{FC.fmt.brlTexto(c.valor, 0)}</Rs>
                      <T style={{ fontSize: 12, color: c.origem_valor === "tipico" ? t.cores.amarelo : t.cores.ink3 }}>{ORIGEM_VALOR[c.origem_valor] || ""}</T>
                      {usaPeso && c.fonte_peso !== "típico" ? <T style={{ fontSize: 12, color: t.cores.ink3 }}>{FC.fmt.num(c.kg, 0)} kg · {FC.fmt.num(c.arrobas_cabeca, 1)} @/cab</T> : null}
                    </Cartao>
                  </View>
                ))}
              </View>
            </Secao>
          ) : null}

          {fotos.length > 1 ? (
            <Secao titulo="Valor do rebanho" sub={ag.pelo_custo ? "pelo que você pagou, dia a dia" : "como entra no seu patrimônio, dia a dia"}>
              <Cartao>
                <Grafico marcador={FC.graficos.linhas({ series: [{ nome: "Valor do rebanho", pontos: fotos, classe: "l1", area: true }], altura: 220 })} />
              </Cartao>
            </Secao>
          ) : null}

          {ag.serie.length > 1 ? (
            <Secao titulo="Evolução" sub="mês a mês">
              <Grade colunas={2}>
                <Cartao>
                  <T v="h3">Cabeças no rebanho</T>{sub("entradas menos saídas, acumulado")}
                  <View style={{ marginTop: t.espaco.e3 }}><Grafico marcador={FC.graficos.linhas({ series: [{ nome: "Cabeças", pontos: ag.serie.map((s: any) => [s.data, s.cabecas]), classe: "l1", area: true }], y: "int", altura: 220, zero: true, degrau: true, privado: false })} /></View>
                </Cartao>
                <Cartao>
                  <T v="h3">Dinheiro na atividade</T>{sub("acumulado desde o primeiro lançamento")}
                  <View style={{ marginTop: t.espaco.e3 }}><Grafico marcador={FC.graficos.linhas({ series: [
                    { nome: "Investido", pontos: ag.serie.map((s: any) => [s.data, s.investido]), classe: "l3" },
                    { nome: "Recebido", pontos: ag.serie.map((s: any) => [s.data, s.recebido]), classe: "l2" }], altura: 220, zero: true })} /></View>
                  <Legenda itens={[{ cor: t.cores.s3, rotulo: "investido" }, { cor: t.cores.s2, rotulo: "recebido em vendas" }]} />
                </Cartao>
              </Grade>
            </Secao>
          ) : null}

          <Secao>
            <Grade colunas={2}>
              {custosCat.length ? (
                <View>
                  <T v="h2" style={{ marginBottom: t.espaco.e3 }}>Custos por categoria</T>
                  <Cartao>
                    <BarrasH itens={custosCat.map(([k, v]) => ({ nome: FC.CATEGORIAS_CUSTO[k], pct: (v / maxCusto) * 100, valor: <Rs style={{ fontSize: 13.5, fontWeight: "500" }}>{FC.fmt.brlTexto(v, 0)}</Rs> }))} />
                    {ag.total ? <T v="p" style={{ marginTop: t.espaco.e3 }}>Custo acumulado por cabeça no rebanho atual: <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(fin.custos / ag.total, 0)}</Rs></T> : null}
                  </Cartao>
                </View>
              ) : null}
              {ag.gmd.length ? (
                <View>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: t.espaco.e3, marginBottom: t.espaco.e3 }}><T v="h2">Ganho de peso</T><T v="sub">GMD por lote</T></View>
                  <Lista>
                    {ag.gmd.map((g: any, i: number) => (
                      <Item key={i} titulo={g.nome} detalhe={`${FC.fmt.num(g.peso_ini, 0)} → ${FC.fmt.num(g.peso_fim, 0)} kg em ${g.dias} dias · ${g.pesagens} pesagens`}
                        valores={<Valores dinheiro={false} cls={g.gmd >= 0 ? "pos" : "neg"} b={`${FC.fmt.num(g.gmd, 3)} kg/dia`} small={`${FC.fmt.num(g.arrobas_mes, 2)} @/mês`} />} />
                    ))}
                  </Lista>
                </View>
              ) : null}
              {fazendas.length > 1 ? (
                <View>
                  <T v="h2" style={{ marginBottom: t.espaco.e3 }}>Por fazenda</T>
                  <Lista>
                    {fazendas.map(([f, n]) => (
                      <Item key={f} titulo={f} detalhe={Object.entries<number>(ag.porFazenda[f]).filter(([, x]) => x > 0).map(([c, x]) => `${x} ${FC.CATEGORIAS_GADO[c].toLowerCase()}`).join(" · ")}
                        valores={<Valores dinheiro={false} b={FC.fmt.int(n)} small="cabeças" />} />
                    ))}
                  </Lista>
                </View>
              ) : null}
            </Grade>
          </Secao>
        </>
      )}
      <Historico />
    </Pagina>
  );
  if (!estreito) return pagina;
  // no celular, o botão de lançar flutua fora da rolagem
  return (
    <View style={{ flex: 1 }}>
      {pagina}
      {estreito ? (
        <Pressable onPress={escolher} accessibilityRole="button" accessibilityLabel="Novo lançamento"
          style={({ pressed }) => ({ position: Platform.OS === "web" ? "fixed" : "absolute", right: 18, bottom: 80 + insets.bottom + 16, width: 58, height: 58, borderRadius: 29,
            alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acento, opacity: pressed ? 0.85 : 1, boxShadow: t.cores.sombra, zIndex: 20 } as any)}>
          <T style={{ color: "#fff", fontSize: 30, lineHeight: 32, fontWeight: "300" }}>+</T>
        </Pressable>
      ) : null}
    </View>
  );
}
