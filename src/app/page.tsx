import Image from "next/image";
import Link from "next/link";

export default function Start() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Image src="/logo@2x.png" alt="Handgemacht vom Heiglerhof" width={140} height={139} priority />
      <h1 className="font-brush text-5xl text-or">Griaß di!</h1>
      <p className="font-txt text-lg leading-relaxed">
        Das ist die Hofkasse vom Heiglerhof. Scannt einfach den QR Code am Aufsteller, dann seht ihr die Produkte vor Ort.
      </p>
      <Link href="/karte" className="btn btn-or">Wo&apos;s uns gibt: zur Karte</Link>
      <p className="text-mut">Heiglerhof · Wank 6 · 87484 Nesselwang</p>
    </main>
  );
}
