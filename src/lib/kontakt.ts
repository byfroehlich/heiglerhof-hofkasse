import "server-only";
import { db } from "./supabase";

export type Kontakt = { name: string | null; telefon: string | null };

/** Ansprechpartner für Gäste laut Einstellungen. Fehlt er, steht nur die Hofadresse da. */
export async function kontakt(): Promise<Kontakt> {
  const { data, error } = await db().from("einstellungen").select("kontakt_name, kontakt_telefon").eq("id", 1).maybeSingle();
  if (error) console.error("[kontakt]", error.message);
  return { name: data?.kontakt_name ?? null, telefon: data?.kontakt_telefon ?? null };
}

/** "Name 0176 …", nur der Teil, der hinterlegt ist, sonst leer. */
export const kontaktText = (k: Kontakt) => [k.name, k.telefon].filter(Boolean).join(" ");
