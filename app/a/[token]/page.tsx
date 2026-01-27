import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function loadHtml() {
  const filePath = path.join(process.cwd(), "public", "ebook.html");
  return fs.readFileSync(filePath, "utf-8");
}

export default async function AccessPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;

  const { data } = await supabase
    .from("purchases")
    .select("status")
    .eq("token", token)
    .maybeSingle();

  if (!data || data.status !== "paid") notFound();

  const html = loadHtml();

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ minHeight: "100vh" }}
    />
  );
}
