/* Uso do app, para o painel do administrador — de forma ANÔNIMA (LGPD). Port
 * de uso.js, com as mesmas garantias:
 *  - nada de user_id ou e-mail: o "visitante" é um código aleatório do
 *    aparelho, trocado a cada 90 dias;
 *  - a tela é só o nome da rota (/ativos/PETR4 vira "ativos");
 *  - textos passam pelo filtro que tira e-mails, tickers, valores e números.
 * Telas, cliques e folhas só com consentimento (Ajustes → Privacidade); erros
 * técnicos, sem dado pessoal, sempre.
 *
 * Diferença do site: no nativo não há como ouvir todo clique da página; lá se
 * registram telas, folhas e erros. No web, os cliques também. */
import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { useTema } from "../tema";
import { useMedidas } from "../ui/medidas";
import { Botao } from "../ui/kit";
import FC from "../nucleo";

const MAX_FILA = 40, INTERVALO = 15000, SESSAO_OCIOSA = 30 * 60 * 1000;
const ATRIBUTOS_OK = ["rota", "acao", "p", "v", "m", "rv", "t", "cmp", "comeca", "aba", "modo", "tipo", "periodo", "vista", "filtro", "inicio-agro", "modulo"];

const aleatorio = () => {
  const a = new Uint8Array(12);
  if (globalThis.crypto && (globalThis.crypto as any).getRandomValues) (globalThis.crypto as any).getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
};

function visitante() {
  let v = FC.local.ler("anon-v", null), em = Number(FC.local.ler("anon-em", 0)) || 0;
  if (!v || Date.now() - em > 90 * 864e5) { v = aleatorio(); FC.local.gravar("anon-v", v); FC.local.gravar("anon-em", Date.now()); }
  return v;
}
let sess: string | null = null, sessUlt = 0;
function sessao() {
  if (!sess || Date.now() - sessUlt > SESSAO_OCIOSA) sess = aleatorio();
  sessUlt = Date.now();
  return sess;
}
const aparelho = () => {
  const w = Platform.OS === "web" && typeof window !== "undefined" ? window.innerWidth : require("react-native").Dimensions.get("window").width; // eslint-disable-line @typescript-eslint/no-require-imports
  return w < 640 ? "celular" : w < 1024 ? "tablet" : "computador";
};

