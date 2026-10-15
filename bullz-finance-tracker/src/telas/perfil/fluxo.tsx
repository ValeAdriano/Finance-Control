/* Questionário do perfil do investidor e a porta de entrada do fluxo —
 * port de telas/perfil-questionario.js.
 *
 * Três portas levam ao mesmo questionário e ao mesmo motor; muda só o que
 * acontece se a pessoa adiar:
 *   conta nova      tela cheia logo depois do cadastro; sair salva o rascunho
 *   conta antiga    convite no primeiro login, até 3 adiamentos
 *   revisão         12 meses (sugerida) ou 24 (obrigatória)
 * Uma pergunta por tela, faixas em vez de valores, rascunho a cada resposta. */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { rerender } from "../../estado/app";
import { B, Botao, Detalhes, T, degrade } from "../../ui/kit";
import { Icone, type NomeIcone } from "../../ui/icone";
import { telaCheia, ui, type ApiFolha } from "../../ui/folha";
import FC from "../../nucleo";

const P = () => FC.PERFIL;
const estado = () => FC.estado.perfil || (FC.estado.perfil = { indisponivel: false, atual: null, rascunho: null, plano: null, adiamentos: 0, modo: "educativo" });
const dispo = () => !estado().indisponivel;
let aberto = false;

function agroPct() {
  const d = FC.estado.dados;
  if (!d || !d.resumo || !(d.resumo.patrimonio > 0)) return null;
  return Math.round(((d.resumo.agro || 0) / d.resumo.patrimonio) * 100);
}

async function carrega() {
  const e = estado();
  Object.assign(e, await FC.perfilDb.carrega());
  try { e.mfa = ((await FC.auth.fatores()).totp || []).some((f: any) => f.status === "verified"); } catch { e.mfa = false; }
  return e;
}

// chamado na entrada do app. Devolve true se abriu algo por cima
async function inicia() {
  const e = await carrega();
  if (e.indisponivel) return false;
  rerender();
  const u = FC.auth.usuario || {};
  const criada = u.created_at ? Date.now() - new Date(u.created_at).getTime() : Infinity;
  const nova = !e.atual && !e.rascunho && (!(u.user_metadata || {}).onboarding_visto || criada < 24 * 3600 * 1000) && e.adiamentos === 0;
  if (e.atual) {
    const rev = FC.perfil.revisao(e.atual, { rendaAtual: null });
    if (rev.estado === "obrigatoria" && !FC.local.ler("perfil-venceu-sessao", false)) {
      FC.local.gravar("perfil-venceu-sessao", true);
      FC.db.log("perfil_revisao_vencida", { versao: e.atual.versao_modelo });
      convite({ revisao: true });
      return true;
    }
    ativacao();
    return false;
  }
  if (nova) { marcaTourVisto(); abre({ origem: "cadastro" }); return true; }
  if (e.rascunho) return false;
  if (e.adiamentos < P().max_adiamentos) { convite({}); return true; }
  return false;
}

// a pessoa já chegou ao primeiro valor: avisa o funil uma vez por conta
function ativacao() {
  const e = estado(), b = FC.estado.base;
  if (e.ativou || !e.atual || !b) return;
  const tem = (b.ativos || []).length || (b.aportes || []).length || (b.rendaFixa || []).length || (e.plano && e.plano.decisao === "aplicado");
  if (!tem) return;
  e.ativou = true;
  const dias = (Date.now() - new Date((FC.auth.usuario || {}).created_at || Date.now()).getTime()) / 86400000;
  FC.perfilDb.evento("ativacao", dias <= 7 ? "em_7_dias" : "depois");
}

async function marcaTourVisto() {
  try {
    const r = await FC.sb.auth.updateUser({ data: { onboarding_visto: new Date().toISOString() } });
    if (r.data && r.data.user) FC.auth.usuario = r.data.user;
  } catch { /* a apresentação fica disponível em Ajustes */ }
}

