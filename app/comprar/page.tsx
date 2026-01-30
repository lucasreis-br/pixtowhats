"use client";

import Link from "next/link";
import { useState } from "react";

export default function ComprarPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const r = await fetch("/api/create_purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await r.json();

      if (!r.ok) {
        setError(data?.error || "Erro inesperado");
        setLoading(false);
        return;
      }

      // Aqui você pode abrir modal Pix ou redirecionar
      // Exemplo simples:
      alert("Pix gerado com sucesso. Continue o pagamento.");
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="comprar-root">
      {/* Background puramente visual */}
      <div className="bg-layer" />

      {/* Conteúdo real */}
      <div className="content-layer">
        <header className="top">
          <h1>Pagamento via Pix</h1>
          <p>
            Digite seu WhatsApp e crie uma senha. Após o pagamento,
            você acessa o conteúdo com esses dados.
          </p>

          <Link href="/login" className="login-link">
            Entrar
          </Link>
        </header>

        <form className="card" onSubmit={handleSubmit}>
          <h2>Seus dados</h2>
          <span className="hint">
            Use WhatsApp com DDD. Ex: 31 99999-9999
          </span>

          <input
            type="tel"
            placeholder="Digite seu WhatsApp"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Crie uma senha (mín. 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <div className="actions">
            <button type="submit" disabled={loading}>
              {loading ? "Processando..." : "Confirmar"}
            </button>

            <Link href="/login" className="secondary">
              Já tenho conta
            </Link>
          </div>

          {error && <div className="error">{error}</div>}
        </form>
      </div>

      {/* ESTILOS INLINE (isolados e controlados) */}
      <style jsx>{`
        .comprar-root {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background: #070b12;
        }

        /* BACKGROUND */
        .bg-layer {
          position: absolute;
          inset: 0;
          background-image: url("/content/assets/bg-comprar-clean.webp");
          background-size: cover;
          background-position: center;
          filter: blur(2px) brightness(0.55);
          transform: scale(1.05);
          z-index: 0;
        }

        /* CONTEÚDO REAL */
        .content-layer {
          position: relative;
          z-index: 2;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          color: #e5e7eb;
        }

        .top {
          text-align: center;
          max-width: 520px;
          margin-bottom: 32px;
        }

        .top h1 {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .top p {
          color: #a1a1aa;
          font-size: 14px;
        }

        .login-link {
          position: absolute;
          top: 24px;
          right: 24px;
          color: #93c5fd;
          font-size: 14px;
          text-decoration: none;
        }

        /* CARD */
        .card {
          width: 100%;
          max-width: 420px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .card h2 {
          margin-bottom: 4px;
        }

        .hint {
          display: block;
          font-size: 12px;
          color: #a1a1aa;
          margin-bottom: 16px;
        }

        input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(2, 6, 23, 0.6);
          color: #e5e7eb;
          margin-bottom: 12px;
          outline: none;
        }

        input::placeholder {
          color: #6b7280;
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 12px;
        }

        button {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          background: #2563eb;
          color: white;
          border: none;
          cursor: pointer;
          font-weight: 500;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e5e7eb;
          text-decoration: none;
          font-size: 14px;
        }

        .error {
          margin-top: 12px;
          padding: 10px;
          border-radius: 8px;
          background: rgba(220, 38, 38, 0.15);
          color: #fecaca;
          font-size: 13px;
        }

        @media (max-width: 480px) {
          .top h1 {
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  );
}
