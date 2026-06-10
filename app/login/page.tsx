"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: object) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// Token especial usado quando o Turnstile não consegue carregar
const TURNSTILE_BYPASS = "TURNSTILE_UNAVAILABLE";
// Tempo máximo de espera pelo widget (em ms)
const TURNSTILE_TIMEOUT = 10000;

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileStatus, setTurnstileStatus] = useState<
    "loading" | "ready" | "verified" | "error" | "timeout"
  >("loading");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Timeout: se o widget não carregar em TURNSTILE_TIMEOUT ms, ativa bypass
    timeoutRef.current = setTimeout(() => {
      if (turnstileStatus === "loading") {
        setTurnstileStatus("timeout");
        setTurnstileToken(TURNSTILE_BYPASS);
      }
    }, TURNSTILE_TIMEOUT);

    function renderWidget() {
      if (!turnstileRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");

      const sitekey = isLocalhost
        ? "1x00000000000000000000AA"
        : (process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "");

      setTurnstileStatus("ready");

      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey,
        callback: (token: string) => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setTurnstileToken(token);
          setTurnstileStatus("verified");
        },
        "expired-callback": () => {
          setTurnstileToken("");
          setTurnstileStatus("ready");
        },
        "error-callback": () => {
          // Widget carregou mas teve erro de conexão — ativa bypass
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setTurnstileStatus("error");
          setTurnstileToken(TURNSTILE_BYPASS);
        },
        theme: "light",
        language: "pt-br",
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 300);
      return () => {
        clearInterval(interval);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isBypass =
    turnstileStatus === "error" || turnstileStatus === "timeout";

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setErro("");

    if (!usuario.trim() || !senha.trim()) {
      setErro("Usuário e senha são obrigatórios.");
      return;
    }

    // Se nem em bypass e nem verificado, aguardar
    if (!turnstileToken) {
      setErro("Aguarde a verificação de segurança carregar.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha, turnstileToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErro(data.error || "Erro ao realizar o login. Tente novamente.");
        if (window.turnstile && widgetIdRef.current && !isBypass) {
          window.turnstile.reset(widgetIdRef.current);
          setTurnstileToken("");
          setTurnstileStatus("ready");
        }
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err) {
      console.error("Erro no login:", err);
      setErro("Falha na conexão com o servidor. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--erp-bg)] flex items-center justify-center p-4 text-[var(--erp-text)]">
      <div className="erp-window w-full max-w-[400px] flex flex-col">

        <div className="erp-titlebar">
          ROUTEXO ROTEIRIZAÇÃO — ACESSO AO SISTEMA
        </div>
        <div className="erp-subtitlebar w-full text-center">
          IDENTIFICAÇÃO DO USUÁRIO
        </div>

        <div className="erp-panel-body flex flex-col gap-3 p-5">

          {/* Logo */}
          <div className="flex flex-col items-center gap-1 py-3 border-b border-[var(--erp-border)]">
            <img
              src="/logo.png"
              alt="ROUTEXO Logo"
              style={{ width: 80, height: 80, objectFit: "contain" }}
            />
            <span className="font-bold text-[13px] text-[var(--erp-blue)] mt-1">
              Sistema de Roteirização Inteligente
            </span>
            <span className="erp-muted text-[11px]">ROUTEXO — Módulo Logístico</span>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-3 mt-1">
            <div>
              <label htmlFor="usuario" className="erp-field-label">Usuário:</label>
              <input
                id="usuario"
                className="erp-input"
                type="text"
                autoComplete="username"
                placeholder="Digite seu usuário"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="senha" className="erp-field-label">Senha:</label>
              <input
                id="senha"
                className="erp-input"
                type="password"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Cloudflare Turnstile com fallback */}
            <div>
              <label className="erp-field-label mb-1">Verificação de segurança:</label>

              {/* Widget real do Turnstile */}
              <div
                ref={turnstileRef}
                style={{ display: isBypass ? "none" : "block" }}
              />

              {/* Estado: carregando */}
              {turnstileStatus === "loading" && (
                <div style={{
                  padding: "8px 10px",
                  background: "#f5f8ff",
                  border: "1px solid var(--erp-border)",
                  fontSize: 11,
                  color: "#555",
                }}>
                  ⏳ Carregando verificação de segurança...
                </div>
              )}

              {/* Estado: erro de conexão ou timeout — bypass ativo */}
              {isBypass && (
                <div style={{
                  padding: "8px 10px",
                  background: "#fffbe6",
                  border: "1px solid #f0c040",
                  fontSize: 11,
                  color: "#7a5f00",
                }}>
                  ⚠ Verificação Cloudflare indisponível no momento. O acesso continua protegido por senha.
                </div>
              )}

              {/* Estado: verificado */}
              {turnstileStatus === "verified" && (
                <span className="erp-muted" style={{ fontSize: 10 }}>
                  ✔ Verificação concluída.
                </span>
              )}
            </div>

            {erro && (
              <div style={{
                background: "#fff0f0",
                border: "1px solid var(--erp-red)",
                color: "var(--erp-red)",
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 700,
              }}>
                ⚠ {erro}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input type="checkbox" id="lembrar" />
              <label htmlFor="lembrar" className="erp-small">
                Lembrar usuário neste dispositivo
              </label>
            </div>

            <button
              id="btn-entrar"
              type="submit"
              className="erp-button-primary w-full"
              disabled={loading}
              style={{ height: 30, fontSize: 13 }}
            >
              {loading ? "Autenticando..." : "Entrar"}
            </button>
          </form>

          <div style={{ borderTop: "1px solid var(--erp-border)", marginTop: 4 }} />

          <div className="flex flex-col gap-2">
            <button
              id="btn-criar-conta"
              className="erp-button w-full"
              style={{ height: 26, fontSize: 12 }}
              onClick={() => router.push("/login/criar-conta")}
            >
              Criar novo login
            </button>
            <button
              id="btn-resetar-senha"
              className="erp-button w-full"
              style={{ height: 26, fontSize: 12 }}
              onClick={() => router.push("/login/resetar-senha")}
            >
              Esqueci minha senha
            </button>
          </div>
        </div>

        <div className="erp-statusbar">
          <span>Comercial 1.0.13</span>
          <span className="erp-chip erp-chip-green ml-auto">Sistema Online</span>
          <span className="erp-chip erp-chip-blue">v1.0.0</span>
        </div>
      </div>
    </main>
  );
}
