"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LMap, Marker } from "leaflet";

export type KartenPunkt = {
  id: string; lat: number; lng: number; titel: string;
  zeile?: string; nr?: number; farbe?: "or" | "bad" | "warn" | "ok" | "hof"; link?: { href: string; text: string };
};

const FARBE = { or: "#e48500", bad: "#b3261e", warn: "#b98614", ok: "#4d7c3a", hof: "#3b2a1a" } as const;
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function icon(L: typeof import("leaflet"), p: Pick<KartenPunkt, "nr" | "farbe">) {
  const el = document.createElement("span");
  el.className = "kpin";
  el.style.background = FARBE[p.farbe ?? "or"];
  el.textContent = p.farbe === "hof" ? "⌂" : p.nr != null ? String(p.nr) : "";
  return L.divIcon({ html: el, className: "", iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
}

// Popup aus DOM-Knoten statt HTML-Text: Namen und Adressen kommen aus der Datenbank.
function popup(p: KartenPunkt) {
  const d = document.createElement("div");
  const b = document.createElement("b"); b.textContent = p.titel; d.append(b);
  if (p.zeile) { const z = document.createElement("div"); z.textContent = p.zeile; d.append(z); }
  if (p.link) {
    const a = document.createElement("a"); a.href = p.link.href; a.textContent = p.link.text;
    if (/^https?:/.test(p.link.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    d.append(a);
  }
  return d;
}

/** Karte mit Punkten und optionaler Linie (Tour). */
export function Karte({ punkte, linie, className = "h-[420px]" }: { punkte: KartenPunkt[]; linie?: [number, number][]; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([punkte, linie]);
  useEffect(() => {
    let map: LMap | undefined;
    let aus = false;
    import("leaflet").then((L) => {
      if (aus || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false });
      L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(map);
      const ll: [number, number][] = [];
      for (const p of punkte) {
        L.marker([p.lat, p.lng], { icon: icon(L, p), title: p.titel, alt: p.titel }).bindPopup(popup(p)).addTo(map);
        ll.push([p.lat, p.lng]);
      }
      if (linie?.length) L.polyline(linie, { color: FARBE.or, weight: 4, opacity: 0.8, dashArray: "8 8" }).addTo(map);
      if (ll.length > 1) map.fitBounds(ll, { padding: [40, 40], maxZoom: 14 });
      else map.setView(ll[0] ?? [47.6152, 10.5208], 13);
    });
    return () => { aus = true; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu zeichnen nur, wenn sich die Daten ändern
  }, [key]);
  return <div ref={box} className={`isolate w-full overflow-hidden rounded-2xl border border-line bg-cream ${className}`} role="region" aria-label="Karte" />;
}

/** Karte zum Setzen eines Punkts: Marker ziehen oder in die Karte tippen. */
export function PinKarte({ lat, lng, onChange }: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });

  useEffect(() => {
    let aus = false;
    import("leaflet").then((L) => {
      if (aus || !box.current) return;
      const m = L.map(box.current, { scrollWheelZoom: false }).setView([47.6152, 10.5208], 12);
      L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(m);
      const mk = L.marker([47.6152, 10.5208], { icon: icon(L, { farbe: "or" }), draggable: true });
      mk.on("dragend", () => { const p = mk.getLatLng(); cb.current(p.lat, p.lng); });
      m.on("click", (e) => { mk.setLatLng(e.latlng).addTo(m); cb.current(e.latlng.lat, e.latlng.lng); });
      map.current = m; marker.current = mk;
    });
    return () => { aus = true; map.current?.remove(); map.current = null; };
  }, []);

  // Von außen gesetzte Koordinaten (Adresssuche) übernehmen
  useEffect(() => {
    const go = () => {
      if (!map.current || !marker.current) return false;
      if (lat != null && lng != null) {
        marker.current.setLatLng([lat, lng]).addTo(map.current);
        // Nur springen, wenn der Punkt außerhalb des sichtbaren Ausschnitts liegt (z. B. nach der Adresssuche)
        if (!map.current.getBounds().contains([lat, lng]) || map.current.getZoom() < 13) map.current.setView([lat, lng], Math.max(map.current.getZoom(), 16));
      }
      else marker.current.remove();
      return true;
    };
    if (go()) return;
    const t = setInterval(() => { if (go()) clearInterval(t); }, 100);
    return () => clearInterval(t);
  }, [lat, lng]);

  return <div ref={box} className="isolate h-72 w-full overflow-hidden rounded-xl border border-line bg-cream" role="region" aria-label="Karte zum Setzen des Standorts" />;
}
