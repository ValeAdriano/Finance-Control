/* Peças do 2FA usadas na ativação (Ajustes) e no login: a escolha do app
 * autenticador, o botão que manda a conta para ele, o que abre o app na hora
 * do código e o "Colar código". */
import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import { useTema } from "../../tema";
import { rerender } from "../../estado/app";
import { Botao, Cartao, Detalhes, Mensagem, T } from "../../ui/kit";
import { Entrada, Form } from "../../ui/campos";
import { Icone } from "../../ui/icone";
import { folhaForm, ui } from "../../ui/folha";
import FC from "../../nucleo";
import { vibra } from "../../plataforma/vibra";
import {
  abreAutenticador, adicionaAoAutenticador, appEscolhido, appsDoAparelho, ehCelular, escolheApp, type AppAutenticador,
} from "../../plataforma/autenticador";

/** chips com os autenticadores; a escolha fica salva neste aparelho */
export function EscolheApp({ aoEscolher }: { aoEscolher?: (a: AppAutenticador | null) => void }) {
  const t = useTema();
  const [sel, setSel] = useState<string | null>(() => (appEscolhido() || {}).id || null);
  const apps = appsDoAparelho();
  return (
    <View style={{ gap: 8 }}>
      <T style={{ fontSize: 14, fontWeight: "600" }}>Qual app autenticador você usa?</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup">
        {apps.map((a) => {
          const ativo = sel === a.id;
          return (
            <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ checked: ativo }}
              onPress={() => { const novo = ativo ? null : a.id; setSel(novo); escolheApp(novo); aoEscolher?.(novo ? a : null); }}
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 980, borderWidth: 1.5,
                borderColor: ativo ? t.cores.acento : t.cores.linha2, backgroundColor: ativo ? t.cores.acentoSuave : "transparent" }}>
              <Text style={{ fontSize: 14, color: ativo ? t.cores.acento : t.cores.ink, fontWeight: ativo ? "600" : "400" }}>{a.nome}</Text>
            </Pressable>
          );
        })}
      </View>
      <T v="dica">Fica guardado só neste aparelho: no login, o Bullz oferece abrir esse app para você pegar o código.</T>
    </View>
  );
}

/** manda a conta nova para o autenticador do celular (link otpauth://) */
export function BotaoAdicionar({ uri, app }: { uri: string; app: AppAutenticador | null }) {
  const nome = app && !app.preenche ? app.nome : app && app.preenche ? "Apple Senhas" : "app autenticador";
  return (
    <Botao cheio icone="escudo" onPress={async () => {
      const ok = await adicionaAoAutenticador(uri);
      if (!ok) ui.aviso("Não deu para abrir o autenticador. Copie a chave abaixo e cole no app.", "erro");
    }}>{`Adicionar ao ${nome}`}</Botao>
  );
}

/** copia a chave secreta (para colar no autenticador à mão) */
export function BotaoCopiarChave({ chave }: { chave: string }) {
  return (
    <Botao variante="sec" pequeno onPress={async () => {
      try { await Clipboard.setStringAsync(chave); ui.aviso("Chave copiada. Cole no app autenticador."); } catch (e) { ui.erro(e); }
    }}>Copiar chave</Botao>
  );
}

/** lê os 6 dígitos da área de transferência */
export function BotaoColar({ aoColar }: { aoColar: (codigo: string) => void }) {
  return (
    <Botao variante="sec" pequeno style={{ alignSelf: "center" }} onPress={async () => {
      try {
        const txt = (await Clipboard.getStringAsync()) || "";
        const cod = txt.replace(/\D/g, "");
        if (cod.length === 6) aoColar(cod);
        else ui.aviso("Não achei um código de 6 dígitos copiado. Copie no app autenticador e tente de novo.", "erro");
      } catch { ui.aviso("O navegador não deixou ler o que foi copiado. Cole no campo com o teclado.", "erro"); }
    }}>Colar código</Botao>
  );
}

/** no login: abre o autenticador escolhido (no celular) ou explica o preenchimento */
export function AbrirAutenticador() {
  const t = useTema();
  const app = appEscolhido();
  if (!ehCelular()) return null;
  if (!app) return <T v="dica" centro>Dica: copie o código no app autenticador e volte para tocar em “Colar código”.</T>;
  if (app.preenche) return <T v="dica" centro>O iPhone sugere o código do Apple Senhas logo acima do teclado.</T>;
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Botao variante="sec" icone="celular" onPress={async () => {
        const ok = await abreAutenticador(app);
        if (!ok) ui.aviso(`Não deu para abrir o ${app.nome}. Abra pelo ícone dele e volte aqui.`, "erro");
      }}>{`Abrir ${app.nome}`}</Botao>
      <T style={{ fontSize: 12, color: t.cores.ink3 }}>copie o código lá e volte para colar</T>
    </View>
  );
}

