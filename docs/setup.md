# Setup

1. Copy `.env.example` to `.env`
2. Install dependencies: `pnpm install`
3. Run database migrations: `pnpm db:migrate`
4. Optional seed data: `pnpm db:seed`
5. Optional Drizzle migration generation: `pnpm --filter @dataflow/api db:generate`
6. Start GUI: `pnpm dev:gui`
7. Start API: `pnpm dev:api`

Migration policy is documented in `docs/migration-strategy.md`.

Docker scaffold files are in `tooling/docker`.
