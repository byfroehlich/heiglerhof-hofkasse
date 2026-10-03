"use client";

import { useState } from "react";

/** Kundenlink einer Verkaufsstelle: am Handy über „Teilen“ (WhatsApp, Mail …), sonst in die Zwischenablage. */
export function LinkTeilen({ url, name }: { url: string; name: string }) {
  const [ok, setOk] = useState(false);
  async function teilen() {
    if (navigator.share) {
      try { await navigator.share({ title: `${name} · Hofkasse`, url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* egal */ }
  }
  return (
    <button type="button" onClick={teilen} className="btn btn-ghost btn-sm">
      {ok ? "Kopiert ✓" : "Link teilen"}
    </button>
  );
}
