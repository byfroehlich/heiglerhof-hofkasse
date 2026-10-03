import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Kleiner Fingerabdruck des aktuellen Stands (letzte Bestellung, Summe aller Bestände).
 * Die Admin-App fragt ihn regelmäßig ab und lädt die Seite nur neu, wenn er sich geändert hat.
 */
export async function GET() {
  await requireAdmin();
  const [o, lp, nb] = await Promise.all([
    db().from("orders").select("id, status, stock_booked").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db().from("location_products").select("ist, soll"),
    db().from("nachbestellungen").select("nr, status").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const rows = lp.data ?? [];
  const summe = rows.reduce((s, r) => s + r.ist * 1000 + r.soll, 0);
  const v = `${o.data?.id ?? "-"}:${o.data?.status ?? "-"}:${o.data?.stock_booked ?? "-"}|${rows.length}:${summe}|${nb.data?.nr ?? "-"}:${nb.data?.status ?? "-"}`;
  return NextResponse.json({ v }, { headers: { "Cache-Control": "no-store" } });
}
