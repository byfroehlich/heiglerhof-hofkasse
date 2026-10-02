-- Adressen und Kartenposition je Verkaufsstelle, Sichtbarkeit auf der öffentlichen Karte,
-- Partnerlogo und optionale Werbung des Partners auf der Kassenseite.

alter table public.locations
  add column if not exists strasse       text check (strasse is null or char_length(strasse) <= 120),
  add column if not exists plz           text check (plz is null or plz ~ '^[0-9]{4,5}$'),
  add column if not exists lat           double precision check (lat is null or lat between -90 and 90),
  add column if not exists lng           double precision check (lng is null or lng between -180 and 180),
  add column if not exists oeffentlich   boolean not null default false,
  add column if not exists hinweis       text check (hinweis is null or char_length(hinweis) <= 200),
  add column if not exists logo_path     text,
  add column if not exists werbung_bild  text,
  add column if not exists werbung_text  text check (werbung_text is null or char_length(werbung_text) <= 300),
  add column if not exists werbung_link  text check (werbung_link is null or werbung_link ~ '^https://');

-- Bisherige Stellen: alles außer Ferienwohnungen kommt auf die Karte
update public.locations set oeffentlich = true where typ <> 'Ferienwohnung';

-- Öffentlich lesbare Partnerbilder, Schreiben nur serverseitig
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner', 'partner', true, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
