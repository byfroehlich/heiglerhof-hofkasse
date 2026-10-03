"use client";

import { useEffect, useState, useTransition } from "react";
import { pushAbmelden, pushAnmelden, pushArten, pushArtSetzen, pushSchluessel, pushTest } from "@/app/admin/actions";

const SW = "/admin-sw.js";

/** Service Worker für die Admin-App registrieren (Mitteilungen, Installierbarkeit). */
export function SwRegistrieren() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(SW, { scope: "/admin" }).catch(() => {});
  }, []);
  return null;
}

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Lage = "pruefen" | "geht-nicht" | "ios-installieren" | "blockiert" | "aus" | "an";
type InstallEvent = Event & { prompt: () => Promise<void> };

function geraetName() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Gerät";
  return `${os} · ${new Date().toLocaleDateString("de-DE")}`;
}

export function AppUndPush() {
  const [lage, setLage] = useState<Lage>("pruefen");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [arten, setArten] = useState({ kauf: true, knapp: true, leer: true, nachbestellung: true });
  const [msg, setMsg] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const sa = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const onPrompt = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    (async () => {
      await Promise.resolve();
      setIos(isIos); setStandalone(sa);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setLage(isIos && !sa ? "ios-installieren" : "geht-nicht"); return;
      }
      if (Notification.permission === "denied") { setLage("blockiert"); return; }
      const reg = await navigator.serviceWorker.register(SW, { scope: "/admin" });
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setEndpoint(sub.endpoint); setLage("an");
        const a = await pushArten(sub.endpoint);
        if (a) setArten(a); else setLage("aus"); // auf dem Server unbekannt
      } else setLage("aus");
    })().catch(() => setLage("geht-nicht"));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const einschalten = () => start(async () => {
    setMsg(null);
    const erlaubt = await Notification.requestPermission();
    if (erlaubt !== "granted") { setLage(erlaubt === "denied" ? "blockiert" : "aus"); return; }
    const reg = await navigator.serviceWorker.register(SW, { scope: "/admin" });
    await navigator.serviceWorker.ready;
    const key = await pushSchluessel();
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
    const r = await pushAnmelden(sub.toJSON(), geraetName());
    if (r?.error) { setMsg(r.error); return; }
    setEndpoint(sub.endpoint); setLage("an"); setArten({ kauf: true, knapp: true, leer: true, nachbestellung: true });
    setMsg("Eingeschaltet. Eine Probe-Mitteilung ist unterwegs.");
  });

  const ausschalten = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/admin");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await pushAbmelden(sub.endpoint); await sub.unsubscribe(); }
    setEndpoint(null); setLage("aus"); setMsg("Auf diesem Gerät ausgeschaltet.");
  });

  return (
    <section className="mt-6 max-w-2xl rounded-2xl bg-cream p-4 md:p-6">
      <h2 className="text-xl font-bold">App und Mitteilungen</h2>

      <div className="mt-3 rounded-xl bg-paper p-3">
        <div className="font-semibold">Als App auf dem Handy</div>
        {standalone ? (
          <p className="text-ok">✓ Läuft als App.</p>
        ) : install ? (
          <button className="btn btn-or mt-2" onClick={async () => { await install.prompt(); setInstall(null); }}>App installieren</button>
        ) : ios ? (
          <p className="font-txt text-mut">In Safari unten auf <b>Teilen</b> (Viereck mit Pfeil) tippen, dann <b>„Zum Home-Bildschirm“</b>. Danach die Hofkasse vom Home-Bildschirm öffnen.</p>
        ) : (
          <p className="font-txt text-mut">Im Browsermenü (⋮) <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b> wählen.</p>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-paper p-3">
        <div className="font-semibold">Push-Mitteilungen auf diesem Gerät</div>
        {lage === "pruefen" && <p className="text-mut">Wird geprüft …</p>}
        {lage === "ios-installieren" && <p className="font-txt text-mut">Auf dem iPhone gehen Mitteilungen nur in der App: erst wie oben zum Home-Bildschirm hinzufügen, die App von dort öffnen und hier einschalten (ab iOS 16.4).</p>}
        {lage === "geht-nicht" && <p className="font-txt text-mut">Dieser Browser kann keine Mitteilungen empfangen. Am besten Chrome auf Android oder die installierte App auf dem iPhone nehmen.</p>}
        {lage === "blockiert" && <p className="font-txt text-bad">Mitteilungen sind für diese Seite gesperrt. In den Einstellungen des Handys bei der App bzw. im Browser für diese Seite erlauben, dann neu laden.</p>}
        {lage === "aus" && <button className="btn btn-or mt-2" disabled={pending} onClick={einschalten}>🔔 Mitteilungen einschalten</button>}
        {lage === "an" && endpoint && (
          <>
            <p className="text-ok">✓ Eingeschaltet. Meldungen kommen bei:</p>
            <div className="mt-2 flex flex-col gap-2">
              {([["kauf", "jedem Kauf"], ["knapp", "Minimum erreicht (gelb)"], ["leer", "leer (rot)"], ["nachbestellung", "Nachbestellung eines Wiederverkäufers"]] as const).map(([k, t]) => (
                <label key={k} className="flex items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--or)]" checked={arten[k]} disabled={pending}
                    onChange={(e) => { const v = e.target.checked; setArten((a) => ({ ...a, [k]: v })); start(() => pushArtSetzen(endpoint, k, v)); }} />
                  {t}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await pushTest(endpoint); setMsg(r?.error ?? r?.ok ?? null); })}>Test schicken</button>
              <button className="btn btn-ghost btn-sm" disabled={pending} onClick={ausschalten}>Auf diesem Gerät ausschalten</button>
            </div>
          </>
        )}
        {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
      </div>
    </section>
  );
}
