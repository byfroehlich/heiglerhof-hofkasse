import Image from "next/image";
import { kontakt, kontaktText } from "@/lib/kontakt";

export default async function NichtGefunden() {
  const wer = kontaktText(await kontakt());
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <Image src="/logo@2x.png" alt="Heiglerhof" width={110} height={109} />
      <h1 className="font-brush text-4xl text-or">Hoppla</h1>
      <p className="font-txt text-lg">Diese Verkaufsstelle gibt es nicht mehr. Bargeld könnt ihr trotzdem in die Kasse legen. Vergelt&apos;s Gott!</p>
      <p className="text-mut">Heiglerhof · Wank 6 · 87484 Nesselwang{wer ? ` · ${wer}` : ""}</p>
    </main>
  );
}