function IconeGrande({ nome, tam = 30 }: { nome: NomeIcone; tam?: number }) {
  const t = useTema();
  return (
    <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acentoSuave }}>
      <Icone nome={nome} tam={tam} cor={t.cores.acento} />
    </View>
  );
}

// ---------------------------------------------------------------- convite
function convite({ revisao = false }: { revisao?: boolean }) {
  const e = estado();
  const restantes = P().max_adiamentos - e.adiamentos;
  ui.folha({
    titulo: revisao ? "Hora de revisar seu perfil" : "Monte seu plano de investimento",
    corpo: () => <CorpoConvite revisao={revisao} restantes={restantes} />,
    rodape: (api) => (
      <>
        {revisao ? null : <Botao variante="sec" onPress={async () => {
          api.fechar(); e.adiamentos++; await FC.perfilDb.evento("adiado", "convite"); rerender();
        }}>Agora não</Botao>}
        <Botao onPress={() => { api.fechar(); setTimeout(() => abre({ origem: revisao ? "revisao" : "migracao" }), 240); }}>{revisao ? "Revisar agora" : "Começar"}</Botao>
      </>
    ),
  });
}
function CorpoConvite({ revisao, restantes }: { revisao: boolean; restantes: number }) {
  const t = useTema();
  const e = estado();
  return (
    <View style={{ gap: t.espaco.e3 }}>
      <IconeGrande nome="bussola" />
      <T style={{ fontSize: 15.5, lineHeight: 24 }}>{revisao
        ? "Seu perfil passou de 24 meses. Sua situação e seus objetivos podem ter mudado, então vale refazer em poucos minutos."
        : "Responda cerca de 20 perguntas rápidas, em 3 minutos, e receba seu perfil, o quanto guardar por mês e a alocação por classe."}</T>
      {e.atual || !(FC.estado.dados && FC.estado.dados.resumo.patrimonio > 0) ? null : <T v="p">Já preenchemos o que o sistema sabe da sua carteira. Você só confirma.</T>}
      {!revisao && restantes > 0 ? <T style={{ fontSize: 13, color: t.cores.ink2 }}>Você pode adiar {restantes === 1 ? "mais uma vez" : `mais ${restantes} vezes`}. Nada do que você já tem fica bloqueado.</T> : null}
    </View>
  );
}

// ---------------------------------------------------------------- questionário
function abre({ origem = "cadastro", inicial = {}, irPara = null }: { origem?: string; inicial?: any; irPara?: string | null } = {}) {
  if (aberto) return;
  aberto = true;
  telaCheia((api) => <Questionario origem={origem} inicial={inicial} irPara={irPara} api={api} />);
}

