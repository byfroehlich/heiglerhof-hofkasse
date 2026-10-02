import "server-only";
import { db } from "./supabase";
import type { PaypalGebuehr } from "./pricing";

/** PayPal-Gebühr laut Einstellungen, oder null wenn sie nicht an Kunden weitergegeben wird. */
export async function paypalGebuehr(): Promise<PaypalGebuehr | null> {
  const { data } = await db().from("einstellungen").select("paypal_gebuehr_aktiv, paypal_gebuehr_bp, paypal_gebuehr_fix_cents").eq("id", 1).maybeSingle();
  if (!data?.paypal_gebuehr_aktiv) return null;
  return { bp: data.paypal_gebuehr_bp, fix_cents: data.paypal_gebuehr_fix_cents };
}
