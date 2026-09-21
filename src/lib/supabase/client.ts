"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Cliente do browser. Usa só a chave anon, que é pública por design — quem
 * protege o dado é a RLS, não o segredo da chave.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
