import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { db, partnerUrl } from "@/lib/supabase";
import { Karte, type KartenPunkt } from "@/components/karte";
import { HOF } from "@/lib/hof";
import { km } from "@/lib/route";
import { kontakt, kontaktText } from "@/lib/kontakt";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Wo's uns gibt · Heiglerhof",
  description: "Verkaufsstellen vom Heiglerhof im Allgäu: Honig, Liköre und Eingemachtes zum Mitnehmen.",
};

type L = {
  id: string; name: string; typ: string; strasse: string | null; plz: string | null; ort: string | null; hinweis: string | null;
  lat: number; lng: number; logo_path: string | null; wiederverkaeufer: boolean;
  location_products: { ist: number; products: { name: string; zusatz: string | null; active: boolean } }[];
};

const routeLink = (l: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${l.lat.toFixed(6)},${l.lng.toFixed(6)}`;

export default async function KartePage() {
  const wer = kontaktText(await kontakt());
  // Nur öffentliche, aktive Stellen mit Kartenpunkt. Bestände werden nicht gezeigt, nur was gerade da ist.
  const { data, error } = await db()
    .from("locations")
    .select("id, name, typ, strasse, plz, ort, hinweis, lat, lng, logo_path, wiederverkaeufer, location_products(ist, products(name, zusatz, active))")
    .eq("active", true).eq("oeffentlich", true).eq("demo", false).not("lat", "is", null).not("lng", "is", null)
    .order("name")
    .returns<L[]>();
  if (error) throw error;
  const stellen = (data ?? []).map((l) => ({
    ...l,
    adresse: [l.strasse, [l.plz, l.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    da: l.location_products.filter((x) => (l.wiederverkaeufer || x.ist > 0) && x.products?.active) // Wiederverkäufer führen ihren Bestand selbst.map((x) => (x.products.zusatz ? `${x.products.name} (${x.products.zusatz})` : x.products.name)).sort((a, b) => a.localeCompare(b, "de")),
  }));
  const punkte: KartenPunkt[] = stellen.map((l) => ({
    id: l.id, lat: l.lat, lng: l.lng, titel: l.name, zeile: l.adresse, farbe: "or",
    link: { href: `#${l.id}`, text: "Was gibt's dort?" },
  }));
  // Der Hof ist immer auf der Karte, außer eine Verkaufsstelle steht schon dort (Verkaufskasten an der Hoftür)
  if (!stellen.some((l) => km(l, HOF) < 0.15))
    punkte.unshift({ id: "hof", lat: HOF.lat, lng: HOF.lng, titel: HOF.name, zeile: `${HOF.adresse} · Verkaufskasten an der Hoftür`, farbe: "hof",
      link: { href: `https://www.google.com/maps/dir/?api=1&destination=${HOF.lat},${HOF.lng}`, text: "Route dorthin" } });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 md:px-8">
      <header className="flex items-center gap-3">
        <Link href="/"><Image src="/logo@2x.png" alt="Handgemacht vom Heiglerhof" width={64} height={64} className="h-16 w-16" /></Link>
        <div>
          <h1 className="font-brush text-5xl leading-none text-or">Wo&apos;s uns gibt</h1>
          <p className="text-mut">Honig, Liköre und Eingemachtes vom Heiglerhof zum Mitnehmen</p>
        </div>
      </header>
      <div className="mt-5">
        <Karte punkte={punkte} className="h-[55vh] min-h-[320px]" />
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {stellen.map((l) => (
          <li key={l.id} id={l.id} className="scroll-mt-4 rounded-2xl bg-cream p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-mut">{l.typ}</div>
                <h2 className="text-2xl font-bold leading-tight">{l.name}</h2>
                {l.adresse && <div className="text-mut">{l.adresse}</div>}
                {l.hinweis && <p className="mt-1 font-txt">{l.hinweis}</p>}
              </div>
              {l.logo_path && (
                // eslint-disable-next-line @next/next/no-img-element -- Partnerlogo aus dem Storage, schon verkleinert
                <img src={partnerUrl(l.logo_path)!} alt={`Logo ${l.name}`} className="h-16 w-24 flex-none object-contain" loading="lazy" />
              )}
            </div>
            <p className="mt-2 text-sm">
              {l.da.length ? <><b>Gerade da:</b> {l.da.join(", ")}</> : <span className="text-mut">Gerade wird nachgefüllt.</span>}
            </p>
            <a href={routeLink(l)} target="_blank" rel="noopener noreferrer" className="btn btn-or mt-3 w-full">Route dorthin</a>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center text-mut">Heiglerhof · Wank 6 · 87484 Nesselwang{wer ? ` · ${wer}` : ""}</p>
    </main>
  );
}
