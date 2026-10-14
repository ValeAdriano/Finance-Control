/* Ajustes: conta e segurança, aparência, metas, regras e dados — port de
 * telas/ajustes.js. */
import React, { useEffect, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SvgXml } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import { corCss, useTema, usePrefTema } from "../tema";
import { useApp, useEstado, alternaPrivado, rerender } from "../estado/app";
import { Pagina } from "../casca/casca";
import { B, Botao, Cabecalho, Cartao, Codigo, Composicao, Detalhes, Item, Kpi, Kpis, Lista, Mensagem, Pilula, Roda, Rs, Secao, T, Vazio } from "../ui/kit";
import { Campo, Entrada, Form, Interruptor, Seletor, Segmentado } from "../ui/campos";
import { Icone, type NomeIcone } from "../ui/icone";
import { folhaForm, ui, type ApiFolha } from "../ui/folha";
import { depoisDeMudar, gravaPremissas } from "./comum/dados";
import FC from "../nucleo";

const ABAS = ["geral", "modulos", "criterios", "dados"];
const nomeFator = (f: any) => (f.friendly_name || "Autenticador").replace(/ \d{10,}$/, "").replace(/ [a-z0-9]{4}$/, "");

function IconeModulo({ nome, ano }: { nome: NomeIcone; ano?: boolean }) {
  const t = useTema();
  return (
    <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: ano ? "#2a1bff" : t.cores.acentoSuave }}>
      <Icone nome={nome} tam={18} cor={ano ? "#ffe14d" : t.cores.acento} />
    </View>
  );
}

// ---------------------------------------------------------------- senha
function FormSenha({ defineSalvar, api }: any) {
  const [atual, setAtual] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  defineSalvar(async () => {
    setErro(null);
    if (a !== b) return setErro("As senhas não coincidem.");
    if (a === atual) return setErro("A nova senha é igual à atual.");
    if (!(a.length >= 10 && /[a-z]/.test(a) && /[A-Z]/.test(a) && /\d/.test(a))) return setErro("Mínimo de 10 caracteres, com maiúscula, minúscula e número.");
    try {
      if (!(await FC.auth.confereSenha(FC.auth.usuario.email, atual))) throw new Error("A senha atual está incorreta.");
      const vazou = await FC.auth.senhaVazada(a);
      if (vazou) throw new Error(`Essa senha já apareceu em ${FC.fmt.int(vazou)} vazamento(s) de dados. Escolha outra.`);
      await FC.auth.trocarSenha(a);
      api.fechar(); ui.aviso("Senha trocada");
      FC.db.log("seguranca", { acao: "senha trocada" });
    } catch (err: any) { setErro(FC.ui.traduzErro(err.message)); }
  });
  return (
    <Form>
      <Campo rotulo="Senha atual"><Entrada valor={atual} aoMudar={setAtual} secureTextEntry autoComplete="current-password" accessibilityLabel="Senha atual" /></Campo>
      <Campo rotulo="Nova senha"><Entrada valor={a} aoMudar={setA} secureTextEntry autoComplete="new-password" accessibilityLabel="Nova senha" /></Campo>
      <Campo rotulo="Repita" dica="Mínimo de 10 caracteres, com maiúscula, minúscula e número."><Entrada valor={b} aoMudar={setB} secureTextEntry autoComplete="new-password" accessibilityLabel="Repita a senha" /></Campo>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Form>
  );
}
const trocaSenha = () => folhaForm({ titulo: "Trocar senha", salvar: "Trocar", corpo: (api, d) => <FormSenha defineSalvar={d} api={api} /> });

