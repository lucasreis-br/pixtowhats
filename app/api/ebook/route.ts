import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function onlyToken(v: string) {
  return String(v || "").trim();
}

async function isPaid(token: string) {
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

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const token = onlyToken(searchParams.get("token") || "");
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

    const ok = await isPaid(token);
    if (!ok) return NextResponse.json({ error: "not_paid" }, { status: 403 });

    const filePath = path.join(process.cwd(), "app", "content", "ebook.html");
    const html = await readFile(filePath, "utf-8");

    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "ebook_render_failed", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
