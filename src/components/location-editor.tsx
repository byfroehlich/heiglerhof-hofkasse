"use client";

import { useActionState, useState, useTransition } from "react";
import { saveLocation, sucheAdresse } from "@/app/admin/actions";
import { PinKarte } from "./karte";

export type EditorLocation = {
  id: string; name: string; typ: string; strasse: string; plz: string; ort: string; hinweis: string;
  oeffentlich: boolean; demo: boolean; wiederverkaeufer: boolean; lat: number | null; lng: number | null;
  logo: string | null; werbung_bild: string | null; werbung_text: string; werbung_link: string;
};

/** Große Handyfotos schon im Browser verkleinern, damit der Upload klein bleibt. */
async function verkleinern(f: File, max: number, typ: "image/png" | "image/jpeg"): Promise<Blob> {
  if (f.size < 1_000_000) return f; // zwei Bilder zusammen bleiben so unter dem Upload-Limit von 3 MB
  const img = await createImageBitmap(f);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Bild"))), typ, 0.85));
}

function BildFeld({ titel, hilfe, name, url, max, typ, onBlob, onRemove }: {
  titel: string; hilfe: string; name: string; url: string | null; max: number; typ: "image/png" | "image/jpeg";
  onBlob: (b: Blob | null) => void; onRemove: (r: boolean) => void;
}) {
  const [vorschau, setVorschau] = useState(url);
  const [info, setInfo] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <div className="font-semibold">{titel}</div>
      <p className="text-sm text-mut">{hilfe}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="grid h-24 w-32 flex-none place-items-center overflow-hidden rounded-lg border border-line bg-cream">
          {vorschau
            // eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau (blob:)
            ? <img src={vorschau} alt="" className="max-h-full max-w-full object-contain" />
            : <span className="text-sm text-mut">kein Bild</span>}
        </div>
        <div className="flex flex-col gap-2">
          <label className="btn btn-ghost btn-sm cursor-pointer">
            📷 Bild wählen
            <input type="file" name={`${name}_wahl`} accept="image/jpeg,image/png,image/webp" className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const b = await verkleinern(f, max, typ);
                  onBlob(b); onRemove(false); setVorschau(URL.createObjectURL(b));
                  setInfo(`${Math.round(b.size / 1024)} KB, wird beim Speichern übernommen`);
                } catch { setInfo("Dieses Bild kann der Browser nicht lesen. Bitte JPEG oder PNG nehmen."); }
              }} />
          </label>
          {vorschau && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onBlob(null); onRemove(true); setVorschau(null); setInfo("wird beim Speichern entfernt"); }}>Entfernen</button>}
        </div>
      </div>
      {info && <p className="mt-1 text-sm text-mut">{info}</p>}
    </div>
  );
}

