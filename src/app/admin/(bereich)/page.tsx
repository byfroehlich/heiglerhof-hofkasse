import Link from "next/link";
import { db } from "@/lib/supabase";
import { eur } from "@/lib/format";

const STATUS: Record<string, { t: string; c: string }> = {
  paid: { t: "bezahlt", c: "bg-ok" }, cash: { t: "bar", c: "bg-[#5b6f83]" }, created: { t: "offen", c: "bg-[#9a948a]" },
  review: { t: "prüfen", c: "bg-warn" }, refunded: { t: "erstattet", c: "bg-[#7a5c9a]" }, cancelled: { t: "abgebrochen", c: "bg-[#bbb]" },
};

type O = { id: string; nr: number; status: string; total_cents: number; created_at: string; locations: { name: string }; order_items: { name_snapshot: string; quantity: number }[] };

export default async function Bestellungen({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const loc = typeof sp.stelle === "string" ? sp.stelle : "";
  const st = typeof sp.status === "string" && sp.status in STATUS ? sp.status : "";
  const { data: locations } = await db().from("locations").select("id, name").order("name");
  let q = db().from("orders").select("id, nr, status, total_cents, created_at, locations!inner(name), order_items(name_snapshot, quantity)").order("created_at", { ascending: false }).limit(200);
  if (loc) q = q.eq("location_id", loc);
  if (st) q = q.eq("status", st);
  const { data } = await q.returns<O[]>();
  const orders = data ?? [];
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const { data: m } = await db().from("orders").select("status, total_cents").in("status", ["paid", "cash"]).gte("created_at", month.toISOString());
  const sum = (s: string) => (m ?? []).filter((o) => o.status === s).reduce((a, o) => a + o.total_cents, 0);

  return (
    <>
      <h1 className="text-3xl font-bold">Bestellungen</h1>
      <p className="font-txt text-mut">Neue Zahlungen erscheinen hier, sobald der Server sie bei PayPal bestätigt hat.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{eur(sum("paid"))}</b><span className="text-sm text-mut">PayPal diesen Monat</span></div>
        <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{eur(sum("cash"))}</b><span className="text-sm text-mut">bar gemeldet diesen Monat</span></div>
        <div className="col-span-2 rounded-xl bg-cream p-3 md:col-span-1"><b className="block text-2xl tnum">{(m ?? []).length}</b><span className="text-sm text-mut">Käufe diesen Monat</span></div>
      </div>
      <form className="mt-5 flex flex-wrap gap-2">
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
              <tr key={o.id} className="border-b border-[#f1e8d6]">
                <td className="p-2">{o.nr}</td>
                <td className="whitespace-nowrap p-2">{new Date(o.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}</td>
                <td className="p-2">{o.locations.name}</td>
                <td className="p-2">{o.order_items.map((i) => (i.quantity > 1 ? `${i.quantity} × ` : "") + i.name_snapshot).join(", ")}</td>
                <td className="p-2 text-right">{eur(o.total_cents)}</td>
                <td className="p-2"><span className={`pill ${STATUS[o.status]?.c}`}>{STATUS[o.status]?.t ?? o.status}</span></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="p-3 text-mut">Keine Bestellungen für diesen Filter.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-mut">„offen“: PayPal geöffnet, aber nicht bezahlt. Wird nach 24 Stunden zu „abgebrochen“. „prüfen“: Betrag von PayPal passt nicht zur Bestellung, bitte im PayPal-Konto nachsehen. <Link className="underline" href="/admin/abrechnung">Zur Abrechnung</Link></p>
    </>
  );
}
