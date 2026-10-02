import type { CheckoutInput } from "./validation";

export type StockedProduct = {
  id: string;
  name: string;
  label: string; // z. B. "Bierlikör 0,1 l"
  price_cents: number;
  ist: number;
  alkohol: boolean;
};

export type QuoteLine = { product_id: string; label: string; unit_price_cents: number; quantity: number };
export type Quote = { lines: QuoteLine[]; total_cents: number; hasAlcohol: boolean };

export class QuoteError extends Error {}

/**
 * Berechnet die Bestellung ausschließlich aus Serverdaten.
 * `available` sind die aktiven Produkte der Verkaufsstelle mit Bestand, frisch aus der Datenbank.
 * Doppelte product_ids werden zusammengefasst.
 */
export function buildQuote(items: CheckoutInput["items"], available: StockedProduct[]): Quote {
  const merged = new Map<string, number>();
  for (const it of items) merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.quantity);

  const byId = new Map(available.map((p) => [p.id, p]));
  const lines: QuoteLine[] = [];
  let total = 0;
  let hasAlcohol = false;
  for (const [id, quantity] of merged) {
    const p = byId.get(id);
    if (!p) throw new QuoteError("Ein Produkt ist hier gerade nicht verfügbar.");
    if (quantity > 10) throw new QuoteError("Höchstens 10 Stück je Produkt.");
    if (quantity > p.ist) throw new QuoteError(`${p.name}: nur noch ${p.ist} vorrätig.`);
    if (!Number.isInteger(p.price_cents) || p.price_cents <= 0) throw new QuoteError("Preisfehler");
    lines.push({ product_id: id, label: p.label, unit_price_cents: p.price_cents, quantity });
    total += p.price_cents * quantity;
    hasAlcohol ||= p.alkohol;
  }
  if (lines.length === 0) throw new QuoteError("Keine Produkte gewählt.");
  return { lines, total_cents: total, hasAlcohol };
}

/** Betrag als PayPal-String, z. B. 1250 -> "12.50" */
export const toPayPalValue = (cents: number) => (cents / 100).toFixed(2);
