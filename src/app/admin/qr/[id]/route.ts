import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { qrSvg } from "@/lib/qr";
import { siteUrl } from "@/lib/site";

// Download des QR Codes einer Verkaufsstelle: ?format=png (2000 px, für den Druck) oder ?format=svg (Vektor).
export async function GET(req: Request, { params }: RouteContext<"/admin/qr/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const { data: l } = await db().from("locations").select("slug").eq("id", id).maybeSingle();
  if (!l) return new Response("Nicht gefunden", { status: 404 });
  const svg = qrSvg(`${await siteUrl()}/kasse/${l.slug}`);
  const format = new URL(req.url).searchParams.get("format");
  const name = `qr-hofkasse-${l.slug}`;
  if (format === "svg") {
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="${name}.svg"`, "Cache-Control": "no-store" } });
  }
  const png = await sharp(Buffer.from(svg), { density: 600 }).resize(2000, 2000).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}.png"`, "Cache-Control": "no-store" } });
}
