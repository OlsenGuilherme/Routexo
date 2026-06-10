import { NextRequest, NextResponse } from "next/server";
import { listarLogs } from "@/lib/db";

function verificarAdmin(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token");
  const adminToken = process.env.ADMIN_SECRET_TOKEN;
  if (!adminToken) return false;
  return token === adminToken;
}

/** GET /api/admin/logs — Retorna os últimos logs de acesso */
export async function GET(request: NextRequest) {
  if (!verificarAdmin(request)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limite = parseInt(searchParams.get("limite") ?? "100", 10);
    const logs = await listarLogs(Math.min(limite, 500));
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Erro ao listar logs:", error);
    return NextResponse.json({ error: "Erro ao buscar logs." }, { status: 500 });
  }
}
