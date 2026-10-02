-- Zahlarten je Verkaufsstelle an- und abschaltbar: Bar, PayPal, Überweisung (GiroCode).
-- Mindestens eine Zahlart muss an sein. Überweisung ist anfangs aus.
alter table public.locations
  add column if not exists bar_aktiv          boolean not null default true,
  add column if not exists paypal_aktiv       boolean not null default true,
  add column if not exists ueberweisung_aktiv boolean not null default false;

alter table public.locations drop constraint if exists locations_eine_zahlart;
alter table public.locations add constraint locations_eine_zahlart check (bar_aktiv or paypal_aktiv or ueberweisung_aktiv);

-- Neue Bestellstatus: transfer = Überweisung angekündigt (offen), transfer_paid = Geld eingegangen
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('created', 'paid', 'review', 'refunded', 'cash', 'cancelled', 'transfer', 'transfer_paid'));

-- Bestellung anlegen: zusätzlich mit Status transfer; der Name auf dem Beleg enthält jetzt auch den Zusatz
create or replace function public.create_order(p_location uuid, p_status text, p_items jsonb)
returns table (order_id uuid, order_nr integer, total integer)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_nr integer; v_total integer := 0; it jsonb; v_price integer; v_name text; v_ist integer;
begin
  if p_status not in ('created', 'cash', 'transfer') then raise exception 'ungueltiger status'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then raise exception 'positionen'; end if;

  insert into orders (location_id, status, total_cents) values (p_location, p_status, 1)
    returning id, nr into v_id, v_nr;

  for it in select * from jsonb_array_elements(p_items) loop
    select p.price_cents, p.name || ' ' || case when p.einheit = 'ml'
             then replace(rtrim(to_char(p.inhalt / 1000.0, 'FM990.99'), '.'), '.', ',') || ' l'
             when p.inhalt >= 1000 then replace(rtrim(to_char(p.inhalt / 1000.0, 'FM990.99'), '.'), '.', ',') || ' kg'
             else p.inhalt || ' g' end
           || coalesce(' · ' || p.zusatz, ''),
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
revoke all on function public.create_order(uuid, text, jsonb) from public, anon, authenticated;

-- Bestand abbuchen: auch bei Überweisung, die Ware ist ja schon mitgenommen. Meldung nennt den Zusatz mit.
create or replace function public.book_stock(p_order uuid)
returns table (location_name text, product_name text, ist integer, soll integer)
language plpgsql security definer set search_path = public as $$
declare v_loc uuid;
begin
  update orders set stock_booked = true
   where id = p_order and not stock_booked and status in ('paid', 'cash', 'transfer', 'transfer_paid')
   returning location_id into v_loc;
  if v_loc is null then return; end if;

  update location_products lp
     set ist = greatest(0, lp.ist - oi.quantity)
    from order_items oi
   where oi.order_id = p_order and lp.location_id = v_loc and lp.product_id = oi.product_id;

  return query
    with low as (
      select lp.location_id, lp.product_id, l.name as lname, p.name || coalesce(' · ' || p.zusatz, '') as pname, lp.ist as list, lp.soll as lsoll,
             case when lp.ist = 0 then 'leer' else 'knapp' end as lstufe
        from location_products lp
        join locations l on l.id = lp.location_id
        join products p on p.id = lp.product_id
       where lp.location_id = v_loc
         and lp.product_id in (select product_id from order_items where order_id = p_order)
         and lp.ist <= lp.warn
    ), neu as (
      insert into stock_alerts as sa (location_id, product_id, stufe)
      select location_id, product_id, lstufe from low
      on conflict (location_id, product_id) do update set stufe = 'leer', sent_at = now()
        where sa.stufe = 'knapp' and excluded.stufe = 'leer'
      returning sa.location_id, sa.product_id
    )
    select low.lname, low.pname, low.list, low.lsoll
      from low join neu using (location_id, product_id);
end $$;
revoke all on function public.book_stock(uuid) from public, anon, authenticated;
