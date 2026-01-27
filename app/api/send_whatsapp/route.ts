import { NextResponse } from "next/server";

const WA_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const SITE_URL = process.env.SITE_URL; // ex: https://seusite.com

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  try {
    if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) {
      return json({ error: "Missing WhatsApp env vars" }, 500);
    }

    const body = await req.json();
    const to = String(body?.to || "").replace(/\D/g, ""); // 55DDDNUMERO
    const token = String(body?.token || "");

    if (!to || to.length < 12) return json({ error: "Invalid 'to'" }, 400);
    if (!token) return json({ error: "Missing 'token'" }, 400);

    const link = SITE_URL ? `${SITE_URL}/a/${token}` : `/a/${token}`;

    // IMPORTANTE:
    // envio proativo geralmente exige TEMPLATE.
    // Para teste, muitos apps têm o template "hello_world" disponível.
    // Se você não tiver template, pode tentar text, mas pode não entregar.
    const payload =
      process.env.WHATSAPP_TEMPLATE_NAME
        ? {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: process.env.WHATSAPP_TEMPLATE_NAME,
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
              body: `Pagamento aprovado.\n\nLink de acesso: ${link}\nToken: ${token}`,
            },
          };

    const r = await fetch(
      `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return json({ error: "WhatsApp send failed", details: data }, 500);
    }

    return json({ ok: true, wa: data });
  } catch (e: any) {
    return json({ error: e?.message || "Unexpected error" }, 500);
  }
}
