"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ComprarPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
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
        setError(data?.error || "Erro ao iniciar pagamento");
        setLoading(false);
        return;
      }

      // Aqui você pode:
      // - mostrar QR Code
      // - ou redirecionar para página de pagamento
      // por enquanto, segue fluxo atual
      if (data?.access_link) {
        router.push("/login");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="overlay" />

      <section className="card">
        <h1>Pagamento via Pix</h1>
        <p className="subtitle">
          Digite seu WhatsApp e crie uma senha. Após o pagamento, você acessa o
          conteúdo com esses dados.
        </p>

        <div className="form">
          <label>
            WhatsApp
            <input
              placeholder="Ex: 31 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              placeholder="Crie uma senha (mín. 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <button onClick={handleSubmit} disabled={loading}>
              {loading ? "Aguarde..." : "Confirmar"}
            </button>
            <button
              className="secondary"
              onClick={() => router.push("/login")}
            >
              Já tenho conta
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background-image: url("/assets/bg-comprar-clean.webp");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 24px;
        }

        .overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(
              circle at center,
              rgba(10, 20, 40, 0.35),
              rgba(5, 10, 25, 0.85)
            ),
            rgba(5, 10, 25, 0.65);
          backdrop-filter: blur(2px);
        }

        .card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 460px;
          background: rgba(15, 23, 42, 0.75);
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(14px);
        }

        h1 {
          margin: 0 0 8px;
          font-size: 26px;
        }

        .subtitle {
          font-size: 14px;
          opacity: 0.85;
          margin-bottom: 24px;
        }

        .form label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 14px;
          font-size: 13px;
        }

        input {
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          outline: none;
        }

        input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        button {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          background: #3b82f6;
          color: white;
        }

        button.secondary {
          background: rgba(255, 255, 255, 0.08);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error {
          background: rgba(220, 38, 38, 0.2);
          color: #fecaca;
          padding: 10px;
          border-radius: 10px;
          font-size: 13px;
          margin-top: 6px;
        }

        @media (max-width: 520px) {
          .card {
            padding: 22px;
          }
        }
      `}</style>
    </main>
  );
}
