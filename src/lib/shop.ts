import "server-only";
import { db, fotoUrl, partnerUrl } from "./supabase";
import { inhaltText, type Einheit } from "./format";
import type { StockedProduct } from "./pricing";
import { bankdaten } from "./giro";

export type Location = { id: string; slug: string; name: string; typ: string; ort: string | null; bar: boolean; paypal: boolean; ueberweisung: boolean };
export type Partner = { logo: string | null; bild: string | null; text: string | null; link: string | null };

export type ShopProduct = StockedProduct & {
  zusatz: string | null;
  inhalt: number;
  einheit: Einheit;
  alkohol_vol: number | null;
  farbe: string;
  foto: string | null;
};

type Row = {
  ist: number;
  products: {
    id: string; name: string; zusatz: string | null; inhalt: number; einheit: Einheit;
    price_cents: number; alkohol_vol: number | null; farbe: string; foto_path: string | null; active: boolean;
  };
};

/** Aktive Verkaufsstelle samt aktiven Produkten und Bestand, frisch aus der Datenbank. */
export async function loadShop(slug: string): Promise<{ location: Location; partner: Partner; products: ShopProduct[] } | null> {
  const { data: loc, error: locError } = await db()
    .from("locations")
    .select("id, slug, name, typ, ort, bar_aktiv, paypal_aktiv, ueberweisung_aktiv, logo_path, werbung_bild, werbung_text, werbung_link")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<Omit<Location, "bar" | "paypal" | "ueberweisung"> & { bar_aktiv: boolean; paypal_aktiv: boolean; ueberweisung_aktiv: boolean; logo_path: string | null; werbung_bild: string | null; werbung_text: string | null; werbung_link: string | null }>();
  if (locError) throw locError;
  if (!loc) return null;
  const location: Location = { id: loc.id, slug: loc.slug, name: loc.name, typ: loc.typ, ort: loc.ort, bar: loc.bar_aktiv, paypal: loc.paypal_aktiv, ueberweisung: loc.ueberweisung_aktiv && (await bankdaten()) !== null };
  const partner: Partner = { logo: partnerUrl(loc.logo_path), bild: partnerUrl(loc.werbung_bild), text: loc.werbung_text, link: loc.werbung_link };

  const { data, error } = await db()
    .from("location_products")
    .select("ist, products!inner(id, name, zusatz, inhalt, einheit, price_cents, alkohol_vol, farbe, foto_path, active)")
    .eq("location_id", location.id)
    .eq("products.active", true)
    .returns<Row[]>();
  if (error) throw error;

  const products = (data ?? [])
    .map(({ ist, products: p }) => ({
      id: p.id,
      name: p.name,
      label: `${p.name} ${inhaltText(p.inhalt, p.einheit)}`,
      price_cents: p.price_cents,
      ist,
      alkohol: p.alkohol_vol != null,
      zusatz: p.zusatz,
      inhalt: p.inhalt,
      einheit: p.einheit,
      alkohol_vol: p.alkohol_vol == null ? null : Number(p.alkohol_vol),
      farbe: p.farbe,
      foto: fotoUrl(p.foto_path),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  return { location, partner, products };
}
