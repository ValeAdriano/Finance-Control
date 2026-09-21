import type { Holding, TransactionKind } from "@/types/domain";

/**
 * Efeito de uma movimentação sobre a posição.
 *
 * O custo médio mora aqui porque é o número que o cálculo de imposto usa e que
 * **nenhuma integração consegue trazer**: a corretora informa saldo e cotação,
 * não quanto você pagou. Errar aqui é errar o IR de toda venda futura.
 *
 * Regra brasileira: compra recalcula a média ponderada (taxas entram no custo);
 * venda reduz a quantidade e **não** mexe no custo médio por unidade.
 */

export interface PositionState {
  quantity: number;
  averagePrice: number;
}

export interface TransactionInput {
  kind: TransactionKind;
  quantity: number;
  unitPrice: number;
  fees?: number;
}

export class PositionError extends Error {}

export function applyTransaction(
  position: PositionState,
  transaction: TransactionInput,
): PositionState {
  const fees = transaction.fees ?? 0;
  const { kind, quantity, unitPrice } = transaction;

  if (quantity < 0 || unitPrice < 0 || fees < 0) {
    throw new PositionError("Quantidade, preço e taxas não podem ser negativos.");
  }

  switch (kind) {
    case "compra":
    case "aporte": {
      const newQuantity = position.quantity + quantity;
      if (newQuantity === 0) return { quantity: 0, averagePrice: 0 };

      // A taxa entra no custo de aquisição: é dinheiro que saiu para ter o
      // ativo, e reduz o ganho tributável na venda.
      const totalCost = position.quantity * position.averagePrice + quantity * unitPrice + fees;

      return { quantity: newQuantity, averagePrice: totalCost / newQuantity };
    }

    case "venda":
    case "resgate": {
      if (quantity > position.quantity + 1e-9) {
        throw new PositionError(
          `Não é possível vender ${quantity} — a posição tem ${position.quantity}.`,
        );
      }

      const remaining = round8(position.quantity - quantity);

      // Zerou a posição: o custo médio deixa de existir. Mantê-lo faria a
      // próxima compra herdar um preço que não é mais base de nada.
      if (remaining === 0) return { quantity: 0, averagePrice: 0 };

      // Venda não altera o custo médio por unidade — é a regra da apuração.
      return { quantity: remaining, averagePrice: position.averagePrice };
    }

    // Provento e taxa não mexem na posição; entram no histórico e, no caso do
    // provento, na renda.
    case "dividendo":
    case "juros":
    case "taxa":
      return position;
  }
}

/** Reconstrói a posição do zero a partir do histórico, na ordem cronológica. */
export function rebuildPosition(transactions: TransactionInput[]): PositionState {
  return transactions.reduce<PositionState>(applyTransaction, { quantity: 0, averagePrice: 0 });
}

/** Posição em formato de `Holding`, para gravar no banco. */
export function toHoldingUpdate(state: PositionState): Pick<Holding, "quantity" | "averagePrice"> {
  return { quantity: round8(state.quantity), averagePrice: round8(state.averagePrice) };
}

function round8(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}
