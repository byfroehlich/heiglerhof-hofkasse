import "server-only";
import { redirect } from "next/navigation";
import { authClient, db } from "./supabase";

/**
 * Prüft bei JEDER Admin-Seite und JEDER Server Action:
 * angemeldet (Token von Supabase bestätigt) und in der Tabelle admins eingetragen.
 */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const supa = await authClient();
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) redirect("/admin/login");
  const { data: row } = await db().from("admins").select("email").eq("user_id", data.user.id).maybeSingle();
  if (!row) redirect("/admin/login?kein-zugriff=1");
  return { userId: data.user.id, email: row.email };
}
