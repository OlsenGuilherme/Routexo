import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Deleta o cookie de autenticação
    cookieStore.delete("auth_token");

    // Também podemos expirar explicitamente para garantir que seja limpo em todos os browsers
    cookieStore.set("auth_token", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return NextResponse.json({
      success: true,
      message: "Sessão encerrada com sucesso.",
    });
  } catch (error) {
    console.error("Erro interno no logout:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor durante o logout." },
      { status: 500 }
    );
  }
}
