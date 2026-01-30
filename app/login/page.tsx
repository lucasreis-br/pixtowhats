// app/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type LoginResponse = {
  ok?: boolean;
  error?: string;
};

function digitsOnly(v: string) {
  return (v || "").replace(/\D+/g, "");
}

/**
 * Normaliza WhatsApp BR para o formato esperado no backend (DDD + número com 9).
 * Não exige +55.
 */
function normalizeBRWhatsapp(raw: string) {
  let p = digitsOnly(raw);

  if (p.startsWith("55") && (p.length === 12 || p.length === 13)) {
    p = p.slice(2);
  }

  if (p.length === 10) {
    const ddd = p.slice(0, 2);
    const rest = p.slice(2);
    return { ok: true, phone: `${ddd}9${rest}` };
  }

  if (p.length === 11) {
    return { ok: true, phone: p };
  }

  return { ok: false, phone: "" };
}

export default function LoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bgUrl = "/assets/bg-comprar-clean.webp";

  const canSubmit = useMemo(() => {
    const n = normalizeBRWhatsapp(phone);
    return n.ok && password.length >= 6 && !loading;
  }, [phone, password, loading]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const n = normalizeBRWhatsapp(phone);
    if (!n.ok) return setError("Digite seu WhatsApp com DDD (Ex: 31 99999-9999).");
    if (password.length < 6) return setError("Senha inválida.");

    setLoading(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: n.phone, password }),
      });

      const data = (await r.json().catch(() => ({}))) as LoginResponse;

      if (!r.ok || data?.error) {
        setError(data?.error || "login_failed");
        setLoading(false);
        return;
      }

      router.push("/meus-acessos");
    } catch {
      setError("server_error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="bg" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <div className="topRight">
        <Link className="pill" href="/comprar">
          Comprar
        </Link>
      </div>

      <header className="hero">
        <h1>Entrar</h1>
        <p>
          Entre com o mesmo WhatsApp e senha usados na compra. Depois disso, você
          recupera o acesso automaticamente.
        </p>
      </header>

      <section className="center">
        <div className="card">
          <div className="cardHead">
            <h2>Seus dados</h2>
            <span>Use WhatsApp com DDD. Ex: 31 99999-9999</span>
          </div>

          <form onSubmit={onLogin} className="form">
            <div className="row">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Digite seu WhatsApp"
                inputMode="numeric"
                autoComplete="tel"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                type="password"
                autoComplete="current-password"
              />
            </div>

            <div className="actions">
              <button className="btnPrimary" disabled={!canSubmit}>
                {loading ? "Entrando..." : "Entrar"}
              </button>

              <Link className="btnGhost" href="/comprar">
                Quero comprar
              </Link>
            </div>

            {error ? <div className="error">{error}</div> : null}
          </form>
        </div>
      </section>

      <style jsx>{`
        .page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background: #070b12;
          color: #e5e7eb;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }

        .bg {
          position: absolute;
          inset: 0;
          background-image: url("${bgUrl}");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          filter: saturate(1.02) contrast(1.02);
          transform: scale(1.02);
        }

        .vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(
              60% 55% at 50% 30%,
              rgba(7, 11, 18, 0.1) 0%,
              rgba(7, 11, 18, 0.55) 55%,
              rgba(7, 11, 18, 0.88) 100%
            ),
            linear-gradient(180deg, rgba(7, 11, 18, 0.35), rgba(7, 11, 18, 0.7));
          pointer-events: none;
        }

        .topRight {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: flex-end;
          padding: 18px 22px;
        }

        .pill {
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.35);
          backdrop-filter: blur(10px);
          color: #e5e7eb;
          text-decoration: none;
        }
        .pill:hover {
          border-color: rgba(255, 255, 255, 0.22);
        }

        .hero {
          position: relative;
          z-index: 2;
          text-align: center;
          padding: 18px 18px 10px;
          max-width: 920px;
          margin: 0 auto;
        }

        .hero h1 {
          margin: 10px 0 6px;
          font-size: clamp(34px, 4.2vw, 56px);
          letter-spacing: -0.02em;
          font-weight: 700;
          color: rgba(229, 231, 235, 0.92);
          text-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
        }

        .hero p {
          margin: 0 auto;
          max-width: 760px;
          font-size: 14px;
          line-height: 1.45;
          color: rgba(229, 231, 235, 0.65);
          text-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        }

        .center {
          position: relative;
          z-index: 2;
          display: grid;
          place-items: center;
          padding: 18px 16px 60px;
        }

        .card {
          width: min(760px, 92vw);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 16, 28, 0.42);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(18px);
          padding: 18px;
        }

        .cardHead h2 {
          margin: 2px 0 6px;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .cardHead span {
          display: block;
          font-size: 13px;
          color: rgba(229, 231, 235, 0.62);
          margin-bottom: 14px;
        }

        .form .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        input {
          height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.35);
          color: rgba(229, 231, 235, 0.92);
          padding: 0 14px;
          outline: none;
        }
        input::placeholder {
          color: rgba(229, 231, 235, 0.45);
        }
        input:focus {
          border-color: rgba(147, 197, 253, 0.55);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18);
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 14px;
          align-items: center;
        }

        .btnPrimary {
          height: 42px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid rgba(59, 130, 246, 0.35);
          background: rgba(59, 130, 246, 0.35);
          color: rgba(229, 231, 235, 0.95);
          font-weight: 600;
          cursor: pointer;
        }
        .btnPrimary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .btnGhost {
          height: 42px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.1);
          color: rgba(229, 231, 235, 0.92);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
        .btnGhost:hover {
          border-color: rgba(255, 255, 255, 0.22);
        }

        .error {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(239, 68, 68, 0.22);
          background: rgba(239, 68, 68, 0.12);
          color: rgba(255, 255, 255, 0.92);
          font-size: 13px;
        }

        @media (max-width: 820px) {
          .form .row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