// ---------------------------------------------------------------- 2 etapas
const estiloCodigo = { letterSpacing: 12, textAlign: "center" as const, fontSize: 24, fontWeight: "600" as const };
function QrCode({ qr }: { qr: string }) {
  if (qr.startsWith("data:")) {
    if (Platform.OS === "web" || !qr.startsWith("data:image/svg")) return <Image source={{ uri: qr }} style={{ width: 180, height: 180 }} />;
    const svg = decodeURIComponent(qr.replace(/^data:image\/svg\+xml;?(utf8|charset=utf-8)?,/, ""));
    return <SvgXml xml={svg} width={180} height={180} />;
  }
  return <SvgXml xml={qr} width={180} height={180} />;
}
function FormMfa({ dados, jaTem, defineSalvar, api }: any) {
  const t = useTema();
  const [cod, setCod] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  defineSalvar(async () => {
    try {
      await FC.auth.verificarTotp(dados.id, cod);
      api.fechar();
      ui.aviso(jaTem ? "Autenticador reserva adicionado" : "Verificação em duas etapas ligada");
      FC.db.log("seguranca", { acao: jaTem ? "autenticador reserva adicionado" : "2FA ligado" });
      rerender();
    } catch (err: any) { setErro(/invalid/i.test(err.message) ? "Código incorreto. Confira o app e tente de novo." : FC.ui.traduzErro(err.message)); }
  });
  return (
    <Form>
      {jaTem ? <T v="p">Um segundo autenticador (outro celular, ou o gerenciador de senhas) garante o acesso se você perder o primeiro.</T> : null}
      <T v="p">1. Abra um app autenticador (Apple Senhas, Google Authenticator, 1Password, Authy) e escaneie o código.</T>
      <View style={{ alignItems: "center" }}><View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 10 }}><QrCode qr={dados.totp.qr_code} /></View></View>
      <T v="p" centro>ou digite a chave: <Text selectable style={{ fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), color: t.cores.ink }}>{dados.totp.secret}</Text></T>
      <T v="p">2. Digite o código de 6 dígitos que aparece no app.</T>
      <Entrada valor={cod} aoMudar={(v) => setCod(v.replace(/\D/g, ""))} maxLength={6} keyboardType="number-pad" textContentType="oneTimeCode" placeholder="000000" style={estiloCodigo} accessibilityLabel="Código" />
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Form>
  );
}
async function ligaMfa(jaTem = 0) {
  let dados: any;
  try { dados = await FC.auth.inscreverTotp(jaTem ? "Reserva" : "Principal"); } catch (e) { ui.erro(e); return; }
  let ativado = false;
  folhaForm({
    titulo: jaTem ? "Adicionar autenticador reserva" : "Ligar verificação em duas etapas", salvar: "Ativar",
    corpo: (api, d) => <FormMfa dados={dados} jaTem={jaTem} api={{ ...api, fechar: () => { ativado = true; api.fechar(); } }} defineSalvar={d} />,
    // fechou sem ativar: o fator pendente não pode ficar sobrando
    aoFechar: () => { if (!ativado) FC.auth.removerTotp(dados.id).catch(() => {}); },
  });
}
function FormRemoveFator({ fatores, id, defineSalvar, api }: any) {
  const ultimo = fatores.length === 1;
  const alvo = fatores.find((f: any) => f.id === id);
  const [conf, setConf] = useState(id);
  const [cod, setCod] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  defineSalvar(async () => {
    try {
      await FC.auth.verificarTotp(conf, cod);
      await FC.auth.removerTotp(id);
      api.fechar();
      ui.aviso(ultimo ? "Verificação em duas etapas desligada" : "Autenticador removido");
      FC.db.log("seguranca", { acao: ultimo ? "2FA desligado" : "autenticador removido" });
      rerender();
    } catch (err: any) { setErro(/invalid|code/i.test(err.message) ? "Código incorreto." : FC.ui.traduzErro(err.message)); }
  });
  return (
    <Form>
      <T v="p">{ultimo ? "Sem autenticador, o login volta a pedir só a senha e o banco deixa de exigir o código." : `Remover "${nomeFator(alvo)}". Os outros continuam valendo.`}</T>
      {fatores.length > 1 ? <Campo rotulo="Confirme com o código de"><Seletor valor={conf} aoMudar={setConf} rotuloA11y="Autenticador" opcoes={fatores.map((x: any) => ({ v: x.id, rotulo: nomeFator(x) }))} /></Campo> : null}
      <Campo rotulo="Código de 6 dígitos"><Entrada valor={cod} aoMudar={(v) => setCod(v.replace(/\D/g, ""))} maxLength={6} keyboardType="number-pad" placeholder="000000" style={estiloCodigo} accessibilityLabel="Código" /></Campo>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Form>
  );
}
// remover pede um código válido: quem só tem a sessão aberta não desliga o 2FA
const removeFator = (fatores: any[], id: string) => folhaForm({
  titulo: fatores.length === 1 ? "Desligar a verificação em duas etapas" : "Remover autenticador", salvar: fatores.length === 1 ? "Desligar" : "Remover",
  corpo: (api, d) => <FormRemoveFator fatores={fatores} id={id} defineSalvar={d} api={api} />,
});

// ---------------------------------------------------------------- apagar
function CorpoApaga({ api }: { api: ApiFolha }) {
  const t = useTema();
  const [txt, setTxt] = useState("");
  return (
    <Form>
      <Mensagem tipo="erro" icone="alerta">Isto apaga carteira, renda fixa, aportes, agro e preferências. Não dá para desfazer — baixe um backup antes.</Mensagem>
      <Campo rotulo={<>Digite <B>APAGAR</B> para confirmar</>}><Entrada valor={txt} aoMudar={setTxt} autoCapitalize="characters" accessibilityLabel="Confirmação" /></Campo>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: t.espaco.e2, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.cores.linha }}>
        <Botao variante="sec" onPress={api.fechar}>Cancelar</Botao>
        <Botao variante="perigo" desabilitado={txt.trim() !== "APAGAR"} onPress={async () => {
          try { await FC.db.apagaConta(); api.fechar(); await depoisDeMudar("Dados apagados"); } catch (e) { ui.erro(e); }
        }}>Apagar tudo</Botao>
      </View>
    </Form>
  );
}
const apagaTudo = () => ui.folha({ titulo: "Apagar todos os dados", corpo: (api) => <CorpoApaga api={api} /> });

// ---------------------------------------------------------------- histórico mensal
const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function lerHistorico(texto: string) {
  const linhas = FC.importador.csv(texto.trim());
  const tira = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const col = (l: any, nome: string) => l[Object.keys(l).find((k) => tira(k) === nome) as string];
  const saida: any[] = [];
  for (const l of linhas) {
    const ano = Number(col(l, "ano")), mesTxt = tira(col(l, "mes")), total = FC.lerNum(String(col(l, "total") || "").replace(/R\$/g, ""));
    const m = MESES.indexOf(mesTxt) + 1 || Number(mesTxt);
    if (!(ano > 1990 && m >= 1 && m <= 12 && total > 0)) continue;
    const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
    saida.push({ data: `${ano}-${String(m).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`, patrimonio: total });
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data));
}
function HistoricoMensal() {
  const t = useTema();
  const [csv, setCsv] = useState("");
  const l = csv.trim() ? lerHistorico(csv) : [];
  const importa = async () => {
    if (!l.length) { ui.aviso("Não encontrei meses com Ano, Mês e Total.", "erro"); return; }
    // não sobrescreve um dia que o próprio app registrou
    const doApp = new Set(FC.estado.base.historico.filter((h: any) => h.origem !== "importado").map((h: any) => h.data));
    const linhas = l.filter((x) => !doApp.has(x.data)).map((x) => ({ ...x, user_id: FC.auth.usuario.id, origem: "importado", por_pilar: { fonte: "importação" } }));
    try {
      const { error } = await FC.sb.from("patrimonio_historico").upsert(linhas, { onConflict: "user_id,data" });
      if (error) throw error;
      FC.db.log("importacao", { fonte: "CSV", meses: linhas.length });
      setCsv("");
      await depoisDeMudar(`${linhas.length} mês(es) importado(s)`);
    } catch (err) { ui.erro(err); }
  };
  return (
    <Cartao>
      <T v="p" style={{ marginBottom: t.espaco.e3 }}>Cole o CSV com as colunas <B>Ano</B>, <B>Mês</B> e <B>Total</B> (as outras são ignoradas). Cada mês com total vira um ponto no gráfico de crescimento, no último dia do mês. Meses já existentes são atualizados.</T>
      <Entrada valor={csv} aoMudar={setCsv} multiline numberOfLines={6} placeholder={"N°,Ano,Mês,Total,Fechado\n1,2024,Janeiro,800,false"} accessibilityLabel="CSV do histórico" />
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: t.espaco.e3, marginTop: t.espaco.e3 }}>
        <T style={{ color: t.cores.ink2, flexShrink: 1 }}>{l.length ? `${l.length} mês(es) com total, de ${FC.datas.br(l[0].data).slice(3)} a ${FC.datas.br(l.at(-1).data).slice(3)}` : ""}</T>
        <Botao onPress={importa}>Importar</Botao>
      </View>
    </Cartao>
  );
}

