"use client";

import { useActionState } from "react";
import { saveBank } from "../../actions";

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
