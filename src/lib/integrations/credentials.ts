import "server-only";

import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto/secrets";

/**
 * Guarda e recupera as credenciais que o usuário cadastra na interface.
 *
 * O segredo é cifrado **antes** de sair daqui e só é decifrado no servidor,
 * na hora de montar a chamada à API externa. Nenhuma função deste módulo
 * devolve segredo para a interface — o que a tela recebe é `CredentialStatus`,
 * que só tem a prévia mascarada.
 *
 * `server-only` no topo faz o build quebrar se alguém importar isso de um
 * client component, em vez de vazar a chave silenciosamente.
 */

export type Provider = "binance" | "pluggy" | "brapi";

export interface BinanceSecret {
  apiKey: string;
  apiSecret: string;
}
export interface PluggySecret {
  clientId: string;
  clientSecret: string;
}
export interface BrapiSecret {
  token: string;
}

export type ProviderSecret = BinanceSecret | PluggySecret | BrapiSecret;

export type CredentialStatus = {
  provider: Provider;
  /** Prévia mascarada, só para reconhecer a chave. Nunca o segredo inteiro. */
  hint: string | null;
  status: "nao_verificada" | "valida" | "invalida" | "erro";
  statusMessage: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
};

/**
 * `bytea` trafega pelo PostgREST como literal hexadecimal `\x...`. Converter
 * nos dois sentidos aqui mantém o resto do código lidando só com Buffer.
 */
function toBytea(buffer: Buffer): string {
  return `\\x${buffer.toString("hex")}`;
}

function fromBytea(value: string): Buffer {
  return Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex");
}

/** Trecho mostrado na interface para o usuário reconhecer o que cadastrou. */
function hintFor(provider: Provider, secret: ProviderSecret): string {
  switch (provider) {
    case "binance":
      return maskSecret((secret as BinanceSecret).apiKey);
    case "pluggy":
      return maskSecret((secret as PluggySecret).clientId);
    case "brapi":
      return maskSecret((secret as BrapiSecret).token);
  }
}

export async function saveCredential(provider: Provider, secret: ProviderSecret): Promise<void> {
  const { ciphertext, iv } = encryptSecret(JSON.stringify(secret));
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Sessão expirada.");

  const { error } = await supabase.from("provider_credentials").upsert(
    {
      user_id: user.user.id,
      provider,
      encrypted: toBytea(ciphertext),
      iv: toBytea(iv),
      hint: hintFor(provider, secret),
      // Trocou a chave, a verificação anterior não vale mais.
      status: "nao_verificada",
      status_message: null,
      last_verified_at: null,
    },
    { onConflict: "user_id,provider" },
  );

  if (error) throw new Error(`Não foi possível salvar a credencial: ${error.message}`);
}

/**
 * Decifra a credencial para uso no servidor.
 *
 * Devolve `null` quando não há credencial cadastrada — isso é estado normal,
 * não erro. Já um registro que existe mas não decifra é erro de verdade e
 * estoura, porque significa chave de criptografia trocada ou dado corrompido.
 */
export async function loadCredential<T extends ProviderSecret>(
  provider: Provider,
): Promise<T | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provider_credentials")
    .select("encrypted, iv")
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível ler a credencial: ${error.message}`);
  if (!data) return null;

  return JSON.parse(
    decryptSecret({ ciphertext: fromBytea(data.encrypted), iv: fromBytea(data.iv) }),
  ) as T;
}

/** O que a interface pode ver: nunca inclui segredo. */
export async function listCredentialStatus(): Promise<CredentialStatus[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provider_credentials")
    .select("provider, hint, status, status_message, last_verified_at, updated_at");

  if (error) throw new Error(`Não foi possível listar as credenciais: ${error.message}`);

  return data.map((row) => ({
    provider: row.provider,
    hint: row.hint,
    status: row.status as CredentialStatus["status"],
    statusMessage: row.status_message,
    lastVerifiedAt: row.last_verified_at,
    updatedAt: row.updated_at,
  }));
}

export async function recordVerification(
  provider: Provider,
  status: CredentialStatus["status"],
  message: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("provider_credentials")
    .update({
      status,
      status_message: message,
      last_verified_at: new Date().toISOString(),
    })
    .eq("provider", provider);

  if (error) throw new Error(`Não foi possível registrar a verificação: ${error.message}`);
}

export async function deleteCredential(provider: Provider): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("provider_credentials").delete().eq("provider", provider);

  if (error) throw new Error(`Não foi possível remover a credencial: ${error.message}`);
}
