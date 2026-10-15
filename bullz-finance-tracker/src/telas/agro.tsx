/* Agronegócio: controle do rebanho como investimento — port de telas/agro.js.
 * Compras, vendas, nascimentos, mortes, mudanças de categoria, custos e
 * pesagens. O rebanho de hoje é a soma de tudo isso. */
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import {
  Ajuda, B, Botao, Cabecalho, Cartao, Chip, Conta, Grade, Item, Kpi, KpiValor, Kpis, Legenda, Lista, Mensagem, Num, Pilula, Rs, Secao, Separador, T, Vazio, Valores,
} from "../ui/kit";
import { Caixinha, Campo, CampoData, Entrada, Form, LinhaCampos, Segmentado, Seletor } from "../ui/campos";
import { Grafico } from "../ui/grafico";
import { Icone, type NomeIcone } from "../ui/icone";
import { folhaForm, ui } from "../ui/folha";
import { depoisDeMudar } from "./comum/dados";
import { BarrasH } from "./comum/pagadoras";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const mem = { aba: "movs", filtro: { categoria: "", fazenda: "", ano: "" } };

const LANCAMENTOS: Array<{ id: string; nome: string; desc: string; icone: NomeIcone; cor: string }> = [
  { id: "compra", nome: "Compra", desc: "gado comprado", icone: "aportes", cor: "acento" },
  { id: "venda", nome: "Venda", desc: "gado vendido", icone: "moeda", cor: "verde" },
  { id: "nascimento", nome: "Nascimento", desc: "bezerros nascidos", icone: "boi", cor: "terra" },
  { id: "morte", nome: "Morte", desc: "perdas do rebanho", icone: "alerta", cor: "vermelho" },
  { id: "reclassificacao", nome: "Mudança de categoria", desc: "ex.: bezerro → garrote", icone: "atualizar", cor: "s3" },
  { id: "entrada", nome: "Outra entrada", desc: "estoque inicial, transferência", icone: "importar", cor: "ink2" },
  { id: "saida", nome: "Outra saída", desc: "consumo, doação, transferência", icone: "exportar", cor: "ink2" },
  { id: "custo", nome: "Custo", desc: "ração, vacina, pasto, frete…", icone: "renda", cor: "s4" },
  { id: "pesagem", nome: "Pesagem", desc: "peso médio de um lote", icone: "balanca", cor: "s5" },
];

const opcoesCat = () => Object.entries<string>(FC.CATEGORIAS_GADO).map(([k, v]) => ({ v: k, rotulo: v }));
const unicos = (arr: any[]) => [...new Set(arr.filter(Boolean))].sort() as string[];
function sugestoes() {
  const ag = FC.estado.base.agro;
  const todos = [...ag.movs, ...ag.custos, ...ag.pesagens];
  return { faz: unicos(todos.map((x: any) => x.fazenda)), lotes: unicos(todos.map((x: any) => x.lote)), contra: unicos(ag.movs.map((x: any) => x.contraparte)) };
}

