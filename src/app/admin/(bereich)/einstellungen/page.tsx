import { db } from "@/lib/supabase";
import { ibanLesbar } from "@/lib/giro";
import { BankForm, GebuehrForm } from "./form";
import { AppUndPush } from "@/components/app-push";
import { PushProtokoll } from "./protokoll";

export default async function Einstellungen() {
  const { data } = await db().from("einstellungen").select("iban, empfaenger, bic, geaendert_am, geaendert_von").eq("id", 1).maybeSingle();
  const { data: g } = await db().from("einstellungen").select("paypal_gebuehr_aktiv, paypal_gebuehr_bp, paypal_gebuehr_fix_cents").eq("id", 1).maybeSingle();
  const vercel = !data?.iban && Boolean(process.env.ZAHLUNG_IBAN);
  return (
    <>
      <h1 className="text-3xl font-bold">Einstellungen</h1>
      <AppUndPush />
      <PushProtokoll />
      <section className="mt-4 max-w-2xl rounded-2xl bg-cream p-4 md:p-6">
        <h2 className="text-xl font-bold">Bankverbindung für Überweisungen</h2>
        <p className="mt-1 font-txt text-mut">
          Diese Angaben sehen Gäste, die per Überweisung zahlen, und sie stehen im GiroCode. Danach unter Verkaufsstellen den Schalter Überweisung einschalten.
        </p>
        {vercel && <p className="mt-2 rounded-lg bg-paper p-2 text-sm text-mut">Gerade gelten die Bankdaten aus Vercel. Was ihr hier speichert, hat Vorrang.</p>}
        <BankForm iban={data?.iban ? ibanLesbar(data.iban) : ""} empfaenger={data?.empfaenger ?? ""} bic={data?.bic ?? ""} />
        {data?.geaendert_am && (
          <p className="mt-3 text-sm text-mut">
            Zuletzt geändert am {new Date(data.geaendert_am).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" })} von {data.geaendert_von}.
          </p>
        )}
        <p className="mt-3 text-sm text-mut">Zur Sicherheit geht bei jeder Änderung eine E-Mail an die Benachrichtigungsadresse.</p>
      </section>
      <section className="mt-4 max-w-2xl rounded-2xl bg-cream p-4 md:p-6">
        <h2 className="text-xl font-bold">PayPal Gebühr</h2>
        <p className="mt-1 font-txt text-mut">
          Wenn an, zahlen Gäste bei PayPal die PayPal Gebühr obendrauf. Die Kasse zeigt sie vor dem Bezahlen getrennt an, Bar und Überweisung bleiben ohne Aufschlag.
          Tragt die Werte aus eurem PayPal Konto ein (voreingestellt sind 2,99 % + 0,39 €).
        </p>
        {g ? <GebuehrForm aktiv={g.paypal_gebuehr_aktiv} bp={g.paypal_gebuehr_bp} fix={g.paypal_gebuehr_fix_cents} /> : <p className="mt-3 rounded-lg bg-paper p-3 text-bad">Erst SQL 0009 im Supabase SQL Editor einspielen.</p>}
      </section>
    </>
  );
}
