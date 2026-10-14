import { Redirect } from "expo-router";
import { rotaLegada } from "../src/plataforma/adaptacoes";
// "/#/ativos" (link do site antigo) → "/ativos"; o resto vai para o Início
export default function Index() { return <Redirect href={(rotaLegada() || "/inicio") as any} />; }
