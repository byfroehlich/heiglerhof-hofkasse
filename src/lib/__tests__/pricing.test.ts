import { describe, expect, it } from "vitest";
import { buildQuote, paypalAufschlag, QuoteError, toPayPalValue, type StockedProduct } from "../pricing";
import { checkoutSchema, productSchema } from "../validation";
import { grundpreisText, meldebestand, slugify, inhaltText } from "../format";

const A = "7f1c2a10-b1e0-4c11-9a01-0000000000a1";
const B = "7f1c2a10-b1e0-4c11-9a01-0000000000b1";
const avail: StockedProduct[] = [
  { id: A, name: "Bierlikör", label: "Bierlikör 0,1 l", price_cents: 600, ist: 3, alkohol: true },
  { id: B, name: "Honig", label: "Honig 250 g", price_cents: 650, ist: 10, alkohol: false },
];

describe("buildQuote", () => {
  it("rechnet nur mit Serverpreisen und fasst doppelte Positionen zusammen", () => {
    const q = buildQuote([{ product_id: A, quantity: 1 }, { product_id: B, quantity: 2 }, { product_id: A, quantity: 1 }], avail);
    expect(q.total_cents).toBe(2 * 600 + 2 * 650);
    expect(q.lines).toHaveLength(2);
    expect(q.hasAlcohol).toBe(true);
  });
  it("lehnt unbekannte oder nicht verfügbare Produkte ab", () => {
    expect(() => buildQuote([{ product_id: "00000000-0000-4000-8000-000000000000", quantity: 1 }], avail)).toThrow(QuoteError);
  });
  it("lehnt mehr als den Bestand ab", () => {
    expect(() => buildQuote([{ product_id: A, quantity: 4 }], avail)).toThrow(/nur noch 3/);
  });
  it("lehnt über 10 Stück auch nach dem Zusammenfassen ab", () => {
    expect(() => buildQuote([{ product_id: B, quantity: 6 }, { product_id: B, quantity: 5 }], avail)).toThrow(/10/);
  });
});

describe("checkoutSchema", () => {
  it("akzeptiert nur product_id und quantity", () => {
    expect(checkoutSchema.safeParse({ location: "alpenblick", items: [{ product_id: A, quantity: 1 }] }).success).toBe(true);
    expect(checkoutSchema.safeParse({ location: "alpenblick", items: [{ product_id: A, quantity: 1, price: 1 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ location: "alpenblick", total: 1, items: [{ product_id: A, quantity: 1 }] }).success).toBe(false);
  });
  it("prüft Mengen und Anzahl", () => {
    for (const quantity of [0, -1, 1.5, 11]) expect(checkoutSchema.safeParse({ location: "abc", items: [{ product_id: A, quantity }] }).success).toBe(false);
    const many = Array.from({ length: 21 }, () => ({ product_id: A, quantity: 1 }));
    expect(checkoutSchema.safeParse({ location: "abc", items: many }).success).toBe(false);
    expect(checkoutSchema.safeParse({ location: "../x", items: [{ product_id: A, quantity: 1 }] }).success).toBe(false);
  });
});

describe("productSchema", () => {
  const base = { name: "Honig", zusatz: "", inhalt: "250", einheit: "g", price: "6,50", alkohol: "", farbe: "#e48500" };
  it("liest deutsche Preise", () => {
    const r = productSchema.parse(base);
    expect(r.price).toBe(650);
    expect(r.alkohol).toBeNull();
    expect(r.zusatz).toBeNull();
  });
  it("lehnt falsche Preise und Alkoholwerte ab", () => {
    expect(productSchema.safeParse({ ...base, price: "0" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, price: "abc" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, alkohol: "120" }).success).toBe(false);
    expect(productSchema.parse({ ...base, alkohol: "18,5" }).alkohol).toBe(18.5);
  });
});

describe("format", () => {
  it("Grundpreis je l und kg", () => {
    expect(grundpreisText(600, 100, "ml")).toBe("60,00 €/l");
    expect(grundpreisText(650, 250, "g")).toBe("26,00 €/kg");
  });
  it("Inhalt", () => {
    expect(inhaltText(100, "ml")).toBe("0,1 l");
    expect(inhaltText(250, "g")).toBe("250 g");
  });
  it("Meldebestand 30 % vom Soll, mindestens 1", () => {
    expect(meldebestand(10)).toBe(3);
    expect(meldebestand(6)).toBe(2);
    expect(meldebestand(2)).toBe(1);
  });
  it("Links", () => {
    expect(slugify("Ferienwohnung Alpenblick")).toBe("alpenblick");
    expect(slugify("Hotel Sonnenhof")).toBe("sonnenhof");
    expect(slugify("Haus Edelweiß")).toBe("edelweiss");
  });
  it("PayPal-Betrag", () => {
    expect(toPayPalValue(1250)).toBe("12.50");
    expect(toPayPalValue(5)).toBe("0.05");
  });
});

describe("paypalAufschlag", () => {
  const g = { bp: 299, fix_cents: 39 };
  it("deckt die PayPal-Gebühr, sodass der Warenwert übrig bleibt", () => {
    for (const ware of [100, 500, 1000, 2000, 6500, 99999]) {
      const a = paypalAufschlag(ware, g);
      const brutto = ware + a;
      const gebuehr = Math.round(brutto * 0.0299 + 39); // so rechnet PayPal (auf Cent gerundet)
      expect(brutto - gebuehr).toBeGreaterThanOrEqual(ware);
      expect(brutto - gebuehr).toBeLessThanOrEqual(ware + 1); // nie mehr als 1 Cent zu viel
    }
  });
  it("Beispiele: 5 €, 10 €, 20 €", () => {
    expect(paypalAufschlag(500, g)).toBe(56);
    expect(paypalAufschlag(1000, g)).toBe(72);
    expect(paypalAufschlag(2000, g)).toBe(102);
  });
  it("aus oder null ergibt 0", () => {
    expect(paypalAufschlag(1000, null)).toBe(0);
    expect(paypalAufschlag(1000, { bp: 0, fix_cents: 0 })).toBe(0);
  });
});
