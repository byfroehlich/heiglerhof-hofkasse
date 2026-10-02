import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/paypal";
import { markPaid } from "@/lib/checkout";
import { db } from "@/lib/supabase";

type Event = {
  event_type?: string;
  resource?: { id?: string; status?: string; custom_id?: string; amount?: { value: string; currency_code: string } };
};

// Rückfall, falls der Gast nach der Zahlung das Fenster schließt, bevor der Browser den Capture meldet.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Event | null;
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });
  if (!(await verifyWebhook(req.headers, body))) return NextResponse.json({ ok: false }, { status: 401 });

  const r = body.resource ?? {};
  if (!r.custom_id || !r.id) return NextResponse.json({ ok: true });

  if (body.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const { data: order } = await db().from("orders").select("id, total_cents, currency, status").eq("id", r.custom_id)
      .maybeSingle<{ id: string; total_cents: number; currency: string; status: string }>();
    if (order && order.status === "created") {
      const ok = r.amount?.value === (order.total_cents / 100).toFixed(2) && r.amount?.currency_code === order.currency;
      await markPaid(order.id, r.id, ok ? "paid" : "review");
    }
  }
  if (body.event_type === "PAYMENT.CAPTURE.REFUNDED") {
    await db().from("orders").update({ status: "refunded" }).eq("id", r.custom_id).in("status", ["paid", "review"]);
  }
  return NextResponse.json({ ok: true });
}
