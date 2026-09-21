import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="bg-accent text-accent-content flex size-12 items-center justify-center rounded-[14px] text-[22px] font-semibold">
            F
          </span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">Finance Control</h1>
            <p className="text-muted mt-1 text-[14px]">
              Entre para ver sua carteira e seus gastos.
            </p>
          </div>
        </div>

        <Card>
          <CardBody className="pt-6">
            {/* `useSearchParams` exige um limite de Suspense na renderização. */}
            <Suspense fallback={<div className="h-[248px]" />}>
              <LoginForm />
            </Suspense>
          </CardBody>
        </Card>

        <p className="text-faint mt-6 text-center text-[12px] leading-relaxed">
          Plataforma de uso pessoal. O cadastro de conta é feito pelo administrador.
        </p>
      </div>
    </main>
  );
}
