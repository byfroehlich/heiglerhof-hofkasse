-- PayPal-Gebühr an Kunden weitergeben (nur bei PayPal, Bar und Überweisung bleiben ohne Aufschlag).
-- Gebühr in Basispunkten (299 = 2,99 %) plus fester Betrag in Cent. Anfangs aus, Einschalten unter Einstellungen.
alter table public.einstellungen
  add column if not exists paypal_gebuehr_aktiv     boolean not null default false,
  add column if not exists paypal_gebuehr_bp        integer not null default 299 check (paypal_gebuehr_bp between 0 and 1000),
  add column if not exists paypal_gebuehr_fix_cents integer not null default 39  check (paypal_gebuehr_fix_cents between 0 and 200);

-- Aufschlag je Bestellung getrennt vom Warenwert: total_cents bleibt der Warenwert (Umsatz),
-- PayPal bekommt total_cents + gebuehr_cents.
alter table public.orders
  add column if not exists gebuehr_cents integer not null default 0 check (gebuehr_cents between 0 and 10000);
