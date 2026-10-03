import { db } from "@/lib/supabase";
import { SendenKnopf } from "@/components/senden-knopf";
import { refill } from "../../actions";
import { STUFE, produktLabel, stufe, type ProduktKurz } from "@/lib/format";

type R = { ist: number; soll: number; warn: number; location_id: string; product_id: string; locations: { name: string; typ: string; ort: string | null; active: boolean }; products: ProduktKurz };

export default async function Nachfuellen() {
  const { data } = await db()
    .from("location_products")
    .select("ist, soll, warn, location_id, product_id, locations!inner(name, typ, ort, active, demo), products!inner(name, zusatz, inhalt, einheit)")
    .eq("locations.active", true).eq("locations.demo", false) // Demo-Verkaufsstelle nie nachfüllen
    .returns<R[]>();
  const rows = (data ?? []).sort((a, b) => a.locations.name.localeCompare(b.locations.name, "de") || produktLabel(a.products).localeCompare(produktLabel(b.products), "de"));
  // Leere zuerst, dann knappe
  const low = rows.filter((r) => stufe(r.ist, r.warn) !== "gut").sort((a, b) => Number(a.ist > 0) - Number(b.ist > 0));
  const groups = new Map<string, R[]>();
  for (const r of low) groups.set(r.location_id, [...(groups.get(r.location_id) ?? []), r]);
  const nLeer = low.filter((r) => r.ist < 1).length;

  return (
    <>
      <h1 className="text-3xl font-bold">Nachfüllen</h1>
      <p className="max-w-3xl font-txt text-mut">Jeder Verkauf bucht den Bestand ab. Gelb: Minimum erreicht (Warnbestand oder weniger). Rot: leer. Bei beiden Stufen kommt je eine E-Mail und es steht hier. Den Warnbestand legt ihr je Verkaufsstelle unter „Verkaufsstellen“ fest. Nach dem Auffüllen einfach abhaken.</p>
      {groups.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="pill bg-bad">{nLeer} leer</span>
          <span className="pill bg-warn">{low.length - nLeer} Minimum erreicht</span>
        </div>
      )}
      {groups.size === 0 && <div className="mt-4 rounded-xl bg-cream p-4">Alles aufgefüllt. Gerade muss nirgends etwas hin.</div>}
      <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {[...groups.values()].map((g) => (
          <div key={g[0].location_id} className={`rounded-xl border-l-8 bg-cream p-4 ${g.some((r) => r.ist < 1) ? "border-bad" : "border-warn"}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-mut">{g[0].locations.typ}</div>
            <h2 className="text-xl font-bold">{g[0].locations.name}</h2>
            {g[0].locations.ort && <div className="text-sm text-mut">{g[0].locations.ort}</div>}
            <div className="mt-2">
              {g.map((r) => (
                <div key={r.product_id} className="grid grid-cols-[minmax(0,1fr)_48px_56px_auto] items-center gap-2 py-1">
                  <span className="min-w-0">{r.ist < 1 && <span className="pill mr-1 bg-bad">leer</span>}{produktLabel(r.products)}</span>
                  <span className="h-2 overflow-hidden rounded bg-line"><i className={`block h-full ${STUFE[stufe(r.ist, r.warn)].bar}`} style={{ width: `${Math.round((r.ist / r.soll) * 100)}%` }} /></span>
                  <span className="text-right tnum">{r.ist} / {r.soll}</span>
                  <form action={refill.bind(null, r.location_id, r.product_id)}><SendenKnopf>+{r.soll - r.ist}</SendenKnopf></form>
                </div>
              ))}
            </div>
            <form action={refill.bind(null, g[0].location_id, undefined)}><SendenKnopf className="btn btn-or mt-3 w-full" arbeit="Wird gespeichert …">Alles aufgefüllt</SendenKnopf></form>
          </div>
        ))}
      </div>
      <h2 className="mt-8 text-xl font-bold">Alle Bestände</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full tnum">
          <thead><tr className="border-b-2 border-ink text-left text-sm text-mut"><th className="p-2">Verkaufsstelle</th><th className="p-2">Produkt</th><th className="p-2 text-right">Ist</th><th className="p-2 text-right">Soll</th><th className="p-2 text-right">Warnen bei</th><th className="p-2">Zustand</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.location_id + r.product_id} className="border-b border-[#f1e8d6]">
                <td className="p-2">{r.locations.name}</td><td className="p-2">{produktLabel(r.products)}</td>
                <td className="p-2 text-right">{r.ist}</td><td className="p-2 text-right">{r.soll}</td><td className="p-2 text-right">{r.warn}</td>
                <td className="p-2"><span className={`pill ${STUFE[stufe(r.ist, r.warn)].pill}`}>{STUFE[stufe(r.ist, r.warn)].t}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
