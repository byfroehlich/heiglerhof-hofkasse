// Erzeugt das App-Symbol „Hofkasse“ (Gelb mit Schwarz) in allen Größen.
// Aufruf: npx tsx scripts/icons.mts
import { readFile, writeFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";

const GELB = "#F6C843", SCHWARZ = "#1E1E1C";
const font = fontkit.create(await readFile("assets/fonts/BarlowCondensed-Bold.ttf")) as unknown as {
  unitsPerEm: number; layout(t: string): { glyphs: { path: { toSVG(): string } }[]; positions: { xAdvance: number }[] };
};

/** Text als SVG-Pfad, mittig bei cx, Grundlinie bei y. */
function textPfad(text: string, size: number, cx: number, y: number, spacing = 0) {
  const run = font.layout(text);
  const s = size / font.unitsPerEm;
  const breite = run.positions.reduce((a, p) => a + p.xAdvance * s + spacing, -spacing);
  let x = cx - breite / 2, d = "";
  run.glyphs.forEach((g, i) => {
    d += `<path transform="translate(${x.toFixed(2)} ${y}) scale(${s} ${-s})" d="${g.path.toSVG()}"/>`;
    x += run.positions[i].xAdvance * s + spacing;
  });
  return d;
}

/** Motiv auf 512er Fläche; k skaliert um die Mitte (für maskierbare Symbole kleiner). */
function svg(k = 1, rund = 0) {
  const g = `
    <g fill="none" stroke="${SCHWARZ}" stroke-width="22" stroke-linejoin="round" stroke-linecap="round">
      <path d="M126 236 L256 132 L386 236"/>
      <path d="M152 222 V352 H360 V222"/>
      <path d="M216 352 V272 H296 V352"/>
      <path d="M216 272 L296 352 M296 272 L216 352" stroke-width="14"/>
    </g>
    <circle cx="352" cy="170" r="42" fill="${SCHWARZ}" stroke="${GELB}" stroke-width="10"/>
    <g fill="${GELB}">${textPfad("€", 52, 352, 188)}</g>
    <g fill="${SCHWARZ}">${textPfad("HOFKASSE", 74, 256, 444, 3)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${rund}" fill="${GELB}"/>
    <g transform="translate(256 256) scale(${k}) translate(-256 -256)">${g}</g></svg>`;
}

const ziele: [string, number, number, number][] = [
  ["public/icons/hofkasse-512.png", 512, 1, 0],
  ["public/icons/hofkasse-192.png", 192, 1, 0],
  ["public/icons/hofkasse-maskable-512.png", 512, 0.8, 0], // Motiv in der sicheren Zone
  ["public/icons/apple-touch-icon.png", 180, 0.92, 0],     // iOS rundet selbst
  ["public/icons/badge-96.png", 96, 1, 0],
];
for (const [datei, px, k, r] of ziele) await writeFile(datei, await sharp(Buffer.from(svg(k, r))).resize(px, px).png().toBuffer());
await writeFile("public/icons/hofkasse.svg", svg(1, 96));
// Einfarbiges Badge für Android (Statusleiste): weiße Scheune auf transparent
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"><path d="M12 46 L48 16 L84 46"/><path d="M20 40 V80 H76 V40"/><path d="M38 80 V58 H58 V80"/></g></svg>`;
await writeFile("public/icons/badge-96.png", await sharp(Buffer.from(badge)).png().toBuffer());
console.log("Symbole erzeugt");
