import type { AssetClass } from "@/types/domain";

/**
 * Apuracao de IR sobre venda, usada pelo simulador antes de confirmar a
 * operacao. As regras sao as da pessoa fisica no Brasil.
 *
 * Nada aqui substitui conferencia com contador — o objetivo e mostrar a ordem
 * de grandeza do imposto antes de vender, nao emitir declaracao.
 */

/** Teto mensal de venda isenta de acoes (swing trade). */
export const STOCK_MONTHLY_EXEMPTION = 20_000;
/** Teto mensal de venda isenta de cripto. */
export const CRYPTO_MONTHLY_EXEMPTION = 35_000;
/** Abaixo disso o DARF nao e recolhido no mes; acumula para o mes seguinte. */
export const DARF_MINIMUM = 10;

export interface SaleInput {
  assetClass: AssetClass;
  quantity: number;
  /** Custo medio por unidade, na moeda de apuracao (BRL). */
  averagePrice: number;
  /** Preco de venda por unidade. */
  salePrice: number;
  /** Corretagem, emolumentos e taxas da operacao. */
  fees?: number;
  /** Quanto ja foi vendido dessa classe no mes, para o teste de isencao. */
  monthlySalesSoFar?: number;
  /** Prejuizo acumulado compensavel da mesma classe. */
  accumulatedLoss?: number;
  /** Day trade tem aliquota propria e nao tem isencao. */
  dayTrade?: boolean;
  /** Renda fixa: dias corridos entre aplicacao e resgate (tabela regressiva). */
  daysHeld?: number;
  /** Renda fixa isenta (LCI, LCA, CRI, CRA, debênture incentivada). */
  isTaxExempt?: boolean;
}

export interface SaleResult {
  grossAmount: number;
  cost: number;
  fees: number;
  /** Resultado antes de compensar prejuizo. Negativo = prejuizo. */
  grossGain: number;
  /** Prejuizo acumulado efetivamente usado. */
  lossUsed: number;
  taxableGain: number;
  taxRate: number;
  tax: number;
  /** Quanto entra na conta depois do imposto. */
  netAmount: number;
  /** Prejuizo a carregar para os proximos meses. */
  remainingLoss: number;
  exempt: boolean;
  /** Precisa emitir DARF neste mes? */
  darfDue: boolean;
  /** Explicacao da regra aplicada, exibida no simulador. */
  rationale: string;
}

export function simulateSale(input: SaleInput): SaleResult {
  const fees = input.fees ?? 0;
  const grossAmount = input.quantity * input.salePrice;
  const cost = input.quantity * input.averagePrice;
  const grossGain = grossAmount - cost - fees;

  const { exempt, rationale: exemptionRationale } = checkExemption(input, grossAmount);

  const accumulatedLoss = input.accumulatedLoss ?? 0;

  if (exempt || grossGain <= 0) {
    // Prejuizo em operacao isenta nao e compensavel; em operacao tributada, acumula.
    const remainingLoss =
      grossGain < 0 && !exempt ? accumulatedLoss + Math.abs(grossGain) : accumulatedLoss;

    return {
      grossAmount,
      cost,
      fees,
      grossGain,
      lossUsed: 0,
      taxableGain: 0,
      taxRate: 0,
      tax: 0,
      netAmount: grossAmount - fees,
      remainingLoss,
      exempt,
      darfDue: false,
      rationale: exempt
        ? exemptionRationale
        : grossGain < 0
          ? "Prejuízo na operação — nada a pagar, e o valor fica acumulado para compensar ganhos futuros."
          : "Sem ganho tributável nesta operação.",
    };
  }

  const lossUsed = Math.min(accumulatedLoss, grossGain);
  const taxableGain = grossGain - lossUsed;
  const taxRate = rateFor(input, taxableGain);
  const tax = round2(taxableGain * taxRate);

  return {
    grossAmount,
    cost,
    fees,
    grossGain,
    lossUsed,
    taxableGain,
    taxRate,
    tax,
    netAmount: round2(grossAmount - fees - tax),
    remainingLoss: accumulatedLoss - lossUsed,
    exempt: false,
    darfDue: tax >= DARF_MINIMUM,
    rationale: rationaleFor(input, taxRate, tax, lossUsed),
  };
}

