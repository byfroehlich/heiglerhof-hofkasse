-- Ansprechpartner für Gäste (Kasse nach dem Kauf, Karte, Verkaufsschild). In den Einstellungen änderbar.
alter table public.einstellungen
  add column if not exists kontakt_name    text check (kontakt_name is null or char_length(kontakt_name) between 1 and 40),
  add column if not exists kontakt_telefon text check (kontakt_telefon is null or kontakt_telefon ~ '^\+?[0-9 /]{6,25}$');
