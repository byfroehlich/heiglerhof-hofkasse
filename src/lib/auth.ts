import "server-only";
import { redirect } from "next/navigation";
import { authClient, db } from "./supabase";

/**
 * Prüft bei JEDER Admin-Seite und JEDER Server Action:
 * angemeldet (Token von Supabase bestätigt) und in der Tabelle admins eingetragen.
 */
/** Wie requireAdmin, aber ohne Umleitung: für API-Routen und öffentliche Seiten mit Admin-Extras. */
export async function istAdmin(): Promise<{ email: string } | null> {
  const supa = await authClient();
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) return null;
  const { data: row } = await db().from("admins").select("email").eq("user_id", data.user.id).maybeSingle();
  return row ? { email: row.email } : null;
}

export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const supa = await authClient();
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) redirect("/admin/login");
  const { data: row } = await db().from("admins").select("email").eq("user_id", data.user.id).maybeSingle();
  if (!row) redirect("/admin/login?kein-zugriff=1");
  return { userId: data.user.id, email: row.email };
}
