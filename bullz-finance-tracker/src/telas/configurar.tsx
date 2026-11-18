/* Configuração do primeiro acesso (Marco 14): nove passos que gravam a
 * configuração real (ganhos, objetivos, potes, hierarquia, agro, plano do
 * mês, alertas). Cada passo pode ser pulado; sair e voltar retoma no mesmo
 * passo (FC.configuracao + onboarding_estado). */
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { Pagina } from "../casca/casca";
import { Botao, Cabecalho, Cartao, Composicao, Item, Lista, Mensagem, Rs, T, Trilha } from "../ui/kit";
import { Campo, Caixinha, Entrada, Form, LinhaCampos, Segmentado } from "../ui/campos";
import { ui } from "../ui/folha";
import { depoisDeMudar } from "./comum/dados";
import FC from "../nucleo";

type Props = { e: any; feito: () => Promise<void> };
const num = (s: string) => FC.lerNum(s) || 0;
const COR: Record<string, string> = { rf: "var(--s2)", acoes: "var(--s1)", cripto: "var(--s4)" };

// estado do onboarding compartilhado entre telas (Início lê para o checklist)
let ESTADO: any = null;
export async function estadoConfiguracao(recarregar = false) {
  if (!ESTADO || recarregar) ESTADO = await FC.configuracao.carrega(FC.estado.base);
  return ESTADO;
}
async function grava(e: any) { ESTADO = e; await FC.configuracao.salva(e); }

// ---------------------------------------------------------------- passos
function BoasVindas() {
  const t = useTema();
  if (Platform.OS !== "web") return <T v="p">Bem-vindo ao Bullz. Em poucos passos o seu mês fica configurado.</T>;
  return (
    <View style={{ gap: 12 }}>
      {React.createElement("video", { src: "/video/tour.mp4", poster: "/video/tour-poster.webp", controls: true, muted: true, playsInline: true, preload: "none",
        style: { width: "100%", borderRadius: 12, background: "#000", aspectRatio: "16 / 9" } },
        React.createElement("track", { kind: "captions", srcLang: "pt-BR", src: "/video/tour.vtt", default: true }))}
      <T style={{ fontSize: 13, color: t.cores.ink2 }}>Quarenta segundos. Pode pular.</T>
    </View>
  );
}

function Perfil({ e, feito }: Props) {
  const prem = (e.base.prefsBrutas || {}).premissas || {};
  const [perfil, setPerfil] = useState<string>((prem.perfil_simples || {}).perfil || "moderado");
  const [horizonte, setHorizonte] = useState(String((prem.perfil_simples || {}).horizonte_anos || 10));
  const salvar = async () => {
    await FC.db.gravaPrefs({ premissas: { ...prem, perfil_simples: { perfil, horizonte_anos: num(horizonte) }, horizonte_anos: num(horizonte) || 10 } });
    await feito();
  };
  return (
    <Form>
      <Campo rotulo="Como você lida com risco?"><Segmentado valor={perfil} aoMudar={setPerfil} rotuloA11y="Perfil"
        opcoes={[{ v: "conservador", rotulo: "Conservador" }, { v: "moderado", rotulo: "Moderado" }, { v: "arrojado", rotulo: "Arrojado" }]} /></Campo>
      <Campo rotulo="Por quantos anos você pretende investir?"><Entrada valor={horizonte} aoMudar={setHorizonte} decimal accessibilityLabel="Horizonte em anos" /></Campo>
      <Botao onPress={salvar}>Salvar e continuar</Botao>
    </Form>
  );
}

