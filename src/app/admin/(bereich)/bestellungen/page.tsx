import Link from "next/link";
import { SendenKnopf } from "@/components/senden-knopf";
import { StornoForm } from "@/components/storno-form";
import { db } from "@/lib/supabase";
import { bestellNr, eur, produktLabel, stufe, type ProduktKurz } from "@/lib/format";
import { markTransferPaid } from "../../actions";

const STATUS: Record<string, { t: string; c: string }> = {
  paid: { t: "bezahlt", c: "bg-ok" }, cash: { t: "bar", c: "bg-[#5b6f83]" }, created: { t: "offen", c: "bg-[#9a948a]" },
  review: { t: "prüfen", c: "bg-warn" }, transfer: { t: "Überweisung offen", c: "bg-warn" }, transfer_paid: { t: "überwiesen", c: "bg-ok" }, refunded: { t: "erstattet", c: "bg-[#7a5c9a]" }, cancelled: { t: "abgebrochen", c: "bg-[#bbb]" },
  storniert: { t: "storniert", c: "bg-[#9a948a]" },
};

type W = { ist: number; soll: number; warn: number; locations: { name: string }; products: ProduktKurz };
type O = { id: string; nr: number; status: string; total_cents: number; gebuehr_cents: number; storno_grund: string | null; created_at: string; locations: { name: string; demo: boolean }; order_items: { name_snapshot: string; quantity: number }[] };

