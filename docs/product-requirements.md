# DataFlow Studio Product Requirements (PRD)

## 1. Product overview

**DataFlow Studio** is a self-hosted, open-source, AI-powered collaborative database studio.

It enables teams to connect, explore, query, and manage relational databases from a modern web interface.

- Authentication: OAuth-only (GitHub and Google)
- Architecture: Nx monorepo
- Deployment: self-hosted, Docker-ready
- Frontend: TanStack Start web GUI
- Backend: Node.js + Hono
- AI: LLM-powered SQL generation/explanation
- Database support: relational engine abstraction with built-in connectors (`postgresql`, `mysql`, `sqlite`, `sqlserver`)
- Commercial strategy:
  - Cloud Pro: Polar billing + paid seats + trial-first onboarding
  - Self-host Community: AGPL runtime, no in-app billing
  - Self-host Enterprise: signed license key entitlements

The landing page lives in `apps/web-gui` at route `/`, isolated from workspace dashboards.

## 2. Monorepo structure

```text
dataflow-studio/
  apps/
    web-gui/
      pages/
        index.tsx
        workspace/
          [workspace-id]/
            index.tsx
            sql-editor.tsx
            tables.tsx
            history.tsx
            ai.tsx
    api/
  packages/
    ui/
    db-connectors/
    ai-engine/
    shared-types/
    config/
    utils/
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

## 3. Technology stack

### 3.1 Frontend (Web GUI)

- TanStack Start
- TypeScript
- Tailwind CSS
- React Query (`@tanstack/react-query`)
- Monaco Editor (SQL editing)
- Shared components from `packages/ui`
- Sidebar schema explorer
- Table preview and inline editing
- Query history and saved queries
- Landing page at `/`

### 3.2 UI system decision

DataFlow Studio UI standard is:

- **shadcn/ui composition patterns**
- **Base UI primitives** as default low-level interaction/accessibility layer
- Shared reusable UI in `packages/ui`

Reference: `docs/ui-system.md`

### 3.3 Backend (API)

- Hono
- REST API (GraphQL optional later)
- Drizzle ORM (typed query layer)
- Zod validation
- Redis for caching, AI throttling, session support
- Connection pooling for external DBs
- Structured logging (pino or equivalent)
- OAuth session management with internal JWT

### 3.4 Internal app database

- PostgreSQL for app-level metadata:
  - users
  - workspaces
  - workspace_memberships
  - db_connections
  - saved_queries
  - query_history
  - billing_accounts
  - subscriptions
  - usage_counters
  - webhook_events
- Redis for ephemeral/session/cache workloads

### 3.5 AI engine

Located in `packages/ai-engine` and responsible for:

- English to SQL conversion
- SQL explanation
- Optimization suggestions
- Schema-aware prompt context
- Provider configuration, logging, and throttling

### 3.6 Billing and subscription layer

- Deployment mode contract:
  - `DEPLOYMENT_MODE=cloud` enables cloud billing APIs
  - `DEPLOYMENT_MODE=self-host` disables billing APIs
- Self-host edition contract:
  - `SELF_HOST_EDITION=community` disables enterprise licensing APIs
  - `SELF_HOST_EDITION=enterprise` enables enterprise licensing APIs
- Cloud billing provider: Polar (polar.sh)
- No permanent free cloud tier; trial-first onboarding
- Seat-based subscriptions with workspace-level ownership in cloud mode
- AI usage metering and quota checks per workspace
- Enterprise self-host licensing path with activation + entitlement checks

## 4. Authentication and authorization

- OAuth-only login (GitHub and Google)
- No email/password auth for MVP
- JWT-backed internal sessions
- Multi-workspace support with admin roles
- Encrypted-at-rest workspace DB credentials

## 5. Core feature requirements

### 5.1 Workspaces

- Create, edit, and delete workspaces
- Connect relational databases (`postgresql`, `mysql`, `sqlite`, `sqlserver`)
- Multi-user workspace support
- Phase 2: invitations and RBAC

### 5.2 Database management

- Schema explorer: schemas -> tables -> columns
- Table metadata (index and type details)
- Paginated data preview (default 50 rows/request)
- SQL editor with:
  - Multi-tab support
  - Execute and cancel query
  - Results rendering
  - Inline error handling
  - Save query per workspace

### 5.3 Query history

Log executed queries per workspace including:

- Execution time
- Success/failure state
- Rows returned

### 5.4 AI features

- Generate SQL from natural language
- Explain SQL queries
- Suggest query optimizations

## 6. API endpoints (MVP)

All routes under `/api/v1`.

### Auth

- `GET /auth/oauth/github`
- `GET /auth/oauth/google`
- OAuth callback for code exchange to JWT

### Workspace

- `GET /workspaces`
- `POST /workspaces`
- `POST /workspaces/:id/connect-db`

### Schema

- `GET /workspaces/:id/schemas`
- `GET /workspaces/:id/tables/:table`

### Queries

- `POST /workspaces/:id/query`
- `GET /workspaces/:id/history`
- `POST /workspaces/:id/save-query`

### AI

- `POST /ai/generate-sql`
- `POST /ai/explain-query`

### Billing

- `GET /billing/plans`
- `POST /billing/checkout-session`
- `POST /billing/portal-session`
- `GET /billing/workspace/:workspaceId/subscription`
- `GET /billing/workspace/:workspaceId/usage`

All endpoints protected by OAuth JWT session middleware.

## 7. Frontend architecture

- Folder root: `apps/web-gui`
- Landing page: `pages/index.tsx`
- Workspace pages: `pages/workspace/[workspace-id]/`
- React Query for schema, query, history, and AI requests
- Global contexts:
  - AuthContext
  - WorkspaceContext
  - AIContext
- Shared UI imported from `packages/ui`

## 8. Tooling and operations

### 8.1 Docker and deployment

`tooling/docker/` contains:

- `Dockerfile.web-gui`
- `Dockerfile.api`
- `docker-compose.yml`

### 8.2 CI/CD

`tooling/ci-cd/` includes templates for:

- Build/test across apps and packages
- Linting and formatting checks
- Docker image build automation

### 8.3 Kubernetes (future-ready)

`tooling/k8s/` includes manifests for:

- Frontend deployment
- API deployment
- Redis service

### 8.4 Scripts

`tooling/scripts/` provides scaffolds for:

- Migrations and seeding
- Setup helpers
- Local bootstrap
- Runtime migration application remains SQL-first; schema evolution can be generated via Drizzle kit

## 9. Non-functional requirements

### Performance

- Cache schema metadata in Redis (TTL: 5 min)
- Web GUI initial load target < 2s

### Security

- Encrypt OAuth and DB credentials
- Validate SQL inputs/guards against injection risk
- Apply API and AI rate limiting

### Scalability

- Stateless backend
- Redis caching layer
- Pooled database connections

### Observability

- Structured logs
- Query latency metrics
- AI usage logs

## 10. Self-hosted deployment

- Full self-host support via Docker Compose
- Redis optional but recommended
- Base env variables:
  - `DEPLOYMENT_MODE`
  - `SELF_HOST_EDITION`
  - `OAUTH_GITHUB_CLIENT_ID`
  - `OAUTH_GITHUB_CLIENT_SECRET`
  - `OAUTH_GOOGLE_CLIENT_ID`
  - `OAUTH_GOOGLE_CLIENT_SECRET`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `ENCRYPTION_SECRET`
  - `AI_DEFAULT_PROVIDER` (optional)
  - `AI_DEFAULT_MODEL` (optional)
  - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` (optional, based on provider)
  - `AI_OPENAI_COMPATIBLE_API_KEY` / `AI_OPENAI_COMPATIBLE_BASE_URL` (optional, for OpenAI-compatible endpoints)
- Cloud mode env:
  - `POLAR_ACCESS_TOKEN`
  - `POLAR_ORGANIZATION_ID`
  - `POLAR_WEBHOOK_SECRET`
  - `POLAR_CHECKOUT_BASE_URL` / `POLAR_PORTAL_BASE_URL`
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

## 11. MVP acceptance criteria

- GitHub and Google OAuth login works
- User can create workspace
- User can connect relational DBs (`postgresql`, `mysql`, `sqlite`, `sqlserver`)
- User can browse schema/tables/columns
- User can execute SQL and view results
- User can save queries
- AI can generate and explain SQL
- Query history logs correctly per workspace
- Trial starts on cloud workspace creation and paywall is enforced post-trial
- Seat counts are enforced on membership acceptance
- AI usage is metered with per-plan quota enforcement
- Nx modular boundaries are enforced
- Docker Compose deployment works
- Tooling folder includes setup, deployment, and CI/CD scripts

## 12. Future roadmap

- Additional relational adapters beyond the initial built-ins
- Real-time collaboration (CRDT/WebSocket)
- Workspace-level role permissions
- Visual query builder
- ER diagram generation
- Plugin architecture
- Desktop client (Tauri)
- Annual usage commitments and enterprise invoicing automation
