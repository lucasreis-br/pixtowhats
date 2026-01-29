import { NextResponse } from "next/server";
import { normalizePhone, setSession, verifyPassword } from "@/app/lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body?.phone);
  const password = String(body?.password || "");

  if (!phone || phone.length < 12) return json({ error: "phone_invalid" }, 400);
  if (!password || password.length < 6) return json({ error: "password_invalid" }, 400);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "server_misconfigured" }, 500);

  const url =
    `${SUPABASE_URL}/rest/v1/customers` +
    `?phone=eq.${encodeURIComponent(phone)}` +
    `&select=id,phone,password_hash` +
    `&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: "no-store",
  });

  if (!r.ok) return json({ error: "supabase_error" }, 500);

  const rows = await r.json().catch(() => []);
  const c = rows?.[0];
  if (!c) return json({ error: "invalid_login" }, 401);

  const ok = verifyPassword(password, c.password_hash);
  if (!ok) return json({ error: "invalid_login" }, 401);

  setSession({ customer_id: Number(c.id), phone: String(c.phone) });
  return json({ ok: true });
}
