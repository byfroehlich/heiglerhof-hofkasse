"use client";

export default function Fehler({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="font-brush text-4xl text-or">Hoppla</h1>
      <p className="font-txt text-lg">Gerade klemmt etwas. Bitte gleich noch einmal versuchen. Bargeld könnt ihr jederzeit in die Kasse legen.</p>
      <button className="btn btn-or" onClick={reset}>Noch einmal versuchen</button>
      <p className="text-mut">Heiglerhof · 0176 9999 8727</p>
    </main>
  );
}
