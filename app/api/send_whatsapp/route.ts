import { NextResponse } from "next/server";

const WA_TOKEN =
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN; // aceita os 2 nomes
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// preferimos PUBLIC_BASE_URL (que você já usa no webhook). SITE_URL fica como fallback.
const BASE_URL = process.env.PUBLIC_BASE_URL || process.env.SITE_URL;

const INTERNAL_SECRET = process.env.WA_INTERNAL_SECRET; // opcional (recomendado)

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function onlyDigits(v: any) {
  return String(v || "").replace(/\D/g, "");
}

// Garante URL sem barra final (evita //a/...)
function normalizeBaseUrl(url: string | undefined | null) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

export async function POST(req: Request) {
  try {
    // Protege o endpoint se você configurar WA_INTERNAL_SECRET na Vercel
    if (INTERNAL_SECRET) {
      const secret = req.headers.get("x-internal-secret");
      if (secret !== INTERNAL_SECRET) return json({ error: "Unauthorized" }, 401);
    }

    if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) {
      return json(
        {
          error: "Missing WhatsApp env vars",
          missing: {
            WHATSAPP_TOKEN: !process.env.WHATSAPP_TOKEN && !process.env.WHATSAPP_ACCESS_TOKEN,
            WHATSAPP_PHONE_NUMBER_ID: !WA_PHONE_NUMBER_ID,
          },
        },
        500
      );
    }

    const body = await req.json().catch(() => ({}));
    const to = onlyDigits(body?.to);
    const token = String(body?.token || "").trim();

    if (!to || to.length < 12) return json({ error: "Invalid 'to'" }, 400);
    if (!token) return json({ error: "Missing 'token'" }, 400);

    const base = normalizeBaseUrl(BASE_URL);
    const link = base ? `${base}/a/${token}` : `/a/${token}`;

    // Se você tiver template aprovado, use:
    // WHATSAPP_TEMPLATE_NAME=nome_do_template
    const templateName = String(process.env.WHATSAPP_TEMPLATE_NAME || "").trim();

    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "pt_BR" },
            // Se o seu template NÃO tiver variáveis, remova "components"
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
      // deixa o erro bem explícito nos logs da Vercel
      return json(
        {
          error: "WhatsApp send failed",
          status: r.status,
          details: data,
          debug: {
            usedTemplate: Boolean(templateName),
            to,
            hasBaseUrl: Boolean(base),
          },
        },
        500
      );
    }

    return json({ ok: true, wa: data, debug: { usedTemplate: Boolean(templateName), to } });
  } catch (e: any) {
    return json({ error: e?.message || "Unexpected error" }, 500);
  }
}
