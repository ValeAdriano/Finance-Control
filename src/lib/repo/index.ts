import { mockRepository } from "./mock";
import { supabaseRepository } from "./supabase";
import type { FinanceRepository } from "./types";

export type { FinanceRepository } from "./types";

/**
 * Ponto único de troca entre mock e Supabase.
 *
 * `NEXT_PUBLIC_DATA_SOURCE=supabase` liga o backend real; qualquer outro valor
 * (ou nenhum) mantém os mocks, o que deixa a interface rodar sem credencial —
 * útil em review de PR e no build do CI.
 *
 * A escolha é feita a cada chamada, não no carregamento do módulo, para o
 * mesmo build servir os dois modos.
 */
export function getRepository(): FinanceRepository {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? supabaseRepository : mockRepository;
}

/**
 * Fachada estável: `repo.getAssets()` resolve a implementação na hora da
 * chamada. Sem isso, quem importasse `repo` no topo do módulo ficaria preso à
 * implementação vigente no momento do import.
 */
export const repo: FinanceRepository = new Proxy({} as FinanceRepository, {
  get(_target, property: string) {
    return getRepository()[property as keyof FinanceRepository];
  },
});
