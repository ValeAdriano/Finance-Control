"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Ações de autenticação. Ficam como Server Actions para a senha e o código de
 * 2FA nunca transitarem por uma rota que o cliente possa chamar diretamente.
 */

export interface AuthState {
  error: string | null;
  /** Quando true, a senha foi aceita e falta o segundo fator. */
  needsMfa?: boolean;
}

export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensagem genérica de propósito: dizer "usuário não existe" entregaria
    // quais e-mails têm conta.
    return { error: "E-mail ou senha incorretos." };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
    return { error: null, needsMfa: true };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(next));
}

export async function verifyMfa(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const next = String(formData.get("next") ?? "/");

  if (!/^\d{6}$/.test(code)) {
    return { error: "O código tem 6 dígitos.", needsMfa: true };
  }

  const supabase = await createClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

  if (factorsError || !factors?.totp?.length) {
    return { error: "Nenhum aplicativo autenticador cadastrado.", needsMfa: true };
  }

  const factorId = factors.totp[0].id;
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError || !challenge) {
    return { error: "Não foi possível iniciar a verificação. Tente de novo.", needsMfa: true };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (error) {
    return { error: "Código inválido ou expirado.", needsMfa: true };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/entrar");
}

/**
 * Só aceita caminho interno. Sem isso, `?proximo=https://site-falso` viraria
 * um redirecionamento aberto logo após o login.
 */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
