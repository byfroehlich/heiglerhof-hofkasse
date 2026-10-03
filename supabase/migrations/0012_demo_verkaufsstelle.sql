-- Demo-Verkaufsstelle: ganz normale Kasse zum Zeigen und Ausprobieren (Link weitergeben),
-- taucht aber nirgends in Umsatz, Abrechnung, Warnungen, Nachfüllen, Tour und Karte auf.
alter table public.locations add column if not exists demo boolean not null default false;

-- Käufe aus dem entfernten Vorführmodus aufräumen (zählten nie, haben keinen Bestand gebucht)
delete from public.orders where status = 'vorfuehrung';
