import "server-only";
import { env } from "./env";

export type LowStock = { location_name: string; product_name: string; ist: number; soll: number };

/** Nachfüllmeldung per E-Mail (Resend). Ohne Konfiguration nur ins Log. Fehler brechen die Zahlung nie ab. */
export async function notifyLowStock(rows: LowStock[]): Promise<void> {
  if (rows.length === 0) return;
  const lines = rows.map((r) => `${r.location_name}: ${r.product_name} nur noch ${r.ist} von ${r.soll}. Bitte ${r.soll - r.ist} nachfüllen.`);
  if (!env.resendKey || !env.notifyTo) {
    console.info("[nachfuellen]", lines.join(" | "));
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.notifyFrom,
        to: env.notifyTo.split(",").map((s) => s.trim()),
        subject: rows.length === 1 ? `Nachfüllen: ${rows[0].product_name} in ${rows[0].location_name}` : `Nachfüllen: ${rows.length} Produkte`,
        text: lines.join("\n") + "\n\nÜbersicht: /admin/nachfuellen",
      }),
    });
    if (!res.ok) console.error("[nachfuellen] Resend", res.status);
  } catch (e) {
    console.error("[nachfuellen]", e);
  }
}
