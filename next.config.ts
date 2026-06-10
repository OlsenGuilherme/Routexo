import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: próprio site + Cloudflare Turnstile + Google (usado internamente pelo Turnstile)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.gstatic.com https://www.google.com",
              // Frames: Cloudflare Turnstile renderiza dentro de um iframe
              "frame-src 'self' https://challenges.cloudflare.com",
              // Estilos
              "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
              // Imagens
              "img-src 'self' data: blob: https:",
              // Fontes (Google Fonts via Next.js)
              "font-src 'self' data: https://fonts.gstatic.com",
              // Conexões de API
              "connect-src 'self' https://challenges.cloudflare.com https://*.supabase.co https://generativelanguage.googleapis.com",
              // Permite TrustedTypePolicy do Cloudflare Turnstile e do Google
              "trusted-types 'allow-duplicates' twKxV6 goog#html default",
              // Permite workers do Cloudflare
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
