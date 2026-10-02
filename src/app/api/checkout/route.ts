import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { startPayPalCheckout } from "@/lib/checkout";
import { fail, rateLimited } from "@/lib/http";

// Der Browser schickt NUR Verkaufsstelle, product_id und quantity. Den Betrag rechnet der Server.
export async function POST(req: Request) {
  if (rateLimited(req)) return NextResponse.json({ error: "Zu viele Versuche. Bitte kurz warten." }, { status: 429 });
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 400 });
  try {
    return NextResponse.json(await startPayPalCheckout(parsed.data));
  } catch (e) {
    return fail(e);
  }
}
