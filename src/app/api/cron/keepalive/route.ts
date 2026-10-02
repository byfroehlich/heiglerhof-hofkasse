import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { env } from "@/lib/env";

// Täglich von Vercel Cron aufgerufen: hält das Supabase-Projekt wach
// und räumt nie bezahlte PayPal-Bestellungen nach 24 Stunden ab.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { error } = await db().from("orders").update({ status: "cancelled" }).eq("status", "created").lt("created_at", cutoff);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
