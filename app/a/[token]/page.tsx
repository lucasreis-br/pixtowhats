import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function isTokenPaid(token: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;

  const url =
    `${SUPABASE_URL}/rest/v1/purchases` +
    `?token=eq.${encodeURIComponent(token)}` +
    `&select=status` +
    `&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: "no-store",
  });

  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  return rows?.[0]?.status === "paid";
}

export default async function AccessPage({ params }: { params: { token: string } }) {
  const token = String(params?.token || "").trim();
  if (!token) notFound();

  const ok = await isTokenPaid(token);
  if (!ok) notFound();

  const filePath = path.join(process.cwd(), "content", "ebook.html");
  const html = fs.readFileSync(filePath, "utf-8");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Access</title>
      </head>

      <body style={{ margin: 0 }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </body>
    </html>
  );
}
