import Link from "next/link";
import Image from "next/image";
import { db, fotoUrl } from "@/lib/supabase";
import { eur, grundpreisText, inhaltText, alkoholText, type Einheit } from "@/lib/format";
import { setProductActive } from "../../actions";

type P = { id: string; name: string; zusatz: string | null; inhalt: number; einheit: Einheit; price_cents: number; alkohol_vol: number | null; farbe: string; foto_path: string | null; active: boolean };

export default async function Produkte({ searchParams }: PageProps<"/admin/produkte">) {
  const ok = (await searchParams).gespeichert;
  const { data } = await db().from("products").select("id, name, zusatz, inhalt, einheit, price_cents, alkohol_vol, farbe, foto_path, active").order("name").returns<P[]>();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Produkte und Preise</h1>
        <Link href="/admin/produkte/neu" className="btn btn-or">+ Neues Produkt</Link>
      </div>
      <p className="font-txt text-mut">Preise gelten sofort für neue Bestellungen. Neue Produkte danach unter Verkaufsstellen zuordnen und Bestand eintragen.</p>
      {typeof ok === "string" && <p className="mt-3 rounded-lg bg-[#e7f1e2] p-3 text-ok">{ok} gespeichert.</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full tnum">
          <thead><tr className="border-b-2 border-ink text-left text-sm text-mut"><th className="p-2">Produkt</th><th className="p-2">Inhalt</th><th className="p-2 text-right">Preis</th><th className="p-2 text-right">Grundpreis</th><th className="p-2">Alkohol</th><th className="p-2">Aktiv</th><th className="p-2"></th></tr></thead>
          <tbody>
            {(data ?? []).map((p) => {
              const f = fotoUrl(p.foto_path);
              return (
                <tr key={p.id} className="border-b border-[#f1e8d6]">
                  <td className="p-2">
                    <span className="inline-flex items-center gap-2">
                      {f ? <Image src={f} alt="" width={32} height={32} className="h-8 w-8 rounded-md object-cover" /> : <span className="h-8 w-8 rounded-md" style={{ background: p.farbe }} />}
                      <span>{p.name}{p.zusatz && <span className="block text-sm text-mut">{p.zusatz}</span>}</span>
                    </span>
                  </td>
                  <td className="p-2">{inhaltText(p.inhalt, p.einheit)}</td>
                  <td className="p-2 text-right">{eur(p.price_cents)}</td>
                  <td className="p-2 text-right">{grundpreisText(p.price_cents, p.inhalt, p.einheit)}</td>
                  <td className="p-2">{alkoholText(p.alkohol_vol == null ? null : Number(p.alkohol_vol)) ?? "nein"}</td>
                  <td className="p-2">
                    <form action={setProductActive.bind(null, p.id, !p.active)}>
                      <button role="switch" aria-checked={p.active} aria-label={`${p.name} ${p.active ? "ausblenden" : "einblenden"}`} className={`relative h-6 w-11 rounded-full ${p.active ? "bg-ok" : "bg-[#c8c1b4]"}`}>
                        <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white ${p.active ? "left-[23px]" : "left-[3px]"}`} />
                      </button>
                    </form>
                  </td>
                  <td className="p-2"><Link href={`/admin/produkte/${p.id}`} className="btn btn-ghost btn-sm">Bearbeiten</Link></td>
                </tr>
              );
            })}
            {(data ?? []).length === 0 && <tr><td colSpan={7} className="p-3 text-mut">Noch keine Produkte. Legt das erste mit „+ Neues Produkt“ an.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
