/**
 * lib/db.ts
 * Helper centralizado para acesso ao Supabase (PostgreSQL).
 * Usa service_role key para contornar RLS nas operações do servidor. ( <!-- Desenvolvido por Guilherme Olsen ® --> )
 */
import { createClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────
// Cliente Supabase (singleton)
// ──────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Erro de configuração do banco de dados. Contate o administrador."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ──────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────

export type Usuario = {
  usuario: string;
  senhaHash: string;
  criadoEm: string;
  ultimoLogin: string | null;
  ativo: boolean;
  /** 'ativo' | 'pendente' | 'desativado' */
  status: string;
};

export type LogAcesso = {
  usuario: string;
  data: string;
  sucesso: boolean;
  ip: string;
};

// ──────────────────────────────────────────────
// Funções de Usuário
// ──────────────────────────────────────────────

/** Retorna um usuário pelo nome, ou null se não existir */
export async function getUsuario(usuario: string): Promise<Usuario | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("usuario", usuario.toLowerCase())
    .single();

  if (error || !data) return null;

  return {
    usuario: data.usuario,
    senhaHash: data.senha_hash,
    criadoEm: data.criado_em,
    ultimoLogin: data.ultimo_login,
    ativo: data.ativo,
    status: data.status ?? "ativo",
  };
}

/** Salva ou atualiza um usuário no banco */
export async function salvarUsuario(dados: Usuario): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("usuarios").upsert(
    {
      usuario: dados.usuario.toLowerCase(),
      senha_hash: dados.senhaHash,
      criado_em: dados.criadoEm,
      ultimo_login: dados.ultimoLogin,
      ativo: dados.ativo,
      status: dados.status ?? "ativo",
    },
    { onConflict: "usuario" }
  );

  if (error) throw new Error(`Erro ao salvar usuário: ${error.message}`);
}

/** Retorna todos os usuários cadastrados */
export async function listarUsuarios(): Promise<Usuario[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    usuario: row.usuario,
    senhaHash: row.senha_hash,
    criadoEm: row.criado_em,
    ultimoLogin: row.ultimo_login,
    ativo: row.ativo,
    status: row.status ?? "ativo",
  }));
}


/** Remove um usuário do banco */
export async function deletarUsuario(usuario: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("usuarios")
    .delete()
    .eq("usuario", usuario.toLowerCase());

  if (error) throw new Error(`Erro ao deletar usuário: ${error.message}`);
}

// ──────────────────────────────────────────────
// Funções de Log
// ──────────────────────────────────────────────

/** Registra uma tentativa de login */
export async function registrarLog(log: LogAcesso): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("logs_acesso").insert({
    usuario: log.usuario,
    data: log.data,
    sucesso: log.sucesso,
    ip: log.ip,
  });
}

/** Retorna os últimos N logs de acesso */
export async function listarLogs(limite = 100): Promise<LogAcesso[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("logs_acesso")
    .select("*")
    .order("data", { ascending: false })
    .limit(limite);

  if (error || !data) return [];

  return data.map((row) => ({
    usuario: row.usuario,
    data: row.data,
    sucesso: row.sucesso,
    ip: row.ip,
  }));
}


/** <!-- Desenvolvido por Guilherme Olsen ® --> */
