/* Módulos que se registram em FC (como os scripts do site) e a sequência de
 * entrada do app.js: telemetria → perfil → apresentação → consentimento. */
import "./perfil/relatorio";
import "./perfil/resultado";
import "./ajuda";
import "./onboarding";
import "./aportes";
import "../estado/uso";
import { Platform } from "react-native";
import { aoEntrar } from "../estado/app";
import FC from "../nucleo";

// quem chegou para autorizar um assistente de IA (/oauth/consent) veio fazer
// só isso: nada de questionário, apresentação ou pedido de coleta por cima
const veioAutorizar = () => Platform.OS === "web" && typeof window !== "undefined" && window.location.pathname.startsWith("/oauth/");

aoEntrar.push(async () => {
  FC.uso.inicia();
  if (veioAutorizar()) return;
  // o questionário de perfil é o onboarding: conta nova vai direto para ele.
  // Sem as tabelas no banco, cai na apresentação por passos.
  let abriuPerfil = false;
  try { abriuPerfil = await FC.perfilFluxo.inicia(); } catch (e) { console.error(e); }
  if (!abriuPerfil && FC.onboarding.precisa() && !(FC.estado.perfil && !FC.estado.perfil.indisponivel)) FC.onboarding.abre();
  // pede a coleta anônima depois do onboarding, nunca por cima dele
  else setTimeout(() => FC.uso.pedeConsentimento(), 2500);
});
