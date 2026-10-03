"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { authClient, db } from "@/lib/supabase";
import { locationEditSchema, locationSchema, productSchema } from "@/lib/validation";
import { adresseSuchen, type Treffer } from "@/lib/geo";
import { bankdaten, ibanGueltig, ibanLesbar } from "@/lib/giro";
import { hinweisMail } from "@/lib/notify";
import { sendePush, vapid } from "@/lib/push";
import { slugify } from "@/lib/format";
import { neuerToken } from "@/lib/nachbestellung";
import { MENU } from "@/lib/menu";

export type FormState = { error?: string; ok?: string } | undefined;

// ---------- Login ----------
export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Bitte E-Mail und Passwort eingeben." };
  const supa = await authClient();
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[login]", error.status, error.code, error.message);
    if (error.code === "email_not_confirmed")
      return { error: "Die E-Mail-Adresse ist in Supabase noch nicht bestätigt. Unter Authentication → Users den Nutzer bestätigen oder neu mit „Auto Confirm User“ anlegen." };
    if (error.status === 401 || /api key/i.test(error.message))
      return { error: "Die Verbindung zu Supabase ist falsch eingerichtet (anon key). Bitte NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel prüfen." };
    if (error.status === 429) return { error: "Zu viele Versuche. Bitte ein paar Minuten warten." };
    return { error: "Anmeldung fehlgeschlagen. E-Mail oder Passwort stimmt nicht." };
  }
  redirect("/admin");
}

export async function signOut() {
  const supa = await authClient();
  await supa.auth.signOut();
  redirect("/admin/login");
}

// ---------- Produkte ----------
const MAX_FOTO = 2.5 * 1024 * 1024;

