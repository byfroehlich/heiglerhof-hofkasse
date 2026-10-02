// Nachfülltour: kürzeste Rundfahrt ab Hof über alle Stopps (Luftlinie).
// Bis 8 Stopps wird jede Reihenfolge geprüft, darüber nächster Nachbar plus 2-opt.

export type Punkt = { lat: number; lng: number };

/** Entfernung zweier Punkte in km (Haversine). */
export function km(a: Punkt, b: Punkt): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Länge der Rundfahrt start → stopps[order] → start. */
export function rundLaenge(start: Punkt, stopps: Punkt[], order: number[]): number {
  let sum = 0, prev = start;
  for (const i of order) { sum += km(prev, stopps[i]); prev = stopps[i]; }
  return sum + (order.length ? km(prev, start) : 0);
}

function* permutationen(n: number[]): Generator<number[]> {
  if (n.length <= 1) { yield n; return; }
  for (let i = 0; i < n.length; i++) {
    const rest = [...n.slice(0, i), ...n.slice(i + 1)];
    for (const p of permutationen(rest)) yield [n[i], ...p];
  }
}

/** Beste Reihenfolge der Stopps (Indizes) für eine Rundfahrt ab start. */
export function besteTour(start: Punkt, stopps: Punkt[]): number[] {
  const idx = stopps.map((_, i) => i);
  if (idx.length <= 1) return idx;
  if (idx.length <= 8) {
    let best = idx, bestLen = Infinity;
    for (const p of permutationen(idx)) {
      const l = rundLaenge(start, stopps, p);
      if (l < bestLen - 1e-9) { best = p; bestLen = l; }
    }
    return best;
  }
  // nächster Nachbar
  const order: number[] = [];
  const offen = new Set(idx);
  let cur: Punkt = start;
  while (offen.size) {
    let n = -1, d = Infinity;
    for (const i of offen) { const x = km(cur, stopps[i]); if (x < d) { d = x; n = i; } }
    order.push(n); offen.delete(n); cur = stopps[n];
  }
  // 2-opt
  let besser = true;
  while (besser) {
    besser = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const neu = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (rundLaenge(start, stopps, neu) < rundLaenge(start, stopps, order) - 1e-9) { order.splice(0, order.length, ...neu); besser = true; }
      }
    }
  }
  return order;
}

/** Google-Maps-Links für die Tour. Pro Link höchstens 9 Zwischenstopps, längere Touren werden geteilt. */
export function mapsLinks(start: Punkt, stopps: Punkt[]): string[] {
  const p = (x: Punkt) => `${x.lat.toFixed(6)},${x.lng.toFixed(6)}`;
  const links: string[] = [];
  const kette = [start, ...stopps, start];
  for (let i = 0; i < kette.length - 1; i += 10) {
    const teil = kette.slice(i, i + 11);
    const u = new URL("https://www.google.com/maps/dir/");
    u.searchParams.set("api", "1");
    u.searchParams.set("origin", p(teil[0]));
    u.searchParams.set("destination", p(teil[teil.length - 1]));
    const mitte = teil.slice(1, -1);
    if (mitte.length) u.searchParams.set("waypoints", mitte.map(p).join("|"));
    u.searchParams.set("travelmode", "driving");
    links.push(u.toString());
  }
  return links;
}