/** campo de texto com as sugestões do que já foi digitado (datalist) */
function EntradaSugerida({ valor, aoMudar, opcoes, ...resto }: { valor: string; aoMudar: (v: string) => void; opcoes: string[]; maxLength?: number; accessibilityLabel?: string }) {
  const t = useTema();
  const v = valor.trim().toLowerCase();
  const lista = v ? opcoes.filter((x) => x.toLowerCase().startsWith(v) && x.toLowerCase() !== v).slice(0, 4) : [];
  return (
    <View style={{ gap: 6 }}>
      <Entrada valor={valor} aoMudar={aoMudar} autoCapitalize="words" {...resto} />
      {lista.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {lista.map((s) => <Pressable key={s} onPress={() => aoMudar(s)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 980, backgroundColor: t.cores.campo }}><Text style={{ fontSize: 13, color: t.cores.ink }}>{s}</Text></Pressable>)}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- escolher o lançamento
function escolher() {
  ui.folha({
    titulo: "Novo lançamento",
    corpo: (api) => <Escolha fechar={api.fechar} />,
  });
}
function Escolha({ fechar }: { fechar: () => void }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
      {LANCAMENTOS.map((l) => (
        <View key={l.id} style={{ flexBasis: 150, flexGrow: 1 }}>
          <Cartao onPress={() => { fechar(); setTimeout(() => (l.id === "custo" ? formCusto() : l.id === "pesagem" ? formPesagem() : formMovimento(l.id)), 230); }}
            style={{ padding: 16, height: "100%" }}>
            <Icone nome={l.icone} tam={24} cor={(t.cores as any)[l.cor]} />
            <T style={{ fontWeight: "600", marginTop: 8 }}>{l.nome}</T>
            <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{l.desc}</T>
          </Cartao>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- movimento
function FormMovimento({ tipo, item, novo, defineSalvar, api }: { tipo: string; item: any; novo: boolean; defineSalvar: (fn: () => any) => void; api: any }) {
  const t = useTema();
  const cfg = FC.estado.prefs.agro;
  const comPreco = ["compra", "venda"].includes(tipo);
  const comValor = comPreco || ["entrada", "saida"].includes(tipo);
  const modoInicial = item.preco_arroba ? "arroba" : item.preco_cabeca ? "cabeca" : item.valor_total ? "total" : "arroba";
  const liqItem = Math.max(0, (item.valor_total || 0) - (item.despesas || 0));
  const rvInicial = novo ? "tudo" : !(item.reinvestido > 0) ? "saque" : item.reinvestido >= liqItem - 0.5 ? "tudo" : "parte";
  const sug = sugestoes();
  const [data, setData] = useState(item.data);
  const [cat, setCat] = useState(item.categoria);
  const [dest, setDest] = useState(item.categoria_destino || "garrote");
  const [cabTxt, setCab] = useState(item.cabecas != null ? String(item.cabecas) : "");
  const [pesoTxt, setPeso] = useState(item.peso_medio_kg != null ? String(item.peso_medio_kg).replace(".", ",") : "");
  const [modo, setModo] = useState(modoInicial);
  const [parrTxt, setParr] = useState(item.preco_arroba != null ? String(item.preco_arroba).replace(".", ",") : novo && cfg.preco_arroba ? String(cfg.preco_arroba).replace(".", ",") : "");
  const [pcabTxt, setPcab] = useState(item.preco_cabeca != null ? String(item.preco_cabeca).replace(".", ",") : "");
  const [totTxt, setTot] = useState(item.valor_total ? String(item.valor_total).replace(".", ",") : "");
  const [despTxt, setDesp] = useState(item.despesas ? String(item.despesas).replace(".", ",") : "");
  const [rv, setRv] = useState(rvInicial);
  const [reinvTxt, setReinv] = useState(item.reinvestido != null ? String(item.reinvestido).replace(".", ",") : "");
  const [faz, setFaz] = useState(item.fazenda || "");
  const [lote, setLote] = useState(item.lote || "");
  const [contra, setContra] = useState(item.contraparte || "");
  const [obs, setObs] = useState(item.observacao || "");
  const rend = Number(cfg.rendimento_carcaca) || 52;
  const cab = FC.lerNum(cabTxt), peso = FC.lerNum(pesoTxt), desp = FC.lerNum(despTxt) || 0;
  const outros = (FC.estado.base.agro.movs || []).filter((m: any) => m.id !== item.id);
  const cxSem = FC.agro.caixa(outros, FC.estado.base.agro.custos || []);

  // outra entrada sem valor: estimada como o valor do rebanho (entra como capital, não lucro)
  const estimaEntrada = (c: number, p: number | null) => {
    const kg = p || ((FC.estado.dados.agro.peso || {})[cat] || {}).kg || FC.PESO_TIPICO[cat];
    return Math.round((c || 0) * FC.agro.valorCabeca(cat, kg, cfg) * 100) / 100;
  };
  let valor = FC.agro.valorDaOperacao({ modo, cabecas: cab, peso_medio_kg: peso, preco_arroba: FC.lerNum(parrTxt), preco_cabeca: FC.lerNum(pcabTxt), valor_total: FC.lerNum(totTxt) }, rend);
  const estimado = tipo === "entrada" && !(valor > 0) && cab > 0;
  if (estimado) valor = estimaEntrada(cab, peso);
  const totArr = cab && peso ? cab * FC.agro.arrobas(peso, rend) : null;
  const liquido = tipo === "venda" ? valor - desp : valor + desp;
  const reinvestidoDe = (liq: number) => (rv === "tudo" ? liq : rv === "saque" ? 0 : Math.min(liq, Math.max(0, FC.lerNum(reinvTxt) || 0)));

  // aviso quando a saída passa do que o rebanho tem
  let aviso: React.ReactNode = null;
  const T2 = FC.TIPOS_MOV[tipo];
  if ((T2.sinal < 0 || tipo === "reclassificacao") && cab) {
    const agAtual = FC.estado.dados.agro;
    const volta = !novo && FC.TIPOS_MOV[item.tipo].sinal < 0 ? item.cabecas : 0;
    const temCat = Math.max(0, agAtual.rebanho[cat] || 0) + (volta && item.categoria === cat ? volta : 0);
    const temTotal = agAtual.total + volta;
    const nome = FC.CATEGORIAS_GADO[cat].toLowerCase();
    if (cab > temTotal) aviso = <Mensagem tipo="alerta" icone="alerta"><T style={{ fontSize: 14 }}>O rebanho registrado tem só {FC.fmt.int(temTotal)} cabeça(s) no total. Se o gado já existia antes de você começar a usar o painel, registre o estoque inicial com <B>Outra entrada</B>.</T></Mensagem>;
    else if (cab > temCat && tipo !== "reclassificacao") aviso = <Mensagem tipo="info" icone="info">{`Hoje há ${FC.fmt.int(temCat)} ${nome}(s) registrado(s). As outras ${FC.fmt.int(cab - temCat)} cabeça(s) saem das categorias de onde o animal veio (ex.: boi magro que engordou).`}</Mensagem>;
  }

  defineSalvar(async () => {
    const c = Math.round(cab || 0);
    if (!(c > 0)) { ui.aviso("Informe quantas cabeças.", "erro"); return; }
    if (tipo === "reclassificacao" && cat === dest) { ui.aviso("Escolha categorias diferentes.", "erro"); return; }
    const linha: any = {
      data, tipo, categoria: cat, categoria_destino: tipo === "reclassificacao" ? dest : null,
      cabecas: c, peso_medio_kg: peso, fazenda: faz || null, lote: lote || null,
      contraparte: comPreco ? contra || null : null, observacao: obs || "",
      preco_arroba: null, preco_cabeca: null, valor_total: 0, despesas: comPreco ? desp : 0,
    };
    if (comValor) {
      linha.valor_total = FC.agro.valorDaOperacao({ modo, cabecas: c, peso_medio_kg: peso, preco_arroba: FC.lerNum(parrTxt), preco_cabeca: FC.lerNum(pcabTxt), valor_total: FC.lerNum(totTxt) }, rend);
      if (modo === "arroba") linha.preco_arroba = FC.lerNum(parrTxt);
      if (modo === "cabeca") linha.preco_cabeca = FC.lerNum(pcabTxt);
      if (tipo === "entrada" && !(linha.valor_total > 0)) linha.valor_total = estimaEntrada(c, peso);
      if (comPreco && !(linha.valor_total > 0)) { ui.aviso(modo === "arroba" && !peso ? "Para fechar por @, informe o peso médio." : "Informe o preço.", "erro"); return; }
    }
    linha.reinvestido = tipo === "venda" ? Math.round(reinvestidoDe(Math.max(0, linha.valor_total - linha.despesas)) * 100) / 100 : null;
    try {
      if (novo) await FC.db.inserir("agro_movimentos", linha); else await FC.db.atualizar("agro_movimentos", item.id, linha);
      api.fechar();
      await depoisDeMudar(novo ? `${FC.TIPOS_MOV[tipo].nome} registrada` : "Lançamento atualizado");
    } catch (err) { ui.erro(err); }
  });

  const caixaCompra = (() => {
    if (!["compra", "entrada"].includes(tipo) || !(liquido > 0)) return null;
    const saldo = cxSem.saldoEm(data || FC.datas.hoje());
    if (!(saldo > 0.5)) return null;
    const doCaixa = Math.min(saldo, liquido);
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: t.espaco.e3 }}>
        <Icone nome="aportes" tam={15} cor={t.cores.ink2} />
        <T v="p">Do caixa do agro: <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(doCaixa)}</Rs> · Aporte novo: <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(liquido - doCaixa)}</Rs>
          {saldo - doCaixa > 0.5 ? <> · sobra <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(saldo - doCaixa)}</Rs> no caixa</> : null}</T>
      </View>
    );
  })();
  const re = reinvestidoDe(Math.max(0, liquido)), sq = Math.max(0, liquido) - re;
  const campoCab = <Campo rotulo="Cabeças"><Entrada valor={cabTxt} aoMudar={setCab} keyboardType="number-pad" placeholder="0" accessibilityLabel="Cabeças" /></Campo>;
  const campoPeso = (dica?: string) => (
    <Campo rotulo="Peso médio (kg vivo)" dica={dica}>
      <Entrada valor={pesoTxt} aoMudar={setPeso} decimal placeholder={tipo === "reclassificacao" ? "opcional" : String(FC.PESO_TIPICO[cat])} accessibilityLabel="Peso médio" />
    </Campo>
  );
  return (
    <Form>
      <LinhaCampos n={3}>
        <Campo rotulo="Data"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data" /></Campo>
        <Campo rotulo={tipo === "reclassificacao" ? "De" : "Categoria"}><Seletor valor={cat} aoMudar={setCat} opcoes={opcoesCat()} rotuloA11y="Categoria" /></Campo>
        {tipo === "reclassificacao" ? <Campo rotulo="Para"><Seletor valor={dest} aoMudar={setDest} opcoes={opcoesCat()} rotuloA11y="Para" /></Campo> : campoCab}
      </LinhaCampos>
      {tipo === "reclassificacao" ? <LinhaCampos>{campoCab}{campoPeso()}</LinhaCampos> : (
        <LinhaCampos>
          {campoPeso(peso ? `${FC.fmt.num(FC.agro.arrobas(peso, rend), 1)} @ por cabeça (rendimento ${FC.fmt.num(rend, 0)}%)` : undefined)}
          {comValor ? (
            <Campo rotulo="Como o preço foi fechado">
              <Segmentado valor={modo} aoMudar={setModo} rotuloA11y="Como o preço foi fechado"
                opcoes={[{ v: "arroba", rotulo: "Por @" }, { v: "cabeca", rotulo: "Por cabeça" }, { v: "total", rotulo: "Total" }]} />
            </Campo>
          ) : <View />}
        </LinhaCampos>
      )}
      {comValor ? (
        <>
          <LinhaCampos n={3}>
            {modo === "arroba" ? <Campo rotulo="Preço da @ (R$)"><Entrada valor={parrTxt} aoMudar={setParr} decimal accessibilityLabel="Preço da arroba" /></Campo> : null}
            {modo === "cabeca" ? <Campo rotulo="Preço por cabeça (R$)"><Entrada valor={pcabTxt} aoMudar={setPcab} decimal accessibilityLabel="Preço por cabeça" /></Campo> : null}
            {modo === "total" ? <Campo rotulo="Valor total (R$)"><Entrada valor={totTxt} aoMudar={setTot} decimal accessibilityLabel="Valor total" /></Campo> : null}
            {comPreco ? <Campo rotulo="Despesas da operação (R$)"><Entrada valor={despTxt} aoMudar={setDesp} decimal placeholder="frete, comissão, Funrural" accessibilityLabel="Despesas" /></Campo> : null}
          </LinhaCampos>
          <View style={{ backgroundColor: t.cores.bg3, borderRadius: t.raios.r, paddingVertical: 14, paddingHorizontal: 18 }}>
            <Kpis style={{ rowGap: 8, columnGap: 28 }}>
              <Kpi pequeno rotulo={estimado ? "Valor estimado" : "Valor da operação"} valor={FC.fmt.brlTexto(valor)} dinheiro />
              {totArr ? <Kpi pequeno rotulo="Arrobas" valor={`${FC.fmt.num(totArr, 1)} @`} /> : null}
              {cab && valor ? <Kpi pequeno rotulo="Por cabeça" valor={FC.fmt.brlTexto(valor / cab)} dinheiro /> : null}
              {totArr && valor ? <Kpi pequeno rotulo="Por @" valor={FC.fmt.brlTexto(valor / totArr)} dinheiro /> : null}
              {comPreco && desp ? <Kpi pequeno rotulo={tipo === "venda" ? "Líquido recebido" : "Custo total"} valor={FC.fmt.brlTexto(liquido)} dinheiro /> : null}
            </Kpis>
            {caixaCompra}
          </View>
        </>
      ) : null}
      {tipo === "venda" ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <T v="rot">Para onde vai o dinheiro?</T>
            <Ajuda texto="O que você reinveste fica no agro: paga as próximas compras e custos sem contar como aporte, e a carteira não cai na venda. Só o saque sai do patrimônio." />
          </View>
          <Segmentado valor={rv} aoMudar={(v) => {
            setRv(v);
            if (v === "parte" && !FC.lerNum(reinvTxt)) { const liq = Math.max(0, valor - desp); if (liq) setReinv(FC.fmt.num(liq, 2)); }
          }} rotuloA11y="Para onde vai o dinheiro" opcoes={[{ v: "tudo", rotulo: "Reinvestir tudo" }, { v: "parte", rotulo: "Parte" }, { v: "saque", rotulo: "Sacar tudo" }]} />
          {rv === "parte" ? <LinhaCampos><Campo rotulo="Reinvestir no gado (R$)"><Entrada valor={reinvTxt} aoMudar={setReinv} decimal placeholder="0,00" accessibilityLabel="Reinvestir no gado" /></Campo></LinhaCampos> : null}
          <View style={{ backgroundColor: t.cores.bg3, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginTop: 8 }}>
            <View style={{ height: 8, borderRadius: 99, backgroundColor: t.cores.linha, overflow: "hidden", marginBottom: 10 }}>
              <View style={{ height: "100%", width: `${liquido > 0 ? (re / liquido) * 100 : 0}%` as any, backgroundColor: "#b08a5b", borderRadius: 99 }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: 6, columnGap: 16 }}>
              <T style={{ fontSize: 14 }}><Text style={{ color: "#b08a5b" }}>● </Text>Fica no gado <Rs style={{ fontSize: 14, fontWeight: "600" }}>{FC.fmt.brlTexto(re)}</Rs></T>
              <T style={{ fontSize: 14 }}><Text style={{ color: "#8e8e93" }}>● </Text>Saque <Rs style={{ fontSize: 14, fontWeight: "600" }}>{FC.fmt.brlTexto(sq)}</Rs></T>
            </View>
            <T v="p" style={{ marginTop: t.espaco.e2 }}>{re > 0 ? "O reinvestido paga as próximas compras sem contar como aporte — é crescimento da atividade." : "Tudo sai do agro e da carteira, como um resgate."}</T>
          </View>
        </View>
      ) : null}
      <LinhaCampos n={3}>
        <Campo rotulo="Fazenda"><EntradaSugerida valor={faz} aoMudar={setFaz} opcoes={sug.faz} maxLength={60} accessibilityLabel="Fazenda" /></Campo>
        <Campo rotulo="Lote"><EntradaSugerida valor={lote} aoMudar={setLote} opcoes={sug.lotes} maxLength={40} accessibilityLabel="Lote" /></Campo>
        {comPreco ? <Campo rotulo={tipo === "compra" ? "Vendedor" : "Comprador"}><EntradaSugerida valor={contra} aoMudar={setContra} opcoes={sug.contra} maxLength={80} accessibilityLabel="Contraparte" /></Campo> : null}
      </LinhaCampos>
      <Campo rotulo="Observação"><Entrada valor={obs} aoMudar={setObs} maxLength={240} autoCapitalize="sentences" accessibilityLabel="Observação" /></Campo>
      {aviso}
    </Form>
  );
}

