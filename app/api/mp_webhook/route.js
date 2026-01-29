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

async function supabaseMarkPaid(token, paymentId) {
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
        mp_payment_id: String(paymentId || ""),
        // mantém seu campo existente (pode ser usado como "momento em que confirmou")
        delivered_at: new Date().toISOString(),
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SUPABASE PATCH ERROR: ${t}`);
  }
}

export async function POST(req) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MP_TOKEN) {
      return json({ ok: true });
    }

    const body = await req.json().catch(() => ({}));
    const paymentId = body?.data?.id || body?.id;

    if (!paymentId) {
      return json({ ok: true });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });

    const mpData = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok) {
      console.error("MP FETCH PAYMENT ERROR:", mpData);
      return json({ ok: true });
    }

    const status = mpData?.status;
    const token = mpData?.metadata?.token;

    if (status === "approved" && token) {
      await supabaseMarkPaid(token, mpData.id);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("MP WEBHOOK ERROR:", err);
    return json({ ok: true });
  }
}
