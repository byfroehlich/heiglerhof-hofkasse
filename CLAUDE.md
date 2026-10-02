@AGENTS.md

## Projektregeln Hofkasse

- Beträge immer in Cent (Integer). Nie Preise oder Summen vom Client annehmen.
- Datenbankzugriff nur über `db()` aus `src/lib/supabase.ts` in Servercode; nie in Client Components.
- Jede Admin-Seite und jede Server Action beginnt mit `requireAdmin()`.
- Schemaänderungen als neue Datei in `supabase/migrations/`, Test in `supabase/tests/` ergänzen.
- Vor jedem Commit: `npm run check`.
- Texte für Gäste: herzlich, du/ihr, keine Bindestriche als Gedankenstriche.
