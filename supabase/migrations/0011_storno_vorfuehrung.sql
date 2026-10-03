-- Stornieren und Vorführmodus.
-- storniert: Kauf bleibt nachvollziehbar sichtbar, zählt aber nicht mehr (Umsatz, Abrechnung). Bestand optional zurück.
-- vorfuehrung: Kauf aus dem Vorführmodus im Admin, bucht keinen Bestand und zählt nie.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('created', 'paid', 'review', 'refunded', 'cash', 'cancelled', 'transfer', 'transfer_paid', 'storniert', 'vorfuehrung'));

alter table public.orders
  add column if not exists storno_grund      text check (storno_grund is null or char_length(storno_grund) <= 100),
  add column if not exists status_vor_storno text,
  add column if not exists storniert_am      timestamptz,
  add column if not exists storniert_von     text;

-- Bestellung anlegen: zusätzlich mit Status vorfuehrung (sonst unverändert)
create or replace function public.create_order(p_location uuid, p_status text, p_items jsonb)
returns table (order_id uuid, order_nr integer, total integer)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_nr integer; v_total integer := 0; it jsonb; v_price integer; v_name text; v_ist integer;
begin
  if p_status not in ('created', 'cash', 'transfer', 'vorfuehrung') then raise exception 'ungueltiger status'; end if;
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

-- Stornieren: nur Bar und Überweisung. PayPal wird in PayPal erstattet und kommt dann automatisch als „erstattet“.
create or replace function public.storno(p_order uuid, p_grund text, p_zurueck boolean, p_von text)
returns text language plpgsql security definer set search_path = public as $$
declare v_loc uuid; v_status text; v_booked boolean;
begin
  select location_id, status, stock_booked into v_loc, v_status, v_booked from orders where id = p_order for update;
  if v_status is null then return 'nicht gefunden'; end if;
  if v_status not in ('cash', 'transfer', 'transfer_paid') then return 'nicht stornierbar'; end if;
  if p_zurueck and v_booked then
    update location_products lp set ist = lp.ist + oi.quantity
      from order_items oi
     where oi.order_id = p_order and lp.location_id = v_loc and lp.product_id = oi.product_id;
  end if;
  update orders set status = 'storniert', status_vor_storno = v_status, storno_grund = left(nullif(trim(p_grund), ''), 100),
         storniert_am = now(), storniert_von = left(p_von, 200), stock_booked = stock_booked and not p_zurueck
   where id = p_order;
  return 'ok';
end $$;
revoke all on function public.storno(uuid, text, boolean, text) from public, anon, authenticated;
