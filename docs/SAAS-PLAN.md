# Plan: Hofkasse als SaaS mit Monatsabo

Stand: Oktober 2026. **Noch nicht umgesetzt.** Diese Datei sammelt alles, was für den Schritt
vom Heiglerhof-System zu einem Produkt für viele Höfe nötig ist, damit der Umbau schnell geht.

## Ziel

Andere Direktvermarkter (Höfe, Imker, Hofläden) buchen die Hofkasse im Monatsabo.
Jeder Betrieb („Mandant“) pflegt alles selbst im Adminbereich, ohne Vercel oder Supabase anzufassen.

## 1. Was heute noch fest im Code steht (muss in die Einstellungen)

| Bereich | Heute | Dateien |
|---|---|---|
| Name, Adresse, Telefon, Ansprechperson | „Heiglerhof · Wank 6 · 87484 Nesselwang · Steffi 0176 …“ | `src/components/kasse.tsx`, `src/lib/schild.ts`, `src/app/karte/page.tsx`, `src/app/page.tsx`, `src/app/kasse/[slug]/not-found.tsx` |
| Hof als Startpunkt der Tour (Koordinaten) | Konstante | `src/lib/hof.ts` (genutzt in Tour und Karte) |
| Logo | PNG im Code und in `public/` | `src/lib/logo-data.ts`, `public/logo*.png`, `src/lib/qr.ts`, `src/lib/schild.ts`, Layouts |
| Website | `www.heiglerhof.de` | `src/lib/schild.ts`, `src/lib/geo.ts`, `src/lib/strasse.ts` (User-Agent) |
| Texte und Tonfall | „Griaß di!“, „Dankschee und pfiat di!“, Allgäu | `kasse.tsx`, `schild.ts`, `page.tsx` |
| Farben und Schriften | Orange `#e48500`, Barlow Condensed, Vollkorn, Caveat Brush | `src/app/globals.css`, `src/lib/schild.ts`, `src/app/layout.tsx` |
| Bestellnummer-Präfix und Verwendungszweck | „HH 1023 Heiglerhof“ | `src/lib/checkout.ts`, `src/lib/paypal.ts` (invoice_id) |
| PayPal-Zugang | Vercel-Variablen (Client ID, Secret, Webhook ID) | `src/lib/env.ts`, `src/lib/paypal.ts` |
| Bankdaten | **schon in Admin → Einstellungen** (Tabelle `einstellungen`, Vercel nur als Rückfall) | `src/lib/giro.ts` |
| Benachrichtigungs-Mail | Vercel (`NOTIFY_EMAIL`, `RESEND_API_KEY`) | `src/lib/notify.ts`, `src/lib/env.ts` |
| Altersgrenze, Rechtstexte | Hinweis „ab 18“ im Code; Impressum und Datenschutz fehlen noch | `kasse.tsx`, `schild.ts` |

Vorbild für die Umsetzung: die Tabelle `einstellungen` und die Seite `Admin → Einstellungen`
(eingeführt mit 0006). Dort Spalten bzw. Abschnitte ergänzen:
Betrieb (Name, Adresse, Telefon, Website, Ansprechperson), Hofstandort (per Adresssuche wie bei
Verkaufsstellen), Logo-Upload (wie Partnerlogo, Bucket je Mandant), Farbe, Begrüßung und Dank,
Bestellpräfix, Rechtstexte, Benachrichtigungsadresse.

## 2. Mandantenfähigkeit (Datenmodell)

- Neue Tabelle `tenants` (id, slug, name, plan, status, created_at).
- `tenant_id uuid not null` in **allen** Tabellen: products, locations, location_products, orders,
  order_items, stock_alerts, einstellungen (dann eine Zeile je Mandant statt `id = 1`), admins.
- Eindeutigkeiten je Mandant: `unique (tenant_id, slug)` bei locations; Bestellnummern je Mandant
  (eigene Sequenz oder Zähler in `tenants`).
