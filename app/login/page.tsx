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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizeBR(phone),
          password,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(data?.error === "invalid_login" ? "Telefone ou senha inválidos." : "Erro ao entrar.");
        return;
      }

      router.replace("/meus-acessos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16, color: "#e5e7eb" }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Entrar</h1>
      <p style={{ opacity: 0.8, marginTop: 10 }}>
        Entre com o mesmo WhatsApp e senha usados na compra.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <label>
          WhatsApp (com DDD)
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="31 99999-9999"
            style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 12 }}
          />
        </label>

        <label>
          Senha
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="mínimo 6"
            style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 12 }}
          />
        </label>

        {err && (
          <div style={{ padding: 12, borderRadius: 12, background: "rgba(220,38,38,.12)" }}>
            {err}
          </div>
        )}

        <button disabled={loading} style={{ padding: 12, borderRadius: 12 }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/comprar")}
          style={{ padding: 12, borderRadius: 12, opacity: 0.9 }}
        >
          Voltar para compra
        </button>
      </form>
    </main>
  );
}
