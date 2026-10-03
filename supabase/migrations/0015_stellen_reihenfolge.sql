-- Eigene Reihenfolge der Verkaufsstellen in der Admin-Liste (mit ▲ ▼ verschoben). Leer = nach Name.
alter table public.locations add column if not exists reihenfolge integer;
