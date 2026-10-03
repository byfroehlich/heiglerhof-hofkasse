import "server-only";
import { randomBytes } from "node:crypto";
import { db, fotoUrl } from "./supabase";
import { eur, produktLabel, type Einheit } from "./format";
import { sendePush } from "./push";
import { hinweisMail } from "./notify";

export type NbProdukt = { id: string; label: string; haendler_cents: number | null; foto: string | null; farbe: string };
export type NbOffen = { nr: number; created_at: string; status: string; positionen: { name_snapshot: string; menge: number }[] };

export class NachbestellFehler extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Neuer, nicht erratbarer Link-Schlüssel (32 Zeichen). */
export const neuerToken = () => randomBytes(24).toString("base64url");

/** Nachbestell-Nummer für Anzeige und Lieferschein, z. B. „N-1003“. */
export const nbNr = (nr: number) => `N-${nr}`;

/** Seite für den Wiederverkäufer: Stelle, Sortiment mit Händlerpreis und seine offenen Nachbestellungen. */
export async function ladeNachbestellSeite(token: string) {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const { data: l } = await db().from("locations").select("id, name").eq("nachbestell_token", token).eq("active", true).eq("wiederverkaeufer", true).maybeSingle();
  if (!l) return null;
  const [{ data: lp }, { data: offen }] = await Promise.all([
    db().from("location_products")
      .select("products!inner(id, name, zusatz, inhalt, einheit, haendler_cents, foto_path, farbe, active)")
      .eq("location_id", l.id).eq("products.active", true)
      .returns<{ products: { id: string; name: string; zusatz: string | null; inhalt: number; einheit: Einheit; haendler_cents: number | null; foto_path: string | null; farbe: string } }[]>(),
    db().from("nachbestellungen").select("nr, created_at, status, positionen:nachbestell_positionen(name_snapshot, menge)")
      .eq("location_id", l.id).in("status", ["offen", "geliefert"]).order("created_at", { ascending: false }).limit(5).returns<NbOffen[]>(),
  ]);
  const produkte: NbProdukt[] = (lp ?? []).map(({ products: p }) => ({ id: p.id, label: produktLabel(p), haendler_cents: p.haendler_cents, foto: fotoUrl(p.foto_path), farbe: p.farbe }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
  return { stelle: l.name, produkte, offen: offen ?? [] };
}

/** Nachbestellung anlegen (Datenbank prüft Link und Sortiment), dann Push und E-Mail an den Hof. */
export async function erstelleNachbestellung(token: string, items: { product_id: string; menge: number }[], notiz: string) {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.product_id, Math.min(99, (merged.get(i.product_id) ?? 0) + i.menge));
  const { data, error } = await db().rpc("create_nachbestellung", {
    p_token: token, p_items: [...merged].map(([product_id, menge]) => ({ product_id, menge })), p_notiz: notiz,
  });
  if (error) {
    if (/link ungueltig/.test(error.message)) throw new NachbestellFehler("Dieser Nachbestell-Link gilt nicht mehr. Bitte beim Hof nach dem neuen Link fragen.", 404);
    if (/nicht verfuegbar|positionen/.test(error.message)) throw new NachbestellFehler("Das Sortiment hat sich gerade geändert. Bitte die Seite neu laden.", 409);
    throw error;
  }
  const r = (data as { n_id: string; n_nr: number; n_stelle: string; n_summe: number }[])[0];
  const { data: pos } = await db().from("nachbestell_positionen").select("name_snapshot, menge").eq("nachbestellung_id", r.n_id);
  const zeilen = (pos ?? []).map((p) => `${p.menge}× ${p.name_snapshot}`);
  const titel = `Nachbestellung ${r.n_stelle}`;
  await Promise.race([
    Promise.all([
      sendePush("nachbestellung", { title: titel, body: `${nbNr(r.n_nr)} · ${zeilen.join(", ")}`.slice(0, 180), url: "/admin/nachbestellungen", tag: `nb-${r.n_nr}` }),
      hinweisMail(`${titel} (${nbNr(r.n_nr)})`, `${zeilen.join("\n")}${notiz.trim() ? `\n\nNotiz: ${notiz.trim()}` : ""}${r.n_summe ? `\n\nSumme Händlerpreis: ${eur(r.n_summe)}` : ""}\n\nÜbersicht: /admin/nachbestellungen`),
    ]).catch((e) => console.error("[nachbestellung]", e)),
    new Promise((ok) => setTimeout(ok, 4000)),
  ]);
  return { nr: nbNr(r.n_nr), stelle: r.n_stelle };
}
