"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const MENU = [
  { href: "/admin/bestellungen", label: "Bestellungen", icon: "🧾", info: "Alle Käufe, Überweisungen bestätigen" },
  { href: "/admin/nachfuellen", label: "Nachfüllen", icon: "📦", info: "Was wo fehlt, abhaken" },
  { href: "/admin/tour", label: "Nachfülltour", icon: "🚗", info: "Beste Route mit Packliste" },
  { href: "/admin/abrechnung", label: "Abrechnung", icon: "💶", info: "Umsatz je Verkaufsstelle und Monat" },
  { href: "/admin/produkte", label: "Produkte und Preise", icon: "🍯", info: "Anlegen, Fotos, Preise" },
  { href: "/admin/verkaufsstellen", label: "Verkaufsstellen", icon: "📍", info: "Sortiment, Bestand, Zahlarten, Schild" },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: "⚙️", info: "Bankdaten, App und Mitteilungen" },
] as const;

/** Seitenleiste am Computer. Am Handy führt das Logo zum Startbildschirm mit großen Knöpfen. */
export function AdminNav({ leer, knapp }: { leer: number; knapp: number }) {
  const path = usePathname();
  const start = path === "/admin";
  const aktuell = MENU.find((i) => path.startsWith(i.href));
  return (
    <>
      <nav className="hidden md:flex md:flex-col md:gap-1">
        {MENU.map((i) => {
          const on = path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-[17px] ${on ? "bg-or font-semibold text-white" : "text-ink hover:bg-orl"}`}>
              {i.label}
              {i.href === "/admin/nachfuellen" && leer > 0 && <span title="leer" className="ml-1.5 rounded-full bg-bad px-1.5 text-xs font-bold text-white">{leer}</span>}
              {i.href === "/admin/nachfuellen" && knapp > 0 && <span title="Minimum erreicht" className="ml-1 rounded-full bg-warn px-1.5 text-xs font-bold text-white">{knapp}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
        {start ? <span className="text-xl font-bold">Hofkasse</span> : (
          <>
            <Link href="/admin" className="btn btn-ghost btn-sm flex-none">‹ Start</Link>
            <span className="truncate text-lg font-semibold">{aktuell?.label}</span>
          </>
        )}
        {(leer > 0 || knapp > 0) && (
          <Link href="/admin/nachfuellen" className="ml-auto flex flex-none gap-1" aria-label="Warnungen">
            {leer > 0 && <span className="rounded-full bg-bad px-2 text-sm font-bold text-white">{leer}</span>}
            {knapp > 0 && <span className="rounded-full bg-warn px-2 text-sm font-bold text-white">{knapp}</span>}
          </Link>
        )}
      </div>
    </>
  );
}
