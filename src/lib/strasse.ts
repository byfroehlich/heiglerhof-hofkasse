import "server-only";
import type { Punkt } from "./route";

export type StrassenTour = {
  /** Reihenfolge der Stopps (Indizes in die übergebene Liste) */
  order: number[];
  km: number;
  min: number;
  /** Abschnitte in Fahrreihenfolge: Hof → 1, 1 → 2, …, letzter → Hof */
  abschnitte: { km: number; min: number }[];
  linie: [number, number][];
};

type Osrm = {
  code: string;
  waypoints: { waypoint_index: number }[];
  trips: { distance: number; duration: number; legs: { distance: number; duration: number }[]; geometry: { coordinates: [number, number][] } }[];
};

/**
 * Rundfahrt ab Hof auf echten Straßen (OSRM, Daten von OpenStreetMap).
 * Der Dienst sucht auch die beste Reihenfolge. Gibt null zurück, wenn er nicht antwortet;
 * dann rechnet die Seite mit Luftlinie weiter.
 */
export async function strassenTour(start: Punkt, stopps: Punkt[]): Promise<StrassenTour | null> {
  if (stopps.length === 0 || stopps.length > 60) return null;
  const coords = [start, ...stopps].map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const u = `https://router.project-osrm.org/trip/v1/driving/${coords}?roundtrip=true&source=first&geometries=geojson&overview=full`;
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": "heiglerhof-hofkasse/1.0 (https://www.heiglerhof.de)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Osrm;
    const t = j.trips?.[0];
    if (j.code !== "Ok" || !t || j.waypoints?.length !== stopps.length + 1) return null;
    // waypoint_index = Position des Eingabepunkts in der Fahrt; Punkt 0 ist der Hof
    const order = stopps.map((_, i) => i).sort((a, b) => j.waypoints[a + 1].waypoint_index - j.waypoints[b + 1].waypoint_index);
    return {
      order,
      km: t.distance / 1000,
      min: t.duration / 60,
      abschnitte: t.legs.map((l) => ({ km: l.distance / 1000, min: l.duration / 60 })),
      linie: t.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
  } catch {
    return null;
  }
}

/** 83 → "1 h 23 min", 12 → "12 min" */
export function dauer(min: number): string {
  const m = Math.max(1, Math.round(min));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
}
