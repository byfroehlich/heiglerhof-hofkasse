"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveProduct } from "@/app/admin/actions";
import { grundpreisText, type Einheit } from "@/lib/format";

export type EditorProduct = {
  id: string; name: string; zusatz: string; inhalt: number; einheit: Einheit;
  price: string; alkohol: string; farbe: string; foto: string | null;
};

const OUT = 800; // Kantenlänge des fertigen Fotos in Pixeln

export function ProductEditor({ product }: { product: EditorProduct }) {
  const [state, action, pending] = useActionState(saveProduct, undefined);
  const [src, setSrc] = useState<HTMLImageElement | null>(null);
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(product.foto);
  const [remove, setRemove] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [price, setPrice] = useState(product.price);
  const [inhalt, setInhalt] = useState(String(product.inhalt));
  const [einheit, setEinheit] = useState<Einheit>(product.einheit);
  const cv = useRef<HTMLCanvasElement>(null);

  function draw(target: HTMLCanvasElement, size: number) {
    if (!src) return;
    const c = target.getContext("2d")!;
    const turned = rot % 180 !== 0;
    const side = Math.min(turned ? src.height : src.width, turned ? src.width : src.height) / zoom;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#fff"; c.fillRect(0, 0, size, size);
    c.translate(size / 2, size / 2); c.scale(size / side, size / side); c.rotate((rot * Math.PI) / 180);
    c.drawImage(src, -src.width / 2, -src.height / 2);
  }
  useEffect(() => { if (cv.current) draw(cv.current, cv.current.width); });

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setInfo("Bitte ein Bild wählen."); return; }
    const img = new Image();
    img.onload = () => { setSrc(img); setRot(0); setZoom(1); setInfo(`Original ${Math.round(f.size / 1024)} KB`); };
    img.onerror = () => setInfo("Dieses Bildformat kann der Browser nicht lesen. Bitte als JPEG aufnehmen.");
    img.src = URL.createObjectURL(f);
  }

  function take() {
    const out = document.createElement("canvas");
    out.width = out.height = OUT;
    draw(out, OUT);
    out.toBlob((b) => {
      if (!b) return;
      setBlob(b); setPreview(URL.createObjectURL(b)); setSrc(null); setRemove(false);
      setInfo(`Verkleinert auf ${OUT} × ${OUT} px · ${Math.round(b.size / 1024)} KB`);
    }, "image/jpeg", 0.82);
  }

  const pc = Math.round(parseFloat(price.replace(",", ".")) * 100), ih = parseInt(inhalt);

  return (
    <form
      action={(fd) => { if (blob) fd.set("foto", blob, "foto.jpg"); if (remove) fd.set("foto_entfernen", "1"); return action(fd); }}
      className="mt-4 grid max-w-4xl gap-6 rounded-2xl border-2 border-or bg-cream p-4 md:grid-cols-[260px_minmax(0,1fr)] md:p-6"
    >
      <input type="hidden" name="id" value={product.id} />
      <div className="mx-auto w-full max-w-[260px]">
        <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-line bg-paper">
          {src ? <canvas ref={cv} width={520} height={520} className="h-full w-full" aria-label="Ausschnitt" />
            : preview && !remove ? (
              // eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau (blob:)
              <img src={preview} alt="Produktfoto" className="h-full w-full object-cover" />
            ) : <span className="text-mut">Noch kein Foto</span>}
        </div>
        <label className="btn btn-or mt-3 w-full cursor-pointer">
          📷 Foto aufnehmen oder wählen
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
        </label>
        {src && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-mut">
              <label htmlFor="zoom">Ausschnitt</label>
              <input id="zoom" type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="min-w-24 flex-1 accent-[var(--or)]" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRot((r) => (r + 90) % 360)}>↻ Drehen</button>
            </div>
            <button type="button" className="btn btn-or mt-2 w-full" onClick={take}>Foto übernehmen</button>
          </>
        )}
        {info && <p className="mt-2 text-sm text-mut">{info}</p>}
        {!src && preview && !remove && <button type="button" className="btn btn-ghost btn-sm mt-2 w-full" onClick={() => { setRemove(true); setBlob(null); }}>Foto entfernen</button>}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <label className="field">Name<input name="name" defaultValue={product.name} required maxLength={80} placeholder="z. B. Apfelchutney" /></label>
        <label className="field">Zusatz<input name="zusatz" defaultValue={product.zusatz} maxLength={120} placeholder="z. B. mit Zwiebeln und Ingwer" /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="field">Inhalt<input name="inhalt" type="number" min={1} value={inhalt} onChange={(e) => setInhalt(e.target.value)} required /></label>
          <label className="field">Einheit<select name="einheit" value={einheit} onChange={(e) => setEinheit(e.target.value as Einheit)}><option value="g">g</option><option value="ml">ml</option></select></label>
          <label className="field">Preis €<input name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">Alkohol % vol<input name="alkohol" inputMode="decimal" defaultValue={product.alkohol} placeholder="leer = ohne" /></label>
          <label className="field">Farbe ohne Foto<input name="farbe" type="color" defaultValue={product.farbe} className="h-11 p-1" /></label>
        </div>
        <p className="text-sm text-mut">{pc > 0 && ih > 0 ? `Grundpreis: ${grundpreisText(pc, ih, einheit)}` : "Grundpreis wird automatisch berechnet."}</p>
        {state?.error && <p className="rounded-lg bg-[#fbe9e7] p-3 text-bad">{state.error}</p>}
        {src && <p className="text-sm text-warn">Bitte erst „Foto übernehmen“ tippen.</p>}
        <button className="btn btn-or" disabled={pending || !!src}>{pending ? "Speichern …" : product.id ? "Änderungen speichern" : "Produkt anlegen"}</button>
      </div>
    </form>
  );
}
