"use client";

import { useActionState, useCallback, useState } from "react";
import Script from "next/script";
import { Building2, Loader2, Unlink } from "lucide-react";
import {
  linkPluggyItem,
  requestConnectToken,
  unlinkInstitution,
  type LinkItemState,
} from "@/lib/integrations/pluggy-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** O widget da Pluggy é carregado por script externo e não vem tipado. */
declare global {
  interface Window {
    PluggyConnect?: new (options: {
      connectToken: string;
      includeSandbox?: boolean;
      onSuccess?: (data: { item: { id: string } }) => void;
      onError?: (error: unknown) => void;
    }) => { init: () => void };
  }
}

const INITIAL: LinkItemState = { ok: false, message: null };

export interface ConnectedBank {
  id: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
}

/**
 * Conexão de banco pelo widget da Pluggy.
 *
 * A senha do banco é digitada dentro do widget, que fala direto com a Pluggy —
 * ela nunca passa por esta aplicação. O que volta para cá é só o id do item.
 */
export function BankConnect({ banks }: { banks: ConnectedBank[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [linkState, linkAction] = useActionState(linkPluggyItem, INITIAL);
  const [unlinkState, unlinkAction] = useActionState(unlinkInstitution, INITIAL);

  const openWidget = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { token, error: tokenError } = await requestConnectToken();

    if (!token || !window.PluggyConnect) {
      setLoading(false);
      setError(tokenError ?? "O widget da Pluggy não carregou. Recarregue a página.");
      return;
    }

    const connect = new window.PluggyConnect({
      connectToken: token,
      onSuccess: ({ item }) => {
        // O vínculo é gravado por Server Action: o browser só conhece o id do
        // item, nunca a credencial da aplicação.
        const form = new FormData();
        form.set("itemId", item.id);
        linkAction(form);
        setLoading(false);
      },
      onError: () => {
        setLoading(false);
        setError("A conexão foi interrompida.");
      },
    });

    connect.init();
    setLoading(false);
  }, [linkAction]);

  const feedback = linkState.message ?? unlinkState.message;

  return (
    <div className="flex flex-col gap-3">
      <Script
        src="https://cdn.pluggy.ai/pluggy-connect/v2.9.3/pluggy-connect.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />

      {banks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {banks.map((bank) => (
            <li
              key={bank.id}
              className="border-line flex flex-wrap items-center justify-between gap-2 rounded-[12px] border px-3.5 py-2.5"
            >
              <span className="flex items-center gap-2.5">
                <Building2 aria-hidden className="text-faint size-4" />
                <span>
                  <span className="block text-[14px]">{bank.name}</span>
                  {bank.lastSyncAt ? (
                    <span className="text-faint block text-[12px]">
                      Atualizado em{" "}
                      {new Date(bank.lastSyncAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                </span>
              </span>

              <span className="flex items-center gap-2">
                <Badge tone={bank.status === "conectada" ? "positive" : "negative"}>
                  {bank.status === "conectada" ? "Conectado" : "Precisa reconectar"}
                </Badge>
                <form action={unlinkAction}>
                  <input type="hidden" name="institutionId" value={bank.id} />
                  <button
                    type="submit"
                    aria-label={`Desconectar ${bank.name}`}
                    className="text-faint hover:bg-sunken hover:text-negative flex size-9 items-center justify-center rounded-full transition-colors"
                  >
                    <Unlink aria-hidden className="size-4" />
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <Button variant="secondary" onClick={openWidget} disabled={loading || !scriptReady}>
          {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {banks.length > 0 ? "Conectar outro banco" : "Conectar um banco"}
        </Button>
      </div>

      <p className="text-faint text-[12px] leading-relaxed">
        A senha do banco é digitada dentro do widget da Pluggy e vai direto para ela — não passa por
        esta aplicação nem fica guardada aqui. O plano gratuito permite até 5 conexões ativas, com
        dados atualizados a cada 24h.
      </p>

      {error ? <p className="text-negative text-[13px]">{error}</p> : null}
      {feedback ? (
        <p
          role="status"
          className={
            linkState.ok || unlinkState.ok
              ? "text-positive text-[13px]"
              : "text-negative text-[13px]"
          }
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
