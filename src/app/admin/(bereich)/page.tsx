import { db } from "@/lib/supabase";
import { eur, stufe } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { menuSortiert } from "@/lib/menu-server";
import { StartMenu } from "@/components/start-menu";
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
  const [{ data: bestand }, { data: kaeufe }, { count: offen }, { count: nbOffen }] = await Promise.all([
    db().from("location_products").select("ist, warn, locations!inner(active, demo, wiederverkaeufer), products!inner(active)").eq("locations.active", true).eq("locations.demo", false).eq("locations.wiederverkaeufer", false).eq("products.active", true),
    db().from("orders").select("total_cents, locations!inner(demo)").eq("locations.demo", false).in("status", ["paid", "cash", "transfer", "transfer_paid"]).gte("created_at", heute.toISOString()),
    db().from("orders").select("id, locations!inner(demo)", { count: "exact", head: true }).eq("locations.demo", false).eq("status", "transfer"),
    db().from("nachbestellungen").select("id", { count: "exact", head: true }).eq("status", "offen"),
  ]);
  const leer = (bestand ?? []).filter((r) => stufe(r.ist, r.warn) === "leer").length;
  const knapp = (bestand ?? []).filter((r) => stufe(r.ist, r.warn) === "knapp").length;
  const umsatz = (kaeufe ?? []).reduce((a, o) => a + o.total_cents, 0);
  const hinweis: Record<string, React.ReactNode> = {
    "/admin/nachfuellen": (leer > 0 || knapp > 0) && <>{leer > 0 && <span className="pill bg-bad">{leer} leer</span>} {knapp > 0 && <span className="pill bg-warn">{knapp} Minimum</span>}</>,
    "/admin/bestellungen": (offen ?? 0) > 0 && <span className="pill bg-warn">{offen} Überweisung offen</span>,
    "/admin/nachbestellungen": (nbOffen ?? 0) > 0 && <span className="pill bg-warn">{nbOffen} offen</span>,
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-brush text-5xl text-or">Servus!</h1>
      <p className="text-mut">{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" })}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{(kaeufe ?? []).length}</b><span className="text-sm text-mut">Käufe heute</span></div>
        <div className="rounded-xl bg-cream p-3"><b className="block text-2xl tnum">{eur(umsatz)}</b><span className="text-sm text-mut">Umsatz heute</span></div>
      </div>

      <StartMenu menu={await menuSortiert()} hinweis={hinweis} />

      <form action={signOut} className="mt-6 text-center text-sm text-mut">
        Angemeldet als {me.email} · <button className="text-or-d underline">Abmelden</button>
      </form>
    </div>
  );
}
