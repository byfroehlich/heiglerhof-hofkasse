import "server-only";
import { NextResponse } from "next/server";
import { CheckoutError } from "./checkout";

const hits = new Map<string, { n: number; reset: number }>();

/** Einfache Bremse je IP und Instanz. Gegen gezielte Angriffe zusätzlich die Vercel-Firewall nutzen. */
export function rateLimited(req: Request, limit = 20, windowMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unbekannt";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) { hits.set(ip, { n: 1, reset: now + windowMs }); return false; }
  h.n += 1;
  return h.n > limit;
}

export function fail(e: unknown) {
  if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[api]", e);
  return NextResponse.json({ error: "Das hat nicht geklappt. Bitte gleich noch einmal versuchen." }, { status: 500 });
}
