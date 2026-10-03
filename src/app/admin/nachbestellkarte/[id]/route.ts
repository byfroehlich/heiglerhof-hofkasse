import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";
import { nachbestellKartePdf } from "@/lib/schild";
import { kontakt, kontaktText } from "@/lib/kontakt";

export const dynamic = "force-dynamic";

/** A4-Nachbestellkarte eines Wiederverkäufers als PDF. ?download=1 lädt herunter. */
export async function GET(req: Request, ctx: RouteContext<"/admin/nachbestellkarte/[id]">) {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const { data: l } = await db().from("locations").select("slug, name, nachbestell_token").eq("id", id).eq("wiederverkaeufer", true).maybeSingle();
  if (!l?.nachbestell_token) return new Response("Erst den Nachbestell-Link erzeugen.", { status: 404 });
  const pdf = await nachbestellKartePdf({ name: l.name, url: `${await siteUrl()}/nachbestellen/${l.nachbestell_token}`, kontakt: kontaktText(await kontakt()) });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Nachbestellkarte-${l.slug}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
