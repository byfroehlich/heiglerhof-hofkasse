import QRCode from "qrcode";
import { headers } from "next/headers";
import { db } from "@/lib/supabase";
import { reactivateLocation } from "../../actions";
import { NewLocationForm, AssortToggle, StockInput, RemoveLocation } from "@/components/location-controls";

type L = { id: string; slug: string; name: string; typ: string; ort: string | null; active: boolean; archived_at: string | null; location_products: { product_id: string; ist: number; soll: number }[] };

export default async function Verkaufsstellen() {
  const h = await headers();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get("host")}`;
  const [{ data: locs }, { data: prods }, { data: counts }] = await Promise.all([
    db().from("locations").select("id, slug, name, typ, ort, active, archived_at, location_products(product_id, ist, soll)").order("name").returns<L[]>(),
    db().from("products").select("id, name, active").order("name"),
    db().from("orders").select("location_id"),
  ]);
  const orderCount = (id: string) => (counts ?? []).filter((o) => o.location_id === id).length;
  const active = (locs ?? []).filter((l) => l.active);
  const archived = (locs ?? []).filter((l) => !l.active);
  const qr = Object.fromEntries(await Promise.all(active.map(async (l) => [l.id, await QRCode.toString(`${base}/kasse/${l.slug}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" })])));

  return (
    <>
      <h1 className="text-3xl font-bold">Verkaufsstellen</h1>
      <p className="max-w-3xl font-txt text-mut">Jede Verkaufsstelle hat einen eigenen Link für ihren QR Code, ein eigenes Sortiment mit Ist- und Sollbestand und wird getrennt abgerechnet.</p>
      <NewLocationForm />
      <div className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
        {active.map((l) => {
          const lp = new Map(l.location_products.map((x) => [x.product_id, x]));
          return (
            <section key={l.id} className="min-w-0 rounded-xl bg-cream p-4">
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-mut">{l.typ}</div>
                  <h2 className="text-xl font-bold leading-tight">{l.name}</h2>
                  <div className="text-sm text-mut">{l.ort}</div>
                  <a href={`/kasse/${l.slug}`} target="_blank" className="mt-1 inline-block break-all rounded border border-line bg-paper px-1.5 font-mono text-sm">/kasse/{l.slug}</a>
                </div>
                <div className="h-20 w-20 flex-none bg-paper p-1" aria-label={`QR Code für ${l.name}`} dangerouslySetInnerHTML={{ __html: qr[l.id] }} />
              </div>
              <p className="mt-3 text-sm text-mut">Haken setzen, dann Ist (was gerade da ist) und Soll (was da sein soll) eintragen. Speichert beim Verlassen des Feldes.</p>
              <div className="mt-1 flex flex-col">
                {(prods ?? []).filter((p) => p.active || lp.has(p.id)).map((p) => {
                  const s = lp.get(p.id);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1">
                      <AssortToggle locationId={l.id} productId={p.id} name={p.name} on={!!s} />
                      {s && (
                        <span className="ml-auto flex items-center gap-1.5 text-sm text-mut">
                          Ist <StockInput locationId={l.id} productId={p.id} field="ist" value={s.ist} label={`Istbestand ${p.name}`} />
                          Soll <StockInput locationId={l.id} productId={p.id} field="soll" value={s.soll} label={`Sollbestand ${p.name}`} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <RemoveLocation id={l.id} name={l.name} orders={orderCount(l.id)} />
            </section>
          );
        })}
      </div>
      {archived.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Ehemalige Verkaufsstellen</h2>
          <p className="text-sm text-mut">Link ist abgeschaltet. Die Bestellungen bleiben für die Abrechnung erhalten.</p>
          <table className="mt-2 w-full">
            <tbody>
              {archived.map((l) => (
                <tr key={l.id} className="border-b border-[#f1e8d6]">
                  <td className="p-2">{l.name}</td><td className="p-2">{l.typ}</td>
                  <td className="p-2">entfernt am {l.archived_at ? new Date(l.archived_at).toLocaleDateString("de-DE") : ""}</td>
                  <td className="p-2 text-right"><form action={reactivateLocation.bind(null, l.id)}><button className="btn btn-ghost btn-sm">Wieder aktivieren</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
