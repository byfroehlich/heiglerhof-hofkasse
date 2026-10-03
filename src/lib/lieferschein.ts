import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { LOGO_PNG_BASE64 } from "./logo-data";
import { HOF } from "./hof";
import { eur } from "./format";

export type LieferscheinDaten = {
  nr: string;                 // „N-1003“
  datum: string;              // bestellt am, formatiert
  empfaenger: string[];       // Name und Adresszeilen
  positionen: { name: string; menge: number; preis: number | null }[];
  notiz: string | null;
  kontakt: string;            // „Name Telefon“ oder leer
};

const W = 595.28, H = 841.89, M = 56;
const INK = rgb(0.17, 0.18, 0.19), MUT = rgb(0.43, 0.4, 0.35), LINIE = rgb(0.9, 0.85, 0.75);

/** Lieferschein A4 mit Händlerpreisen. Standardschrift (Umlaute, € und × sind enthalten). */
export async function lieferscheinPdf(d: LieferscheinDaten): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Lieferschein ${d.nr}`);
  pdf.setAuthor(HOF.name);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const p = pdf.addPage([W, H]);
  const text = (t: string, x: number, y: number, size = 11, f: PDFFont = font, color = INK) => p.drawText(t, { x, y, size, font: f, color });
  const rechts = (t: string, x: number, y: number, size = 11, f: PDFFont = font) => text(t, x - f.widthOfTextAtSize(t, size), y, size, f);

  // Kopf: Logo, Absender, Titel
  const lh = 70, lw = (logo.width / logo.height) * lh;
  p.drawImage(logo, { x: W - M - lw, y: H - M - lh, width: lw, height: lh });
  text(`${HOF.name} · ${HOF.adresse}${d.kontakt ? ` · ${d.kontakt}` : ""}`, M, H - M - 8, 8, font, MUT);
  let y = H - M - 34;
  for (const [i, z] of d.empfaenger.entries()) { text(z, M, y, i === 0 ? 12 : 11, i === 0 ? bold : font); y -= 15; }

  y = H - M - 170;
  text("Lieferschein", M, y, 22, bold);
  rechts(`Nr. ${d.nr}`, W - M, y + 6, 11, bold);
  rechts(`bestellt am ${d.datum}`, W - M, y - 9, 10);

  // Tabelle
  y -= 36;
  const xMenge = M, xName = M + 55, xPreis = W - M - 90, xSumme = W - M;
  text("Menge", xMenge, y, 10, bold, MUT); text("Artikel", xName, y, 10, bold, MUT);
  rechts("Einzelpreis", xPreis, y, 10, bold); rechts("Summe", xSumme, y, 10, bold);
  y -= 8; p.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: INK }); y -= 18;
  let gesamt = 0, mitPreis = false;
  for (const pos of d.positionen) {
    const name = pos.name.length > 60 ? `${pos.name.slice(0, 58)}…` : pos.name;
    text(`${pos.menge} ×`, xMenge, y); text(name, xName, y);
    if (pos.preis != null) {
      mitPreis = true; gesamt += pos.preis * pos.menge;
      rechts(eur(pos.preis), xPreis, y); rechts(eur(pos.preis * pos.menge), xSumme, y);
    }
    y -= 8; p.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINIE }); y -= 16;
    if (y < M + 120) break; // eine Seite reicht für Nachbestellungen (max. 40 Positionen bei kleiner Liste)
  }
  if (mitPreis) { rechts(`Summe ${eur(gesamt)}`, xSumme, y - 2, 12, bold); y -= 26; }
  if (d.notiz) { text(`Notiz: ${d.notiz.slice(0, 110)}`, M, y, 10, font, MUT); y -= 18; }
  text("Die Rechnung folgt separat.", M, y - 6, 10, font, MUT);

  // Unterschrift
  const uy = M + 40;
  p.drawLine({ start: { x: M, y: uy }, end: { x: M + 200, y: uy }, thickness: 0.8, color: INK });
  p.drawLine({ start: { x: W - M - 200, y: uy }, end: { x: W - M, y: uy }, thickness: 0.8, color: INK });
  text("Datum, geliefert", M, uy - 12, 9, font, MUT);
  text("Ware erhalten (Unterschrift)", W - M - 200, uy - 12, 9, font, MUT);
  return pdf.save();
}