function Questionario({ origem, inicial, irPara, api }: { origem: string; inicial: any; irPara: string | null; api: ApiFolha }) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const e = estado();
  const perguntas: any[] = P().perguntas;
  const total = perguntas.length;
  const resp = useRef<any>((() => {
    const sugerido = e.atual ? e.atual.respostas : FC.perfil.sugereRespostas(FC.estado.base, FC.estado.dados);
    const r = { ...sugerido, ...((e.rascunho && e.rascunho.respostas) || {}), ...inicial };
    delete r.agro_pct;
    return r;
  })()).current;
  const [i, setI] = useState(() => irPara != null ? Math.max(0, perguntas.findIndex((q) => q.id === irPara)) + 1
    : e.rascunho && !e.atual ? Math.min(total, e.rascunho.passo || 0) : 0);
  const [, setTick] = useState(0);
  const [concluindo, setConcluindo] = useState(false);
  const [inicio] = useState(() => Date.now());
  const visto = useRef(new Set<string>()).current;
  const timer = useRef<any>(null);
  const entra = useRef(new Animated.Value(1)).current;

  const guarda = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { FC.perfilDb.salvaRascunho(resp, i).then((r: any) => { e.rascunho = r; }).catch(() => {}); }, 350);
  };
  const fecha = () => { aberto = false; api.fechar(); };

  const q = i >= 1 && i <= total ? perguntas[i - 1] : null;
  const bl = q ? P().blocos.find((b: any) => b.id === q.bloco) : null;

  useEffect(() => {
    entra.setValue(0);
    Animated.timing(entra, { toValue: 1, duration: 400, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: Platform.OS !== "web" }).start();
    // funil: cada bloco visto, sem dado financeiro
    if (q && !visto.has(q.bloco)) { visto.add(q.bloco); FC.perfilDb.evento("passo_visto", "bloco_" + bl.n); }
    if (i === 0) FC.perfilDb.evento("passo_visto", "consentimento");
    guarda();
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const vai = (n: number) => {
    const novo = Math.max(0, Math.min(total + 1, n));
    if (novo > i) {
      const a = perguntas[i - 1], b = perguntas[novo - 1];
      if (a && (!b || b.bloco !== a.bloco)) FC.perfilDb.evento("bloco_concluido", "bloco_" + P().blocos.find((x: any) => x.id === a.bloco).n);
    }
    setI(novo);
  };

  const conclui = async () => {
    const dadosFinal: any = { ...resp };
    const pct = agroPct();
    if (pct != null) dadosFinal.agro_pct = pct;
    for (const k of Object.keys(dadosFinal)) if (dadosFinal[k] == null || (Array.isArray(dadosFinal[k]) && !dadosFinal[k].length && k !== "produtos")) delete dadosFinal[k];
    const calculo = FC.perfil.calcula(dadosFinal);
    let rec: any;
    try {
      rec = FC.recomendacao.gera({ resp: dadosFinal, res: calculo, prefs: FC.estado.prefs, dados: FC.estado.dados, base: FC.estado.base, mercado: FC.estado.mercado, modo: e.modo });
    } catch (x) { console.error(x); ui.erro(x); return; }
    setConcluindo(true);
    try {
      clearTimeout(timer.current);
      const reg = await FC.perfilDb.conclui({ respostas: dadosFinal, calculo, origem, necessidade: rec.necessidade });
      const seguro = JSON.parse(JSON.stringify(rec)); // Infinity vira null
      await FC.perfilDb.salvaPlano({ perfilId: reg.id, plano: seguro, modo: e.modo });
      await FC.perfilDb.apagaRascunho();
      await FC.perfilDb.evento("perfil_concluido", origem, Date.now() - inicio);
      FC.db.log("perfil_calculado", { perfil: calculo.perfil, versao: calculo.versao, origem, consistencia: calculo.consistencia });
      await carrega();
    } catch (x: any) {
      setConcluindo(false);
      ui.erro(/perfil_adulterado|versao_modelo/.test(String(x.message)) ? new Error("Não consegui conferir o resultado no servidor. Atualize a página e tente de novo.") : x);
      return;
    }
    fecha();
    router.push("/perfil" as any);
    rerender();
  };

  const avancar = () => {
    if (i > total) {
      const falt = FC.perfil.faltantes(resp);
      if (falt.length) { vai(perguntas.findIndex((x) => x.id === falt[0]) + 1); return; }
      conclui();
      return;
    }
    vai(i + 1);
  };

  const sair = async () => {
    clearTimeout(timer.current);
    try { e.rascunho = await FC.perfilDb.salvaRascunho(resp, i); } catch { /* segue */ }
    fecha();
    rerender();
    ui.aviso("Progresso salvo. Continue quando quiser pelo Início.");
  };

  // Esc sai salvando (web)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const tecla = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); sair(); } };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const escolhe = (o: any) => {
    if (q.multipla) {
      const lista = Array.isArray(resp[q.id]) ? resp[q.id].slice() : [];
      const k = lista.indexOf(o.id);
      if (k >= 0) lista.splice(k, 1); else lista.push(o.id);
      resp[q.id] = lista;
      setTick((x) => x + 1);
      guarda();
      return;
    }
    resp[q.id] = o.id;
    setTick((x) => x + 1);
    FC.perfilDb.evento("respondido", q.id);
    guarda();
    const esta = q;
    setTimeout(() => { if (aberto && perguntas[i - 1] === esta) vai(i + 1); }, 220);
  };

  const pend = i > total ? FC.perfil.faltantes(resp) : [];
  const rotuloAvancar = i === 0 ? "Concordo e começo" : i > total ? (pend.length ? "Responder o que falta" : "Ver meu perfil") : "Continuar";
  const desabilitado = q ? !(q.multipla || resp[q.id]) : false;
  const marcado = (id: string) => (q && q.multipla ? Array.isArray(resp[q.id]) && resp[q.id].includes(id) : q && resp[q.id] === id);

  const item = (icone: NomeIcone, conteudo: React.ReactNode, k: number) => (
    <View key={k} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ marginTop: 3 }}><Icone nome={icone} tam={16} cor={t.cores.acento} /></View>
      <T style={{ flex: 1, fontSize: 14.5, lineHeight: 22, color: t.cores.ink2 }}>{conteudo}</T>
    </View>
  );
  const h1 = (txt: string) => <T style={{ fontSize: 26, lineHeight: 31, fontWeight: "600", letterSpacing: -0.5 }} accessibilityRole="header">{txt}</T>;
  const sub = (txt: React.ReactNode) => <T style={{ color: t.cores.ink2, fontSize: 14.5, lineHeight: 22, marginTop: t.espaco.e2 }}>{txt}</T>;

  let corpo: React.ReactNode;
  if (i === 0) {
    corpo = (
      <View>
        <IconeGrande nome="bussola" tam={32} />
        <View style={{ marginTop: t.espaco.e3 }}>{h1("Vamos montar o seu perfil")}</View>
        {sub("Cerca de 20 perguntas, uma por tela, em menos de 3 minutos. No fim você recebe o seu perfil, quanto guardar por mês e como dividir.")}
        <View style={{ marginTop: t.espaco.e4, gap: 14 }}>
          {item("check", <><B style={{ color: t.cores.ink }}>O que coletamos:</B> suas respostas, sempre em faixas (nunca o valor exato de renda ou patrimônio).</>, 1)}
          {item("check", <><B style={{ color: t.cores.ink }}>Para quê:</B> calcular o perfil e o plano. Nada é enviado a terceiros nem a serviços externos.</>, 2)}
          {item("cadeado", <><B style={{ color: t.cores.ink }}>Seus direitos:</B> só você vê estas respostas, pode baixá-las em Ajustes → Dados e elas são apagadas junto com a conta.</>, 3)}
          {item("info", <>É uma ferramenta pessoal baseada no questionário. <B style={{ color: t.cores.ink }}>Não é recomendação de investimento.</B></>, 4)}
        </View>
        {e.atual ? sub("Suas respostas anteriores já vêm marcadas: confirme ou mude.") : null}
      </View>
    );
  } else if (q) {
    corpo = (
      <View>
        <T style={{ fontSize: 12.5, color: t.cores.acento, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: t.espaco.e2 }}>{bl.nome} · {bl.eixo}</T>
        {h1(q.texto)}
        {q.multipla ? sub("Pode marcar mais de um.") : null}
        <View style={{ gap: 10, marginTop: t.espaco.e4 }} accessibilityRole={q.multipla ? undefined : "radiogroup"}>
          {q.opcoes.map((o: any) => {
            const m = marcado(o.id);
            return (
              <Pressable key={o.id} onPress={() => escolhe(o)} accessibilityRole={q.multipla ? "checkbox" : "radio"} accessibilityState={{ checked: !!m }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, paddingHorizontal: 18, minHeight: 56,
                  borderRadius: t.raios.r, borderWidth: 1.5, borderStyle: o.nd && !m ? "dashed" : "solid",
                  borderColor: m ? t.cores.acento : t.cores.linha, backgroundColor: m ? t.cores.acentoSuave : t.cores.bg2, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                <View style={{ width: 24, height: 24, borderRadius: q.multipla ? 7 : 12, alignItems: "center", justifyContent: "center",
                  borderWidth: 1.5, borderColor: m ? t.cores.acento : t.cores.linha2, backgroundColor: m ? t.cores.acento : "transparent" }}>
                  {m ? <Icone nome="check" tam={14} cor="#fff" /> : null}
                </View>
                <Text style={{ fontSize: 16, color: o.nd ? t.cores.ink2 : t.cores.ink, flex: 1 }}>{o.rotulo}</Text>
              </Pressable>
            );
          })}
        </View>
        {q.dinheiro ? sub("Guardamos só a faixa. “Prefiro não dizer” funciona, mas deixa o plano menos preciso.") : null}
        <Detalhes rotulo="Por que perguntamos?" style={{ marginTop: t.espaco.e4 }}>
          <T style={{ fontSize: 14, lineHeight: 21, color: t.cores.ink2 }}>{q.porque}</T>
        </Detalhes>
      </View>
    );
  } else {
    corpo = (
      <View>
        <IconeGrande nome="check" tam={32} />
        <View style={{ marginTop: t.espaco.e3 }}>{h1(pend.length ? "Faltam algumas respostas" : "Tudo pronto")}</View>
        {sub(pend.length ? `Faltam ${pend.length} pergunta${pend.length > 1 ? "s" : ""} que o cálculo exige.` : "Com as suas respostas, calculamos o perfil, o plano e a alocação.")}
        {pend.length ? (
          <View style={{ marginTop: t.espaco.e4, gap: 6 }}>
            {pend.map((id: string) => <Botao key={id} variante="texto" onPress={() => vai(perguntas.findIndex((x) => x.id === id) + 1)}>{FC.perfil.pergunta(id).texto}</Botao>)}
          </View>
        ) : null}
        {FC.perfil.opcionaisEmAberto(resp).length && !pend.length ? sub("Algumas perguntas opcionais ficaram para depois: elas aparecem no checklist do Início e deixam o plano mais preciso.") : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View style={{ width: "100%", maxWidth: 600, flex: 1, paddingTop: Math.max(16, insets.top), paddingHorizontal: 16, paddingBottom: Math.max(16, insets.bottom) }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 40 }}>
          <Botao variante="texto" pequeno icone="fechar" onPress={sair}>Sair e continuar depois</Botao>
          <T style={{ fontSize: 13, color: t.cores.ink2, fontWeight: "500" }}>{bl ? `Bloco ${bl.n} de ${P().blocos.length}` : ""}</T>
        </View>
        <View style={{ height: 4, borderRadius: 4, backgroundColor: t.cores.campo, overflow: "hidden", marginTop: 8, marginBottom: 16 }}>
          <View style={{ height: "100%", width: `${(i / (total + 1)) * 100}%` as any, borderRadius: 4, backgroundColor: "#0a84ff",
            ...degrade("linear-gradient(90deg, #0a84ff, #5e5ce6)"),
            ...(Platform.OS === "web" ? { transition: "width .4s cubic-bezier(.32,.72,0,1)" } : {}) } as any} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 2, paddingBottom: 24 }}>
          <Animated.View style={{ opacity: entra, transform: [{ translateX: entra.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }}>{corpo}</Animated.View>
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.cores.linha }}>
          <View style={{ opacity: i > 0 ? 1 : 0 }} pointerEvents={i > 0 ? "auto" : "none"}><Botao variante="sec" onPress={() => vai(i - 1)}>Voltar</Botao></View>
          {q && !q.essencial ? <Botao variante="texto" onPress={() => { delete resp[q.id]; vai(i + 1); }}>Pular por agora</Botao> : null}
          <Botao style={{ minWidth: 140, marginLeft: "auto" }} desabilitado={desabilitado} carregando={concluindo} onPress={avancar}>{rotuloAvancar}</Botao>
        </View>
      </View>
    </View>
  );
}

FC.perfilFluxo = { inicia, abre, convite, carrega, ativacao, dispo };
export { inicia, abre, convite, carrega, ativacao, dispo };
