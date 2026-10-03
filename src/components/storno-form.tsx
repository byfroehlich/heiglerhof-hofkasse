"use client";

import { stornieren } from "@/app/admin/actions";
import { SendenKnopf } from "./senden-knopf";

/** Aufklappbar unter der Bestellung: Grund, Bestand zurück, Rückfrage. */
export function StornoForm({ id }: { id: string }) {
  return (
    <details className="mt-1 text-sm">
      <summary className="cursor-pointer text-mut underline">Stornieren</summary>
      <form action={stornieren.bind(null, id)} className="mt-2 flex min-w-48 flex-col gap-2 rounded-lg bg-cream p-2"
        onSubmit={(e) => { if (!confirm("Diesen Kauf wirklich stornieren? Er zählt dann nicht mehr im Umsatz.")) e.preventDefault(); }}>
        <label className="flex flex-col gap-1">Grund
          <input name="grund" defaultValue="Test" maxLength={100} className="rounded border border-line bg-paper px-2 py-1" />
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" name="zurueck" defaultChecked className="h-4 w-4 accent-[var(--or)]" />Bestand zurückbuchen</label>
        <SendenKnopf arbeit="Wird storniert …">Stornieren</SendenKnopf>
      </form>
    </details>
  );
}
