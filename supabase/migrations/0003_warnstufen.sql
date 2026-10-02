-- Zwei Warnstufen: "knapp" (Ist auf Warnbestand oder darunter) und "leer" (Ist = 0).
-- Jede Stufe wird je Produkt und Verkaufsstelle genau einmal gemeldet:
-- erst beim Erreichen des Warnbestands, dann noch einmal, wenn es ganz leer ist.

alter table public.stock_alerts
  add column if not exists stufe text not null default 'knapp' check (stufe in ('knapp', 'leer'));

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
      select lp.location_id, lp.product_id, l.name as lname, p.name as pname, lp.ist as list, lp.soll as lsoll,
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

-- Nach dem Auffüllen darf wieder gemeldet werden: über dem Warnbestand ganz,
-- teilweise aufgefüllt (noch knapp, aber nicht mehr leer) zurück auf "knapp".
create or replace function public.clear_alert_on_refill() returns trigger language plpgsql as $$
begin
  if new.ist > new.warn then
    delete from stock_alerts where location_id = new.location_id and product_id = new.product_id;
  elsif new.ist > 0 then
    update stock_alerts set stufe = 'knapp'
     where location_id = new.location_id and product_id = new.product_id and stufe = 'leer';
  end if;
  return new;
end $$;
