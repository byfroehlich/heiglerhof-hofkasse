import "server-only";
import { headers } from "next/headers";

/** Öffentliche Adresse für Links und QR Codes. */
export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
  const h = await headers();
  return `https://${h.get("host")}`;
}
