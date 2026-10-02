"use client";

import { useActionState } from "react";
import { saveBank, savePaypalGebuehr } from "../../actions";
import { paypalAufschlag } from "@/lib/pricing";
import { eur } from "@/lib/format";

export function BankForm({ iban, empfaenger, bic }: { iban: string; empfaenger: string; bic: string }) {
  const [state, action, pending] = useActionState(saveBank, undefined);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <label className="field">Kontoinhaber (wie bei der Bank)<input name="empfaenger" defaultValue={empfaenger} maxLength={70} autoComplete="off" /></label>
      <label className="field">IBAN<input name="iban" defaultValue={iban} maxLength={42} autoComplete="off" spellCheck={false} placeholder="DE00 0000 0000 0000 0000 00" className="font-mono" /></label>
      <label className="field">BIC (darf leer bleiben)<input name="bic" defaultValue={bic} maxLength={11} autoComplete="off" spellCheck={false} /></label>
      {state?.error && <p role="alert" className="rounded-lg bg-[#fbe9e7] p-3 text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-[#e6f0df] p-3 text-ok">{state.ok}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-or" disabled={pending}>{pending ? "Speichern …" : "Speichern"}</button>
      </div>
      <p className="text-sm text-mut">Zum Entfernen IBAN und Kontoinhaber leeren und speichern.</p>
    </form>
  );
}

const komma = (n: number) => n.toFixed(2).replace(".", ",");

export function GebuehrForm({ aktiv, bp, fix }: { aktiv: boolean; bp: number; fix: number }) {
  const [state, action, pending] = useActionState(savePaypalGebuehr, undefined);
  const g = { bp, fix_cents: fix };
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <label className="flex items-center gap-3 text-lg">
        <input type="checkbox" name="aktiv" defaultChecked={aktiv} className="h-6 w-6 accent-[var(--or)]" />
        PayPal Gebühr an Gäste weitergeben
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">Prozent<input name="prozent" defaultValue={komma(bp / 100)} inputMode="decimal" maxLength={6} /></label>
        <label className="field">Fester Betrag in €<input name="fix" defaultValue={komma(fix / 100)} inputMode="decimal" maxLength={5} /></label>
      </div>
      <p className="text-sm text-mut">
        Beispiele mit den gespeicherten Werten: {[500, 1000, 2000].map((c) => `${eur(c)} + ${eur(paypalAufschlag(c, g))}`).join(" · ")}.
        So bleibt nach Abzug der PayPal Gebühr genau euer Preis übrig.
      </p>
      {state?.error && <p role="alert" className="rounded-lg bg-[#fbe9e7] p-3 text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-[#e6f0df] p-3 text-ok">{state.ok}</p>}
      <div><button className="btn btn-or" disabled={pending}>{pending ? "Speichern …" : "Speichern"}</button></div>
    </form>
  );
}
