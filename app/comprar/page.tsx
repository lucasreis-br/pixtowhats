"use client";

import { useState } from "react";

type PixResp = {
  token?: string;
  mp_payment_id?: string;
  access_link?: string;
  whatsapp_link?: string;
  pix?: {
    qr_code?: string;
    qr_code_base64?: string;
    qr_base64?: string; // compat
  };
};

export default function ComprarPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [data, setData] = useState<PixResp | null>(null);

  function normalizeBR(raw: string) {
    const digits = (raw || "").replace(/\D/g, "");
    if (digits.startsWith("55")) return digits;
    return "55" + digits;
  }

  async function gerarPix() {
    setErr(null);
    setData(null);

    const normalized = normalizeBR(phone);

    if (normalized.length < 12) {
      setErr("Digite seu WhatsApp com DDD. Ex: 31 99999-9999");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/create_purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });

      const j = (await r.json().catch(() => ({}))) as PixResp;

      if (!r.ok) {
        setErr((j as any)?.error || "Erro ao gerar Pix.");
        return;
      }

      setData(j);
    } catch (e: any) {
      setErr(e?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function copiarPix() {
    const code = data?.pix?.qr_code;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    alert("Copiado.");
  }

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Pagamento via Pix</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Sem Meta/Facebook: depois de pagar, clique no botão “Receber no WhatsApp” para abrir a mensagem já pronta.
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <label style={{ fontSize: 14, opacity: 0.85 }}>Seu WhatsApp (com DDD)</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ex: 31 99999-9999"
          style={{ padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid #ccc" }}
        />
        <button
          onClick={gerarPix}
          disabled={loading}
          style={{
            padding: "12px 16px",
            fontSize: 16,
            borderRadius: 10,
            border: 0,
            cursor: "pointer",
          }}
        >
          {loading ? "Gerando..." : "Gerar Pix"}
        </button>

        {err && <p style={{ color: "crimson" }}>{err}</p>}
      </div>

      {data && (
        <section style={{ marginTop: 28, padding: 18, border: "1px solid #ddd", borderRadius: 14 }}>
          <h2 style={{ marginTop: 0 }}>Pague com Pix</h2>

          {(data.pix?.qr_code_base64 || data.pix?.qr_base64) && (
            <div style={{ marginTop: 12 }}>
              <img
                src={`data:image/png;base64,${data.pix?.qr_code_base64 || data.pix?.qr_base64}`}
                alt="QR Code Pix"
                style={{ width: 280, height: 280, objectFit: "contain", borderRadius: 12, border: "1px solid #eee" }}
              />
            </div>
          )}

          {data.pix?.qr_code && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 6 }}>Copia e cola</div>
              <textarea
                readOnly
                value={data.pix.qr_code}
                style={{ width: "100%", minHeight: 110, padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
              />
              <button
                onClick={copiarPix}
                style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, border: 0, cursor: "pointer" }}
              >
                Copiar código Pix
              </button>
            </div>
          )}

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {data.whatsapp_link && (
              <a
                href={data.whatsapp_link}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  textAlign: "center",
                  padding: "12px 16px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid #ccc",
                }}
              >
                Receber no WhatsApp (abrir mensagem pronta)
              </a>
            )}

            {data.access_link && (
              <div style={{ fontSize: 14, opacity: 0.85 }}>
                Link de acesso (para conferência):<br />
                <a href={data.access_link} target="_blank" rel="noreferrer">
                  {data.access_link}
                </a>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
