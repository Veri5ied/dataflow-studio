# Migration Strategy

DataFlow Studio uses a hybrid migration strategy.

## Decision

- Baseline and critical migrations are committed as raw SQL files in `apps/api/db/migrations`.
- Drizzle is the typed ORM/query layer in API code.
- New schema changes should be generated with `drizzle-kit` and committed as SQL migration files.
- Runtime migration application remains SQL-first through `tooling/scripts/migrate.sh`.

## Why this approach

- Keeps deployment deterministic for self-hosted operators.
- Preserves direct SQL review/audit in pull requests.
- Maintains typed developer ergonomics in application code with Drizzle.

## Workflow

1. Update Drizzle schema in `apps/api/src/db/schema.ts`.
2. Generate SQL migration: `pnpm --filter @dataflow/api db:generate`.
3. Review generated SQL and adjust if needed.
4. Apply migrations locally: `pnpm db:migrate`.
5. Run seed if needed: `pnpm db:seed`.
6. Commit schema + migration files together.