export default async function Bestellungen({ searchParams }: PageProps<"/admin/bestellungen">) {
  const sp = await searchParams;
  const loc = typeof sp.stelle === "string" ? sp.stelle : "";
  const st = typeof sp.status === "string" && sp.status in STATUS ? sp.status : "";
  // Suche nach Bestellnummer: „1023“, „2026-1023“ oder der ganze Verwendungszweck „2026-1023 Hotel Alpenrose“ aus dem Kontoauszug
  const suche = typeof sp.nr === "string" ? sp.nr.trim().slice(0, 40) : "";
  // Jahr (4 Ziffern mit Bindestrich danach) überspringen, die laufende Nummer zählt
  const nr = /(?:\b\d{4}\s*[-/]\s*)?(\d{1,9})/.exec(suche)?.[1];
  const { data: locations } = await db().from("locations").select("id, name").order("name");
  let q = db().from("orders").select("id, nr, status, total_cents, gebuehr_cents, storno_grund, created_at, locations!inner(name, demo), order_items(name_snapshot, quantity)").order("created_at", { ascending: false }).limit(200);
  if (loc) q = q.eq("location_id", loc);
  if (st) q = q.eq("status", st);
  if (nr) q = q.eq("nr", Number(nr));
  const { data } = await q.returns<O[]>();
  const orders = data ?? [];
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const { data: m } = await db().from("orders").select("status, total_cents, locations!inner(demo)").eq("locations.demo", false).in("status", ["paid", "cash", "transfer_paid"]).gte("created_at", month.toISOString());
  const { data: bestand } = await db().from("location_products").select("ist, soll, warn, locations!inner(name, active, demo), products!inner(name, zusatz, inhalt, einheit)").eq("locations.demo", false).eq("locations.active", true).returns<W[]>();
  const leer = (bestand ?? []).filter((r) => stufe(r.ist, r.warn) === "leer");
  const knapp = (bestand ?? []).filter((r) => stufe(r.ist, r.warn) === "knapp");
  const { count: offen } = await db().from("orders").select("id, locations!inner(demo)", { count: "exact", head: true }).eq("locations.demo", false).eq("status", "transfer");
  const sum = (s: string) => (m ?? []).filter((o) => o.status === s).reduce((a, o) => a + o.total_cents, 0);

  return (
    <>
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <Warnung farbe="bad" titel="Leer" leer="Nirgends leer." rows={leer} />
        <Warnung farbe="warn" titel="Minimum erreicht" leer="Nirgends knapp." rows={knapp} />
      </div>
      <h1 className="text-3xl font-bold">Bestellungen</h1>
      <p className="font-txt text-mut">Neue Zahlungen erscheinen hier, sobald der Server sie bei PayPal bestätigt hat.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{eur(sum("paid"))}</b><span className="text-sm text-mut">PayPal diesen Monat</span></div>
        <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{eur(sum("cash"))}</b><span className="text-sm text-mut">bar gemeldet diesen Monat</span></div>
        <div className="col-span-2 rounded-xl bg-cream p-3 md:col-span-1"><b className="block text-2xl tnum">{(m ?? []).length}</b><span className="text-sm text-mut">Käufe diesen Monat</span></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/admin/bestellungen?status=transfer" className={`btn btn-sm ${st === "transfer" ? "btn-or" : "btn-ghost"}`}>
          Offene Überweisungen{(offen ?? 0) > 0 && <span className="pill bg-warn">{offen}</span>}
        </Link>
        {(st || loc || suche) && <Link href="/admin/bestellungen" className="btn btn-ghost btn-sm">Alle zeigen</Link>}
      </div>
      <form className="mt-2 flex flex-wrap gap-2">
        <input name="nr" type="search" inputMode="text" defaultValue={suche} placeholder="Bestellnummer, z. B. 2026-1023" aria-label="Bestellnummer suchen"
          className="min-w-0 flex-1 basis-56 rounded-lg border border-line bg-paper px-2 py-1.5 text-[1.05rem]" />
        <select name="stelle" defaultValue={loc} className="rounded-lg border border-line bg-paper px-2 py-1.5">
          <option value="">Alle Verkaufsstellen</option>
          {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select name="status" defaultValue={st} className="rounded-lg border border-line bg-paper px-2 py-1.5">
          <option value="">Alle Status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm">Filtern</button>
      </form>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse tnum">
          <thead><tr className="border-b-2 border-ink text-left text-sm text-mut"><th className="p-2">Nr.</th><th className="p-2">Zeit</th><th className="p-2">Verkaufsstelle</th><th className="p-2">Positionen</th><th className="p-2 text-right">Betrag</th><th className="p-2">Status</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className={`border-b border-[#f1e8d6] ${o.status === "storniert" ? "text-mut" : ""}`}>
                <td className="whitespace-nowrap p-2">{bestellNr(o.nr, o.created_at)}</td>
                <td className="whitespace-nowrap p-2">{new Date(o.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}</td>
                <td className="p-2">{o.locations.name}{o.locations.demo && <span className="pill ml-1 bg-[#2f5d7c]">Demo</span>}</td>
                <td className="p-2">{o.order_items.map((i) => (i.quantity > 1 ? `${i.quantity} × ` : "") + i.name_snapshot).join(", ")}</td>
                <td className="p-2 text-right">{eur(o.total_cents)}{o.gebuehr_cents > 0 && <div className="whitespace-nowrap text-xs text-mut">+ {eur(o.gebuehr_cents)} PayPal Gebühr</div>}</td>
                <td className="p-2">
                  <span className={`pill ${STATUS[o.status]?.c}`}>{STATUS[o.status]?.t ?? o.status}</span>
                  {o.status === "transfer" && <form action={markTransferPaid.bind(null, o.id)} className="mt-1"><SendenKnopf arbeit="Wird gespeichert …">Geld ist da</SendenKnopf></form>}
                  {o.status === "storniert" && o.storno_grund && <div className="mt-1 text-xs">{o.storno_grund}</div>}
                  {["cash", "transfer", "transfer_paid"].includes(o.status) && <StornoForm id={o.id} />}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="p-3 text-mut">{nr ? `Keine Bestellung mit der Nummer ${nr} gefunden.` : "Keine Bestellungen für diesen Filter."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-mut">„offen“: PayPal geöffnet, aber nicht bezahlt. Wird nach 24 Stunden zu „abgebrochen“. „prüfen“: Betrag von PayPal passt nicht zur Bestellung, bitte im PayPal-Konto nachsehen. „Überweisung offen“: Gast will überweisen; kommt das Geld mit der Bestellnummer im Verwendungszweck an, „Geld ist da“ tippen. <Link className="underline" href="/admin/abrechnung">Zur Abrechnung</Link></p>
    </>
  );
}

function Warnung({ farbe, titel, leer, rows }: { farbe: "bad" | "warn"; titel: string; leer: string; rows: W[] }) {
  const aktiv = rows.length > 0;
  return (
    <Link href="/admin/nachfuellen" className={`block rounded-xl border-l-8 p-3 ${aktiv ? (farbe === "bad" ? "border-bad bg-[#f8e3e1]" : "border-warn bg-[#f7edd3]") : "border-ok bg-cream"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-lg">{titel}</b>
        <span className={`pill ${aktiv ? (farbe === "bad" ? "bg-bad" : "bg-warn") : "bg-ok"}`}>{rows.length}</span>
      </div>
      {aktiv ? (
        <ul className="mt-1 text-sm">
          {rows.slice(0, 6).map((r, i) => <li key={i}>{r.locations.name}: {produktLabel(r.products)} <span className="tnum text-mut">{r.ist} / {r.soll}</span></li>)}
          {rows.length > 6 && <li className="text-mut">und {rows.length - 6} weitere</li>}
        </ul>
      ) : <p className="mt-1 text-sm text-mut">{leer}</p>}
    </Link>
  );
}
