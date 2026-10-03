import Link from "next/link";
import { KassenVorschau } from "@/components/kassen-vorschau";
import { notFound } from "next/navigation";
import { db, partnerUrl } from "@/lib/supabase";
import { qrSvg } from "@/lib/qr";
import { siteUrl } from "@/lib/site";
import { LocationEditor } from "@/components/location-editor";

type L = {
  id: string; slug: string; name: string; typ: string; ort: string | null; strasse: string | null; plz: string | null; hinweis: string | null;
  oeffentlich: boolean; demo: boolean; lat: number | null; lng: number | null; logo_path: string | null; werbung_bild: string | null; werbung_text: string | null; werbung_link: string | null;
};

export default async function VerkaufsstelleBearbeiten({ params }: PageProps<"/admin/verkaufsstellen/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: l } = await db().from("locations")
    .select("id, slug, name, typ, ort, strasse, plz, hinweis, oeffentlich, demo, lat, lng, logo_path, werbung_bild, werbung_text, werbung_link")
    .eq("id", id).maybeSingle<L>();
  if (!l) notFound();
  const url = `${await siteUrl()}/kasse/${l.slug}`;
  return (
    <>
      <Link href="/admin/verkaufsstellen" className="text-or-d underline">← Verkaufsstellen</Link>
      <h1 className="mt-2 text-3xl font-bold">{l.name}</h1>
      <p className="font-txt text-mut">Adresse, Kartenpunkt, Partnerlogo und Werbung. Ganz unten der QR Code zum Herunterladen.</p>
      <LocationEditor l={{
        id: l.id, name: l.name, typ: l.typ, strasse: l.strasse ?? "", plz: l.plz ?? "", ort: l.ort ?? "", hinweis: l.hinweis ?? "",
        oeffentlich: l.oeffentlich, demo: l.demo, lat: l.lat, lng: l.lng, logo: partnerUrl(l.logo_path), werbung_bild: partnerUrl(l.werbung_bild),
        werbung_text: l.werbung_text ?? "", werbung_link: l.werbung_link ?? "",
      }} />

      <h2 id="schild" className="mt-10 text-2xl font-bold">Verkaufsschild A4</h2>
      <p className="max-w-3xl font-txt text-mut">
        Fertiges Schild mit QR Code, Anleitung in drei Schritten und den aktiven Zahlarten dieser Stelle, alle gleichwertig.
        Werden die Zahlarten geändert, bitte das Schild neu herunterladen und austauschen.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a className="btn btn-or" href={`/admin/schild/${l.id}?download=1`} download>Schild als PDF herunterladen</a>
        <a className="btn btn-ghost" href={`/admin/schild/${l.id}`} target="_blank">Ansehen</a>
      </div>

      <h2 id="qr" className="mt-10 text-2xl font-bold">QR Code</h2>
      <p className="font-txt text-mut">Für den Aufsteller: PNG zum Drucken oder SVG für den Grafiker. Mindestgröße im Druck etwa 3 × 3 cm.</p>
      <div className="mt-4 grid max-w-3xl items-start gap-6 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-2xl border border-line bg-paper p-4" aria-label={`QR Code für ${l.name}`} dangerouslySetInnerHTML={{ __html: qrSvg(url) }} />
        <div className="flex flex-col gap-3">
          <a className="btn btn-or" href={`/admin/qr/${l.id}?format=png`} download>PNG herunterladen</a>
          <a className="btn btn-ghost" href={`/admin/qr/${l.id}?format=svg`} download>SVG herunterladen</a>
          <div className="rounded-xl bg-cream p-3 text-sm">
            <div className="text-mut">Der Code führt zu</div>
            <div className="break-all font-mono">{url}</div>
            <KassenVorschau pfad={`/kasse/${l.slug}`} name={l.name} className="btn btn-ghost btn-sm mt-2">Kasse ansehen</KassenVorschau>
          </div>
          <p className="text-sm text-mut">Vor dem Drucken einmal mit dem Handy scannen und prüfen, ob die richtige Verkaufsstelle aufgeht.</p>
        </div>
      </div>
    </>
  );
}
