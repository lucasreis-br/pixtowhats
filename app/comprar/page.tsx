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
    return `${origin}/a/${pix.token}`;
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
      setErr("Crie uma senha com no mínimo 6 caracteres (serve para recuperar o acesso depois).");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/create_purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, password }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setErr(data?.error || "Erro ao gerar Pix.");
        return;
      }

      setPix({
        token: data?.token,
        mp_payment_id: data?.mp_payment_id || data?.payment_id || data?.id,
        pix: {
          qr_code: data?.pix?.qr_code ?? data?.qr_code,
          qr_code_base64:
            data?.pix?.qr_code_base64 ?? data?.qr_code_base64 ?? data?.qr_base64,
        },
      });
    } catch (e: any) {
      setErr(e?.message || "Erro inesperado.");
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

  async function copiarLink() {
    if (!accessLink) return;
    await navigator.clipboard.writeText(accessLink);
    alert("Link copiado.");
  }

  // Polling: a cada 3s pergunta se token já está paid
  useEffect(() => {
    let timer: any = null;

    async function check() {
      if (!pix?.token || paid) return;
      setChecking(true);
      try {
        const r = await fetch(
          `/api/check_purchase?token=${encodeURIComponent(pix.token)}`,
          { cache: "no-store" }
        );
        const data = await r.json().catch(() => ({}));
        if (r.ok && data?.status === "paid") setPaid(true);
      } finally {
        setChecking(false);
      }
    }

    if (pix?.token && !paid) {
      check();
      timer = setInterval(check, 3000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [pix?.token, paid]);

  // Quando pagar: redireciona
  useEffect(() => {
    if (!paid || !pix?.token) return;

    const t = setTimeout(() => {
      window.location.href = `/a/${pix.token}`;
    }, 900);

    return () => clearTimeout(t);
  }, [paid, pix?.token]);

  return (
    <main className="wrap">
      <div className="bg" />

      <header className="top">
        <div className="brand">
          <div className="titleRow">
            <div className="title">Pagamento via Pix</div>
            <a className="miniLink" href="/meus-acessos">
              Meus acessos
            </a>
          </div>

          <div className="sub">
            Crie um login (WhatsApp + senha). Depois do pagamento, você consegue recuperar o acesso em qualquer dispositivo.
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
            placeholder="Crie uma senha (mín. 6)"
            type="password"
            className="input"
          />
        </div>

        <div className="row">
          <button
            onClick={gerarPix}
            disabled={loading}
            className="btn btnPrimary"
          >
            {loading ? "Gerando..." : "Gerar Pix"}
          </button>
          <a className="btn" href="/login">
            Já tenho conta
          </a>
        </div>

        {err && <div className="err">{err}</div>}
      </section>

      {pix && (
        <section className="card">
          <div className="split">
            <div>
              <h2 className="h2">Pague com Pix</h2>
              <p className="muted">
                Escaneie o QR Code ou copie e cole. A página atualiza sozinha quando o pagamento for aprovado.
              </p>

              {pix?.pix?.qr_code_base64 && (
                <div className="qrBox">
                  <img
                    src={
                      pix.pix.qr_code_base64.startsWith("data:")
                        ? pix.pix.qr_code_base64
                        : `data:image/png;base64,${pix.pix.qr_code_base64}`
                    }
                    alt="QR Code Pix"
                    className="qr"
                  />
                </div>
              )}
            </div>

            <div>
              {pix?.pix?.qr_code && (
                <>
                  <div className="label">Copia e cola</div>
                  <textarea readOnly value={pix.pix.qr_code} className="textarea" />
                  <button onClick={copiarPix} className="btn">
                    Copiar código Pix
                  </button>
                </>
              )}

              <div className="statusBox">
                <div className={`pill ${paid ? "pillOk" : "pillWait"}`}>
                  {paid
                    ? "✅ Pagamento aprovado"
                    : checking
                    ? "⏳ Verificando pagamento..."
                    : "⏳ Aguardando pagamento"}
                </div>

                {paid && (
                  <div className="afterPay">
                    <div className="muted small">Redirecionando…</div>

                    <div className="btnRow">
                      <a className="btn btnPrimary" href={`/a/${pix.token}`}>
                        Abrir manualmente
                      </a>
                      <a className="btn" href="/meus-acessos">
                        Meus acessos
                      </a>
                    </div>

                    {accessLink && (
                      <div className="linkTools">
                        <button className="btn" onClick={copiarLink}>
                          Copiar link
                        </button>
                        <div className="muted small">Token: {pix.token}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <style jsx>{`
        :global(body) {
          margin: 0;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          color: #e5e7eb;
          background: #070b12;
        }
        .wrap { max-width: 980px; margin: 0 auto; padding: 18px 16px 80px; position: relative; }
        .bg {
          position: fixed; inset: 0; pointer-events: none;
          background:
            radial-gradient(1200px 700px at 20% 10%, rgba(147, 197, 253, 0.12), transparent 55%),
            radial-gradient(900px 600px at 80% 20%, rgba(167, 243, 208, 0.1), transparent 55%),
            linear-gradient(180deg, #070b12 0%, #0b1220 100%);
        }
        .top {
          position: sticky; top: 0; z-index: 10;
          background: rgba(7, 11, 18, 0.72);
          backdrop-filter: saturate(180%) blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 14px 0; margin-bottom: 18px;
        }
        .brand { display: flex; flex-direction: column; gap: 6px; }
        .titleRow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .title { font-weight: 800; font-size: 22px; letter-spacing: 0.2px; }
        .miniLink {
          font-size: 13px; color: #93c5fd; text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          padding: 8px 10px; border-radius: 999px; white-space: nowrap;
        }
        .sub { color: #a1a1aa; font-size: 14px; max-width: 70ch; line-height: 1.5; }
        .card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.72);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          padding: 18px 16px;
          margin-bottom: 18px;
        }
        .h2 { margin: 0 0 8px; font-size: 18px; line-height: 1.2; }
        .muted { margin: 0 0 14px; color: #a1a1aa; font-size: 14px; line-height: 1.5; }
        .small { font-size: 12px; margin-top: 8px; }
        .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: center; }
        .input {
          width: 100%; padding: 12px 12px; border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #e5e7eb; font-size: 16px; outline: none;
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
        .btnPrimary { background: rgba(147, 197, 253, 0.16); border-color: rgba(147, 197, 253, 0.22); }
        .err {
          margin-top: 12px; color: #fca5a5;
          background: rgba(220, 38, 38, 0.12);
          border: 1px solid rgba(220, 38, 38, 0.25);
          padding: 10px 12px; border-radius: 12px; font-size: 14px;
        }
        .split { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 16px; align-items: start; }
        .qrBox {
          margin-top: 10px; display: inline-block; border-radius: 14px; padding: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
        }
        .qr { width: 280px; height: 280px; object-fit: contain; border-radius: 12px; background: #fff; }
        .label { font-size: 13px; color: #a1a1aa; margin: 10px 0 6px; }
        .textarea {
          width: 100%; min-height: 120px; padding: 12px; border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #e5e7eb; resize: vertical; font-size: 13px;
        }
        .statusBox { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
        .pill {
          display: inline-block; padding: 8px 10px; border-radius: 999px; font-size: 13px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
        }
        .pillOk { border-color: rgba(34, 197, 94, 0.35); background: rgba(34, 197, 94, 0.12); }
        .pillWait { border-color: rgba(147, 197, 253, 0.25); background: rgba(147, 197, 253, 0.08); }
        .afterPay { margin-top: 12px; }
        .btnRow { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .linkTools { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }

        @media (max-width: 900px) {
          .split { grid-template-columns: 1fr; }
          .qr { width: 240px; height: 240px; }
          .row2 { grid-template-columns: 1fr; }
          .btnPrimary { width: 100%; }
          .btnRow { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
