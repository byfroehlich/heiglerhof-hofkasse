"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLocation, removeLocation, setAssortment, setStock } from "@/app/admin/actions";

export function NewLocationForm() {
  const [state, action, pending] = useActionState(createLocation, undefined);
  return (
    <form action={action} className="mt-4 grid items-end gap-3 rounded-xl bg-cream p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="field">Neue Verkaufsstelle<input name="name" required maxLength={80} placeholder="z. B. Ferienwohnung Bergblick" /></label>
      <label className="field">Art<select name="typ" defaultValue="Ferienwohnung"><option>Ferienwohnung</option><option>Hotel</option><option>Verkaufskasten</option><option>Laden</option></select></label>
      <label className="field">Ort<input name="ort" defaultValue="Nesselwang" maxLength={80} /></label>
      <button className="btn btn-or" disabled={pending}>Anlegen</button>
      {state?.error && <p className="text-bad md:col-span-4">{state.error}</p>}
      {state?.ok && <p className="text-ok md:col-span-4">{state.ok}. Jetzt Sortiment wählen und Bestand eintragen.</p>}
    </form>
  );
}

export function AssortToggle({ locationId, productId, name, on }: { locationId: string; productId: string; name: string; on: boolean }) {
  const [pending, start] = useTransition();
  const [checked, setChecked] = useState(on);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <label className="flex min-w-0 items-center gap-2">
      <input type="checkbox" className="h-5 w-5 flex-none accent-[var(--or)]" checked={checked} disabled={pending}
        aria-label={`${name} in diesem Sortiment`}
        onChange={(e) => {
          const v = e.target.checked;
          setChecked(v); setErr(null);
          start(async () => {
            const r = await setAssortment(locationId, productId, v);
            if (r?.error) { setChecked(!v); setErr(r.error); }
            router.refresh();
          });
        }} />
      <span className={`truncate ${checked ? "font-semibold" : "text-mut"}`}>{name}</span>
      {pending && <span className="text-xs text-mut">speichert …</span>}
      {err && <span className="text-xs text-bad">{err}</span>}
    </label>
  );
}

export function StockInput({ locationId, productId, field, value, label }: { locationId: string; productId: string; field: "ist" | "soll"; value: number; label: string }) {
  const [pending, start] = useTransition();
  const [v, setV] = useState(String(value));
  const [state, setState] = useState<"" | "ok" | "err">("");
  const router = useRouter();
  const save = () => {
    const n = parseInt(v);
    if (!Number.isFinite(n) || n === value) return;
    start(async () => {
      const r = await setStock(locationId, productId, field, n);
      setState(r?.error ? "err" : "ok");
      if (r?.error) setV(String(value));
      router.refresh();
    });
  };
  return (
    <input aria-label={label} title={state === "err" ? "Nicht gespeichert" : undefined} type="number" inputMode="numeric"
      min={field === "soll" ? 1 : 0} max={999} value={v} disabled={pending}
      onChange={(e) => { setV(e.target.value); setState(""); }}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`w-14 rounded border bg-paper px-1.5 py-1 text-right tnum ${state === "ok" ? "border-ok" : state === "err" ? "border-bad" : "border-line"}`} />
  );
}

export function RemoveLocation({ id, name, orders }: { id: string; name: string; orders: number }) {
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  if (!ask) return <button className="btn btn-ghost mt-3 w-full !border-[#e8b4ae] !text-bad" onClick={() => setAsk(true)}>Verkaufsstelle entfernen</button>;
  return (
    <div className="mt-3 rounded-lg bg-[#fbe9e7] p-3 leading-snug">
      <b>{name} wirklich entfernen?</b>
      <p className="mt-1 text-[15px]">
        {orders > 0
          ? `Der QR Code funktioniert danach nicht mehr. Die ${orders} Bestellungen bleiben in der Abrechnung, die Stelle lässt sich wieder aktivieren.`
          : "Es gibt noch keine Bestellungen. Die Stelle wird komplett gelöscht."}
      </p>
      <div className="mt-2 flex gap-2">
        <button className="btn flex-1 bg-bad text-white" disabled={pending} onClick={() => start(() => removeLocation(id))}>{orders > 0 ? "Ja, entfernen" : "Ja, löschen"}</button>
        <button className="btn btn-ghost flex-1" onClick={() => setAsk(false)}>Abbrechen</button>
      </div>
    </div>
  );
}
