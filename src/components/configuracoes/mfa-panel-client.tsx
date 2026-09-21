"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, TextInput } from "@/components/ui/field";

export interface MfaFactor {
  id: string;
  friendlyName: string | null;
  status: string;
}

/**
 * O fluxo tem duas etapas por um motivo: `enroll` devolve o QR code, mas o
 * fator só passa a valer no login depois do `verify`. Um fator cadastrado e
 * nunca verificado não protege nada, então a interface distingue os estados.
 */
export function MfaPanelClient({ factors }: { factors: MfaFactor[] }) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const verified = factors.filter((factor) => factor.status === "verified");
  const working = busy || refreshing;

  async function startEnroll() {
    setBusy(true);
    setError(null);

    const { data, error: enrollError } = await createClient().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Autenticador ${new Date().toLocaleDateString("pt-BR")}`,
    });

    setBusy(false);

    if (enrollError || !data) {
      setError(enrollError?.message ?? "Não foi possível iniciar o cadastro.");
      return;
    }

    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll() {
    if (!enrolling) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrolling.id,
    });

    if (challengeError || !challenge) {
      setBusy(false);
      setError("Não foi possível iniciar a verificação.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrolling.id,
      challengeId: challenge.id,
      code: code.replace(/\s/g, ""),
    });

    setBusy(false);

    if (verifyError) {
      setError("Código inválido. Confira o horário do celular e tente de novo.");
      return;
    }

    setEnrolling(null);
    setCode("");
    startRefresh(() => router.refresh());
  }

  async function removeFactor(factorId: string) {
    setBusy(true);
    setError(null);

    const { error: unenrollError } = await createClient().auth.mfa.unenroll({ factorId });
    setBusy(false);

    if (unenrollError) {
      setError("Não foi possível remover o fator.");
      return;
    }

    startRefresh(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader
        title="Verificação em duas etapas"
        description="Um código do aplicativo autenticador além da senha, exigido a cada login."
        action={
          verified.length > 0 ? (
            <Badge tone="positive">
              <ShieldCheck aria-hidden className="size-3.5" /> Ativa
            </Badge>
          ) : (
            <Badge tone="warning">
              <ShieldAlert aria-hidden className="size-3.5" /> Inativa
            </Badge>
          )
        }
      />

      <CardBody className="flex flex-col gap-4">
        {factors.map((factor) => (
          <div
            key={factor.id}
            className="border-line flex items-center justify-between gap-3 rounded-[12px] border px-3.5 py-3"
          >
            <div>
              <p className="text-[14px] font-medium">{factor.friendlyName ?? "Autenticador"}</p>
              <p className="text-faint text-[12px]">
                {factor.status === "verified"
                  ? "Verificado e ativo"
                  : "Cadastrado, mas não verificado"}
              </p>
            </div>
            <Button variant="ghost" onClick={() => removeFactor(factor.id)} disabled={working}>
              <Trash2 aria-hidden className="size-4" /> Remover
            </Button>
          </div>
        ))}

        {enrolling ? (
          <div className="border-line bg-base/60 flex flex-col gap-4 rounded-[14px] border p-4">
            <div className="flex flex-col items-center gap-3">
              <Image
                src={enrolling.qr}
                alt="QR code para cadastrar o aplicativo autenticador"
                width={180}
                height={180}
                unoptimized
                className="rounded-[10px] bg-white p-2"
              />
              <p className="text-muted text-center text-[13px]">
                Leia o QR code no Google Authenticator, 1Password, Authy ou similar.
              </p>
              <details className="w-full text-center">
                <summary className="text-accent cursor-pointer text-[12px]">
                  Não consigo ler o QR code
                </summary>
                <code className="bg-sunken mt-2 block rounded-[8px] px-3 py-2 text-[12px] break-all">
                  {enrolling.secret}
                </code>
              </details>
            </div>

            <Field label="Código gerado pelo aplicativo">
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="text-center text-[20px] tracking-[0.4em]"
                />
              )}
            </Field>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={confirmEnroll}
                disabled={working || code.length < 6}
              >
                {working ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                Confirmar
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEnrolling(null);
                  setCode("");
                  setError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={startEnroll} disabled={working}>
            {working ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {verified.length > 0
              ? "Cadastrar outro aplicativo"
              : "Ativar verificação em duas etapas"}
          </Button>
        )}

        {error ? (
          <p
            role="alert"
            className="bg-negative-soft text-negative rounded-[12px] px-3.5 py-3 text-[13px]"
          >
            {error}
          </p>
        ) : null}
      </CardBody>

      <CardFooter>
        Guarde o segredo num gerenciador de senhas. Perder o aplicativo sem ter o segredo salvo
        significa perder o acesso à conta.
      </CardFooter>
    </Card>
  );
}
