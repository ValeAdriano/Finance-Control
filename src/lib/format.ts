/**
 * Formatacao pt-BR centralizada. Nada de `toLocaleString` espalhado pelo
 * codigo: a moeda, a casa decimal e o sinal precisam ser os mesmos em toda a
 * interface, senao a leitura de numero fica inconsistente entre telas.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const USD = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" });

export function brl(value: number, compact = false): string {
  return (compact ? BRL_COMPACT : BRL).format(value);
}

export function usd(value: number): string {
  return USD.format(value);
}

export function money(value: number, currency: "BRL" | "USD", compact = false): string {
  return currency === "USD" ? usd(value) : brl(value, compact);
}

/** Percentual a partir de uma fracao: 0.0525 -> "5,25%". */
export function percent(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Percentual com sinal explicito, para variacao. Cor sozinha nao e acessivel. */
export function signedPercent(value: number, decimals = 2): string {
  const formatted = percent(Math.abs(value), decimals);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}`;
}

export function signedBrl(value: number, compact = false): string {
  const formatted = brl(Math.abs(value), compact);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}`;
}

export function decimal(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Quantidade de cota/ativo: cripto precisa de casas, acao nao. */
export function quantity(value: number): string {
  return Number.isInteger(value) ? decimal(value, 0) : decimal(value, 8).replace(/0+$/, "");
}

/** Data ISO (`2026-09-21`) para `21/09/2026`, sem depender de fuso. */
export function date(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function shortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `2026-09` para `set/26`, usado nos eixos de grafico. */
export function monthLabel(iso: string): string {
  const [year, month] = iso.slice(0, 7).split("-");
  return `${MONTHS[Number(month) - 1]}/${year.slice(2)}`;
}

export function monthName(iso: string): string {
  const [year, month] = iso.slice(0, 7).split("-");
  const full = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${full[Number(month) - 1]} de ${year}`;
}

/** Direcao de uma variacao, para escolher cor e seta de forma consistente. */
export function trend(value: number): "up" | "down" | "flat" {
  if (value > 0.00005) return "up";
  if (value < -0.00005) return "down";
  return "flat";
}
