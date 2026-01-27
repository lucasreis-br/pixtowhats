import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WA_TOKEN =
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const BASE_URL = process.env.PUBLIC_BASE_URL || process.env.SITE_URL;

const INTERNAL_SECRET = process.env.WA_INTERNAL_SECRET; // opcional

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function onlyDigits(v: any) {
  return String(v || "").replace(/\D/g, "");
}

// GET só pra testar no navegador
export async function GET() {
  return json({
    ok: true,
    route: "/api/send_whatsapp",
    methods: ["GET", "POST"],
    hasToken: Boolean(WA_TOKEN),
    hasPhoneNumberId: Boolean(WA_PHONE_NUMBER_ID),
    baseUrl: BASE_URL || null,
  });
}

export async function POST(req: Request) {
  try {
    if (INTERNAL_SECRET) {
      const secret = req.headers.get("x-internal-secret");
      if (secret !== INTERNAL_SECRET) return json({ error: "Unauthorized" }, 401);
    }

    if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
      return json({ error: "Missing WhatsApp env vars" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const to = onlyDigits(body?.to);
    const token = String(body?.token || "").trim();

    if (!to || to.length < 12) return json({ error: "Invalid 'to'" }, 400);
    if (!token) return json({ error: "Missing 'token'" }, 400);

    const link = BASE_URL ? `${BASE_URL}/a/${token}` : `/a/${token}`;

    const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: link },
                  { type: "text", text: token },
                ],
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: {
            preview_url: true,
            body: `✅ Pagamento aprovado!\n\nAcesse seu conteúdo:\n${link}\n\nToken: ${token}`,
          },
        };

    const r = await fetch(
      `https://graph.facebook.com/v22.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return json(
        { error: "WhatsApp send failed", status: r.status, details: data },
        500
      );
    }

    return json({ ok: true, wa: data });
  } catch (e: any) {
    return json({ error: e?.message || "Unexpected error" }, 500);
  }
}
