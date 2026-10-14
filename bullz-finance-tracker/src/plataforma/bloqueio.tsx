/* Bloqueio do app por biometria ou PIN do aparelho (PLANO-SEGURANCA S1.2).
 *
 * Ligado em Ajustes → Segurança: ao abrir o app, e ao voltar depois de N
 * minutos em segundo plano, pede Face ID / digital / PIN. Ao sair do app a
 * tela é coberta (com o bloqueio ligado ou não), para a prévia do
 * multitarefa não mostrar valores.
 *
 * Só no celular; no navegador não há o que pedir. A preferência fica neste
 * aparelho (MMKV cifrado), não na conta. */
import React, { useEffect, useRef, useState } from "react";
import { AppState, Image, Platform, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { create } from "zustand";
import { useTema } from "../tema";
import { useApp } from "../estado/app";
import { Botao, T } from "../ui/kit";
import FC from "../nucleo";

export const BLOQUEIO_DISPONIVEL = Platform.OS !== "web";
export const TEMPOS = [0, 1, 5, 15];

interface Prefs { ligado: boolean; minutos: number }
const CHAVE = "bloqueio";
const lePrefs = (): Prefs => ({ ligado: false, minutos: 5, ...(FC.local.ler(CHAVE, null) || {}) });

interface EstadoBloqueio extends Prefs { travado: boolean; coberto: boolean }
export const useBloqueio = create<EstadoBloqueio>(() => {
  const p = lePrefs();
  // abertura a frio com o bloqueio ligado: começa travado
  return { ...p, travado: BLOQUEIO_DISPONIVEL && p.ligado, coberto: false };
});

export function gravaBloqueio(p: Partial<Prefs>) {
  const novo = { ...lePrefs(), ...p };
  FC.local.gravar(CHAVE, novo);
  useBloqueio.setState(novo);
}

/** O que o aparelho oferece: nome para a tela e se dá para ligar. */
export async function recursoDoAparelho(): Promise<{ pode: boolean; nome: string }> {
  if (!BLOQUEIO_DISPONIVEL) return { pode: false, nome: "" };
  try {
    const nivel = await LocalAuthentication.getEnrolledLevelAsync();
    const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const temBio = nivel >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
    const nome = !temBio ? "PIN do aparelho"
      : tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? (Platform.OS === "ios" ? "Face ID" : "reconhecimento facial")
      : tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ? (Platform.OS === "ios" ? "Touch ID" : "digital")
      : "biometria";
    return { pode: nivel > LocalAuthentication.SecurityLevel.NONE, nome };
  } catch {
    return { pode: false, nome: "" };
  }
}

// o próprio pedido de biometria tira o app do primeiro plano no iOS: esses
// vai-e-volta não contam como saída
let autenticando = false;
export async function autentica(mensagem = "Desbloquear o Bullz"): Promise<boolean> {
  autenticando = true;
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: mensagem, cancelLabel: "Cancelar", disableDeviceFallback: false });
    return r.success;
  } catch {
    return false;
  } finally {
    setTimeout(() => { autenticando = false; }, 800);
  }
}

/** Cobertura e tela de desbloqueio, por cima de tudo. Montada na raiz. */
export function Bloqueio() {
  const t = useTema();
  const fase = useApp((s) => s.fase);
  const { ligado, travado, coberto } = useBloqueio();
  const saiuEm = useRef<number | null>(null);
  const [falhou, setFalhou] = useState(false);

  // sem sessão não há o que proteger; depois do login com senha, não pede de novo
  useEffect(() => {
    if (fase === "login" || fase === "mfa") useBloqueio.setState({ travado: false });
  }, [fase]);

  useEffect(() => {
    if (!BLOQUEIO_DISPONIVEL) return;
    const sub = AppState.addEventListener("change", (st) => {
      if (autenticando) return;
      if (st !== "active") {
        if (saiuEm.current == null) saiuEm.current = Date.now();
        useBloqueio.setState({ coberto: true });
        return;
      }
      const fora = saiuEm.current == null ? 0 : Date.now() - saiuEm.current;
      saiuEm.current = null;
      const s = useBloqueio.getState();
      const trava = s.ligado && useApp.getState().fase === "app" && fora >= s.minutos * 60 * 1000;
      useBloqueio.setState({ coberto: false, travado: s.travado || trava });
    });
    return () => sub.remove();
  }, []);

  const desbloqueia = async () => {
    setFalhou(false);
    if (await autentica()) useBloqueio.setState({ travado: false });
    else setFalhou(true);
  };

  const pedir = BLOQUEIO_DISPONIVEL && ligado && travado && fase === "app";
  useEffect(() => { if (pedir && AppState.currentState === "active") desbloqueia(); }, [pedir]);  

  if (!BLOQUEIO_DISPONIVEL || fase !== "app" || !(pedir || coberto)) return null;
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.cores.bg, alignItems: "center", justifyContent: "center", padding: t.espaco.e5, zIndex: 1000 }}
      accessibilityViewIsModal>
      <Image source={require("../../assets/img/icone-512.png")} style={{ width: 72, height: 72, borderRadius: 20, marginBottom: t.espaco.e4 }} resizeMode="contain" accessibilityLabel="Bullz" />
      {pedir ? (
        <View style={{ alignItems: "center", gap: 12, maxWidth: 320 }}>
          <T style={{ fontSize: 22, fontWeight: "600" }} accessibilityRole="header">Bullz bloqueado</T>
          <T centro style={{ color: t.cores.ink2 }}>{falhou ? "Não deu para confirmar. Tente de novo." : "Confirme que é você para ver sua carteira."}</T>
          <Botao cheio onPress={desbloqueia}>Desbloquear</Botao>
          <Botao variante="texto" onPress={() => FC.sair()}>Sair da conta</Botao>
        </View>
      ) : null}
    </View>
  );
}
