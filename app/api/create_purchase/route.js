import { NextResponse } from "next/server";
import crypto from "crypto";
import { hashPassword, normalizePhone, verifyPassword } from "../../lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

const BASE_URL = process.env.PUBLIC_BASE_URL || process.env.SITE_URL;
const PRICE = Number(process.env.PRODUCT_PRICE_BRL || 97);

function json(data, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function originFromUrl(u) {
  try {
    const url = new URL(u);
    return url.origin;
  } catch {
    return "";
  }
}

async function supabaseGetCustomerByPhone(phone) {
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

  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return rows?.[0] || null;
}

async function supabaseCreateCustomer(phone, password_hash) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ phone, password_hash }]),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`supabase_create_customer_failed: ${t}`);
  }

  const rows = await r.json().catch(() => []);
  return rows?.[0] || null;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const phone = normalizePhone(body?.phone);
    const password = String(body?.password || "");

    if (!phone) return json({ error: "phone_required" }, 400);
    if (phone.length < 12) return json({ error: "phone_invalid" }, 400);
    if (!password || password.length < 6) return json({ error: "password_invalid" }, 400);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "server_misconfigured_supabase" }, 500);
    }
    if (!MP_TOKEN) {
      return json({ error: "server_misconfigured_mp" }, 500);
    }
    if (!BASE_URL) {
      return json({ error: "server_misconfigured_base_url" }, 500);
    }

    let customer = await supabaseGetCustomerByPhone(phone);

    if (!customer) {
      const password_hash = hashPassword(password);
      customer = await supabaseCreateCustomer(phone, password_hash);
      if (!customer?.id) return json({ error: "customer_create_failed" }, 500);
    } else {
      const ok = verifyPassword(password, customer.password_hash);
      if (!ok) return json({ error: "invalid_login" }, 401);
    }

    const token = crypto.randomUUID();

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        token,
        phone,
        status: "pending",
        customer_id: customer.id,
      }),
    });

    if (!insertRes.ok) {
      const t = await insertRes.text();
      return json({ error: "supabase_insert_failed", details: t }, 500);
    }

    const siteOrigin = originFromUrl(BASE_URL) || BASE_URL;
    const notification_url = `${siteOrigin}/api/mp_webhook`;

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": token,
      },
      body: JSON.stringify({
        transaction_amount: PRICE,
        description: "Acesso ao conteúdo",
        payment_method_id: "pix",
        payer: { email: "comprador@seusite.com" },
        notification_url,
        metadata: { token, phone },
      }),
    });

    const mpData = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok) return json({ error: "mp_create_failed", mp: mpData }, 500);

    const mp_payment_id = String(mpData?.id || "");

    if (mp_payment_id) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/purchases?token=eq.${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ mp_payment_id }),
        }
      ).catch(() => {});
    }

    const qr_code = mpData?.point_of_interaction?.transaction_data?.qr_code || "";
    const qr_code_base64 =
      mpData?.point_of_interaction?.transaction_data?.qr_code_base64 || "";

    return json({
      token,
      mp_payment_id,
      access_link: `${siteOrigin}/a/${token}`,
      pix: { qr_code, qr_code_base64, qr_base64: qr_code_base64 },
    });
  } catch (err) {
    return json({ error: "server_error" }, 500);
  }
}
