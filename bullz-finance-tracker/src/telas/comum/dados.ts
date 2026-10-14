/* Rotinas de gravação compartilhadas (comum.js): premissas, dados extras dos
 * títulos, "depois de mudar" (relê, completa o mercado e repinta). */
import FC from "../../nucleo";
import { rerender } from "../../estado/app";
import { ui } from "../../ui/folha";

// objetivos e dados extras dos títulos moram em preferencias.premissas.
// gravaPrefs sobrescreve o jsonb inteiro: sempre mescla com o que já está lá.
export async function gravaPremissas(parcial: any) {
  const b = FC.estado.base;
  const atuais = (b.prefsBrutas && b.prefsBrutas.premissas) || {};
  const premissas = { ...atuais, ...parcial };
  await FC.db.gravaPrefs({ premissas });
  b.prefsBrutas = { ...(b.prefsBrutas || {}), premissas };
  return premissas;
}

// grava (ou apaga, com null) o que se sabe de um título além da tabela
export function gravaInfoTitulo(id: any, info: any) {
  const b = FC.estado.base;
  const titulos = { ...(((b.prefsBrutas || {}).premissas || {}).titulos || {}) };
  if (info) titulos[id] = { ...(titulos[id] || {}), ...info }; else delete titulos[id];
  return gravaPremissas({ titulos });
}

// depois de gravar: relê o banco, completa o mercado e repinta
export async function depoisDeMudar(msg?: string, mercado = false) {
  try {
    await FC.recarregaBase();
    if (mercado) await FC.completaMercado();
    rerender();
    if (msg) ui.aviso(msg);
  } catch (e) { ui.erro(e); }
}

export const acharAtivo = (ticker: string) => ((FC.estado.dados && FC.estado.dados.ativos) || []).find((a: any) => a.ticker === ticker);

// aportes manuais em um título (os de extrato não somam ao saldo)
export function aportadoRf(nome: string) {
  return FC.soma(FC.estado.base.aportes.filter((a: any) => a.tipo === "caixa" && a.titulo === nome && !a.historico && !a.origem), (a: any) => a.valor);
}

export function adivinhaClasse(t: string) {
  const u = FC.estado.mercado.universo || { fiis: {}, acoes: {} };
  if (u.fiis[t]) return "fii";
  if (u.acoes[t]) return "acao_br";
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return "etf_br"; // padrão B3 fora do Fundamentus: ETF
  return "cripto";
}

// o comum.js expõe estas em FC.comum; mantém os nomes para quem chama por lá
FC.comum = Object.assign(FC.comum || {}, { gravaPremissas, gravaInfoTitulo, depoisDeMudar, acharAtivo, aportadoRf, adivinhaClasse, rotuloData: (iso: string) => FC.datas.br(iso) });
