/* Agro: o histórico de movimentos, custos e pesagens, agrupado por mês.
 * Tocar edita; deslizar (ou segurar) repete ou exclui. A aba Pesagens só
 * aparece para quem já pesou. O filtro de categoria pode vir de fora (o
 * cartão da categoria abre o histórico já filtrado). */
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { create } from "zustand";
import { useTema } from "../../tema";
import { useMedidas } from "../../ui/medidas";
import { Botao, Item, Lista, Pilula, Rs, Secao, T, Vazio, Valores } from "../../ui/kit";
import { Entrada, Segmentado, Seletor } from "../../ui/campos";
import { Icone } from "../../ui/icone";
import { Desliza } from "../../ui/desliza";
import { ui } from "../../ui/folha";
import { depoisDeMudar } from "../comum/dados";
import { formCusto, formMovimento, formPesagem, opcoesCat, unicos } from "./formularios";
import FC from "../../nucleo";

const PAGINA = 30;
type Filtro = { categoria: string; fazenda: string; ano: string };
export const useFiltroAgro = create<{ aba: string; filtro: Filtro }>(() => ({ aba: "movs", filtro: { categoria: "", fazenda: "", ano: "" } }));
/** abre o histórico já filtrado por uma categoria (do cartão da categoria) */
export const filtraCategoria = (categoria: string) => useFiltroAgro.setState((s) => ({ aba: "movs", filtro: { ...s.filtro, categoria } }));

function DiaMes({ data }: { data: string }) {
  const t = useTema();
  return (
    <View style={{ width: 44, alignItems: "center" }}>
      <T style={{ fontSize: 17, lineHeight: 18, fontWeight: "600" }}>{data.slice(8, 10)}</T>
      <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>{FC.datas.mesAno(data)}</T>
    </View>
  );
}

async function exclui(tabela: string, id: string, oque: string) {
  if (!(await ui.confirma(`Excluir ${oque}? O rebanho e o resultado são recalculados.`, { botao: "Excluir", perigo: true }))) return;
  try { await FC.db.apagar(tabela, id); await depoisDeMudar("Lançamento excluído"); } catch (e) { ui.erro(e); }
}

// segurar o item no computador: as mesmas ações do deslizar
function acoesRapidas(repetir: () => void, excluir: () => void) {
  ui.folha({
    titulo: "Ações",
    corpo: (api) => (
      <Lista>
        <Item chevron titulo="Repetir com a data de hoje" detalhe="abre um lançamento novo igual a este" onPress={() => { api.fechar(); setTimeout(repetir, 230); }} />
        <Item chevron titulo="Excluir" onPress={() => { api.fechar(); setTimeout(excluir, 230); }} />
      </Lista>
    ),
  });
}

const textoBusca = (x: any) => [x.descricao, x.contraparte, x.lote, x.fazenda, x.observacao, FC.CATEGORIAS_GADO[x.categoria], FC.CATEGORIAS_CUSTO && FC.CATEGORIAS_CUSTO[x.categoria]]
  .filter(Boolean).join(" ").toLowerCase();