function formMovimento(tipo: string, item?: any) {
  const novo = !item;
  const it = item || { tipo, data: FC.datas.hoje(), categoria: tipo === "nascimento" ? "bezerro" : "boi_magro", cabecas: "" };
  const tp = it.tipo;
  folhaForm({
    titulo: (novo ? "" : "Editar · ") + FC.TIPOS_MOV[tp].nome,
    corpo: (api, defineSalvar) => <FormMovimento tipo={tp} item={it} novo={novo} defineSalvar={defineSalvar} api={api} />,
    apagar: novo ? undefined : async (api) => {
      if (!(await ui.confirma("Excluir este lançamento? O rebanho e o resultado são recalculados.", { botao: "Excluir", perigo: true }))) return;
      try { await FC.db.apagar("agro_movimentos", it.id); api.fechar(); await depoisDeMudar("Lançamento excluído"); } catch (e) { ui.erro(e); }
    },
  });
}

// ---------------------------------------------------------------- custo
function FormCusto({ item, novo, defineSalvar, api }: any) {
  const sug = sugestoes();
  const [data, setData] = useState(item.data);
  const [cat, setCat] = useState(item.categoria);
  const [valor, setValor] = useState(item.valor != null ? String(item.valor).replace(".", ",") : "");
  const [desc, setDesc] = useState(item.descricao || "");
  const [faz, setFaz] = useState(item.fazenda || "");
  const [lote, setLote] = useState(item.lote || "");
  defineSalvar(async () => {
    const v = FC.lerNum(valor);
    if (!(v > 0)) { ui.aviso("Informe o valor.", "erro"); return; }
    const linha = { data, categoria: cat, valor: v, descricao: desc || "", fazenda: faz || null, lote: lote || null };
    try {
      if (novo) await FC.db.inserir("agro_custos", linha); else await FC.db.atualizar("agro_custos", item.id, linha);
      api.fechar();
      await depoisDeMudar(novo ? "Custo registrado" : "Custo atualizado");
    } catch (err) { ui.erro(err); }
  });
  return (
    <Form>
      <LinhaCampos n={3}>
        <Campo rotulo="Data"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data" /></Campo>
        <Campo rotulo="Categoria"><Seletor valor={cat} aoMudar={setCat} rotuloA11y="Categoria" opcoes={Object.entries<string>(FC.CATEGORIAS_CUSTO).map(([k, v]) => ({ v: k, rotulo: v }))} /></Campo>
        <Campo rotulo="Valor (R$)"><Entrada valor={valor} aoMudar={setValor} decimal placeholder="0,00" accessibilityLabel="Valor" /></Campo>
      </LinhaCampos>
      <Campo rotulo="Descrição"><Entrada valor={desc} aoMudar={setDesc} maxLength={160} placeholder="10 sacos de sal mineral" autoCapitalize="sentences" accessibilityLabel="Descrição" /></Campo>
      <LinhaCampos>
        <Campo rotulo="Fazenda"><EntradaSugerida valor={faz} aoMudar={setFaz} opcoes={sug.faz} accessibilityLabel="Fazenda" /></Campo>
        <Campo rotulo="Lote"><EntradaSugerida valor={lote} aoMudar={setLote} opcoes={sug.lotes} accessibilityLabel="Lote" /></Campo>
      </LinhaCampos>
    </Form>
  );
}
function formCusto(item?: any) {
  const novo = !item;
  const it = item || { data: FC.datas.hoje(), categoria: "nutricao" };
  folhaForm({
    titulo: novo ? "Novo custo" : "Editar custo",
    corpo: (api, d) => <FormCusto item={it} novo={novo} defineSalvar={d} api={api} />,
    apagar: novo ? undefined : async (api) => {
      if (!(await ui.confirma("Excluir este custo?", { botao: "Excluir", perigo: true }))) return;
      try { await FC.db.apagar("agro_custos", it.id); api.fechar(); await depoisDeMudar("Custo excluído"); } catch (e) { ui.erro(e); }
    },
  });
}

