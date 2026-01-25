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

export async function POST(req) {
  try {
    const body = await req.json();

    // Mercado Pago costuma mandar: { action, data: { id } }
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
      return json({ ok: true }); // responde 200 para não ficar re-tentando infinito
    }

    const status = mpData?.status;
    const token = mpData?.metadata?.token;

    console.log("MP PAYMENT FETCHED:", {
      id: mpData?.id,
      status,
      token,
    });

    // Só libera quando realmente aprovado
    if (status === "approved" && token) {
      await supabaseUpdateByToken(token, mpData.id);
      console.log("PURCHASE MARKED PAID:", { token, paymentId: mpData.id });
    }

    return json({ ok: true });
  } catch (err) {
    console.error("MP WEBHOOK ERROR:", err);
    return json({ ok: false }, 500);
  }
}
