/* O app autenticador da pessoa: qual é (escolhido na ativação do 2FA e
 * lembrado só neste aparelho), como mandar a conta nova para ele e como
 * abri-lo na hora do login.
 *
 * Adicionar: o Supabase devolve o link otpauth:// do fator; no celular, o
 * sistema entrega esse link ao autenticador instalado, que já abre com a conta
 * pronta para salvar. Abrir: não existe um link padrão "abra o autenticador";
 * cada app tem o seu (esquema no iPhone, pacote no Android). Quando não dá para
 * abrir, a tela diz para abrir pelo ícone. */
import { Linking, Platform } from "react-native";
import FC from "../nucleo";

export interface AppAutenticador {
  id: string;
  nome: string;
  /** esquema que abre o app (iPhone e, quando o app registra, Android) */
  esquema?: string;
  /** pacote no Android (abre pela intent no navegador e pela loja no app) */
  pacote?: string;
  /** só preenche o código sozinho, sem abrir app (Apple Senhas) */
  preenche?: boolean;
  so?: "ios" | "android";
}

export const APPS: AppAutenticador[] = [
  { id: "google", nome: "Google Authenticator", esquema: "googleauthenticator://", pacote: "com.google.android.apps.authenticator2" },
  { id: "microsoft", nome: "Microsoft Authenticator", esquema: "msauth://", pacote: "com.azure.authenticator" },
  { id: "apple", nome: "Apple Senhas", preenche: true, so: "ios" },
  { id: "1password", nome: "1Password", esquema: "onepassword://", pacote: "com.onepassword.android" },
  { id: "authy", nome: "Authy", esquema: "authy://", pacote: "com.authy.authy" },
];

const CHAVE = "autenticador-app";
const web = Platform.OS === "web";

export const ehCelular = (): boolean => !!(FC.dispositivo && FC.dispositivo.ehMobile);
const ehIOS = (): boolean => !!(FC.dispositivo && FC.dispositivo.ehIOS);
const ehAndroid = (): boolean => !!(FC.dispositivo && FC.dispositivo.ehAndroid);

/** os apps que fazem sentido neste aparelho */
export function appsDoAparelho(): AppAutenticador[] {
  return APPS.filter((a) => !a.so || (a.so === "ios" ? ehIOS() : ehAndroid()) || !ehCelular());
}

export function appEscolhido(): AppAutenticador | null {
  const id = FC.local.ler(CHAVE, null);
  return APPS.find((a) => a.id === id) || null;
}
export function escolheApp(id: string | null) {
  FC.local.gravar(CHAVE, id);
}

/** manda a conta nova para o autenticador (link otpauth:// do Supabase) */
export async function adicionaAoAutenticador(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    if (web) { window.location.href = uri; return true; }
    await Linking.openURL(uri);
    return true;
  } catch { return false; }
}

/** abre o autenticador escolhido; false quando o aparelho não deixou */
export async function abreAutenticador(app: AppAutenticador): Promise<boolean> {
  if (app.preenche) return false;
  try {
    if (web) {
      // no Chrome do Android, a intent abre o app pelo pacote; no iPhone, o esquema
      if (ehAndroid() && app.pacote) window.location.href = `intent://#Intent;package=${app.pacote};end`;
      else if (app.esquema) window.location.href = app.esquema;
      else return false;
      return true;
    }
    if (app.esquema && Platform.OS === "ios") { await Linking.openURL(app.esquema); return true; }
    if (Platform.OS === "android") {
      if (app.esquema) { try { await Linking.openURL(app.esquema); return true; } catch { /* sem esquema registrado: tenta pelo pacote */ } }
      if (app.pacote) { await Linking.openURL(`market://launch?id=${app.pacote}`); return true; }
    }
    return false;
  } catch { return false; }
}
