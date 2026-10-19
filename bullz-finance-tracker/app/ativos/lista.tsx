import { Redirect } from "expo-router";
// "Minha lista" virou a tela padrão de /ativos; o endereço antigo continua valendo
export default function ListaLegada() { return <Redirect href={"/ativos" as any} />; }
