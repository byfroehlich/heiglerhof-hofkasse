"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Bestellungen" },
  { href: "/admin/nachfuellen", label: "Nachfüllen" },
  { href: "/admin/tour", label: "Nachfülltour" },
  { href: "/admin/abrechnung", label: "Abrechnung" },
  { href: "/admin/produkte", label: "Produkte und Preise" },
  { href: "/admin/verkaufsstellen", label: "Verkaufsstellen" },
];

export function AdminNav({ leer, knapp }: { leer: number; knapp: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {items.map((i) => {
        const on = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
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
  );
}
