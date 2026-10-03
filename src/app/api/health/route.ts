import { NextResponse } from "next/server";
import { db as datenbank } from "@/lib/supabase";
import { paypalAnmeldung } from "@/lib/paypal";
import { rateLimited } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Liest nur die öffentlichen Angaben (Projekt und Rolle) aus einem Supabase-JWT, nie den Schlüssel selbst. */
function claims(key: string | undefined): { ref: string | null; role: string | null; format: string } {
  if (!key) return { ref: null, role: null, format: "fehlt" };
  if (key.startsWith("sb_publishable_")) return { ref: null, role: "anon", format: "neuer Schlüssel (publishable)" };
  if (key.startsWith("sb_secret_")) return { ref: null, role: "service_role", format: "neuer Schlüssel (secret)" };
  try {
    const p = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    return { ref: p.ref ?? null, role: p.role ?? null, format: "JWT (legacy)" };
  } catch {
    return { ref: null, role: null, format: "unlesbar" };
  }
}

// Diagnose für die Einrichtung. Gibt keine geheimen Werte heraus.
export async function GET(req: Request) {
  if (rateLimited(req, 10)) return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = raw ? new URL(raw).origin : undefined;
  const urlRef = url ? new URL(url).hostname.split(".")[0] : null;
  const urlZusatz = raw ? raw.slice(new URL(raw).origin.length) || null : null;
  const anon = claims(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const service = claims(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let authApi: number | string = "nicht geprüft";
  let db: number | string = "nicht geprüft";
  if (url && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, cache: "no-store" });
      authApi = r.status;
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const d = await fetch(`${url}/rest/v1/locations?select=id&limit=1`, {
          headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
          cache: "no-store",
        });
        db = d.status;
      }
    } catch {
      authApi = "nicht erreichbar";
    }
  }
  // Sind alle SQL-Schritte in der Datenbank angekommen? (je Schritt eine Spalte, die er anlegt)
  const schritte: [string, string, string][] = [
    ["0002", "location_products", "warn"], ["0003", "stock_alerts", "stufe"], ["0004", "locations", "lat"],
    ["0005", "locations", "ueberweisung_aktiv"], ["0006", "einstellungen", "iban"], ["0007", "push_abos", "endpoint"], ["0008", "push_protokoll", "zeit"], ["0009", "orders", "gebuehr_cents"], ["0010", "einstellungen", "kontakt_telefon"], ["0011", "orders", "storno_grund"],
  ];
  let migrationen: string[] | string = "nicht geprüft";
  let ungebucht: number | string = "nicht geprüft";
  let gebuehr = "nicht geprüft";
  if (url && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const fehlt = await Promise.all(schritte.map(async ([n, t, c]) => ((await datenbank().from(t).select(c).limit(1)).error ? n : null)));
    migrationen = fehlt.filter((x): x is string => x !== null);
    const { count } = await datenbank().from("orders").select("id", { count: "exact", head: true })
      .eq("stock_booked", false).in("status", ["paid", "cash", "transfer", "transfer_paid"]);
    ungebucht = count ?? "unbekannt";
    const g = await datenbank().from("einstellungen").select("paypal_gebuehr_aktiv, paypal_gebuehr_bp, paypal_gebuehr_fix_cents").eq("id", 1).maybeSingle();
    gebuehr = g.error ? `Fehler: ${g.error.message}` : !g.data ? "keine Einstellungen" :
      `${g.data.paypal_gebuehr_aktiv ? "an" : "aus"} (${(g.data.paypal_gebuehr_bp / 100).toFixed(2)} % + ${(g.data.paypal_gebuehr_fix_cents / 100).toFixed(2)} €)`;
  }
  const paypalDa = Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const ok =
    authApi === 200 && db === 200 && anon.role === "anon" && service.role === "service_role" &&
    (anon.ref === null || anon.ref === urlRef) && (service.ref === null || service.ref === urlRef);
  return NextResponse.json({
    ok,
    supabase_projekt_aus_url: urlRef,
    supabase_url_zusatz: urlZusatz,
    anon_key: { projekt: anon.ref, rolle: anon.role, format: anon.format },
    service_key: { projekt: service.ref, rolle: service.role, format: service.format },
    auth_api_status: authApi,
    datenbank_status: db,
    sql_schritte_fehlen: migrationen,
    kaeufe_ohne_bestandsbuchung: ungebucht,
    paypal_eingerichtet: paypalDa,
    paypal_modus: (process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com").includes("sandbox") ? "sandbox (Testgeld)" : "live (echtes Geld)",
    paypal_anmeldung: paypalDa ? await paypalAnmeldung() : "nicht geprüft",
    paypal_webhook_id_gesetzt: Boolean(process.env.PAYPAL_WEBHOOK_ID),
    paypal_gebuehr: gebuehr,
  });
}
