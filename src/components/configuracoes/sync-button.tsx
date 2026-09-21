"use client";

import { useActionState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { runSync, type SyncActionState } from "@/lib/integrations/actions";
import { Button } from "@/components/ui/button";

const INITIAL: SyncActionState = { ok: false, message: null };

export function SyncButton({
  provider,
  label,
  disabled,
}: {
  provider: string;
  label: string;
  disabled?: boolean;
}) {
  const [state, action, running] = useActionState(runSync, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="provider" value={provider} />
      <Button type="submit" variant="secondary" disabled={disabled || running}>
        {running ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <RefreshCw aria-hidden className="size-4" />
        )}
        {label}
      </Button>
      {state.message ? (
        <p
          role="status"
          className={state.ok ? "text-positive text-[12px]" : "text-negative text-[12px]"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
