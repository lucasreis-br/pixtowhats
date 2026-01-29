import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "server_misconfigured" }, 500);
    }

    const { searchParams } = new URL(req.url);
    const token = String(searchParams.get("token") || "").trim();
    if (!token) return json({ error: "missing_token" }, 400);

    const url =
      `${SUPABASE_URL}/rest/v1/purchases` +
      `?token=eq.${encodeURIComponent(token)}` +
      `&select=status,delivered_at,mp_payment_id` +
      `&limit=1`;

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    });

    if (!r.ok) {
      const t = await r.text();
      return json({ error: "supabase_error", details: t }, 500);
    }

    const rows = await r.json().catch(() => []);
    const row = rows?.[0];

    if (!row) return json({ status: "not_found" }, 200);

    return json({
      status: row.status || "unknown",
      delivered_at: row.delivered_at || null,
      mp_payment_id: row.mp_payment_id || null,
    });
  } catch (e: any) {
    return json({ error: e?.message || "server_error" }, 500);
  }
}
