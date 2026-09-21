import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Cliente de servidor, com a sessão do usuário vinda do cookie. Toda query
 * feita por aqui passa pela RLS — é o cliente que as telas devem usar.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode escrever cookie. O proxy já renovou a
          // sessão antes de chegar aqui, então ignorar é seguro.
        }
      },
    },
  });
}

/**
 * Cliente administrativo, que **ignora a RLS**.
 *
 * Só para trabalho de sistema: seed, sync agendado, migração de dado. Nunca
 * para responder a uma requisição de usuário — ali a RLS é justamente a
 * proteção que não se quer contornar.
 */
export function createAdminClient() {
  return createServerClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
