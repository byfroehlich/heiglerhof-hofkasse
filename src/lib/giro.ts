import "server-only";
import QRCode from "qrcode";

/** Bankdaten für die Überweisung kommen aus Vercel (ZAHLUNG_IBAN, ZAHLUNG_EMPFAENGER, optional ZAHLUNG_BIC). */
export function bankdaten(): { iban: string; empfaenger: string; bic: string } | null {
  const iban = (process.env.ZAHLUNG_IBAN ?? "").replace(/\s+/g, "").toUpperCase();
  const empfaenger = (process.env.ZAHLUNG_EMPFAENGER ?? "").trim().slice(0, 70);
  const bic = (process.env.ZAHLUNG_BIC ?? "").replace(/\s+/g, "").toUpperCase();
  if (!ibanGueltig(iban) || !empfaenger) return null;
  return { iban, empfaenger, bic: /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic) ? bic : "" };
}

/** Prüfziffer nach ISO 13616 (mod 97). */
export function ibanGueltig(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const r = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of r) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

export const ibanLesbar = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

/** Inhalt des GiroCodes (EPC069-12, Version 002). */
export function epcText(b: { iban: string; empfaenger: string; bic: string }, cents: number, zweck: string): string {
  return ["BCD", "002", "1", "SCT", b.bic, b.empfaenger, b.iban, `EUR${(cents / 100).toFixed(2)}`, "", "", zweck.slice(0, 140)].join("\n");
}

/** GiroCode als SVG (Fehlerkorrektur M wie vom EPC vorgegeben, ohne Logo). */
export function giroSvg(text: string): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size, q = 4, s = n + q * 2;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x + q} ${y + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