// ---------------------------------------------------------------- log
const EVENTOS: Record<string, [string, string]> = {
  registro_diario: ["Registro diário", "azul"], precos: ["Cotações atualizadas", "verde"], aporte: ["Aporte", "terra"],
  importacao: ["Histórico importado", "azul"], seguranca: ["Segurança", "amarelo"], erro: ["Erro", "vermelho"],
};
function Log() {
  const t = useTema();
  const [logs, setLogs] = useState<any[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { FC.db.logs(60).then(setLogs).catch((e: any) => setErro(FC.ui.traduzErro(e.message))); }, []);
  if (erro) return <Lista><Vazio icone="info" titulo={erro} /></Lista>;
  if (!logs) return <Lista><View style={{ padding: 48, alignItems: "center" }}><Roda /></View></Lista>;
  if (!logs.length) return <Lista><T style={{ padding: 48, textAlign: "center", color: t.cores.ink2 }}>Nenhum evento ainda.</T></Lista>;
  return (
    <Lista>
      {logs.map((l) => {
        const [nome, cor] = EVENTOS[l.evento] || [l.evento, "cinza"];
        const det = l.detalhe || {};
        const texto = l.evento === "erro" ? `${det.etapa || ""}: ${det.erro || ""}`
          : l.evento === "aporte" ? `${det.destino || ""} · ${FC.fmt.brlTexto(det.valor)}`
          : l.evento === "importacao" ? `${det.meses} mês(es) · ${det.fonte || ""}`
          : l.evento === "seguranca" ? det.acao || ""
          : [det.patrimonio != null ? "patrimônio " + FC.fmt.brlTexto(det.patrimonio) : "", det.ativos != null ? det.ativos + " ativo(s)" : "",
             det.sem_preco && det.sem_preco.length ? "sem preço: " + det.sem_preco.join(", ") : ""].filter(Boolean).join(" · ");
        return (
          <Item key={l.id}
            titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><T style={{ fontWeight: "600", fontSize: 15 }}>{nome}</T><Pilula cor={cor}>{l.origem === "automatico" ? "automático" : "app"}</Pilula></View>}
            detalhe={<Rs style={{ fontSize: 13, color: t.cores.ink2 }} numberOfLines={1}>{texto || " "}</Rs>}
            valores={<T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{new Date(l.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</T>} />
        );
      })}
    </Lista>
  );
}

// ---------------------------------------------------------------- critérios
function Objetivos() {
  const t = useTema();
  const prefs = FC.estado.prefs;
  const objSalvo = ((FC.estado.base.prefsBrutas || {}).premissas || {}).objetivos || {};
  const obj = FC.objetivos(prefs);
  const [custo, setCusto] = useState(objSalvo.custo_vida_mensal ? FC.fmt.num(objSalvo.custo_vida_mensal, 2) : "");
  const [meses, setMeses] = useState(String(obj.meses_reserva ?? ""));
  const [renda, setRenda] = useState(objSalvo.renda_desejada_mensal ? FC.fmt.num(objSalvo.renda_desejada_mensal, 2) : "");
  const ler = () => {
    const c = FC.lerNum(custo), r = FC.lerNum(renda);
    const m = Math.round(FC.lerNum(meses) || 6);
    return { custo_vida_mensal: c > 0 ? c : null, meses_reserva: Math.max(1, Math.min(36, m)), renda_desejada_mensal: r > 0 ? r : null };
  };
  const o = ler();
  return (
    <Cartao>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
        <View style={{ flexBasis: 180, flexGrow: 1 }}><Campo rotulo="Custo de vida por mês (R$)" dica="quanto você gasta num mês normal"><Entrada valor={custo} aoMudar={setCusto} decimal placeholder="0,00" accessibilityLabel="Custo de vida" /></Campo></View>
        <View style={{ flexBasis: 180, flexGrow: 1 }}><Campo rotulo="Meses de reserva" dica="quantos meses a reserva de emergência deve cobrir"><Entrada valor={meses} aoMudar={setMeses} keyboardType="number-pad" placeholder="6" accessibilityLabel="Meses de reserva" /></Campo></View>
        <View style={{ flexBasis: 180, flexGrow: 1 }}><Campo rotulo="Renda passiva desejada por mês (R$)" dica="quanto quer receber de proventos para viver de renda"><Entrada valor={renda} aoMudar={setRenda} decimal placeholder="igual ao custo de vida" accessibilityLabel="Renda desejada" /></Campo></View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: t.espaco.e3, marginTop: t.espaco.e3 }}>
        <T style={{ color: t.cores.ink2 }}>{o.custo_vida_mensal ? `Reserva ideal: ${FC.fmt.brlTexto(o.custo_vida_mensal * o.meses_reserva, 0)}` : ""}</T>
        <Botao onPress={async () => { try { await gravaPremissas({ objetivos: ler() }); await depoisDeMudar("Objetivos salvos"); } catch (err) { ui.erro(err); } }}>Salvar objetivos</Botao>
      </View>
    </Cartao>
  );
}

