"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { stellenReihenfolgeSpeichern } from "@/app/admin/actions";

type Stelle = { id: string; name: string; info: string };

/** Verkaufsstellen mit ▲ ▼ in die eigene Reihenfolge bringen. Gilt für „Sortieren: Eigene Reihenfolge“. */
export function StellenReihenfolge({ stellen }: { stellen: Stelle[] }) {
  const [liste, setListe] = useState(stellen);
  const [ordnen, setOrdnen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const schiebe = (i: number, d: -1 | 1) => setListe((l) => {
    const j = i + d; if (j < 0 || j >= l.length) return l;
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const fertig = () => start(async () => { await stellenReihenfolgeSpeichern(liste.map((s) => s.id)); setOrdnen(false); router.refresh(); });

  if (!ordnen) return <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setListe(stellen); setOrdnen(true); }}>↕ Reihenfolge ändern</button>;
  return (
    <div className="mt-2 flex max-w-3xl flex-col gap-2">
      {liste.map((s, i) => (
        <div key={s.id} className="flex min-h-[64px] items-center gap-3 rounded-xl border-2 border-dashed border-or bg-paper px-4 py-2">
          <span className="min-w-0 flex-1"><span className="block font-bold">{s.name}</span><span className="block text-sm text-mut">{s.info}</span></span>
          <span className="flex flex-none gap-1">
            <button type="button" aria-label={`${s.name} nach oben`} disabled={i === 0 || pending} onClick={() => schiebe(i, -1)} className="grid h-11 w-11 place-items-center rounded-lg bg-or text-xl text-white disabled:opacity-30">▲</button>
            <button type="button" aria-label={`${s.name} nach unten`} disabled={i === liste.length - 1 || pending} onClick={() => schiebe(i, 1)} className="grid h-11 w-11 place-items-center rounded-lg bg-or text-xl text-white disabled:opacity-30">▼</button>
          </span>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" className="btn btn-or" disabled={pending} onClick={fertig}>{pending ? "Speichern …" : "Fertig"}</button>
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOrdnen(false)}>Abbrechen</button>
      </div>
    </div>
  );
}
