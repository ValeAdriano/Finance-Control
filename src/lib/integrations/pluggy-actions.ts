"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createConnectToken, fetchItem } from "./pluggy";
import { loadCredential, type PluggySecret } from "./credentials";

/**
 * Conexão de banco pelo Open Finance.
 *
 * O token é de curta duração e serve para o widget da Pluggy rodar no browser.
 * É esse desenho que faz a senha do banco ir direto do usuário para a Pluggy:
 * ela nunca passa pela nossa aplicação, e o client secret nunca sai do servidor.
 */

export interface ConnectTokenResult {
  token: string | null;
  error: string | null;
}

export async function requestConnectToken(): Promise<ConnectTokenResult> {
  try {
    const credential = await loadCredential<PluggySecret>("pluggy");
    if (!credential) {
      return {
        token: null,
        error: "Cadastre as credenciais da Pluggy antes de conectar um banco.",
      };
    }

    return { token: await createConnectToken(credential), error: null };
  } catch (error) {
    console.error("[pluggy] falha ao gerar connect token:", error);
    return { token: null, error: "Não foi possível iniciar a conexão agora." };
  }
}

export interface LinkItemState {
  ok: boolean;
  message: string | null;
}

/**
 * Registra o item que o widget devolveu.
 *
 * O nome vem do conector informado pela própria Pluggy, não de texto digitado
 * pelo usuário — evita duas instituições com nomes diferentes para o mesmo banco.
 */
export async function linkPluggyItem(
  _previous: LinkItemState,
  formData: FormData,
): Promise<LinkItemState> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return { ok: false, message: "Conexão não identificada." };

  try {
    const credential = await loadCredential<PluggySecret>("pluggy");
    if (!credential) return { ok: false, message: "Credenciais da Pluggy não encontradas." };

    const token = await createConnectToken(credential, itemId);
    void token; // valida que as credenciais ainda funcionam antes de gravar

    const { authenticate } = await import("./pluggy");
    const apiKey = await authenticate(credential);
    const item = await fetchItem(apiKey, itemId);

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, message: "Sessão expirada." };

    const name = item.connector?.name ?? "Banco conectado";

    const { error } = await supabase.from("institutions").upsert(
      {
        user_id: auth.user.id,
        name,
        provider: "pluggy",
        external_id: itemId,
        status: item.status === "UPDATED" ? "conectada" : "erro",
        last_sync_at: item.updatedAt,
      },
      { onConflict: "user_id,name" },
    );

    if (error) return { ok: false, message: `Não foi possível salvar a conexão: ${error.message}` };

    revalidatePath("/configuracoes");
    return { ok: true, message: `${name} conectado. Sincronize para importar o extrato.` };
  } catch (error) {
    console.error("[pluggy] falha ao vincular item:", error);
    return { ok: false, message: "Não foi possível concluir a conexão." };
  }
}

export async function unlinkInstitution(
  _previous: LinkItemState,
  formData: FormData,
): Promise<LinkItemState> {
  const id = String(formData.get("institutionId") ?? "");

  const supabase = await createClient();
  // Os lançamentos já importados ficam: apagar levaria junto o histórico de
  // gastos que o usuário já categorizou e conferiu.
  const { error } = await supabase
    .from("institutions")
    .update({ external_id: null, status: "manual" })
    .eq("id", id);

  if (error) return { ok: false, message: "Não foi possível desconectar." };

  revalidatePath("/configuracoes");
  return { ok: true, message: "Banco desconectado. Os lançamentos já importados foram mantidos." };
}
