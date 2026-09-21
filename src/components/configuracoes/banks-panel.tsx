import { createClient } from "@/lib/supabase/server";
import { listCredentialStatus } from "@/lib/integrations/credentials";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BankConnect, type ConnectedBank } from "./bank-connect";

/**
 * Bancos conectados por Open Finance.
 *
 * Só aparece depois que as credenciais da Pluggy existem: oferecer "conectar
 * banco" sem elas levaria a um erro que o usuário não teria como resolver ali.
 */
export async function BanksPanel() {
  const credentials = await listCredentialStatus();
  const hasPluggy = credentials.some((c) => c.provider === "pluggy");

  if (!hasPluggy) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("institutions")
    .select("id, name, status, last_sync_at, external_id")
    .eq("provider", "pluggy")
    .not("external_id", "is", null)
    .order("name");

  const banks: ConnectedBank[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    lastSyncAt: row.last_sync_at,
  }));

  return (
    <Card>
      <CardHeader
        title="Bancos conectados"
        description="Extrato e saldo via Open Finance, atualizados a cada 24h pela Pluggy."
      />
      <CardBody>
        <BankConnect banks={banks} />
      </CardBody>
    </Card>
  );
}