// ---------------------------------------------------------------- pesagem
function FormPesagem({ item, novo, defineSalvar, api }: any) {
  const sug = sugestoes();
  const [data, setData] = useState(item.data);
  const [cat, setCat] = useState(item.categoria);
  const [cab, setCab] = useState(item.cabecas != null ? String(item.cabecas) : "");
  const [peso, setPeso] = useState(item.peso_medio_kg != null ? String(item.peso_medio_kg).replace(".", ",") : "");
  const [lote, setLote] = useState(item.lote || "");
  const [faz, setFaz] = useState(item.fazenda || "");
  const [obs, setObs] = useState(item.observacao || "");
  defineSalvar(async () => {
    const linha = { data, categoria: cat, cabecas: Math.round(FC.lerNum(cab) || 0), peso_medio_kg: FC.lerNum(peso), lote: lote || null, fazenda: faz || null, observacao: obs || "" };
    if (!(linha.cabecas > 0 && linha.peso_medio_kg > 0)) { ui.aviso("Informe cabeças e peso médio.", "erro"); return; }
    try {
      if (novo) await FC.db.inserir("agro_pesagens", linha); else await FC.db.atualizar("agro_pesagens", item.id, linha);
      api.fechar();
      await depoisDeMudar(novo ? "Pesagem registrada" : "Pesagem atualizada");
    } catch (err) { ui.erro(err); }
  });
  return (
    <Form>
      <T v="p">A pesagem mais recente de cada categoria define o peso usado para estimar o valor do rebanho. Pesagens do mesmo lote em datas diferentes geram o GMD.</T>
      <LinhaCampos n={3}>
        <Campo rotulo="Data"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data" /></Campo>
        <Campo rotulo="Categoria"><Seletor valor={cat} aoMudar={setCat} opcoes={opcoesCat()} rotuloA11y="Categoria" /></Campo>
        <Campo rotulo="Cabeças pesadas"><Entrada valor={cab} aoMudar={setCab} keyboardType="number-pad" accessibilityLabel="Cabeças pesadas" /></Campo>
      </LinhaCampos>
      <LinhaCampos n={3}>
        <Campo rotulo="Peso médio (kg)"><Entrada valor={peso} aoMudar={setPeso} decimal accessibilityLabel="Peso médio" /></Campo>
        <Campo rotulo="Lote"><EntradaSugerida valor={lote} aoMudar={setLote} opcoes={sug.lotes} accessibilityLabel="Lote" /></Campo>
        <Campo rotulo="Fazenda"><EntradaSugerida valor={faz} aoMudar={setFaz} opcoes={sug.faz} accessibilityLabel="Fazenda" /></Campo>
      </LinhaCampos>
      <Campo rotulo="Observação"><Entrada valor={obs} aoMudar={setObs} maxLength={160} autoCapitalize="sentences" accessibilityLabel="Observação" /></Campo>
    </Form>
  );
}
function formPesagem(item?: any) {
  const novo = !item;
  const it = item || { data: FC.datas.hoje(), categoria: "boi_magro" };
  folhaForm({
    titulo: novo ? "Nova pesagem" : "Editar pesagem",
    corpo: (api, d) => <FormPesagem item={it} novo={novo} defineSalvar={d} api={api} />,
    apagar: novo ? undefined : async (api) => {
      if (!(await ui.confirma("Excluir esta pesagem?", { botao: "Excluir", perigo: true }))) return;
      try { await FC.db.apagar("agro_pesagens", it.id); api.fechar(); await depoisDeMudar("Pesagem excluída"); } catch (e) { ui.erro(e); }
    },
  });
}

