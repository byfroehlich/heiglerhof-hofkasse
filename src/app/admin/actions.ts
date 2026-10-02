"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { authClient, db } from "@/lib/supabase";
import { locationSchema, productSchema } from "@/lib/validation";
import { slugify } from "@/lib/format";

export type FormState = { error?: string; ok?: string } | undefined;

// ---------- Login ----------
export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Bitte E-Mail und Passwort eingeben." };
  const supa = await authClient();
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) return { error: "Anmeldung fehlgeschlagen. E-Mail oder Passwort stimmt nicht." };
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
    price: form.get("price"), alkohol: form.get("alkohol") ?? "", farbe: form.get("farbe"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen." };
  const p = parsed.data;
  const row = { name: p.name, zusatz: p.zusatz, inhalt: p.inhalt, einheit: p.einheit, price_cents: p.price, alkohol_vol: p.alkohol, farbe: p.farbe };

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
    const { error } = await db().from("locations").insert({ ...parsed.data, slug });
    if (!error) { revalidatePath("/admin/verkaufsstellen"); return { ok: `${parsed.data.name} angelegt. Link: /kasse/${slug}` }; }
    if (error.code !== "23505") return { error: "Anlegen hat nicht geklappt." };
  }
  return { error: "Kein freier Link gefunden. Bitte anderen Namen wählen." };
}

export async function setAssortment(locationId: string, productId: string, on: boolean) {
  await requireAdmin();
  if (on) await db().from("location_products").upsert({ location_id: locationId, product_id: productId, ist: 0, soll: 4 }, { ignoreDuplicates: true });
  else await db().from("location_products").delete().eq("location_id", locationId).eq("product_id", productId);
  revalidatePath("/admin/verkaufsstellen");
}

export async function setStock(locationId: string, productId: string, field: "ist" | "soll", value: number) {
  await requireAdmin();
  const v = Math.trunc(value);
  if (!Number.isFinite(v) || v < (field === "soll" ? 1 : 0) || v > 999) return;
  await db().from("location_products").update({ [field]: v }).eq("location_id", locationId).eq("product_id", productId);
  revalidatePath("/admin/verkaufsstellen");
  revalidatePath("/admin/nachfuellen");
}

export async function refill(locationId: string, productId?: string) {
  await requireAdmin();
  let q = db().from("location_products").select("product_id, soll").eq("location_id", locationId);
  if (productId) q = q.eq("product_id", productId);
  const { data } = await q;
  for (const r of data ?? []) await db().from("location_products").update({ ist: r.soll }).eq("location_id", locationId).eq("product_id", r.product_id);
  revalidatePath("/admin/nachfuellen");
  revalidatePath("/admin/verkaufsstellen");
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
