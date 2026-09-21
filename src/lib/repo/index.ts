import { mockRepository } from "./mock";
import type { FinanceRepository } from "./types";

export type { FinanceRepository } from "./types";

/**
 * Ponto unico de troca entre mock e Supabase.
 *
 * Fase 2: importar `supabaseRepository` e devolver conforme
 * `NEXT_PUBLIC_DATA_SOURCE`. Ate la, so existe o mock — e nenhuma tela precisa
 * saber disso.
 */
export function getRepository(): FinanceRepository {
  return mockRepository;
}

export const repo = getRepository();
