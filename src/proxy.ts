import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão do Supabase a cada navegação e barra rota privada sem login.
 *
 * O Next 16 chama isto de Proxy (era Middleware). A verificação aqui é
 * otimista — a proteção de verdade é a RLS no banco; isto só evita renderizar
 * uma tela vazia para quem não está autenticado.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem Supabase configurado o app roda nos mocks e não há sessão a renovar.
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "supabase" || !url || !key) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser` valida o token no servidor do Supabase. `getSession` apenas lê o
  // cookie, que o cliente pode forjar — por isso não serve para autorizar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/entrar");

  if (!user && !isAuthRoute) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/entrar";
    redirect.searchParams.set("proximo", request.nextUrl.pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && isAuthRoute) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tudo menos arquivo estático e imagem — renovar sessão em requisição de
     * asset só gastaria chamada.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
