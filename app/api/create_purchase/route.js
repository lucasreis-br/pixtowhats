import { NextResponse } from "next/server";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
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

    const token = crypto.randomUUID();

    // 1) salvar compra pending no Supabase
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/purchases`,
      {
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
      }
    );

    if (!insertRes.ok) {
      const t = await insertRes.text();
      console.error("SUPABASE INSERT ERROR:", t);
      return json({ error: "supabase_insert_failed" }, 500);
    }

    // 2) criar pagamento Pix no Mercado Pago
    const mpRes = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_amount: PRICE,
          description: "Acesso ao conteúdo",
          payment_method_id: "pix",
          payer: { email: `buyer+${token}@example.com` },
          notification_url: `${process.env.SITE_URL}/api/mp_webhook`,
          metadata: { token },
        }),
      }
    );

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP CREATE PAYMENT ERROR:", mpData);
      return json({ error: "mp_create_failed" }, 500);
    }

    return json({
      token,
      pix: {
        qr_code: mpData.point_of_interaction.transaction_data.qr_code,
        qr_code_base64:
          mpData.point_of_interaction.transaction_data.qr_code_base64,
      },
    });
  } catch (err) {
    console.error("CREATE PURCHASE ERROR:", err);
    return json({ error: "server_error" }, 500);
  }
}