function Renda({ feito }: Props) {
  const hoje = FC.datas.hoje();
  const [tipo, setTipo] = useState<string>("salario");
  const [salario, setSalario] = useState(""), [pj, setPj] = useState(""), [regime, setRegime] = useState<string>("mei"), [das, setDas] = useState("");
  const [outra, setOutra] = useState(""), [inicio, setInicio] = useState(hoje.slice(0, 8) + "01"), [fim, setFim] = useState("");
  const salvar = async () => {
    const base = { tipo: "recorrente", inicio, fim: fim || null, observacao: "" };
    const linhas: any[] = [];
    if ((tipo === "salario" || tipo === "ambos") && num(salario) > 0) linhas.push({ ...base, nome: "Salário", categoria: "salario", valor: num(salario) });
    if ((tipo === "pj" || tipo === "ambos") && num(pj) > 0) linhas.push({ ...base, nome: "PJ", categoria: "pj", valor: num(pj), regime, ...(num(das) > 0 ? { imposto_fixo_mensal: num(das) } : {}) });
    if (num(outra) > 0) linhas.push({ ...base, nome: "Outra renda", categoria: "aluguel", valor: num(outra) });
    if (!linhas.length) { ui.aviso("Informe ao menos um valor, ou pule este passo.", "erro"); return; }
    for (const l of linhas) await FC.db.inserir("ganhos", l);
    await feito();
  };
  return (
    <Form>
      <Campo rotulo="De onde vem a sua renda?"><Segmentado valor={tipo} aoMudar={setTipo} rotuloA11y="Tipo de renda"
        opcoes={[{ v: "salario", rotulo: "Salário" }, { v: "pj", rotulo: "PJ" }, { v: "ambos", rotulo: "Os dois" }]} /></Campo>
      {tipo !== "pj" ? <Campo rotulo="Salário líquido por mês (R$)"><Entrada valor={salario} aoMudar={setSalario} decimal accessibilityLabel="Salário" /></Campo> : null}
      {tipo !== "salario" ? (
        <LinhaCampos>
          <Campo rotulo="Faturamento PJ por mês (R$)"><Entrada valor={pj} aoMudar={setPj} decimal accessibilityLabel="Faturamento PJ" /></Campo>
          <Campo rotulo="Regime"><Segmentado valor={regime} aoMudar={setRegime} rotuloA11y="Regime" opcoes={[{ v: "mei", rotulo: "MEI" }, { v: "simples", rotulo: "Simples" }, { v: "outro", rotulo: "Outro" }]} /></Campo>
        </LinhaCampos>
      ) : null}
      {tipo !== "salario" ? <Campo rotulo="DAS ou imposto fixo por mês (R$)" dica="Vazio: o Bullz usa o DAS vigente dos parâmetros fiscais."><Entrada valor={das} aoMudar={setDas} decimal accessibilityLabel="DAS" /></Campo> : null}
      <Campo rotulo="Outra renda por mês, como aluguel (R$)"><Entrada valor={outra} aoMudar={setOutra} decimal accessibilityLabel="Outra renda" /></Campo>
      <LinhaCampos>
        <Campo rotulo="Começa em (AAAA-MM-DD)"><Entrada valor={inicio} aoMudar={setInicio} accessibilityLabel="Início" /></Campo>
        <Campo rotulo="Termina em (opcional)"><Entrada valor={fim} aoMudar={setFim} accessibilityLabel="Fim" /></Campo>
      </LinhaCampos>
      <Botao onPress={salvar}>Salvar e continuar</Botao>
    </Form>
  );
}

function Reserva({ e, feito }: Props) {
  const obj = FC.objetivos(e.prefs);
  const sugerido = FC.configuracao.reservaSugerida(e.base, e.prefs);
  const [custo, setCusto] = useState(obj.custo_vida_mensal ? String(obj.custo_vida_mensal) : "");
  const [meses, setMeses] = useState(String(Math.max(Number(obj.meses_reserva) || 6, sugerido)));
  const salvar = async () => {
    if (!(num(custo) > 0)) { ui.aviso("Informe o custo de vida por mês.", "erro"); return; }
    const prem = (e.base.prefsBrutas || {}).premissas || {};
    await FC.db.gravaPrefs({ premissas: { ...prem, objetivos: { ...(prem.objetivos || {}), custo_vida_mensal: num(custo), meses_reserva: num(meses) || 6 } } });
    if (!(e.base.potes || []).length && FC.db.temTabela("potes")) for (const p of FC.potes.padroes()) await FC.db.inserir("potes", p);
    await feito();
  };
  return (
    <Form>
      <Campo rotulo="Quanto custa o seu mês (R$)?"><Entrada valor={custo} aoMudar={setCusto} decimal accessibilityLabel="Custo de vida" /></Campo>
      <Campo rotulo="Quantos meses de reserva?" dica={sugerido > 6 ? `Sugestão: ${sugerido} meses, porque a renda PJ não tem 13º, férias nem FGTS.` : "Seis meses é o mínimo recomendado."}>
        <Entrada valor={meses} aoMudar={setMeses} decimal accessibilityLabel="Meses de reserva" /></Campo>
      <T v="p">Ao salvar, o Bullz cria os potes: reserva de emergência, oportunidade, oportunidade do agro, IR a pagar e livre. O saldo de hoje começa no livre.</T>
      <Botao onPress={salvar}>Salvar e criar os potes</Botao>
    </Form>
  );
}

