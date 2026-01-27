import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function htmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function isPaidToken(token: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?token=eq.${encodeURIComponent(token)}&select=status&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return rows?.[0]?.status === "paid";
}

function injectBaseHref(html: string) {
  // Isso evita quebrar assets relativos quando o HTML é servido de /api/content
  // (sem isso, "assets/..." viraria "/api/assets/...")
  if (/<base\s/i.test(html)) return html;
  return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n<base href="/" />`);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = (searchParams.get("token") || "").trim();

    if (!token) return htmlResponse("Not found", 404);

    const ok = await isPaidToken(token);
    if (!ok) return htmlResponse("Pagamento não confirmado.", 402);

    const filePath = path.join(process.cwd(), "content", "ebook.html");
    let html = await readFile(filePath, "utf8");

    html = injectBaseHref(html);

    return htmlResponse(html, 200);
  } catch (e) {
    return htmlResponse("Server error", 500);
  }
}
