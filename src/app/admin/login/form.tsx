"use client";

import { useActionState } from "react";
import { signIn } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <label className="field">E-Mail<input name="email" type="email" autoComplete="username" required /></label>
      <label className="field">Passwort<input name="password" type="password" autoComplete="current-password" required /></label>
      {state?.error && <p className="text-bad">{state.error}</p>}
      <button className="btn btn-or" disabled={pending}>{pending ? "Anmelden …" : "Anmelden"}</button>
    </form>
  );
}
