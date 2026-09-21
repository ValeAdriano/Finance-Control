import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto/secrets";
import type { Database } from "@/types/database";

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
 *
 * As funções aceitam um `SyncContext` opcional. Sem ele, usam a sessão do
 * usuário (que é o caso da interface); com ele, operam sobre o usuário
 * indicado — que é o que o sync agendado precisa, já que ali não há sessão.
 */

export type Provider = "binance" | "pluggy" | "brapi";

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Cliente e usuário sobre os quais operar. O sync agendado monta isso com o
 * cliente administrativo; a interface deixa em branco e usa a sessão.
 */
export interface SyncContext {
  supabase: AppSupabaseClient;
  userId: string;
}

/** Resolve o contexto: o informado, ou o da sessão atual. */
async function resolveContext(context?: SyncContext): Promise<SyncContext> {
  if (context) return context;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada.");

  return { supabase, userId: data.user.id };
}

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

export async function saveCredential(
  provider: Provider,
  secret: ProviderSecret,
  context?: SyncContext,
): Promise<void> {
  const { ciphertext, iv } = encryptSecret(JSON.stringify(secret));
  const { supabase, userId } = await resolveContext(context);

  const { error } = await supabase.from("provider_credentials").upsert(
    {
      user_id: userId,
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
  context?: SyncContext,
): Promise<T | null> {
  const { supabase, userId } = await resolveContext(context);

  const { data, error } = await supabase
    .from("provider_credentials")
    .select("encrypted, iv")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível ler a credencial: ${error.message}`);
  if (!data) return null;

  return JSON.parse(
    decryptSecret({ ciphertext: fromBytea(data.encrypted), iv: fromBytea(data.iv) }),
  ) as T;
}

/** O que a interface pode ver: nunca inclui segredo. */
export async function listCredentialStatus(context?: SyncContext): Promise<CredentialStatus[]> {
  const { supabase, userId } = await resolveContext(context);

  const { data, error } = await supabase
    .from("provider_credentials")
    .select("provider, hint, status, status_message, last_verified_at, updated_at")
    .eq("user_id", userId);

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
  context?: SyncContext,
): Promise<void> {
  const { supabase, userId } = await resolveContext(context);

  const { error } = await supabase
    .from("provider_credentials")
    .update({
      status,
      status_message: message,
      last_verified_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) throw new Error(`Não foi possível registrar a verificação: ${error.message}`);
}

export async function deleteCredential(provider: Provider, context?: SyncContext): Promise<void> {
  const { supabase, userId } = await resolveContext(context);

  const { error } = await supabase
    .from("provider_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) throw new Error(`Não foi possível remover a credencial: ${error.message}`);
}
