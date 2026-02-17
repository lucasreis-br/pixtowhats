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
  let d = digits(input);
  if (d.startsWith("55")) d = d.slice(2);

  if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2);
  if (d.length !== 11) return null;

  return {
    localBR: d,
    e164: "55" + d,
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

  return e.replaceAll("_", " ");
}

function formatPriceBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function ComprarPage() {
  const router = useRouter();

  // ====== Você pode ajustar somente aqui ======
  const PRODUCT_TITLE = "Reduza o consumo de pornografia a quase zero";
  const OLD_PRICE = 79.99;
  const NEW_PRICE = 24.99;
  const CTA_TEXT = "Quero pagar no Pix";

  // “Tempo limitado” (contador local). Ex: 2 horas.
  const OFFER_DURATION_MS = 2 * 60 * 60 * 1000;

  // ====== Estado existente ======
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);

  // UI helpers
  const [showCheckout, setShowCheckout] = useState(false);
  const [deadlineAt] = useState<number>(() => Date.now() + OFFER_DURATION_MS);
  const [now, setNow] = useState<number>(() => Date.now());

  const bgUrl = "/assets/bg-comprar-clean.webp";
  const mockUrl = "/assets/ebook-mockup.webp";

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

      // ao gerar Pix, vai direto pro checkout
      setShowCheckout(true);
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

  // Timer local do “tempo limitado”
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remaining = useMemo(() => deadlineAt - now, [deadlineAt, now]);
  const timerText = msToClock(remaining);

  const discountPct = useMemo(() => {
    const pct = Math.round((1 - NEW_PRICE / OLD_PRICE) * 100);
    return Math.max(0, Math.min(99, pct));
  }, []);

  return (
    <main className="page">
      <div className="bg" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <div className="topBar">
        <div className="brand">
          <div className="dot" />
          <span>Conteúdo Premium</span>
        </div>

        <div className="topLinks">
          <Link className="pill" href="/login">
            Entrar
          </Link>
          <Link className="pill ghost" href="/comprar#checkout">
            Comprar
          </Link>
        </div>
      </div>

      <section className="heroWrap">
        <div className="heroGrid">
          {/* Coluna esquerda */}
          <div className="heroLeft">
            <div className="badgeRow">
              <span className="badge">Acesso imediato</span>
              <span className="badge subtle">Pagamento via Pix</span>
              <span className="badge subtle">Login por WhatsApp</span>
            </div>

            <h1 className="title">{PRODUCT_TITLE}</h1>

            <p className="subtitle">
              Um método direto e prático para reduzir o consumo com consistência — sem depender de força de vontade o tempo
              todo.
            </p>

            <div className="bullets">
              <div className="bullet">
                <span className="bIcon">✓</span>
                <div>
                  <strong>Plano simples</strong>
                  <p>Passo a passo com ações fáceis de aplicar no dia a dia.</p>
                </div>
              </div>
              <div className="bullet">
                <span className="bIcon">✓</span>
                <div>
                  <strong>Gatilhos e recaídas</strong>
                  <p>Entenda o padrão e como diminuir a frequência rapidamente.</p>
                </div>
              </div>
              <div className="bullet">
                <span className="bIcon">✓</span>
                <div>
                  <strong>Privado e discreto</strong>
                  <p>Você acessa com WhatsApp + senha. Sem exposição.</p>
                </div>
              </div>
            </div>

            <div className="ctaRow">
              <a className="btnPrimary" href="#checkout" onClick={() => setShowCheckout(true)}>
                {CTA_TEXT}
              </a>
              <Link className="btnGhost" href="/login">
                Já comprei
              </Link>
            </div>

            <div className="trustRow">
              <div className="trustItem">
                <span className="tTitle">Garantia</span>
                <span className="tSub">Compra segura</span>
              </div>
              <div className="trustItem">
                <span className="tTitle">Entrega</span>
                <span className="tSub">Acesso imediato</span>
              </div>
              <div className="trustItem">
                <span className="tTitle">Suporte</span>
                <span className="tSub">Via WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Coluna direita (card de preço + mockup) */}
          <div className="heroRight" id="checkout">
            <div className="pricingCard">
              <div className="pricingTop">
                <div className="limited">
                  <span className="pillMini">Tempo limitado</span>
                  <span className="timer">{timerText}</span>
                </div>
                <span className="save">-{discountPct}%</span>
              </div>

              <div className="mockWrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="mock" src={mockUrl} alt="Mockup do ebook" />
              </div>

              <div className="prices">
                <div className="old">{formatPriceBRL(OLD_PRICE)}</div>
                <div className="new">
                  {formatPriceBRL(NEW_PRICE)} <span className="tag">Pix</span>
                </div>
                <div className="micro">De {formatPriceBRL(OLD_PRICE)} por apenas {formatPriceBRL(NEW_PRICE)}.</div>
              </div>

              <button className="btnPrimary full" onClick={() => setShowCheckout(true)}>
                Comprar agora
              </button>

              <div className="smallNote">
                Após pagar, você é enviado para o login automaticamente. Use seu WhatsApp + senha.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Checkout (form + pix) */}
      {showCheckout ? (
        <section className="checkoutWrap">
          <div className="checkoutCard">
            <div className="checkoutHead">
              <div>
                <h2>Finalizar no Pix</h2>
                <p>Digite seu WhatsApp e crie uma senha para acessar depois do pagamento.</p>
              </div>
              <button className="x" onClick={() => setShowCheckout(false)} aria-label="Fechar">
                ✕
              </button>
            </div>

            {!token ? (
              <form onSubmit={onCreatePurchase} className="form">
                <div className="row">
                  <div className="field">
                    <label>WhatsApp</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 31 99999-9999"
                      inputMode="numeric"
                      autoComplete="tel"
                    />
                  </div>

                  <div className="field">
                    <label>Senha</label>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Crie uma senha (min. 6)"
                      type="password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="actions">
                  <button className="btnPrimary" disabled={!canSubmit}>
                    {loading ? "Gerando Pix..." : "Gerar Pix"}
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
                      <img src={`data:image/png;base64,${qrBase64}`} alt="QR Code Pix" className="qrImg" />
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
      ) : null}

      {/* FAQ + Prova social clean */}
      <section className="below">
        <div className="belowGrid">
          <div className="panel">
            <h3>O que você recebe</h3>
            <ul>
              <li>Conteúdo em módulos (acesso imediato após pagamento)</li>
              <li>Estratégias práticas para reduzir frequência e evitar gatilhos</li>
              <li>Plano claro para manter consistência</li>
            </ul>
          </div>

          <div className="panel">
            <h3>Perguntas rápidas</h3>
            <div className="qa">
              <div className="q">Como recebo o acesso?</div>
              <div className="a">Você cria WhatsApp + senha. Após pagar, entra pelo login.</div>
            </div>
            <div className="qa">
              <div className="q">Demora para liberar?</div>
              <div className="a">Normalmente libera em poucos segundos após o Pix compensar.</div>
            </div>
            <div className="qa">
              <div className="q">É discreto?</div>
              <div className="a">Sim. O acesso é privado, via login.</div>
            </div>
          </div>

          <div className="panel">
            <h3>Depoimentos</h3>
            <div className="quotes">
              <div className="quote">
                <div className="stars">★★★★★</div>
                <p>“O plano é simples e dá pra aplicar sem complicar a rotina.”</p>
              </div>
              <div className="quote">
                <div className="stars">★★★★★</div>
                <p>“O que mais ajudou foi entender os gatilhos e cortar o ciclo rápido.”</p>
              </div>
            </div>
            <div className="microMuted">*Exemplos de feedback. Você pode trocar por depoimentos reais depois.</div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Conteúdo Premium</span>
        <span className="sep">•</span>
        <Link href="/login">Entrar</Link>
        <span className="sep">•</span>
        <a href="/comprar#checkout" onClick={() => setShowCheckout(true)}>
          Comprar
        </a>
      </footer>

      <style jsx>{`
        .page {
          position: relative;
          min-height: 100vh;
          overflow-x: hidden;
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

        .vignette {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(60% 55% at 30% 20%,
              rgba(7, 11, 18, 0.02) 0%,
              rgba(7, 11, 18, 0.44) 55%,
              rgba(7, 11, 18, 0.78) 100%),
            linear-gradient(180deg,
              rgba(7, 11, 18, 0.20),
              rgba(7, 11, 18, 0.62));
          pointer-events: none;
        }

        .topBar {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          max-width: 1120px;
          margin: 0 auto;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: rgba(229, 231, 235, 0.88);
          font-weight: 800;
          letter-spacing: -0.01em;
          font-size: 13px;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.70);
          box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.12);
        }

        .topLinks {
          display: inline-flex;
          gap: 10px;
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
          font-weight: 700;
        }
        .pill:hover {
          border-color: rgba(255, 255, 255, 0.22);
        }
        .pill.ghost {
          background: rgba(10, 16, 28, 0.16);
        }

        .heroWrap {
          position: relative;
          z-index: 2;
          padding: 10px 16px 18px;
          max-width: 1120px;
          margin: 0 auto;
        }

        .heroGrid {
          display: grid;
          grid-template-columns: 1.35fr 0.9fr;
          gap: 18px;
          align-items: start;
        }

        .heroLeft {
          padding: 10px 6px;
        }

        .badgeRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.30);
          color: rgba(229, 231, 235, 0.92);
          font-size: 12px;
          font-weight: 800;
        }
        .badge.subtle {
          color: rgba(229, 231, 235, 0.78);
          background: rgba(10, 16, 28, 0.18);
        }

        .title {
          margin: 8px 0 10px;
          font-size: clamp(34px, 4.1vw, 54px);
          letter-spacing: -0.03em;
          font-weight: 900;
          color: rgba(229, 231, 235, 0.94);
          text-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
          line-height: 1.05;
        }

        .subtitle {
          margin: 0 0 18px;
          max-width: 64ch;
          font-size: 14px;
          line-height: 1.5;
          color: rgba(229, 231, 235, 0.74);
          text-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
        }

        .bullets {
          display: grid;
          gap: 10px;
          margin-bottom: 16px;
          max-width: 720px;
        }

        .bullet {
          display: grid;
          grid-template-columns: 22px 1fr;
          gap: 10px;
          padding: 12px 12px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(10, 16, 28, 0.26);
          backdrop-filter: blur(10px);
        }

        .bIcon {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(59, 130, 246, 0.18);
          border: 1px solid rgba(59, 130, 246, 0.22);
          color: rgba(229, 231, 235, 0.92);
          font-weight: 900;
        }

        .bullet strong {
          display: block;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: -0.01em;
          margin-bottom: 4px;
        }

        .bullet p {
          margin: 0;
          font-size: 13px;
          color: rgba(229, 231, 235, 0.72);
          line-height: 1.35;
        }

        .ctaRow {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 14px 0 14px;
          align-items: center;
        }

        .btnPrimary {
          height: 44px;
          padding: 0 16px;
          border-radius: 14px;
          border: 1px solid rgba(59, 130, 246, 0.45);
          background: rgba(59, 130, 246, 0.42);
          color: rgba(255, 255, 255, 0.95);
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btnPrimary:hover {
          border-color: rgba(59, 130, 246, 0.62);
          background: rgba(59, 130, 246, 0.48);
        }
        .btnPrimary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .btnPrimary.full {
          width: 100%;
        }

        .btnGhost {
          height: 44px;
          padding: 0 16px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(10, 16, 28, 0.12);
          color: rgba(229, 231, 235, 0.92);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
        }
        .btnGhost:hover {
          border-color: rgba(255, 255, 255, 0.22);
        }

        .trustRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .trustItem {
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(10, 16, 28, 0.20);
          min-width: 160px;
        }
        .tTitle {
          display: block;
          font-weight: 900;
          font-size: 12px;
          color: rgba(229, 231, 235, 0.90);
        }
        .tSub {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          color: rgba(229, 231, 235, 0.70);
        }

        .heroRight {
          position: sticky;
          top: 14px;
        }

        .pricingCard {
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.34);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.48);
          backdrop-filter: blur(18px);
          padding: 16px;
        }

        .pricingTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .limited {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pillMini {
          display: inline-flex;
          height: 26px;
          align-items: center;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.20);
          font-size: 12px;
          font-weight: 900;
          color: rgba(229, 231, 235, 0.88);
        }
        .timer {
          font-variant-numeric: tabular-nums;
          font-size: 12px;
          font-weight: 900;
          color: rgba(229, 231, 235, 0.85);
        }
        .save {
          height: 26px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(59, 130, 246, 0.25);
          background: rgba(59, 130, 246, 0.14);
          color: rgba(229, 231, 235, 0.92);
          font-size: 12px;
          font-weight: 900;
        }

        .mockWrap {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(15, 23, 42, 0.24);
          padding: 12px;
          display: grid;
          place-items: center;
          margin-bottom: 12px;
        }

        .mock {
          width: 100%;
          height: auto;
          max-height: 280px;
          object-fit: contain;
          filter: drop-shadow(0 22px 40px rgba(0, 0, 0, 0.55));
        }

        .prices {
          margin: 10px 0 14px;
        }
        .old {
          font-size: 13px;
          color: rgba(229, 231, 235, 0.55);
          text-decoration: line-through;
          font-weight: 800;
        }
        .new {
          margin-top: 4px;
          font-size: 26px;
          font-weight: 1000;
          letter-spacing: -0.02em;
          color: rgba(229, 231, 235, 0.96);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tag {
          font-size: 12px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.18);
          color: rgba(229, 231, 235, 0.80);
        }
        .micro {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(229, 231, 235, 0.70);
          line-height: 1.35;
        }
        .smallNote {
          margin-top: 10px;
          font-size: 12px;
          color: rgba(229, 231, 235, 0.65);
          line-height: 1.35;
        }

        /* Checkout overlay (clean, não “modal” agressivo) */
        .checkoutWrap {
          position: relative;
          z-index: 3;
          padding: 16px 16px 26px;
          max-width: 1120px;
          margin: 0 auto;
        }

        .checkoutCard {
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.42);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(18px);
          padding: 18px;
        }

        .checkoutHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .checkoutHead h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 1000;
          letter-spacing: -0.02em;
        }

        .checkoutHead p {
          margin: 6px 0 0;
          color: rgba(229, 231, 235, 0.70);
          font-size: 13px;
          line-height: 1.35;
        }

        .x {
          height: 36px;
          width: 36px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.14);
          color: rgba(229, 231, 235, 0.92);
          cursor: pointer;
          font-weight: 900;
        }
        .x:hover {
          border-color: rgba(255, 255, 255, 0.22);
        }

        .form .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .field label {
          display: block;
          font-size: 12px;
          font-weight: 900;
          color: rgba(229, 231, 235, 0.78);
          margin-bottom: 6px;
        }

        input {
          height: 46px;
          width: 100%;
          border-radius: 14px;
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
          flex-wrap: wrap;
        }

        .btnGhostSmall {
          height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(10, 16, 28, 0.12);
          color: rgba(229, 231, 235, 0.92);
          cursor: pointer;
          font-weight: 900;
        }

        .error {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 14px;
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
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.34);
          display: grid;
          place-items: center;
          padding: 14px;
        }
        .qrImg {
          width: 100%;
          height: auto;
          border-radius: 12px;
          background: #fff;
          padding: 8px;
        }
        .qrPlaceholder {
          font-size: 13px;
          color: rgba(229, 231, 235, 0.70);
        }

        .copia {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.34);
          padding: 14px;
          display: grid;
          gap: 10px;
        }
        .label {
          font-size: 13px;
          color: rgba(229, 231, 235, 0.78);
          font-weight: 1000;
        }
        textarea {
          width: 100%;
          min-height: 92px;
          resize: none;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 16, 28, 0.22);
          color: rgba(229, 231, 235, 0.92);
          padding: 10px 12px;
          outline: none;
          font-size: 12px;
          line-height: 1.35;
        }

        /* Seção abaixo (FAQ/Prova social) */
        .below {
          position: relative;
          z-index: 2;
          max-width: 1120px;
          margin: 0 auto;
          padding: 10px 16px 40px;
        }
        .belowGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .panel {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(10, 16, 28, 0.22);
          backdrop-filter: blur(14px);
          padding: 14px;
        }
        .panel h3 {
          margin: 0 0 10px;
          font-size: 14px;
          font-weight: 1000;
          letter-spacing: -0.01em;
        }
        .panel ul {
          margin: 0;
          padding-left: 18px;
          color: rgba(229, 231, 235, 0.72);
          font-size: 13px;
          line-height: 1.45;
        }

        .qa {
          margin-bottom: 10px;
        }
        .q {
          font-size: 13px;
          font-weight: 1000;
          color: rgba(229, 231, 235, 0.88);
          margin-bottom: 3px;
        }
        .a {
          font-size: 13px;
          color: rgba(229, 231, 235, 0.72);
          line-height: 1.35;
        }

        .quotes {
          display: grid;
          gap: 10px;
        }
        .quote {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(15, 23, 42, 0.18);
          padding: 12px;
        }
        .stars {
          font-size: 12px;
          letter-spacing: 0.08em;
          color: rgba(229, 231, 235, 0.88);
          margin-bottom: 6px;
        }
        .quote p {
          margin: 0;
          font-size: 13px;
          color: rgba(229, 231, 235, 0.72);
          line-height: 1.35;
        }
        .microMuted {
          margin-top: 10px;
          font-size: 12px;
          color: rgba(229, 231, 235, 0.55);
          line-height: 1.35;
        }

        .footer {
          position: relative;
          z-index: 2;
          max-width: 1120px;
          margin: 0 auto;
          padding: 14px 16px 30px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          color: rgba(229, 231, 235, 0.68);
          font-size: 12px;
        }
        .footer a {
          color: rgba(229, 231, 235, 0.82);
          text-decoration: none;
          font-weight: 900;
        }
        .footer a:hover {
          text-decoration: underline;
        }
        .sep {
          opacity: 0.45;
        }

        @media (max-width: 980px) {
          .heroGrid {
            grid-template-columns: 1fr;
          }
          .heroRight {
            position: relative;
            top: 0;
          }
          .belowGrid {
            grid-template-columns: 1fr;
          }
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
