import "server-only";
import webpush from "web-push";
import { db } from "./supabase";
import { env } from "./env";
import { bestellNr, eur } from "./format";

export type PushArt = "kauf" | "knapp" | "leer" | "nachbestellung";
type Nachricht = { title: string; body: string; url?: string; tag?: string };

/** VAPID-Schlüssel aus den Einstellungen; fehlen sie, werden sie einmalig erzeugt und gespeichert. */
export async function vapid(): Promise<{ publicKey: string; privateKey: string }> {
  const { data } = await db().from("einstellungen").select("vapid_public, vapid_private").eq("id", 1).maybeSingle();
  if (data?.vapid_public && data.vapid_private) return { publicKey: data.vapid_public, privateKey: data.vapid_private };
  const k = webpush.generateVAPIDKeys();
  // Nur setzen, wenn noch leer (zwei gleichzeitige Aufrufe erzeugen sonst verschiedene Schlüssel)
  await db().from("einstellungen").upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });
  await db().from("einstellungen").update({ vapid_public: k.publicKey, vapid_private: k.privateKey }).eq("id", 1).is("vapid_public", null);
  const { data: neu } = await db().from("einstellungen").select("vapid_public, vapid_private").eq("id", 1).single();
  return { publicKey: neu!.vapid_public, privateKey: neu!.vapid_private };
}

/** Schickt eine Mitteilung an alle Geräte, die diese Art abonniert haben. Fehler brechen nie den Kauf ab. */
export async function sendePush(art: PushArt | null, n: Nachricht, nurEndpoint?: string): Promise<number> {
  try {
    let q = db().from("push_abos").select("id, endpoint, p256dh, auth");
    if (art) q = q.eq(art, true);
    if (nurEndpoint) q = q.eq("endpoint", nurEndpoint);
    const { data: abos } = await q;
    if (!abos?.length) { await protokoll(art, n.title, 0, 0, "kein Gerät für diese Art angemeldet"); return 0; }
    const k = await vapid();
    const subject = env.notifyTo ? `mailto:${env.notifyTo.split(",")[0].trim()}` : "mailto:hofkasse@heiglerhof.de";
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url ?? "/admin", tag: n.tag });
    let ok = 0;
    const fehler: string[] = [];
    await Promise.allSettled(abos.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, {
          vapidDetails: { subject, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 6 * 3600, urgency: art === "kauf" ? "normal" : "high",
        });
        ok++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await db().from("push_abos").delete().eq("id", a.id); fehler.push(`Gerät abgemeldet (${code}), entfernt`); }
        else { console.error("[push]", code ?? e); fehler.push(`Fehler ${code ?? (e as Error).message ?? "unbekannt"}`.slice(0, 120)); }
      }
    }));
    await protokoll(art, n.title, abos.length, ok, fehler.join("; ") || null);
    return ok;
  } catch (e) {
    console.error("[push]", e);
    await protokoll(art, n.title, 0, 0, `Abbruch: ${(e as Error).message}`.slice(0, 200));
    return 0;
  }
}

/** Fehler aus anderen Bereichen (z. B. Bestandsbuchung) ins selbe Protokoll schreiben. */
export async function protokolliere(art: string, titel: string, fehler: string) {
  try { await db().from("push_protokoll").insert({ art, titel: titel.slice(0, 200), fehler: fehler.slice(0, 300) }); } catch { /* egal */ }
}

/** Jede Mitteilung wird protokolliert (Einstellungen → Letzte Mitteilungen). Fehler hier stören nie. */
async function protokoll(art: PushArt | null, titel: string, geraete: number, erreicht: number, fehler: string | null) {
  try {
    await db().from("push_protokoll").insert({ art: art ?? "test", titel: titel.slice(0, 200), geraete, erreicht, fehler });
  } catch { /* egal */ }
}

const ART_TEXT: Record<string, string> = { paid: "PayPal", cash: "bar", transfer: "Überweisung angekündigt" };

/** Mitteilung „Neuer Kauf“ für eine Bestellung. */
export async function kaufPush(orderId: string) {
  const { data: o } = await db().from("orders")
    .select("nr, created_at, status, total_cents, locations!inner(name, demo), order_items(name_snapshot, quantity)")
    .eq("id", orderId)
    .maybeSingle<{ nr: number; created_at: string; status: string; total_cents: number; locations: { name: string; demo: boolean }; order_items: { name_snapshot: string; quantity: number }[] }>();
  if (!o) return;
  const pos = o.order_items.map((i) => `${i.quantity}× ${i.name_snapshot}`).join(", ");
  await sendePush("kauf", {
    title: `${o.locations.demo ? "Demo-Kauf" : "Neuer Kauf"}: ${eur(o.total_cents)} · ${o.locations.name}`,
    body: `${bestellNr(o.nr, o.created_at)} · ${ART_TEXT[o.status] ?? o.status} · ${pos}`.slice(0, 180),
    url: "/admin/bestellungen", tag: `kauf-${o.nr}`,
  });
}

/** Mitteilungen für Bestand auf Minimum oder leer. */
export async function bestandPush(rows: { location_name: string; product_name: string; ist: number; soll: number }[]) {
  for (const r of rows) {
    const leer = r.ist < 1;
    await sendePush(leer ? "leer" : "knapp", {
      title: leer ? `LEER: ${r.product_name}` : `Minimum erreicht: ${r.product_name}`,
      body: `${r.location_name}: noch ${r.ist} von ${r.soll}. Bitte ${r.soll - r.ist} nachfüllen.`,
      url: "/admin/nachfuellen", tag: `bestand-${r.location_name}-${r.product_name}`,
    });
  }
}
