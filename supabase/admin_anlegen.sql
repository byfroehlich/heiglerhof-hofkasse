-- Admin freischalten: zuerst in Supabase unter Authentication → Users den Nutzer
-- mit E-Mail und Passwort anlegen, dann hier die E-Mail eintragen und ausführen.
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'steffi@example.de'
on conflict (user_id) do nothing;
