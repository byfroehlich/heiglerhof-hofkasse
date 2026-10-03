import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { startDemoCheckout } from "@/lib/checkout";
import { istAdmin } from "@/lib/auth";
import { fail } from "@/lib/http";

// Vorführmodus: nur für angemeldete Admins. Bucht keinen Bestand und zählt nicht in Umsatz oder Abrechnung.
export async function POST(req: Request) {
  if (!(await istAdmin())) return NextResponse.json({ error: "Der Vorführmodus geht nur angemeldet im Admin." }, { status: 403 });
  const { art, ...rest } = ((await req.json().catch(() => null)) ?? {}) as { art?: unknown };
  if (art !== "bar" && art !== "ueberweisung") return NextResponse.json({ error: "Ungültige Zahlart." }, { status: 400 });
  const parsed = checkoutSchema.safeParse(rest);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 400 });
  try {
    return NextResponse.json(await startDemoCheckout(parsed.data, art));
  } catch (e) {
    return fail(e);
  }
}
