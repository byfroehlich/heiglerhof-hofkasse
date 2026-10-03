"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU } from "@/lib/menu";


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
<span className="truncate text-lg font-semibold">{aktuell?.label}</span>
        )}
        {(leer > 0 || knapp > 0) && (
          <Link href="/admin/nachfuellen" className="ml-auto flex flex-none gap-1" aria-label="Warnungen">
            {leer > 0 && <span className="rounded-full bg-bad px-2 text-sm font-bold text-white">{leer}</span>}
            {knapp > 0 && <span className="rounded-full bg-warn px-2 text-sm font-bold text-white">{knapp}</span>}
          </Link>
        )}
      </div>
      {/* Am Handy unten quer: mit dem Daumen erreichbar, statt oben links */}
      {!start && (
        <Link href="/admin" className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-line bg-cream px-4 pt-3 text-lg font-semibold active:bg-orl md:hidden"
          style={{ paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}>
          ‹ Zurück zum Start
        </Link>
      )}
    </>
  );
}
