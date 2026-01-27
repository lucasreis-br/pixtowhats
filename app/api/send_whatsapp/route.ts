import { NextResponse } from "next/server";

const WA_TOKEN =
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Preferimos PUBLIC_BASE_URL. SITE_URL é fallback.
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

export async function GET() {
  return json({
    ok: true,
    route: "/api/send_whatsapp",
    methods: ["GET", "POST"],
    hasToken: Boolean(WA_TOKEN),
    hasPhoneNumberId: Boolean(WA_PHONE_NUMBER_ID),
    baseUrl: BASE_URL || null,
    hasTemplateName: Boolean(process.env.WHATSAPP_TEMPLATE_NAME),
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || null,
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || null,
  });
}

export async function POST(req: Request) {
  try {
    // Protege se você configurar WA_INTERNAL_SECRET
    if (INTERNAL_SECRET) {
      const secret = req.headers.get("x-internal-secret");
      if (secret !== INTERNAL_SECRET) return json({ error: "Unauthorized" }, 401);
    }

    if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
      return json(
        { error: "Missing WhatsApp env vars (token/phone_number_id)" },
        500
      );
    }

    const body = await req.json().catch(() => ({}));
    const to = onlyDigits(body?.to);
    const token = String(body?.token || "").trim();

    if (!to || to.length < 12) return json({ error: "Invalid 'to'" }, 400);
    if (!token) return json({ error: "Missing 'token'" }, 400);

    const link = BASE_URL ? `${BASE_URL}/a/${token}` : `/a/${token}`;

    // ✅ Se não tiver janela de 24h, precisa TEMPLATE.
    // Para teste, use hello_world (geralmente é en_US).
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLang },
            // Muitos templates (incluindo hello_world) NÃO precisam de components.
            // Se você criar um template com variáveis, aí sim adiciona components.
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

    const resp = await fetch(
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

    const raw = await resp.text(); // <- pega tudo, mesmo quando não é JSON

    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!resp.ok) {
      // Agora você vai ver o erro real no console e na resposta do endpoint
      return json(
        {
          error: "WhatsApp send failed",
          status: resp.status,
          wa_raw: raw || null,
          wa_json: parsed,
          usedTemplate: Boolean(templateName),
          templateName: templateName || null,
          templateLang,
          to,
        },
        500
      );
    }

    return json({
      ok: true,
      wa_raw: raw || null,
      wa_json: parsed,
      usedTemplate: Boolean(templateName),
      templateName: templateName || null,
      templateLang,
      to,
    });
  } catch (e: any) {
    return json({ error: e?.message || "Unexpected error" }, 500);
  }
}
