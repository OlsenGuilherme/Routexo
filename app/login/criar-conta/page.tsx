"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Declara a função global do Turnstile para o TypeScript
declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: object) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export default function CriarContaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    usuario: "",
    senha: "",
    confirmarSenha: "",
  });
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Renderiza o widget Turnstile após o script ser carregado
  useEffect(() => {
    function renderWidget() {
      if (!turnstileRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return; // já renderizado

      const isLocalhost = typeof window !== "undefined" && 
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

      const sitekey = isLocalhost 
        ? "1x00000000000000000000AA" 
        : (process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "");

      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey,
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
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
      return () => clearInterval(interval);
    }
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function validate() {
    const novosErros: Record<string, string> = {};

    if (!form.usuario.trim()) {
      novosErros.usuario = "Usuário é obrigatório.";
    } else if (form.usuario.length < 4) {
      novosErros.usuario = "Usuário deve ter pelo menos 4 caracteres.";
    }

    if (!form.senha) {
      novosErros.senha = "Senha é obrigatória.";
    } else if (form.senha.length < 5) {
      novosErros.senha = "Senha deve ter pelo menos 5 caracteres.";
    }

    if (form.senha !== form.confirmarSenha) {
      novosErros.confirmarSenha = "As senhas não coincidem.";
    }

    return novosErros;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const novosErros = validate();

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    if (!turnstileToken) {
      setErros({ turnstile: "Confirme a verificação de segurança (Turnstile)." });
      return;
    }

    setErros({});
    setLoading(true);

    try {
      const response = await fetch("/api/criar-conta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuario: form.usuario,
          senha: form.senha,
          turnstileToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErros({ geral: data.error || "Erro ao criar conta. Tente novamente." });
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
          setTurnstileToken("");
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      setSucesso(true);
    } catch (err) {
      console.error(err);
      setErros({ geral: "Erro de conexão com o servidor." });
      setLoading(false);
    }
  }

  if (sucesso) {
    return (
      <main className="min-h-screen bg-[var(--erp-bg)] flex items-center justify-center p-4 text-[var(--erp-text)]">
        <div className="erp-window w-full max-w-[400px] flex flex-col">
          <div className="erp-titlebar">ROUTEXO ROTEIRIZAÇÃO — NOVO CADASTRO</div>
          <div className="erp-subtitlebar">REGISTRO CONCLUÍDO</div>

          <div className="erp-panel-body flex flex-col items-center gap-4 p-6">
            <div
              style={{
                width: 48,
                height: 48,
                background: "linear-gradient(135deg, #1391d0, #0b78b6)",
                border: "2px solid var(--erp-blue-dark)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                color: "white",
                fontWeight: 900,
              }}
            >
              ✓
            </div>

            <div className="text-center">
              <p className="font-bold text-[13px]">Conta criada com sucesso!</p>
              <p className="erp-muted text-[11px] mt-1">
                O acesso para o usuário <strong>{form.usuario}</strong> já está ativo no sistema.
              </p>
            </div>

            <button
              className="erp-button-primary w-full"
              style={{ height: 30, fontSize: 13, marginTop: 10 }}
              onClick={() => router.push("/login")}
            >
              Ir para o Login
            </button>
          </div>

          <div className="erp-statusbar">
            <span>Módulo Logístico</span>
            <span className="erp-chip erp-chip-green ml-auto">v1.0.0</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--erp-bg)] flex items-center justify-center p-4 text-[var(--erp-text)]">
      <div className="erp-window w-full max-w-[400px] flex flex-col">
        <div className="erp-titlebar">ROUTEXO ROTEIRIZAÇÃO — NOVO CADASTRO</div>
        <div className="erp-subtitlebar">REGISTRO DE USUÁRIO</div>

        <div className="erp-panel-body flex flex-col gap-3 p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label htmlFor="usuario" className="erp-field-label">
                Novo Usuário:
              </label>
              <input
                id="usuario"
                name="usuario"
                className="erp-input"
                type="text"
                autoComplete="off"
                placeholder="Ex: operador1"
                value={form.usuario}
                onChange={handleChange}
                disabled={loading}
              />
              {erros.usuario && (
                <span className="text-[var(--erp-red)] text-[10px] font-bold">
                  {erros.usuario}
                </span>
              )}
            </div>

            <div>
              <label htmlFor="senha" className="erp-field-label">
                Senha de Acesso:
              </label>
              <input
                id="senha"
                name="senha"
                className="erp-input"
                type="password"
                placeholder="Mínimo 5 caracteres"
                value={form.senha}
                onChange={handleChange}
                disabled={loading}
              />
              {erros.senha && (
                <span className="text-[var(--erp-red)] text-[10px] font-bold">
                  {erros.senha}
                </span>
              )}
            </div>

            <div>
              <label htmlFor="confirmarSenha" className="erp-field-label">
                Confirmar Senha:
              </label>
              <input
                id="confirmarSenha"
                name="confirmarSenha"
                className="erp-input"
                type="password"
                placeholder="Confirme a senha"
                value={form.confirmarSenha}
                onChange={handleChange}
                disabled={loading}
              />
              {erros.confirmarSenha && (
                <span className="text-[var(--erp-red)] text-[10px] font-bold">
                  {erros.confirmarSenha}
                </span>
              )}
            </div>

            {/* Cloudflare Turnstile */}
            <div>
              <label className="erp-field-label mb-1">
                Verificação de segurança:
              </label>
              <div ref={turnstileRef} />
              {erros.turnstile && (
                <span className="text-[var(--erp-red)] text-[10px] font-bold">
                  {erros.turnstile}
                </span>
              )}
            </div>

            {erros.geral && (
              <div
                style={{
                  background: "#fff0f0",
                  border: "1px solid var(--erp-red)",
                  color: "var(--erp-red)",
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                ⚠ {erros.geral}
              </div>
            )}

            <button
              type="submit"
              className="erp-button-primary w-full"
              disabled={loading}
              style={{ height: 30, fontSize: 13, marginTop: 4 }}
            >
              {loading ? "Cadastrando..." : "Cadastrar Usuário"}
            </button>
          </form>

          <div style={{ borderTop: "1px solid var(--erp-border)", marginTop: 4 }} />

          <button
            className="erp-button w-full"
            style={{ height: 26, fontSize: 12 }}
            onClick={() => router.push("/login")}
            disabled={loading}
          >
            Voltar ao Login
          </button>
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
