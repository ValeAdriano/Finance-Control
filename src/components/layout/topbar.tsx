import { RefreshCw } from "lucide-react";
import { repo } from "@/lib/repo";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";

/**
 * Barra superior: identidade no mobile, estado da sincronizacao e tema.
 * E Server Component — o estado de conexao vem do repositorio.
 */
export async function Topbar() {
  const institutions = await repo.getInstitutions();
  const stale = institutions.filter((i) => i.status === "expirada" || i.status === "erro");
  const lastSync = institutions
    .map((i) => i.lastSyncAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  return (
    <header className="border-line bg-overlay sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-2.5 lg:hidden">
        <span className="bg-accent text-accent-content flex size-7 items-center justify-center rounded-[9px] text-[13px] font-semibold">
          F
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Finance Control</span>
      </div>

      <div className="text-muted hidden items-center gap-2 text-[13px] lg:flex">
        <RefreshCw aria-hidden className="size-3.5" />
        {lastSync ? (
          <span>
            Sincronizado em{" "}
            {new Date(lastSync).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : (
          <span>Sem sincronização registrada</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {stale.length > 0 ? (
          <Badge tone="warning">
            {stale.length} {stale.length === 1 ? "conexão expirada" : "conexões expiradas"}
          </Badge>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
