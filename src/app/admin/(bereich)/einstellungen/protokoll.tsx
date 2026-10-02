import { db } from "@/lib/supabase";

const ART: Record<string, string> = { kauf: "Kauf", knapp: "Minimum", leer: "Leer", test: "Test" };

/** Die letzten Push-Mitteilungen mit Ergebnis, zur Fehlersuche. */
export async function PushProtokoll() {
  const { data, error } = await db().from("push_protokoll").select("zeit, art, titel, geraete, erreicht, fehler").order("zeit", { ascending: false }).limit(15);
  return (
    <section className="mt-6 max-w-2xl rounded-2xl bg-cream p-4 md:p-6">
      <h2 className="text-xl font-bold">Letzte Mitteilungen</h2>
      {error ? <p className="text-sm text-mut">Protokoll noch nicht eingerichtet (SQL 0008).</p> : !data?.length ? <p className="text-sm text-mut">Noch keine Mitteilung verschickt.</p> : (
        <ul className="mt-2 flex flex-col gap-2">
          {data.map((r, i) => (
            <li key={i} className="rounded-lg bg-paper p-2 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-mut tnum">{new Date(r.zeit).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}</span>
                <b>{ART[r.art] ?? r.art}</b>
                <span className={`pill ${r.erreicht > 0 ? "bg-ok" : "bg-bad"}`}>{r.erreicht} von {r.geraete} Geräten</span>
              </div>
              <div className="truncate">{r.titel}</div>
              {r.fehler && <div className="text-bad">{r.fehler}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