// ---------------------------------------------------------------- ativação
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
  const [app, setApp] = useState(() => appEscolhido());
  const celular = ehCelular();
  defineSalvar(async () => {
    try {
      await FC.auth.verificarTotp(dados.id, cod);
      api.fechar();
      temFator = true;
      ui.aviso(jaTem ? "Autenticador reserva adicionado" : "Verificação em duas etapas ligada");
      FC.db.log("seguranca", { acao: jaTem ? "autenticador reserva adicionado" : "2FA ligado" });
      rerender();
    } catch (err: any) { vibra.erro(); setErro(/invalid/i.test(err.message) ? "Código incorreto. Confira o app e tente de novo." : FC.ui.traduzErro(err.message)); }
  });
  const qr = <View style={{ alignItems: "center" }}><View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 10 }}><QrCode qr={dados.totp.qr_code} /></View></View>;
  const chave = (
    <View style={{ alignItems: "center", gap: 8 }}>
      <T v="p" centro>ou use a chave: <Text selectable style={{ fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), color: t.cores.ink }}>{dados.totp.secret}</Text></T>
      <BotaoCopiarChave chave={dados.totp.secret} />
    </View>
  );
  return (
    <Form>
      {jaTem ? <T v="p">Um segundo autenticador (outro celular, ou o gerenciador de senhas) garante o acesso se você perder o primeiro.</T> : null}
      {celular ? (
        <>
          {/* no celular, um toque manda a conta para o autenticador instalado */}
          <EscolheApp aoEscolher={setApp} />
          <T v="p">1. Toque para adicionar a conta ao autenticador. Ele abre com o Bullz pronto para salvar.</T>
          <BotaoAdicionar uri={dados.totp.uri} app={app} />
          <Detalhes rotulo="O autenticador está em outro aparelho?" style={{ marginTop: 0 }}>
            <View style={{ gap: 12 }}>{qr}{chave}</View>
          </Detalhes>
          <T v="p">2. Volte para cá e cole (ou digite) o código de 6 dígitos que apareceu no app.</T>
        </>
      ) : (
        <>
          <T v="p">1. Abra um app autenticador no celular (Apple Senhas, Google Authenticator, Microsoft Authenticator, 1Password, Authy) e escaneie o código.</T>
          {qr}
          {chave}
          <T v="p">2. Digite o código de 6 dígitos que aparece no app.</T>
        </>
      )}
      <Entrada valor={cod} aoMudar={(v) => setCod(v.replace(/\D/g, ""))} maxLength={6} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" placeholder="000000" style={estiloCodigo} accessibilityLabel="Código" />
      <View style={{ alignItems: "center" }}><BotaoColar aoColar={setCod} /></View>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Form>
  );
}
export async function ligaMfa(jaTem = 0) {
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

// ---------------------------------------------------------------- incentivo
// quem ainda não tem 2FA: um convite no topo do Início. "Depois" esconde por
// 14 dias neste aparelho. A consulta aos fatores fica em memória na sessão.
let temFator: boolean | null = null;
const CHAVE_ADIADO = "aviso-2fa-ate";
export function CartaoIncentivo2fa() {
  const t = useTema();
  const [tem, setTem] = useState<boolean | null>(temFator);
  const [adiado, setAdiado] = useState(() => String(FC.local.ler(CHAVE_ADIADO, "") || "") > FC.datas.hoje());
  useEffect(() => {
    if (temFator != null) { setTem(temFator); return; }
    FC.auth.fatores()
      .then((f: any) => { temFator = ((f && f.totp) || []).some((x: any) => x.status === "verified"); setTem(temFator); })
      .catch(() => {});
  }, []);
  // depois de ativar, temFator já é true: a repintura do app esconde o cartão
  if ((temFator ?? tem) !== false || adiado) return null;
  const adia = () => { FC.local.gravar(CHAVE_ADIADO, FC.datas.soma(FC.datas.hoje(), 14)); setAdiado(true); };
  return (
    <Cartao style={{ marginBottom: t.espaco.e4, borderWidth: 1, borderColor: t.cores.amarelo + "55" }}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.amareloSuave }}>
          <Icone nome="escudo" tam={22} cor={t.cores.amarelo} />
        </View>
        <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
          <T style={{ fontSize: 16, fontWeight: "600" }}>Proteja sua carteira com a verificação em duas etapas</T>
          <T style={{ fontSize: 13.5, color: t.cores.ink2 }}>Com ela, quem descobrir a sua senha não vê nenhum dado: o banco exige o código do seu celular. Leva um minuto{ehCelular() ? ", e um toque adiciona a conta ao seu autenticador" : ""}.</T>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: t.espaco.e2, justifyContent: "flex-end", marginTop: t.espaco.e3, flexWrap: "wrap" }}>
        <Botao variante="texto" pequeno onPress={adia}>Depois</Botao>
        <Botao pequeno icone="escudo" onPress={() => ligaMfa(0)}>Ligar agora</Botao>
      </View>
    </Cartao>
  );
}
