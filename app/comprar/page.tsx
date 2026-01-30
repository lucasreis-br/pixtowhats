"use client";

import { useEffect, useMemo, useState } from "react";

type PixState = {
  token: string;
  mp_payment_id: string;
  pix?: { qr_code?: string; qr_code_base64?: string };
};

function onlyDigits(v: any) {
  return String(v || "").replace(/\D/g, "");
}
function normalizeBR(raw: string) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  return digits.startsWith("55") ? digits : "55" + digits;
}

export default function ComprarPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [pix, setPix] = useState<PixState | null>(null);
  const [paid, setPaid] = useState(false);

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const accessLink = useMemo(() => (pix?.token && origin ? `${origin}/login` : ""), [pix?.token, origin]);

  async function gerarPix() {
    setErr(null);
    setPaid(false);
    setPix(null);

    const normalized = normalizeBR(phone);
    if (!normalized || normalized.length < 12) return setErr("Digite seu WhatsApp com DDD. Ex: 31 99999-9999");
    if (!password || password.length < 6) return setErr("A senha deve ter no mínimo 6 caracteres.");

    setLoading(true);
    try {
      const r = await fetch("/api/create_purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, password }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(data?.error || "Erro ao gerar Pix.");

      setPix({ token: data.token, mp_payment_id: data.mp_payment_id, pix: data.pix });
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
    if (!pix?.token || paid) return;

    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const r = await fetch(`/api/check_purchase?token=${encodeURIComponent(pix.token)}`, { cache: "no-store" });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data?.status === "paid") {
          setPaid(true);
          window.location.href = "/login";
        }
      } catch {}
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pix?.token, paid]);

  return (
    <main className="page">
      <div className="bgWrap" aria-hidden="true">
        {/* FUNDO (imagem mockup) — aqui a gente desfoca/escurece pra não aparecer a UI fake */}
        <div className="bgImage" />
        <div className="bgOverlay" />
        <div className="bgVignette" />
      </div>

      <header className="top">
        <div className="titleBlock">
          <h1>Pagamento via Pix</h1>
          <p>Digite seu WhatsApp e crie uma senha. Após o pagamento, você acessa o conteúdo com esses dados.</p>
        </div>
        <a className="pillLink" href="/login">Entrar</a>
      </header>

      <section className="card">
        {!pix ? (
          <>
            <h2>Seus dados</h2>
            <p className="muted">Use WhatsApp com DDD. Ex: 31 99999-9999</p>

            <div className="fields">
              <input
                className="input"
                placeholder="Digite seu WhatsApp"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
              <input
                className="input"
                placeholder="Crie uma senha (mín. 6)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="actions">
              <button className="btn primary" onClick={gerarPix} disabled={loading}>
                {loading ? "Gerando Pix..." : "Confirmar"}
              </button>
              <a className="btn" href="/login">Já tenho conta</a>
            </div>

            {err && <div className="err">{err}</div>}
          </>
        ) : (
          <>
            <h2>Pague com Pix</h2>
            <p className="muted">Escaneie o QR Code ou copie o código abaixo.</p>

            {pix.pix?.qr_code_base64 && (
              <img
                className="qr"
                alt="QR Code Pix"
                src={
                  pix.pix.qr_code_base64.startsWith("data:")
                    ? pix.pix.qr_code_base64
                    : `data:image/png;base64,${pix.pix.qr_code_base64}`
                }
              />
            )}

            {pix.pix?.qr_code && (
              <>
                <textarea readOnly className="textarea" value={pix.pix.qr_code} />
                <div className="actions">
                  <button className="btn" onClick={copiarPix}>Copiar código Pix</button>
                  <a className="btn" href="/login">Ir para login</a>
                </div>
              </>
            )}

            <div className="status">
              {paid ? "Pagamento aprovado. Redirecionando…" : "Aguardando pagamento…"}
            </div>

            {!!accessLink && <div className="hint">Após pagar, você será enviado para: <span>{accessLink}</span></div>}
          </>
        )}
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 44px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
        }

        /* FUNDO */
        .bgWrap {
          position: fixed;
          inset: 0;
          z-index: -1;
        }

        .bgImage {
          position: absolute;
          inset: -40px; /* sobra pra blur não cortar borda */
          background: url("/assets/bg-comprar.webp") center/cover no-repeat;
          filter: blur(18px) saturate(1.05);
          transform: scale(1.05);
        }

        /* escurece e remove “UI fake” */
        .bgOverlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(7,11,18,.86), rgba(11,18,32,.93)),
            radial-gradient(900px 600px at 30% 20%, rgba(147,197,253,.12), transparent 60%),
            radial-gradient(900px 600px at 70% 25%, rgba(56,189,248,.10), transparent 60%);
        }

        .bgVignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 45%, rgba(0,0,0,.55) 100%);
          pointer-events: none;
        }

        .top {
          width: 100%;
          max-width: 980px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 26px;
        }

        .titleBlock h1 {
          margin: 0;
          font-size: 30px;
          color: #e5e7eb;
          letter-spacing: -0.02em;
        }
        .titleBlock p {
          margin: 8px 0 0;
          color: #a1a1aa;
          max-width: 640px;
          line-height: 1.4;
        }

        .pillLink {
          text-decoration: none;
          color: #bfdbfe;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.06);
          padding: 8px 12px;
          border-radius: 999px;
          backdrop-filter: blur(10px);
        }

        .card {
          width: 100%;
          max-width: 620px;
          border-radius: 18px;
          padding: 22px;
          background: rgba(15,23,42,.74);
          border: 1px solid rgba(255,255,255,.12);
          backdrop-filter: blur(14px);
          box-shadow: 0 24px 60px rgba(0,0,0,.55);
        }

        h2 {
          margin: 0 0 8px;
          color: #e5e7eb;
        }

        .muted {
          margin: 0 0 14px;
          color: #a1a1aa;
        }

        .fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 640px) {
          .fields { grid-template-columns: 1fr; }
          .top { align-items: center; }
        }

        .input {
          width: 100%;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.06);
          color: #e5e7eb;
          outline: none;
        }
        .input:focus {
          border-color: rgba(147,197,253,.35);
          box-shadow: 0 0 0 3px rgba(147,197,253,.12);
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        .btn {
          border-radius: 12px;
          padding: 10px 14px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.06);
          color: #e5e7eb;
          cursor: pointer;
          text-decoration: none;
        }

        .btn.primary {
          background: rgba(147,197,253,.18);
          border-color: rgba(147,197,253,.30);
        }

        .err {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(220,38,38,.16);
          border: 1px solid rgba(220,38,38,.25);
          color: #fecaca;
        }

        .qr {
          width: 260px;
          margin: 14px auto 10px;
          display: block;
          background: #fff;
          padding: 10px;
          border-radius: 12px;
        }

        .textarea {
          width: 100%;
          min-height: 120px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.06);
          color: #e5e7eb;
          resize: none;
        }

        .status {
          margin-top: 12px;
          color: #93c5fd;
        }

        .hint {
          margin-top: 10px;
          color: #a1a1aa;
          font-size: 12px;
        }
        .hint span {
          color: #bfdbfe;
        }
      `}</style>
    </main>
  );
}
