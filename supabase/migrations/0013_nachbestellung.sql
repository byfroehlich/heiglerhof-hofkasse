-- Wiederverkäufer: kaufen auf Rechnung und bestellen über einen eigenen, geheimen Link nach.
-- Keine Kundenkasse, kein Bestand in der App. Nachbestellungen kommen als Auftrag beim Hof an.
alter table public.locations
  add column if not exists wiederverkaeufer  boolean not null default false,
  add column if not exists nachbestell_token text unique check (nachbestell_token is null or nachbestell_token ~ '^[A-Za-z0-9_-]{24,64}$');

-- Händlerpreis je Produkt (optional), erscheint in Nachbestellung und Lieferschein
alter table public.products
  add column if not exists haendler_cents integer check (haendler_cents is null or haendler_cents between 1 and 99900);

create sequence if not exists public.nachbestell_nr_seq start 1001;

create table if not exists public.nachbestellungen (
  id            uuid primary key default gen_random_uuid(),
  nr            integer not null unique default nextval('public.nachbestell_nr_seq'),
  location_id   uuid not null references public.locations(id) on delete restrict,
  status        text not null default 'offen' check (status in ('offen', 'geliefert', 'erledigt', 'storniert')),
  notiz         text check (notiz is null or char_length(notiz) <= 500),
  summe_cents   integer not null default 0,
  created_at    timestamptz not null default now(),
  geliefert_am  timestamptz,
  erledigt_am   timestamptz
);
create index if not exists nachbestellungen_status on public.nachbestellungen (status, created_at desc);

create table if not exists public.nachbestell_positionen (
  nachbestellung_id uuid not null references public.nachbestellungen(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict,
  name_snapshot     text not null,
  haendler_cents    integer,
  menge             integer not null check (menge between 1 and 99),
  primary key (nachbestellung_id, product_id)
);

alter table public.nachbestellungen       enable row level security;
alter table public.nachbestell_positionen enable row level security;

-- Eigene Push-Art „Nachbestellung“ (anfangs für alle Geräte an)
alter table public.push_abos add column if not exists nachbestellung boolean not null default true;

-- Nachbestellung anlegen: nur über gültigen Link einer aktiven Wiederverkäufer-Stelle,
-- nur Produkte aus deren Sortiment. Name und Händlerpreis werden festgehalten.
create or replace function public.create_nachbestellung(p_token text, p_items jsonb, p_notiz text)
returns table (n_id uuid, n_nr integer, n_stelle text, n_summe integer)
language plpgsql security definer set search_path = public as $$
declare
  v_loc uuid; v_stelle text; v_id uuid; v_nr integer; it jsonb; v_name text; v_preis integer; v_menge integer; v_summe integer := 0;
begin
  select l.id, l.name into v_loc, v_stelle from locations l
   where l.nachbestell_token = p_token and l.active and l.wiederverkaeufer;
  if v_loc is null then raise exception 'link ungueltig'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then raise exception 'positionen'; end if;

  insert into nachbestellungen (location_id, notiz) values (v_loc, left(nullif(trim(p_notiz), ''), 500))
    returning id, nr into v_id, v_nr;

  for it in select * from jsonb_array_elements(p_items) loop
    v_name := null;
    v_menge := (it->>'menge')::integer;
    select p.name || ' ' || case when p.einheit = 'ml'
             then replace(rtrim(to_char(p.inhalt / 1000.0, 'FM990.99'), '.'), '.', ',') || ' l'
             when p.inhalt >= 1000 then replace(rtrim(to_char(p.inhalt / 1000.0, 'FM990.99'), '.'), '.', ',') || ' kg'
             else p.inhalt || ' g' end
           || coalesce(' · ' || p.zusatz, ''),
           p.haendler_cents
      into v_name, v_preis
      from products p
      join location_products lp on lp.product_id = p.id and lp.location_id = v_loc
     where p.id = (it->>'product_id')::uuid and p.active;
    if v_name is null then raise exception 'produkt nicht verfuegbar'; end if;
    insert into nachbestell_positionen (nachbestellung_id, product_id, name_snapshot, haendler_cents, menge)
      values (v_id, (it->>'product_id')::uuid, v_name, v_preis, v_menge);
    v_summe := v_summe + coalesce(v_preis, 0) * v_menge;
  end loop;

  update nachbestellungen set summe_cents = v_summe where id = v_id;
  return query select v_id, v_nr, v_stelle, v_summe;
end $$;
revoke all on function public.create_nachbestellung(text, jsonb, text) from public, anon, authenticated;
