/* Agro: os formulários de lançamento (movimento, custo, pesagem) e da
 * cotação. O peso é opcional: quem não pesa o gado lança por cabeça e o
 * peso fica em "Mais detalhes"; quem já lançou algum peso vê como antes. */
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTema } from "../../tema";
import { Ajuda, B, Cartao, Detalhes, Item, Kpi, Kpis, Lista, Mensagem, Rs, T } from "../../ui/kit";
import { Caixinha, Campo, CampoData, Entrada, Form, LinhaCampos, Segmentado, Seletor } from "../../ui/campos";
import { Icone, type NomeIcone } from "../../ui/icone";
import { folhaForm, ui } from "../../ui/folha";
import { depoisDeMudar } from "../comum/dados";
import FC from "../../nucleo";

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

// os quatro do dia a dia em destaque; o resto numa lista
const ATALHOS = ["custo", "compra", "venda", "nascimento"];

// fazenda, lote e categoria do último lançamento viram o padrão do próximo
const CHAVE_ULTIMO = "agro_ultimo";
type Ultimo = { fazenda?: string | null; lote?: string | null; categoria?: string | null };
const ultimo = (): Ultimo => FC.local.ler(CHAVE_ULTIMO, {}) || {};
const lembra = (u: Ultimo) => FC.local.gravar(CHAVE_ULTIMO, { ...ultimo(), ...u });
const usaPeso = () => !!(FC.estado.dados && FC.estado.dados.agro && FC.estado.dados.agro.usa_peso);
export interface OpcoesForm { copia?: boolean; padrao?: Record<string, any> }