function Divisao({ e, feito }: Props) {
  const t = useTema();
  // a sugestão é a hierarquia; só volta para metas fixas se a pessoa já escolheu isso
  const [modo, setModo] = useState<string>(((e.base.prefsBrutas || {}).hierarquia || {}).modo_alocacao === "metas_fixas" ? "metas_fixas" : "hierarquia");
  const div = FC.hierarquia.divisaoSugerida({ reservaAbaixo: true, foraDaOrdem: false, faixas: e.prefs.hierarquia.faixas });
  const salvar = async () => { await FC.db.gravaPrefs({ hierarquia: { ...e.prefs.hierarquia, modo_alocacao: modo } }); await feito(); };
  return (
    <Form>
      <Segmentado valor={modo} aoMudar={setModo} rotuloA11y="Modo de alocação" opcoes={[{ v: "hierarquia", rotulo: "Hierarquia" }, { v: "metas_fixas", rotulo: "Metas fixas" }]} />
      {modo === "hierarquia" ? (
        <View style={{ gap: 8 }}>
          <T v="p">Renda fixa acima de ações, ações acima de cripto, cada um na sua faixa (RF 45–70%, Ações 22–38%, Cripto 5–17%). Prévia com a reserva ainda incompleta:</T>
          <Composicao partes={(["rf", "acoes", "cripto"] as const).map((g) => ({ valor: div[g], cor: COR[g] }))} />
          <T style={{ fontSize: 13, color: t.cores.ink2 }}>{`RF ${FC.fmt.num(div.rf, 0)}% · Ações ${FC.fmt.num(div.acoes, 0)}% · Cripto ${FC.fmt.num(div.cripto, 0)}%`}</T>
        </View>
      ) : <T v="p">Você define uma meta em % para cada pilar, em Ajustes. O Bullz mostra o desvio de cada um.</T>}
      <Botao onPress={salvar}>Salvar e continuar</Botao>
    </Form>
  );
}

function Contas({ feito }: Props) {
  return (
    <Form>
      <T v="p">O Bullz não pede senha de corretora. As operações entram pelos extratos que você baixa:</T>
      <Lista>
        <Item titulo="B3 · Área do Investidor" detalhe="Extratos → Negociação e Movimentação, em XLSX ou CSV." />
        <Item titulo="Binance" detalhe="Ordens → Histórico de transações, ou o histórico do Convert." />
        <Item titulo="C6 e PicPay" detalhe="O extrato de investimentos do app do banco." />
      </Lista>
      <T v="p">Importe em Aportes → Importar extrato. Dá para fazer agora ou depois.</T>
      <Botao onPress={feito}>Entendi</Botao>
    </Form>
  );
}

function Agro({ e, feito }: Props) {
  const ag = (e.base.prefsBrutas || {}).agro || {};
  const [tem, setTem] = useState<string>(ag.tem_pecuaria === false ? "nao" : "sim");
  const [peso, setPeso] = useState<boolean>(ag.usa_peso !== false);
  const [inclusos, setInclusos] = useState<boolean>(!!ag.custos_inclusos_padrao);
  const salvar = async () => {
    const mods = { ...((e.base.prefsBrutas || {}).modulos || {}), agro: tem === "sim" };
    await FC.db.gravaPrefs({ agro: { ...ag, tem_pecuaria: tem === "sim", usa_peso: tem === "sim" ? peso : null, custos_inclusos_padrao: inclusos }, modulos: mods });
    await feito();
  };
  return (
    <Form>
      <Campo rotulo="Você tem pecuária?"><Segmentado valor={tem} aoMudar={setTem} rotuloA11y="Tem pecuária" opcoes={[{ v: "sim", rotulo: "Tenho" }, { v: "nao", rotulo: "Não tenho" }]} /></Campo>
      {tem === "sim" ? <>
        <Caixinha valor={peso} aoMudar={setPeso} rotulo="Peso o gado (arroba e ganho de peso aparecem)" />
        <Caixinha valor={inclusos} aoMudar={setInclusos} rotulo="Frete e comissão já vêm no preço da compra" />
      </> : null}
      <Botao onPress={salvar}>Salvar e continuar</Botao>
    </Form>
  );
}

