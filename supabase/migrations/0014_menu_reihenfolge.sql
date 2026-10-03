-- Reihenfolge der Bereiche auf dem Startbildschirm und in der Seitenleiste (Liste von Pfaden)
alter table public.einstellungen add column if not exists menu_reihenfolge text[];
