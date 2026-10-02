import { db } from "@/lib/supabase";
import { meldebestand } from "@/lib/format";
import { refill } from "../../actions";

type R = { ist: number; soll: number; location_id: string; product_id: string; locations: { name: string; typ: string; ort: string | null; active: boolean }; products: { name: string } };

export default async function Nachfuellen() {
  const { data } = await db()
    .from("location_products")
    .select("ist, soll, location_id, product_id, locations!inner(name, typ, ort, active), products!inner(name)")
    .eq("locations.active", true)
    .returns<R[]>();
  const rows = (data ?? []).sort((a, b) => a.locations.name.localeCompare(b.locations.name, "de") || a.products.name.localeCompare(b.products.name, "de"));
  const low = rows.filter((r) => r.ist <= meldebestand(r.soll));
  const groups = new Map<string, R[]>();
  for (const r of low) groups.set(r.location_id, [...(groups.get(r.location_id) ?? []), r]);

  return (
    <>
      <h1 className="text-3xl font-bold">Nachfüllen</h1>
      <p className="max-w-3xl font-txt text-mut">Jeder Verkauf bucht den Bestand ab. Fällt ein Produkt auf 30 % vom Soll, kommt eine E-Mail und es steht hier. Nach dem Auffüllen einfach abhaken.</p>
      {groups.size === 0 && <div className="mt-4 rounded-xl bg-cream p-4">Alles aufgefüllt. Gerade muss nirgends etwas hin.</div>}
      <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {[...groups.values()].map((g) => (
          <div key={g[0].location_id} className="rounded-xl bg-cream p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-mut">{g[0].locations.typ}</div>
            <h2 className="text-xl font-bold">{g[0].locations.name}</h2>
            {g[0].locations.ort && <div className="text-sm text-mut">{g[0].locations.ort}</div>}
            <div className="mt-2">
              {g.map((r) => (
                <div key={r.product_id} className="grid grid-cols-[minmax(0,1fr)_48px_56px_auto] items-center gap-2 py-1">
                  <span className="truncate">{r.products.name}</span>
                  <span className="h-2 overflow-hidden rounded bg-line"><i className="block h-full bg-warn" style={{ width: `${Math.round((r.ist / r.soll) * 100)}%` }} /></span>
                  <span className="text-right tnum">{r.ist} / {r.soll}</span>
                  <form action={refill.bind(null, r.location_id, r.product_id)}><button className="btn btn-ghost btn-sm">+{r.soll - r.ist}</button></form>
                </div>
              ))}
            </div>
            <form action={refill.bind(null, g[0].location_id, undefined)}><button className="btn btn-or mt-3 w-full">Alles aufgefüllt</button></form>
          </div>
        ))}
      </div>
      <h2 className="mt-8 text-xl font-bold">Alle Bestände</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full tnum">
          <thead><tr className="border-b-2 border-ink text-left text-sm text-mut"><th className="p-2">Verkaufsstelle</th><th className="p-2">Produkt</th><th className="p-2 text-right">Ist</th><th className="p-2 text-right">Soll</th><th className="p-2">Zustand</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.location_id + r.product_id} className="border-b border-[#f1e8d6]">
                <td className="p-2">{r.locations.name}</td><td className="p-2">{r.products.name}</td>
                <td className="p-2 text-right">{r.ist}</td><td className="p-2 text-right">{r.soll}</td>
                <td className="p-2">{r.ist < 1 ? <span className="pill bg-bad">leer</span> : r.ist <= meldebestand(r.soll) ? <span className="pill bg-warn">nachfüllen</span> : <span className="pill bg-ok">gut</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
