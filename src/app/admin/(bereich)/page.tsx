import Link from "next/link";
import { db } from "@/lib/supabase";
import { eur, stufe } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { MENU } from "@/lib/menu";
import { signOut } from "../actions";

/** Startbildschirm der App: kurzer Überblick und große Knöpfe zu allen Bereichen. */
export default async function Start() {
  const me = await requireAdmin();
  // Mitternacht nach deutscher Zeit (der Server läuft in UTC)
  const jetzt = new Date();
  const berlin = new Date(jetzt.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const versatz = berlin.getTime() - jetzt.getTime();
  berlin.setHours(0, 0, 0, 0);
  const heute = new Date(berlin.getTime() - versatz);
  const [{ data: bestand }, { data: kaeufe }, { count: offen }] = await Promise.all([
    db().from("location_products").select("ist, warn, locations!inner(active, demo), products!inner(active)").eq("locations.active", true).eq("locations.demo", false).eq("products.active", true),
    db().from("orders").select("total_cents, locations!inner(demo)").eq("locations.demo", false).in("status", ["paid", "cash", "transfer", "transfer_paid"]).gte("created_at", heute.toISOString()),
    db().from("orders").select("id, locations!inner(demo)", { count: "exact", head: true }).eq("locations.demo", false).eq("status", "transfer"),
  ]);
  const leer = (bestand ?? []).filter((r) => stufe(r.ist, r.warn) === "leer").length;
  const knapp = (bestand ?? []).filter((r) => stufe(r.ist, r.warn) === "knapp").length;
  const umsatz = (kaeufe ?? []).reduce((a, o) => a + o.total_cents, 0);
  const hinweis: Record<string, React.ReactNode> = {
    "/admin/nachfuellen": (leer > 0 || knapp > 0) && <>{leer > 0 && <span className="pill bg-bad">{leer} leer</span>} {knapp > 0 && <span className="pill bg-warn">{knapp} Minimum</span>}</>,
    "/admin/bestellungen": (offen ?? 0) > 0 && <span className="pill bg-warn">{offen} Überweisung offen</span>,
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-brush text-5xl text-or">Servus!</h1>
      <p className="text-mut">{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" })}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{(kaeufe ?? []).length}</b><span className="text-sm text-mut">Käufe heute</span></div>
        <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{eur(umsatz)}</b><span className="text-sm text-mut">Umsatz heute</span></div>
      </div>

      <nav className="mt-5 flex flex-col gap-3" aria-label="Hauptmenü">
        {MENU.map((m) => (
          <Link key={m.href} href={m.href}
            className="flex min-h-[72px] items-center gap-4 rounded-2xl border-2 border-line bg-paper px-4 py-3 shadow-sm transition active:scale-[.98] active:bg-orl">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-orl text-2xl" aria-hidden>{m.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[22px] font-bold leading-tight">{m.label}</span>
              <span className="block text-sm text-mut">{m.info}</span>
              {hinweis[m.href] && <span className="mt-1 flex flex-wrap gap-1">{hinweis[m.href]}</span>}
            </span>
            <span className="text-3xl text-mut" aria-hidden>›</span>
          </Link>
        ))}
      </nav>

      <form action={signOut} className="mt-6 text-center text-sm text-mut">
        Angemeldet als {me.email} · <button className="text-or-d underline">Abmelden</button>
      </form>
    </div>
  );
}
