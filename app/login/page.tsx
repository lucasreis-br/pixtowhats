"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function onlyDigits(v: any) {
  return String(v || "").replace(/\D/g, "");
}
function normalizeBR(raw: string) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

export default function LoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function entrar() {
    setErr(null);

    const normalized = normalizeBR(phone);
    if (!normalized || normalized.length < 12) {
      setErr("Digite seu WhatsApp com DDD. Ex: 31 99999-9999");
      return;
    }
    if (!password || password.length < 6) {
      setErr("Digite sua senha (mín. 6).");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, password }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(data?.error === "invalid_login" ? "Telefone ou senha inválidos." : "Erro ao entrar.");
        return;
      }

      router.replace("/meus-acessos");
    } catch (e: any) {
      setErr(e?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="wrap">
      <div className="bg" />

      <header className="top">
        <div className="brand">
          <div className="titleRow">
            <div className="title">Entrar</div>
            <a className="miniLink" href="/comprar">
              Comprar
            </a>
          </div>

          <div className="sub">
            Entre com o mesmo WhatsApp e senha usados na compra. Depois disso, você recupera o acesso automaticamente.
          </div>
        </div>
      </header>

      <section className="card">
        <h2 className="h2">Seus dados</h2>
        <p className="muted">Use WhatsApp com DDD. Ex: 31 99999-9999</p>

        <div className="row2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Digite seu WhatsApp"
            className="input"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            type="password"
            className="input"
          />
        </div>

        {err && <div className="err">{err}</div>}

        <div className="row">
          <button onClick={entrar} disabled={loading} className="btn btnPrimary">
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <a className="btn" href="/comprar">
            Voltar
          </a>
        </div>
      </section>

      <style jsx>{`
        :global(body) {
          margin: 0;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          color: #e5e7eb;
          background: #070b12;
        }
        .wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 18px 16px 80px;
          position: relative;
        }
        .bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(1200px 700px at 20% 10%, rgba(147, 197, 253, 0.12), transparent 55%),
            radial-gradient(900px 600px at 80% 20%, rgba(167, 243, 208, 0.1), transparent 55%),
            linear-gradient(180deg, #070b12 0%, #0b1220 100%);
        }
        .top {
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(7, 11, 18, 0.72);
          backdrop-filter: saturate(180%) blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 14px 0;
          margin-bottom: 18px;
        }
        .brand {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .titleRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .title {
          font-weight: 800;
          font-size: 22px;
          letter-spacing: 0.2px;
        }
        .miniLink {
          font-size: 13px;
          color: #93c5fd;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          padding: 8px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .sub {
          color: #a1a1aa;
          font-size: 14px;
          max-width: 70ch;
          line-height: 1.5;
        }
        .card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.72);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          padding: 18px 16px;
          margin-bottom: 18px;
        }
        .h2 {
          margin: 0 0 8px;
          font-size: 18px;
          line-height: 1.2;
        }
        .muted {
          margin: 0 0 14px;
          color: #a1a1aa;
          font-size: 14px;
          line-height: 1.5;
        }
        .row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          align-items: center;
        }
        .input {
          width: 100%;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #e5e7eb;
          font-size: 16px;
          outline: none;
        }
        .btn {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #e5e7eb;
          padding: 10px 12px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btnPrimary {
          background: rgba(147, 197, 253, 0.16);
          border-color: rgba(147, 197, 253, 0.22);
        }
        .err {
          margin-top: 12px;
          color: #fca5a5;
          background: rgba(220, 38, 38, 0.12);
          border: 1px solid rgba(220, 38, 38, 0.25);
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
        }
        @media (max-width: 900px) {
          .row2 {
            grid-template-columns: 1fr;
          }
          .btnPrimary {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
