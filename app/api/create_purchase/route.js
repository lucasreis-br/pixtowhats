import { NextResponse } from "next/server";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

// Use um URL “base” sem /app?t=DEV. Ideal: PUBLIC_BASE_URL=https://pix-whatsapp-access-dscc.vercel.app
const BASE_URL = process.env.PUBLIC_BASE_URL || process.env.SITE_URL;
const PRICE = Number(process.env.PRODUCT_PRICE_BRL || 97);

function json(data, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeBRPhone(raw) {
  // retorna no formato 55DDDNUMERO (sem +)
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.startsWith("55")) return d;
  return "55" + d;
}

function originFromUrl(u) {
  try {
    const url = new URL(u);
    return url.origin;
  } catch {
    return "";
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizeBRPhone(body?.phone);

    if (!phone) return json({ error: "phone_required" }, 400);
    if (phone.length < 12) return json({ error: "phone_invalid" }, 400);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase env vars");
      return json({ error: "server_misconfigured_supabase" }, 500);
    }
    if (!MP_TOKEN) {
      console.error("Missing Mercado Pago access token");
      return json({ error: "server_misconfigured_mp" }, 500);
    }
    if (!BASE_URL) {
      console.error("Missing PUBLIC_BASE_URL/SITE_URL env var");
      return json({ error: "server_misconfigured_base_url" }, 500);
    }

    const token = crypto.randomUUID();

    // 1) salvar compra pending no Supabase
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
      }),
    });

    if (!insertRes.ok) {
      const t = await insertRes.text();
      console.error("SUPABASE INSERT ERROR:", t);
      return json({ error: "supabase_insert_failed" }, 500);
    }

    // Link que o cliente vai receber (sem Meta): ele mesmo abre o WhatsApp clicando
    const siteOrigin = originFromUrl(BASE_URL) || BASE_URL;
    const accessLink = `${siteOrigin}/a/${token}`;

    const waText =
      `✅ Pagamento aprovado!\n\n` +
      `Acesse seu conteúdo:\n${accessLink}\n\n` +
      `Token: ${token}`;

    const whatsapp_link = `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`;

    // 2) criar pagamento Pix no Mercado Pago
    const notificationOrigin = siteOrigin; // precisa ser público, sem query
    const notification_url = `${notificationOrigin}/api/mp_webhook`;

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
    if (!mpRes.ok) {
      console.error("MP CREATE PAYMENT ERROR:", mpData);
      return json({ error: "mp_create_failed", mp: mpData }, 500);
    }

    const qr_code = mpData?.point_of_interaction?.transaction_data?.qr_code || "";
    const qr_code_base64 =
      mpData?.point_of_interaction?.transaction_data?.qr_code_base64 || "";

    return json({
      token,
      mp_payment_id: String(mpData?.id || ""),
      whatsapp_link,
      access_link: accessLink,
      pix: {
        qr_code,
        qr_code_base64,
        // compat com seu front antigo:
        qr_base64: qr_code_base64,
      },
    });
  } catch (err) {
    console.error("CREATE PURCHASE ERROR:", err);
    return json({ error: "server_error" }, 500);
  }
}
