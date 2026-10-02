"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { eur, grundpreisText, inhaltText, alkoholText } from "@/lib/format";
import type { Location, Partner, ShopProduct } from "@/lib/shop";
import type { Receipt } from "@/lib/checkout";

type Props = { location: Location; partner: Partner; products: ShopProduct[]; paypalClientId: string };
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

export function Kasse({ location, partner, products, paypalClientId }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>("list");
  const [age, setAge] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Receipt | null>(null);

  const lines = useMemo(() => products.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => ({ p, q: cart[p.id] })), [products, cart]);
  const count = lines.reduce((a, l) => a + l.q, 0);
  // Nur Anzeige. Bezahlt wird der Betrag, den der Server aus der Datenbank rechnet.
  const preview = lines.reduce((a, l) => a + l.p.price_cents * l.q, 0);
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

  async function payCash() {
    setBusy(true); setErr(null);
    try { const r = await post<Receipt>("/api/checkout/cash", body()); setDone(r); setStep("done"); setCart({}); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const zahlweg = location.paypal && location.bar ? "zahlt hier mit PayPal oder bar in die Kasse" : location.paypal ? "zahlt hier mit PayPal" : "legt das Geld bar in die Kasse";
  const oderBar = location.bar ? " oder bar zahlen" : "";
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
          {done.status === "cash" ? `Danke fürs Vertrauen · ${eur(done.total_cents)} in die Kasse` : done.status === "paid" ? `Zahlung eingegangen · ${eur(done.total_cents)}` : `Zahlung wird geprüft · ${eur(done.total_cents)}`}
        </p>
        <p className="text-sm text-mut">Bestellung HH {done.nr}</p>
        <div className="mt-6 rounded-xl bg-cream p-4 text-left">
          {done.items.map((i) => (
            <div key={i.label} className="flex justify-between py-1 tnum"><span>{i.quantity} × {i.label}</span><span>{eur(i.unit_price_cents * i.quantity)}</span></div>
          ))}
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
        <button className="btn btn-ghost mt-3 w-full" onClick={() => { setStep("list"); setDone(null); setAge(false); }}>Noch etwas nehmen</button>
        <Werbung p={partner} name={location.name} />
      </main>
    );
  }

  if (step === "sum") {
    return (
      <>
        <Head title="Eure Auswahl" sub={location.name} onBack={() => setStep("list")} />
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
          {location.paypal && <div className={`mt-5 ${blocked ? "pointer-events-none opacity-40" : ""}`} aria-disabled={blocked}>
            {paypalClientId ? (
              <PayPalScriptProvider options={{ clientId: paypalClientId, currency: "EUR", intent: "capture", locale: "de_DE", components: "buttons", disableFunding: "card,sepa,giropay,sofort,eps,bancontact,blik,ideal,mybank,p24" }}>
                <PayPalButtons
                  style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 48 }}
                  disabled={blocked || busy}
                  forceReRender={[preview, age]}
                  createOrder={async () => {
                    setErr(null);
                    const r = await post<{ paypal_order_id: string }>("/api/checkout", body());
                    return r.paypal_order_id;
                  }}
                  onApprove={async (data) => {
                    setBusy(true);
                    try { const r = await post<Receipt>("/api/checkout/capture", { paypal_order_id: data.orderID }); setDone(r); setStep("done"); setCart({}); }
                    catch (e) { setErr((e as Error).message); }
                    finally { setBusy(false); }
                  }}
                  onCancel={() => setErr(`Zahlung abgebrochen. Ihr könnt es noch einmal versuchen${oderBar}.`)}
                  onError={(e) => setErr(String((e as { message?: unknown })?.message ?? "") || (location.bar ? "PayPal hat gerade ein Problem. Bitte bar zahlen oder später noch einmal versuchen." : "PayPal hat gerade ein Problem. Bitte später noch einmal versuchen."))}
                />
              </PayPalScriptProvider>
            ) : (
              <div className="rounded-xl bg-cream p-3 text-mut">PayPal ist noch nicht eingerichtet.</div>
            )}
          </div>}
          {location.bar && (
            <button className={`btn mt-2 w-full ${location.paypal ? "btn-ghost" : "btn-or mt-5"}`} disabled={blocked || busy} onClick={payCash}>
              Ich lege {eur(preview)} bar in die Kasse
            </button>
          )}
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
              const q = cart[p.id] ?? 0;
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
                      {p.alkohol_vol != null ? <> · <span className="font-semibold text-bad">{alkoholText(p.alkohol_vol)}</span></> : p.zusatz ? ` · ${p.zusatz}` : ""}
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
          <p className="mt-2 text-center text-sm text-mut">{location.paypal && location.bar ? "Bar zahlen geht auch: Geld einfach in die Kasse legen." : location.paypal ? "Bezahlt wird hier mit PayPal." : "Bezahlt wird hier bar: Geld einfach in die Kasse legen."}</p>
        </aside>
      </main>
    </>
  );
}
