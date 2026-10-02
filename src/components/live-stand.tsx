"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const TAKT = 15_000;

/** Hält die Admin-App aktuell: neu laden, sobald ein Kauf den Stand ändert (Abfrage, App im Vordergrund, Push). */
export function LiveStand() {
  const router = useRouter();
  const letzter = useRef<string | null>(null);
  const offen = useRef(false);

  useEffect(() => {
    let aus = false;
    async function pruefen() {
      if (aus || document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/admin/stand", { cache: "no-store" });
        if (!r.ok) return;
        const { v } = (await r.json()) as { v: string };
        if (letzter.current !== null && v !== letzter.current) offen.current = true;
        letzter.current = v;
      } catch {
        return;
      }
      // Nicht neu laden, solange jemand gerade etwas eintippt; beim nächsten Takt erneut versuchen.
      const el = document.activeElement;
      const tippt = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (offen.current && !tippt) {
        offen.current = false;
        router.refresh();
      }
    }
    pruefen();
    const t = setInterval(pruefen, TAKT);
    const sichtbar = () => pruefen();
    const nachricht = (e: MessageEvent) => { if (e.data?.typ === "stand") pruefen(); };
    document.addEventListener("visibilitychange", sichtbar);
    window.addEventListener("focus", sichtbar);
    navigator.serviceWorker?.addEventListener("message", nachricht);
    return () => {
      aus = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", sichtbar);
      window.removeEventListener("focus", sichtbar);
      navigator.serviceWorker?.removeEventListener("message", nachricht);
    };
  }, [router]);

  return null;
}
