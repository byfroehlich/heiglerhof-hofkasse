import Link from "next/link";
import { db } from "@/lib/supabase";
import { eur } from "@/lib/format";

function monthRange(key: string | undefined) {
  const now = new Date();
  const [y, m] = key && /^\d{4}-\d{2}$/.test(key) ? key.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const from = new Date(Date.UTC(y, m - 1, 1)), to = new Date(Date.UTC(y, m, 1));
  return { key: `${y}-${String(m).padStart(2, "0")}`, from, to, label: from.toLocaleString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

export default async function Abrechnung({ searchParams }: PageProps<"/admin/abrechnung">) {
  const sp = await searchParams;
  const r = monthRange(typeof sp.monat === "string" ? sp.monat : undefined);
  const { data: locations } = await db().from("locations").select("id, name, typ, active").order("name");
  const { data: orders } = await db().from("orders").select("location_id, status, total_cents, gebuehr_cents").in("status", ["paid", "cash", "transfer_paid"]).gte("created_at", r.from.toISOString()).lt("created_at", r.to.toISOString());
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return monthRange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); });
  const rows = (locations ?? []).map((l) => {
    const os = (orders ?? []).filter((o) => o.location_id === l.id);
    const pp = os.filter((o) => o.status === "paid").reduce((a, o) => a + o.total_cents, 0);
    const bar = os.filter((o) => o.status === "cash").reduce((a, o) => a + o.total_cents, 0);
    const ue = os.filter((o) => o.status === "transfer_paid").reduce((a, o) => a + o.total_cents, 0);
    return { ...l, n: os.length, pp, bar, ue };
  }).filter((l) => l.active || l.n > 0);
  const gebuehren = (orders ?? []).filter((o) => o.status === "paid").reduce((a, o) => a + o.gebuehr_cents, 0);
  const t = rows.reduce((a, l) => ({ n: a.n + l.n, pp: a.pp + l.pp, bar: a.bar + l.bar, ue: a.ue + l.ue }), { n: 0, pp: 0, bar: 0, ue: 0 });

  return (
    <>
      <h1 className="text-3xl font-bold">Abrechnung</h1>
      <p className="font-txt text-mut">Umsatz je Verkaufsstelle für {r.label}. Offene, abgebrochene und zu prüfende Zahlungen zählen nicht mit, Überweisungen erst nach „Geld ist da“.</p>
      <form className="mt-4 flex gap-2">
        <select name="monat" defaultValue={r.key} className="rounded-lg border border-line bg-paper px-2 py-1.5">
          {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm">Anzeigen</button>
      </form>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full tnum">
          <thead><tr className="border-b-2 border-ink text-left text-sm text-mut"><th className="p-2">Verkaufsstelle</th><th className="p-2">Art</th><th className="p-2 text-right">Käufe</th><th className="p-2 text-right">PayPal</th><th className="p-2 text-right">Bar</th><th className="p-2 text-right">Überweisung</th><th className="p-2 text-right">Summe</th><th className="p-2"></th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-[#f1e8d6]">
                <td className="p-2">{l.name} {!l.active && <span className="pill bg-[#9a948a]">ehemalig</span>}</td><td className="p-2">{l.typ}</td>
                <td className="p-2 text-right">{l.n}</td><td className="p-2 text-right">{eur(l.pp)}</td><td className="p-2 text-right">{eur(l.bar)}</td><td className="p-2 text-right">{eur(l.ue)}</td>
                <td className="p-2 text-right font-bold">{eur(l.pp + l.bar + l.ue)}</td>
                <td className="p-2"><Link className="btn btn-ghost btn-sm" href={`/admin/bestellungen?stelle=${l.id}`}>Bestellungen</Link></td>
              </tr>
            ))}
            <tr className="font-bold"><td className="p-2">Gesamt</td><td /><td className="p-2 text-right">{t.n}</td><td className="p-2 text-right">{eur(t.pp)}</td><td className="p-2 text-right">{eur(t.bar)}</td><td className="p-2 text-right">{eur(t.ue)}</td><td className="p-2 text-right">{eur(t.pp + t.bar + t.ue)}</td><td /></tr>
          </tbody>
        </table>
      </div>
      {gebuehren > 0 && <p className="mt-3 text-sm text-mut">Zusätzlich haben Gäste {eur(gebuehren)} PayPal Gebühr bezahlt. Die behält PayPal ein, deshalb zählt sie nicht zum Umsatz.</p>}
      <p className="mt-3 text-sm text-mut">Bar ist, was Gäste freiwillig melden. Den echten Kasseninhalt zählt ihr beim Nachfüllen.</p>
    </>
  );
}