function Metas() {
  const t = useTema();
  const alvos = FC.estado.prefs.alocacao_alvo;
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(FC.PILARES.map((p: any) => [p.chave, String(alvos[p.chave] ?? 0).replace(".", ",")])));
  const ligados = FC.pilaresLigados();
  const valores = ligados.map((p: any) => ({ ...p, valor: Math.max(0, FC.lerNum(v[p.chave]) || 0) }));
  const s = valores.reduce((a: number, x: any) => a + x.valor, 0);
  const salvar = async () => {
    if (Math.abs(s - 100) > 0.01) { ui.aviso("As metas precisam somar 100%.", "erro"); return; }
    const alocacao_alvo = Object.fromEntries(FC.PILARES.map((p: any) => [p.chave, FC.lerNum(v[p.chave]) || 0]));
    try { await FC.db.gravaPrefs({ alocacao_alvo }); await depoisDeMudar("Metas salvas"); } catch (err) { ui.erro(err); }
  };
  return (
    <Cartao>
      <View style={{ marginBottom: t.espaco.e4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: t.espaco.e2 }}>
          <T style={{ fontSize: 12, fontWeight: "600", color: t.cores.ink2, textTransform: "uppercase", letterSpacing: 0.5 }}>Distribuição visual</T>
          <T style={{ fontSize: 12, fontWeight: "600", color: t.cores.ink2 }}>{FC.fmt.num(s, 0)}%</T>
        </View>
        {s <= 0 ? <View style={{ height: 14, borderRadius: 7, backgroundColor: t.cores.campo }} />
          : <Composicao partes={[...valores.filter((x: any) => x.valor > 0).map((x: any) => ({ valor: x.valor, cor: x.cor })), ...(s < 100 ? [{ valor: 100 - s, cor: t.cores.campo }] : [])]} />}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
        {ligados.map((p: any) => (
          <View key={p.chave} style={{ flexBasis: 110, flexGrow: 1 }}>
            <Campo rotulo={<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: corCss(t.cores, p.cor) }} /><T v="rot">{p.nome}</T></View>}>
              <Entrada valor={v[p.chave]} aoMudar={(x) => setV({ ...v, [p.chave]: x })} decimal accessibilityLabel={`Meta de ${p.nome}`} />
            </Campo>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: t.espaco.e4 }}>
        {Math.abs(s - 100) < 0.01 ? <Pilula cor="verde">Soma: 100% · Balanceado</Pilula>
          : s < 100 ? <Pilula cor="amarelo">{`Soma: ${FC.fmt.num(s, 0)}% · Faltam ${FC.fmt.num(100 - s, 0)}%`}</Pilula>
          : <Pilula cor="vermelho">{`Soma: ${FC.fmt.num(s, 0)}% · Excede ${FC.fmt.num(s - 100, 0)}%`}</Pilula>}
        <Botao onPress={salvar}>Salvar metas</Botao>
      </View>
    </Cartao>
  );
}

