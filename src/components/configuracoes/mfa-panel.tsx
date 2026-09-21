import { createClient } from "@/lib/supabase/server";
import { MfaPanelClient, type MfaFactor } from "./mfa-panel-client";

/**
 * Cadastro do segundo fator (TOTP).
 *
 * A lista de fatores é buscada no servidor e entregue pronta ao cliente; o
 * componente interativo só cuida do cadastro e da remoção, e pede um refresh
 * ao servidor depois de mexer em alguma coisa.
 */
export async function MfaPanel() {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();

  const factors: MfaFactor[] = (data?.all ?? []).map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    status: factor.status,
  }));

  return <MfaPanelClient factors={factors} />;
}
