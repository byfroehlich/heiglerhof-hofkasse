import { db } from "@/lib/supabase";
import { eur } from "@/lib/format";
import { nbNr } from "@/lib/nachbestellung";
import { nachbestellStatus } from "../../actions";
import { SendenKnopf } from "@/components/senden-knopf";

type N = {
  id: string; nr: number; status: string; notiz: string | null; summe_cents: number; created_at: string; geliefert_am: string | null; erledigt_am: string | null;
  locations: { name: string; ort: string | null };
  positionen: { name_snapshot: string; menge: number; haendler_cents: number | null }[];
};

const STATUS: Record<string, { t: string; c: string }> = {
  offen: { t: "offen", c: "bg-warn" }, geliefert: { t: "geliefert, Rechnung offen", c: "bg-[#5b6f83]" },
  erledigt: { t: "erledigt", c: "bg-ok" }, storniert: { t: "storniert", c: "bg-[#9a948a]" },
};
const datum = (s: string) => new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export default async function Nachbestellungen({ searchParams }: PageProps<"/admin/nachbestellungen">) {
  const alle = (await searchParams).alle === "1";
  let q = db().from("nachbestellungen")
    .select("id, nr, status, notiz, summe_cents, created_at, geliefert_am, erledigt_am, locations!inner(name, ort), positionen:nachbestell_positionen(name_snapshot, menge, haendler_cents)")
    .order("created_at", { ascending: false }).limit(200);
  if (!alle) q = q.in("status", ["offen", "geliefert"]);
  const { data } = await q.returns<N[]>();
  const liste = data ?? [];
  const offen = liste.filter((n) => n.status === "offen").length;

  return (
    <>
      <h1 className="text-3xl font-bold">Nachbestellungen</h1>
      <p className="max-w-3xl font-txt text-mut">
        Wiederverkäufer bestellen über ihren eigenen Link nach, ohne zu bezahlen. Offene Nachbestellungen stehen auch in der Nachfülltour.
        Nach dem Liefern „Geliefert“ tippen, nach dem Schreiben der Rechnung „Erledigt“.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="/admin/nachbestellungen" className={`btn btn-sm ${alle ? "btn-ghost" : "btn-or"}`}>Offen und geliefert</a>
        <a href="/admin/nachbestellungen?alle=1" className={`btn btn-sm ${alle ? "btn-or" : "btn-ghost"}`}>Alle</a>
        {offen > 0 && <span className="pill self-center bg-warn">{offen} offen</span>}
      </div>
      {liste.length === 0 && <div className="mt-4 rounded-xl bg-cream p-4">{alle ? "Noch keine Nachbestellungen." : "Gerade ist nichts offen."}</div>}
      <div className="mt-4 grid max-w-3xl gap-3">
        {liste.map((n) => (
          <article key={n.id} className={`rounded-xl border-l-8 bg-cream p-4 ${n.status === "offen" ? "border-warn" : n.status === "geliefert" ? "border-[#5b6f83]" : "border-line"}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <b className="text-lg">{n.locations.name}</b>
              <span className="text-sm text-mut">{nbNr(n.nr)} · {datum(n.created_at)}</span>
              <span className={`pill ml-auto ${STATUS[n.status]?.c}`}>{STATUS[n.status]?.t ?? n.status}</span>
            </div>
            <ul className="mt-2">
              {n.positionen.map((p) => (
                <li key={p.name_snapshot} className="flex gap-2 py-0.5 tnum">
                  <span className="w-10 text-right text-lg font-bold">{p.menge}×</span>
                  <span className="min-w-0 flex-1">{p.name_snapshot}</span>
                  {p.haendler_cents != null && <span className="text-mut">{eur(p.haendler_cents * p.menge)}</span>}
                </li>
              ))}
            </ul>
            {n.summe_cents > 0 && <div className="mt-1 text-right font-bold tnum">Summe {eur(n.summe_cents)}</div>}
            {n.notiz && <p className="mt-2 rounded-lg bg-paper p-2 text-sm">Notiz: {n.notiz}</p>}
            {n.geliefert_am && <p className="mt-1 text-xs text-mut">geliefert {datum(n.geliefert_am)}{n.erledigt_am ? ` · erledigt ${datum(n.erledigt_am)}` : ""}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/admin/lieferschein/${n.id}?download=1`} download className="btn btn-ghost btn-sm">Lieferschein (PDF)</a>
              {n.status === "offen" && <form action={nachbestellStatus.bind(null, n.id, "geliefert")}><SendenKnopf className="btn btn-or btn-sm" arbeit="…">Geliefert</SendenKnopf></form>}
              {n.status === "geliefert" && <form action={nachbestellStatus.bind(null, n.id, "erledigt")}><SendenKnopf className="btn btn-or btn-sm" arbeit="…">Erledigt (Rechnung geschrieben)</SendenKnopf></form>}
              {n.status === "geliefert" && <form action={nachbestellStatus.bind(null, n.id, "offen")}><SendenKnopf arbeit="…">Doch noch offen</SendenKnopf></form>}
              {n.status === "offen" && <form action={nachbestellStatus.bind(null, n.id, "storniert")}><SendenKnopf arbeit="…">Stornieren</SendenKnopf></form>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
