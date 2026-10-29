# Database migrations

`server/db.ts` is the source of truth for the schema. The live database and the
Drizzle model are kept identical; `npm run db:verify` fails if they drift.

## Current state

- `drizzle/0000_baseline.sql` describes the schema as it exists in production.
  It has been applied and recorded in `drizzle.__drizzle_migrations`.
- The server no longer runs DDL at boot. If a required table is missing it
  fails fast with a clear message instead of creating tables on the fly.
- `npm run build` never touches the database.

## Changing the schema

1. Edit `server/db.ts`.
2. `npm run db:generate -- --name <short_change_name>` — writes the next
   numbered SQL file under `drizzle/`.
3. Review the generated SQL. Destructive statements are rare but possible;
   take a Neon recovery point before applying one.
4. `npm run db:migrate` — applies pending migrations and records them.
5. `npm run db:verify` — must print `PARITY OK`.

Never edit an already-applied migration file; add a new one instead.
`npm run db:push` is an emergency escape hatch for local databases only and
must never be part of a build or deploy.
