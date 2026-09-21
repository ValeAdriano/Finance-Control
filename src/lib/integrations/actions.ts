"use server";

import { revalidatePath } from "next/cache";
import {
  deleteCredential,
  listCredentialStatus,
  loadCredential,
  recordVerification,
  saveCredential,
  type BinanceSecret,
  type BrapiSecret,
  type PluggySecret,
  type Provider,
} from "./credentials";
import { verifyToken } from "./brapi";
import { verifyCredentials as verifyBinance } from "./binance";
import { verifyCredentials as verifyPluggy } from "./pluggy";

/**
 * Server Actions do cadastro de credencial.
 *
 * Todo segredo entra por aqui e nunca volta: o retorno só carrega mensagem e
 * estado. É isso que permite o formulário ser um client component sem que a
 * chave passe pelo bundle do browser.
 */

export interface CredentialActionState {
  ok: boolean;
  message: string | null;
  /** Aviso que não impede salvar, mas o usuário precisa ver. */
  warning?: string | null;
}

const EMPTY: CredentialActionState = { ok: false, message: null };

export async function saveAndVerifyCredential(
  _previous: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const provider = String(formData.get("provider") ?? "") as Provider;

  try {
    switch (provider) {
      case "brapi": {
        const token = field(formData, "token");
        if (!token) return { ok: false, message: "Informe o token da brapi." };

        await saveCredential("brapi", { token } satisfies BrapiSecret);
        const result = await verifyToken(token);
        await recordVerification("brapi", result.valid ? "valida" : "invalida", result.message);

        revalidatePath("/configuracoes");
        return { ok: result.valid, message: result.message };
      }

      case "binance": {
        const apiKey = field(formData, "apiKey");
        const apiSecret = field(formData, "apiSecret");
        if (!apiKey || !apiSecret) {
          return { ok: false, message: "Informe a API Key e a Secret Key." };
        }

        await saveCredential("binance", { apiKey, apiSecret } satisfies BinanceSecret);
        const result = await verifyBinance({ apiKey, apiSecret });
        await recordVerification("binance", result.valid ? "valida" : "invalida", result.message);

        revalidatePath("/configuracoes");
        return {
          ok: result.valid,
          message: result.message,
          // Chave com permissão de saque que vaze custa o saldo da corretora —
          // o aviso precisa ser explícito, não uma nota de rodapé.
          warning: result.overPermissioned
            ? "Essa chave permite negociar ou sacar. A plataforma só precisa de leitura: refaça a chave na Binance marcando apenas “Enable Reading” e cadastre a nova aqui."
            : null,
        };
      }

      case "pluggy": {
        const clientId = field(formData, "clientId");
        const clientSecret = field(formData, "clientSecret");
        if (!clientId || !clientSecret) {
          return { ok: false, message: "Informe o Client ID e o Client Secret." };
        }

        await saveCredential("pluggy", { clientId, clientSecret } satisfies PluggySecret);
        const result = await verifyPluggy({ clientId, clientSecret });
        await recordVerification("pluggy", result.valid ? "valida" : "invalida", result.message);

        revalidatePath("/configuracoes");
        return { ok: result.valid, message: result.message };
      }

      default:
        return { ok: false, message: "Integração desconhecida." };
    }
  } catch (error) {
    // A mensagem do erro pode carregar detalhe interno; só o texto genérico
    // vai para a tela, e o detalhe fica no log do servidor.
    console.error(`[integrações] falha ao salvar credencial de ${provider}:`, error);
    return { ok: false, message: "Não foi possível salvar a credencial. Tente de novo." };
  }
}

export async function removeCredential(
  _previous: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const provider = String(formData.get("provider") ?? "") as Provider;

  try {
    await deleteCredential(provider);
    revalidatePath("/configuracoes");
    return { ok: true, message: "Credencial removida." };
  } catch (error) {
    console.error(`[integrações] falha ao remover credencial de ${provider}:`, error);
    return { ok: false, message: "Não foi possível remover a credencial." };
  }
}

/** Revalida uma credencial já salva, sem o usuário digitar de novo. */
export async function revalidateCredential(
  _previous: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const provider = String(formData.get("provider") ?? "") as Provider;

  try {
    switch (provider) {
      case "brapi": {
        const secret = await loadCredential<BrapiSecret>("brapi");
        if (!secret) return { ok: false, message: "Nenhum token cadastrado." };

        const result = await verifyToken(secret.token);
        await recordVerification("brapi", result.valid ? "valida" : "invalida", result.message);
        revalidatePath("/configuracoes");
        return { ok: result.valid, message: result.message };
      }

      case "binance": {
        const secret = await loadCredential<BinanceSecret>("binance");
        if (!secret) return { ok: false, message: "Nenhuma chave cadastrada." };

        const result = await verifyBinance(secret);
        await recordVerification("binance", result.valid ? "valida" : "invalida", result.message);
        revalidatePath("/configuracoes");
        return { ok: result.valid, message: result.message };
      }

      case "pluggy": {
        const secret = await loadCredential<PluggySecret>("pluggy");
        if (!secret) return { ok: false, message: "Nenhuma credencial cadastrada." };

        const result = await verifyPluggy(secret);
        await recordVerification("pluggy", result.valid ? "valida" : "invalida", result.message);
        revalidatePath("/configuracoes");
        return { ok: result.valid, message: result.message };
      }

      default:
        return { ok: false, message: "Integração desconhecida." };
    }
  } catch (error) {
    console.error(`[integrações] falha ao verificar ${provider}:`, error);
    return { ok: false, message: "Não foi possível verificar agora." };
  }
}

export async function getCredentialStatus() {
  return listCredentialStatus();
}

export { EMPTY as EMPTY_CREDENTIAL_STATE };

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/* ---------------------------- Sincronização ------------------------------ */

export interface SyncActionState {
  ok: boolean;
  message: string | null;
}

export async function runSync(
  _previous: SyncActionState,
  formData: FormData,
): Promise<SyncActionState> {
  const provider = String(formData.get("provider") ?? "");

  // Import tardio: `sync.ts` é `server-only` e puxa o cliente de servidor.
  const { syncQuotes, syncBinance } = await import("./sync");

  const result =
    provider === "brapi"
      ? await syncQuotes()
      : provider === "binance"
        ? await syncBinance()
        : { ok: false, message: "Integração desconhecida." };

  // A sincronização mexe em cotação e posição: revalidar só /configuracoes
  // deixaria a home mostrando número velho.
  revalidatePath("/", "layout");

  return { ok: result.ok, message: result.message };
}
