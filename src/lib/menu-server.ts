import "server-only";
import { db } from "./supabase";
import { sortiereMenu } from "./menu";

/** Gespeicherte Menü-Reihenfolge; ohne Eintrag (oder ohne SQL 0014) die Standardreihenfolge. */
export async function menuSortiert() {
  const { data } = await db().from("einstellungen").select("menu_reihenfolge").eq("id", 1).maybeSingle();
  return sortiereMenu((data?.menu_reihenfolge as string[] | null) ?? null);
}
