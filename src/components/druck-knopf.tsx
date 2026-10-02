"use client";

export function DruckKnopf() {
  return <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨 Packliste drucken</button>;
}
