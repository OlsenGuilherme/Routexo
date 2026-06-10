import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getUsuario, salvarUsuario, registrarLog } from "@/lib/db";

type LoginRequestBody = {
  usuario?: string;
  senha?: string;
  turnstileToken?: string;
};

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconhecido";

  try {
    const body = (await request.json()) as LoginRequestBody;
    const { usuario, senha, turnstileToken } = body;

    // 1. Validar campos obrigatórios
    if (!usuario?.trim() || !senha?.trim()) {
      return NextResponse.json(
        { error: "Usuário e senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (!turnstileToken) {
      return NextResponse.json(
        { error: "Confirme que você não é um robô (verificação Cloudflare)." },
        { status: 400 }
      );
    }

    // 2. Validar Turnstile (pula em localhost e quando widget retornou erro de conexão)
    const isLocalhost =
      request.headers.get("host")?.includes("localhost") ||
      request.headers.get("host")?.includes("127.0.0.1");
    const isTurnstileBypass = turnstileToken === "TURNSTILE_UNAVAILABLE";

    if (!isLocalhost && !isTurnstileBypass) {
      const secretKey = process.env.TURNSTILE_SECRET_KEY;
      if (!secretKey) {
        return NextResponse.json(
          { error: "Erro de configuração de segurança no servidor." },
          { status: 500 }
        );
      }

      try {
        const verifyResponse = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secret: secretKey, response: turnstileToken }),
            signal: AbortSignal.timeout(5000), // timeout de 5s para não travar o login
          }
        );
        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
          await registrarLog({ usuario: usuario.trim().toLowerCase(), data: new Date().toISOString(), sucesso: false, ip });
          return NextResponse.json(
            { error: "Falha na verificação de segurança. Tente novamente." },
            { status: 400 }
          );
        }
      } catch {
        // Se a verificação Cloudflare falhar por timeout/rede, continua com senha
        console.warn("[Login] Turnstile verification failed, proceeding with password auth only");
      }
    }

    // 3. Verificar credenciais
    let isAuthenticated = false;
    const usuarioNormalizado = usuario.trim().toLowerCase();

    // 3a. Usuário admin via variáveis de ambiente
    const adminUsuario = process.env.LOGIN_USUARIO?.toLowerCase();
    const adminSenha = process.env.LOGIN_SENHA;
    if (adminUsuario && adminSenha && usuarioNormalizado === adminUsuario && senha === adminSenha) {
      isAuthenticated = true;
    }

    // 3b. Usuários cadastrados no Supabase
    if (!isAuthenticated) {
      try {
        const usuarioBD = await getUsuario(usuarioNormalizado);
        if (usuarioBD) {
          // Bloqueia cadastros pendentes de aprovação
          if (usuarioBD.status === "pendente") {
            await registrarLog({ usuario: usuarioNormalizado, data: new Date().toISOString(), sucesso: false, ip });
            return NextResponse.json(
              { error: "Seu cadastro está pendente de aprovação pelo administrador." },
              { status: 403 }
            );
          }
          // Bloqueia contas desativadas pelo admin
          if (!usuarioBD.ativo || usuarioBD.status === "desativado") {
            await registrarLog({ usuario: usuarioNormalizado, data: new Date().toISOString(), sucesso: false, ip });
            return NextResponse.json(
              { error: "Esta conta está desativada. Contate o administrador." },
              { status: 403 }
            );
          }
          const senhaCorreta = await bcrypt.compare(senha, usuarioBD.senhaHash);
          if (senhaCorreta) {
            isAuthenticated = true;
            await salvarUsuario({ ...usuarioBD, ultimoLogin: new Date().toISOString() });
          }
        }
      } catch (dbErr) {
        console.error("[Login] Erro ao consultar Supabase:", dbErr);
      }
    }

    // 4. Registrar log de acesso
    await registrarLog({
      usuario: usuarioNormalizado,
      data: new Date().toISOString(),
      sucesso: isAuthenticated,
      ip,
    }).catch(() => {});

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Usuário ou senha incorretos." },
        { status: 401 }
      );
    }

    // 5. Definir cookie de sessão
    const cookieStore = await cookies();
    cookieStore.set("auth_token", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
    });

    return NextResponse.json({ success: true, message: "Autenticado com sucesso." });
  } catch (error) {
    console.error("Erro interno no login:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor durante a autenticação." },
      { status: 500 }
    );
  }
}



/** <!-- Desenvolvido por Guilherme Olsen ® --> */
