import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { startCashCheckout } from "@/lib/checkout";
import { fail, rateLimited } from "@/lib/http";

// Barzahlung melden: keine Zahlungsprüfung, dient Abrechnung und Bestand.
export async function POST(req: Request) {
  if (rateLimited(req, 10)) return NextResponse.json({ error: "Zu viele Versuche. Bitte kurz warten." }, { status: 429 });
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 400 });
  try {
    return NextResponse.json(await startCashCheckout(parsed.data));
  } catch (e) {
    return fail(e);
  }
}
