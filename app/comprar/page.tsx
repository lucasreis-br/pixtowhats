"use client";

import { useEffect, useMemo, useState } from "react";

type PixState = {
  token: string;
  mp_payment_id: string;
  pix?: {
    qr_code?: string;
    qr_code_base64?: string;
  };
};

function onlyDigits(v: any) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeBR(raw: string) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

export default function ComprarPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [pix, setPix] = useState<PixState | null>(null);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const accessLink = useMemo(() => {
    if (!pix?.token || !origin) return "";
    return `${origin}/login`;
  }, [pix?.token, origin]);

  async function gerarPix() {
    setErr(null);
    setPaid(false);
    setPix(null);

    const normalized = normalizeBR(phone);

    if (!normalized || normalized.length < 12) {
      setErr("Digite seu WhatsApp com DDD. Ex: 31 99999-9999");
      return;
    }
    if (!password || password.length < 6) {
      setErr("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/create_purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          password,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(data?.error || "Erro ao gerar Pix.");
        return;
      }

      setPix({
        token: data.token,
        mp_payment_id: data.mp_payment_id,
        pix: data.pix,
      });
    } catch {
      setErr("Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function copiarPix() {
    const code = pix?.pix?.qr_code;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    alert("Código Pix copiado.");
  }

  // polling pagamento
  useEffect(() => {
    let timer: any;

    async function check() {
      if (!pix?.token || paid) return;
      setChecking(true);
      try {
        const r = await fetch(`/api/check_purchase?token=${pix.token}`, {
          cache: "no-store",
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data?.status === "paid") {
          setPaid(true);
          window.location.href = "/login";
        }
      } finally {
        setChecking(false);
      }
    }

    if (pix?.token && !paid) {
      check();
      timer = setInterval(check, 3000);
    }

    return () => timer && clearInterval(timer);
  }, [pix?.token, paid]);

  return (
    <main className="wrap">
      <div className="bg" />

      <header className="top">
        <div className="titleBlock">
          <h1>Pagamento via Pix</h1>
          <p>
            Digite seu WhatsApp e crie uma senha. Após o pagamento, você acessa
            o conteúdo com esses dados.
          </p>
        </div>
        <a className="miniLink" href="/login">Entrar</a>
      </header>

      <section className="card">
        {!pix && (
          <>
            <h2>Seus dados</h2>
            <p className="muted">
              Use WhatsApp com DDD. Ex: 31 99999-9999
            </p>

            <div className="row">
              <input
                placeholder="Digite seu WhatsApp"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
              />
              <input
                placeholder="Crie uma senha (mín. 6)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>

            <div className="actions">
              <button
                onClick={gerarPix}
                disabled={loading}
                className="btn btnPrimary"
              >
                {loading ? "Gerando Pix..." : "Confirmar"}
              </button>
              <a href="/login" className="btn">
                Já tenho conta
              </a>
            </div>

            {err && <div className="err">{err}</div>}
          </>
        )}

        {pix && (
          <>
            <h2>Pague com Pix</h2>
            <p className="muted">
              Escaneie o QR Code ou copie o código abaixo.
            </p>

            {pix.pix?.qr_code_base64 && (
              <img
                className="qr"
                src={
                  pix.pix.qr_code_base64.startsWith("data:")
                    ? pix.pix.qr_code_base64
                    : `data:image/png;base64,${pix.pix.qr_code_base64}`
                }
              />
            )}

            {pix.pix?.qr_code && (
              <>
                <textarea
                  readOnly
                  value={pix.pix.qr_code}
                  className="textarea"
                />
                <button onClick={copiarPix} className="btn">
                  Copiar código Pix
                </button>
              </>
            )}

            <div className="status">
              {paid
                ? "Pagamento aprovado. Redirecionando…"
                : checking
                ? "Verificando pagamento…"
                : "Aguardando pagamento"}
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 16px;
        }

        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(1200px 700px at 20% 10%, rgba(147,197,253,.14), transparent 55%),
            radial-gradient(900px 600px at 80% 20%, rgba(167,243,208,.1), transparent 55%),
            url("/assets/bg-comprar.webp");
          background-size: cover;
          background-position: center;
        }

        .bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(7,11,18,.85),
            rgba(11,18,32,.95)
          );
        }

        .top {
          max-width: 900px;
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .titleBlock h1 {
          margin: 0;
          font-size: 28px;
        }

        .titleBlock p {
          margin: 6px 0 0;
          color: #a1a1aa;
        }

        .miniLink {
          color: #93c5fd;
          border: 1px solid rgba(255,255,255,.12);
          padding: 8px 12px;
          border-radius: 999px;
          text-decoration: none;
        }

        .card {
          width: 100%;
          max-width: 520px;
          background: rgba(15,23,42,.75);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 18px;
          padding: 24px;
          backdrop-filter: blur(12px);
          box-shadow: 0 20px 40px rgba(0,0,0,.45);
        }

        h2 { margin: 0 0 8px; }

        .muted {
          color: #a1a1aa;
          margin-bottom: 16px;
        }

        .row {
          display: grid;
          gap: 12px;
        }

        .input {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.15);
          background: rgba(255,255,255,.05);
          color: #e5e7eb;
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .btn {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.15);
          background: rgba(255,255,255,.06);
          color: #e5e7eb;
          cursor: pointer;
          text-decoration: none;
        }

        .btnPrimary {
          background: rgba(147,197,253,.18);
          border-color: rgba(147,197,253,.3);
        }

        .err {
          margin-top: 14px;
          padding: 10px;
          border-radius: 12px;
          background: rgba(220,38,38,.15);
          color: #fecaca;
        }

        .qr {
          width: 260px;
          margin: 16px auto;
          display: block;
          background: #fff;
          padding: 10px;
          border-radius: 12px;
        }

        .textarea {
          width: 100%;
          min-height: 120px;
          margin-top: 12px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255,255,255,.05);
          color: #e5e7eb;
        }

        .status {
          margin-top: 12px;
          color: #93c5fd;
        }
      `}</style>
    </main>
  );
}
