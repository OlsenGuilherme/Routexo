import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { listarUsuarios, getUsuario, salvarUsuario, deletarUsuario } from "@/lib/db";

function verificarAdmin(request: NextRequest): { ok: boolean; detail: string } {
  const token = request.headers.get("x-admin-token");
  const adminToken = process.env.ADMIN_SECRET_TOKEN;
  if (!adminToken) return { ok: false, detail: "Token de administrador não configurado no servidor." };
  if (!token) return { ok: false, detail: "Token não informado no header x-admin-token." };
  if (token !== adminToken) return { ok: false, detail: "Token incorreto." };
  return { ok: true, detail: "" };
}
/** <!-- Desenvolvido por Guilherme Olsen ® --> */
/** GET /api/admin/usuarios — Lista todos os usuários */
export async function GET(request: NextRequest) {
  const auth = verificarAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Acesso negado.", detail: auth.detail }, { status: 401 });
  }

  try {
    const usuarios = await listarUsuarios();
    const seguros = usuarios.map(({ senhaHash: _, ...u }) => u);
    return NextResponse.json({ usuarios: seguros });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return NextResponse.json({ error: "Erro ao buscar usuários." }, { status: 500 });
  }
}

/** PATCH /api/admin/usuarios — Resetar senha, ativar/desativar, aceitar ou rejeitar usuário */
export async function PATCH(request: NextRequest) {
  const auth = verificarAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Acesso negado.", detail: auth.detail }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { usuario, acao, novaSenha } = body as {
      usuario: string;
      acao: "reset-senha" | "ativar" | "desativar" | "aceitar" | "rejeitar";
      novaSenha?: string;
    };

    if (!usuario || !acao) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
    }

    const usuarioBD = await getUsuario(usuario.toLowerCase());
    if (!usuarioBD) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    if (acao === "reset-senha") {
      if (!novaSenha || novaSenha.length < 6) {
        return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
      }
      const novoHash = await bcrypt.hash(novaSenha, 12);
      await salvarUsuario({ ...usuarioBD, senhaHash: novoHash });
      return NextResponse.json({ success: true, message: `Senha de "${usuario}" redefinida com sucesso.` });
    }

    if (acao === "ativar" || acao === "desativar") {
      await salvarUsuario({
        ...usuarioBD,
        ativo: acao === "ativar",
        status: acao === "ativar" ? "ativo" : "desativado",
      });
      return NextResponse.json({
        success: true,
        message: `Usuário "${usuario}" ${acao === "ativar" ? "ativado" : "desativado"}.`,
      });
    }

    // ── ACEITAR: aprova o cadastro pendente ──────────────────────
    if (acao === "aceitar") {
      await salvarUsuario({ ...usuarioBD, ativo: true, status: "ativo" });
      return NextResponse.json({
        success: true,
        message: `Cadastro de "${usuario}" aprovado. O usuário já pode fazer login.`,
      });
    }

    // ── REJEITAR: remove o cadastro pendente ─────────────────────
    if (acao === "rejeitar") {
      await deletarUsuario(usuario.toLowerCase());
      return NextResponse.json({
        success: true,
        message: `Cadastro de "${usuario}" rejeitado e removido do sistema.`,
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("Erro na ação admin:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/** DELETE /api/admin/usuarios — Excluir usuário */
export async function DELETE(request: NextRequest) {
  const auth = verificarAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Acesso negado.", detail: auth.detail }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const usuario = searchParams.get("usuario");
    if (!usuario) {
      return NextResponse.json({ error: "Parâmetro 'usuario' obrigatório." }, { status: 400 });
    }
    await deletarUsuario(usuario);
    return NextResponse.json({ success: true, message: `Usuário "${usuario}" excluído.` });
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    return NextResponse.json({ error: "Erro ao excluir usuário." }, { status: 500 });
  }
}