// ---------------------------------------------------------------- cotação
function FormCotacao({ defineSalvar, api }: any) {
  const cfg = FC.estado.prefs.agro;
  const [custo, setCusto] = useState(!!cfg.avaliar_pelo_custo);
  const [arr, setArr] = useState(cfg.preco_arroba != null ? String(cfg.preco_arroba).replace(".", ",") : "");
  const [rend, setRend] = useState(String(cfg.rendimento_carcaca ?? 52).replace(".", ","));
  const [data, setData] = useState(cfg.data_cotacao || FC.datas.hoje());
  const [porArr, setPorArr] = useState<Record<string, string>>(Object.fromEntries(Object.entries(cfg.arroba_por_categoria || {}).map(([k, v]) => [k, String(v).replace(".", ",")])));
  const [porCab, setPorCab] = useState<Record<string, string>>(Object.fromEntries(Object.entries(cfg.valor_cabeca_por_categoria || {}).map(([k, v]) => [k, String(v).replace(".", ",")])));
  defineSalvar(async () => {
    const pa: any = {}, pc: any = {};
    for (const k of Object.keys(FC.CATEGORIAS_GADO)) {
      const a = FC.lerNum(porArr[k]), c = FC.lerNum(porCab[k]);
      if (a > 0) pa[k] = a;
      if (c > 0) pc[k] = c;
    }
    const agro = { preco_arroba: FC.lerNum(arr) || 0, rendimento_carcaca: FC.lerNum(rend) || 52, data_cotacao: data || null,
      arroba_por_categoria: pa, valor_cabeca_por_categoria: pc, avaliar_pelo_custo: custo };
    try { await FC.db.gravaPrefs({ agro }); api.fechar(); await depoisDeMudar("Cotação atualizada"); } catch (err) { ui.erro(err); }
  });
  return (
    <Form>
      <Caixinha valor={custo} aoMudar={setCusto} rotulo={
        <View style={{ flex: 1 }}>
          <B>Avaliar pelo que paguei até vender</B>
          <T v="p">O rebanho vale o custo das cabeças no pasto e o ganho só aparece quando você lança a venda. A arroba abaixo não é usada.</T>
        </View>} />
      <T v="p">Sem essa opção, o valor do rebanho é estimado por: cabeças × peso vivo × rendimento de carcaça ÷ 15 × preço da arroba. Atualize o preço com a cotação da sua praça (CEPEA, Scot, frigorífico).</T>
      <LinhaCampos n={3}>
        <Campo rotulo="Preço da @ do boi (R$)"><Entrada valor={arr} aoMudar={setArr} decimal accessibilityLabel="Preço da arroba" /></Campo>
        <Campo rotulo="Rendimento de carcaça (%)"><Entrada valor={rend} aoMudar={setRend} decimal accessibilityLabel="Rendimento de carcaça" /></Campo>
        <Campo rotulo="Data da cotação"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data da cotação" /></Campo>
      </LinhaCampos>
      <T style={{ fontSize: 15, fontWeight: "600", marginTop: 8 }}>Por categoria (opcional)</T>
      <T v="p">Bezerro e vaca costumam ter preço diferente do boi. Preencha o preço da @ ou um valor fixo por cabeça — o que estiver preenchido vale no lugar do padrão.</T>
      <Lista style={{ boxShadow: "none" } as any}>
        {Object.entries<string>(FC.CATEGORIAS_GADO).map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 16, flexWrap: "wrap" }}>
            <T style={{ flex: 1, minWidth: 90, fontSize: 14, fontWeight: "600" }}>{v}</T>
            <Entrada compacto valor={porArr[k] || ""} aoMudar={(x) => setPorArr({ ...porArr, [k]: x })} decimal placeholder="R$/@" style={{ width: 130 }} accessibilityLabel={`Preço da arroba de ${v}`} />
            <Entrada compacto valor={porCab[k] || ""} aoMudar={(x) => setPorCab({ ...porCab, [k]: x })} decimal placeholder="R$/cabeça" style={{ width: 150 }} accessibilityLabel={`Valor por cabeça de ${v}`} />
          </View>
        ))}
      </Lista>
    </Form>
  );
}
function formCotacao() {
  folhaForm({ titulo: "Cotação e avaliação do rebanho", corpo: (api, d) => <FormCotacao defineSalvar={d} api={api} /> });
}

