import type { TransactionKind } from "@/types/domain";

export const TRANSACTION_LABEL: Record<TransactionKind, string> = {
  compra: "Compra",
  venda: "Venda",
  dividendo: "Dividendo",
  juros: "Juros",
  aporte: "Aporte",
  resgate: "Resgate",
  taxa: "Taxa",
};
