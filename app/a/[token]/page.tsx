import { notFound, redirect } from "next/navigation";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getPurchase(token: string) {
  const url =
    `${SUPABASE_URL}/rest/v1/purchases` +
    `?token=eq.${encodeURIComponent(token)}` +
    `&select=status` +
    `&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: "no-store",
  });

  if (!r.ok) return null;

  const rows = await r.json().catch(() => []);
  return rows?.[0] || null;
}

export default async function AccessPage({
  params,
}: {
  params: { token: string };
}) {
  const token = String(params?.token || "").trim();
  if (!token) notFound();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE env vars");
  }

  const purchase = await getPurchase(token);
  if (!purchase) notFound();

  if (purchase.status !== "paid") {
    redirect(`/comprar`);
  }

  return (
    <iframe
      src={`/api/ebook?token=${encodeURIComponent(token)}`}
      style={{ border: "none", width: "100vw", height: "100vh" }}
    />
  );
}
