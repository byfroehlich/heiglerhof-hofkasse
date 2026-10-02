import "server-only";

export type Treffer = { lat: number; lng: number; anzeige: string };

/**
 * Adresse → Koordinaten über OpenStreetMap Nominatim.
 * Nur im Adminbereich und nur auf Knopfdruck oder beim Speichern, damit die
 * Nutzungsregeln (höchstens 1 Anfrage pro Sekunde, eindeutiger User-Agent) eingehalten werden.
 */
export async function adresseSuchen(text: string): Promise<Treffer | null> {
  const q = text.trim().slice(0, 200);
  if (q.length < 3) return null;
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", q);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "de,at");
  u.searchParams.set("accept-language", "de");
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": "heiglerhof-hofkasse/1.0 (https://www.heiglerhof.de)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!j[0]) return null;
    const lat = Number(j[0].lat), lng = Number(j[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, anzeige: j[0].display_name };
  } catch {
    return null;
  }
}
