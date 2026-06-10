"use client";

import { useState, useEffect, useCallback } from "react";

type Usuario = {
  usuario: string;
  criadoEm: string;
  ultimoLogin: string | null;
  ativo: boolean;
  status: string; // 'ativo' | 'pendente' | 'desativado'
};

type LogAcesso = {
  usuario: string;
  data: string;
  sucesso: boolean;
  ip: string;
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [erroAuth, setErroAuth] = useState("");

  const [aba, setAba] = useState<"usuarios" | "logs">("usuarios");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [logs, setLogs] = useState<LogAcesso[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: "ok" | "erro" } | null>(null);

  // Modal de reset de senha
  const [modalUsuario, setModalUsuario] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", "x-admin-token": token }),
    [token]
  );

  const mostrarMensagem = (texto: string, tipo: "ok" | "erro") => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 5000);
  };

  async function autenticar() {
    setErroAuth("");
    if (!tokenInput.trim()) {
      setErroAuth("Informe o token de administrador.");
      return;
    }
    try {
      const res = await fetch("/api/admin/usuarios", {
        headers: { "x-admin-token": tokenInput },
      });
      if (res.ok) {
        setToken(tokenInput);
        setAutenticado(true);
      } else {
        const data = await res.json().catch(() => ({}));
        const detail = data.detail ? ` Detalhe: ${data.detail}` : "";
        setErroAuth(`Token inválido (HTTP ${res.status}).${detail}`);
      }
    } catch {
      setErroAuth("Erro de conexão. Verifique sua internet e tente novamente.");
    }
  }

  const carregarUsuarios = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/admin/usuarios", { headers: headers() });
      const data = await res.json();
      setUsuarios(data.usuarios ?? []);
    } finally {
      setCarregando(false);
    }
  }, [headers]);

  const carregarLogs = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/admin/logs?limite=200", { headers: headers() });
      const data = await res.json();
      setLogs(data.logs ?? []);
    } finally {
      setCarregando(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!autenticado) return;
    if (aba === "usuarios") carregarUsuarios();
    else carregarLogs();
  }, [autenticado, aba, carregarUsuarios, carregarLogs]);

  async function alterarStatus(usuario: string, acao: "ativar" | "desativar") {
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ usuario, acao }),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensagem(data.message, "ok");
      carregarUsuarios();
    } else {
      mostrarMensagem(data.error, "erro");
    }
  }

  async function aceitarUsuario(usuario: string) {
    if (!confirm(`Aprovar o cadastro de "${usuario}"? Ele poderá fazer login imediatamente.`)) return;
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ usuario, acao: "aceitar" }),
    });
    const data = await res.json();
    mostrarMensagem(data.message ?? data.error, res.ok ? "ok" : "erro");
    carregarUsuarios();
  }

  async function rejeitarUsuario(usuario: string) {
    if (!confirm(`Rejeitar e EXCLUIR o cadastro de "${usuario}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ usuario, acao: "rejeitar" }),
    });
    const data = await res.json();
    mostrarMensagem(data.message ?? data.error, res.ok ? "ok" : "erro");
    carregarUsuarios();
  }

  async function excluirUsuario(usuario: string) {
    if (!confirm(`Excluir o usuário "${usuario}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/usuarios?usuario=${encodeURIComponent(usuario)}`, {
      method: "DELETE",
      headers: headers(),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensagem(data.message, "ok");
      carregarUsuarios();
    } else {
      mostrarMensagem(data.error, "erro");
    }
  }

  async function resetarSenha() {
    if (!modalUsuario || !novaSenha.trim()) return;
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ usuario: modalUsuario, acao: "reset-senha", novaSenha }),
    });
    const data = await res.json();
    if (res.ok) {
      mostrarMensagem(data.message, "ok");
      setModalUsuario(null);
      setNovaSenha("");
    } else {
      mostrarMensagem(data.error, "erro");
    }
  }

  function formatarData(iso: string | null) {
    if (!iso) return "---";
    return new Date(iso).toLocaleString("pt-BR");
  }

  function getStatusChip(u: Usuario) {
    const s = u.status ?? (u.ativo ? "ativo" : "desativado");
    if (s === "pendente") {
      return (
        <span style={{
          display: "inline-block",
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 700,
          background: "#FFF9C4",
          color: "#7B6000",
          border: "1px solid #F9A825",
          borderRadius: 3,
        }}>
          Pendente
        </span>
      );
    }
    if (s === "desativado" || !u.ativo) {
      return (
        <span style={{
          display: "inline-block",
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 700,
          background: "#FFEBEE",
          color: "#B71C1C",
          border: "1px solid #EF9A9A",
          borderRadius: 3,
        }}>
          Desativado
        </span>
      );
    }
    return (
      <span style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        background: "#E8F5E9",
        color: "#1B5E20",
        border: "1px solid #A5D6A7",
        borderRadius: 3,
      }}>
        Ativo
      </span>
    );
  }

  // Contagem de pendentes para o aviso no topo
  const totalPendentes = usuarios.filter((u) => u.status === "pendente").length;

  // Ordena: pendentes primeiro, depois por nome
  const usuariosOrdenados = [...usuarios].sort((a, b) => {
    if (a.status === "pendente" && b.status !== "pendente") return -1;
    if (a.status !== "pendente" && b.status === "pendente") return 1;
    return a.usuario.localeCompare(b.usuario);
  });

  // ── Tela de login admin ──────────────────────────────────────────
  if (!autenticado) {
    return (
      <main className="min-h-screen bg-[var(--erp-bg)] flex items-center justify-center p-4">
        <div className="erp-window w-full max-w-[360px]">
          <div className="erp-titlebar">ROUTEXO — PAINEL ADMINISTRATIVO</div>
          <div className="erp-subtitlebar text-center">ACESSO RESTRITO</div>
          <div className="erp-panel-body flex flex-col gap-4 p-5">
            <div className="flex flex-col items-center gap-2 py-2 border-b border-[var(--erp-border)]">
              <img src="/logo.png" alt="ROUTEXO" style={{ height: 64, objectFit: "contain" }} />
              <span className="font-bold text-[13px] text-[var(--erp-blue)]">Painel de Administração</span>
            </div>
            <div>
              <label className="erp-field-label">Token de Administrador:</label>
              <input
                className="erp-input"
                type="password"
                placeholder="Digite o token de administrador"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && autenticar()}
              />
            </div>
            {erroAuth && (
              <div style={{ background: "#fff0f0", border: "1px solid var(--erp-red)", color: "var(--erp-red)", padding: "6px 10px", fontSize: 12 }}>
                ⚠ {erroAuth}
              </div>
            )}
            <button className="erp-button-primary w-full" onClick={autenticar} style={{ height: 32 }}>
              Entrar no Painel
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Painel principal ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[var(--erp-bg)] p-4 text-[var(--erp-text)]">
      <div className="erp-window mx-auto max-w-[1200px] flex flex-col">
        <div className="erp-titlebar flex items-center gap-2">
          <img src="/logo.png" alt="ROUTEXO" style={{ height: 26, width: 26, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          ROUTEXO — PAINEL ADMINISTRATIVO
        </div>

        {/* Abas */}
        <div className="flex border-b border-[var(--erp-border-dark)]">
          <button
            className={`erp-titlebar border-r border-[var(--erp-border-dark)] px-6 ${aba === "usuarios" ? "bg-[var(--erp-blue)]" : "bg-[var(--erp-blue-dark)] opacity-70"}`}
            onClick={() => setAba("usuarios")}
          >
            👤 USUÁRIOS
            {totalPendentes > 0 && (
              <span style={{
                marginLeft: 6,
                background: "#F9A825",
                color: "#000",
                borderRadius: 10,
                padding: "1px 7px",
                fontSize: 10,
                fontWeight: 900,
              }}>
                {totalPendentes}
              </span>
            )}
          </button>
          <button
            className={`erp-titlebar px-6 ${aba === "logs" ? "bg-[var(--erp-blue)]" : "bg-[var(--erp-blue-dark)] opacity-70"}`}
            onClick={() => setAba("logs")}
          >
            📋 LOGS DE ACESSO
          </button>
          <div className="flex-1 erp-titlebar flex justify-end gap-2">
            <button
              className="erp-button text-xs px-3"
              onClick={() => aba === "usuarios" ? carregarUsuarios() : carregarLogs()}
            >
              ↺ Atualizar
            </button>
            <a href="/" className="erp-button text-xs px-3">← Voltar ao sistema</a>
          </div>
        </div>

        {/* Mensagem de feedback */}
        {mensagem && (
          <div style={{
            background: mensagem.tipo === "ok" ? "#f0fff4" : "#fff0f0",
            border: `1px solid ${mensagem.tipo === "ok" ? "var(--erp-green)" : "var(--erp-red)"}`,
            color: mensagem.tipo === "ok" ? "var(--erp-green)" : "var(--erp-red)",
            padding: "8px 12px", fontSize: 13, fontWeight: 700,
          }}>
            {mensagem.tipo === "ok" ? "✔" : "⚠"} {mensagem.texto}
          </div>
        )}

        <div className="erp-panel-body p-4">
          {carregando && <p className="erp-muted text-center py-4">Carregando...</p>}

          {/* ── ABA USUÁRIOS ── */}
          {aba === "usuarios" && !carregando && (
            <>
              <div className="mb-3 flex items-center gap-3">
                <strong>
                  Total: {usuarios.length} usuário(s) cadastrado(s)
                </strong>
                {totalPendentes > 0 && (
                  <span style={{
                    background: "#FFF9C4",
                    border: "1px solid #F9A825",
                    color: "#7B6000",
                    padding: "2px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 3,
                  }}>
                    ⏳ {totalPendentes} pendente{totalPendentes > 1 ? "s" : ""} de aprovação
                  </span>
                )}
              </div>

              <div className="erp-scroll max-h-[600px]">
                <table className="erp-table w-full">
                  <thead>
                    <tr>
                      <th>USUÁRIO</th>
                      <th>CRIADO EM</th>
                      <th>ÚLTIMO LOGIN</th>
                      <th>STATUS</th>
                      <th>AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosOrdenados.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: 16, color: "#888" }}>
                          Nenhum usuário cadastrado ainda.
                        </td>
                      </tr>
                    ) : (
                      usuariosOrdenados.map((u) => {
                        const isPendente = u.status === "pendente";
                        return (
                          <tr
                            key={u.usuario}
                            style={isPendente ? { background: "#FFFDE7" } : undefined}
                          >
                            <td><strong>{u.usuario}</strong></td>
                            <td>{formatarData(u.criadoEm)}</td>
                            <td>{formatarData(u.ultimoLogin)}</td>
                            <td>{getStatusChip(u)}</td>
                            <td>
                              {isPendente ? (
                                /* ── Botões para cadastros pendentes ── */
                                <div className="flex gap-1 flex-wrap">
                                  <button
                                    onClick={() => aceitarUsuario(u.usuario)}
                                    style={{
                                      fontSize: 11,
                                      padding: "3px 10px",
                                      background: "#2E7D32",
                                      color: "#fff",
                                      border: "1px solid #1B5E20",
                                      cursor: "pointer",
                                      fontWeight: 700,
                                      borderRadius: 2,
                                    }}
                                  >
                                    ✔ Aceitar Cadastro
                                  </button>
                                  <button
                                    onClick={() => rejeitarUsuario(u.usuario)}
                                    style={{
                                      fontSize: 11,
                                      padding: "3px 10px",
                                      background: "#C62828",
                                      color: "#fff",
                                      border: "1px solid #B71C1C",
                                      cursor: "pointer",
                                      fontWeight: 700,
                                      borderRadius: 2,
                                    }}
                                  >
                                    ✖ Rejeitar Cadastro
                                  </button>
                                </div>
                              ) : (
                                /* ── Botões normais para usuários ativos/desativados ── */
                                <div className="flex gap-1 flex-wrap">
                                  <button
                                    className="erp-button"
                                    style={{ fontSize: 11, padding: "2px 8px" }}
                                    onClick={() => { setModalUsuario(u.usuario); setNovaSenha(""); }}
                                  >
                                    🔑 Resetar Senha
                                  </button>
                                  <button
                                    className="erp-button"
                                    style={{ fontSize: 11, padding: "2px 8px" }}
                                    onClick={() => alterarStatus(u.usuario, u.ativo ? "desativar" : "ativar")}
                                  >
                                    {u.ativo ? "🚫 Desativar" : "✅ Ativar"}
                                  </button>
                                  <button
                                    className="erp-button"
                                    style={{ fontSize: 11, padding: "2px 8px", color: "var(--erp-red)" }}
                                    onClick={() => excluirUsuario(u.usuario)}
                                  >
                                    🗑 Excluir
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── ABA LOGS ── */}
          {aba === "logs" && !carregando && (
            <>
              <div className="mb-3">
                <strong>Últimos {logs.length} acessos registrados</strong>
              </div>
              <div className="erp-scroll max-h-[600px]">
                <table className="erp-table w-full">
                  <thead>
                    <tr>
                      <th>DATA / HORA</th>
                      <th>USUÁRIO</th>
                      <th>IP</th>
                      <th>RESULTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: 16, color: "#888" }}>
                          Nenhum log registrado ainda.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log, i) => (
                        <tr key={i}>
                          <td>{formatarData(log.data)}</td>
                          <td><strong>{log.usuario}</strong></td>
                          <td><code style={{ fontSize: 11 }}>{log.ip}</code></td>
                          <td>
                            <span className={`erp-chip ${log.sucesso ? "erp-chip-green" : "erp-chip-red"}`}>
                              {log.sucesso ? "✔ Sucesso" : "✘ Falha"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Status bar */}
        <div className="erp-statusbar">
          <span>Painel Admin — ROUTEXO</span>
          {totalPendentes > 0 && (
            <span style={{
              background: "#F9A825",
              color: "#000",
              padding: "1px 8px",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 3,
            }}>
              ⏳ {totalPendentes} pendente{totalPendentes > 1 ? "s" : ""}
            </span>
          )}
          <span className="erp-chip erp-chip-green ml-auto">Conectado</span>
        </div>
      </div>

      {/* ── MODAL RESET SENHA ── */}
      {modalUsuario && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalUsuario(null); }}
        >
          <div className="erp-window w-full max-w-[340px]">
            <div className="erp-titlebar">REDEFINIR SENHA</div>
            <div className="erp-panel-body flex flex-col gap-3 p-4">
              <p className="erp-small">
                Definindo nova senha para: <strong>{modalUsuario}</strong>
              </p>
              <div>
                <label className="erp-field-label">Nova Senha:</label>
                <input
                  className="erp-input"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && resetarSenha()}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button className="erp-button-primary flex-1" onClick={resetarSenha}>
                  Confirmar Reset
                </button>
                <button className="erp-button flex-1" onClick={() => setModalUsuario(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


/** <!-- Desenvolvido por Guilherme Olsen ® --> */
