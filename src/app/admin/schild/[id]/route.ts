import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";
import { schildPdf } from "@/lib/schild";

export const dynamic = "force-dynamic";

type L = { slug: string; name: string; typ: string; bar_aktiv: boolean; paypal_aktiv: boolean; location_products: { products: { alkohol_vol: number | null; active: boolean } | null }[] };

/** A4-Verkaufsschild als PDF. ?download=1 lädt herunter, sonst Ansicht im Browser. */
export async function GET(req: Request, ctx: RouteContext<"/admin/schild/[id]">) {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const { data: l } = await db().from("locations")
    .select("slug, name, typ, bar_aktiv, paypal_aktiv, location_products(products(alkohol_vol, active))")
    .eq("id", id).maybeSingle<L>();
  if (!l) return new Response("Nicht gefunden", { status: 404 });
  const pdf = await schildPdf({
    name: l.name, typ: l.typ, url: `${await siteUrl()}/kasse/${l.slug}`,
    bar: l.bar_aktiv, paypal: l.paypal_aktiv,
    alkohol: l.location_products.some((x) => x.products?.active && x.products.alkohol_vol != null),
  });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Verkaufsschild-${l.slug}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
