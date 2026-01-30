// app/comprar/page.tsx
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

function digitsOnly(v: string) {
  return (v || "").replace(/\D+/g, "");
}

/**
 * Aceita input com/sem +55 e normaliza para:
 * - localBR: DDD + número (11 dígitos, com 9)
 * - e164: 55 + localBR
 */
function normalizeBRWhatsapp(raw: string): { ok: boolean; localBR: string; e164: string } {
  let p = digitsOnly(raw);

  // remove 55 se vier junto
  if (p.startsWith("55") && (p.length === 12 || p.length === 13)) {
    p = p.slice(2);
  }

  // 10 dígitos = DDD + 8 (fixo) -> adiciona 9
  if (p.length === 10) {
    const ddd = p.slice(0, 2);
    const rest = p.slice(2);
    const localBR = `${ddd}9${rest}`;
    return { ok: true, localBR, e164: `55${localBR}` };
  }

  // 11 dígitos = DDD + 9 dígitos
  if (p.length === 11) {
    const localBR = p;
    return { ok: true, localBR, e164: `55${localBR}` };
  }

  return { ok: false, localBR: "", e164: "" };
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
    return n.ok && password.length >= 6 && !loading;
  }, [phone, password, loading]);

  async function onCreatePurchase(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPaid(false);

    const n = normalizeBRWhatsapp(phone);
    if (!n.ok) return setError("Digite seu WhatsApp com DDD (Ex: 31 99999-9999).");
    if (password.length < 6) return setError("Crie uma senha com no mínimo 6 caracteres.");

    setLoading(true);
    try {
      const r = await fetch("/api/create_purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // ✅ ENVIA NO FORMATO QUE O BACKEND ESPERA (E.164 SEM +): 55 + DDD + número
        body: JSON.stringify({ phone: n.e164, password }),
      });

      const data = (await r.json().catch(() => ({}))) as CreatePurchaseResponse;

      if (!r.ok || data?.error) {
        setError(data?.error || "server_error");
        setLoading(false);
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

      const isPaid =
        data?.paid === true || String(data?.status || "").toLowerCase() === "paid";

      if (isPaid) {
        setPaid(true);
        router.push("/login");
        return;
      }

      setError(null);
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
          Digite seu WhatsApp e crie uma senha. Depois do pagamento, você entra com
          esses dados para acessar o conteúdo.
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

              {error ? <div className="error">{error}</div> : null}
            </form>
          ) : (
            <div className="pixBox">
              <div className="pixHeader">
                <div>
                  <strong>Pix gerado</strong>
                  <div className="muted">
                    Pague e você será enviado para o login automaticamente.
                  </div>
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
                    <button
                      type="button"
                      className="btnGhost"
                      onClick={checkNow}
                      disabled={checking}
                    >
                      {checking ? "Verificando..." : "Já paguei"}
                    </button>
                  </div>
                  {error ? <div className="error">{error}</div> : null}
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

        .btnGhostSmall {
          height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.1);
          color: rgba(229, 231, 235, 0.92);
          cursor: pointer;
          font-weight: 600;
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
          color: rgba(229, 231, 235, 0.62);
        }

        .pixGrid {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 14px;
          align-items: stretch;
        }

        .qr {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.3);
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
          color: rgba(229, 231, 235, 0.62);
        }

        .copia {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.3);
          padding: 14px;
          display: grid;
          gap: 10px;
        }
        .label {
          font-size: 13px;
          color: rgba(229, 231, 235, 0.7);
          font-weight: 600;
        }
        textarea {
          width: 100%;
          min-height: 92px;
          resize: none;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 16, 28, 0.25);
          color: rgba(229, 231, 235, 0.9);
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