export const opcoesCat = () => Object.entries<string>(FC.CATEGORIAS_GADO).map(([k, v]) => ({ v: k, rotulo: v }));
export const unicos = (arr: any[]) => [...new Set(arr.filter(Boolean))].sort() as string[];
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
const abreTipo = (id: string) => (id === "custo" ? formCusto() : id === "pesagem" ? formPesagem() : formMovimento(id));
export function escolher() {
  ui.folha({
    titulo: "Novo lançamento",
    corpo: (api) => <Escolha fechar={api.fechar} />,
  });
}
function Escolha({ fechar }: { fechar: () => void }) {
  const t = useTema();
  const vai = (id: string) => { fechar(); setTimeout(() => abreTipo(id), 230); };
  const atalhos = ATALHOS.map((id) => LANCAMENTOS.find((l) => l.id === id)!);
  const outros = LANCAMENTOS.filter((l) => !ATALHOS.includes(l.id));
  return (
    <View style={{ gap: t.espaco.e4 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
        {atalhos.map((l) => (
          <View key={l.id} style={{ flexBasis: 140, flexGrow: 1 }}>
            <Cartao onPress={() => vai(l.id)} style={{ padding: 16, flexGrow: 1 }}>
              <Icone nome={l.icone} tam={26} cor={(t.cores as any)[l.cor]} />
              <T style={{ fontWeight: "600", fontSize: 16, marginTop: 8 }}>{l.nome}</T>
              <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{l.desc}</T>
            </Cartao>
          </View>
        ))}
      </View>
      <View>
        <T v="rot" style={{ marginBottom: t.espaco.e2 }}>Outros</T>
        <Lista>
          {outros.map((l) => (
            <Item key={l.id} chevron onPress={() => vai(l.id)} esquerda={<Icone nome={l.icone} tam={20} cor={(t.cores as any)[l.cor]} />}
              titulo={l.nome} detalhe={l.desc} />
          ))}
        </Lista>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- movimento
function FormMovimento({ tipo, item, novo, defineSalvar, api }: { tipo: string; item: any; novo: boolean; defineSalvar: (fn: () => any) => void; api: any }) {
  const t = useTema();
  const cfg = FC.estado.prefs.agro;
  const comPreco = ["compra", "venda"].includes(tipo);
  const comValor = comPreco || ["entrada", "saida"].includes(tipo);
  const peso1 = usaPeso();
  const modoInicial = item.preco_arroba ? "arroba" : item.preco_cabeca ? "cabeca" : item.valor_total ? "total" : peso1 ? "arroba" : "cabeca";
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
    // sem peso digitado vale o valor de uma cabeça hoje (cotação por cabeça,
    // suas operações ou peso típico, nessa ordem)
    const hoje = (FC.estado.dados.agro.valor_cabeca_hoje || {})[cat];
    const unit = p ? FC.agro.valorCabeca(cat, p, cfg) : hoje ? hoje.valor : FC.agro.valorCabeca(cat, FC.PESO_TIPICO[cat], cfg);
    return Math.round((c || 0) * unit * 100) / 100;
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
      lembra({ fazenda: linha.fazenda, lote: linha.lote, ...(tipo === "nascimento" ? {} : { categoria: linha.categoria }) });
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
  // o peso fica à vista para quem pesa o gado ou quando o preço é por @ (aí é obrigatório)
  const pesoNaFrente = peso1 || modo === "arroba" && comValor;
  const dicaArroba = peso ? `${FC.fmt.num(FC.agro.arrobas(peso, rend), 1)} @ por cabeça (rendimento ${FC.fmt.num(rend, 0)}%)` : undefined;
  // edição com detalhe preenchido: "Mais detalhes" já aberto
  const temDetalhe = !novo && !!(item.fazenda || item.lote || item.contraparte || item.observacao || item.despesas || (!pesoNaFrente && item.peso_medio_kg));
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
      {tipo === "reclassificacao" ? <LinhaCampos>{campoCab}{pesoNaFrente ? campoPeso() : <View />}</LinhaCampos> : (
        <LinhaCampos>
          {comValor ? (
            <Campo rotulo="Como o preço foi fechado">
              <Segmentado valor={modo} aoMudar={setModo} rotuloA11y="Como o preço foi fechado"
                opcoes={[{ v: "cabeca", rotulo: "Por cabeça" }, { v: "arroba", rotulo: "Por @" }, { v: "total", rotulo: "Total" }]} />
            </Campo>
          ) : pesoNaFrente ? campoPeso(dicaArroba) : null}
          {comValor && pesoNaFrente ? campoPeso(dicaArroba) : null}
        </LinhaCampos>
      )}
      {comValor ? (
        <>
          <LinhaCampos n={3}>
            {modo === "arroba" ? <Campo rotulo="Preço da @ (R$)"><Entrada valor={parrTxt} aoMudar={setParr} decimal accessibilityLabel="Preço da arroba" /></Campo> : null}
            {modo === "cabeca" ? <Campo rotulo="Preço por cabeça (R$)"><Entrada valor={pcabTxt} aoMudar={setPcab} decimal accessibilityLabel="Preço por cabeça" /></Campo> : null}
            {modo === "total" ? <Campo rotulo="Valor total (R$)"><Entrada valor={totTxt} aoMudar={setTot} decimal accessibilityLabel="Valor total" /></Campo> : null}
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
              <View style={{ height: "100%", width: `${liquido > 0 ? (re / liquido) * 100 : 0}%` as any, backgroundColor: t.cores.s5, borderRadius: 99 }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: 6, columnGap: 16 }}>
              <T style={{ fontSize: 14 }}><Text style={{ color: t.cores.s5 }}>● </Text>Fica no gado <Rs style={{ fontSize: 14, fontWeight: "600" }}>{FC.fmt.brlTexto(re)}</Rs></T>
              <T style={{ fontSize: 14 }}><Text style={{ color: t.cores.ink3 }}>● </Text>Saque <Rs style={{ fontSize: 14, fontWeight: "600" }}>{FC.fmt.brlTexto(sq)}</Rs></T>
            </View>
            <T v="p" style={{ marginTop: t.espaco.e2 }}>{re > 0 ? "O reinvestido paga as próximas compras sem contar como aporte — é crescimento da atividade." : "Tudo sai do agro e da carteira, como um resgate."}</T>
          </View>
        </View>
      ) : null}
      <Detalhes rotulo="Mais detalhes" inicial={temDetalhe}>
        <View style={{ gap: t.espaco.e3 }}>
          <LinhaCampos>
            {!pesoNaFrente ? campoPeso("opcional: só se você pesou") : null}
            {comPreco ? <Campo rotulo="Despesas da operação (R$)"><Entrada valor={despTxt} aoMudar={setDesp} decimal placeholder="frete, comissão, Funrural" accessibilityLabel="Despesas" /></Campo> : null}
          </LinhaCampos>
          <LinhaCampos n={3}>
            <Campo rotulo="Fazenda"><EntradaSugerida valor={faz} aoMudar={setFaz} opcoes={sug.faz} maxLength={60} accessibilityLabel="Fazenda" /></Campo>
            <Campo rotulo="Lote"><EntradaSugerida valor={lote} aoMudar={setLote} opcoes={sug.lotes} maxLength={40} accessibilityLabel="Lote" /></Campo>
            {comPreco ? <Campo rotulo={tipo === "compra" ? "Vendedor" : "Comprador"}><EntradaSugerida valor={contra} aoMudar={setContra} opcoes={sug.contra} maxLength={80} accessibilityLabel="Contraparte" /></Campo> : null}
          </LinhaCampos>
          <Campo rotulo="Observação"><Entrada valor={obs} aoMudar={setObs} maxLength={240} autoCapitalize="sentences" accessibilityLabel="Observação" /></Campo>
        </View>
      </Detalhes>
      {aviso}
    </Form>
  );
}

export function formMovimento(tipo: string, item?: any, op: OpcoesForm = {}) {
  // "Repetir": o lançamento vira um novo, com a data de hoje
  const novo = !item || !!op.copia;
  const u = ultimo();
  const base = { tipo, data: FC.datas.hoje(), categoria: tipo === "nascimento" ? "bezerro" : u.categoria || "boi_magro", cabecas: "", fazenda: u.fazenda || "", lote: u.lote || "" };
  const it = !item ? { ...base, ...(op.padrao || {}) } : op.copia ? { ...item, id: undefined, data: FC.datas.hoje() } : item;
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
      lembra({ fazenda: linha.fazenda, lote: linha.lote });
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
      <Detalhes rotulo="Fazenda e lote" inicial={!novo && !!(item.fazenda || item.lote)}>
        <LinhaCampos>
          <Campo rotulo="Fazenda"><EntradaSugerida valor={faz} aoMudar={setFaz} opcoes={sug.faz} accessibilityLabel="Fazenda" /></Campo>
          <Campo rotulo="Lote"><EntradaSugerida valor={lote} aoMudar={setLote} opcoes={sug.lotes} accessibilityLabel="Lote" /></Campo>
        </LinhaCampos>
      </Detalhes>
    </Form>
  );
}
export function formCusto(item?: any, op: OpcoesForm = {}) {
  const novo = !item || !!op.copia;
  const u = ultimo();
  const it = !item ? { data: FC.datas.hoje(), categoria: "nutricao", fazenda: u.fazenda || "", lote: u.lote || "" } : op.copia ? { ...item, id: undefined, data: FC.datas.hoje() } : item;
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
      lembra({ fazenda: linha.fazenda, lote: linha.lote, categoria: linha.categoria });
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
export function formPesagem(item?: any, op: OpcoesForm = {}) {
  const novo = !item || !!op.copia;
  const u = ultimo();
  const it = !item ? { data: FC.datas.hoje(), categoria: u.categoria || "boi_magro", fazenda: u.fazenda || "", lote: u.lote || "", ...(op.padrao || {}) } : op.copia ? { ...item, id: undefined, data: FC.datas.hoje() } : item;
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
  const t = useTema();
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
  const comPeso = usaPeso();
  const rebanho = (FC.estado.dados && FC.estado.dados.agro && FC.estado.dados.agro.rebanho) || {};
  // as categorias que você tem vêm primeiro
  const cats = Object.entries<string>(FC.CATEGORIAS_GADO).sort((a, b) => Number((rebanho[b[0]] || 0) > 0) - Number((rebanho[a[0]] || 0) > 0));
  const hojeCat = (FC.estado.dados && FC.estado.dados.agro && FC.estado.dados.agro.valor_cabeca_hoje) || {};
  const porCabeca = (
    <Lista style={{ boxShadow: "none" } as any}>
      {cats.map(([k, v]) => {
        const h = hojeCat[k];
        const dica = h && h.origem === "operacoes" ? `suas operações: ${FC.fmt.brlTexto(h.valor, 0)}` : undefined;
        return (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 16, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 110 }}>
              <T style={{ fontSize: 14, fontWeight: "600" }}>{v}</T>
              {(rebanho[k] || 0) > 0 ? <T style={{ fontSize: 12, color: t.cores.ink3 }}>{`${FC.fmt.int(rebanho[k])} no rebanho${dica ? " · " + dica : ""}`}</T> : null}
            </View>
            {comPeso ? <Entrada compacto valor={porArr[k] || ""} aoMudar={(x) => setPorArr({ ...porArr, [k]: x })} decimal placeholder="R$/@" style={{ width: 120 }} accessibilityLabel={`Preço da arroba de ${v}`} /> : null}
            <Entrada compacto valor={porCab[k] || ""} aoMudar={(x) => setPorCab({ ...porCab, [k]: x })} decimal placeholder={h && h.origem === "operacoes" ? FC.fmt.num(h.valor, 0) : "R$/cabeça"} style={{ width: 140 }} accessibilityLabel={`Valor por cabeça de ${v}`} />
          </View>
        );
      })}
    </Lista>
  );
  const arroba = (
    <LinhaCampos n={2}>
      <Campo rotulo="Preço da @ do boi (R$)"><Entrada valor={arr} aoMudar={setArr} decimal accessibilityLabel="Preço da arroba" /></Campo>
      <Campo rotulo="Rendimento de carcaça (%)"><Entrada valor={rend} aoMudar={setRend} decimal accessibilityLabel="Rendimento de carcaça" /></Campo>
    </LinhaCampos>
  );
  return (
    <Form>
      <Caixinha valor={custo} aoMudar={setCusto} rotulo={
        <View style={{ flex: 1 }}>
          <B>Avaliar pelo que paguei até vender</B>
          <T v="p">O rebanho vale o custo das cabeças no pasto e o ganho só aparece quando você lança a venda. A cotação abaixo não é usada.</T>
        </View>} />
      <Campo rotulo="Data da cotação" dica="o painel avisa quando passar de 30 dias"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data da cotação" /></Campo>
      {comPeso ? (
        <>
          <T v="p">O valor do rebanho é estimado por: cabeças × peso vivo × rendimento de carcaça ÷ 15 × preço da arroba. Atualize o preço com a cotação da sua praça (CEPEA, Scot, frigorífico).</T>
          {arroba}
          <T style={{ fontSize: 15, fontWeight: "600", marginTop: 8 }}>Por categoria (opcional)</T>
          <T v="p">Preencha o preço da @ ou um valor fixo por cabeça: o que estiver preenchido vale no lugar do padrão.</T>
          {porCabeca}
        </>
      ) : (
        <>
          <T style={{ fontSize: 15, fontWeight: "600", marginTop: 8 }}>Quanto vale uma cabeça hoje</T>
          <T v="p">Em branco, a categoria vale pelo preço médio das suas últimas compras e vendas dela.</T>
          {porCabeca}
          <Detalhes rotulo="Avaliar pela arroba (para quem pesa o gado)">
            <View style={{ gap: 12 }}>
              <T v="p">Sem peso lançado, o painel usa um peso típico de cada categoria: é uma estimativa grosseira.</T>
              {arroba}
            </View>
          </Detalhes>
        </>
      )}
    </Form>
  );
}
export function formCotacao() {
  folhaForm({ titulo: "Cotação e avaliação do rebanho", corpo: (api, d) => <FormCotacao defineSalvar={d} api={api} /> });
}

