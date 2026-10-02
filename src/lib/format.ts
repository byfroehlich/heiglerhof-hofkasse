export const eur = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export type Einheit = "g" | "ml";

export function inhaltText(inhalt: number, einheit: Einheit): string {
  if (einheit === "g") return inhalt >= 1000 ? `${(inhalt / 1000).toLocaleString("de-DE")} kg` : `${inhalt} g`;
  return `${(inhalt / 1000).toLocaleString("de-DE")} l`;
}

/** Grundpreis je Liter oder Kilogramm nach PAngV, gerundet auf Cent. */
export function grundpreisText(priceCents: number, inhalt: number, einheit: Einheit): string {
  const cents = Math.round((priceCents * 1000) / inhalt);
  return `${eur(cents)}/${einheit === "ml" ? "l" : "kg"}`;
}

export const alkoholText = (vol: number | null) =>
  vol == null ? null : `${vol.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % vol`;

/** Meldebestand: 30 % vom Soll, mindestens 1. Muss zu book_stock() in der Datenbank passen. */
export const meldebestand = (soll: number) => Math.max(1, Math.ceil(soll * 0.3));

/** Warnstufe eines Bestands: rot = leer, gelb = Minimum (Warnbestand) erreicht. */
export type Stufe = "leer" | "knapp" | "gut";
export const stufe = (ist: number, warn: number): Stufe => (ist < 1 ? "leer" : ist <= warn ? "knapp" : "gut");
export const STUFE: Record<Stufe, { t: string; pill: string; bar: string }> = {
  leer: { t: "leer", pill: "bg-bad", bar: "bg-bad" },
  knapp: { t: "Minimum erreicht", pill: "bg-warn", bar: "bg-warn" },
  gut: { t: "gut", pill: "bg-ok", bar: "bg-ok" },
};

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/^(ferienwohnung|hotel|haus)\s+/, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 32) || "stelle"
  );
}

/** Eindeutiger Produktname für Listen: „Honig 500 g · Blütenhonig“. */
export type ProduktKurz = { name: string; zusatz?: string | null; inhalt?: number | null; einheit?: Einheit | null };
export function produktLabel(p: ProduktKurz): string {
  const basis = p.inhalt && p.einheit ? `${p.name} ${inhaltText(p.inhalt, p.einheit)}` : p.name;
  return p.zusatz ? `${basis} · ${p.zusatz}` : basis;
}

/** Bestellnummer mit Jahr davor (deutsche Zeit): „2026-1023“. Sortiert sich nach Jahren. */
export function bestellNr(nr: number, wann: string | Date = new Date()): string {
  const jahr = new Intl.DateTimeFormat("de-DE", { year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(wann));
  return `${jahr}-${nr}`;
}

/** Verwendungszweck: „2026-1023 Hotel Alpenrose“ (höchstens 140 Zeichen, wie bei SEPA erlaubt). */
export function verwendungszweck(nr: number, stelle: string, wann: string | Date = new Date()): string {
  return `${bestellNr(nr, wann)} ${stelle.replace(/\s+/g, " ").trim()}`.slice(0, 140);
}
