import { NextResponse } from "next/server";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const SITE_URL = process.env.SITE_URL;
const PRICE = Number(process.env.PRODUCT_PRICE_BRL || 97);

function json(data, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const { phone } = await req.json();
    if (!phone) return json({ error: "phone_required" }, 400);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase env vars");
      return json({ error: "server_misconfigured_supabase" }, 500);
    }
    if (!MP_TOKEN) {
      console.error("Missing Mercado Pago access token");
      return json({ error: "server_misconfigured_mp" }, 500);
    }
    if (!SITE_URL) {
      console.error("Missing SITE_URL env var");
      return json({ error: "server_misconfigured_site_url" }, 500);
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

    // 2) criar pagamento Pix no Mercado Pago
    // Mercado Pago exige X-Idempotency-Key para evitar duplicidade
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
        // Email “neutro” e consistente (evita algumas rejeições em contas novas)
        payer: { email: "comprador@seusite.com" },
        notification_url: `${SITE_URL}/api/mp_webhook`,
        metadata: { token, phone },
      }),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP CREATE PAYMENT ERROR:", mpData);
      return json({ error: "mp_create_failed", mp: mpData }, 500);
    }

    return json({
      token,
      mp_payment_id: String(mpData.id),
      pix: {
        qr_code: mpData?.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64:
          mpData?.point_of_interaction?.transaction_data?.qr_code_base64,
      },
    });
  } catch (err) {
    console.error("CREATE PURCHASE ERROR:", err);
    return json({ error: "server_error" }, 500);
  }
}
