import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "../actions";
import { AdminNav } from "@/components/admin-nav";
import { db } from "@/lib/supabase";
import { stufe } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await requireAdmin();
  const { data } = await db().from("location_products").select("ist, warn, locations!inner(active)").eq("locations.active", true);
  const rows = data ?? [];
  const leer = rows.filter((r) => stufe(r.ist, r.warn) === "leer").length;
  const knapp = rows.filter((r) => stufe(r.ist, r.warn) === "knapp").length;
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-cream px-3 py-2 md:w-56 md:flex-none md:flex-col md:items-stretch md:gap-1 md:border-b-0 md:static md:border-r md:px-3 md:py-5" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
        <Link href="/admin" aria-label="Zum Startbildschirm" className="flex-none md:mb-3 md:ml-2">
          <Image src="/logo@2x.png" alt="Heiglerhof" width={96} height={95} className="h-11 w-11 md:h-24 md:w-24" />
        </Link>
        <AdminNav leer={leer} knapp={knapp} />
        <div className="hidden md:mt-auto md:block md:px-2 md:text-sm md:text-mut">
          {me.email}
          <form action={signOut}><button className="mt-1 text-or-d underline">Abmelden</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
    </div>
  );
}
