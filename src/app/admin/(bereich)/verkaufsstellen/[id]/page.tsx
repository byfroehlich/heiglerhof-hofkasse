import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { qrSvg } from "@/lib/qr";
import { siteUrl } from "@/lib/site";

export default async function QrGross({ params }: PageProps<"/admin/verkaufsstellen/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: l } = await db().from("locations").select("id, slug, name, typ, ort").eq("id", id).maybeSingle();
  if (!l) notFound();
  const url = `${await siteUrl()}/kasse/${l.slug}`;
  return (
    <>
      <Link href="/admin/verkaufsstellen" className="text-or-d underline">← Verkaufsstellen</Link>
      <h1 className="mt-2 text-3xl font-bold">QR Code · {l.name}</h1>
      <p className="font-txt text-mut">Für den Aufsteller: PNG zum Drucken oder SVG für den Grafiker. Mindestgröße im Druck etwa 3 × 3 cm.</p>
      <div className="mt-5 grid max-w-3xl items-start gap-6 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-2xl border border-line bg-paper p-4" aria-label={`QR Code für ${l.name}`} dangerouslySetInnerHTML={{ __html: qrSvg(url) }} />
        <div className="flex flex-col gap-3">
          <a className="btn btn-or" href={`/admin/qr/${l.id}?format=png`} download>PNG herunterladen</a>
          <a className="btn btn-ghost" href={`/admin/qr/${l.id}?format=svg`} download>SVG herunterladen</a>
          <div className="rounded-xl bg-cream p-3 text-sm">
            <div className="text-mut">Der Code führt zu</div>
            <a href={url} target="_blank" className="break-all font-mono">{url}</a>
          </div>
          <p className="text-sm text-mut">Vor dem Drucken einmal mit dem Handy scannen und prüfen, ob die richtige Verkaufsstelle aufgeht.</p>
        </div>
      </div>
    </>
  );
}
