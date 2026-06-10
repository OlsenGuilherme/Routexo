import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsuario, salvarUsuario } from "@/lib/db";

type RegisterRequestBody = {
  usuario?: string;
  senha?: string;
  turnstileToken?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterRequestBody;
    const { usuario, senha, turnstileToken } = body;

    // 1. Validações básicas
    if (!usuario?.trim() || !senha?.trim()) {
      return NextResponse.json({ error: "Usuário e senha são obrigatórios." }, { status: 400 });
    }
    if (usuario.length < 4) {
      return NextResponse.json({ error: "O nome de usuário deve ter pelo menos 4 caracteres." }, { status: 400 });
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }
    if (!turnstileToken) {
      return NextResponse.json({ error: "Confirme a verificação de segurança (Cloudflare Turnstile)." }, { status: 400 });
    }

    // 2. Validar Turnstile (pula em localhost)
    const isLocalhost =
      request.headers.get("host")?.includes("localhost") ||
      request.headers.get("host")?.includes("127.0.0.1");

    if (!isLocalhost) {
      const secretKey = process.env.TURNSTILE_SECRET_KEY;
      if (!secretKey) {
        return NextResponse.json({ error: "Erro de configuração de segurança no servidor." }, { status: 500 });
      }
      const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretKey, response: turnstileToken }),
      });
      const verifyData = await verifyResponse.json();
      if (!verifyData.success) {
        return NextResponse.json({ error: "Falha na verificação de segurança. Tente novamente." }, { status: 400 });
      }
    }

    // 3. Verificar se o usuário já existe no Supabase
    const usuarioExistente = await getUsuario(usuario.trim().toLowerCase());
    if (usuarioExistente) {
      return NextResponse.json({ error: "Este nome de usuário já está em uso. Escolha outro." }, { status: 409 });
    }

    // 4. Não permitir sobrescrever o usuário admin padrão
    const adminUser = (process.env.LOGIN_USUARIO || "admin").toLowerCase();
    if (usuario.trim().toLowerCase() === adminUser) {
      return NextResponse.json({ error: "Este nome de usuário não está disponível." }, { status: 409 });
    }

    // 5. Criptografar a senha com bcrypt (custo 12)
    const senhaHash = await bcrypt.hash(senha, 12);

    // 6. Salvar no Supabase com status 'pendente' — aguarda aprovação do admin
    await salvarUsuario({
      usuario: usuario.trim().toLowerCase(),
      senhaHash,
      criadoEm: new Date().toISOString(),
      ultimoLogin: null,
      ativo: false,
      status: "pendente",
    });

    return NextResponse.json({
      success: true,
      message: "Cadastro realizado! Aguarde a aprovação do administrador para acessar o sistema.",
    });
  } catch (error) {
    console.error("Erro interno no cadastro:", error);
    return NextResponse.json({ error: "Erro interno no servidor durante a criação de conta." }, { status: 500 });
  }
}
