-- Hofkasse Heiglerhof: Grundschema
-- Alle Tabellen haben RLS aktiv und KEINE Policies für anon/authenticated.
-- Gelesen und geschrieben wird ausschließlich serverseitig mit dem Service Role Key.


-- Produkte ------------------------------------------------------------------
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  zusatz       text check (zusatz is null or char_length(zusatz) <= 120),
  inhalt       integer not null check (inhalt > 0),            -- Menge in g oder ml
  einheit      text not null check (einheit in ('g', 'ml')),
  price_cents  integer not null check (price_cents > 0 and price_cents <= 99900),
  alkohol_vol  numeric(4,1) check (alkohol_vol is null or (alkohol_vol > 0 and alkohol_vol < 100)),
  farbe        text not null default '#e48500' check (farbe ~ '^#[0-9a-fA-F]{6}$'),
  foto_path    text,                                           -- Pfad im Storage-Bucket "produktfotos"
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Verkaufsstellen (Ferienwohnung, Hotel, Verkaufskasten, Laden) -------------
create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]{2,32}$'),
  name         text not null check (char_length(name) between 1 and 80),
  typ          text not null check (typ in ('Ferienwohnung', 'Hotel', 'Verkaufskasten', 'Laden')),
  ort          text,
  active       boolean not null default true,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Sortiment und Bestand je Verkaufsstelle -----------------------------------
create table public.location_products (
  location_id  uuid not null references public.locations(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete restrict,
  ist          integer not null default 0 check (ist >= 0),
  soll         integer not null default 4 check (soll >= 1),
  primary key (location_id, product_id)
);

-- Bestellungen ----------------------------------------------------------------
create sequence public.order_nr_seq start 1000;

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  nr                 integer not null unique default nextval('public.order_nr_seq'),
  location_id        uuid not null references public.locations(id) on delete restrict,
  status             text not null check (status in ('created', 'paid', 'review', 'refunded', 'cash', 'cancelled')),
  total_cents        integer not null check (total_cents > 0),
  currency           text not null default 'EUR' check (currency = 'EUR'),
  paypal_order_id    text unique,
  paypal_capture_id  text unique,
  stock_booked       boolean not null default false,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index orders_location_created on public.orders (location_id, created_at desc);
create index orders_status on public.orders (status);

create table public.order_items (
  order_id          uuid not null references public.orders(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict,
  name_snapshot     text not null,
  unit_price_cents  integer not null check (unit_price_cents > 0),
  quantity          integer not null check (quantity between 1 and 10),
  primary key (order_id, product_id)
);

-- Admins: Supabase-Auth-Nutzer, die den Adminbereich sehen dürfen ------------
create table public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text not null
);

-- Merker, damit jede Nachfüllmeldung nur einmal verschickt wird -------------
create table public.stock_alerts (
  location_id  uuid not null references public.locations(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  sent_at      timestamptz not null default now(),
  primary key (location_id, product_id)
);

-- RLS überall an, keine Policies => anon/authenticated sehen nichts ---------
alter table public.products          enable row level security;
alter table public.locations         enable row level security;
alter table public.location_products enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.admins            enable row level security;
alter table public.stock_alerts      enable row level security;

-- updated_at pflegen -----------------------------------------------------------
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Bestellung anlegen (atomar: Kopf + Positionen) ----------------------------
-- Preise und Summe kommen vom Server (Next.js), der sie aus products geladen hat.
-- Die Funktion prüft trotzdem noch einmal gegen die Datenbank.
create function public.create_order(p_location uuid, p_status text, p_items jsonb)
returns table (order_id uuid, order_nr integer, total integer)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_nr integer; v_total integer := 0; it jsonb; v_price integer; v_name text; v_ist integer;
begin
  if p_status not in ('created', 'cash') then raise exception 'ungueltiger status'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then raise exception 'positionen'; end if;

  insert into orders (location_id, status, total_cents) values (p_location, p_status, 1)
    returning id, nr into v_id, v_nr;

  for it in select * from jsonb_array_elements(p_items) loop
    select p.price_cents, p.name || ' ' || case when p.einheit = 'ml'
             then replace(rtrim(to_char(p.inhalt / 1000.0, 'FM990.99'), '.'), '.', ',') || ' l'
             when p.inhalt >= 1000 then replace(rtrim(to_char(p.inhalt / 1000.0, 'FM990.99'), '.'), '.', ',') || ' kg'
             else p.inhalt || ' g' end,
           lp.ist
      into v_price, v_name, v_ist
      from products p
      join location_products lp on lp.product_id = p.id and lp.location_id = p_location
      join locations l on l.id = p_location and l.active
     where p.id = (it->>'product_id')::uuid and p.active;
    if v_price is null then raise exception 'produkt nicht verfuegbar'; end if;
    if v_price <> (it->>'unit_price_cents')::integer then raise exception 'preis geaendert'; end if;
    if (it->>'quantity')::integer > v_ist then raise exception 'bestand'; end if;
    insert into order_items (order_id, product_id, name_snapshot, unit_price_cents, quantity)
      values (v_id, (it->>'product_id')::uuid, v_name, v_price, (it->>'quantity')::integer);
    v_total := v_total + v_price * (it->>'quantity')::integer;
  end loop;

  update orders set total_cents = v_total, paid_at = case when p_status = 'cash' then now() end where id = v_id;
  return query select v_id, v_nr, v_total;
end $$;

-- Bestand abbuchen, genau einmal je Bestellung --------------------------------
-- Gibt die Produkte zurück, die dadurch den Meldebestand (30 % vom Soll) erreicht haben.
create function public.book_stock(p_order uuid)
returns table (location_name text, product_name text, ist integer, soll integer)
language plpgsql security definer set search_path = public as $$
declare v_loc uuid;
begin
  update orders set stock_booked = true
   where id = p_order and not stock_booked and status in ('paid', 'cash')
   returning location_id into v_loc;
  if v_loc is null then return; end if;

  update location_products lp
     set ist = greatest(0, lp.ist - oi.quantity)
    from order_items oi
   where oi.order_id = p_order and lp.location_id = v_loc and lp.product_id = oi.product_id;

  return query
    with low as (
      select lp.location_id, lp.product_id, l.name as lname, p.name as pname, lp.ist, lp.soll
        from location_products lp
        join locations l on l.id = lp.location_id
        join products p on p.id = lp.product_id
       where lp.location_id = v_loc
         and lp.product_id in (select product_id from order_items where order_id = p_order)
         and lp.ist <= greatest(1, ceil(lp.soll * 0.3))
    ), neu as (
      insert into stock_alerts (location_id, product_id)
      select location_id, product_id from low
      on conflict do nothing
      returning location_id, product_id
    )
    select low.lname, low.pname, low.ist, low.soll
      from low join neu using (location_id, product_id);
end $$;

-- Nach dem Auffüllen darf wieder gemeldet werden
create function public.clear_alert_on_refill() returns trigger language plpgsql as $$
begin
  if new.ist > greatest(1, ceil(new.soll * 0.3)) then
    delete from stock_alerts where location_id = new.location_id and product_id = new.product_id;
  end if;
  return new;
end $$;
create trigger location_products_refill after update of ist, soll on public.location_products
  for each row execute function public.clear_alert_on_refill();

-- Funktionen nur für den Service Role Key ------------------------------------
revoke all on function public.create_order(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.book_stock(uuid) from public, anon, authenticated;

-- Storage: öffentlich lesbare Produktfotos, Schreiben nur serverseitig ------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produktfotos', 'produktfotos', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
