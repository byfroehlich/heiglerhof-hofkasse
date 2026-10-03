import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { lieferscheinPdf } from "@/lib/lieferschein";
import { kontakt, kontaktText } from "@/lib/kontakt";
import { nbNr } from "@/lib/nachbestellung";

export const dynamic = "force-dynamic";

type N = {
  nr: number; created_at: string; notiz: string | null;
  locations: { name: string; strasse: string | null; plz: string | null; ort: string | null };
  positionen: { name_snapshot: string; menge: number; haendler_cents: number | null }[];
};

/** Lieferschein einer Nachbestellung als PDF. ?download=1 lädt herunter. */
export async function GET(req: Request, ctx: RouteContext<"/admin/lieferschein/[id]">) {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const { data: n } = await db().from("nachbestellungen")
    .select("nr, created_at, notiz, locations!inner(name, strasse, plz, ort), positionen:nachbestell_positionen(name_snapshot, menge, haendler_cents)")
    .eq("id", id).maybeSingle<N>();
  if (!n) return new Response("Nicht gefunden", { status: 404 });
  const l = n.locations;
  const pdf = await lieferscheinPdf({
    nr: nbNr(n.nr),
    datum: new Date(n.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }),
    empfaenger: [l.name, l.strasse, [l.plz, l.ort].filter(Boolean).join(" ")].filter((z): z is string => Boolean(z)),
    positionen: n.positionen.sort((a, b) => a.name_snapshot.localeCompare(b.name_snapshot, "de")).map((p) => ({ name: p.name_snapshot, menge: p.menge, preis: p.haendler_cents })),
    notiz: n.notiz,
    kontakt: kontaktText(await kontakt()),
  });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Lieferschein-${nbNr(n.nr)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