function Plano({ e, feito }: Props) {
  const t = useTema();
  const mes = FC.datas.hoje().slice(0, 7);
  const salvo = (e.base.planosMensais || []).find((p: any) => p.mes === mes);
  const r = salvo || FC.planoMensal.gera(e, mes);
  const criar = async (ativar: boolean) => {
    if (!FC.db.temTabela("planos_mensais")) { ui.aviso("O plano mensal ainda não está disponível nesta conta.", "erro"); await feito(); return; }
    const linha = salvo || (await FC.db.inserir("planos_mensais", r));
    if (ativar && linha.status === "rascunho") {
      const v = FC.planoMensal.validaDivisao(linha, e);
      await FC.db.atualizar("planos_mensais", linha.id, { status: "ativo", ativado_em: new Date().toISOString(), regras_snapshot: FC.planoMensal.snapshot(e, v, !v.ok) });
    }
    await feito();
  };
  return (
    <Form>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <T>Para investir em {FC.planoMensal.nomeMes(mes)}:</T><Rs style={{ fontSize: 24, fontWeight: "600" }}>{FC.fmt.brlTexto(r.meta_total)}</Rs>
      </View>
      {(r.renda_prevista || []).map((x: any, i: number) => <T key={i} style={{ fontSize: 13, color: t.cores.ink2 }}>{`${FC.fmt.brlTexto(x.valor)} = ${x.origem}`}</T>)}
      <T style={{ fontSize: 13, color: t.cores.ink2 }}>{`− impostos ${FC.fmt.brlTexto(r.impostos_previstos || 0)} · − despesas ${FC.fmt.brlTexto(r.despesas_previstas || 0)} (${r.despesas_origem || "premissa"})`}</T>
      <Composicao partes={(r.destinos || []).filter((d: any) => d.tipo === "categoria").map((d: any) => ({ valor: d.valor, cor: COR[d.alvo] || "var(--sref)" }))} />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Botao onPress={() => criar(true)}>Criar e ativar</Botao>
        <Botao variante="sec" onPress={() => criar(false)}>Deixar como rascunho</Botao>
      </View>
    </Form>
  );
}

function Alertas({ e, feito }: Props) {
  const sug = FC.alertasPreco.sugereEmpates(e.dados, e.base.alertasPreco || []);
  const [marcados, setMarcados] = useState<string[]>(sug.map((s: any) => s.ticker));
  const criar = async () => {
    if (FC.db.temTabela("alertas_preco")) for (const tk of marcados) await FC.db.inserir("alertas_preco", { ticker: tk, condicao: "empate", valor: null, ligado: true });
    await feito();
  };
  if (!sug.length) return <Form><T v="p">Nenhuma posição no prejuízo agora. Quando houver, dá para criar alertas de empate na tela de Alertas.</T><Botao onPress={feito}>Continuar</Botao></Form>;
  return (
    <Form>
      <T v="p">Estas posições estão abaixo do preço médio. O alerta avisa quando cada uma voltar a ele:</T>
      {sug.map((s: any) => (
        <Caixinha key={s.ticker} valor={marcados.includes(s.ticker)} aoMudar={(v) => setMarcados(v ? [...marcados, s.ticker] : marcados.filter((x) => x !== s.ticker))}
          rotulo={`${s.ticker}: hoje ${FC.fmt.brlTexto(s.preco)}, médio ${FC.fmt.brlTexto(s.preco_medio)} (falta ${FC.fmt.num(s.alta_necessaria_pct, 1)}%)`} />
      ))}
      <Botao onPress={criar}>Criar os alertas</Botao>
    </Form>
  );
}