export function limpaTexto(t: any, max = 60) {
  return String(t || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>")
    .replace(/\b[A-Z]{4}\d{1,2}\b/g, "<ticker>")
    .replace(/R\$\s?[\d.,]+/g, "<valor>")
    .replace(/\d+([.,]\d+)*/g, "#")
    .replace(/\s+/g, " ").trim().slice(0, max);
}

// a rota sem os parâmetros (que podem ter ticker ou nome de título)
let rotaAtualUso = "inicio";
const rotaPrefixo = () => rotaAtualUso;

let fila: any[] = [], ligado = false, consente = false;
function grava(tipo: string, campos: any = {}) {
  if (!ligado) return;
  if (tipo !== "erro" && !consente) return;
  fila.push({ quando: new Date().toISOString(), visitante: visitante(), sessao: sessao(), tipo, rota: rotaPrefixo(), aparelho: aparelho(), detalhe: {}, ...campos });
  if (fila.length >= MAX_FILA) envia();
}
async function envia() {
  if (!fila.length) return;
  const lote = fila.splice(0, fila.length);
  try { const { error } = await FC.sb.from("uso_eventos").insert(lote); if (error) throw error; } catch { /* métrica nunca trava o app */ }
}

// ---------------------------------------------------------------- telas e tempo
let telaAtual: string | null = null, telaDesde = 0, ocultoMs = 0, ocultoDesde: number | null = null;
function fechaTela() {
  if (!telaAtual) return;
  const agora = Date.now();
  const dur = agora - telaDesde - ocultoMs - (ocultoDesde ? agora - ocultoDesde : 0);
  grava("tela", { rota: telaAtual, alvo: "saida", duracao_ms: Math.max(0, Math.min(dur, 86400000)) });
}
function novaTela() {
  const r = rotaPrefixo();
  if (r === telaAtual) return;
  fechaTela();
  telaAtual = r; telaDesde = Date.now(); ocultoMs = 0; ocultoDesde = null;
  grava("tela", { rota: r, alvo: "entrada" });
}
/** a casca avisa quando a rota muda: "/retrospectiva/mes/x" → "retrospectiva/mes" */
export function rotaMudou(caminho: string) {
  const p = caminho.replace(/^\/+/, "").split("/");
  rotaAtualUso = (p[0] === "retrospectiva" && /^(mes|ano)$/.test(p[1] || "") ? "retrospectiva/" + p[1] : p[0] || "inicio").slice(0, 40);
  novaTela();
}

function erro(e: any, onde: string) {
  const msg = (e && (e.message || e.error_description || e.msg)) || String(e || "");
  if (!msg || /ResizeObserver loop/.test(msg)) return;
  const pilha = e && e.stack ? String(e.stack).split("\n").find((l: string) => /src\/|assets\/js\//.test(l)) : "";
  const local = pilha ? (pilha.match(/(src|assets\/js)\/[\w/.-]+:\d+/) || [""])[0] : "";
  grava("erro", { alvo: limpaTexto(msg, 120), detalhe: { onde, local } });
}

// descreve um elemento clicável (só web) sem dizer nada sobre a pessoa
function descreve(el: any) {
  if (el.id && !/\d{3,}/.test(el.id)) return "#" + el.id;
  for (const a of ATRIBUTOS_OK) {
    const v = el.getAttribute("data-" + a);
    if (v != null && v.length <= 30 && !/\d{2,}|[A-Z]{4}\d/.test(v)) return `[${a}=${v}]`;
  }
  const rotulo = el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent;
  const txt = limpaTexto(rotulo, 40);
  const tag = (el.getAttribute("role") || el.tagName.toLowerCase());
  return txt && !/^[#<>\s]*$/.test(txt) ? `${tag} “${txt}”` : tag;
}

function liga() {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.addEventListener("click", (e: any) => {
      const el = e.target.closest && e.target.closest("a, button, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], select, input[type=checkbox]");
      if (!el) return;
      const naFolha = el.closest("[aria-modal=true]");
      grava("clique", { alvo: descreve(el).slice(0, 120), detalhe: naFolha ? { folha: limpaTexto(naFolha.getAttribute("aria-label"), 50) } : {} });
    }, true);
    window.addEventListener("error", (e: any) => erro(e.error || e.message, "janela"));
    window.addEventListener("unhandledrejection", (e: any) => erro(e.reason, "promessa"));
    window.addEventListener("pagehide", () => { fechaTela(); envia(); });
  } else {
    const g: any = globalThis as any;
    const anterior = g.ErrorUtils && g.ErrorUtils.getGlobalHandler && g.ErrorUtils.getGlobalHandler();
    if (g.ErrorUtils && g.ErrorUtils.setGlobalHandler) g.ErrorUtils.setGlobalHandler((e: any, fatal: boolean) => { erro(e, "janela"); anterior && anterior(e, fatal); });
  }
  AppState.addEventListener("change", (st) => {
    if (st !== "active") { ocultoDesde = Date.now(); envia(); }
    else if (ocultoDesde) { ocultoMs += Date.now() - ocultoDesde; ocultoDesde = null; }
  });
  // folhas: abrir, enviar e fechar (com ou sem enviar)
  const folhaOriginal = FC.ui.folha;
  FC.ui.folha = function (op: any) {
    const titulo = limpaTexto(op.titulo, 50) || "folha";
    const abriu = Date.now();
    const aoFechar = op.aoFechar;
    grava("folha_abre", { alvo: titulo, detalhe: { form: !!op.rodape } });
    return folhaOriginal.call(this, { ...op, aoFechar: () => {
      grava("folha_fecha", { alvo: titulo, duracao_ms: Math.min(Date.now() - abriu, 86400000), detalhe: {} });
      aoFechar && aoFechar();
    } });
  };
  const erroOriginal = FC.ui.erro;
  FC.ui.erro = function (e: any) { erro(e, "tela"); return erroOriginal.apply(this, arguments as any); };
  setInterval(() => envia(), INTERVALO);
}

// ---------------------------------------------------------------- consentimento
function lerConsentimento() {
  const u = FC.auth.usuario;
  const c = u && u.user_metadata && u.user_metadata.consentimento_uso;
  return c ? !!c.aceito : null; // null = ainda não respondeu
}
async function defineConsentimento(aceito: boolean) {
  const r = await FC.sb.auth.updateUser({ data: { consentimento_uso: { aceito, em: new Date().toISOString().slice(0, 10), versao: 1 } } });
  if (r.data && r.data.user) FC.auth.usuario = r.data.user;
  consente = aceito;
  if (aceito) { telaAtual = null; novaTela(); }
}
const useAvisoUso = create<{ aberto: boolean }>(() => ({ aberto: false }));
function pedeConsentimento() {
  if (lerConsentimento() !== null) return;
  useAvisoUso.setState({ aberto: true });
}

/** o cartão "Ajude a melhorar o Bullz" (sobe de baixo) */
export function AvisoUso() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { estreito, celular } = useMedidas();
  const aberto = useAvisoUso((s) => s.aberto);
  const [montado, setMontado] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (aberto) setMontado(true);
    Animated.timing(a, { toValue: aberto ? 1 : 0, duration: 350, easing: Easing.bezier(0.2, 0.9, 0.3, 1), useNativeDriver: Platform.OS !== "web" })
      .start(() => { if (!aberto) setMontado(false); });
  }, [aberto, a]);
  if (!montado) return null;
  const responde = async (sim: boolean) => {
    useAvisoUso.setState({ aberto: false });
    try { await defineConsentimento(sim); } catch { /* tenta de novo na próxima visita */ }
  };
  return (
    <Animated.View accessibilityRole="alert" accessibilityLabel="Privacidade"
      style={{ position: "absolute", alignSelf: "center", bottom: (celular ? 84 : 16) + insets.bottom, width: "100%", maxWidth: 560, paddingHorizontal: 16, zIndex: 60,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [240, 0] }) }] }}>
      <View style={{ flexDirection: estreito ? "column" : "row", gap: 14, alignItems: estreito ? "stretch" : "flex-end", paddingVertical: 16, paddingHorizontal: 18,
        borderRadius: 18, backgroundColor: t.cores.bg2, borderWidth: 1, borderColor: t.cores.linha, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" } as any}>
        <View style={{ flex: estreito ? undefined : 1 }}>
          <Text style={{ color: t.cores.ink, fontWeight: "600", fontSize: 14 }}>Ajude a melhorar o Bullz</Text>
          <Text style={{ color: t.cores.ink2, fontSize: 14, lineHeight: 20, marginTop: 4 }}>Podemos registrar, de forma anônima, as telas que você abre e os botões que toca — nunca seus valores, ativos, nome ou e-mail. Os dados somem em 180 dias e você muda de ideia quando quiser em Ajustes → Privacidade.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
          <Botao variante="sec" pequeno onPress={() => responde(false)}>Agora não</Botao>
          <Botao pequeno onPress={() => responde(true)}>Aceitar</Botao>
        </View>
      </View>
    </Animated.View>
  );
}

FC.uso = {
  // chamado ao entrar no app (usuário já conhecido)
  inicia() {
    consente = lerConsentimento() === true;
    if (!ligado) { ligado = true; liga(); }
    telaAtual = null;
    novaTela();
  },
  para() { fechaTela(); envia(); telaAtual = null; },
  pedeConsentimento, defineConsentimento, lerConsentimento,
  _limpa: limpaTexto, envia,
};
