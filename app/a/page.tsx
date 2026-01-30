import fs from "fs";
import path from "path";
import { redirect, notFound } from "next/navigation";
import { readSession } from "../lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getLatestPaidToken(customerId: number) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  const url =
    `${SUPABASE_URL}/rest/v1/purchases` +
    `?customer_id=eq.${encodeURIComponent(String(customerId))}` +
    `&status=eq.paid` +
    `&select=token,created_at` +
    `&order=created_at.desc` +
    `&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: "no-store",
  });

  if (!r.ok) return null;

  const rows = await r.json().catch(() => []);
  return rows?.[0]?.token || null;
}

export default async function AccessPage() {
  const session = readSession();
  if (!session) redirect("/login");

  const token = await getLatestPaidToken(session.customer_id);
  if (!token) redirect("/comprar");

  // serve o HTML do ebook (sem expor token)
  const filePath = path.join(process.cwd(), "content", "ebook.html");
  if (!fs.existsSync(filePath)) notFound();

  const html = fs.readFileSync(filePath, "utf-8");

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Conteúdo</title>
      </head>
      <body style={{ margin: 0 }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </body>
    </html>
  );
}
