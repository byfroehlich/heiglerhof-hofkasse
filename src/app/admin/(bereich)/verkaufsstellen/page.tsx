import Link from "next/link";
import { qrSvg } from "@/lib/qr";
import { siteUrl } from "@/lib/site";
import { db } from "@/lib/supabase";
import { STUFE, stufe } from "@/lib/format";
import { reactivateLocation } from "../../actions";
import { NewLocationForm, AssortToggle, StockInput, RemoveLocation, Zahlarten } from "@/components/location-controls";

type L = { id: string; slug: string; name: string; typ: string; ort: string | null; strasse: string | null; plz: string | null; lat: number | null; oeffentlich: boolean; bar_aktiv: boolean; paypal_aktiv: boolean; active: boolean; archived_at: string | null; location_products: { product_id: string; ist: number; soll: number; warn: number }[] };

export default async function Verkaufsstellen() {
  const base = await siteUrl();
  const [{ data: locs }, { data: prods }, { data: counts }] = await Promise.all([
    db().from("locations").select("id, slug, name, typ, ort, strasse, plz, lat, oeffentlich, bar_aktiv, paypal_aktiv, active, archived_at, location_products(product_id, ist, soll, warn)").order("name").returns<L[]>(),
    db().from("products").select("id, name, active").order("name"),
    db().from("orders").select("location_id"),
  ]);
  const orderCount = (id: string) => (counts ?? []).filter((o) => o.location_id === id).length;
  const active = (locs ?? []).filter((l) => l.active);
  const archived = (locs ?? []).filter((l) => !l.active);
  const qr = Object.fromEntries(active.map((l) => [l.id, qrSvg(`${base}/kasse/${l.slug}`)]));

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
                  <div className="text-sm text-mut">{[l.strasse, [l.plz, l.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Adresse fehlt"}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-xs">
                    {l.lat == null ? <span className="pill bg-warn">kein Kartenpunkt</span> : l.oeffentlich ? <span className="pill bg-ok">auf der Karte</span> : <span className="pill bg-[#9a948a]">nicht öffentlich</span>}
                  </div>
                  <Link href={`/admin/verkaufsstellen/${l.id}`} className="btn btn-ghost btn-sm mt-1 mr-1">Adresse und Partner</Link>
                  <a href={`/kasse/${l.slug}`} target="_blank" className="mt-1 inline-block break-all rounded border border-line bg-paper px-1.5 font-mono text-sm">/kasse/{l.slug}</a>
                </div>
                <Link href={`/admin/verkaufsstellen/${l.id}`} className="flex flex-none flex-col items-center gap-1 text-xs text-or-d underline" title="Bearbeiten: Adresse, Karte, Partner, QR Code">
                  <span className="block h-24 w-24 rounded bg-paper" aria-label={`QR Code für ${l.name}`} dangerouslySetInnerHTML={{ __html: qr[l.id] }} />
                  Bearbeiten · QR
                </Link>
              </div>
              <Zahlarten locationId={l.id} bar={l.bar_aktiv} paypal={l.paypal_aktiv} />
              <p className="mt-3 text-sm text-mut">Haken setzen, dann eintragen: Ist (was gerade da ist), Soll (was da sein soll) und „Warnen bei“ (ab dieser Menge oder weniger kommt eine Nachfüllmeldung). Speichert beim Verlassen des Feldes.</p>
              <div className="mt-1 flex flex-col">
                {(prods ?? []).filter((p) => p.active || lp.has(p.id)).map((p) => {
                  const s = lp.get(p.id);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1">
                      <AssortToggle locationId={l.id} productId={p.id} name={p.name} on={!!s} />
                      {s && (
                        <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5 text-sm text-mut">
                          {stufe(s.ist, s.warn) !== "gut" && <span className={`pill ${STUFE[stufe(s.ist, s.warn)].pill}`}>{STUFE[stufe(s.ist, s.warn)].t}</span>}
                          Ist <StockInput locationId={l.id} productId={p.id} field="ist" value={s.ist} label={`Istbestand ${p.name}`} />
                          Soll <StockInput locationId={l.id} productId={p.id} field="soll" value={s.soll} label={`Sollbestand ${p.name}`} />
                          Warnen bei <StockInput locationId={l.id} productId={p.id} field="warn" value={s.warn} label={`Warnbestand ${p.name}`} />
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
