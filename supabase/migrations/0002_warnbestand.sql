-- Warnbestand je Produkt und Verkaufsstelle (feste Menge statt 30 % vom Soll).
-- Gewarnt wird, sobald der Istbestand auf den Warnbestand oder darunter fällt.

alter table public.location_products
  add column if not exists warn integer not null default 1 check (warn >= 0);

-- Bisheriges Verhalten (30 % vom Soll) als Startwert übernehmen
update public.location_products set warn = greatest(1, ceil(soll * 0.3))::integer;

create or replace function public.book_stock(p_order uuid)
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
         and lp.ist <= lp.warn
    ), neu as (
      insert into stock_alerts (location_id, product_id)
      select location_id, product_id from low
      on conflict do nothing
      returning location_id, product_id
    )
    select low.lname, low.pname, low.ist, low.soll
      from low join neu using (location_id, product_id);
end $$;
revoke all on function public.book_stock(uuid) from public, anon, authenticated;

create or replace function public.clear_alert_on_refill() returns trigger language plpgsql as $$
begin
  if new.ist > new.warn then
    delete from stock_alerts where location_id = new.location_id and product_id = new.product_id;
  end if;
  return new;
end $$;

drop trigger if exists location_products_refill on public.location_products;
create trigger location_products_refill after update of ist, soll, warn on public.location_products
  for each row execute function public.clear_alert_on_refill();