function Regras() {
  const t = useTema();
  const r = FC.estado.prefs.regras;
  const [pl, setPl] = useState<Record<string, string>>(Object.fromEntries(["historica", "regra", "pares", "macro"].map((k) => [k, String(r.pesos_lentes[k] ?? "").replace(".", ",")])));
  const [atende, setAtende] = useState(String(r.vereditos.atende));
  const [observar, setObservar] = useState(String(r.vereditos.observar));
  const [janela, setJanela] = useState(String(r.janela_historico_anos));
  const [json, setJson] = useState(JSON.stringify({ perfis: r.perfis, override_perfil: r.override_perfil, segmentos_papel: r.segmentos_papel, perfil: r.perfil }, null, 2));
  const [erro, setErro] = useState<string | null>(null);
  const salvar = async () => {
    setErro(null);
    let avancado: any;
    try { avancado = JSON.parse(json); } catch (err: any) { setErro("O JSON das faixas tem um erro: " + err.message); return; }
    const regras = {
      ...avancado,
      pesos_lentes: Object.fromEntries(["historica", "regra", "pares", "macro"].map((k) => [k, FC.lerNum(pl[k]) ?? 0])),
      vereditos: { atende: FC.lerNum(atende) ?? 70, observar: FC.lerNum(observar) ?? 45 },
      janela_historico_anos: Math.max(1, Math.min(10, Math.round(FC.lerNum(janela) || 3))),
    };
    try { await FC.db.gravaPrefs({ regras }); await depoisDeMudar("Regras salvas — scores recalculados", true); } catch (err) { ui.erro(err); }
  };
  return (
    <Cartao>
      <T style={{ fontSize: 13, fontWeight: "500", color: t.cores.ink2, marginBottom: t.espaco.e3 }}>Peso das lentes</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
        {([["historica", "Histórico"], ["regra", "Seu alvo"], ["pares", "Pares"], ["macro", "Renda fixa"]] as const).map(([k, rot]) => (
          <View key={k} style={{ flexBasis: 120, flexGrow: 1 }}><Campo rotulo={rot}><Entrada valor={pl[k]} aoMudar={(x) => setPl({ ...pl, [k]: x })} decimal accessibilityLabel={rot} /></Campo></View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3, marginTop: t.espaco.e3 }}>
        <View style={{ flexBasis: 140, flexGrow: 1 }}><Campo rotulo="“Dentro dos seus critérios” a partir de"><Entrada valor={atende} aoMudar={setAtende} decimal accessibilityLabel="Dentro dos critérios a partir de" /></Campo></View>
        <View style={{ flexBasis: 140, flexGrow: 1 }}><Campo rotulo="“Perto dos seus critérios” a partir de"><Entrada valor={observar} aoMudar={setObservar} decimal accessibilityLabel="Perto dos critérios a partir de" /></Campo></View>
        <View style={{ flexBasis: 140, flexGrow: 1 }}><Campo rotulo="Janela do histórico (anos)"><Entrada valor={janela} aoMudar={setJanela} keyboardType="number-pad" accessibilityLabel="Janela do histórico" /></Campo></View>
      </View>
      <Detalhes rotulo="Faixas de cada indicador (avançado)" style={{ marginTop: t.espaco.e4 }}>
        <T v="p" style={{ marginBottom: t.espaco.e2 }}>Cada perfil tem suas métricas com ótimo (nota 100), aceitável (60) e ruim (0). <Codigo>direcao</Codigo> é <Codigo>menor_melhor</Codigo> ou <Codigo>maior_melhor</Codigo>. A chave <Codigo>perfil</Codigo> traz as faixas de alocação, nota mínima e peso máximo do perfil do investidor.</T>
        <Entrada valor={json} aoMudar={setJson} multiline numberOfLines={16} style={{ minHeight: 320 }} accessibilityLabel="Faixas em JSON" />
      </Detalhes>
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", marginTop: t.espaco.e4 }}>
        <Botao variante="texto" onPress={async () => {
          if (!(await ui.confirma("Voltar todas as regras ao padrão?", { botao: "Voltar ao padrão" }))) return;
          try { await FC.db.gravaPrefs({ regras: null }); await depoisDeMudar("Regras padrão restauradas"); } catch (err) { ui.erro(err); }
        }}>Voltar ao padrão</Botao>
        <Botao onPress={salvar}>Salvar regras</Botao>
      </View>
      {erro ? <Mensagem tipo="erro" style={{ marginTop: t.espaco.e3 }}>{erro}</Mensagem> : null}
    </Cartao>
  );
}

function UniversoRenda() {
  const t = useTema();
  const [json, setJson] = useState(JSON.stringify(FC.estado.prefs.renda, null, 2));
  const [erro, setErro] = useState<string | null>(null);
  return (
    <Cartao>
      <T v="p" style={{ marginBottom: t.espaco.e3 }}>Setores cujo lucro vem de tarifa regulada, contrato longo ou spread. <Codigo>sem_ebitda: true</Codigo> desliga o critério de dívida (bancos).</T>
      <Entrada valor={json} aoMudar={setJson} multiline numberOfLines={14} style={{ minHeight: 280 }} accessibilityLabel="Universo em JSON" />
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", marginTop: t.espaco.e3 }}>
        <Botao variante="texto" onPress={async () => { try { await FC.db.gravaPrefs({ renda: null }); await depoisDeMudar("Universo padrão restaurado"); } catch (err) { ui.erro(err); } }}>Voltar ao padrão</Botao>
        <Botao onPress={async () => {
          setErro(null);
          let renda: any;
          try { renda = JSON.parse(json); if (!renda.setores) throw new Error("falta a chave “setores”"); } catch (err: any) { setErro("O JSON tem um erro: " + err.message); return; }
          try { await FC.db.gravaPrefs({ renda }); await depoisDeMudar("Universo salvo"); } catch (err) { ui.erro(err); }
        }}>Salvar universo</Botao>
      </View>
      {erro ? <Mensagem tipo="erro" style={{ marginTop: t.espaco.e3 }}>{erro}</Mensagem> : null}
    </Cartao>
  );
}

// ---------------------------------------------------------------- backup
async function exportar() {
  const b = FC.estado.base;
  // perfil e planos entram no backup (direito do titular)
  let perfilExport = null;
  if (FC.estado.perfil && !FC.estado.perfil.indisponivel) { try { perfilExport = await FC.perfilDb.exporta(); } catch (err) { console.warn(err); } }
  const limpa = (arr: any[]) => arr.map(({ user_id, ...x }) => x);
  const { user_id: _u, ...prefs } = b.prefsBrutas || {};
  const backup = { app: "finance-control", versao: 1, gerado: new Date().toISOString(),
    ativos: limpa(b.ativos), renda_fixa: limpa(b.rendaFixa), aportes: limpa(b.aportes),
    agro_movimentos: limpa(b.agro.movs), agro_custos: limpa(b.agro.custos), agro_pesagens: limpa(b.agro.pesagens),
    ganhos: limpa(b.ganhos || []), preferencias: prefs, ...(perfilExport ? { perfil: perfilExport } : {}) };
  await FC.baixar(`finance-control-${FC.datas.hoje()}.json`, JSON.stringify(backup, null, 2));
  ui.aviso("Backup baixado");
}
async function restaurar() {
  const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
  if (r.canceled || !r.assets || !r.assets.length) return;
  const a: any = r.assets[0];
  try {
    const texto = Platform.OS === "web" && a.file ? await a.file.text() : await (await fetch(a.uri)).text();
    const b = JSON.parse(texto);
    if (b.app !== "finance-control" && b.app !== "bullz") throw new Error("este arquivo não é um backup do Bullz");
    if (!(await ui.confirma(`Acrescentar ${b.ativos.length} ativo(s), ${b.aportes.length} aporte(s) e ${b.agro_movimentos.length} movimento(s) do agro?`, { botao: "Restaurar" }))) return;
    const sem = (arr: any[], ...campos: string[]) => arr.map((x) => { const y = { ...x }; for (const c of ["id", "user_id", "criado_em", "seq", ...campos]) delete y[c]; return y; });
    await FC.db.inserirVarios("ativos", sem(b.ativos), "user_id,ticker");
    await FC.db.inserirVarios("renda_fixa", sem(b.renda_fixa), "user_id,nome");
    await FC.db.inserirVarios("aportes", sem(b.aportes.filter((x: any) => x.origem)), "user_id,origem");
    await FC.db.inserirVarios("aportes", sem(b.aportes.filter((x: any) => !x.origem)));
    await FC.db.inserirVarios("agro_movimentos", sem(b.agro_movimentos));
    await FC.db.inserirVarios("agro_custos", sem(b.agro_custos));
    await FC.db.inserirVarios("agro_pesagens", sem(b.agro_pesagens));
    if (b.ganhos) await FC.db.inserirVarios("ganhos", sem(b.ganhos));
    if (b.preferencias) { const { atualizado_em, ...p } = b.preferencias; void atualizado_em; await FC.db.gravaPrefs(p); }
    await depoisDeMudar("Backup restaurado", true);
  } catch (err) { ui.erro(err); }
}

// ---------------------------------------------------------------- tela
export default function Ajustes() {
  const t = useTema();
  const e = useEstado();
  const privado = useApp((s) => s.privado);
  const admin = useApp((s) => s.admin);
  const [prefTema, definePrefTema] = usePrefTema();
  const { aba: abaParam } = useLocalSearchParams<{ aba?: string }>();
  const [aba, setAba] = useState<string>(() => {
    const a = abaParam && ABAS.includes(String(abaParam)) ? String(abaParam) : FC.local.ler("ajustes-aba", "geral");
    return ABAS.includes(a) ? a : "geral";
  });
  const [fatores, setFatores] = useState<any[]>([]);
  const [nivel, setNivel] = useState<any>(null);
  const [nome, setNome] = useState((((FC.auth.usuario || {}).user_metadata || {}).nome) || "");
  const [uso, setUso] = useState(FC.uso && FC.uso.lerConsentimento ? FC.uso.lerConsentimento() === true : false);
  const versao = useApp((s) => s.versao);
  useEffect(() => {
    FC.auth.fatores().then((f: any) => setFatores((f.totp || []).filter((x: any) => x.status === "verified"))).catch(() => setFatores([]));
    FC.auth.nivel().then(setNivel).catch(() => {});
  }, [versao]);
  useEffect(() => {
    const atual = (((FC.auth.usuario || {}).user_metadata || {}).nome) || "";
    if (nome === atual) return;
    const id = setTimeout(async () => {
      try { const d = await FC.sb.auth.updateUser({ data: { nome: nome.trim() } }); if (d.data && d.data.user) FC.auth.usuario = d.data.user; ui.aviso("Nome salvo"); } catch (err) { ui.erro(err); }
    }, 700);
    return () => clearTimeout(id);
  }, [nome]);
  if (!e.base || !e.prefs) return <Pagina>{null}</Pagina>;
  const u = FC.auth.usuario;
  const b = e.base;
  const totp = fatores[0] || null;
  const contagem: Array<[string, number]> = [["Ativos", b.ativos.length], ["Títulos de renda fixa", b.rendaFixa.length], ["Aportes e proventos", b.aportes.length],
    ["Movimentos do gado", b.agro.movs.length], ["Custos do agro", b.agro.custos.length], ["Pesagens", b.agro.pesagens.length],
    ["Ganhos", (b.ganhos || []).length], ["Registros de patrimônio", (b.historico || []).length]];
  const modulosAtivos = FC.MODULOS.filter((m: any) => FC.modulo(m.chave)).length;
  const trocaAba = (v: string) => {
    if (v === "layout") { router.push("/inicio/editar" as any); return; }
    FC.local.gravar("ajustes-aba", v); setAba(v);
  };
  const mudaModulo = async (m: any, ligado: boolean) => {
    const modulos = { ...FC.estado.prefs.modulos, [m.chave]: ligado };
    try {
      await FC.db.gravaPrefs({ modulos });
      FC.estado.prefs.modulos = modulos;
      FC.estado.base.prefsBrutas.modulos = modulos;
      ui.aviso(`${m.nome} ${ligado ? "ligado" : "desligado"}`);
      rerender();
    } catch (err) { ui.erro(err); }
  };
  const recap = (tipo: string) => FC.recap.periodoDe(tipo);
  return (
    <Pagina estreita>
      <Cabecalho titulo="Ajustes" sub="Conta, segurança e os critérios que o painel aplica." />
      <View style={{ marginBottom: t.espaco.e5 }}>
        <Segmentado valor={aba} aoMudar={trocaAba} rotuloA11y="Seções de ajustes"
          opcoes={[{ v: "geral", rotulo: "Geral" }, { v: "modulos", rotulo: "Módulos" }, { v: "layout", rotulo: "Layout" }, { v: "criterios", rotulo: "Critérios" }, { v: "dados", rotulo: "Dados" }]} />
      </View>

      {aba === "geral" ? (
        <View>
          <Secao titulo="Conta" topo={false}>
            <Lista>
              <Item esquerda={<Icone nome="cadeado" tam={22} cor={t.cores.acento} />} titulo={u.email}
                detalhe={`Conta criada em ${FC.datas.br((u.created_at || "").slice(0, 10))} · último acesso ${u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}`} detalheLinhas={2} />
              <Item titulo="Como quer ser chamado" detalhe="aparece na saudação do início"
                direita={<View style={{ width: 180 }}><Entrada compacto valor={nome} aoMudar={setNome} maxLength={40} placeholder="seu nome" autoCapitalize="words" accessibilityLabel="Nome" /></View>} />
              <Item chevron onPress={() => FC.onboarding && FC.onboarding.abre()} esquerda={<Icone nome="info" tam={20} cor={t.cores.acento} />}
                titulo="Ver a apresentação" detalhe="o passo a passo do que o painel faz" />
            </Lista>
          </Secao>

          <Secao titulo="Segurança">
            <Lista>
              <Item esquerda={<Icone nome="escudo" tam={22} cor={totp ? t.cores.verde : t.cores.amarelo} />} detalheLinhas={3}
                titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}><T style={{ fontWeight: "600", fontSize: 15 }}>Verificação em duas etapas</T><Pilula cor={totp ? "verde" : "cinza"}>{totp ? "ligada" : "desligada"}</Pilula></View>}
                detalhe={totp ? "O login pede o código do app autenticador, e o banco recusa qualquer acesso sem ele." : "Opcional. Ligue para exigir um código do celular além da senha."}
                direita={fatores.length < 3 ? <Botao variante={totp ? "sec" : "primario"} pequeno onPress={() => ligaMfa(fatores.length)}>{totp ? "Adicionar reserva" : "Ligar"}</Botao> : null} />
              {fatores.map((f) => (
                <Item key={f.id} esquerda={<View style={{ width: 22, marginLeft: 22 }}><Icone nome="cadeado" tam={16} cor={t.cores.ink3} /></View>}
                  titulo={<T style={{ fontWeight: "600", fontSize: 14 }}>{nomeFator(f)}</T>} detalhe={`cadastrado em ${FC.datas.br(f.created_at.slice(0, 10))}`}
                  direita={<Botao variante="texto" pequeno onPress={() => removeFator(fatores, f.id)}><Text style={{ color: t.cores.vermelho, fontSize: 13.5, fontWeight: "500" }}>Remover</Text></Botao>} />
              ))}
              <Item chevron onPress={trocaSenha} esquerda={<Icone nome="editar" tam={20} cor={t.cores.ink2} />} titulo="Trocar senha"
                detalhe={`pede a senha atual${totp ? " (a sessão já passou pelo 2FA)" : ""}`} />
              <Item esquerda={<Icone nome="info" tam={20} cor={t.cores.ink2} />} titulo="Esta sessão" detalheLinhas={2}
                detalhe={`${nivel && nivel.currentLevel === "aal2" ? "protegida pelo código do autenticador" : "entrou só com a senha"} · encerra sozinha após 7 dias sem uso`}
                direita={<Botao variante="sec" pequeno onPress={async () => {
                  if (!(await ui.confirma("Encerrar a sessão em todos os outros aparelhos e navegadores? Este continua conectado.", { botao: "Encerrar" }))) return;
                  try { await FC.auth.sairDosOutros(); ui.aviso("Outros aparelhos desconectados"); FC.db.log("seguranca", { acao: "sair dos outros aparelhos" }); } catch (err) { ui.erro(err); }
                }}>Sair dos outros aparelhos</Botao>} />
              <Item onPress={() => FC.sair()} esquerda={<Icone nome="sair" tam={20} cor={t.cores.vermelho} />} titulo={<T style={{ fontWeight: "600", fontSize: 15, color: t.cores.vermelho }}>Sair</T>} />
            </Lista>
            <Detalhes rotulo="Como sua conta é protegida">
              <View style={{ gap: 4 }}>
                {["Senha guardada pelo Supabase Auth só como hash bcrypt; mínimo de 10 caracteres com maiúscula, minúscula e número; senhas que já apareceram em vazamentos são recusadas.",
                  "Todo o tráfego é HTTPS. A sessão é um token assinado que expira em 15 minutos e é renovado com rotação (um token de renovação roubado não serve duas vezes).",
                  "Row Level Security em todas as tabelas: o banco só entrega uma linha ao dono dela. Com o 2FA ligado, o banco também exige que a sessão tenha passado pelo código.",
                  "Limite de tentativas de login e de código no servidor; a sessão cai sozinha após 7 dias sem uso."].map((x, i) => <T key={i} v="p" style={{ lineHeight: 23 }}>•  {x}</T>)}
              </View>
            </Detalhes>
          </Secao>

          <Secao titulo="Aparência">
            <Lista>
              <Item titulo="Tema" direita={<Segmentado valor={prefTema} aoMudar={definePrefTema} rotuloA11y="Tema"
                opcoes={[{ v: "auto", rotulo: "Automático" }, { v: "claro", rotulo: "Claro" }, { v: "escuro", rotulo: "Escuro" }]} />} />
              <Item titulo="Modo privado" detalhe={Platform.OS === "web" ? "borra os valores em reais; passe o mouse para ver" : "borra os valores em reais"}
                direita={<Interruptor valor={privado} aoMudar={() => alternaPrivado()} />} />
            </Lista>
          </Secao>

          <Secao titulo="Dispositivo e Aplicativo">
            <Lista>
              {FC.dispositivo.ehInstalado ? (
                <Item esquerda={<Icone nome="check" tam={20} cor={t.cores.verde} />} titulo={Platform.OS === "web" ? "Aplicativo na Tela de Início" : "Aplicativo instalado"}
                  detalhe="Executando em tela cheia como aplicativo" direita={<Pilula cor="verde" semPonto>Ativo</Pilula>} />
              ) : (
                <Item chevron onPress={() => FC.abreGuiaInstalacao && FC.abreGuiaInstalacao()} esquerda={<Icone nome="celular" tam={20} cor={t.cores.acento} />}
                  titulo="Adicionar à Tela de Início" detalhe={FC.dispositivo.ehIOS ? "Instalar no iPhone / iPad para abrir em tela cheia" : "Instalar no celular ou tablet para acesso rápido"} />
              )}
            </Lista>
          </Secao>

          <Secao titulo="Privacidade" sub="o que o Bullz registra sobre o uso">
            <Lista>
              <Item esquerda={<IconeModulo nome="escudo" />} titulo="Ajudar a melhorar o app" detalheLinhas={3}
                detalhe="registra de forma anônima as telas e botões que você usa — nunca valores, ativos, nome ou e-mail"
                direita={<Interruptor valor={uso} aoMudar={async (v) => {
                  setUso(v);
                  try { await FC.uso.defineConsentimento(v); ui.aviso(v ? "Obrigado! A coleta anônima está ligada" : "Coleta de uso desligada"); }
                  catch (err) { setUso(!v); ui.erro(err); }
                }} />} />
            </Lista>
            <T v="p" style={{ marginTop: t.espaco.e3 }}>No lugar da sua conta vai um código aleatório deste aparelho. Os registros são apagados em 180 dias. Erros técnicos, sem dado pessoal, são registrados para manter o app funcionando.</T>
          </Secao>

          {admin ? (
            <Secao titulo="Administração" sub="visível só para administradores">
              <Lista><Item chevron onPress={() => router.push("/admin" as any)} esquerda={<IconeModulo nome="escudo" />} titulo="Painel do administrador"
                detalhe="vídeos de divulgação, cliques, jornadas, logs e insights" /></Lista>
            </Secao>
          ) : null}
        </View>
      ) : null}

      {aba === "modulos" ? (
        <View>
          <Secao titulo="Categorias e Módulos" topo={false} direita={<Pilula cor="cinza" semPonto>{`${modulosAtivos} de ${FC.MODULOS.length} ativos`}</Pilula>}>
            <View style={{ marginBottom: t.espaco.e4, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: t.cores.campo, borderRadius: 12 }}>
              <T style={{ fontSize: 13, color: t.cores.ink2 }}><B style={{ color: t.cores.ink }}>Principais (sempre ativas):</B> Início, Investimentos e Aportes.</T>
            </View>
            <Lista>
              {FC.MODULOS.map((m: any) => (
                <Item key={m.chave} esquerda={<IconeModulo nome={m.icone} />} titulo={m.nome} detalhe={m.desc} detalheLinhas={2}
                  direita={<Interruptor valor={!!FC.modulo(m.chave)} aoMudar={(v) => mudaModulo(m, v)} />} />
              ))}
            </Lista>
            <T v="p" style={{ marginTop: t.espaco.e3 }}>Desligar só esconde: o que você já cadastrou continua guardado e somando no patrimônio.</T>
          </Secao>
          <Secao titulo="Retrospectivas" sub="no Início elas aparecem só no fim do período; aqui, sempre">
            <Lista>
              <Item chevron onPress={() => router.push("/retrospectiva/mes/ajustes" as any)} esquerda={<IconeModulo nome="play" />}
                titulo={`Retrospectiva de ${recap("mes").rotulo.toLowerCase()}`} detalhe="no Início, nos últimos 5 dias de cada mês" />
              <Item chevron onPress={() => router.push("/retrospectiva/ano/ajustes" as any)} esquerda={<IconeModulo nome="play" ano />}
                titulo={`Retrospectiva de ${recap("ano").rotulo}${recap("ano").fim < recap("ano").chave + "-12-31" ? " até agora" : ""}`} detalhe="no Início, de 27 a 31 de dezembro" />
            </Lista>
            <T v="p" style={{ marginTop: t.espaco.e3 }}>Montadas com os seus números: patrimônio, aportes, salário, dividendos e alocação do período. Fora da janela, a do mês mostra o último mês completo.</T>
          </Secao>
        </View>
      ) : null}

      {aba === "criterios" ? (
        <View>
          <Secao titulo="Objetivos" sub="a base da reserva de emergência e da renda passiva no Início" topo={false}><Objetivos /></Secao>
          <Secao titulo="Metas de alocação" sub="em % do patrimônio; a soma precisa dar 100"><Metas /></Secao>
          <Secao titulo="Regras de avaliação" sub="quanto cada lente pesa e onde fica cada veredito"><Regras /></Secao>
          <Secao titulo="Universo da aba Renda" sub="setores e empresas analisados"><UniversoRenda /></Secao>
        </View>
      ) : null}

      {aba === "dados" ? (
        <View>
          <Secao titulo="Suas informações" sub="tudo isto está vinculado à sua conta" topo={false}>
            <Cartao>
              <Kpis>{contagem.map(([n, v]) => <Kpi key={n} pequeno rotulo={n} valor={FC.fmt.int(v)} />)}</Kpis>
              <T v="p" style={{ marginTop: t.espaco.e3 }}>Conta <Codigo>{u.id.slice(0, 8)}…</Codigo>. Cada linha guarda esta conta, e nenhuma outra conta consegue ler. Para levar tudo para um arquivo, use <B>Baixar backup</B> logo abaixo.</T>
            </Cartao>
          </Secao>
          <Secao titulo="Seus dados e backup" sub="guarde ou transfira seus dados com segurança">
            <Lista>
              <Item chevron onPress={exportar} esquerda={<Icone nome="exportar" tam={22} cor={t.cores.acento} />} titulo="Baixar backup"
                detalhe="tudo em um arquivo JSON: carteira, aportes, agro, ganhos e preferências" detalheLinhas={2} />
              <Item chevron onPress={restaurar} esquerda={<Icone nome="importar" tam={22} cor={t.cores.acento} />} titulo="Restaurar backup"
                detalhe="acrescenta o conteúdo de um backup; o que já existe fica" detalheLinhas={2} />
              <Item onPress={apagaTudo} esquerda={<Icone nome="lixo" tam={22} cor={t.cores.vermelho} />}
                titulo={<T style={{ fontWeight: "600", fontSize: 15, color: t.cores.vermelho }}>Apagar todos os dados</T>} detalhe="a conta continua; carteira, aportes e agro somem" />
            </Lista>
          </Secao>
          <Secao titulo="Histórico mensal" sub="totais de meses anteriores ao app (ex.: anotados no Notion)"><HistoricoMensal /></Secao>
          <Secao titulo="Log do sistema" sub="atualizações de preço, registros diários e erros">
            <Log />
            <T v="p" style={{ marginTop: t.espaco.e3 }}>O registro diário roda sozinho no Supabase todo dia às 18h10 (Brasília), mesmo com o app fechado. Com o app aberto, os preços são atualizados a cada minuto.</T>
          </Secao>
        </View>
      ) : null}
    </Pagina>
  );
}
