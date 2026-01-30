import { redirect } from "next/navigation";
import { readSession } from "../lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function MeusAcessosPage() {
  const session = readSession();
  if (!session) redirect("/login");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) redirect("/login");

  const url =
    `${SUPABASE_URL}/rest/v1/purchases` +
    `?customer_id=eq.${encodeURIComponent(String(session.customer_id))}` +
    `&status=eq.paid` +
    `&select=id` +
    `&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: "no-store",
  });

  if (!r.ok) redirect("/comprar");

  const rows = await r.json().catch(() => []);
  const hasPaid = Boolean(rows?.[0]?.id);

  if (!hasPaid) redirect("/comprar");

  // ✅ não expõe token na URL
  redirect("/a");
}
