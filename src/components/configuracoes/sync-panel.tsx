import { listRecentRuns } from "@/lib/integrations/sync";
import { listCredentialStatus } from "@/lib/integrations/credentials";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "./sync-button";

const STATUS_TONE = {
  sucesso: "positive",
  parcial: "warning",
  erro: "negative",
  rodando: "neutral",
} as const;

const PROVIDER_LABEL: Record<string, string> = {
  brapi: "Cotações (brapi)",
  binance: "Binance",
  pluggy: "Open Finance",
};

/**
 * Sincronização manual e histórico das últimas execuções.
 *
 * O agendamento automático roda no `pg_cron` do Supabase; este botão existe
 * para não esperar a próxima janela — e o histórico mostra o que aconteceu sem
 * precisar abrir log de servidor.
 */
export async function SyncPanel() {
  const [runs, credentials] = await Promise.all([listRecentRuns(), listCredentialStatus()]);
  const configured = new Set(credentials.map((c) => c.provider));

  return (
    <Card>
      <CardHeader
        title="Sincronização"
        description="O agendamento roda sozinho no Supabase. Use aqui para não esperar a próxima janela."
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <SyncButton
            provider="brapi"
            label="Atualizar cotações"
            disabled={!configured.has("brapi")}
          />
          <SyncButton
            provider="binance"
            label="Sincronizar Binance"
            disabled={!configured.has("binance")}
          />
        </div>

        {configured.size === 0 ? (
          <p className="text-muted text-[13px]">
            Cadastre uma credencial acima para poder sincronizar.
          </p>
        ) : null}

        {runs.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-faint text-[12px] font-medium tracking-wide uppercase">
              Últimas execuções
            </p>
            <ul className="flex flex-col gap-2">
              {runs.map((run) => (
                <li
                  key={`${run.provider}-${run.startedAt}`}
                  className="border-line flex flex-wrap items-start justify-between gap-2 rounded-[12px] border px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[14px]">
                      {PROVIDER_LABEL[run.provider] ?? run.provider}
                      <Badge
                        tone={STATUS_TONE[run.status as keyof typeof STATUS_TONE] ?? "neutral"}
                      >
                        {run.status}
                      </Badge>
                    </p>
                    {run.message ? (
                      <p className="text-muted mt-0.5 text-[13px]">{run.message}</p>
                    ) : null}
                  </div>
                  <time className="text-faint shrink-0 text-[12px]" dateTime={run.startedAt}>
                    {new Date(run.startedAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
      <CardFooter>
        As cotações são gravadas em cache no banco: a cota gratuita da brapi é de 15.000 requisições
        por ciclo mensal, e repetir chamada para o mesmo dia só gastaria cota.
      </CardFooter>
    </Card>
  );
}
