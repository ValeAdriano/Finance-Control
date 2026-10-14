/* Imposto de renda: o rascunho da declaração de um ano (Bens e Direitos,
 * rendimentos, vendas e DARF) e quanto sobraria resgatando tudo hoje —
 * port de telas/irpf.js. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTema } from "../tema";
import { useEstado, rerender } from "../estado/app";
import { Pagina } from "../casca/casca";
import { B, Botao, Cabecalho, Cartao, Detalhes, Item, Kpi, KpiValor, Kpis, Lista, Mensagem, Pilula, Rs, Secao, T, Tabela, Valores } from "../ui/kit";
import { Seletor } from "../ui/campos";
import { ui } from "../ui/folha";
import { EstadoMercado } from "./comum/alertas";
import FC from "../nucleo";

let anoSel: number | null = null; // fica escolhido enquanto o app está aberto
const NOME_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m: string) => NOME_MES[Number(m.slice(5, 7)) - 1];

// anos com algum lançamento, do primeiro até o atual
function anosPossiveis(base: any) {
  const atual = Number(FC.datas.hoje().slice(0, 4));
  let ini = atual - 1;
  const datas = [
    ...(base.aportes || []).map((a: any) => a.data),
    ...(base.ativos || []).map((a: any) => a.data_base || String(a.criado_em || "").slice(0, 10)),
    ...(base.rendaFixa || []).map((x: any) => x.data_inicio || String(x.criado_em || "").slice(0, 10)),
  ].filter((d: string) => /^\d{4}/.test(d || ""));
  for (const d of datas) ini = Math.min(ini, Number(d.slice(0, 4)));
  const anos: number[] = [];
  for (let a = atual; a >= Math.max(ini, atual - 15); a--) anos.push(a);
  return anos;
}

// ---------------------------------------------------------------- CSV (igual ao site)
const n2 = (v: any) => (FC.ok(v) ? v.toFixed(2).replace(".", ",") : "");
const cel = (v: any) => { const s = String(v == null ? "" : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function csvIrpf(r: any) {
  const L: string[] = [];
  const linha = (...c: any[]) => L.push(c.map(cel).join(";"));
  linha(`Imposto de renda ${r.ano + 1} (ano-calendário ${r.ano}) — estimativa para conferência`);
  linha("");
  linha("BENS E DIREITOS");
  linha("Grupo", "Código", "Nome", "Discriminação", `31/12/${r.ano - 1}`, `31/12/${r.ano}`);
  for (const b of r.bens) linha(b.grupo, b.codigo, b.nome, b.discriminacao, n2(b.anterior), n2(b.atual));
  linha("");
  linha("RENDIMENTOS ISENTOS");
  linha("Código", "Fonte", "Tipo", "Valor");
  for (const x of r.rendimentos.isentos) linha(x.ficha.codigo, x.ticker, x.tipo, n2(x.liquido));
  linha("");
  linha("TRIBUTAÇÃO EXCLUSIVA (JCP líquido)");
  linha("Código", "Fonte", "Bruto", "IR na fonte", "Líquido");
  for (const x of r.rendimentos.exclusiva) linha(x.ficha.codigo, x.ticker, n2(x.bruto), n2(x.ir_fonte), n2(x.liquido));
  if (r.rendimentos.exterior.length) {
    linha("");
    linha("DIVIDENDOS DO EXTERIOR");
    linha("Ativo", "Líquido recebido");
    for (const x of r.rendimentos.exterior) linha(x.ticker, n2(x.liquido));
  }
  linha("");
  linha("VENDAS");
  linha("Data", "Ativo", "Classe", "Quantidade", "Preço", "Total", "Preço médio", "Ganho");
  for (const v of r.vendas) linha(v.data, v.ticker, v.classe, String(v.quantidade).replace(".", ","), n2(v.preco), n2(v.total), n2(v.preco_medio), n2(v.ganho));
  linha("");
  linha("APURAÇÃO MENSAL");
  linha("Mês", "Vendas ações", "Ganho ações", "Ações isentas", "Ganho ETF", "Ganho FII", "Base 15%", "Base 20%", "DARF 6015", "IR cripto");
  for (const m of r.meses) linha(m.mes, n2(m.vendido_acoes), n2(m.ganho_acoes), m.isento_acoes ? "sim" : "não", n2(m.ganho_etf), n2(m.ganho_fii),
    n2(m.base_comum), n2(m.base_fii), n2(m.darf_6015), n2(m.ir_cripto));
  return "﻿" + L.join("\r\n");
}

async function copia(texto: string) {
  await Clipboard.setStringAsync(texto);
  ui.aviso("Discriminação copiada");
}

function TabelaBens({ r }: { r: any }) {
  const t = useTema();
  if (!r.bens.length) return <Lista><T style={{ padding: 48, textAlign: "center", color: t.cores.ink2 }}>Nenhum bem com posição em 31/12/{r.ano - 1} ou 31/12/{r.ano}.</T></Lista>;
  return (
    <Cartao semPad>
      <Tabela minimo={900}
        cabecas={[{ t: "Código", largura: 110 }, { t: "Bem", largura: 170 }, { t: "Discriminação", largura: 340 }, { t: `31/12/${r.ano - 1}`, n: true, largura: 120 }, { t: `31/12/${r.ano}`, n: true, largura: 120 }, { t: "", largura: 90 }]}
        linhas={[
          ...r.bens.map((b: any) => [
            { v: <B>{b.grupo}-{b.codigo}</B>, leg: b.codigo_incerto ? "conferir código" : b.tipo === "renda_fixa" ? (b.isento ? "isento" : "tributado") : "" },
            { v: <B>{b.nome}</B>, leg: b.custo_parcial ? <Pilula cor="amarelo">custo incompleto</Pilula> : undefined },
            { v: <T style={{ fontSize: 13, color: t.cores.ink2 }}>{b.discriminacao}</T> },
            { v: FC.fmt.brlTexto(b.anterior), dinheiro: true },
            { v: FC.fmt.brlTexto(b.atual), dinheiro: true, peso: "600" },
            { v: <Botao variante="texto" pequeno onPress={() => copia(b.discriminacao)}>Copiar</Botao> },
          ]),
          [{ v: <B>Total</B> }, "", "", { v: FC.fmt.brlTexto(r.totais.bens_anterior), dinheiro: true }, { v: FC.fmt.brlTexto(r.totais.bens_atual), dinheiro: true, peso: "600" }, ""],
        ]} />
    </Cartao>
  );
}

function ListaRend({ itens, vazio, comIr }: { itens: any[]; vazio: string; comIr: boolean }) {
  const t = useTema();
  if (!itens.length) return <Lista><T style={{ padding: 48, textAlign: "center", color: t.cores.ink2 }}>{vazio}</T></Lista>;
  return (
    <Lista>
      {itens.map((x, i) => (
        <Item key={i}
          titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <T style={{ fontWeight: "600", fontSize: 15 }}>{x.ticker}</T><Pilula cor="cinza">{"cód. " + x.ficha.codigo}</Pilula>
            {x.estimado ? <Pilula cor="amarelo">estimado</Pilula> : null}</View>}
          detalhe={`${x.ficha.nome}${x.n > 1 ? ` · ${x.n} pagamentos` : ""}${comIr ? ` · bruto ${FC.fmt.brlTexto(x.bruto)}, IR na fonte ${FC.fmt.brlTexto(x.ir_fonte)}` : ""}`} detalheLinhas={2}
          valores={<Valores b={FC.fmt.brlTexto(x.liquido)} small={comIr ? "líquido" : x.tipo} />} />
      ))}
    </Lista>
  );
}

function TabelaMeses({ r }: { r: any }) {
  const t = useTema();
  if (!r.meses.length) return <Lista><T style={{ padding: 48, textAlign: "center", color: t.cores.ink2 }}>Nenhuma venda registrada em {r.ano}.</T></Lista>;
  const leg = (txt: string) => <T style={{ fontSize: 12, color: t.cores.ink2, textAlign: "right" }}>{txt}</T>;
  return (
    <View>
      <Cartao semPad>
        <Tabela minimo={860}
          cabecas={[{ t: "Mês", largura: 140 }, { t: "Vendas de ações", n: true, largura: 140 }, { t: "Ganho ações", n: true }, { t: "Ganho ETF", n: true }, { t: "Ganho FII", n: true },
            { t: "Cripto vendida", n: true, largura: 130 }, { t: "DARF", n: true, largura: 160 }]}
          linhas={r.meses.map((m: any) => [
            { v: <B>{nomeMes(m.mes)}</B>, leg: m.vendas.map((v: any) => v.ticker).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i).join(", ") },
            { v: FC.fmt.brlTexto(m.vendido_acoes), dinheiro: true, leg: m.vendido_acoes ? (m.isento_acoes ? "até R$ 20 mil: isento" : "passou de R$ 20 mil") : "" },
            { v: FC.fmt.brlTexto(m.ganho_acoes), dinheiro: true, cls: m.ganho_acoes < 0 ? "neg" : null },
            { v: m.vendido_etf ? FC.fmt.brlTexto(m.ganho_etf) : "—", dinheiro: true, cls: m.ganho_etf < 0 ? "neg" : null },
            { v: m.vendido_fii ? FC.fmt.brlTexto(m.ganho_fii) : "—", dinheiro: true, cls: m.ganho_fii < 0 ? "neg" : null },
            { v: m.vendido_cripto ? FC.fmt.brlTexto(m.vendido_cripto) : "—", dinheiro: true,
              leg: m.ir_cripto ? <Rs style={{ fontSize: 12, color: t.cores.ink2 }}>IR {FC.fmt.brlTexto(m.ir_cripto)}</Rs> : m.vendido_cripto ? "até R$ 35 mil: isento" : undefined },
            m.darf_6015 > 0.005
              ? { v: FC.fmt.brlTexto(m.darf_6015), dinheiro: true, peso: "600", leg: <>{leg(m.darf_6015 < 10 ? "abaixo de R$ 10: acumula" : "código 6015")}{m.prejuizo_comum + m.prejuizo_fii > 0.005 ? leg(`prejuízo a compensar ${FC.fmt.brlTexto(m.prejuizo_comum + m.prejuizo_fii)}`) : null}</> }
              : { v: "—", cls: "muito-fraco", leg: m.prejuizo_comum + m.prejuizo_fii > 0.005 ? `prejuízo a compensar ${FC.fmt.brlTexto(m.prejuizo_comum + m.prejuizo_fii)}` : undefined },
          ])} />
      </Cartao>
      <Detalhes rotulo={`Vendas para conferência (${r.vendas.length})`}>
        <Cartao semPad>
          <Tabela minimo={760}
            cabecas={[{ t: "Data" }, { t: "Ativo" }, { t: "Quantidade", n: true }, { t: "Preço", n: true }, { t: "Total", n: true }, { t: "Preço médio", n: true }, { t: "Ganho", n: true }]}
            linhas={r.vendas.map((v: any) => [FC.datas.br(v.data), { v: <B>{v.ticker}</B>, leg: (FC.CLASSES || {})[v.classe] || v.classe },
              FC.fmt.qtd(v.quantidade), FC.fmt.preco(v.preco), { v: FC.fmt.brlTexto(v.total), dinheiro: true }, FC.fmt.preco(v.preco_medio),
              { v: v.ganho == null ? "sem custo" : FC.fmt.brlTexto(v.ganho), dinheiro: true, cls: v.ganho < 0 ? "neg" : v.ganho > 0 ? "pos" : null }])} />
        </Cartao>
      </Detalhes>
    </View>
  );
}

function BlocoResgate({ s }: { s: any }) {
  const t = useTema();
  const pc = s.por_classe;
  const linhas = ([["Bolsa (ações, FIIs, ETFs)", pc.bolsa], ["Cripto", pc.cripto], ["Renda fixa", pc.renda_fixa], ["Agro", pc.agro]] as Array<[string, any]>).filter(([, c]) => c.bruto > 0.005);
  return (
    <View>
      <Cartao>
        <Kpis>
          <Kpi rotulo="Valor bruto hoje" valor={FC.fmt.brlTexto(s.bruto)} dinheiro />
          <Kpi rotulo="IR + IOF estimado" valor={FC.fmt.brlTexto(s.ir_estimado)} dinheiro />
          <Kpi rotulo="Líquido" valor={FC.fmt.brlTexto(s.liquido)} dinheiro peq={s.bruto ? FC.fmt.num((s.liquido / s.bruto) * 100, 1) + "% do bruto" : undefined} />
          <Kpi rotulo="Ganho líquido" valor={<KpiValor dinheiro cls={s.ganho_liquido < 0 ? "neg" : null}>{FC.fmt.brlTexto(s.ganho_liquido)}</KpiValor>}
            peq={<>sobre <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(s.aplicado)}</Rs> que saíram do bolso</>} />
        </Kpis>
      </Cartao>
      {linhas.length ? (
        <Cartao semPad style={{ marginTop: t.espaco.e3 }}>
          <Tabela minimo={480} cabecas={[{ t: "Classe", largura: 200 }, { t: "Bruto", n: true }, { t: "Imposto", n: true }, { t: "Líquido", n: true }]}
            linhas={linhas.map(([nome, c]) => [{ v: <B>{nome}</B> }, { v: FC.fmt.brlTexto(c.bruto), dinheiro: true }, { v: FC.fmt.brlTexto(c.ir), dinheiro: true }, { v: FC.fmt.brlTexto(c.liquido), dinheiro: true, peso: "600" }])} />
        </Cartao>
      ) : null}
      <View style={{ marginTop: t.espaco.e3, gap: 4 }}>{s.notas.map((n: string, i: number) => <T key={i} v="p">•  {n}</T>)}</View>
    </View>
  );
}

export default function Irpf() {
  const t = useTema();
  const e = useEstado();
  const [, setTick] = useState(0);
  useEffect(() => {
    // os proventos calculados vêm do Fundamentus: busca e repinta quando chegarem
    if (!e.proventos && e.mercado && e.mercado.universo) FC.carregaProventos().then(() => rerender()).catch(() => {});
  }, [e.proventos, e.mercado]);
  if (!e.base) return <Pagina>{null}</Pagina>;
  const base = e.base, d = e.dados;
  const anos = anosPossiveis(base);
  const anoPadrao = Number(FC.datas.hoje().slice(0, 4)) - 1;
  if (anoSel == null || !anos.includes(anoSel)) anoSel = anos.includes(anoPadrao) ? anoPadrao : anos[0];
  let r: any, s: any;
  try { r = FC.impostos.irpf(base, d, anoSel); } catch (err) { console.error(err); r = null; }
  try { s = d ? FC.impostos.resumo(d, base) : null; } catch (err) { console.error(err); s = null; }
  const seletor = (
    <View style={{ minWidth: 260 }}>
      <Seletor valor={String(anoSel)} aoMudar={(v) => { anoSel = Number(v); setTick((x) => x + 1); }} rotuloA11y="Ano-calendário"
        opcoes={anos.map((a) => ({ v: String(a), rotulo: `Ano-calendário ${a} (IR ${a + 1})` }))} />
    </View>
  );
  const aviso = (
    <Mensagem tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e4 }}>
      <T style={{ fontSize: 14 }}><B>Estimativa para conferência</B>: confira com o informe de rendimentos da corretora/banco antes de declarar. Os códigos e regras seguem a declaração vigente e podem mudar.</T>
    </Mensagem>
  );
  const cab = <Cabecalho titulo="Imposto de renda" sub="Rascunho da declaração e o imposto se resgatasse tudo hoje." direita={seletor} />;
  if (!r) return <Pagina>{cab}{aviso}<Mensagem tipo="info" icone="info">Não foi possível montar o relatório deste ano.</Mensagem></Pagina>;
  const tt = r.totais;
  return (
    <Pagina>
      {cab}{aviso}
      <EstadoMercado />
      <Cartao style={{ marginBottom: t.espaco.e4 }}>
        <Kpis>
          <Kpi rotulo={`Bens em 31/12/${r.ano}`} valor={FC.fmt.brlTexto(tt.bens_atual)} dinheiro
            peq={<>pelo custo · antes <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(tt.bens_anterior)}</Rs></>} />
          <Kpi rotulo="Rendimentos isentos" valor={FC.fmt.brlTexto(tt.isentos)} dinheiro />
          <Kpi rotulo="JCP (exclusiva)" valor={FC.fmt.brlTexto(tt.exclusiva)} dinheiro />
          <Kpi rotulo="DARF no ano" valor={FC.fmt.brlTexto(tt.darf + tt.ir_cripto)} dinheiro peq="ações, ETF, FII e cripto" />
        </Kpis>
      </Cartao>
      {r.avisos.length ? <Mensagem tipo="info" icone="info" style={{ marginBottom: t.espaco.e4 }}><T style={{ fontSize: 14 }}>{r.avisos.join("\n")}</T></Mensagem> : null}

      <Secao titulo="Bens e Direitos" sub="situação pelo custo de aquisição, não pelo valor de mercado">
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: t.espaco.e3 }}>
          <Botao variante="sec" pequeno onPress={() => copia(r.bens.map((b: any) => `${b.grupo}-${b.codigo} · ${b.nome}\n${b.discriminacao}\n31/12/${r.ano - 1}: ${n2(b.anterior)} · 31/12/${r.ano}: ${n2(b.atual)}`).join("\n\n"))}>Copiar todas as discriminações</Botao>
          <Botao variante="sec" pequeno icone="baixar" onPress={() => FC.baixar(`irpf-${r.ano}.csv`, csvIrpf(r), "text/csv;charset=utf-8")}>Baixar CSV</Botao>
        </View>
        <TabelaBens r={r} />
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Preencha corretora/instituição e CNPJ na discriminação. Quem tinha o bem antes de cadastrá-lo no app deve conferir a coluna de 31/12/{r.ano - 1}.</T>
      </Secao>

      <Secao titulo="Rendimentos isentos" sub="dividendos, rendimentos de FII e LCI/LCA">
        <ListaRend itens={r.rendimentos.isentos} vazio={`Nenhum rendimento isento em ${r.ano}.`} comIr={false} />
      </Secao>

      <Secao titulo="Tributação exclusiva" sub="JCP: informe o valor líquido (15% já retido)">
        <ListaRend itens={r.rendimentos.exclusiva} vazio={`Nenhum JCP em ${r.ano}.`} comIr />
        {r.rendimentos.exterior.length ? (
          <>
            <T style={{ fontSize: 16, fontWeight: "600", marginTop: t.espaco.e4, marginBottom: t.espaco.e3 }}>Dividendos do exterior</T>
            <ListaRend itens={r.rendimentos.exterior} vazio="" comIr={false} />
            <T v="p" style={{ marginTop: t.espaco.e3 }}>Desde 2024, dividendos do exterior pagam 15% na declaração anual (Lei 14.754/2023), descontado o imposto retido lá fora conforme acordo.</T>
          </>
        ) : null}
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Rendimentos de CDB e Tesouro aparecem no informe do banco ao resgatar (código 06) e não são estimados aqui.</T>
      </Secao>

      <Secao titulo="Vendas e DARF" sub="ganho pelo preço médio · ações até R$ 20 mil no mês isentas · FII 20% sempre">
        <TabelaMeses r={r} />
        {tt.ganho_exterior ? <T v="p" style={{ marginTop: t.espaco.e3 }}>Exterior: ganho de <Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(tt.ganho_exterior)}</Rs> no ano — 15% (<Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(tt.ir_exterior)}</Rs>) na declaração anual.</T> : null}
      </Secao>

      {s ? <Secao titulo="Se resgatasse tudo hoje" sub="quanto sobraria depois do imposto"><BlocoResgate s={s} /></Secao> : null}

      <View style={{ marginTop: t.espaco.e5 }}>
        <Detalhes rotulo="Premissas deste relatório" style={{ marginTop: 0 }}>
          <View style={{ gap: 4 }}>{r.notas.map((n: string, i: number) => <T key={i} v="p">•  {n}</T>)}</View>
        </Detalhes>
      </View>
    </Pagina>
  );
}
