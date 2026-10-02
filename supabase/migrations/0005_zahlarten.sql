-- Zahlarten je Verkaufsstelle an- und abschaltbar. Mindestens eine muss an sein.
alter table public.locations
  add column if not exists bar_aktiv    boolean not null default true,
  add column if not exists paypal_aktiv boolean not null default true;

alter table public.locations drop constraint if exists locations_eine_zahlart;
alter table public.locations add constraint locations_eine_zahlart check (bar_aktiv or paypal_aktiv);
