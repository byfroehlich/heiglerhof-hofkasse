import { notFound } from "next/navigation";
import Link from "next/link";
import { db, fotoUrl } from "@/lib/supabase";
import { ProductEditor, type EditorProduct } from "@/components/product-editor";

export default async function ProduktBearbeiten({ params }: PageProps<"/admin/produkte/[id]">) {
  const { id } = await params;
  let product: EditorProduct;
  if (id === "neu") {
    product = { id: "", name: "", zusatz: "", inhalt: 200, einheit: "g", price: "5,00", haendler: "", alkohol: "", farbe: "#7a8b2e", foto: null };
  } else {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const { data: p } = await db().from("products").select("*").eq("id", id).maybeSingle();
    if (!p) notFound();
    product = {
      id: p.id, name: p.name, zusatz: p.zusatz ?? "", inhalt: p.inhalt, einheit: p.einheit,
      price: (p.price_cents / 100).toFixed(2).replace(".", ","),
      haendler: p.haendler_cents == null ? "" : (p.haendler_cents / 100).toFixed(2).replace(".", ","),
      alkohol: p.alkohol_vol == null ? "" : String(p.alkohol_vol).replace(".", ","),
      farbe: p.farbe, foto: fotoUrl(p.foto_path),
    };
  }
  return (
    <>
      <Link href="/admin/produkte" className="text-or-d underline">← Produkte</Link>
      <h1 className="mt-2 text-3xl font-bold">{id === "neu" ? "Neues Produkt" : "Produkt bearbeiten"}</h1>
      <ProductEditor product={product} />
    </>
  );
}
