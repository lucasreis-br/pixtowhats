import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("MP WEBHOOK RECEIVED:", body);

    // Sempre responder 200 rápido para o Mercado Pago
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("MP WEBHOOK ERROR:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