const CORPO: Record<string, (p: Props) => React.ReactElement> = {
  boas_vindas: () => <BoasVindas />, perfil: (p) => <Perfil {...p} />, renda: (p) => <Renda {...p} />, reserva: (p) => <Reserva {...p} />,
  divisao: (p) => <Divisao {...p} />, contas: (p) => <Contas {...p} />, agro: (p) => <Agro {...p} />, plano: (p) => <Plano {...p} />, alertas: (p) => <Alertas {...p} />,
};

export default function Configurar() {
  const t = useTema();
  const e = useEstado();
  const [est, setEst] = useState<any>(ESTADO);
  useEffect(() => { if (e.base && !est) estadoConfiguracao().then(setEst); }, [e.base, est]);
  if (!e.base || !e.dados || !est) return <Pagina>{null}</Pagina>;
  const P = FC.configuracao.PASSOS;
  const i = Math.max(0, P.findIndex((p: any) => p.id === est.passo_atual));
  const passo = P[i];
  const anda = async (como: "feito" | "pulado") => {
    try {
      const novo = FC.configuracao.avanca(est, passo.id, como);
      await grava(novo);
      setEst(novo);
      if (como === "feito" && passo.id !== "boas_vindas" && passo.id !== "contas") await depoisDeMudar();
      if (novo.concluido) { ui.aviso("Configuração concluída. Os passos pulados ficam no Início."); router.replace("/inicio" as any); }
    } catch (err) { ui.erro(err); }
  };
  return (
    <Pagina>
      <Cabecalho titulo="Configurar o Bullz" sub={`Passo ${i + 1} de ${P.length}: ${passo.titulo}`} />
      <View style={{ marginBottom: 16 }}><Trilha pct={(i / P.length) * 100} /></View>
      <Cartao>
        <T v="h3" style={{ marginBottom: 6 }}>{passo.titulo}</T>
        <T style={{ color: t.cores.ink2, marginBottom: 16 }}>{passo.resumo}</T>
        {CORPO[passo.id]({ e, feito: () => anda("feito") })}
      </Cartao>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 8 }}>
        <Botao variante="texto" onPress={() => router.replace("/inicio" as any)}>Sair e continuar depois</Botao>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {passo.id === "boas_vindas" ? <Botao onPress={() => anda("feito")}>Começar</Botao> : null}
          <Botao variante="sec" onPress={() => anda("pulado")}>Pular este passo</Botao>
        </View>
      </View>
      {est.existente ? <Mensagem style={{ marginTop: 16 }}>Sua conta já existia: estes passos são opcionais.</Mensagem> : null}
    </Pagina>
  );
}

/** cartão do Início: o que falta configurar (passos pulados ou novidades) */
export function ChecklistConfiguracao() {
  const t = useTema();
  const e = useEstado();
  const [est, setEst] = useState<any>(ESTADO);
  useEffect(() => { if (e.base) estadoConfiguracao().then(setEst); }, [e.base]);
  if (!est || !e.base || FC.configuracao.precisaOnboarding(est)) return null;
  const c = FC.configuracao.checklist(est, e.base, e.prefs);
  if (c.completo) return null;
  const abre = async (id: string) => { const novo = { ...est, passo_atual: id, concluido: false, existente: est.existente }; await grava(novo); setEst(novo); router.push("/configurar" as any); };
  const dispensa = async (id: string) => { const novo = FC.configuracao.dispensa(est, id); await grava(novo); setEst(novo); };
  return (
    <Cartao style={{ marginBottom: 16 }}>
      <T v="h3">Complete a configuração</T>
      <T style={{ color: t.cores.ink2, marginTop: 4, marginBottom: 8 }}>{est.existente ? "Novidades do Bullz que ainda não estão ligadas na sua conta." : "Os passos que você pulou."}</T>
      <Lista style={{ boxShadow: "none" } as any}>
        {c.itens.map((x: any) => (
          <Item key={x.id} titulo={<T style={{ fontWeight: "600" }}>{x.titulo}</T>} detalhe={x.resumo}
            direita={<View style={{ flexDirection: "row", gap: 6 }}>
              <Botao pequeno onPress={() => abre(x.id)}>Configurar</Botao>
              <Botao pequeno variante="texto" onPress={() => dispensa(x.id)}>Dispensar</Botao>
            </View>} />
        ))}
      </Lista>
    </Cartao>
  );
}
