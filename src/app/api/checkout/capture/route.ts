import { NextResponse } from "next/server";
import { captureSchema } from "@/lib/validation";
import { finishPayPalCheckout } from "@/lib/checkout";
import { fail, rateLimited } from "@/lib/http";

export async function POST(req: Request) {
  if (rateLimited(req)) return NextResponse.json({ error: "Zu viele Versuche. Bitte kurz warten." }, { status: 429 });
  const parsed = captureSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  try {
    return NextResponse.json(await finishPayPalCheckout(parsed.data.paypal_order_id));
  } catch (e) {
    return fail(e);
  }
}
