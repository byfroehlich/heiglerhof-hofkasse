import "server-only";
import QRCode from "qrcode";
import { LOGO_PNG_BASE64, LOGO_SIZE } from "./logo-data";

/**
 * QR Code als SVG mit Heiglerhof-Logo in der Mitte.
 * Fehlerkorrektur H (30 %): das Logo deckt nur rund 5 % der Fläche ab, der Code bleibt sicher lesbar.
 */
export function qrSvg(text: string, opts: { logo?: boolean } = {}): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const quiet = 4;
  const size = n + quiet * 2;
  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  }
  let logo = "";
  if (opts.logo !== false) {
    const box = Math.round(n * 0.24); // weiße Fläche ca. 24 % der Kantenlänge
    const pad = Math.max(1, Math.round(box * 0.08));
    const bx = (size - box) / 2;
    const lw = box - pad * 2;
    const lh = (lw * LOGO_SIZE.h) / LOGO_SIZE.w;
    logo =
      `<rect x="${bx}" y="${bx}" width="${box}" height="${box}" rx="${box * 0.08}" fill="#fff"/>` +
      `<image x="${bx + pad}" y="${(size - lh) / 2}" width="${lw}" height="${lh}" href="data:image/png;base64,${LOGO_PNG_BASE64}"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#2b2f31"/>${logo}</svg>`
  );
}
