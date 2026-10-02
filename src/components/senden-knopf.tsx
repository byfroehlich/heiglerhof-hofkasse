"use client";

import { useFormStatus } from "react-dom";

/** Absendeknopf für Formulare mit Server Action: sperrt sich sofort nach dem Tipp bis zum Ende. */
export function SendenKnopf({ children, className = "btn btn-ghost btn-sm", arbeit = "…", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { arbeit?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} className={`${className} disabled:opacity-50`} disabled={pending || rest.disabled} aria-busy={pending}>
      {pending ? arbeit : children}
    </button>
  );
}
