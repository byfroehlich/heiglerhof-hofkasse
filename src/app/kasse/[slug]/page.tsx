import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadShop } from "@/lib/shop";
import { Kasse } from "@/components/kasse";
import { paypalGebuehr } from "@/lib/gebuehr";
import { kontakt } from "@/lib/kontakt";
import { istAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic"; // Preise und Bestand immer frisch

export async function generateMetadata({ params }: PageProps<"/kasse/[slug]">): Promise<Metadata> {
  const shop = await loadShop((await params).slug);
  return { title: shop ? `${shop.location.name} · Heiglerhof` : "Heiglerhof" };
}

export default async function KassePage({ params, searchParams }: PageProps<"/kasse/[slug]">) {
  const { slug } = await params;
  // Vorführmodus nur für angemeldete Admins (Popup im Admin), sonst ganz normale Kasse
  const vorfuehren = (await searchParams).vorfuehren === "1" && (await istAdmin()) !== null;
  if (!/^[a-z0-9]{2,32}$/.test(slug)) notFound();
  const shop = await loadShop(slug);
  if (!shop) notFound();
  return <Kasse location={shop.location} partner={shop.partner} products={shop.products} paypalClientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ""} gebuehr={shop.location.paypal ? await paypalGebuehr() : null} kontakt={await kontakt()} vorfuehren={vorfuehren} />;
}