export function Historico() {
  const t = useTema();
  const { estreito } = useMedidas();
  const { aba, filtro } = useFiltroAgro();
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(PAGINA);
  useEffect(() => { setLimite(PAGINA); }, [aba, filtro, busca]);
  const ag = FC.estado.base.agro;
  const temPesagens = ag.pesagens.length > 0;
  const abaVale = aba === "pes" && !temPesagens ? "movs" : aba;
  const todos = [...ag.movs, ...ag.custos, ...ag.pesagens];
  const anos = unicos(todos.map((x: any) => x.data.slice(0, 4))).reverse();
  const fazendas = unicos(todos.map((x: any) => x.fazenda));
  const ord = (a: any, b: any) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em));
  const q = busca.trim().toLowerCase();
  const filtra = (l: any[]) => l.filter((x) => (!filtro.categoria || x.categoria === filtro.categoria || x.categoria_destino === filtro.categoria)
    && (!filtro.fazenda || (x.fazenda || "") === filtro.fazenda) && (!filtro.ano || x.data.startsWith(filtro.ano)) && (!q || textoBusca(x).includes(q)));
  const mudaF = (k: keyof Filtro, v: string) => useFiltroAgro.setState((s) => ({ filtro: { ...s.filtro, [k]: v } }));
  const mudaAba = (v: string) => useFiltroAgro.setState({ aba: v });
  const nFiltros = [filtro.categoria, filtro.fazenda, filtro.ano].filter(Boolean).length;

  const seletores = (
    <>
      <View style={{ minWidth: 190 }}><Seletor compacto valor={filtro.categoria} aoMudar={(v) => mudaF("categoria", v)} rotuloA11y="Categoria" opcoes={[{ v: "", rotulo: "Todas as categorias" }, ...opcoesCat()]} /></View>
      {fazendas.length > 1 ? <View style={{ minWidth: 170 }}><Seletor compacto valor={filtro.fazenda} aoMudar={(v) => mudaF("fazenda", v)} rotuloA11y="Fazenda" opcoes={[{ v: "", rotulo: "Todas as fazendas" }, ...fazendas.map((x) => ({ v: x, rotulo: x }))]} /></View> : null}
      {anos.length > 1 ? <View style={{ minWidth: 150 }}><Seletor compacto valor={filtro.ano} aoMudar={(v) => mudaF("ano", v)} rotuloA11y="Ano" opcoes={[{ v: "", rotulo: "Todos os anos" }, ...anos.map((x) => ({ v: x, rotulo: x }))]} /></View> : null}
    </>
  );
  const abreFiltros = () => ui.folha({
    titulo: "Filtrar o histórico",
    corpo: () => <View style={{ gap: t.espaco.e3 }}>{seletores}</View>,
  });

  // cada linha: o item, o valor que soma no mês e as ações
  type Linha = { id: string; data: string; valor: number; no: React.ReactNode };
  let linhas: Linha[] = [];
  let vazio: React.ReactNode = null;
  if (abaVale === "movs") {
    const l = filtra(ag.movs).sort(ord);
    linhas = l.map((m: any) => {
      const tm = FC.TIPOS_MOV[m.tipo];
      const cat = FC.CATEGORIAS_GADO[m.categoria] + (m.tipo === "reclassificacao" ? " → " + FC.CATEGORIAS_GADO[m.categoria_destino] : "");
      const sinal = tm.sinal > 0 ? "+" : tm.sinal < 0 ? "−" : "";
      const det = [m.peso_medio_kg ? FC.fmt.num(m.peso_medio_kg, 0) + " kg" : "", m.preco_arroba ? FC.fmt.brlTexto(m.preco_arroba) + "/@" : "",
        m.preco_cabeca ? FC.fmt.brlTexto(m.preco_cabeca) + "/cab" : "", m.fazenda, m.lote ? "lote " + m.lote : "", m.contraparte, m.observacao].filter(Boolean).join(" · ");
      const repetir = () => formMovimento(m.tipo, m, { copia: true });
      const excluir = () => exclui("agro_movimentos", m.id, "este lançamento");
      return {
        id: m.id, data: m.data, valor: m.tipo === "venda" ? m.valor_total - m.despesas : -(m.valor_total || 0) - (m.despesas || 0),
        no: (
          <Desliza acoes={[{ rotulo: "Repetir", aoTocar: repetir }, { rotulo: "Excluir", perigo: true, aoTocar: excluir }]}>
            <Item chevron onPress={() => formMovimento(m.tipo, m)} onLongPress={() => acoesRapidas(repetir, excluir)} esquerda={<DiaMes data={m.data} />}
              titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}><T style={{ fontWeight: "600", fontSize: 15 }}>{sinal}{FC.fmt.int(m.cabecas)} {cat}</T><Pilula cor={tm.cor}>{tm.nome}</Pilula></View>}
              detalhe={det || " "}
              valores={<View style={{ alignItems: "flex-end" }}>
                {m.valor_total ? <Rs cls={m.tipo === "venda" ? "pos" : null} style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(m.valor_total)}</Rs> : null}
                {m.tipo === "venda" ? <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`${m.reinvestido > 0 ? `reinvestido ${FC.fmt.brlTexto(Math.min(m.reinvestido, m.valor_total - m.despesas), 0)} · ` : ""}saque ${FC.fmt.brlTexto(Math.max(0, m.valor_total - m.despesas - (m.reinvestido || 0)), 0)}`}</Rs>
                  : m.despesas ? <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`despesas ${FC.fmt.brlTexto(m.despesas)}`}</Rs> : null}
              </View>} />
          </Desliza>
        ),
      };
    });
    vazio = <Vazio icone="🐂" titulo={q || nFiltros ? "Nada com esse filtro" : "Nenhum movimento"} texto={q || nFiltros ? undefined : "Registre compras, vendas, nascimentos e mortes. Se o gado já existia, comece com uma “Outra entrada” de estoque inicial."} />;
  } else if (abaVale === "custos") {
    const l = filtra(ag.custos).sort(ord);
    linhas = l.map((c: any) => {
      const repetir = () => formCusto(c, { copia: true });
      const excluir = () => exclui("agro_custos", c.id, "este custo");
      return {
        id: c.id, data: c.data, valor: -c.valor,
        no: (
          <Desliza acoes={[{ rotulo: "Repetir", aoTocar: repetir }, { rotulo: "Excluir", perigo: true, aoTocar: excluir }]}>
            <Item chevron onPress={() => formCusto(c)} onLongPress={() => acoesRapidas(repetir, excluir)} esquerda={<DiaMes data={c.data} />} titulo={FC.CATEGORIAS_CUSTO[c.categoria]}
              detalhe={[c.descricao, c.fazenda, c.lote ? "lote " + c.lote : ""].filter(Boolean).join(" · ") || " "} valores={<Valores b={FC.fmt.brlTexto(c.valor)} />} />
          </Desliza>
        ),
      };
    });
    vazio = <Vazio icone="🧾" titulo={q || nFiltros ? "Nada com esse filtro" : "Nenhum custo"} texto={q || nFiltros ? undefined : "Ração, sal, vacinas, arrendamento, frete: tudo entra no resultado da atividade. Custo que se repete todo mês? Deslize e toque em Repetir."} />;
  } else {
    const l = filtra(ag.pesagens).sort(ord);
    linhas = l.map((p: any) => {
      const repetir = () => formPesagem(p, { copia: true });
      const excluir = () => exclui("agro_pesagens", p.id, "esta pesagem");
      return {
        id: p.id, data: p.data, valor: 0,
        no: (
          <Desliza acoes={[{ rotulo: "Repetir", aoTocar: repetir }, { rotulo: "Excluir", perigo: true, aoTocar: excluir }]}>
            <Item chevron onPress={() => formPesagem(p)} onLongPress={() => acoesRapidas(repetir, excluir)} esquerda={<DiaMes data={p.data} />} titulo={`${FC.fmt.int(p.cabecas)} ${FC.CATEGORIAS_GADO[p.categoria]}`}
              detalhe={[p.lote ? "lote " + p.lote : "", p.fazenda, p.observacao].filter(Boolean).join(" · ") || " "}
              valores={<Valores dinheiro={false} b={`${FC.fmt.num(p.peso_medio_kg, 1)} kg`} small={`${FC.fmt.num(FC.agro.arrobas(p.peso_medio_kg, FC.estado.dados.agro.rendimento), 1)} @`} />} />
          </Desliza>
        ),
      };
    });
    vazio = <Vazio icone="⚖️" titulo="Nenhuma pesagem" />;
  }

  // agrupa por mês, na página atual
  const pagina = linhas.slice(0, limite);
  const grupos: Array<{ mes: string; itens: Linha[] }> = [];
  for (const l of pagina) {
    const mes = l.data.slice(0, 7);
    if (!grupos.length || grupos.at(-1)!.mes !== mes) grupos.push({ mes, itens: [] });
    grupos.at(-1)!.itens.push(l);
  }
  // o total do mês considera todas as linhas filtradas do mês, não só as da página
  const totalMes = (mes: string) => FC.soma(linhas.filter((l) => l.data.startsWith(mes)), (l: Linha) => l.valor);
  const nMes = (mes: string) => linhas.filter((l) => l.data.startsWith(mes)).length;

  const opcoesAba = [{ v: "movs", rotulo: `Movimentos · ${ag.movs.length}` }, { v: "custos", rotulo: `Custos · ${ag.custos.length}` },
    ...(temPesagens ? [{ v: "pes", rotulo: `Pesagens · ${ag.pesagens.length}` }] : [])];
  return (
    <Secao titulo="Histórico">
      <View style={{ gap: t.espaco.e2, marginBottom: t.espaco.e3 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: t.espaco.e2, alignItems: "center" }}>
          <Segmentado valor={abaVale} aoMudar={mudaAba} rotuloA11y="Histórico" opcoes={opcoesAba} cheio={estreito} />
          {!estreito ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2 }}>{seletores}</View> : null}
        </View>
        <View style={{ flexDirection: "row", gap: t.espaco.e2, alignItems: "center" }}>
          <View style={{ flex: 1 }}><Entrada valor={busca} aoMudar={setBusca} placeholder="Buscar por descrição, lote, comprador…" accessibilityLabel="Buscar no histórico" compacto /></View>
          {estreito ? (
            <Pressable onPress={abreFiltros} accessibilityRole="button" accessibilityLabel={nFiltros ? `Filtros, ${nFiltros} ativos` : "Filtros"}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 980,
                backgroundColor: nFiltros ? t.cores.ink : t.cores.campo, opacity: pressed ? 0.7 : 1 })}>
              <Icone nome="ordenar" tam={15} cor={nFiltros ? t.cores.bg2 : t.cores.ink2} />
              <T style={{ fontSize: 13.5, fontWeight: "600", color: nFiltros ? t.cores.bg2 : t.cores.ink2 }}>{nFiltros ? `Filtros · ${nFiltros}` : "Filtros"}</T>
            </Pressable>
          ) : null}
        </View>
        {filtro.categoria ? (
          <Pressable onPress={() => mudaF("categoria", "")} accessibilityRole="button" style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 980, backgroundColor: t.cores.acentoSuave }}>
            <T style={{ fontSize: 13, color: t.cores.acento, fontWeight: "600" }}>{FC.CATEGORIAS_GADO[filtro.categoria]}</T>
            <Icone nome="fechar" tam={12} cor={t.cores.acento} />
          </Pressable>
        ) : null}
      </View>
      {!linhas.length ? <Lista>{vazio}</Lista> : grupos.map((g) => (
        <View key={g.mes} style={{ marginBottom: t.espaco.e3 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 6, paddingHorizontal: 4 }}>
            <T style={{ fontSize: 13, fontWeight: "700", color: t.cores.ink2, textTransform: "capitalize" }}>{FC.datas.mesAno(g.mes + "-01")}</T>
            <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>{`${nMes(g.mes)} ${nMes(g.mes) === 1 ? "lançamento" : "lançamentos"}`}</T>
            {abaVale !== "pes" && Math.abs(totalMes(g.mes)) > 0.5 ? <Rs cls={totalMes(g.mes) >= 0 ? "pos" : null} style={{ marginLeft: "auto", fontSize: 12.5, color: t.cores.ink2 }}>{(totalMes(g.mes) >= 0 ? "+" : "−") + FC.fmt.brlTexto(Math.abs(totalMes(g.mes)), 0)}</Rs> : null}
          </View>
          <Lista>{g.itens.map((l) => <React.Fragment key={l.id}>{l.no}</React.Fragment>)}</Lista>
        </View>
      ))}
      {linhas.length > limite ? (
        <View style={{ alignItems: "center" }}><Botao variante="texto" onPress={() => setLimite(limite + PAGINA)}>{`Mostrar mais (${linhas.length - limite})`}</Botao></View>
      ) : null}
    </Secao>
  );
}
