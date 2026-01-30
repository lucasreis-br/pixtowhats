"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CreatePurchaseResponse = {
  token?: string;
  pix?: {
    qr_code?: string;
    qr_code_base64?: string;
    qr_base64?: string;
  };
  error?: string;
  details?: any;
};

type CheckPurchaseResponse = {
  status?: string;
  paid?: boolean;
  error?: string;
};

function digits(v: string) {
  return (v || "").replace(/\D+/g, "");
}

function normalizeBRWhatsapp(input: string) {
  // Aceita:
  // 31 99999-9999
  // 31999999999
  // +55 31 99999-9999
  // 5531999999999
  let d = digits(input);

  if (d.startsWith("55")) d = d.slice(2);

  // DDD + número:
  // - 11 dígitos: ok (com 9)
  // - 10 dígitos: assume sem 9 -> insere 9 após DDD (melhor compatibilidade)
  if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2);

  if (d.length !== 11) return null;

  return {
    localBR: d, // DDD + número
    e164: "55" + d, // para backend
  };
}

function humanizeError(err: string | null) {
  if (!err) return null;
  const e = String(err);

  if (e === "phone_required") return "Digite seu WhatsApp com DDD.";
  if (e === "phone_invalid") return "WhatsApp inválido. Use DDD + número (ex: 31 99999-9999).";
  if (e === "password_invalid") return "Crie uma senha com no mínimo 6 caracteres.";
  if (e === "invalid_login") return "Este WhatsApp já existe, mas a senha está incorreta.";
  if (e === "mp_create_failed") return "Falha ao gerar o Pix. Tente novamente.";
  if (e === "server_error") return "Erro no servidor. Tente novamente em instantes.";

  // fallback
  return e.replaceAll("_", " ");
}

