# Hofkasse Heiglerhof

Selbstbedienungskasse für Verkaufsstellen des Heiglerhofs (Ferienwohnungen, Hotels,
Verkaufskasten an der Hoftür). Gäste scannen den QR Code am Aufsteller, wählen
Produkte und zahlen mit PayPal oder legen Bargeld in die Kasse.

**Stack:** Next.js 16 (TypeScript, App Router) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · PayPal Orders API v2 · Vercel

## Grundsätze

- Der Browser schickt beim Bezahlen **nur** `location`, `product_id` und `quantity`.
  Preise lädt der Server aus Supabase und rechnet selbst (`src/lib/pricing.ts`).
  Die Datenbankfunktion `create_order` prüft Preis, Verfügbarkeit und Bestand noch einmal.
- Nach dem PayPal-Capture vergleicht der Server Status, Betrag, Währung und `custom_id`
  mit der gespeicherten Bestellung. Abweichung → Status `review` statt `paid`.
- Idempotent: `PayPal-Request-Id` bei Create und Capture, `paypal_order_id` und
  `paypal_capture_id` sind eindeutig, der Bestand wird je Bestellung genau einmal gebucht.
- Webhook `/api/paypal/webhook` (Signatur wird bei PayPal geprüft) fängt Zahlungen auf,
  falls der Gast das Fenster nach dem Bezahlen schließt.
- Alle Tabellen haben RLS ohne Policies. Lesen und Schreiben nur serverseitig mit dem
  Service Role Key. `PAYPAL_CLIENT_SECRET` und `SUPABASE_SERVICE_ROLE_KEY` existieren
  nur als Vercel-Umgebungsvariablen.
- Adminbereich: Supabase Auth (E-Mail + Passwort). Jede Seite und jede Server Action
  prüft `requireAdmin()` (angemeldet **und** in Tabelle `admins`).
- Produktfotos werden im Browser auf 800 × 800 px verkleinert und auf dem Server mit
  `sharp` neu kodiert (prüft das Bild, entfernt Metadaten wie GPS).

## Aufbau

```
src/app/kasse/[slug]        Gästeseite je Verkaufsstelle (QR Code)
src/app/api/checkout        PayPal-Order anlegen        (POST)
src/app/api/checkout/capture  Zahlung buchen und prüfen (POST)
src/app/api/checkout/cash   Barzahlung melden           (POST)
src/app/api/paypal/webhook  PayPal-Webhook              (POST)
src/app/api/cron/keepalive  täglicher Cron              (GET, CRON_SECRET)
src/app/admin/...           Bestellungen, Nachfüllen, Abrechnung, Produkte, Verkaufsstellen
src/lib/                    Preislogik, Validierung, PayPal, Supabase, Mail
supabase/migrations/        Datenbankschema mit Funktionen create_order und book_stock
supabase/tests/             Schematests gegen Postgres im Speicher (PGlite)
```

## Lokal

```bash
npm ci
cp .env.example .env.local   # Werte eintragen (Sandbox)
npm run dev
npm run check                # Lint, Typen, Tests
```

## Einrichtung

1. **Supabase**: Projekt in Region Frankfurt anlegen. Im SQL Editor
   alle Dateien aus `supabase/migrations/` der Reihe nach ausführen (0001, 0002, 0003 …). Admin-Nutzer unter
   Authentication → Users anlegen, dann `supabase/admin_anlegen.sql` ausführen.
   Unter Authentication → Sign In / Providers die Selbstregistrierung abschalten.
2. **PayPal**: Geschäftskonto, auf developer.paypal.com eine App anlegen (Sandbox und Live).
   Webhook auf `https://<domain>/api/paypal/webhook` mit den Ereignissen
   `PAYMENT.CAPTURE.COMPLETED` und `PAYMENT.CAPTURE.REFUNDED` anlegen, ID notieren.
3. **Vercel**: Repository importieren, Umgebungsvariablen aus `.env.example` setzen,
   Domain `hofkasse.heiglerhof.de` verbinden (CNAME beim Webhoster).
4. Erst mit Sandbox testen, dann `PAYPAL_API_BASE` und Zugangsdaten auf Live umstellen.
