-- Push-Mitteilungen für die Admin-App (Web Push).
-- Die VAPID-Schlüssel erzeugt der Server beim ersten Einschalten selbst und legt sie hier ab.
alter table public.einstellungen
  add column if not exists vapid_public  text,
  add column if not exists vapid_private text;

create table if not exists public.push_abos (
  id          uuid primary key default gen_random_uuid(),
  endpoint    text not null unique check (endpoint ~ '^https://'),
  p256dh      text not null,
  auth        text not null,
  user_id     uuid references auth.users(id) on delete cascade,
  email       text,
  geraet      text check (geraet is null or char_length(geraet) <= 120),
  kauf        boolean not null default true,
  knapp       boolean not null default true,
  leer        boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.push_abos enable row level security;
