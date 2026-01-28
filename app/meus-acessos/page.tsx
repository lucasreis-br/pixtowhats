"use client";

import { useEffect, useState } from "react";

type Saved = { token: string; link: string; paid_at: string };

export default function MeusAcessosPage() {
  const [items, setItems] = useState<Saved[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("purchases_list");
      const list = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    }
  }, []);

  async function copiar(link: string) {
    await navigator.clipboard.writeText(link);
    alert("Link copiado.");
  }

  async function compartilhar(link: string) {
    // se o celular suportar Share, abre o menu de compartilhar (WhatsApp/manual)
    // se não suportar, cai no copiar
    // @ts-ignore
    if (navigator.share) {
      try {
        // @ts-ignore
        await navigator.share({ title: "Meu acesso", text: "Meu link de acesso", url: link });
        return;
      } catch {}
    }
    await copiar(link);
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>Meus acessos</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Se você já pagou neste aparelho, seus links ficam salvos aqui.
      </p>

      {items.length === 0 ? (
        <div style={{ padding: 16, border: "1px solid rgba(0,0,0,.15)", borderRadius: 12 }}>
          Nenhum acesso salvo neste aparelho ainda.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((it) => (
            <div
              key={it.token}
              style={{ padding: 14, border: "1px solid rgba(0,0,0,.15)", borderRadius: 12 }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Pago em: {new Date(it.paid_at).toLocaleString()}
              </div>
              <div style={{ marginTop: 8, wordBreak: "break-all" }}>{it.link}</div>

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <a href={it.link} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,.2)", textDecoration: "none" }}>
                  Abrir
                </a>
                <button
                  onClick={() => copiar(it.link)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,.2)", cursor: "pointer" }}
                >
                  Copiar
                </button>
                <button
                  onClick={() => compartilhar(it.link)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,.2)", cursor: "pointer" }}
                >
                  Compartilhar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
