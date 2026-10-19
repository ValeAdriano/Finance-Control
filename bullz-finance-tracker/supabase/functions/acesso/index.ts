// Edge Function "acesso" — limite de tentativas por IP e por conta
// (PLANO-SEGURANCA, S1.3).
//
// O Supabase só limita o login por senha a 1.800 tentativas/hora por IP,
// e o gancho que barraria senha errada é do plano Teams. Então o app passa
// por aqui nas ações sensíveis; esta função confere os contadores, chama o
// Auth do lado do servidor e registra o resultado.
//
// Ações (POST JSON, sem login):
//   {acao: "entrar", email, senha}                     devolve {sessao}
//   {acao: "pedir_codigo", tipo: "senha"|"cadastro", email}
//                                                      sempre {ok: true} (não revela se a conta existe)
//   {acao: "confirmar_codigo", tipo: "senha"|"cadastro", email, codigo}
//                                                      devolve {sessao}
//
// Bloqueio: HTTP 429 {erro, espera} — a mesma resposta exista a conta ou não.
//
// IP e e-mail só entram no banco como HMAC com o segredo ACESSO_SEGREDO
// (dá para contar sem guardar o dado pessoal). O segredo fica no Vault
// (fc_acesso_segredo, criado pelo schema.sql); a variável ACESSO_SEGREDO,
// se existir, tem precedência.
//
// Limite, dito com honestidade: quem chamar a API do Supabase direto, por
// fora do app, encontra só o limite padrão. A defesa contra senha
// adivinhada continua sendo senha forte + checagem de vazada + 2FA.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_SB, CHAVE, { auth: { persistSession: false } });

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function bloqueado(espera: number) {
  const min = Math.max(1, Math.ceil(espera / 60));
  return resposta({ erro: `Muitas tentativas. Tente de novo em ${min} min.`, espera }, 429);
}

// ------------------------------------------------------------------ hashes
let chaveHmac: CryptoKey | null = null;
async function hmac(texto: string) {
  if (!chaveHmac) {
    let segredo = Deno.env.get("ACESSO_SEGREDO");
    if (!segredo) {
      // padrão: o segredo gerado no Vault pelo schema.sql
      const { data, error } = await admin.rpc("acesso_segredo");
      if (error) throw error;
      segredo = data as string;
    }
    if (!segredo || segredo.length < 32) throw new Error("ACESSO_SEGREDO ausente");
    chaveHmac = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  const sig = await crypto.subtle.sign("HMAC", chaveHmac, new TextEncoder().encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// a infraestrutura do Supabase repassa o IP de quem chamou; o primeiro valor é o cliente
function ipDe(req: Request) {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "desconhecido";
}

const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
const emailValido = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ------------------------------------------------------------------ contadores
async function espera(acao: string, ip: string, email: string): Promise<number> {
  const { data, error } = await admin.rpc("acesso_espera", { p_acao: acao, p_ip: ip, p_email: email });
  if (error) throw error;
  return Number(data) || 0;
}
async function registra(acao: string, ip: string, email: string, ok: boolean) {
  const { error } = await admin.rpc("acesso_registra", { p_acao: acao, p_ip: ip, p_email: email, p_ok: ok });
  if (error) console.error("registra:", error.message);
}

// ------------------------------------------------------------------ Auth
// Chamado do servidor: o IP que o Auth enxerga seria o desta função, então
// o do cliente vai em sb-forwarded-for (o Auth só o aceita com a chave secreta).
async function auth(caminho: string, corpo: unknown, ip: string) {
  const r = await fetch(`${URL_SB}/auth/v1${caminho}`, {
    method: "POST",
    headers: { apikey: CHAVE, "Content-Type": "application/json", "sb-forwarded-for": ip },
    body: JSON.stringify(corpo),
  });
  let j: any = {};
  try { j = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, j };
}
const sessaoDe = (j: any) => ({ access_token: j.access_token, refresh_token: j.refresh_token });
const codigoErro = (j: any) => String(j.error_code || j.code || j.error || "");

// ------------------------------------------------------------------ servidor
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "use POST" }, 405);

  let corpo: any;
  try { corpo = await req.json(); } catch { return resposta({ erro: "JSON inválido" }, 400); }
  const acao = String(corpo.acao || "");
  if (!["entrar", "pedir_codigo", "confirmar_codigo"].includes(acao)) return resposta({ erro: "ação desconhecida" }, 400);

  const email = normEmail(corpo.email);
  if (!emailValido(email)) return resposta({ erro: "Esse e-mail não parece válido." }, 400);

  try {
    const ip = await hmac("ip:" + ipDe(req));
    const em = await hmac("email:" + email);
    const ipReal = ipDe(req);

    const falta = await espera(acao, ip, em);
    if (falta > 0) return bloqueado(falta);

    if (acao === "entrar") {
      const senha = String(corpo.senha ?? "");
      if (!senha || senha.length > 200) return resposta({ erro: "Preencha e-mail e senha." }, 400);
      const { status, j } = await auth("/token?grant_type=password", { email, password: senha }, ipReal);
      if (status === 200 && j.access_token) {
        await registra(acao, ip, em, true);
        return resposta({ sessao: sessaoDe(j) });
      }
      const cod = codigoErro(j);
      // senha certa, e-mail ainda não confirmado: não é tentativa errada
      if (cod === "email_not_confirmed") return resposta({ erro: "Email not confirmed", codigo: cod }, 400);
      if (status === 429) return bloqueado(60);
      if (status >= 500) return resposta({ erro: "Auth indisponível" }, 502);
      await registra(acao, ip, em, false);
      return resposta({ erro: "Invalid login credentials", codigo: cod || "invalid_credentials" }, 400);
    }

    const tipo = corpo.tipo === "cadastro" ? "cadastro" : corpo.tipo === "senha" ? "senha" : "";
    if (!tipo) return resposta({ erro: "tipo inválido" }, 400);

    if (acao === "pedir_codigo") {
      await registra(acao, ip, em, true);
      const { status, j } = tipo === "senha"
        ? await auth("/recover", { email }, ipReal)
        : await auth("/resend", { type: "signup", email }, ipReal);
      if (status === 429) return bloqueado(60);
      if (status >= 400) console.warn("pedir_codigo:", status, codigoErro(j));
      // resposta neutra: não diz se o e-mail tem conta
      return resposta({ ok: true });
    }

    // confirmar_codigo
    const codigo = String(corpo.codigo ?? "").replace(/\D/g, "");
    if (codigo.length !== 6) return resposta({ erro: "Digite os 6 dígitos do código." }, 400);
    const { status, j } = await auth("/verify", { type: tipo === "senha" ? "recovery" : "signup", email, token: codigo }, ipReal);
    if (status === 200 && j.access_token) {
      await registra(acao, ip, em, true);
      return resposta({ sessao: sessaoDe(j) });
    }
    if (status === 429) return bloqueado(60);
    if (status >= 500) return resposta({ erro: "Auth indisponível" }, 502);
    await registra(acao, ip, em, false);
    return resposta({ erro: "Código incorreto ou vencido. Peça outro.", codigo: "codigo_invalido" }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ erro: "Não foi possível agora. Tente de novo." }, 500);
  }
});
