"use client";

import { useState } from "react";

export default function ComprarPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Resposta esperada do /api/create_purchase:
  // ajuste os nomes se o seu endpoint retornar diferente.
  const [pix, setPix] = useState<{
    qr_base64?: string;   // imagem do QR (base64)
    qr_code?: string;     // copia e cola (texto)
    payment_id?: string;
    token?: string;
  } | null>(null);

  function normalizeBR(raw: string) {
    // deixa só números e garante formato 55DDDNUMERO
    const digits = (raw || "").replace(/\D/g, "");
    if (digits.startsWith("55")) return digits;
    return "55" + digits;
  }

  async function gerarPix() {
    setErr(null);
    setPix(null);

    const normalized = normalizeBR(phone);

    // validação simples: Brasil geralmente fica 12 ou 13 dígitos após "55"
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

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setErr(data?.error || "Erro ao gerar Pix.");
        return;
      }

      // Tenta mapear alguns nomes comuns:
      setPix({
        qr_base64: data?.qr_base64 || data?.qrCodeBase64 || data?.qr_code_base64,
        qr_code: data?.qr_code || data?.qrCode || data?.copiaecola || data?.pix_copy_paste,
        payment_id: data?.payment_id || data?.mp_payment_id || data?.id,
        token: data?.token,
      });
    } catch (e: any) {
      setErr(e?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function copiar() {
    if (!pix?.qr_code) return;
    await navigator.clipboard.writeText(pix.qr_code);
    alert("Copiado.");
  }

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Pagamento via Pix</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Digite seu WhatsApp para receber automaticamente o link e o token após o pagamento.
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

      {pix && (
        <section style={{ marginTop: 28, padding: 18, border: "1px solid #ddd", borderRadius: 14 }}>
          <h2 style={{ marginTop: 0 }}>Pague com Pix</h2>

          {pix.qr_base64 && (
            <div style={{ marginTop: 12 }}>
              <img
                src={pix.qr_base64.startsWith("data:") ? pix.qr_base64 : `data:image/png;base64,${pix.qr_base64}`}
                alt="QR Code Pix"
                style={{ width: 280, height: 280, objectFit: "contain", borderRadius: 12, border: "1px solid #eee" }}
              />
            </div>
          )}

          {pix.qr_code && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 6 }}>Copia e cola</div>
              <textarea
                readOnly
                value={pix.qr_code}
                style={{ width: "100%", minHeight: 110, padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
              />
              <button
                onClick={copiar}
                style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, border: 0, cursor: "pointer" }}
              >
                Copiar código Pix
              </button>
            </div>
          )}

          <p style={{ marginTop: 14, opacity: 0.85 }}>
            Depois que o pagamento for aprovado, você vai receber a mensagem no WhatsApp com o link de acesso.
          </p>
        </section>
      )}
    </main>
  );
}
