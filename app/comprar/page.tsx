"use client";

import { useEffect, useMemo, useState } from "react";

type PixState = {
  token: string;
  mp_payment_id?: string;
  pix?: {
    qr_code?: string;
    qr_code_base64?: string;
    qr_base64?: string;
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
  useEffect(() => setOrigin(window.location.origin), []);

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
      setErr("Crie uma senha com no mínimo 6 caracteres.");
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
        setErr(data?.details ? `${data?.error} — ${data?.details}` : data?.error || "Erro ao gerar Pix.");
        return;
      }

      setPix({
        token: data?.token,
        mp_payment_id: data?.mp_payment_id || data?.payment_id || data?.id,
        pix: {
          qr_code: data?.pix?.qr_code ?? data?.qr_code,
          qr_code_base64:
            data?.pix?.qr_code_base64 ??
            data?.qr_code_base64 ??
            data?.pix?.qr_base64 ??
            data?.qr_base64,
          qr_base64: data?.pix?.qr_base64 ?? data?.qr_base64,
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

  // Polling: a cada 3s pergunta se token já está paid
  useEffect(() => {
    let timer: any = null;

    async function check() {
      if (!pix?.token || paid) return;
      setChecking(true);
      try {
        const r = await fetch(`/api/check_purchase?token=${encodeURIComponent(pix.token)}`, {
          cache: "no-store",
        });
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

  // Quando pagar: redireciona pro login
  useEffect(() => {
    if (!paid) return;
    const t = setTimeout(() => {
      window.location.href = "/login";
    }, 900);
    return () => clearTimeout(t);
  }, [paid]);

  return (
    <main className="page">
      {/* Background imagem + overlays */}
      <div className="bgImage" />
      <div className="bgGlow" />
      <div className="bgVignette" />

      <div className="wrap">
        <header className="top">
          <div className="brand">
            <div className="title">Pagamento via Pix</div>
            <div className="sub">
              Digite seu WhatsApp e crie uma senha. Depois do pagamento, você entra com esses dados para acessar o conteúdo.
            </div>
          </div>

          <a className="pillLink" href="/login">
            Entrar
          </a>
        </header>

        <section className="grid">
          <div className="left">
            <div className="heroCard">
              <div className="kicker">Acesso imediato</div>
              <h1>Uma solução confortável, prática e discreta.</h1>
              <p>
                Você paga via Pix e usa seu WhatsApp + senha para recuperar o acesso quando quiser, em qualquer dispositivo.
              </p>

              <div className="bullets">
                <div className="b">• Sem plataformas intermediárias</div>
                <div className="b">• Conteúdo em formato “módulo” (site)</div>
                <div className="b">• Acesso protegido após pagamento</div>
              </div>
            </div>
          </div>

          <div className="right">
            <div className="card">
              <div className="h2">Seus dados</div>
              <div className="muted">Use WhatsApp com DDD. Ex: 31 99999-9999</div>

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
                  className="input"
                  type="password"
                />
              </div>

              <div className="btnRow">
                <button onClick={gerarPix} disabled={loading} className="btn btnPrimary">
                  {loading ? "Gerando..." : "Confirmar"}
                </button>
                <a className="btn" href="/login">
                  Já tenho conta
                </a>
              </div>

              {err && <div className="err">{err}</div>}
            </div>

            {pix && (
              <div className="card">
                <div className="h2">Pague com Pix</div>
                <div className="muted">
                  Escaneie o QR Code ou copie e cole. A página atualiza automaticamente quando o pagamento for aprovado.
                </div>

                {pix?.pix?.qr_code_base64 && (
                  <div className="qrBox">
                    <img
                      src={
                        String(pix.pix.qr_code_base64).startsWith("data:")
                          ? String(pix.pix.qr_code_base64)
                          : `data:image/png;base64,${pix.pix.qr_code_base64}`
                      }
                      alt="QR Code Pix"
                      className="qr"
                    />
                  </div>
                )}

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
                    {paid ? "✅ Pagamento aprovado" : checking ? "⏳ Verificando pagamento..." : "⏳ Aguardando pagamento"}
                  </div>

                  {paid && (
                    <div className="afterPay">
                      <div className="muted small">Redirecionando para o login…</div>
                      <div className="muted tiny">Token (interno): {pix.token}</div>
                      {accessLink ? <div className="muted tiny">Debug link: {accessLink}</div> : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        :global(body) {
          margin: 0;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          color: #e5e7eb;
          background: #070b12;
        }

        .page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }

        /* ✅ BACKGROUND IMAGEM (coloque em /public/bg-paywall.jpg) */
        .bgImage {
          position: fixed;
          inset: 0;
          background-image: url("/bg-paywall.jpg");
          background-size: cover;
          background-position: center;
          filter: saturate(0.95) contrast(1.05);
          transform: scale(1.03);
          opacity: 0.22;
          pointer-events: none;
        }

        /* glow azul */
        .bgGlow {
          position: fixed;
          inset: 0;
          background: radial-gradient(900px 600px at 25% 15%, rgba(147, 197, 253, 0.18), transparent 60%),
            radial-gradient(800px 520px at 75% 25%, rgba(59, 130, 246, 0.12), transparent 58%),
            linear-gradient(180deg, rgba(7, 11, 18, 0.55) 0%, rgba(11, 18, 32, 0.92) 100%);
          pointer-events: none;
        }

        /* vinheta */
        .bgVignette {
          position: fixed;
          inset: 0;
          background: radial-gradient(1200px 700px at 50% 35%, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.55));
          pointer-events: none;
        }

        .wrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 26px 16px 90px;
          position: relative;
          z-index: 2;
        }

        .top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.62);
          border-radius: 18px;
          padding: 16px 16px;
          backdrop-filter: blur(10px) saturate(170%);
        }

        .brand .title {
          font-weight: 900;
          font-size: 22px;
          letter-spacing: 0.2px;
          margin-bottom: 6px;
        }

        .sub {
          color: #a1a1aa;
          font-size: 14px;
          max-width: 70ch;
          line-height: 1.5;
        }

        .pillLink {
          font-size: 13px;
          color: #cfe3ff;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          padding: 9px 12px;
          border-radius: 999px;
          white-space: nowrap;
          height: fit-content;
        }

        .grid {
          margin-top: 18px;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 18px;
          align-items: start;
        }

        .heroCard {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.55);
          box-shadow: 0 18px 55px rgba(0, 0, 0, 0.35);
          padding: 18px 16px;
          backdrop-filter: blur(10px) saturate(170%);
        }

        .kicker {
          display: inline-block;
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(147, 197, 253, 0.25);
          background: rgba(147, 197, 253, 0.08);
          color: #cfe3ff;
          margin-bottom: 10px;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 26px;
          line-height: 1.15;
          letter-spacing: 0.2px;
        }

        .heroCard p {
          margin: 0 0 14px;
          color: #c3c7d1;
          line-height: 1.55;
          font-size: 14px;
        }

        .bullets {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }

        .b {
          font-size: 13px;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          padding: 10px 12px;
        }

        .card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.68);
          box-shadow: 0 18px 55px rgba(0, 0, 0, 0.35);
          padding: 18px 16px;
          backdrop-filter: blur(10px) saturate(170%);
          margin-bottom: 18px;
        }

        .h2 {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 800;
        }

        .muted {
          margin: 0 0 14px;
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.5;
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
          font-size: 15px;
          outline: none;
        }

        .btnRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
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

        .qrBox {
          margin-top: 10px;
          display: inline-block;
          border-radius: 14px;
          padding: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
        }

        .qr {
          width: 280px;
          height: 280px;
          object-fit: contain;
          border-radius: 12px;
          background: #fff;
        }

        .label {
          font-size: 13px;
          color: #a1a1aa;
          margin: 10px 0 6px;
        }

        .textarea {
          width: 100%;
          min-height: 120px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #e5e7eb;
          resize: vertical;
          font-size: 13px;
        }

        .statusBox {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pill {
          display: inline-block;
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 13px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
        }

        .pillOk {
          border-color: rgba(34, 197, 94, 0.35);
          background: rgba(34, 197, 94, 0.12);
        }

        .pillWait {
          border-color: rgba(147, 197, 253, 0.25);
          background: rgba(147, 197, 253, 0.08);
        }

        .afterPay {
          margin-top: 10px;
        }

        .small {
          font-size: 12px;
        }

        .tiny {
          font-size: 11px;
          margin-top: 6px;
          opacity: 0.8;
          word-break: break-all;
        }

        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .row2 {
            grid-template-columns: 1fr;
          }
          .btnRow {
            grid-template-columns: 1fr;
          }
          .qr {
            width: 240px;
            height: 240px;
          }
        }
      `}</style>
    </main>
  );
}
