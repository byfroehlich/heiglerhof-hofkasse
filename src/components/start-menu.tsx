"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { menuSpeichern } from "@/app/admin/actions";
import type { MenuEintrag } from "@/lib/menu";

/** Große Knöpfe des Startbildschirms. „Anordnen“ schaltet Pfeile zum Verschieben ein. */
export function StartMenu({ menu, hinweis }: { menu: MenuEintrag[]; hinweis: Record<string, React.ReactNode> }) {
  const [liste, setListe] = useState(menu);
  const [ordnen, setOrdnen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const schiebe = (i: number, d: -1 | 1) => setListe((l) => {
    const j = i + d; if (j < 0 || j >= l.length) return l;
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const fertig = () => start(async () => { await menuSpeichern(liste.map((m) => m.href)); setOrdnen(false); router.refresh(); });

  return (
    <>
      <nav className="mt-5 flex flex-col gap-3" aria-label="Hauptmenü">
        {liste.map((m, i) => {
          const inhalt = (
            <>
              <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-orl text-2xl" aria-hidden>{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[22px] font-bold leading-tight">{m.label}</span>
                <span className="block text-sm text-mut">{m.info}</span>
                {!ordnen && hinweis[m.href] && <span className="mt-1 flex flex-wrap gap-1">{hinweis[m.href]}</span>}
              </span>
            </>
          );
          return ordnen ? (
            <div key={m.href} className="flex min-h-[72px] items-center gap-4 rounded-2xl border-2 border-dashed border-or bg-paper px-4 py-3">
              {inhalt}
              <span className="flex flex-none flex-col gap-1">
                <button type="button" aria-label={`${m.label} nach oben`} disabled={i === 0 || pending} onClick={() => schiebe(i, -1)} className="grid h-9 w-11 place-items-center rounded-lg bg-or text-xl text-white disabled:opacity-30">▲</button>
                <button type="button" aria-label={`${m.label} nach unten`} disabled={i === liste.length - 1 || pending} onClick={() => schiebe(i, 1)} className="grid h-9 w-11 place-items-center rounded-lg bg-or text-xl text-white disabled:opacity-30">▼</button>
              </span>
            </div>
          ) : (
            <Link key={m.href} href={m.href} className="flex min-h-[72px] items-center gap-4 rounded-2xl border-2 border-line bg-paper px-4 py-3 shadow-sm transition active:scale-[.98] active:bg-orl">
              {inhalt}
              <span className="text-3xl text-mut" aria-hidden>›</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-3 flex justify-center gap-2">
        {ordnen ? (
          <>
            <button type="button" className="btn btn-or" disabled={pending} onClick={fertig}>{pending ? "Speichern …" : "Fertig"}</button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => { setListe(menu); setOrdnen(false); }}>Abbrechen</button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOrdnen(true)}>↕ Knöpfe anordnen</button>
        )}
      </div>
    </>
  );
}
