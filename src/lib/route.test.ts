import { describe, expect, it } from "vitest";
import { besteTour, km, mapsLinks, rundLaenge } from "./route";

const hof = { lat: 47.6152, lng: 10.5208 };

describe("route", () => {
  it("rechnet Luftlinie", () => {
    // Nesselwang → Füssen etwa 14 km
    expect(km(hof, { lat: 47.5696, lng: 10.7006 })).toBeGreaterThan(13);
    expect(km(hof, { lat: 47.5696, lng: 10.7006 })).toBeLessThan(15);
  });
  it("findet die kürzeste Rundfahrt", () => {
    // Punkte auf einer Linie nach Osten, absichtlich durcheinander
    const s = [3, 1, 4, 2].map((i) => ({ lat: hof.lat, lng: hof.lng + i * 0.05 }));
    const t = besteTour(hof, s);
    const l = rundLaenge(hof, s, t);
    expect(l).toBeCloseTo(2 * km(hof, s[2]), 5);
  });
  it("2-opt bei vielen Stopps ist nicht schlechter als die Eingabereihenfolge", () => {
    const s = Array.from({ length: 12 }, (_, i) => ({ lat: hof.lat + Math.sin(i * 2.3) * 0.1, lng: hof.lng + Math.cos(i * 1.7) * 0.1 }));
    const t = besteTour(hof, s);
    expect([...t].sort((a, b) => a - b)).toEqual(s.map((_, i) => i));
    expect(rundLaenge(hof, s, t)).toBeLessThanOrEqual(rundLaenge(hof, s, s.map((_, i) => i)));
  });
  it("teilt lange Touren auf mehrere Google-Maps-Links", () => {
    const s = Array.from({ length: 12 }, (_, i) => ({ lat: hof.lat, lng: hof.lng + i * 0.01 }));
    const links = mapsLinks(hof, s);
    expect(links).toHaveLength(2);
    expect(new URL(links[0]).searchParams.get("waypoints")!.split("|")).toHaveLength(9);
    expect(new URL(links[1]).searchParams.get("destination")).toBe(`${hof.lat.toFixed(6)},${hof.lng.toFixed(6)}`);
  });
});
