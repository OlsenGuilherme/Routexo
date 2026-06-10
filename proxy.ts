import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rotas públicas — deixar passar sem verificar autenticação ──────
  const isLoginPage = pathname.startsWith("/login");
  const isAdminPage = pathname.startsWith("/admin"); // autenticação própria por token
  const isPublicApi =
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/logout") ||
    pathname.startsWith("/api/criar-conta") ||
    pathname.startsWith("/api/admin"); // validação feita dentro de cada API handler
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    /\.(png|jpg|jpeg|svg|ico|webp|gif)$/.test(pathname);

  if (isLoginPage || isAdminPage || isPublicApi || isPublicAsset) {
    return NextResponse.next();
  }

  // ── Verificar autenticação para todas as outras rotas ─────────────
  const token = request.cookies.get("auth_token")?.value;

  if (!token || token !== "true") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Executar em todas as páginas exceto arquivos estáticos e imagens
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico).*)",
  ],
};

