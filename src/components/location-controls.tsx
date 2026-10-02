"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLocation, removeLocation, setAssortment, setStock, setZahlart } from "@/app/admin/actions";

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

export function StockInput({ locationId, productId, field, value, label }: { locationId: string; productId: string; field: "ist" | "soll" | "warn"; value: number; label: string }) {
  const [pending, start] = useTransition();
  const [v, setV] = useState(String(value));
  const [state, setState] = useState<"" | "ok" | "err">("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const save = () => {
    const n = parseInt(v);
    if (!Number.isFinite(n) || n === value) return;
    start(async () => {
      const r = await setStock(locationId, productId, field, n);
      setState(r?.error ? "err" : "ok");
      setMsg(r?.error ?? null);
      if (r?.error) setV(String(value));
      router.refresh();
    });
  };
  return (
    <>
    <input aria-label={label} title={msg ?? undefined} type="number" inputMode="numeric"
      min={field === "soll" ? 1 : 0} max={999} value={v} disabled={pending}
      onChange={(e) => { setV(e.target.value); setState(""); setMsg(null); }}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`w-14 rounded border bg-paper px-1.5 py-1 text-right tnum ${state === "ok" ? "border-ok" : state === "err" ? "border-bad" : "border-line"}`} />
    {msg && <span role="alert" className="basis-full text-right text-xs text-bad">{msg}</span>}
    </>
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

export function Zahlarten({ locationId, bar, paypal }: { locationId: string; bar: boolean; paypal: boolean }) {
  const [state, setState] = useState({ bar, paypal });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = (art: "bar" | "paypal") => {
    const v = !state[art];
    if (!v && !state[art === "bar" ? "paypal" : "bar"]) { setErr("Mindestens eine Zahlart muss an bleiben."); return; }
    setState((s) => ({ ...s, [art]: v })); setErr(null);
    start(async () => {
      const r = await setZahlart(locationId, art, v);
      if (r?.error) { setState((s) => ({ ...s, [art]: !v })); setErr(r.error); }
      router.refresh();
    });
  };
  return (
    <div className="mt-3 rounded-lg bg-paper p-2">
      <div className="text-sm text-mut">Zahlarten an dieser Stelle</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {(["paypal", "bar"] as const).map((art) => (
          <button key={art} type="button" role="switch" aria-checked={state[art]} disabled={pending} onClick={() => toggle(art)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[15px] font-semibold ${state[art] ? "border-ok bg-[#e6f0df] text-ok" : "border-line bg-cream text-mut"}`}>
            <span className={`relative h-5 w-9 rounded-full transition ${state[art] ? "bg-ok" : "bg-[#cfc6b6]"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${state[art] ? "left-[18px]" : "left-0.5"}`} />
            </span>
            {art === "paypal" ? "PayPal" : "Bar"} {state[art] ? "an" : "aus"}
          </button>
        ))}
      </div>
      {err && <p role="alert" className="mt-1 text-sm text-bad">{err}</p>}
    </div>
  );
}
