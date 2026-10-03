import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ladeNachbestellSeite } from "@/lib/nachbestellung";
import { NachbestellForm } from "@/components/nachbestell-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nachbestellen · Heiglerhof", robots: { index: false, follow: false } };

export default async function Nachbestellen({ params }: PageProps<"/nachbestellen/[token]">) {
  const { token } = await params;
  const seite = await ladeNachbestellSeite(token);
  if (!seite) notFound();
  return <NachbestellForm token={token} {...seite} />;
}
