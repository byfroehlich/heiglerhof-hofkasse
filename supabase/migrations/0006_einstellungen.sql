-- Einstellungen im Adminbereich (eine Zeile). Zuerst: Bankdaten für die Überweisung.
-- Nur serverseitig lesbar (RLS an, keine Policies). Jede Änderung wird mit Zeit und Admin gemerkt.
create table if not exists public.einstellungen (
  id                smallint primary key default 1 check (id = 1),
  iban              text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  empfaenger        text check (empfaenger is null or char_length(empfaenger) between 1 and 70),
  bic               text check (bic is null or bic ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),
  geaendert_am      timestamptz,
  geaendert_von     text
);
alter table public.einstellungen enable row level security;
insert into public.einstellungen (id) values (1) on conflict (id) do nothing;
