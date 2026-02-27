# DataFlow Studio

DataFlow Studio is a self-hosted, open-source, AI-powered collaborative database studio for teams working with relational databases.

## UI decision

The project standard is **shadcn/ui with Base UI** primitives.

- `packages/ui` is the shared component layer.
- `apps/web-gui` consumes shared primitives/components.
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

- Cloud runtime uses Polar billing (trial-first, no permanent free cloud plan).
- Self-host runtime has two editions:
  - Community (AGPL)
  - Enterprise (license key entitlements)
- Billing and licensing are separate paths:
  - Cloud: checkout/subscription/webhooks
  - Self-host Enterprise: license activation/status/deactivation
- AI access is mode-aware:
  - Cloud: requires active/trialing billing state
  - Self-host Community: BYOK model keys
  - Self-host Enterprise: requires active license with AI entitlement

Edition matrix and endpoint availability:

- `docs/edition-matrix.md`

## Licensing

- Community edition is licensed under `AGPL-3.0-only` (see [`LICENSE`](./LICENSE)).
- Enterprise/self-host commercial entitlements are managed through signed license keys.

## MVP scope

- OAuth-only auth (GitHub + Google)
- Workspace-based collaboration model
- Multi-relational connection management (`postgresql`, `mysql`, `sqlite`, `sqlserver`)
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
    web-gui/                # TanStack Start web app (landing page + workspace views)
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

- Auth: `/auth/oauth/github`, `/auth/oauth/google`, `/auth/oauth/callback`, `/auth/me`
- Workspaces: `/workspaces`, `/workspaces/:id/connect-db`, `/workspaces/:id/connect-db/test`, `/workspaces/:id/members`, `/workspaces/:id/members/invite`, `/workspaces/invitations/accept`
- Schema: `/workspaces/:id/schemas`, `/workspaces/:id/tables`, `/workspaces/:id/tables/:table`
- Queries: `/workspaces/:id/query`, `/workspaces/:id/query/cancel`, `/workspaces/:id/query/:executionId`, `/workspaces/:id/history`, `/workspaces/:id/save-query`
- AI: `/ai/generate-sql`, `/ai/explain-query`
- Billing (Polar cloud): `/billing/plans`, `/billing/checkout-session`, `/billing/portal-session`, `/billing/workspace/:workspaceId/usage`, `/billing/webhook/polar`
- Licensing (Enterprise/self-host): `/licenses/activate`, `/licenses/deactivate`, `/licenses/workspace/:workspaceId/status`
- Runtime gating:
  - Billing routes are enabled only in cloud mode.
  - Licensing routes are enabled only in self-host enterprise mode.

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
   pnpm dev:web-gui
   ```
6. Run API:
   ```bash
   pnpm dev:api
   ```

## Required environment variables

- `DEPLOYMENT_MODE` (`cloud` or `self-host`)
- `SELF_HOST_EDITION` (`community` or `enterprise`)
- `OAUTH_GITHUB_CLIENT_ID`
- `OAUTH_GITHUB_CLIENT_SECRET`
- `OAUTH_GOOGLE_CLIENT_ID`
- `OAUTH_GOOGLE_CLIENT_SECRET`
- `OAUTH_GITHUB_REDIRECT_URI` (optional override)
- `OAUTH_GOOGLE_REDIRECT_URI` (optional override)
- `REDIS_URL`
- `JWT_SECRET`
- `ENCRYPTION_SECRET`
- `AI_DEFAULT_PROVIDER` (optional)
- `AI_DEFAULT_MODEL` (optional)
- `AI_DEFAULT_TEMPERATURE` (optional)
- `OPENAI_API_KEY` (optional)
- `ANTHROPIC_API_KEY` (optional)
- `GOOGLE_GENERATIVE_AI_API_KEY` (optional)
- `AI_OPENAI_COMPATIBLE_API_KEY` (optional)
- `AI_OPENAI_COMPATIBLE_BASE_URL` (optional)
- `AI_PROVIDER_KEY` (legacy fallback, optional)
- `APP_DATABASE_URL`
- Cloud mode env:
  - `POLAR_ACCESS_TOKEN`
  - `POLAR_ORGANIZATION_ID`
  - `POLAR_WEBHOOK_SECRET`
  - `POLAR_CHECKOUT_BASE_URL`
  - `POLAR_PORTAL_BASE_URL`
  - `TRIAL_DAYS`
  - `CLOUD_TRIAL_SEAT_LIMIT`
  - `CLOUD_TRIAL_AI_REQUESTS_LIMIT`
  - `CLOUD_TRIAL_AI_TOKENS_LIMIT`
  - `CLOUD_PRO_SEAT_PRICE_CENTS`
  - `CLOUD_PRO_AI_REQUESTS_LIMIT`
  - `CLOUD_PRO_AI_TOKENS_LIMIT`
- Self-host enterprise mode env:
  - `LICENSE_VERIFICATION_SECRET`
  - `LICENSE_SYNC_GRACE_HOURS`

## Docker

Scaffolded deployment files are in `tooling/docker/`:

- `Dockerfile.web-gui`
- `Dockerfile.api`
- `docker-compose.yml`

## Project docs

- [Contributor guide](./contributors-guide.md)
- [Code of conduct](./code-of-conduct.md)
- [Security policy](./security-policy.md)
- [Support guide](./support-guide.md)
- [Changelog](./changelog.md)
- [Billing model](./docs/billing-model.md)
- [Edition matrix](./docs/edition-matrix.md)
- [License](./LICENSE)

## Status

Repository is in `api-foundation-v1` with `auth-session-core` implementation mode.

- Internal DB schema + migrations are implemented (SQL-first runtime, Drizzle schema/query layer).
- Workspace and billing API routes are wired to repositories/services with real DB reads/writes.
- OAuth/session core is implemented with GitHub/Google callback exchange and JWT-protected API middleware.
- Workspace membership flow includes invite/accept endpoints with seat-limit enforcement.
- DB connection test/save and schema/table metadata endpoints are implemented for multiple relational engines.
- Query engine execution/cancel, AI usage guardrails with real provider SDK integration, Polar webhook sync, and API rate limiting are implemented.
- Billing routes are cloud-only and license routes are self-host enterprise-only via runtime mode gating.
- Workspace bootstrap and seat/AI entitlement checks are mode-aware for Cloud Pro, Self-host Community, and Self-host Enterprise.
- Remaining major milestones: GUI workspace flows and end-to-end product polish.
