import { createClient } from "@/lib/supabase/server";
import { usesSupabase } from "@/lib/supabase/env";

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * Usuário da sessão, ou `null`.
 *
 * Devolve `null` no modo mock para a interface continuar rodando sem
 * credencial — é o que permite revisar tela em PR e buildar no CI sem segredo.
 *
 * Usa `getUser`, que valida o token no servidor do Supabase. `getSession` só
 * lê o cookie, que o cliente pode forjar, e por isso não serve para autorizar.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!usesSupabase()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id, email: user.email ?? "" } : null;
}
