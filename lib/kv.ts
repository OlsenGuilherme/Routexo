/**
 * lib/kv.ts
 * Helper centralizado para acesso ao Redis usando ioredis.
 * Usa a variável REDIS_URL fornecida pelo Vercel Storage.
 * Formato: redis://default:SENHA@HOST:PORT
 */
import Redis from "ioredis";

// Singleton: reutiliza a conexão entre chamadas serverless
let client: Redis | null = null;

function getClient(): Redis {
  if (client && client.status === "ready") return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Erro de configuração do cache. Contate o administrador.");
  }

  client = new Redis(url, {
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    lazyConnect: false,
  });

  client.on("error", (err) => {
    console.error("[Redis] Erro de conexão:", err.message);
  });

  return client;
}

// ──────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────

export type Usuario = {
  usuario: string;
  senhaHash: string;       // bcrypt hash — NUNCA a senha em texto puro
  criadoEm: string;        // ISO 8601
  ultimoLogin: string | null;
  ativo: boolean;
};

export type LogAcesso = {
  usuario: string;
  data: string;            // ISO 8601
  sucesso: boolean;
  ip: string;
};

// ──────────────────────────────────────────────
// Chaves do Redis
// ──────────────────────────────────────────────

const KEY_USUARIOS = "routexo:usuarios";
const KEY_LOGS = "routexo:logs";

// ──────────────────────────────────────────────
// Funções de Usuário
// ──────────────────────────────────────────────

/** Retorna um usuário pelo nome, ou null se não existir */
export async function getUsuario(usuario: string): Promise<Usuario | null> {
  const redis = getClient();
  const raw = await redis.hget(KEY_USUARIOS, usuario.toLowerCase());
  if (!raw) return null;
  return JSON.parse(raw) as Usuario;
}

/** Salva ou atualiza um usuário no banco */
export async function salvarUsuario(dados: Usuario): Promise<void> {
  const redis = getClient();
  await redis.hset(KEY_USUARIOS, dados.usuario.toLowerCase(), JSON.stringify(dados));
}

/** Retorna todos os usuários cadastrados */
export async function listarUsuarios(): Promise<Usuario[]> {
  const redis = getClient();
  const todos = await redis.hgetall(KEY_USUARIOS);
  if (!todos) return [];
  return Object.values(todos).map((v) => JSON.parse(v) as Usuario);
}

/** Remove um usuário do banco */
export async function deletarUsuario(usuario: string): Promise<void> {
  const redis = getClient();
  await redis.hdel(KEY_USUARIOS, usuario.toLowerCase());
}

// ──────────────────────────────────────────────
// Funções de Log
// ──────────────────────────────────────────────

/** Registra uma tentativa de login */
export async function registrarLog(log: LogAcesso): Promise<void> {
  const redis = getClient();
  await redis.lpush(KEY_LOGS, JSON.stringify(log));
  await redis.ltrim(KEY_LOGS, 0, 499); // mantém apenas os 500 mais recentes
}

/** Retorna os últimos N logs de acesso */
export async function listarLogs(limite = 100): Promise<LogAcesso[]> {
  const redis = getClient();
  const raw = await redis.lrange(KEY_LOGS, 0, limite - 1);
  if (!raw) return [];
  return raw.map((v) => JSON.parse(v) as LogAcesso);
}
