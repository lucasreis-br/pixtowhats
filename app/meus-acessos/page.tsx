"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAccesses, saveAll, type SavedAccess } from "@/app/lib/accessStore";

export default function MeusAcessosPage() {
  const [items, setItems] = useState<SavedAccess[]>([]);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setItems(loadAccesses());
  }, []);

  const hasItems = items.length > 0;

  const sorted = useMemo(() => {
    return [...items].sort((a, b) =>
      (b.lastSeenAt || b.createdAt).localeCompare(a.lastSeenAt || a.createdAt)
    );
  }, [items]);

  function openToken(token: string) {
    const now = new Date().toISOString();
    const next = items.map((x) => (x.token === token ? { ...x, lastSeenAt: now } : x));
    setItems(next);
    saveAll(next);
    window.location.href = `/a/${token}`;
  }

  function removeToken(token: string) {
    const next = items.filter((x) => x.token !== token);
    setItems(next);
    saveAll(next);
  }

  function clearAll() {
    localStorage.removeItem("pixwa_accesses_v1");
    setItems([]);
  }

  return (
    <main className="wrap">
      <div className="bg" />

      <header className="top">
        <div className="titleRow">
          <div>
            <div className="title">Meus acessos</div>
            <div className="sub">Seus links ficam salvos neste dispositivo/navegador.</div>
          </div>

          <a className="btn" href="/comprar">
            Comprar
          </a>
        </div>
      </header>

      <section className="card">
        {!hasItems ? (
          <div className="empty">
            <div className="h2">Nenhum acesso salvo ainda</div>
            <div className="sub">Dica: sempre que você abrir o conteúdo (/a/&lt;token&gt;), ele é salvo automaticamente aqui.</div>
          </div>
        ) : (
          <>
            <div className="rowTop">
              <div className="h2">Acessos salvos</div>
              <button className="btn danger" onClick={clearAll}>
                Limpar tudo
              </button>
            </div>

            <div className="list">
              {sorted.map((x) => {
                const link = origin ? `${origin}/a/${x.token}` : `/a/${x.token}`;
                return (
                  <div key={x.token} className="item">
                    <div className="left">
                      <div className="token">{x.token}</div>
                      <div className="meta">
                        Criado: {new Date(x.createdAt).toLocaleString()}{" "}
                        {x.lastSeenAt ? `• Último acesso: ${new Date(x.lastSeenAt).toLocaleString()}` : ""}
                      </div>
                      <div className="link">{link}</div>
                    </div>

                    <div className="actions">
                      <button className="btn primary" onClick={() => openToken(x.token)}>
                        Abrir
                      </button>
                      <button className="btn" onClick={() => navigator.clipboard.writeText(link)}>
                        Copiar link
                      </button>
                      <button className="btn danger" onClick={() => removeToken(x.token)}>
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

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
        .titleRow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .title { font-weight: 800; font-size: 22px; letter-spacing: 0.2px; }
        .sub { color: #a1a1aa; font-size: 14px; line-height: 1.5; margin-top: 6px; }
        .card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.72);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          padding: 18px 16px;
          margin-bottom: 18px;
        }
        .h2 { font-weight: 700; font-size: 18px; }
        .empty { padding: 18px 4px; }
        .rowTop { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .list { display: grid; gap: 10px; }
        .item {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
        }
        .token {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 13px;
          color: #e5e7eb;
          word-break: break-all;
        }
        .meta { margin-top: 6px; color: #a1a1aa; font-size: 12px; }
        .link { margin-top: 8px; color: #93c5fd; font-size: 12px; word-break: break-all; }
        .actions { display: flex; flex-direction: column; gap: 8px; min-width: 160px; justify-content: center; }
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
        .primary { background: rgba(147, 197, 253, 0.16); border-color: rgba(147, 197, 253, 0.22); }
        .danger { border-color: rgba(248, 113, 113, 0.25); background: rgba(248, 113, 113, 0.12); }
        @media (max-width: 900px) {
          .item { grid-template-columns: 1fr; }
          .actions { flex-direction: row; flex-wrap: wrap; min-width: 0; }
        }
      `}</style>
    </main>
  );
}
