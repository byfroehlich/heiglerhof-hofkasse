import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadShop } from "@/lib/shop";
import { Kasse } from "@/components/kasse";

export const dynamic = "force-dynamic"; // Preise und Bestand immer frisch

export async function generateMetadata({ params }: PageProps<"/kasse/[slug]">): Promise<Metadata> {
  const shop = await loadShop((await params).slug);
  return { title: shop ? `${shop.location.name} · Heiglerhof` : "Heiglerhof" };
}

export default async function KassePage({ params }: PageProps<"/kasse/[slug]">) {
  const { slug } = await params;
  if (!/^[a-z0-9]{2,32}$/.test(slug)) notFound();
  const shop = await loadShop(slug);
  if (!shop) notFound();
  return <Kasse location={shop.location} products={shop.products} paypalClientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ""} />;
}