- RPCs `create_order` und `book_stock` bekommen `p_tenant` und prüfen ihn bei jeder Tabelle.
- Server bleibt beim Service Role Key, **jede** Abfrage filtert auf den Mandanten aus der Sitzung
  (zentraler Helfer `tdb(tenantId)` statt `db()`, damit kein Filter vergessen wird). Zusätzlich
  RLS-Policies mit `tenant_id` als zweite Sicherung.
- Admins: Tabelle `memberships (user_id, tenant_id, rolle)`; `requireAdmin()` liefert den Mandanten.
- Storage: Pfade mit `tenant_id/…` in `produktfotos` und `partner`.
- Tests: PGlite-Tests um „Mandant A sieht nichts von Mandant B“ erweitern.

## 3. Adressen und Domains

- Öffentliche Links: `/{mandant}/kasse/{stelle}` und `/{mandant}/karte` oder Subdomain
  `{mandant}.hofkasse.app`. Eigene Domain je Mandant später über Vercel Domains API.
- QR Codes und Schilder enthalten dann die Mandanten-URL.

## 4. PayPal je Mandant

Zwei Wege, Entscheidung offen:

1. **Mandant trägt eigene API-Zugangsdaten ein** (Client ID und Secret seiner PayPal-App).
   Einfach, aber für Laien schwer; Secret muss verschlüsselt gespeichert werden
   (z. B. Supabase Vault oder AES mit Schlüssel aus Vercel), nie im Klartext in der Tabelle.
2. **PayPal Partner-Onboarding (Plattform)**: Der Mandant klickt „Mit PayPal verbinden“, meldet
   sich bei PayPal an, wir bekommen eine Merchant ID und kassieren in seinem Namen. Komfortabel,
   braucht aber eine Freigabe als PayPal-Partner (App-Typ „Platform“) und PayPal-Prüfung.
   Konditionen und Freigabe vorher mit PayPal klären.

Webhook: eine URL für alle, Zuordnung über `custom_id`/Merchant ID.

## 5. Abo und Abrechnung

- Zahlungsanbieter fürs Abo, z. B. Stripe Billing (Checkout, Kundenportal, Webhooks) oder
  Paddle/Lemon Squeezy als Merchant of Record (übernimmt Umsatzsteuer).
- `tenants.plan` und `tenants.status` (trial, aktiv, überfällig, gekündigt) aus den Webhooks.
- Gesperrter Mandant: Kasse zeigt freundlichen Hinweis statt Produkten, Admin nur lesend.
- Planideen: Anzahl Verkaufsstellen, Produkte, Partnerwerbung, Tour, Überweisung.

## 6. Onboarding

Registrierung → E-Mail bestätigen → Assistent: Betrieb und Logo, Hofstandort, erste Produkte,
erste Verkaufsstelle, Zahlarten, Schild herunterladen. Testphase 14 bis 30 Tage.

## 7. Recht und Betrieb (vor dem Start prüfen lassen)

- AGB, Auftragsverarbeitungsvertrag (AVV/DPA) mit den Mandanten, Datenschutzerklärung,
  Impressum je Mandant auf der Kassenseite.
- Ob für elektronische Aufzeichnungen Pflichten aus GoBD oder Kassensicherungsverordnung
  (TSE) greifen, steuerlich beraten lassen. Hier nichts annehmen.
- Supabase und Vercel in der EU (Frankfurt) beibehalten, Backups und Wiederherstellung testen.
- Monitoring und Fehlerberichte (z. B. Sentry), Status- und Supportkanal.

## 8. Reihenfolge (Vorschlag)

1. Alles aus Abschnitt 1 in `einstellungen` ziehen, zunächst noch mit einem Mandanten.
2. `tenant_id` einführen und den Heiglerhof als ersten Mandanten migrieren.
3. Routen mit Mandant, Onboarding.
4. PayPal je Mandant.
5. Abo.
6. Rechtliches und Start mit 2 bis 3 Testhöfen.
