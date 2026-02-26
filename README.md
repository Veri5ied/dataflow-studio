# DataFlow Studio

DataFlow Studio is a self-hosted, open-source, AI-powered collaborative database studio for teams working with relational databases.

## UI decision

The project standard is **shadcn/ui with Base UI** primitives.

- `packages/ui` is the shared component layer.
- `apps/gui` consumes shared primitives/components.
- UI should follow shadcn-style composition patterns and tokenized Tailwind design.
- Base UI primitives are the default low-level building blocks for accessibility and behavior.

Implementation details and conventions are documented in:
- `docs/ui-system.md`

## Product requirements and roadmap

The full PRD (including MVP scope, API contracts, non-functional requirements, and future roadmap) is tracked in:

- `docs/product-requirements.md`

Commercial model details are tracked in:

- `docs/billing-model.md`
- `docs/migration-strategy.md`

## Commercial model

- One billing engine with two offers:
  - Cloud Pro (self-serve)
  - Enterprise (sales-led)
- Billing providers: Stripe or Polar (polar.sh)
- No permanent free cloud plan. Cloud onboarding is trial-first.
- AI is metered by workspace quota/credits, not unlimited by default.
- Self-hosted deployments remain supported; paid self-host is part of enterprise licensing strategy.

## MVP scope

- OAuth-only auth (GitHub + Google)
- Workspace-based collaboration model
- PostgreSQL connection management
- API data layer with Drizzle ORM and SQL migrations
- Schema explorer and table metadata
- SQL editor and query execution flow
- Query history and saved queries
- AI SQL generation and SQL explanation
- Docker-first self-hosting path

## Monorepo layout

```text
dataflow-studio/
  apps/
    gui/                    # Next.js web app (landing page + workspace views)
    api/                    # Hono API
  packages/
    ui/                     # Shared UI components (shadcn + Base UI)
    db-connectors/          # DB connector abstractions
    ai-engine/              # AI orchestration layer
    shared-types/           # Shared TS interfaces
    config/                 # Shared env/config utilities
    utils/                  # Logging, encryption, cache utilities
  tooling/
    docker/
    ci-cd/
    k8s/
    scripts/
    eslint/
    tsconfig/
    prettier/
  docs/
```

## API routes (MVP)

All backend routes are under `/api/v1`.

- Auth: `/auth/oauth/github`, `/auth/oauth/google`, `/auth/oauth/callback`
- Workspaces: `/workspaces`, `/workspaces/:id/connect-db`
- Schema: `/workspaces/:id/schemas`, `/workspaces/:id/tables/:table`
- Queries: `/workspaces/:id/query`, `/workspaces/:id/history`, `/workspaces/:id/save-query`
- AI: `/ai/generate-sql`, `/ai/explain-query`
- Billing: `/billing/plans`, `/billing/checkout-session`, `/billing/portal-session`, `/billing/workspace/:workspaceId/usage`, `/billing/webhook/stripe`, `/billing/webhook/polar`

## Local development

### Prerequisites

- Node.js 22+
- pnpm 9+

### Setup

1. Create env file:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run database migrations:
   ```bash
   pnpm db:migrate
   ```
4. Optional seed data:
   ```bash
   pnpm db:seed
   ```
5. Run GUI:
   ```bash
   pnpm dev:gui
   ```
6. Run API:
   ```bash
   pnpm dev:api
   ```

## Required environment variables

- `OAUTH_GITHUB_CLIENT_ID`
- `OAUTH_GITHUB_CLIENT_SECRET`
- `OAUTH_GOOGLE_CLIENT_ID`
- `OAUTH_GOOGLE_CLIENT_SECRET`
- `REDIS_URL`
- `JWT_SECRET`
- `ENCRYPTION_SECRET`
- `AI_PROVIDER_KEY`
- `APP_DATABASE_URL`
- `BILLING_PROVIDER`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `POLAR_ACCESS_TOKEN`
- `POLAR_ORGANIZATION_ID`
- `POLAR_WEBHOOK_SECRET`
- `TRIAL_DAYS`

## Docker

Scaffolded deployment files are in `tooling/docker/`:

- `Dockerfile.gui`
- `Dockerfile.api`
- `docker-compose.yml`

## Project docs

- [Contributor guide](./contributors-guide.md)
- [Code of conduct](./code-of-conduct.md)
- [Security policy](./security-policy.md)
- [Support guide](./support-guide.md)
- [Changelog](./changelog.md)
- [Billing model](./docs/billing-model.md)
- [License](./LICENSE)

## Status

Repository is in `api-foundation-v1` implementation mode.

- Internal DB schema + migrations are implemented (SQL-first runtime, Drizzle schema/query layer).
- Workspace and billing API routes are wired to repositories/services with real DB reads/writes.
- Remaining major milestones: OAuth/session core, query engine execution/cancel flow, AI guardrails, and hardening.
