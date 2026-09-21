"use client";

import { useActionState, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  removeCredential,
  revalidateCredential,
  saveAndVerifyCredential,
  type CredentialActionState,
} from "@/lib/integrations/actions";
import type { CredentialStatus, Provider } from "@/lib/integrations/credentials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

export interface IntegrationDefinition {
  provider: Provider;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  quota: string;
  warning?: string;
  fields: { name: string; label: string; type: "text" | "password"; placeholder: string }[];
  steps: string[];
}

const INITIAL: CredentialActionState = { ok: false, message: null };

const STATUS_BADGE: Record<
  CredentialStatus["status"],
  { label: string; tone: "positive" | "negative" | "warning" | "neutral" }
> = {
  valida: { label: "Conectada", tone: "positive" },
  invalida: { label: "Chave recusada", tone: "negative" },
  erro: { label: "Erro", tone: "warning" },
  nao_verificada: { label: "Não verificada", tone: "neutral" },
};

export function IntegrationCard({
  definition,
  status,
}: {
  definition: IntegrationDefinition;
  status: CredentialStatus | null;
}) {
  const [editing, setEditing] = useState(false);
  const [saveState, saveAction, saving] = useActionState(saveAndVerifyCredential, INITIAL);
  const [checkState, checkAction, checking] = useActionState(revalidateCredential, INITIAL);
  const [, removeAction, removing] = useActionState(removeCredential, INITIAL);

  const badge = status ? STATUS_BADGE[status.status] : null;
  // Depois de salvar com sucesso o formulário se fecha sozinho: manter o campo
  // aberto com a chave digitada só aumentaria a chance de ela ficar na tela.
  const showForm = editing || !status;
  const feedback = saveState.message ? saveState : checkState.message ? checkState : null;

  return (
    <div className="border-line rounded-[14px] border">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-content text-[15px] font-medium">{definition.title}</p>
            {badge ? (
              <Badge tone={badge.tone}>
                {statusIcon(status!.status)} {badge.label}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted mt-0.5 text-[13px]">{definition.description}</p>
          {status?.hint ? (
            <p className="text-faint mt-1 font-mono text-[12px]">{status.hint}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {status ? (
            <>
              <form action={checkAction}>
                <input type="hidden" name="provider" value={definition.provider} />
                <Button type="submit" variant="ghost" disabled={checking}>
                  {checking ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  Verificar
                </Button>
              </form>
              <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
                {editing ? "Cancelar" : "Trocar chave"}
              </Button>
              <form action={removeAction}>
                <input type="hidden" name="provider" value={definition.provider} />
                <button
                  type="submit"
                  aria-label={`Remover credencial de ${definition.title}`}
                  disabled={removing}
                  className="text-faint hover:bg-sunken hover:text-negative flex size-9 items-center justify-center rounded-full transition-colors"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      {status?.statusMessage ? (
        <p className="text-muted px-4 pb-3 text-[13px]">{status.statusMessage}</p>
      ) : null}

      {showForm ? (
        <form action={saveAction} className="border-line flex flex-col gap-3 border-t px-4 py-4">
          <input type="hidden" name="provider" value={definition.provider} />

          <details className="text-[13px]">
            <summary className="text-accent cursor-pointer">Como obter</summary>
            <ol className="text-muted mt-2 flex flex-col gap-1.5">
              {definition.steps.map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="tabular bg-sunken text-content flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <a
              href={definition.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent mt-2 inline-flex items-center gap-1"
            >
              {definition.hrefLabel} <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </details>

          {definition.fields.map((field) => (
            <Field key={field.name} label={field.label}>
              {(id) => (
                <TextInput
                  id={id}
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              )}
            </Field>
          ))}

          <p className="text-faint text-[12px] leading-relaxed">{definition.quota}</p>

          {definition.warning ? (
            <p className="bg-warning-soft text-warning rounded-[10px] px-3 py-2.5 text-[12px] leading-relaxed">
              {definition.warning}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Salvar e verificar
            </Button>
            {status ? (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {feedback?.message ? (
        <div className="border-line border-t px-4 py-3">
          <p
            role="status"
            className={feedback.ok ? "text-positive text-[13px]" : "text-negative text-[13px]"}
          >
            {feedback.message}
          </p>
          {feedback.warning ? (
            <p className="bg-warning-soft text-warning mt-2 rounded-[10px] px-3 py-2.5 text-[12px] leading-relaxed">
              {feedback.warning}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function statusIcon(status: CredentialStatus["status"]) {
  const className = "size-3.5";
  if (status === "valida") return <CheckCircle2 aria-hidden className={className} />;
  if (status === "nao_verificada") return <CircleDashed aria-hidden className={className} />;
  return <CircleAlert aria-hidden className={className} />;
}
