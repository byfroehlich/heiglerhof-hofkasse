"use client";

import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

/** Sortierung und Filter als Auswahlfelder. Die Wahl wird im Cookie gemerkt (gilt beim nächsten Besuch). */
export function ListenSteuerung({ pfad, sort, filter, sortOptionen, filterOptionen, cookie }: {
  pfad: string; sort: string; filter: string; sortOptionen: Option[]; filterOptionen: Option[]; cookie: string;
}) {
  const router = useRouter();
  const setze = (s: string, f: string) => {
    document.cookie = `${cookie}=${encodeURIComponent(`${s}|${f}`)}; path=/admin; max-age=31536000; samesite=lax`;
    router.replace(`${pfad}?sort=${s}&filter=${f}`, { scroll: false });
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-1.5">Sortieren
        <select value={sort} onChange={(e) => setze(e.target.value, filter)} className="rounded-lg border border-line bg-paper px-2 py-1.5">
          {sortOptionen.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5">Zeigen
        <select value={filter} onChange={(e) => setze(sort, e.target.value)} className="rounded-lg border border-line bg-paper px-2 py-1.5">
          {filterOptionen.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </div>
  );
}
