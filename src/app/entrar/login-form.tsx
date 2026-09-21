"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { signIn, verifyMfa, type AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

const INITIAL: AuthState = { error: null };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("proximo") ?? "/";

  const [signInState, signInAction, signingIn] = useActionState(signIn, INITIAL);
  const [mfaState, mfaAction, verifying] = useActionState(verifyMfa, INITIAL);

  // A senha já foi aceita; falta o segundo fator.
  if (signInState.needsMfa || mfaState.needsMfa) {
    return (
      <form action={mfaAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        <div className="bg-accent-soft text-accent flex items-center gap-2.5 rounded-[12px] px-3.5 py-3 text-[13px]">
          <ShieldCheck aria-hidden className="size-4 shrink-0" />
          Abra o aplicativo autenticador e digite o código de 6 dígitos.
        </div>

        <Field label="Código de verificação">
          {(id) => (
            <TextInput
              id={id}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              autoFocus
              required
              className="text-center text-[22px] tracking-[0.4em]"
            />
          )}
        </Field>

        {mfaState.error ? <ErrorMessage>{mfaState.error}</ErrorMessage> : null}

        <Button type="submit" variant="primary" disabled={verifying}>
          {verifying ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Verificar
        </Button>
      </form>
    );
  }

  return (
    <form action={signInAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label="E-mail">
        {(id) => (
          <TextInput
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            autoFocus
            required
          />
        )}
      </Field>

      <Field label="Senha">
        {(id) => (
          <TextInput
            id={id}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>

      {signInState.error ? <ErrorMessage>{signInState.error}</ErrorMessage> : null}

      <Button type="submit" variant="primary" disabled={signingIn}>
        {signingIn ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <KeyRound aria-hidden className="size-4" />
        )}
        Entrar
      </Button>
    </form>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="bg-negative-soft text-negative rounded-[12px] px-3.5 py-3 text-[13px]"
    >
      {children}
    </p>
  );
}
