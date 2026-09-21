/**
 * Leitura das variaveis do Supabase num lugar so, com erro claro quando falta
 * alguma — descobrir a falta pela metade de uma stack trace do supabase-js e
 * muito pior do que falhar aqui, dizendo o nome da variavel.
 */

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Service role ignora RLS. Só pode ser lida em código de servidor — a checagem
 * de `window` abaixo transforma um vazamento acidental em erro imediato, em vez
 * de uma chave mestra entregue ao browser.
 */
export function supabaseServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não pode ser usada no browser.");
  }
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** `true` quando o app deve falar com o Supabase em vez dos mocks. */
export function usesSupabase(): boolean {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase";
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não definida. Copie .env.example para .env.local e preencha com as chaves do projeto.`,
    );
  }
  return value;
}