export async function saveProduct(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const parsed = productSchema.safeParse({
    name: form.get("name"), zusatz: form.get("zusatz") ?? "", inhalt: form.get("inhalt"), einheit: form.get("einheit"),
    price: form.get("price"), haendler: form.get("haendler") ?? "", alkohol: form.get("alkohol") ?? "", farbe: form.get("farbe"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen." };
  const p = parsed.data;
  const row = { name: p.name, zusatz: p.zusatz, inhalt: p.inhalt, einheit: p.einheit, price_cents: p.price, haendler_cents: p.haendler, alkohol_vol: p.alkohol, farbe: p.farbe };

  let productId = id;
  if (id) {
    const { error } = await db().from("products").update(row).eq("id", id);
    if (error) return { error: "Speichern hat nicht geklappt." };
  } else {
    const { data, error } = await db().from("products").insert(row).select("id").single();
    if (error) return { error: "Anlegen hat nicht geklappt." };
    productId = data.id;
  }

  // Foto: im Browser schon verkleinert, hier geprüft und neu kodiert (entfernt auch Metadaten wie GPS).
  const foto = form.get("foto");
  if (foto instanceof File && foto.size > 0) {
    if (foto.size > MAX_FOTO) return { error: "Foto ist zu groß." };
    let jpeg: Buffer;
    try {
      jpeg = await sharp(Buffer.from(await foto.arrayBuffer()), { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(800, 800, { fit: "cover" })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
    } catch {
      return { error: "Die Datei ist kein gültiges Bild." };
    }
    const path = `${productId}/${Date.now()}.jpg`;
    const up = await db().storage.from("produktfotos").upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
    if (up.error) return { error: "Foto konnte nicht gespeichert werden." };
    const { data: old } = await db().from("products").select("foto_path").eq("id", productId).single();
    await db().from("products").update({ foto_path: path }).eq("id", productId);
    if (old?.foto_path) await db().storage.from("produktfotos").remove([old.foto_path]);
  } else if (form.get("foto_entfernen") === "1") {
    const { data: old } = await db().from("products").select("foto_path").eq("id", productId).single();
    await db().from("products").update({ foto_path: null }).eq("id", productId);
    if (old?.foto_path) await db().storage.from("produktfotos").remove([old.foto_path]);
  }

  revalidatePath("/admin/produkte");
  redirect(`/admin/produkte?gespeichert=${encodeURIComponent(p.name)}`);
}

export async function setProductActive(id: string, active: boolean) {
  await requireAdmin();
  await db().from("products").update({ active }).eq("id", id);
  revalidatePath("/admin/produkte");
}

// ---------- Verkaufsstellen ----------
export async function createLocation(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = locationSchema.safeParse({ name: form.get("name"), typ: form.get("typ"), ort: form.get("ort") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen." };
  const base = slugify(parsed.data.name);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base.slice(0, 30)}${i + 1}`;
    const { error } = await db().from("locations").insert({ ...parsed.data, slug, oeffentlich: parsed.data.typ !== "Ferienwohnung" });
    if (!error) { revalidatePath("/admin/verkaufsstellen"); return { ok: `${parsed.data.name} angelegt. Link: /kasse/${slug}` }; }
    if (error.code !== "23505") return { error: "Anlegen hat nicht geklappt." };
  }
  return { error: "Kein freier Link gefunden. Bitte anderen Namen wählen." };
}

export async function setAssortment(locationId: string, productId: string, on: boolean): Promise<FormState> {
  await requireAdmin();
  const { error } = on
    ? await db().from("location_products").upsert({ location_id: locationId, product_id: productId, ist: 0, soll: 4, warn: 1 }, { onConflict: "location_id,product_id", ignoreDuplicates: true })
    : await db().from("location_products").delete().eq("location_id", locationId).eq("product_id", productId);
  if (error) {
    console.error("[sortiment]", error.code, error.message);
    return { error: on ? "Produkt konnte nicht zugeordnet werden." : "Produkt konnte nicht entfernt werden." };
  }
  revalidatePath("/admin/verkaufsstellen");
  revalidatePath("/admin/nachfuellen");
  return { ok: "gespeichert" };
}

export async function setStock(locationId: string, productId: string, field: "ist" | "soll" | "warn", value: number): Promise<FormState> {
  await requireAdmin();
  const v = Math.trunc(value);
  if (!Number.isFinite(v) || v < (field === "soll" ? 1 : 0) || v > 999) return { error: field === "soll" ? "Soll muss zwischen 1 und 999 liegen." : "Bitte eine Zahl zwischen 0 und 999." };
  if (field !== "ist") {
    const { data: cur } = await db().from("location_products").select("soll, warn").eq("location_id", locationId).eq("product_id", productId).single();
    if (cur && field === "warn" && v >= cur.soll) return { error: `Warnbestand muss kleiner als Soll (${cur.soll}) sein.` };
    if (cur && field === "soll" && v <= cur.warn) return { error: `Soll muss größer als der Warnbestand (${cur.warn}) sein.` };
  }
  const { error } = await db().from("location_products").update({ [field]: v }).eq("location_id", locationId).eq("product_id", productId);
  if (error) { console.error("[bestand]", error.code, error.message); return { error: "Bestand konnte nicht gespeichert werden." }; }
  revalidatePath("/admin/verkaufsstellen");
  revalidatePath("/admin/nachfuellen");
  return { ok: "gespeichert" };
}

export async function refill(locationId: string, productId?: string) {
  await requireAdmin();
  let q = db().from("location_products").select("product_id, ist, soll").eq("location_id", locationId);
  if (productId) q = q.eq("product_id", productId);
  const { data } = await q;
  // Nur auffüllen, nie einen höheren Bestand auf das Soll herunterschreiben
  for (const r of data ?? []) if (r.ist < r.soll) await db().from("location_products").update({ ist: r.soll }).eq("location_id", locationId).eq("product_id", r.product_id);
  revalidatePath("/admin", "layout");
}

/** Mit Bestellungen: abschalten und archivieren (Abrechnung bleibt). Ohne Bestellungen: ganz löschen. */
export async function removeLocation(locationId: string) {
  await requireAdmin();
  const { count } = await db().from("orders").select("id", { count: "exact", head: true }).eq("location_id", locationId);
  if (count && count > 0) await db().from("locations").update({ active: false, archived_at: new Date().toISOString() }).eq("id", locationId);
  else await db().from("locations").delete().eq("id", locationId);
  revalidatePath("/admin/verkaufsstellen");
}

export async function reactivateLocation(locationId: string) {
  await requireAdmin();
  await db().from("locations").update({ active: true, archived_at: null }).eq("id", locationId);
  revalidatePath("/admin/verkaufsstellen");
}

// ---------- Adresse, Karte, Partner ----------
export async function sucheAdresse(text: string): Promise<Treffer | { error: string }> {
  await requireAdmin();
  return (await adresseSuchen(text)) ?? { error: "Adresse nicht gefunden. Bitte genauer schreiben oder den Punkt auf der Karte setzen." };
}

/** Partnerbild prüfen und neu kodieren: Logo als PNG (behält Transparenz), Werbung als JPEG. */
async function partnerBild(f: File, art: "logo" | "werbung"): Promise<{ buf: Buffer; type: string; ext: string } | { error: string }> {
  if (f.size > MAX_FOTO) return { error: "Bild ist zu groß." };
  try {
    const img = sharp(Buffer.from(await f.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate();
    if (art === "logo") return { buf: await img.resize(400, 400, { fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer(), type: "image/png", ext: "png" };
    return { buf: await img.resize(1200, 900, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer(), type: "image/jpeg", ext: "jpg" };
  } catch {
    return { error: "Die Datei ist kein gültiges Bild." };
  }
}

export async function saveLocation(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Unbekannte Verkaufsstelle." };
  const s = (k: string) => String(form.get(k) ?? "");
  const parsed = locationEditSchema.safeParse({
    name: s("name"), typ: s("typ"), ort: s("ort"), strasse: s("strasse"), plz: s("plz"), hinweis: s("hinweis"),
    oeffentlich: form.get("oeffentlich") === "on", demo: form.get("demo") === "on", wiederverkaeufer: form.get("wiederverkaeufer") === "on", lat: s("lat"), lng: s("lng"), werbung_text: s("werbung_text"), werbung_link: s("werbung_link"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen." };
  const d = parsed.data;
  let { lat, lng } = d;
  let hinweisGeo = "";
  // Kein Punkt gesetzt, aber Adresse da: automatisch suchen
  if ((lat === null || lng === null) && (d.strasse || d.ort)) {
    const t = await adresseSuchen([d.strasse, [d.plz, d.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "));
    if (t) { lat = t.lat; lng = t.lng; } else hinweisGeo = " Adresse wurde auf der Karte nicht gefunden, bitte den Punkt von Hand setzen.";
  }
  if (lat === null || lng === null) { lat = null; lng = null; }

  const { data: alt } = await db().from("locations").select("logo_path, werbung_bild").eq("id", id).single();
  const row: Record<string, unknown> = { ...d, lat, lng };
  const weg: string[] = [];

  for (const [feld, spalte, art] of [["logo", "logo_path", "logo"], ["werbung_bild", "werbung_bild", "werbung"]] as const) {
    const f = form.get(feld);
    const altPfad = alt?.[spalte] ?? null;
    if (f instanceof File && f.size > 0) {
      const b = await partnerBild(f, art);
      if ("error" in b) return { error: b.error };
      const path = `${id}/${art}-${Date.now()}.${b.ext}`;
      const up = await db().storage.from("partner").upload(path, b.buf, { contentType: b.type, upsert: false });
      if (up.error) return { error: "Bild konnte nicht gespeichert werden." };
      row[spalte] = path;
      if (altPfad) weg.push(altPfad);
    } else if (form.get(`${feld}_entfernen`) === "1") {
      row[spalte] = null;
      if (altPfad) weg.push(altPfad);
    }
  }

  const { error } = await db().from("locations").update(row).eq("id", id);
  if (error) return { error: "Speichern hat nicht geklappt." };
  if (weg.length) await db().storage.from("partner").remove(weg);
  revalidatePath("/admin/verkaufsstellen");
  revalidatePath("/karte");
  return { ok: `Gespeichert.${hinweisGeo}` };
}

export async function setZahlart(locationId: string, art: "bar" | "paypal" | "ueberweisung", on: boolean): Promise<FormState> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(locationId)) return { error: "Unbekannte Verkaufsstelle." };
  if (art === "ueberweisung" && on && !(await bankdaten())) return { error: "Erst IBAN und Kontoinhaber unter Einstellungen eintragen." };
  const { error } = await db().from("locations").update({ [`${art}_aktiv`]: on }).eq("id", locationId);
  if (error) return { error: error.code === "23514" ? "Mindestens eine Zahlart muss an bleiben." : "Speichern hat nicht geklappt." };
  revalidatePath("/admin/verkaufsstellen");
  return { ok: "gespeichert" };
}

export async function markTransferPaid(orderId: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return;
  await db().from("orders").update({ status: "transfer_paid", paid_at: new Date().toISOString() }).eq("id", orderId).eq("status", "transfer");
  revalidatePath("/admin", "layout");
}

export async function saveBank(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const iban = String(form.get("iban") ?? "").replace(/\s+/g, "").toUpperCase();
  const empfaenger = String(form.get("empfaenger") ?? "").trim();
  const bic = String(form.get("bic") ?? "").replace(/\s+/g, "").toUpperCase();
  if (iban === "" && empfaenger === "") {
    await db().from("einstellungen").update({ iban: null, empfaenger: null, bic: null, geaendert_am: new Date().toISOString(), geaendert_von: me.email }).eq("id", 1);
    await db().from("locations").update({ ueberweisung_aktiv: false }).eq("ueberweisung_aktiv", true).or("bar_aktiv.eq.true,paypal_aktiv.eq.true");
    await hinweisMail("Hofkasse: Bankdaten entfernt", `Die Bankdaten für Überweisungen wurden von ${me.email} entfernt.`);
    revalidatePath("/admin", "layout");
    return { ok: "Bankdaten entfernt. Überweisung ist überall ausgeschaltet, wo noch eine andere Zahlart an ist." };
  }
  if (!ibanGueltig(iban)) return { error: "Die IBAN stimmt nicht. Bitte genau abschreiben, die Prüfziffer passt nicht." };
  if (empfaenger.length < 2 || empfaenger.length > 70) return { error: "Bitte den Kontoinhaber so eintragen, wie er bei der Bank steht." };
  if (bic && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic)) return { error: "Die BIC hat 8 oder 11 Zeichen. Sie darf auch leer bleiben." };
  const { error } = await db().from("einstellungen")
    .upsert({ id: 1, iban, empfaenger, bic: bic || null, geaendert_am: new Date().toISOString(), geaendert_von: me.email });
  if (error) return { error: "Speichern hat nicht geklappt." };
  await hinweisMail("Hofkasse: Bankdaten geändert",
    `Die Bankdaten für Überweisungen wurden geändert von ${me.email}.\n\nKontoinhaber: ${empfaenger}\nIBAN: ${ibanLesbar(iban)}${bic ? `\nBIC: ${bic}` : ""}\n\nWar das nicht ihr? Sofort im Adminbereich prüfen und das Passwort ändern.`);
  revalidatePath("/admin", "layout");
  return { ok: "Gespeichert. Jetzt bei den gewünschten Verkaufsstellen den Schalter Überweisung einschalten." };
}

/** Bar- oder Überweisungskauf stornieren: bleibt sichtbar, zählt nicht mehr. Bestand auf Wunsch zurück. */
export async function stornieren(orderId: string, form: FormData) {
  const me = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return;
  const grund = String(form.get("grund") ?? "").trim().slice(0, 100) || "ohne Angabe";
  const { data, error } = await db().rpc("storno", { p_order: orderId, p_grund: grund, p_zurueck: form.get("zurueck") === "on", p_von: me.email });
  if (error || data !== "ok") console.error("[storno]", error?.message ?? data);
  revalidatePath("/admin", "layout");
}

// ---------- Nachbestellungen (Wiederverkäufer) ----------
/** Nachbestell-Link erzeugen oder erneuern. Der alte Link gilt danach nicht mehr. */
export async function nachbestellLink(locationId: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(locationId)) return;
  await db().from("locations").update({ nachbestell_token: neuerToken() }).eq("id", locationId).eq("wiederverkaeufer", true);
  revalidatePath("/admin/verkaufsstellen");
}

export async function nachbestellStatus(id: string, status: "geliefert" | "erledigt" | "storniert" | "offen") {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id) || !["geliefert", "erledigt", "storniert", "offen"].includes(status)) return;
  const jetzt = new Date().toISOString();
  const row: Record<string, unknown> = { status };
  if (status === "geliefert") row.geliefert_am = jetzt;
  if (status === "erledigt") row.erledigt_am = jetzt;
  if (status === "offen") { row.geliefert_am = null; row.erledigt_am = null; }
  await db().from("nachbestellungen").update(row).eq("id", id);
  revalidatePath("/admin", "layout");
}

/** Reihenfolge der Bereiche (Startbildschirm und Seitenleiste). Nur bekannte Pfade werden gespeichert. */
export async function menuSpeichern(hrefs: string[]) {
  await requireAdmin();
  const erlaubt = new Set<string>(MENU.map((m) => m.href));
  const liste = [...new Set(hrefs)].filter((h) => erlaubt.has(h));
  await db().from("einstellungen").update({ menu_reihenfolge: liste }).eq("id", 1);
  revalidatePath("/admin", "layout");
}

/** Ansprechpartner für Gäste: steht nach dem Kauf, auf der Karte und auf dem Verkaufsschild. */
export async function saveKontakt(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const telefon = String(form.get("telefon") ?? "").trim().replace(/\s+/g, " ");
  if (name.length > 40) return { error: "Der Name darf höchstens 40 Zeichen haben." };
  if (telefon && !/^\+?[0-9 /]{6,25}$/.test(telefon)) return { error: "Bitte nur Ziffern, Leerzeichen, / und ein + am Anfang, zum Beispiel 0176 1234 5678." };
  const { error } = await db().from("einstellungen").update({
    kontakt_name: name || null, kontakt_telefon: telefon || null, geaendert_am: new Date().toISOString(), geaendert_von: me.email,
  }).eq("id", 1);
  if (error) return { error: "Speichern hat nicht geklappt. Ist SQL 0010 eingespielt?" };
  revalidatePath("/", "layout");
  return { ok: "Gespeichert. Verkaufsschilder bitte neu herunterladen, damit die neue Nummer draufsteht." };
}

/** PayPal-Gebühr an Gäste weitergeben: an/aus, Prozent und fester Betrag (wie im PayPal-Konto). */
export async function savePaypalGebuehr(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const zahl = (k: string) => Number(String(form.get(k) ?? "").trim().replace(/\s*(%|€)\s*$/, "").replace(",", "."));
  const prozent = zahl("prozent"), fix = zahl("fix");
  if (!Number.isFinite(prozent) || prozent < 0 || prozent > 10) return { error: "Prozent bitte zwischen 0 und 10 eintragen, zum Beispiel 2,99." };
  if (!Number.isFinite(fix) || fix < 0 || fix > 2) return { error: "Festen Betrag bitte zwischen 0 und 2 Euro eintragen, zum Beispiel 0,39." };
  const aktiv = form.get("aktiv") === "on";
  const { error } = await db().from("einstellungen").update({
    paypal_gebuehr_aktiv: aktiv, paypal_gebuehr_bp: Math.round(prozent * 100), paypal_gebuehr_fix_cents: Math.round(fix * 100),
    geaendert_am: new Date().toISOString(), geaendert_von: me.email,
  }).eq("id", 1);
  if (error) return { error: "Speichern hat nicht geklappt. Ist SQL 0009 eingespielt?" };
  revalidatePath("/admin", "layout");
  return { ok: aktiv ? "Gespeichert. Gäste sehen die PayPal Gebühr ab sofort an der Kasse." : "Gespeichert. PayPal kostet für Gäste jetzt nichts extra." };
}

// ---------- Push-Mitteilungen ----------
type PushAbo = { endpoint: string; keys: { p256dh: string; auth: string } };
const pushOk = (a: unknown): a is PushAbo => {
  const x = a as PushAbo;
  return typeof x?.endpoint === "string" && /^https:\/\//.test(x.endpoint) && x.endpoint.length < 1000 &&
    typeof x.keys?.p256dh === "string" && typeof x.keys?.auth === "string" && x.keys.p256dh.length < 200 && x.keys.auth.length < 100;
};

export async function pushSchluessel(): Promise<string> {
  await requireAdmin();
  return (await vapid()).publicKey;
}

export async function pushAnmelden(abo: unknown, geraet: string): Promise<FormState> {
  const me = await requireAdmin();
  if (!pushOk(abo)) return { error: "Das Gerät hat keine gültige Anmeldung geliefert." };
  const { error } = await db().from("push_abos").upsert(
    { endpoint: abo.endpoint, p256dh: abo.keys.p256dh, auth: abo.keys.auth, user_id: me.userId, email: me.email, geraet: geraet.slice(0, 120) || null },
    { onConflict: "endpoint" },
  );
  if (error) return { error: "Anmeldung konnte nicht gespeichert werden." };
  await sendePush(null, { title: "Hofkasse", body: "Mitteilungen sind eingeschaltet. So sieht eine Meldung aus.", tag: "test" }, abo.endpoint);
  return { ok: "eingeschaltet" };
}

export async function pushAbmelden(endpoint: string): Promise<void> {
  await requireAdmin();
  await db().from("push_abos").delete().eq("endpoint", endpoint);
}

export async function pushArten(endpoint: string): Promise<{ kauf: boolean; knapp: boolean; leer: boolean; nachbestellung: boolean } | null> {
  await requireAdmin();
  const { data } = await db().from("push_abos").select("kauf, knapp, leer, nachbestellung").eq("endpoint", endpoint).maybeSingle();
  return data;
}

export async function pushArtSetzen(endpoint: string, art: "kauf" | "knapp" | "leer" | "nachbestellung", on: boolean): Promise<void> {
  await requireAdmin();
  if (!["kauf", "knapp", "leer", "nachbestellung"].includes(art)) return;
  await db().from("push_abos").update({ [art]: on }).eq("endpoint", endpoint);
}

export async function pushTest(endpoint: string): Promise<FormState> {
  await requireAdmin();
  const n = await sendePush(null, { title: "Test von der Hofkasse", body: "Wenn ihr das lest, kommen die Mitteilungen an.", tag: "test" }, endpoint);
  return n ? { ok: "Test verschickt" } : { error: "Nicht angekommen. Die Anmeldung dieses Geräts ist abgelaufen, bitte aus- und wieder einschalten." };
}

/** Eigene Reihenfolge der Verkaufsstellen (SQL 0015). Nur vorhandene Stellen, Position = Index. */
export async function stellenReihenfolgeSpeichern(ids: string[]) {
  await requireAdmin();
  const liste = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 500);
  await Promise.all(liste.map((id, i) => db().from("locations").update({ reihenfolge: i }).eq("id", id)));
  revalidatePath("/admin/verkaufsstellen");
}