export default function ComprarPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);

  const bgUrl = "/assets/bg-comprar-clean.webp";

  const canSubmit = useMemo(() => {
    const n = normalizeBRWhatsapp(phone);
    return !!n && password.length >= 6 && !loading;
  }, [phone, password, loading]);

  async function onCreatePurchase(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPaid(false);

    const n = normalizeBRWhatsapp(phone);
    if (!n) return setError("phone_invalid");
    if (password.length < 6) return setError("password_invalid");

    setLoading(true);
    try {
      const r = await fetch("/api/create_purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: n.e164, password }),
      });

      const data = (await r.json().catch(() => ({}))) as CreatePurchaseResponse;

      if (!r.ok || data?.error) {
        setError(data?.error || "server_error");
        return;
      }

      const t = data.token || null;
      const base64 = data?.pix?.qr_code_base64 || data?.pix?.qr_base64 || null;
      const copia = data?.pix?.qr_code || null;

      setToken(t);
      setQrBase64(base64);
      setPixCopiaCola(copia);
    } catch {
      setError("server_error");
    } finally {
      setLoading(false);
    }
  }

  async function checkNow() {
    if (!token) return;

    setChecking(true);
    setError(null);

    try {
      const r = await fetch(`/api/check_purchase?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });

      const data = (await r.json().catch(() => ({}))) as CheckPurchaseResponse;

      const isPaid = data?.paid === true || String(data?.status || "").toLowerCase() === "paid";

      if (isPaid) {
        setPaid(true);
        router.push("/login");
        return;
      }
    } catch {
      setError("server_error");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!token || paid) return;

    const id = setInterval(() => {
      checkNow().catch(() => {});
    }, 4000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, paid]);

  async function copyPix() {
    if (!pixCopiaCola) return;
    try {
      await navigator.clipboard.writeText(pixCopiaCola);
    } catch {}
  }

  const prettyError = humanizeError(error);

  return (
    <main className="page">
      <div className="bg" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <div className="topRight">
        <Link className="pill" href="/login">
          Entrar
        </Link>
      </div>

      <header className="hero">
        <h1>Pagamento via Pix</h1>
        <p>
          Digite seu WhatsApp e crie uma senha. Depois do pagamento, você entra com esses dados
          para acessar o conteúdo.
        </p>
      </header>

      <section className="center">
        <div className="card">
          <div className="cardHead">
            <h2>Seus dados</h2>
            <span>Use WhatsApp com DDD. Ex: 31 99999-9999</span>
          </div>

          {!token ? (
            <form onSubmit={onCreatePurchase} className="form">
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
                  placeholder="Crie uma senha (min. 6)"
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <div className="actions">
                <button className="btnPrimary" disabled={!canSubmit}>
                  {loading ? "Gerando Pix..." : "Confirmar"}
                </button>

                <Link className="btnGhost" href="/login">
                  Já tenho conta
                </Link>
              </div>

              {prettyError ? <div className="error">{prettyError}</div> : null}
            </form>
          ) : (
            <div className="pixBox">
              <div className="pixHeader">
                <div>
                  <strong>Pix gerado</strong>
                  <div className="muted">Pague e você será enviado para o login automaticamente.</div>
                </div>
                <button className="btnGhostSmall" onClick={() => router.push("/login")}>
                  Ir para login
                </button>
              </div>

              <div className="pixGrid">
                <div className="qr">
                  {qrBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${qrBase64}`}
                      alt="QR Code Pix"
                      className="qrImg"
                    />
                  ) : (
                    <div className="qrPlaceholder">QR indisponível</div>
                  )}
                </div>

                <div className="copia">
                  <div className="label">Pix copia e cola</div>
                  <textarea readOnly value={pixCopiaCola || ""} />
                  <div className="actions">
                    <button type="button" className="btnPrimary" onClick={copyPix}>
                      Copiar código
                    </button>
                    <button type="button" className="btnGhost" onClick={checkNow} disabled={checking}>
                      {checking ? "Verificando..." : "Já paguei"}
                    </button>
                  </div>
                  {prettyError ? <div className="error">{prettyError}</div> : null}
                </div>
              </div>
            </div>
          )}
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
          transform: scale(1.02);
          filter: saturate(1.05) contrast(1.03) brightness(1.02);
        }

        /* ↓↓↓ AJUSTE PRINCIPAL: menos escuridão, mais “igual ao mock” */
        .vignette {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(60% 55% at 50% 26%,
              rgba(7, 11, 18, 0.05) 0%,
              rgba(7, 11, 18, 0.42) 55%,
              rgba(7, 11, 18, 0.72) 100%),
            linear-gradient(180deg,
              rgba(7, 11, 18, 0.22),
              rgba(7, 11, 18, 0.55));
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
          background: rgba(10, 16, 28, 0.28);
          backdrop-filter: blur(10px);
          color: rgba(229, 231, 235, 0.95);
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
          margin: 12px 0 8px;
          font-size: clamp(40px, 4.6vw, 64px);
          letter-spacing: -0.02em;
          font-weight: 800;
          color: rgba(229, 231, 235, 0.92);
          text-shadow: 0 16px 40px rgba(0, 0, 0, 0.42);
        }

        .hero p {
          margin: 0 auto;
          max-width: 760px;
          font-size: 14px;
          line-height: 1.45;
          color: rgba(229, 231, 235, 0.70);
          text-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
        }

        .center {
          position: relative;
          z-index: 2;
          display: grid;
          place-items: center;
          padding: 18px 16px 60px;
        }

        .card {
          width: min(920px, 92vw);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.34);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.48);
          backdrop-filter: blur(18px);
          padding: 20px;
        }

        .cardHead h2 {
          margin: 2px 0 6px;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .cardHead span {
          display: block;
          font-size: 13px;
          color: rgba(229, 231, 235, 0.70);
          margin-bottom: 14px;
        }

        .form .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        /* ↓↓↓ AJUSTE PRINCIPAL: input legível sempre */
        input {
          height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(15, 23, 42, 0.46);
          color: rgba(255, 255, 255, 0.92);
          caret-color: rgba(255, 255, 255, 0.92);
          padding: 0 14px;
          outline: none;
        }
        input::placeholder {
          color: rgba(229, 231, 235, 0.55);
        }
        input:focus {
          border-color: rgba(147, 197, 253, 0.60);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18);
        }

        /* Chrome autofill fix */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: rgba(255, 255, 255, 0.92);
          box-shadow: 0 0 0px 1000px rgba(15, 23, 42, 0.46) inset;
          transition: background-color 9999s ease-in-out 0s;
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 14px;
          align-items: center;
        }

        .btnPrimary {
          height: 42px;
          min-width: 140px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid rgba(59, 130, 246, 0.42);
          background: rgba(59, 130, 246, 0.42);
          color: rgba(255, 255, 255, 0.95);
          font-weight: 700;
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
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(10, 16, 28, 0.12);
          color: rgba(229, 231, 235, 0.92);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .btnGhost:hover {
          border-color: rgba(255, 255, 255, 0.22);
        }

        .btnGhostSmall {
          height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(10, 16, 28, 0.12);
          color: rgba(229, 231, 235, 0.92);
          cursor: pointer;
          font-weight: 700;
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

        .pixBox {
          display: grid;
          gap: 14px;
        }
        .pixHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .muted {
          margin-top: 4px;
          font-size: 13px;
          color: rgba(229, 231, 235, 0.70);
        }

        .pixGrid {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 14px;
          align-items: stretch;
        }

        .qr {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.34);
          display: grid;
          place-items: center;
          padding: 14px;
        }
        .qrImg {
          width: 100%;
          height: auto;
          border-radius: 10px;
          background: #fff;
          padding: 8px;
        }
        .qrPlaceholder {
          font-size: 13px;
          color: rgba(229, 231, 235, 0.70);
        }

        .copia {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.34);
          padding: 14px;
          display: grid;
          gap: 10px;
        }
        .label {
          font-size: 13px;
          color: rgba(229, 231, 235, 0.78);
          font-weight: 800;
        }
        textarea {
          width: 100%;
          min-height: 92px;
          resize: none;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.22);
          color: rgba(229, 231, 235, 0.92);
          padding: 10px 12px;
          outline: none;
          font-size: 12px;
          line-height: 1.35;
        }

        @media (max-width: 820px) {
          .form .row {
            grid-template-columns: 1fr;
          }
          .pixGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
