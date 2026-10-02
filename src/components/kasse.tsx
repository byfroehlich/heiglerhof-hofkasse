"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { eur, grundpreisText, inhaltText, alkoholText } from "@/lib/format";
import type { Location, Partner, ShopProduct } from "@/lib/shop";
import type { Receipt } from "@/lib/checkout";
import { paypalAufschlag, type PaypalGebuehr } from "@/lib/pricing";
import { UeberweisungInfo } from "./ueberweisung";

type Props = { location: Location; partner: Partner; products: ShopProduct[]; paypalClientId: string; gebuehr: PaypalGebuehr | null };
type Step = "list" | "sum" | "done";

function Werbung({ p, name }: { p: Partner; name: string }) {
  if (!p.bild && !p.text) return null;
  const inhalt = (
    <>
      {p.bild && (
        // eslint-disable-next-line @next/next/no-img-element -- Partnerbild aus dem Storage, schon verkleinert
        <img src={p.bild} alt={`Werbung ${name}`} className="w-full rounded-lg object-cover" loading="lazy" />
      )}
      {p.text && <p className="mt-2 whitespace-pre-line font-txt leading-relaxed">{p.text}</p>}
      {p.link && <span className="mt-1 inline-block text-or-d underline">Mehr erfahren</span>}
    </>
  );
  return (
    <aside className="mt-6 rounded-xl border border-line p-3 text-left" aria-label={`Tipp von ${name}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-mut">Tipp von {name}</div>
      {p.link ? <a href={p.link} target="_blank" rel="noopener noreferrer sponsored" className="block">{inhalt}</a> : inhalt}
    </aside>
  );
}

function Head({ title, sub, onBack, logo }: { title: string; sub: string; onBack?: () => void; logo?: string | null }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-paper px-4 py-3 md:px-10" style={{ paddingTop: "max(.75rem, env(safe-area-inset-top))" }}>
      {onBack && <button onClick={onBack} aria-label="Zurück" className="grid h-9 w-9 place-items-center rounded-full bg-cream text-2xl">‹</button>}
      <Image src="/logo@2x.png" alt="Handgemacht vom Heiglerhof" width={52} height={52} className="h-[52px] w-[52px] md:h-16 md:w-16" />
      <div className="min-w-0">
        <div className="font-brush text-[34px] leading-none text-or md:text-5xl">{title}</div>
        <div className="truncate text-sm text-mut">{sub}</div>
      </div>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- Partnerlogo aus dem Storage, schon verkleinert
        <img src={logo} alt="Logo unseres Partners" className="ml-auto h-12 max-w-28 flex-none object-contain md:h-16 md:max-w-40" />
      )}
    </header>
  );
}

export function Kasse({ location, partner, products, paypalClientId, gebuehr }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>("list");
  const [age, setAge] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Was gerade gebucht wird. Die Sperre (lock) greift sofort, auch bei schnellem Doppeltipp vor dem nächsten Rendern.
  const [busy, setBusy] = useState<null | "paypal" | "ueberweisung" | "bar">(null);
  const lock = useRef(false);
  const router = useRouter();
  const sperren = (art: "paypal" | "ueberweisung" | "bar") => {
    if (lock.current) return false;
    lock.current = true;
    flushSync(() => { setBusy(art); setErr(null); }); // sofort ausgrauen, bevor die Anfrage losgeht
    return true;
  };
  const freigeben = () => { lock.current = false; setBusy(null); };
  const [done, setDone] = useState<Receipt | null>(null);

  // Nie mehr in den Korb als gerade da ist, auch wenn der Bestand sich inzwischen geändert hat
  const lines = useMemo(() => products.map((p) => ({ p, q: Math.min(cart[p.id] ?? 0, p.ist) })).filter((l) => l.q > 0), [products, cart]);

  // Bestand frisch halten: alle 20 s und beim Zurückkehren auf die Seite, nur in der Auswahl
  const inAuswahl = useRef(true);
  useEffect(() => { inAuswahl.current = step === "list"; }, [step]);
  useEffect(() => {
    const neu = () => { if (document.visibilityState === "visible" && inAuswahl.current && !lock.current) router.refresh(); };
    const t = setInterval(neu, 20_000);
    document.addEventListener("visibilitychange", neu);
    window.addEventListener("pageshow", neu);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", neu); window.removeEventListener("pageshow", neu); };
  }, [router]);
  const count = lines.reduce((a, l) => a + l.q, 0);
  // Nur Anzeige. Bezahlt wird der Betrag, den der Server aus der Datenbank rechnet.
  const preview = lines.reduce((a, l) => a + l.p.price_cents * l.q, 0);
  // Nur Anzeige. Den echten Aufschlag rechnet der Server mit derselben Formel.
  const aufschlag = paypalAufschlag(preview, gebuehr);
  const hasAlc = lines.some((l) => l.p.alkohol);
  const blocked = hasAlc && !age;
  const body = () => ({ location: location.slug, items: lines.map((l) => ({ product_id: l.p.id, quantity: l.q })), ...(hasAlc ? { age_confirmed: age } : {}) });

  const change = (id: string, d: number, max: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(max, 10, (c[id] ?? 0) + d)) }));

  async function post<T>(url: string, data: unknown): Promise<T> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Das hat nicht geklappt.");
    return j as T;
  }

  async function bezahlen(art: "ueberweisung" | "bar") {
    if (!sperren(art)) return;
    try {
      const r = await post<Receipt>(art === "bar" ? "/api/checkout/cash" : "/api/checkout/transfer", body());
      setDone(r); setStep("done"); setCart({}); router.refresh(); // Bestand neu laden
    } catch (e) { setErr((e as Error).message); router.refresh(); }
    finally { freigeben(); }
  }

  // Alle aktiven Zahlarten gleichwertig nennen
  const arten = [location.paypal && "mit PayPal", location.ueberweisung && "per Überweisung", location.bar && "bar in die Kasse"].filter(Boolean) as string[];
  const liste = arten.length > 1 ? `${arten.slice(0, -1).join(", ")} oder ${arten[arten.length - 1]}` : arten[0] ?? "";
  const zahlweg = `zahlt hier ${liste}`;
  const andere = [location.ueberweisung && "per Überweisung", location.bar && "bar"].filter(Boolean) as string[];
  const oderBar = andere.length ? ` oder ${andere.join(" oder ")} zahlen` : "";
  const intro =
    location.typ === "Verkaufskasten"
      ? `Selbstbedienung direkt an unserer Hoftür. Nehmt euch, was ihr mögt, und ${zahlweg}.`
      : location.typ === "Hotel"
        ? `Handgemachtes vom Heiglerhof, ganz hier in der Nähe. Nehmt euch einfach etwas aus dem Regal und ${zahlweg}.`
        : "Ein paar unserer Schätze zum Probieren. Nehmt euch, was euch anlacht.";


  if (step === "done" && done) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-12 text-center">
        <div className="mx-auto mt-10 grid h-20 w-20 place-items-center rounded-full bg-ok text-4xl text-white">✓</div>
        <h1 className="mt-4 font-brush text-5xl text-or">Vergelt&apos;s Gott!</h1>
        <p className="mt-2 text-xl">
          {done.status === "cash" ? `Danke fürs Vertrauen · ${eur(done.total_cents)} in die Kasse` : done.status === "transfer" ? `Fast fertig · bitte ${eur(done.total_cents)} überweisen` : done.status === "paid" ? `Zahlung eingegangen · ${eur(done.total_cents + done.gebuehr_cents)}` : `Zahlung wird geprüft · ${eur(done.total_cents + done.gebuehr_cents)}`}
        </p>
        <p className="text-sm text-mut">Bestellung {done.ref}</p>
        {done.ueberweisung && <UeberweisungInfo u={done.ueberweisung} />}
        <div className="mt-6 rounded-xl bg-cream p-4 text-left">
          {done.items.map((i) => (
            <div key={i.label} className="flex justify-between py-1 tnum"><span>{i.quantity} × {i.label}</span><span>{eur(i.unit_price_cents * i.quantity)}</span></div>
          ))}
          {done.gebuehr_cents > 0 && <div className="flex justify-between py-1 text-mut tnum"><span>PayPal Gebühr</span><span>{eur(done.gebuehr_cents)}</span></div>}
        </div>
        <div className="mt-3 rounded-xl bg-cream p-4 text-left">
          <div className="text-xl font-bold">Hat&apos;s geschmeckt?</div>
          <p className="mt-1 font-txt leading-relaxed">
            {location.typ === "Verkaufskasten"
              ? "Für größere Mengen, andere Sorten oder Geschenke ruft uns einfach an. Wir richten euch gern was her."
              : "Mehr gibt's bei uns am Hof. Draußen steht unser Verkaufskasten, und nach Anruf richten wir euch gern auch größere Mengen her."}
          </p>
          <p className="mt-2"><b>Heiglerhof</b> · Wank 6, 87484 Nesselwang · Steffi 0176 9999 8727</p>
          <a className="btn btn-or mt-3 w-full" href="https://www.google.com/maps/search/?api=1&query=Wank+6,+87484+Nesselwang" target="_blank" rel="noopener noreferrer">Weg zum Hof</a>
        </div>
        <button className="btn btn-ghost mt-3 w-full" onClick={() => window.location.reload()}>Noch etwas nehmen</button>
        <Werbung p={partner} name={location.name} />
      </main>
    );
  }

  if (step === "sum") {
    return (
      <>
        <Head title="Eure Auswahl" sub={location.name} onBack={busy ? undefined : () => setStep("list")} />
        <main className="mx-auto w-full max-w-xl px-4 pb-12 pt-4">
          {lines.map((l) => (
            <div key={l.p.id} className="flex justify-between gap-3 py-1.5 text-lg tnum"><span>{l.q} × {l.p.label}</span><span>{eur(l.p.price_cents * l.q)}</span></div>
          ))}
          <div className="mt-2 flex justify-between border-t-2 border-ink pt-2 text-2xl font-bold tnum"><span>Gesamt</span><span>{eur(preview)}</span></div>
          <p className="text-sm text-mut">inkl. MwSt. Der Betrag wird beim Bezahlen vom Server aus den aktuellen Preisen berechnet.</p>
          {hasAlc && (
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-cream p-3 leading-snug">
              <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--or)]" />
              <span>Ich bin mindestens 18 Jahre alt. Liköre gibt es nur für Erwachsene.</span>
            </label>
          )}
          {err && <div className="mt-3 rounded-xl bg-[#fbe9e7] p-3 text-bad">{err}</div>}
          <h2 className="mt-5 text-lg font-semibold">Wie wollt ihr bezahlen?</h2>
          <div aria-busy={busy !== null} className={busy ? "pointer-events-none select-none" : ""}>
          {busy && <p role="status" className="mt-2 flex items-center gap-2 rounded-xl bg-orl p-3 font-semibold"><span className="h-4 w-4 animate-spin rounded-full border-2 border-or border-t-transparent" aria-hidden />Wird gebucht, bitte kurz warten …</p>}
          {location.paypal && aufschlag > 0 && (
            <div className="mt-2 rounded-xl bg-cream p-3 leading-snug">
              <div className="flex justify-between tnum"><span>Mit PayPal</span><span>{eur(preview)} + {eur(aufschlag)} Gebühr</span></div>
              <div className="flex justify-between font-bold tnum"><span>Ihr zahlt mit PayPal</span><span>{eur(preview + aufschlag)}</span></div>
              <p className="mt-1 text-sm text-mut">
                PayPal berechnet uns für jede Zahlung eine Gebühr. Die geben wir genau so weiter, ohne Aufschlag für uns.
                {(location.ueberweisung || location.bar) && ` ${location.ueberweisung && location.bar ? "Per Überweisung und bar" : location.ueberweisung ? "Per Überweisung" : "Bar"} zahlt ihr nur ${eur(preview)}.`}
              </p>
            </div>
          )}
          {location.paypal && <div className={`mt-2 ${blocked || (busy && busy !== "paypal") ? "pointer-events-none opacity-40" : ""}`} aria-disabled={blocked || busy !== null}>
            {paypalClientId ? (
              <PayPalScriptProvider options={{ clientId: paypalClientId, currency: "EUR", intent: "capture", locale: "de_DE", components: "buttons", disableFunding: "card,sepa,giropay,sofort,eps,bancontact,blik,ideal,mybank,p24" }}>
                <PayPalButtons
                  style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 48 }}
                  disabled={blocked || busy !== null}
                  forceReRender={[preview, aufschlag, age]}
                  onClick={(_, actions) => (lock.current ? actions.reject() : actions.resolve())}
                  createOrder={async () => {
                    if (!sperren("paypal")) throw new Error("Es läuft schon eine Zahlung.");
                    const r = await post<{ paypal_order_id: string }>("/api/checkout", body());
                    return r.paypal_order_id;
                  }}
                  onApprove={async (data) => {
                    try { const r = await post<Receipt>("/api/checkout/capture", { paypal_order_id: data.orderID }); setDone(r); setStep("done"); setCart({}); router.refresh(); }
                    catch (e) { setErr((e as Error).message); }
                    finally { freigeben(); }
                  }}
                  onCancel={() => { freigeben(); setErr(`Zahlung abgebrochen. Ihr könnt es noch einmal versuchen${oderBar}.`); }}
                  onError={(e) => { freigeben(); setErr(String((e as { message?: unknown })?.message ?? "") || `PayPal hat gerade ein Problem. Bitte später noch einmal versuchen${oderBar}.`); }}
                />
              </PayPalScriptProvider>
            ) : (
              <div className="rounded-xl bg-cream p-3 text-mut">PayPal ist noch nicht eingerichtet.</div>
            )}
          </div>}
          {location.ueberweisung && (
            <button className="btn mt-3 h-12 w-full border-2 border-ink bg-paper text-lg disabled:opacity-40" disabled={blocked || busy !== null} onClick={() => bezahlen("ueberweisung")}>
              {busy === "ueberweisung" ? "Wird gebucht …" : "Per Überweisung mit der Banking App"}
            </button>
          )}
          {location.bar && (
            <button className="btn mt-3 h-12 w-full border-2 border-ink bg-paper text-lg disabled:opacity-40" disabled={blocked || busy !== null} onClick={() => bezahlen("bar")}>
              {busy === "bar" ? "Wird gebucht …" : <>Ich lege {eur(preview)} bar in die Kasse</>}
            </button>
          )}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head title="Griaß Gott!" sub="Probierprodukte vom Heiglerhof" logo={partner.logo} />
      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-40 pt-3 md:grid-cols-[minmax(0,1fr)_340px] md:px-10 md:pb-12">
        <div className="min-w-0">
          <div className="flex items-center justify-between rounded-xl bg-cream px-3 py-2">
            <b className="font-semibold">📍 {location.name}</b>
            {location.ort && <span className="text-or-d">{location.ort}</span>}
          </div>
          <p className="mt-3 font-txt leading-relaxed">{intro}</p>
          {products.length === 0 && <p className="mt-6 rounded-xl bg-cream p-4">Gerade ist hier nichts eingeräumt. Wir füllen bald nach.</p>}
          <ul className="mt-2 grid gap-x-8 lg:grid-cols-2">
            {products.map((p) => {
              const q = Math.min(cart[p.id] ?? 0, p.ist);
              const max = Math.min(10, p.ist);
              return (
                <li key={p.id} className={`grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#f1e8d6] py-3 ${p.ist < 1 ? "opacity-50" : ""}`}>
                  {p.foto ? (
                    <Image src={p.foto} alt="" width={56} height={56} className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: p.farbe }}>
                      {p.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold leading-tight">{p.name}</h3>
                    <div className="text-sm leading-snug text-mut">
                      {inhaltText(p.inhalt, p.einheit)}
                      {p.alkohol_vol != null && <> · <span className="font-semibold text-bad">{alkoholText(p.alkohol_vol)}</span></>}
                      {p.zusatz && <> · {p.zusatz}</>}
                      <br />Grundpreis {grundpreisText(p.price_cents, p.inhalt, p.einheit)}
                      {p.ist < 1 ? <> · <b>gerade leer</b></> : p.ist <= 2 ? ` · nur noch ${p.ist}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold tnum">{eur(p.price_cents)}</div>
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <button aria-label={`${p.name} weniger`} disabled={q < 1} onClick={() => change(p.id, -1, max)} className="grid h-9 w-9 place-items-center rounded-full border-2 border-or text-xl text-or disabled:opacity-30">−</button>
                      <output className="w-5 text-center text-lg font-bold tnum">{q}</output>
                      <button aria-label={`${p.name} mehr`} disabled={q >= max} onClick={() => change(p.id, 1, max)} className="grid h-9 w-9 place-items-center rounded-full bg-or text-xl text-white disabled:opacity-30">+</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Werbung p={partner} name={location.name} />
          <a href="/karte" className="mt-6 block text-center text-or-d underline">Wo es uns sonst noch gibt</a>
        </div>
        <aside className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper p-4 md:sticky md:top-24 md:self-start md:rounded-2xl md:border" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {hasAlc && <p className="mb-2 text-sm text-mut">Liköre geben wir nur an Erwachsene ab 18 ab.</p>}
          <button className="btn btn-or w-full" disabled={!count} onClick={() => { setErr(null); setStep("sum"); }}>
            {count ? `Weiter · ${count} Artikel · ${eur(preview)}` : "Produkt wählen"}
          </button>
          <p className="mt-2 text-center text-sm text-mut">{`Bezahlen könnt ihr ${liste}.`}</p>
        </aside>
      </main>
    </>
  );
}
