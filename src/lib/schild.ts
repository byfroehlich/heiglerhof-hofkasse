import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type Color } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { LOGO_PNG_BASE64 } from "./logo-data";

export type SchildDaten = {
  name: string;
  typ: string;
  url: string;
  bar: boolean;
  paypal: boolean;
  alkohol: boolean;
};

const hex = (h: string): Color => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = { ink: hex("#2b2f31"), mut: hex("#6e665a"), or: hex("#e48500"), orD: hex("#a85f00"), orl: hex("#fde7c8"), cream: hex("#fbf5e9"), line: hex("#e7dac0"), white: rgb(1, 1, 1) };

const W = 595.28, H = 841.89, M = 42; // A4 in Punkt, Rand 15 mm

/** Texte fürs Schild. Ohne Bindestriche, herzlich und ein bisschen Allgäu. */
export function schildTexte(d: SchildDaten) {
  const schritt3 = d.paypal
    ? { t: "Bezahlen", x: "Mit PayPal, in Sekunden erledigt und ganz ohne Kleingeld." }
    : { t: "Bar zahlen", x: "Betrag im Handy bestätigen und das Geld in die Kasse legen." };
  const box = d.paypal && d.bar
    ? { t: "Am schnellsten mit PayPal", x: "Sicher, kontaktlos und ihr braucht kein passendes Kleingeld. Uns hilft es sehr, wenn ihr so zahlt.", klein: "Bar geht auch: im Handy „bar“ antippen und das Geld in die Kasse legen." }
    : d.paypal
      ? { t: "Bezahlt wird mit PayPal", x: "Sicher, kontaktlos und ohne Kleingeld. Ihr braucht nur euer Handy und ein Konto bei PayPal.", klein: "" }
      : { t: "Bezahlt wird bar", x: "Kurz im Handy bestätigen, dann das Geld in die Kasse legen. So wissen wir, was wir nachfüllen müssen.", klein: "" };
  const kopf = d.typ === "Verkaufskasten" ? "Selbstbedienung an unserer Hoftür" : d.typ === "Hotel" ? "Für unsere Gäste hier im Haus" : d.typ === "Ferienwohnung" ? "Für euch hier in der Ferienwohnung" : "Hier für euch zum Mitnehmen";
  return {
    kopf,
    titel: "Nehmt euch, was euch schmeckt!",
    schritte: [
      { t: "Scannen", x: "Handykamera auf den Code halten. Eine App braucht ihr nicht." },
      { t: "Aussuchen", x: "Antippen, was ihr mitnehmt. Der Preis steht gleich dabei." },
      schritt3,
    ],
    box,
    alkohol: d.alkohol ? "Liköre geben wir nur an Erwachsene ab 18 Jahren ab." : "",
    vertrauen: "Unsere kleine Kasse lebt vom Vertrauen. Vergelt’s Gott!",
  };
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > max && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function roundRect(p: PDFPage, x: number, top: number, w: number, h: number, r: number, o: { fill?: Color; border?: Color; bw?: number }) {
  const d = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
  p.drawSvgPath(d, { x, y: top, color: o.fill, borderColor: o.border, borderWidth: o.border ? (o.bw ?? 1) : 0 });
}

function center(p: PDFPage, text: string, y: number, font: PDFFont, size: number, color: Color, cx = W / 2) {
  p.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
}

let fontCache: Record<string, Uint8Array> | null = null;
async function fonts() {
  if (fontCache) return fontCache;
  const dir = join(process.cwd(), "assets", "fonts");
  const names = { bold: "BarlowCondensed-Bold.ttf", semi: "BarlowCondensed-SemiBold.ttf", med: "BarlowCondensed-Medium.ttf", brush: "CaveatBrush-Regular.ttf", serif: "Vollkorn-400-normal.ttf", serifI: "Vollkorn-400-italic.ttf" };
  const entries = await Promise.all(Object.entries(names).map(async ([k, f]) => [k, new Uint8Array(await readFile(join(dir, f)))] as const));
  fontCache = Object.fromEntries(entries);
  return fontCache;
}

/** A4-Verkaufsschild als druckfertiges PDF (Vektor: Texte und QR Code bleiben in jeder Größe scharf). */
export async function schildPdf(d: SchildDaten): Promise<Uint8Array> {
  const tx = schildTexte(d);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Verkaufsschild ${d.name}`);
  pdf.setAuthor("Heiglerhof");
  const f = await fonts();
  const bold = await pdf.embedFont(f.bold, { subset: true });
  const semi = await pdf.embedFont(f.semi, { subset: true });
  const med = await pdf.embedFont(f.med, { subset: true });
  const brush = await pdf.embedFont(f.brush); // Teilmenge verliert bei dieser Schrift Zeichen
  const serif = await pdf.embedFont(f.serif, { subset: true });
  const serifI = await pdf.embedFont(f.serifI, { subset: true });
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const p = pdf.addPage([W, H]);

  // Kopf: Logo links, Gruß rechts
  const lh = 92, lw = (logo.width / logo.height) * lh;
  p.drawImage(logo, { x: M, y: H - M - lh, width: lw, height: lh });
  const tx0 = M + lw + 18;
  p.drawText("Griaß Gott!", { x: tx0, y: H - M - 46, size: 54, font: brush, color: C.or });
  const nameSize = Math.min(22, ((W - M - tx0) / bold.widthOfTextAtSize(d.name, 22)) * 22);
  p.drawText(d.name, { x: tx0 + 2, y: H - M - 70, size: nameSize, font: bold, color: C.ink });
  p.drawText(tx.kopf, { x: tx0 + 2, y: H - M - 88, size: 15, font: semi, color: C.mut });

  // Fuß (fest unten)
  const fy = M + 20;
  p.drawLine({ start: { x: M, y: fy + 20 }, end: { x: W - M, y: fy + 20 }, thickness: 1.5, color: C.or });
  center(p, "Heiglerhof · Wank 6 · 87484 Nesselwang · Steffi 0176 9999 8727 · www.heiglerhof.de", fy + 2, semi, 13, C.ink);
  center(p, `Kein Scan möglich? Im Browser eingeben: ${d.url.replace(/^https?:\/\//, "")}`, fy - 15, med, 11, C.mut);

  // Von unten nach oben: Dank, Altershinweis, Zahlbox, Schritte
  let u = fy + 20 + 28;
  center(p, tx.vertrauen, u, serifI, 17, C.ink);
  if (tx.alkohol) { u += 24; center(p, tx.alkohol, u, semi, 14, C.mut); }
  u += 24;

  const bw = W - 2 * M, inner = bw - 40;
  const xLines = wrap(tx.box.x, serif, 14, inner);
  const kLines = tx.box.klein ? wrap(tx.box.klein, med, 13, inner) : [];
  const boxH = 18 + 26 + 8 + xLines.length * 19 + (kLines.length ? 6 + kLines.length * 17 : 0) + 10;
  const boxTop = u + boxH;
  roundRect(p, M, boxTop, bw, boxH, 18, { fill: d.paypal ? C.orl : C.cream, border: d.paypal ? C.or : C.line, bw: 1.5 });
  let by = boxTop - 18 - 22;
  p.drawText(tx.box.t, { x: M + 20, y: by, size: 26, font: bold, color: d.paypal ? C.orD : C.ink });
  by -= 30;
  for (const l of xLines) { p.drawText(l, { x: M + 20, y: by, size: 14, font: serif, color: C.ink }); by -= 19; }
  if (kLines.length) { by -= 6; for (const l of kLines) { p.drawText(l, { x: M + 20, y: by, size: 13, font: med, color: C.mut }); by -= 17; } }

  const colW = (W - 2 * M - 2 * 16) / 3;
  const stepLines = tx.schritte.map((s) => wrap(s.x, serif, 12, colW - 4));
  const stepsH = 34 + 10 + Math.max(...stepLines.map((l) => l.length)) * 15;
  const stepsTop = boxTop + 18 + stepsH;
  tx.schritte.forEach((s, i) => {
    const x = M + i * (colW + 16), cx = x + 17;
    p.drawCircle({ x: cx, y: stepsTop - 17, size: 17, color: i === 2 && d.paypal ? C.or : C.ink });
    center(p, String(i + 1), stepsTop - 24, bold, 20, C.white, cx);
    p.drawText(s.t, { x: x + 42, y: stepsTop - 24, size: 22, font: bold, color: C.ink });
    let ly = stepsTop - 34 - 12 - 4;
    for (const line of stepLines[i]) { p.drawText(line, { x: x + 2, y: ly, size: 12, font: serif, color: C.ink }); ly -= 15; }
  });

  // Von oben: Ort und Titel
  const y = H - M - lh - 46;
  const titelSize = bold.widthOfTextAtSize(tx.titel, 38) > W - 2 * M ? 32 : 38;
  center(p, tx.titel, y, bold, titelSize, C.ink);

  // Dazwischen: QR Code so groß wie der Platz erlaubt (max. 8,3 cm), senkrecht mittig
  const capH = 40; // Platz für „Einfach mit dem Handy scannen“
  const frei = y - 16 - (stepsTop + 12) - capH;
  const card = Math.min(272, frei);
  const qs = card - 36;
  const cardTop = y - 16 - (frei - card) / 2;
  roundRect(p, (W - card) / 2, cardTop, card, card, 22, { fill: C.white, border: C.or, bw: 4 });
  const qr = QRCode.create(d.url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const mod = qs / n, qx = (W - qs) / 2, qyTop = cardTop - 18;
  for (let r = 0; r < n; r++) {
    let run = -1;
    for (let c = 0; c <= n; c++) {
      const on = c < n && qr.modules.get(c, r);
      if (on && run < 0) run = c;
      if (!on && run >= 0) {
        p.drawRectangle({ x: qx + run * mod, y: qyTop - (r + 1) * mod, width: (c - run) * mod + 0.15, height: mod + 0.15, color: C.ink });
        run = -1;
      }
    }
  }
  const box = Math.round(n * 0.24) * mod, pad = box * 0.08;
  const bx = (W - box) / 2, byTop = qyTop - (qs - box) / 2;
  roundRect(p, bx, byTop, box, box, box * 0.08, { fill: C.white });
  const ilw = box - pad * 2, ilh = ilw * (logo.height / logo.width);
  p.drawImage(logo, { x: bx + pad, y: byTop - box / 2 - ilh / 2, width: ilw, height: ilh });
  center(p, "Einfach mit dem Handy scannen", cardTop - card - 32, brush, 30, C.or);

  return pdf.save();
}
