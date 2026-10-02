import "server-only";
import { db, fotoUrl } from "./supabase";
import { inhaltText, type Einheit } from "./format";
import type { StockedProduct } from "./pricing";

export type Location = { id: string; slug: string; name: string; typ: string; ort: string | null };

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
export async function loadShop(slug: string): Promise<{ location: Location; products: ShopProduct[] } | null> {
  const { data: location, error: locError } = await db()
    .from("locations")
    .select("id, slug, name, typ, ort")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<Location>();
  if (locError) throw locError;
  if (!location) return null;

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
  return { location, products };
}
