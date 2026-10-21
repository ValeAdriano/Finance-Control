/* A vibração do app, com significado fixo (como as do sistema):
 *   toque: trocou uma opção (período, aba, interruptor)
 *   leve:  pegou ou soltou algo (folha, módulo, puxar para atualizar)
 *   ok:    uma ação deu certo (salvou, atualizou, 2FA ligado)
 *   erro:  uma ação falhou
 * Pouca e sempre ligada a um toque da pessoa: nada vibra sozinho. Vale no
 * celular (no PWA, o expo-haptics usa o navigator.vibrate no Android e o
 * interruptor nativo no iPhone); no computador não faz nada. Desliga em
 * Ajustes › Aparência. */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import FC from "../nucleo";

const CHAVE = "vibracao";

/** se o aparelho tem o que vibrar (celular ou app nativo) */
export const podeVibrar = (): boolean => Platform.OS !== "web" || !!(FC.dispositivo && FC.dispositivo.ehMobile);
export const vibracaoLigada = (): boolean => FC.local.ler(CHAVE, true) !== false;
export const ligaVibracao = (v: boolean) => FC.local.gravar(CHAVE, v);

function faz(fn: () => Promise<void>) {
  if (!podeVibrar() || !vibracaoLigada()) return;
  try { fn().catch(() => {}); } catch { /* aparelho sem motor */ }
}

export const vibra = {
  toque: () => faz(() => Haptics.selectionAsync()),
  leve: () => faz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  ok: () => faz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  erro: () => faz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
