-- Protokoll der Push-Mitteilungen (zur Fehlersuche), nur serverseitig lesbar.
create table if not exists public.push_protokoll (
  id          bigint generated always as identity primary key,
  zeit        timestamptz not null default now(),
  art         text not null,
  titel       text not null,
  geraete     integer not null default 0,
  erreicht    integer not null default 0,
  fehler      text
);
alter table public.push_protokoll enable row level security;
create index if not exists push_protokoll_zeit on public.push_protokoll (zeit desc);
