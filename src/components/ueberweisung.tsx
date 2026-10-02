"use client";

import { useState } from "react";
import { eur } from "@/lib/format";
import type { Ueberweisung } from "@/lib/checkout";

function Zeile({ label, wert, kopie }: { label: string; wert: string; kopie: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-3 border-b border-line py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-mut">{label}</div>
        <div className="break-all text-lg font-semibold tnum">{wert}</div>
      </div>
      <button type="button" className={`btn btn-sm ${ok ? "btn-ghost !text-ok" : "btn-or"}`}
        onClick={async () => { try { await navigator.clipboard.writeText(kopie); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* Zwischenablage gesperrt */ } }}>
        {ok ? "✓ kopiert" : "kopieren"}
      </button>
    </div>
  );
}

/** GiroCode als PNG speichern oder an die Banking-App teilen (klappt nicht bei jeder Bank). */
async function bildTeilen(svg: string, name: string) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = 800;
  c.getContext("2d")!.drawImage(img, 0, 0, 800, 800);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) return;
  const file = new File([blob], `${name}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }).catch(() => {}); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
}

export function UeberweisungInfo({ u }: { u: Ueberweisung }) {
  return (
    <div className="mt-6 rounded-xl border-2 border-or bg-cream p-4 text-left">
      <div className="text-xl font-bold">Jetzt bitte überweisen</div>
      <p className="mt-1 font-txt leading-relaxed">
        Öffnet eure Banking App und legt eine neue Überweisung an. Mit „kopieren“ holt ihr jeden Wert mit einem Tipp, dann einfach einfügen.
      </p>
      <div className="mt-3 rounded-lg bg-paper px-3">
        <Zeile label="Empfänger" wert={u.empfaenger} kopie={u.empfaenger} />
        <Zeile label="IBAN" wert={u.iban} kopie={u.iban.replace(/\s/g, "")} />
        {u.bic && <Zeile label="BIC" wert={u.bic} kopie={u.bic} />}
        <Zeile label="Betrag" wert={eur(u.betrag_cents)} kopie={(u.betrag_cents / 100).toFixed(2).replace(".", ",")} />
        <Zeile label="Verwendungszweck (bitte genau so)" wert={u.zweck} kopie={u.zweck} />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-or-d underline">GiroCode für ein zweites Gerät oder zum Speichern</summary>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="h-40 w-40 rounded bg-white" aria-label="GiroCode" dangerouslySetInnerHTML={{ __html: u.qr }} />
          <div className="max-w-xs text-sm text-mut">
            Mit einem anderen Handy oder Tablet scannen. Manche Banking Apps lesen den Code auch aus einem gespeicherten Bild.
            <button type="button" className="btn btn-ghost btn-sm mt-2 w-full" onClick={() => bildTeilen(u.qr, u.zweck.replace(/\s+/g, "-"))}>Als Bild speichern oder teilen</button>
          </div>
        </div>
      </details>
    </div>
  );
}
