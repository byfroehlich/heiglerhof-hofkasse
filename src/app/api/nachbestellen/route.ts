import { NextResponse } from "next/server";
import { z } from "zod";
import { erstelleNachbestellung, NachbestellFehler } from "@/lib/nachbestellung";
import { rateLimited } from "@/lib/http";

const schema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{24,64}$/),
  items: z.array(z.object({ product_id: z.string().uuid(), menge: z.number().int().min(1).max(99) }).strict()).min(1).max(40),
  notiz: z.string().max(500),
}).strict();

// Nachbestellung eines Wiederverkäufers: ohne Bezahlung, kommt als Auftrag beim Hof an.
export async function POST(req: Request) {
  if (rateLimited(req, 10)) return NextResponse.json({ error: "Zu viele Versuche. Bitte kurz warten." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bitte mindestens ein Produkt mit Menge wählen." }, { status: 400 });
  try {
    return NextResponse.json(await erstelleNachbestellung(parsed.data.token, parsed.data.items, parsed.data.notiz));
  } catch (e) {
    if (e instanceof NachbestellFehler) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[nachbestellen]", e);
    return NextResponse.json({ error: "Das hat nicht geklappt. Bitte gleich noch einmal versuchen." }, { status: 500 });
  }
}