// ---------------------------------------------------------------- histórico
function DiaMes({ data }: { data: string }) {
  const t = useTema();
  return (
    <View style={{ width: 44, alignItems: "center" }}>
      <T style={{ fontSize: 17, lineHeight: 18, fontWeight: "600" }}>{data.slice(8, 10)}</T>
      <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>{FC.datas.mesAno(data)}</T>
    </View>
  );
}

function Historico() {
  const t = useTema();
  const [aba, setAba] = useState(mem.aba);
  const [filtro, setFiltro] = useState(mem.filtro);
  const ag = FC.estado.base.agro;
  const todos = [...ag.movs, ...ag.custos, ...ag.pesagens];
  const anos = unicos(todos.map((x: any) => x.data.slice(0, 4))).reverse();
  const fazendas = unicos(todos.map((x: any) => x.fazenda));
  const ord = (a: any, b: any) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em));
  const filtra = (l: any[]) => l.filter((x) => (!filtro.categoria || x.categoria === filtro.categoria || x.categoria_destino === filtro.categoria)
    && (!filtro.fazenda || (x.fazenda || "") === filtro.fazenda) && (!filtro.ano || x.data.startsWith(filtro.ano)));
  const mudaF = (k: string, v: string) => { const f = { ...filtro, [k]: v }; mem.filtro = f; setFiltro(f); };
  let corpo: React.ReactNode;
  if (aba === "movs") {
    const l = filtra(ag.movs).sort(ord);
    corpo = l.length ? l.map((m: any) => {
      const tm = FC.TIPOS_MOV[m.tipo];
      const cat = FC.CATEGORIAS_GADO[m.categoria] + (m.tipo === "reclassificacao" ? " → " + FC.CATEGORIAS_GADO[m.categoria_destino] : "");
      const sinal = tm.sinal > 0 ? "+" : tm.sinal < 0 ? "−" : "";
      const det = [m.peso_medio_kg ? FC.fmt.num(m.peso_medio_kg, 0) + " kg" : "", m.preco_arroba ? FC.fmt.brlTexto(m.preco_arroba) + "/@" : "",
        m.preco_cabeca ? FC.fmt.brlTexto(m.preco_cabeca) + "/cab" : "", m.fazenda, m.lote ? "lote " + m.lote : "", m.contraparte, m.observacao].filter(Boolean).join(" · ");
      return (
        <Item key={m.id} chevron onPress={() => formMovimento(m.tipo, m)} esquerda={<DiaMes data={m.data} />}
          titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}><T style={{ fontWeight: "600", fontSize: 15 }}>{sinal}{FC.fmt.int(m.cabecas)} {cat}</T><Pilula cor={tm.cor}>{tm.nome}</Pilula></View>}
          detalhe={det || " "}
          valores={<View style={{ alignItems: "flex-end" }}>
            {m.valor_total ? <Rs cls={m.tipo === "venda" ? "pos" : null} style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(m.valor_total)}</Rs> : null}
            {m.tipo === "venda" ? <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`${m.reinvestido > 0 ? `reinvestido ${FC.fmt.brlTexto(Math.min(m.reinvestido, m.valor_total - m.despesas), 0)} · ` : ""}saque ${FC.fmt.brlTexto(Math.max(0, m.valor_total - m.despesas - (m.reinvestido || 0)), 0)}`}</Rs>
              : m.despesas ? <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`despesas ${FC.fmt.brlTexto(m.despesas)}`}</Rs> : null}
          </View>} />
      );
    }) : <Vazio icone="🐂" titulo="Nenhum movimento" texto="Registre compras, vendas, nascimentos e mortes. Se o gado já existia, comece com uma “Outra entrada” de estoque inicial." />;
  } else if (aba === "custos") {
    const l = filtra(ag.custos).sort(ord);
    corpo = l.length ? l.map((c: any) => (
      <Item key={c.id} chevron onPress={() => formCusto(c)} esquerda={<DiaMes data={c.data} />} titulo={FC.CATEGORIAS_CUSTO[c.categoria]}
        detalhe={[c.descricao, c.fazenda, c.lote ? "lote " + c.lote : ""].filter(Boolean).join(" · ") || " "} valores={<Valores b={FC.fmt.brlTexto(c.valor)} />} />
    )) : <Vazio icone="🧾" titulo="Nenhum custo" texto="Ração, sal, vacinas, arrendamento, frete: tudo entra no resultado da atividade." />;
  } else {
    const l = filtra(ag.pesagens).sort(ord);
    corpo = l.length ? l.map((p: any) => (
      <Item key={p.id} chevron onPress={() => formPesagem(p)} esquerda={<DiaMes data={p.data} />} titulo={`${FC.fmt.int(p.cabecas)} ${FC.CATEGORIAS_GADO[p.categoria]}`}
        detalhe={[p.lote ? "lote " + p.lote : "", p.fazenda, p.observacao].filter(Boolean).join(" · ") || " "}
        valores={<Valores dinheiro={false} b={`${FC.fmt.num(p.peso_medio_kg, 1)} kg`} small={`${FC.fmt.num(FC.agro.arrobas(p.peso_medio_kg, FC.estado.dados.agro.rendimento), 1)} @`} />} />
    )) : <Vazio icone="⚖️" titulo="Nenhuma pesagem" texto="Pese os lotes de tempos em tempos: o valor do rebanho fica mais preciso e o painel calcula o ganho de peso diário." />;
  }
  return (
    <Secao>
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: t.espaco.e2, marginBottom: t.espaco.e3, alignItems: "center" }}>
        <Segmentado valor={aba} aoMudar={(v) => { mem.aba = v; setAba(v); }} rotuloA11y="Histórico"
          opcoes={[{ v: "movs", rotulo: `Movimentos · ${ag.movs.length}` }, { v: "custos", rotulo: `Custos · ${ag.custos.length}` }, { v: "pes", rotulo: `Pesagens · ${ag.pesagens.length}` }]} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2 }}>
          <View style={{ minWidth: 190 }}><Seletor compacto valor={filtro.categoria} aoMudar={(v) => mudaF("categoria", v)} rotuloA11y="Categoria" opcoes={[{ v: "", rotulo: "Todas as categorias" }, ...opcoesCat()]} /></View>
          {fazendas.length > 1 ? <View style={{ minWidth: 170 }}><Seletor compacto valor={filtro.fazenda} aoMudar={(v) => mudaF("fazenda", v)} rotuloA11y="Fazenda" opcoes={[{ v: "", rotulo: "Todas as fazendas" }, ...fazendas.map((x) => ({ v: x, rotulo: x }))]} /></View> : null}
          {anos.length > 1 ? <View style={{ minWidth: 150 }}><Seletor compacto valor={filtro.ano} aoMudar={(v) => mudaF("ano", v)} rotuloA11y="Ano" opcoes={[{ v: "", rotulo: "Todos os anos" }, ...anos.map((x) => ({ v: x, rotulo: x }))]} /></View> : null}
        </View>
      </View>
      <Lista>{corpo}</Lista>
    </Secao>
  );
}