export function LocationEditor({ l }: { l: EditorLocation }) {
  const [state, action, pending] = useActionState(saveLocation, undefined);
  const [lat, setLat] = useState(l.lat);
  const [lng, setLng] = useState(l.lng);
  const [adr, setAdr] = useState({ strasse: l.strasse, plz: l.plz, ort: l.ort });
  const [suche, startSuche] = useTransition();
  const [geo, setGeo] = useState<string | null>(null);
  const [logo, setLogo] = useState<Blob | null>(null);
  const [logoWeg, setLogoWeg] = useState(false);
  const [bild, setBild] = useState<Blob | null>(null);
  const [bildWeg, setBildWeg] = useState(false);

  const adresse = [adr.strasse, [adr.plz, adr.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const setAdresse = (k: keyof typeof adr, v: string) => {
    setAdr((a) => ({ ...a, [k]: v }));
    // Adresse geändert: alter Punkt passt nicht mehr, beim Speichern wird neu gesucht
    setLat(null); setLng(null); setGeo(null);
  };

  return (
    <form
      action={(fd) => {
        fd.delete("logo_wahl"); fd.delete("werbung_bild_wahl");
        if (logo) fd.set("logo", logo, "logo"); if (logoWeg) fd.set("logo_entfernen", "1");
        if (bild) fd.set("werbung_bild", bild, "werbung"); if (bildWeg) fd.set("werbung_bild_entfernen", "1");
        return action(fd);
      }}
      className="mt-4 grid max-w-5xl gap-5"
    >
      <input type="hidden" name="id" value={l.id} />
      <input type="hidden" name="lat" value={lat ?? ""} />
      <input type="hidden" name="lng" value={lng ?? ""} />

      <section className="grid gap-3 rounded-2xl bg-cream p-4 md:grid-cols-2">
        <h2 className="text-xl font-bold md:col-span-2">Name und Art</h2>
        <label className="field">Name<input name="name" defaultValue={l.name} required maxLength={80} /></label>
        <label className="field">Art<select name="typ" defaultValue={l.typ}><option>Ferienwohnung</option><option>Hotel</option><option>Verkaufskasten</option><option>Laden</option></select></label>
        <label className="flex items-start gap-3 md:col-span-2">
          <input type="checkbox" name="oeffentlich" defaultChecked={l.oeffentlich} className="mt-1 h-5 w-5 flex-none accent-[var(--or)]" />
          <span><b>Öffentlich auf der Karte zeigen</b><br /><span className="text-sm text-mut">Ferienwohnungen besser nicht, dort kaufen nur die Gäste.</span></span>
        </label>
        <label className="flex items-start gap-3 md:col-span-2">
          <input type="checkbox" name="demo" defaultChecked={l.demo} className="mt-1 h-5 w-5 flex-none accent-[var(--or)]" />
          <span><b>Demo-Verkaufsstelle</b><br /><span className="text-sm text-mut">Zum Zeigen und Ausprobieren, der Link darf weitergegeben werden. Käufe hier zählen nirgends: nicht im Umsatz, nicht in der Abrechnung, keine Nachfüllwarnungen, nicht auf der Karte. PayPal hier besser ausschalten, dort fließt echtes Geld.</span></span>
        </label>
        <label className="flex items-start gap-3 md:col-span-2">
          <input type="checkbox" name="wiederverkaeufer" defaultChecked={l.wiederverkaeufer} className="mt-1 h-5 w-5 flex-none accent-[var(--or)]" />
          <span><b>Wiederverkäufer</b><br /><span className="text-sm text-mut">Kauft bei euch auf Rechnung und verkauft selbst. Keine Kundenkasse und kein Bestand in der App, dafür ein eigener Nachbestell-Link (unter Verkaufsstellen).</span></span>
        </label>
        <label className="field md:col-span-2">Hinweis für die Karte<input name="hinweis" defaultValue={l.hinweis} maxLength={200} placeholder="z. B. rund um die Uhr, an der Rezeption fragen" /></label>
      </section>

      <section className="grid gap-3 rounded-2xl bg-cream p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Adresse</h2>
          <label className="field">Straße und Hausnummer<input name="strasse" value={adr.strasse} onChange={(e) => setAdresse("strasse", e.target.value)} maxLength={120} autoComplete="off" /></label>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
            <label className="field">PLZ<input name="plz" value={adr.plz} onChange={(e) => setAdresse("plz", e.target.value)} inputMode="numeric" maxLength={5} /></label>
            <label className="field">Ort<input name="ort" value={adr.ort} onChange={(e) => setAdresse("ort", e.target.value)} maxLength={80} /></label>
          </div>
          <button type="button" className="btn btn-ghost" disabled={suche || adresse.length < 3}
            onClick={() => startSuche(async () => {
              const r = await sucheAdresse(adresse);
              if ("error" in r) setGeo(r.error);
              else { setLat(r.lat); setLng(r.lng); setGeo(`Gefunden: ${r.anzeige}`); }
            })}>
            {suche ? "Suche …" : "📍 Adresse auf der Karte suchen"}
          </button>
          {geo && <p className="text-sm text-mut">{geo}</p>}
          <p className="text-sm text-mut">
            {lat != null && lng != null
              ? `Punkt gesetzt (${lat.toFixed(5)}, ${lng.toFixed(5)}). Passt er nicht genau, den Marker ziehen oder in die Karte tippen.`
              : "Noch kein Punkt. Adresse suchen oder in die Karte tippen. Sonst wird beim Speichern automatisch gesucht."}
          </p>
        </div>
        <PinKarte lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); setGeo(null); }} />
      </section>

      <section className="grid gap-3 rounded-2xl bg-cream p-4 md:grid-cols-2">
        <h2 className="text-xl font-bold md:col-span-2">Partner (optional)</h2>
        <BildFeld titel="Logo des Partners" hilfe="Erscheint auf der Kassenseite neben unserem Logo und auf der Karte. PNG mit transparentem Hintergrund ist am schönsten."
          name="logo" url={l.logo} max={800} typ="image/png" onBlob={setLogo} onRemove={setLogoWeg} />
        <BildFeld titel="Werbebild" hilfe="Optional: ein Bild für die Werbung des Partners, z. B. Restaurant oder Angebot."
          name="werbung_bild" url={l.werbung_bild} max={1600} typ="image/jpeg" onBlob={setBild} onRemove={setBildWeg} />
        <label className="field md:col-span-2">Werbetext<textarea name="werbung_text" defaultValue={l.werbung_text} maxLength={300} rows={3}
          className="rounded-lg border border-line bg-paper p-2 text-[1.05rem] text-ink" placeholder="z. B. Unser Restaurant hat täglich ab 17 Uhr geöffnet. Tisch reservieren an der Rezeption." /></label>
        <label className="field md:col-span-2">Link (optional)<input name="werbung_link" defaultValue={l.werbung_link} maxLength={300} placeholder="www.beispiel.de" /></label>
        <p className="text-sm text-mut md:col-span-2">Die Werbung erscheint auf der Kassenseite unten und nach dem Bezahlen. Ohne Bild und Text wird nichts angezeigt.</p>
      </section>

      {state?.error && <p role="alert" className="rounded-lg bg-[#fbe9e7] p-3 text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-[#e6f0df] p-3 text-ok">{state.ok}</p>}
      <button className="btn btn-or md:w-72" disabled={pending}>{pending ? "Speichern …" : "Speichern"}</button>
    </form>
  );
}
