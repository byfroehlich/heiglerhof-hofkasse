import Link from "next/link";
import { db } from "@/lib/supabase";
import { refill } from "../../actions";
import { STUFE, produktLabel, stufe, type ProduktKurz, type Stufe } from "@/lib/format";
import { HOF } from "@/lib/hof";
import { besteTour, km, mapsLinks, rundLaenge } from "@/lib/route";
import { dauer, strassenTour } from "@/lib/strasse";
import { Karte, type KartenPunkt } from "@/components/karte";
import { DruckKnopf } from "@/components/druck-knopf";

type R = {
  ist: number; soll: number; warn: number; location_id: string; product_id: string;
  locations: { name: string; typ: string; strasse: string | null; plz: string | null; ort: string | null; lat: number | null; lng: number | null; active: boolean };
  products: ProduktKurz & { active: boolean };
};
type Pos = { product_id: string; name: string; ist: number; soll: number; menge: number; stufe: Stufe };
type Stopp = { id: string; name: string; typ: string; adresse: string; lat: number | null; lng: number | null; pos: Pos[]; schlimmste: Stufe };

export default async function Tour({ searchParams }: PageProps<"/admin/tour">) {
  const sp = await searchParams;
  const nurLeer = sp.nur === "leer";
  const { data } = await db()
    .from("location_products")
    .select("ist, soll, warn, location_id, product_id, locations!inner(name, typ, strasse, plz, ort, lat, lng, active), products!inner(name, zusatz, inhalt, einheit, active)")
    .eq("locations.active", true)
    .returns<R[]>();
  const rows = data ?? [];

  // Angefahren wird jede Stelle mit Warnung. Dort wird alles bis zum Soll aufgefüllt, nicht nur das Gewarnte.
  const byLoc = new Map<string, R[]>();
  for (const r of rows) byLoc.set(r.location_id, [...(byLoc.get(r.location_id) ?? []), r]);
  const stopps: Stopp[] = [];
  for (const [id, rs] of byLoc) {
    const warn = rs.filter((r) => r.products.active && stufe(r.ist, r.warn) !== "gut");
    if (!warn.length || (nurLeer && !warn.some((r) => r.ist < 1))) continue;
    const l = rs[0].locations;
    const pos = rs.filter((r) => r.products.active && r.ist < r.soll)
      .map((r) => ({ product_id: r.product_id, name: produktLabel(r.products), ist: r.ist, soll: r.soll, menge: r.soll - r.ist, stufe: stufe(r.ist, r.warn) }))
      .sort((a, b) => Number(a.ist > 0) - Number(b.ist > 0) || a.name.localeCompare(b.name, "de"));
    stopps.push({
      id, name: l.name, typ: l.typ, adresse: [l.strasse, [l.plz, l.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      lat: l.lat, lng: l.lng, pos, schlimmste: pos.some((p) => p.stufe === "leer") ? "leer" : "knapp",
    });
  }
  const mitPunkt = stopps.filter((s): s is Stopp & { lat: number; lng: number } => s.lat != null && s.lng != null);
  const ohnePunkt = stopps.filter((s) => s.lat == null || s.lng == null);
  // Erst echte Straßen (Reihenfolge, km und Fahrzeit), ohne Antwort Luftlinie
  const strasse = await strassenTour(HOF, mitPunkt);
  const order = strasse?.order ?? besteTour(HOF, mitPunkt);
  const tour = order.map((i) => mitPunkt[i]);
  const gesamtKm = strasse?.km ?? rundLaenge(HOF, mitPunkt, order);
  const abschnitte = strasse?.abschnitte ?? [...tour, HOF].map((s, i) => ({ km: km(i === 0 ? HOF : tour[i - 1], s), min: null as number | null }));
  const links = mapsLinks(HOF, tour);
  const fmtKm = (x: number) => x.toFixed(1).replace(".", ",");

  const pack = new Map<string, { name: string; menge: number; stellen: number }>();
  for (const s of stopps) for (const p of s.pos) {
    const e = pack.get(p.product_id) ?? { name: p.name, menge: 0, stellen: 0 };
    e.menge += p.menge; e.stellen += 1; pack.set(p.product_id, e);
  }
  const packliste = [...pack.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const summe = packliste.reduce((a, p) => a + p.menge, 0);

  const punkte: KartenPunkt[] = [
    { id: "hof", lat: HOF.lat, lng: HOF.lng, titel: HOF.name, zeile: "Start und Ziel", farbe: "hof" },
    ...tour.map((s, i) => ({ id: s.id, lat: s.lat, lng: s.lng, titel: `${i + 1}. ${s.name}`, zeile: s.adresse, nr: i + 1, farbe: s.schlimmste === "leer" ? "bad" as const : "warn" as const })),
  ];
  const linie: [number, number][] = strasse?.linie ?? [[HOF.lat, HOF.lng], ...tour.map((s) => [s.lat, s.lng] as [number, number]), [HOF.lat, HOF.lng]];

  return (
    <>
      <h1 className="text-3xl font-bold">Nachfülltour</h1>
      <p className="max-w-3xl font-txt text-mut">
        Alle Verkaufsstellen mit Warnung in der kürzesten Reihenfolge ab Hof und zurück. An jeder Stelle wird alles bis zum Sollbestand aufgefüllt,
        deshalb steht auf der Packliste auch, was noch nicht knapp ist. Reihenfolge, Kilometer und Fahrzeit kommen aus OpenStreetMap; unterwegs navigiert Google Maps.
      </p>
      <div className="no-print mt-3 flex flex-wrap gap-2">
        <Link href="/admin/tour" className={`btn btn-sm ${nurLeer ? "btn-ghost" : "btn-or"}`}>Gelb und Rot</Link>
        <Link href="/admin/tour?nur=leer" className={`btn btn-sm ${nurLeer ? "btn-or" : "btn-ghost"}`}>Nur wo etwas leer ist</Link>
        <DruckKnopf />
      </div>

      {stopps.length === 0 ? (
        <div className="mt-4 rounded-xl bg-cream p-4">Gerade muss nirgends etwas hin. Schöne Pause!</div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{stopps.length}</b><span className="text-sm text-mut">Stopps</span></div>
            <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{summe}</b><span className="text-sm text-mut">Stück mitnehmen</span></div>
            <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{fmtKm(gesamtKm)} km</b><span className="text-sm text-mut">{strasse ? "Straße, hin und zurück" : "Luftlinie (Routendienst gerade nicht erreichbar)"}</span></div>
            <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{strasse ? dauer(strasse.min) : "–"}</b><span className="text-sm text-mut">reine Fahrzeit{strasse ? ", ohne Stopps" : ""}</span></div>
            <div className="flex flex-col justify-center gap-2 rounded-xl bg-cream p-3">
              {tour.length > 0 ? links.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="btn btn-or btn-sm">🚗 Route in Google Maps{links.length > 1 ? ` (Teil ${i + 1})` : ""}</a>
              )) : <span className="text-sm text-mut">Keine Stelle mit Kartenpunkt</span>}
            </div>
          </div>

          {tour.length > 0 && <div className="no-print mt-4"><Karte punkte={punkte} linie={linie} luftlinie={!strasse} className="h-[360px] md:h-[440px]" /></div>}

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <h2 className="text-xl font-bold">Reihenfolge</h2>
              <ol className="mt-2 grid gap-3">
                <li className="rounded-xl border border-line p-3 text-mut">Start: {HOF.name}, {HOF.adresse}</li>
                {tour.map((s, i) => (
                  <StoppKarte key={s.id} s={s} nr={i + 1} weg={abschnitte[i]} />
                ))}
                {tour.length > 0 && <li className="rounded-xl border border-line p-3 text-mut">Zurück zum Hof · <Weg w={abschnitte[tour.length]} /></li>}
              </ol>
              {ohnePunkt.length > 0 && (
                <>
                  <h2 className="mt-6 text-xl font-bold">Ohne Kartenpunkt</h2>
                  <p className="text-sm text-mut">Diese Stellen sind nicht in der Route. Unter Verkaufsstellen die Adresse eintragen, dann kommen sie automatisch dazu.</p>
                  <ol className="mt-2 grid gap-3">{ohnePunkt.map((s) => <StoppKarte key={s.id} s={s} />)}</ol>
                </>
              )}
            </div>
            <aside className="rounded-xl bg-cream p-4 lg:sticky lg:top-6">
              <h2 className="text-xl font-bold">Packliste</h2>
              <p className="text-sm text-mut">Alles zusammen fürs Auto</p>
              <table className="mt-2 w-full tnum">
                <tbody>
                  {packliste.map((p) => (
                    <tr key={p.name} className="border-b border-line">
                      <td className="py-1.5 pr-2"><span className="mr-2 inline-block h-4 w-4 rounded border-2 border-ink align-middle" aria-hidden />{p.name}</td>
                      <td className="py-1.5 text-right text-xl font-bold">{p.menge}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td className="pt-2 font-semibold">Gesamt</td><td className="pt-2 text-right text-xl font-bold">{summe}</td></tr></tfoot>
              </table>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

function Weg({ w }: { w?: { km: number; min: number | null } }) {
  if (!w) return null;
  return <>{w.km.toFixed(1).replace(".", ",")} km{w.min != null ? ` · ${dauer(w.min)}` : " Luftlinie"}</>;
}

function StoppKarte({ s, nr, weg }: { s: Stopp; nr?: number; weg?: { km: number; min: number | null } }) {
  return (
    <li className={`rounded-xl border-l-8 bg-cream p-3 ${s.schlimmste === "leer" ? "border-bad" : "border-warn"}`}>
      <div className="flex items-baseline gap-2">
        {nr != null && <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink text-sm font-bold text-white">{nr}</span>}
        <div className="min-w-0 flex-1">
          <b className="text-lg">{s.name}</b> <span className="text-sm text-mut">{s.typ}</span>
          <div className="text-sm text-mut">{s.adresse || "Adresse fehlt"}{weg && <> · <Weg w={weg} /></>}</div>
        </div>
      </div>
      <ul className="mt-2">
        {s.pos.map((p) => (
          <li key={p.product_id} className="flex items-center gap-2 py-0.5">
            <span className="w-10 text-right text-lg font-bold tnum">{p.menge}×</span>
            <span className="min-w-0 flex-1">{p.name} <span className="text-sm text-mut tnum">({p.ist} / {p.soll})</span></span>
            {p.stufe !== "gut" && <span className={`pill ${STUFE[p.stufe].pill}`}>{STUFE[p.stufe].t}</span>}
          </li>
        ))}
      </ul>
      <form action={refill.bind(null, s.id, undefined)} className="no-print"><button className="btn btn-ghost btn-sm mt-2">Hier alles aufgefüllt</button></form>
    </li>
  );
}