// ---------------------------------------------------------------- tela
export default function Agro() {
  const t = useTema();
  const e = useEstado();
  const { estreito } = useMedidas();
  if (!e.dados || !e.prefs) return <Pagina>{null}</Pagina>;
  const ag = e.dados.agro;
  const cfg = e.prefs.agro;
  const fin = ag.financeiro;
  const custosCat = Object.entries<number>(fin.custos_por_categoria).sort((a, b) => b[1] - a[1]);
  const maxCusto = custosCat.length ? custosCat[0][1] : 1;
  const fazendas = Object.entries<any>(ag.porFazenda).map(([f, cats]) => [f, Object.values<number>(cats).reduce((s, n) => s + Math.max(0, n), 0)] as [string, number]).filter(([, n]) => n > 0);
  const tam = estreito ? 38 : 56;
  const sub = (txt: string) => <T style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: 1 }}>{txt}</T>;
  return (
    <Pagina>
      <Cabecalho titulo="Agronegócio" sub="Seu rebanho como investimento: movimentos, custos, pesagens e resultado."
        direita={<><Botao variante="sec" icone="moeda" onPress={formCotacao}>Cotação</Botao><Botao icone="aportes" onPress={escolher}>Lançamento</Botao></>} />
      {ag.ajustes.some((x: any) => x.ignorado) ? <Mensagem tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e4 }}>{`Mudança de categoria maior que o rebanho da categoria — só o que existia mudou: ${ag.ajustes.filter((x: any) => x.ignorado).map((x: any) => `${FC.datas.br(x.data)}, ${x.cabecas} ${FC.CATEGORIAS_GADO[x.de].toLowerCase()} a mais do que havia`).join("; ")}. Confira o lançamento.`}</Mensagem> : null}
      {ag.ajustes.some((x: any) => !x.ignorado) ? <Mensagem tipo="info" icone="info" style={{ marginBottom: t.espaco.e4 }}>{`O gado muda de categoria sem lançamento: ${ag.ajustes.filter((x: any) => !x.ignorado).map((x: any) => `${FC.datas.br(x.data)}, ${x.cabecas} ${FC.CATEGORIAS_GADO[x.de].toLowerCase()} saíram como ${FC.CATEGORIAS_GADO[x.para].toLowerCase()} (${FC.TIPOS_MOV[x.tipo].nome.toLowerCase()})`).join("; ")}.`}</Mensagem> : null}
      {ag.inconsistentes.length ? <Mensagem tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e4 }}><T style={{ fontSize: 14 }}>Saíram mais cabeças do que entraram em: <B>{ag.inconsistentes.map((c: string) => FC.CATEGORIAS_GADO[c]).join(", ")}</B>. Se o gado já existia antes de você começar a registrar, lance o estoque inicial com “Outra entrada”.</T></Mensagem> : null}

      <Cartao style={{ paddingTop: estreito ? 24 : 48, paddingHorizontal: estreito ? 24 : 48, paddingBottom: 24 }}>
        <T style={{ fontSize: 15, color: t.cores.ink2 }}>Rebanho</T>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6, marginBottom: 16 }}>
          <Conta valor={ag.total} modo="int" style={{ fontSize: tam, lineHeight: tam * 1.08, fontWeight: "600", letterSpacing: -tam * 0.035 }} />
          <T style={{ fontSize: tam * 0.45, color: t.cores.ink2, fontWeight: "500" }}>cabeças</T>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2 }}>
          <Chip><Text style={{ fontSize: 13, color: t.cores.ink2 }}>{ag.pelo_custo ? "Valor pago" : "Valor estimado"} </Text><Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(ag.valorRebanho, 0)}</Rs></Chip>
          <Chip onPress={formCotacao} icone={undefined}>
            <Text style={{ fontSize: 13, color: t.cores.ink2 }}>{ag.pelo_custo ? "pelo custo até vender" : <>@ <Text style={{ fontWeight: "600", color: t.cores.ink }}>{FC.fmt.brlTexto(cfg.preco_arroba)}</Text>{cfg.data_cotacao ? " em " + FC.datas.br(cfg.data_cotacao) : ""}</>} </Text>
            <Icone nome="editar" tam={13} cor={t.cores.ink2} />
          </Chip>
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
                <Kpi rotulo="Rebanho hoje" valor={FC.fmt.brlTexto(ag.valorRebanho, 0)} dinheiro peq={ag.pelo_custo ? "pelo que você pagou" : "estimado pela arroba"} />
                <Kpi rotulo="Resultado" ajuda="Recebido em vendas + valor estimado do rebanho − tudo o que foi investido. É o ganho econômico, mesmo sem ter vendido tudo."
                  valor={<KpiValor dinheiro cls={fin.resultado >= 0 ? "pos" : "neg"}>{FC.fmt.brlTexto(fin.resultado, 0)}</KpiValor>}
                  peq={ok(fin.retorno_pct) ? `${FC.fmt.delta(fin.retorno_pct)}% sobre o capital aportado` : undefined} />
              </Kpis>
              <Separador />
              <Kpis>
                {fin.caixa_agro > 0.5 ? <Kpi pequeno rotulo="Caixa do agro" ajuda="Dinheiro de vendas que você escolheu reinvestir e que ainda não virou gado. Conta no patrimônio e paga as próximas compras sem virar aporte." valor={FC.fmt.brlTexto(fin.caixa_agro, 0)} dinheiro /> : null}
                <Kpi pequeno rotulo="Aporte novo" ajuda="O que saiu do seu bolso para o agro, além do que as próprias vendas pagaram. É o que conta como aporte na carteira e no plano do mês."
                  valor={FC.fmt.brlTexto(fin.aportado, 0)} dinheiro peq={fin.sacado > 0.5 ? <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`${FC.fmt.brlTexto(fin.sacado, 0)} sacados`}</Rs> : undefined} />
                <Kpi pequeno rotulo="Caixa líquido" ajuda="Só o dinheiro que já entrou menos o que já saiu. Fica negativo enquanto o rebanho está em formação."
                  valor={FC.fmt.brlTexto(fin.caixa_liquido, 0)} dinheiro cls={fin.caixa_liquido >= 0 ? "pos" : "neg"} />
                {ok(fin.preco_medio_arroba_venda) ? <Kpi pequeno rotulo="Preço médio da @ vendida" valor={FC.fmt.brlTexto(fin.preco_medio_arroba_venda)} dinheiro /> : null}
                {ok(fin.custo_medio_cabeca_compra) ? <Kpi pequeno rotulo="Custo médio por cabeça comprada" valor={FC.fmt.brlTexto(fin.custo_medio_cabeca_compra, 0)} dinheiro /> : null}
                <Kpi pequeno rotulo="Nascimentos" valor={FC.fmt.int(fin.nascimentos)} />
                <Kpi pequeno rotulo="Mortes" valor={FC.fmt.int(fin.mortes)} peq={ok(fin.mortalidade_pct) ? `${FC.fmt.num(fin.mortalidade_pct, 1)}% do que entrou` : undefined} />
              </Kpis>
            </Cartao>
          </Secao>

          {ag.porCategoria.length ? (
            <Secao titulo="Rebanho por categoria" sub={`cabeças, peso e ${ag.pelo_custo ? "valor pago" : "valor estimado"}`}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
                {ag.porCategoria.map((c: any) => (
                  <View key={c.nome} style={{ flexBasis: 150, flexGrow: 1 }}>
                    <Cartao style={{ paddingVertical: t.espaco.e3, paddingHorizontal: t.espaco.e4 }}>
                      <T style={{ fontSize: 13, color: t.cores.ink2 }}>{c.nome}</T>
                      <Num style={{ fontSize: 30, fontWeight: "600", letterSpacing: -0.9 }}>{FC.fmt.int(c.cabecas)}</Num>
                      <T style={{ fontSize: 12, color: t.cores.ink3 }}>{FC.fmt.num(c.kg, 0)} kg · {FC.fmt.num(c.arrobas_cabeca, 1)} @/cab</T>
                      <T style={{ fontSize: 12, color: t.cores.ink3 }}>peso {c.fonte_peso === "pesagem" ? "da pesagem de " + FC.datas.br(c.data_peso) : c.fonte_peso === "movimento" ? "do último lançamento" : "típico (sem pesagem)"}</T>
                      <Rs style={{ marginTop: 8, fontWeight: "600" }}>{FC.fmt.brlTexto(c.valor, 0)}</Rs>
                      <T style={{ fontSize: 12, color: t.cores.ink3 }}>{c.pelo_custo ? "pelo que você pagou" : c.por_cabeca ? "valor fixo por cabeça" : FC.fmt.brlTexto(c.preco_arroba) + "/@"}</T>
                    </Cartao>
                  </View>
                ))}
              </View>
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
}
