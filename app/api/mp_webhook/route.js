import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

function json(data, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sendWhatsAppMessage(to, message) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !token) {
    throw new Error("WHATSAPP ENV MISSING: WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_TOKEN");
  }

  const res = await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WHATSAPP SEND ERROR: ${t}`);
  }
}

async function supabaseUpdateByToken(token, paymentId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?token=eq.${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "paid",
        mp_payment_id: String(paymentId),
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SUPABASE PATCH ERROR: ${t}`);
  }
}

async function supabaseGetPurchaseByToken(token) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?token=eq.${encodeURIComponent(
      token
    )}&select=phone,delivered_at,status`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SUPABASE SELECT ERROR: ${t}`);
  }

  const rows = await res.json();
  return rows?.[0] || null;
}

async function supabaseMarkDelivered(token) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?token=eq.${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        delivered_at: new Date().toISOString(),
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SUPABASE DELIVERED PATCH ERROR: ${t}`);
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Mercado Pago costuma mandar: { action, data: { id } } (ou variações)
    const paymentId = body?.data?.id || body?.id;
    if (!paymentId) {
      console.log("MP WEBHOOK RECEIVED (no payment id):", body);
      return json({ ok: true });
    }

    // Buscar pagamento real no Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP FETCH PAYMENT ERROR:", mpData);
      return json({ ok: true }); // responde 200 para MP não ficar re-tentando infinito
    }

    const status = mpData?.status; // "approved" quando pago
    const token = mpData?.metadata?.token;

    console.log("MP PAYMENT FETCHED:", {
      id: mpData?.id,
      status,
      hasToken: Boolean(token),
    });

    // Só libera quando realmente aprovado
    if (status === "approved" && token) {
      // 1) marca como paid no Supabase
      await supabaseUpdateByToken(token, mpData.id);
      console.log("PURCHASE MARKED PAID:", { token, paymentId: mpData.id });

      // 2) pega phone + delivered_at para enviar WhatsApp (sem duplicar)
      const purchase = await supabaseGetPurchaseByToken(token);

      if (purchase && purchase.status === "paid" && !purchase.delivered_at && purchase.phone) {
        const baseUrl = process.env.PUBLIC_BASE_URL;
        if (!baseUrl) throw new Error("ENV MISSING: PUBLIC_BASE_URL");

        const link = `${baseUrl}/a/${token}`;
        const msg =
          `✅ Pagamento aprovado!\n\n` +
          `Acesse seu conteúdo aqui:\n${link}\n\n` +
          `Token: ${token}`;

        await sendWhatsAppMessage(purchase.phone, msg);
        await supabaseMarkDelivered(token);

        console.log("WHATSAPP SENT + DELIVERED MARKED:", { phone: purchase.phone });
      } else {
        console.log("WHATSAPP SKIPPED:", {
          hasPurchase: Boolean(purchase),
          delivered_at: purchase?.delivered_at || null,
          hasPhone: Boolean(purchase?.phone),
        });
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error("MP WEBHOOK ERROR:", err);
    return json({ ok: false }, 500);
  }
}