function checkExemption(
  input: SaleInput,
  grossAmount: number,
): { exempt: boolean; rationale: string } {
  const monthlySales = (input.monthlySalesSoFar ?? 0) + grossAmount;

  if (input.assetClass === "acao" && !input.dayTrade && monthlySales <= STOCK_MONTHLY_EXEMPTION) {
    return {
      exempt: true,
      rationale: `Venda isenta: ${formatBrl(monthlySales)} vendidos no mês, dentro do limite de ${formatBrl(STOCK_MONTHLY_EXEMPTION)} para ações em swing trade.`,
    };
  }

  if (input.assetClass === "cripto" && monthlySales <= CRYPTO_MONTHLY_EXEMPTION) {
    return {
      exempt: true,
      rationale: `Venda isenta: ${formatBrl(monthlySales)} vendidos no mês, dentro do limite de ${formatBrl(CRYPTO_MONTHLY_EXEMPTION)} para cripto.`,
    };
  }

  if (input.assetClass === "renda_fixa" && input.isTaxExempt) {
    return {
      exempt: true,
      rationale:
        "Título isento de IR para pessoa física (LCI, LCA, CRI, CRA ou debênture incentivada).",
    };
  }

  return { exempt: false, rationale: "" };
}

function rateFor(input: SaleInput, taxableGain: number): number {
  switch (input.assetClass) {
    case "acao":
      return input.dayTrade ? 0.2 : 0.15;
    case "fii":
      // FII nao tem isencao na venda da cota — so o rendimento mensal e isento.
      return 0.2;
    case "cripto":
      return cryptoProgressiveRate(taxableGain);
    case "renda_fixa":
      return regressiveRate(input.daysHeld ?? 0);
    case "agro":
      // Ganho de capital comum, pela mesma tabela progressiva.
      return cryptoProgressiveRate(taxableGain);
  }
}

/** Tabela progressiva de ganho de capital (cripto e demais bens). */
export function cryptoProgressiveRate(gain: number): number {
  if (gain <= 5_000_000) return 0.15;
  if (gain <= 10_000_000) return 0.175;
  if (gain <= 30_000_000) return 0.2;
  return 0.225;
}

/** Tabela regressiva de IR da renda fixa, por prazo em dias corridos. */
export function regressiveRate(daysHeld: number): number {
  if (daysHeld <= 180) return 0.225;
  if (daysHeld <= 360) return 0.2;
  if (daysHeld <= 720) return 0.175;
  return 0.15;
}

function rationaleFor(input: SaleInput, taxRate: number, tax: number, lossUsed: number): string {
  const parts: string[] = [];

  switch (input.assetClass) {
    case "acao":
      parts.push(
        input.dayTrade
          ? "Day trade em ações: alíquota de 20% sobre o ganho, sem isenção mensal."
          : `Swing trade acima de ${formatBrl(STOCK_MONTHLY_EXEMPTION)} no mês: alíquota de 15% sobre o ganho.`,
      );
      break;
    case "fii":
      parts.push("Venda de cota de FII: 20% sobre o ganho, sem faixa de isenção.");
      break;
    case "cripto":
      parts.push(
        `Ganho de capital em cripto acima de ${formatBrl(CRYPTO_MONTHLY_EXEMPTION)} no mês: alíquota de ${formatPct(taxRate)}.`,
      );
      break;
    case "renda_fixa":
      parts.push(
        `Tabela regressiva por ${input.daysHeld ?? 0} dias de aplicação: alíquota de ${formatPct(taxRate)}.`,
      );
      break;
    case "agro":
      parts.push(`Ganho de capital: alíquota de ${formatPct(taxRate)}.`);
      break;
  }

  if (lossUsed > 0) parts.push(`${formatBrl(lossUsed)} de prejuízo acumulado foram compensados.`);
  parts.push(
    tax >= DARF_MINIMUM
      ? `DARF de ${formatBrl(tax)} a recolher até o último dia útil do mês seguinte.`
      : `Imposto de ${formatBrl(tax)} abaixo do mínimo de ${formatBrl(DARF_MINIMUM)} — acumula para o próximo DARF.`,
  );

  return parts.join(" ");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}
