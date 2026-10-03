"use client";

import { useRef, useState } from "react";

/**
 * Öffnet die Kasse einer Verkaufsstelle als Popup über dem Admin.
 * In der installierten App gibt es keine Browserleiste; ein normaler Link würde die App „verlassen“.
 */
export function KassenVorschau({ pfad, name, className, children }: { pfad: string; name: string; className?: string; children: React.ReactNode }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // Vorführmodus ist voreingestellt: Käufe zum Zeigen landen nicht in Bestand und Statistik
  const [vorf, setVorf] = useState(true);
  const laden = (v: boolean) => { if (frame.current) frame.current.src = v ? `${pfad}?vorfuehren=1` : pfad; };
  return (
    <>
      <button type="button" className={className} onClick={() => {
        laden(vorf); // jedes Mal frisch laden
        dlg.current?.showModal();
      }}>
        {children}
      </button>
      <dialog ref={dlg} aria-label={`Kasse ${name}`}
        className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-paper p-0 backdrop:bg-black/50 md:m-auto md:h-[90dvh] md:w-[440px] md:rounded-2xl"
        onClose={() => { if (frame.current) frame.current.src = "about:blank"; }}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-line bg-cream px-3 py-2" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
            <span className="min-w-0 flex-1 text-sm leading-tight"><span className="block truncate text-mut">Kasse · {name}</span>{vorf ? <span className="block text-xs text-[#2f5d7c]">Vorführmodus: nichts wird gebucht.</span> : <span className="block text-xs text-bad">Wie beim Gast: Käufe hier sind echt.</span>}</span>
            <label className="flex flex-none items-center gap-1.5 text-sm font-semibold">
              <input type="checkbox" checked={vorf} onChange={(e) => { setVorf(e.target.checked); laden(e.target.checked); }} className="h-5 w-5 accent-[var(--or)]" />
              Vorführen
            </label>
            <button type="button" className="btn btn-or btn-sm" onClick={() => dlg.current?.close()} autoFocus>✕ Schließen</button>
          </div>
          <iframe ref={frame} title={`Kasse ${name}`} className="w-full flex-1 border-0" />
        </div>
      </dialog>
    </>
  );
}
