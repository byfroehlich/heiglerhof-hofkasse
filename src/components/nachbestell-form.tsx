"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { eur } from "@/lib/format";
import type { NbOffen, NbProdukt } from "@/lib/nachbestellung";

const STATUS: Record<string, string> = { offen: "ist angekommen", geliefert: "ist geliefert" };

/** Nachbestellen für Wiederverkäufer: Mengen wählen, Notiz, abschicken. Bezahlt wird per Rechnung. */
export function NachbestellForm({ token, stelle, produkte, offen }: { token: string; stelle: string; produkte: NbProdukt[]; offen: NbOffen[] }) {
  const [menge, setMenge] = useState<Record<string, number>>({});
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);
  const lock = useRef(false);

  const zeilen = produkte.filter((p) => (menge[p.id] ?? 0) > 0);
  const stueck = zeilen.reduce((a, p) => a + menge[p.id], 0);
  const summe = zeilen.reduce((a, p) => a + (p.haendler_cents ?? 0) * menge[p.id], 0);
  const setze = (id: string, n: number) => setMenge((m) => ({ ...m, [id]: Math.max(0, Math.min(99, n)) }));

  async function senden() {
    if (lock.current || !zeilen.length) return;
    lock.current = true;
    flushSync(() => { setBusy(true); setErr(null); });
    try {
      const res = await fetch("/api/nachbestellen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, items: zeilen.map((p) => ({ product_id: p.id, menge: menge[p.id] })), notiz }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Das hat nicht geklappt.");
      setFertig(j.nr);
    } catch (e) { setErr((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }

  const Kopf = (
    <header className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3" style={{ paddingTop: "max(.75rem, env(safe-area-inset-top))" }}>
      <Image src="/logo@2x.png" alt="Heiglerhof" width={52} height={51} className="h-12 w-12" />
      <div className="min-w-0">
        <h1 className="font-brush text-3xl leading-none text-or">Nachbestellen</h1>
        <div className="truncate text-mut">{stelle}</div>
      </div>
    </header>
  );

  if (fertig) {
    return (
      <>{Kopf}
        <main className="mx-auto w-full max-w-xl px-4 pb-12 text-center">
          <div className="mx-auto mt-10 grid h-20 w-20 place-items-center rounded-full bg-ok text-4xl text-white">✓</div>
          <h2 className="mt-4 font-brush text-4xl text-or">Vergelt&apos;s Gott!</h2>
          <p className="mt-2 text-xl">Eure Nachbestellung {fertig} ist bei uns angekommen.</p>
          <p className="mt-1 font-txt text-mut">Wir bringen die Ware vorbei. Die Rechnung kommt wie gewohnt.</p>
          <button className="btn btn-ghost mt-6 w-full" onClick={() => window.location.reload()}>Noch etwas nachbestellen</button>
        </main>
      </>
    );
  }

  return (
    <>{Kopf}
      <main className="mx-auto w-full max-w-xl px-4 pb-44 pt-4">
        {offen.length > 0 && (
          <div className="mb-4 rounded-xl bg-orl p-3 text-sm">
            <b>Schon unterwegs:</b>
            {offen.map((o) => (
              <div key={o.nr} className="mt-1">N-{o.nr} vom {new Date(o.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} {STATUS[o.status] ?? ""}: {o.positionen.map((p) => `${p.menge}× ${p.name_snapshot}`).join(", ")}</div>
            ))}
          </div>
        )}
        <p className="font-txt text-mut">Einfach antippen, was ihr braucht. Bezahlt wird nicht hier, sondern wie gewohnt per Rechnung.</p>
        {produkte.length === 0 && <p className="mt-4 rounded-xl bg-cream p-4">Für euch ist noch kein Sortiment hinterlegt. Bitte beim Hof melden.</p>}
        <ul className="mt-3">
          {produkte.map((p) => {
            const n = menge[p.id] ?? 0;
            return (
              <li key={p.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#f1e8d6] py-3">
                {p.foto
                  ? <Image src={p.foto} alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
                  : <span className="h-14 w-14 rounded-lg" style={{ background: p.farbe }} aria-hidden />}
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{p.label}</div>
                  {p.haendler_cents != null && <div className="text-sm text-mut tnum">Händlerpreis {eur(p.haendler_cents)}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button aria-label={`${p.label} weniger`} disabled={n < 1} onClick={() => setze(p.id, n - 1)} className="grid h-10 w-10 place-items-center rounded-full border-2 border-or text-xl text-or disabled:opacity-30">−</button>
                  <input aria-label={`Menge ${p.label}`} inputMode="numeric" value={n || ""} placeholder="0"
                    onChange={(e) => setze(p.id, parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                    className="w-10 rounded border border-line bg-paper text-center text-lg font-bold tnum" />
                  <button aria-label={`${p.label} mehr`} disabled={n >= 99} onClick={() => setze(p.id, n + 1)} className="grid h-10 w-10 place-items-center rounded-full bg-or text-xl text-white disabled:opacity-30">+</button>
                </div>
              </li>
            );
          })}
        </ul>
        <label className="mt-4 flex flex-col gap-1">
          <span className="font-semibold">Notiz an den Hof (optional)</span>
          <textarea value={notiz} onChange={(e) => setNotiz(e.target.value.slice(0, 500))} rows={2} placeholder="z. B. bis Freitag, bitte bei der Rezeption abgeben"
            className="rounded-lg border border-line bg-paper p-2" />
        </label>
        {err && <div role="alert" className="mt-3 rounded-xl bg-[#fbe9e7] p-3 text-bad">{err}</div>}
      </main>
      <aside className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-xl">
          {summe > 0 && <p className="mb-2 text-center text-sm text-mut tnum">Summe Händlerpreis {eur(summe)}, Rechnung folgt</p>}
          <button className="btn btn-or w-full disabled:opacity-50" disabled={!stueck || busy} onClick={senden}>
            {busy ? "Wird gesendet …" : stueck ? `Nachbestellen · ${stueck} Stück` : "Produkt wählen"}
          </button>
        </div>
      </aside>
    </>
  );
}
