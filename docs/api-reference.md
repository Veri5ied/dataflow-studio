# API Reference

All routes are grouped under `/api/v1` in the API app.

## Auth

- `GET /auth/oauth/github`
- `GET /auth/oauth/google`
- `GET /auth/oauth/callback`
- `POST /auth/dev/session` (development/testing only)
- `GET /auth/me`

## Workspaces

- `GET /workspaces`
- `POST /workspaces`
- `POST /workspaces/:id/connect-db`
- `POST /workspaces/:id/connect-db/test`
- `GET /workspaces/:id/members`
- `GET /workspaces/:id/invites`
- `POST /workspaces/:id/members/invite`
- `POST /workspaces/invitations/accept`
- DB connection payloads support:
  - Network engines: `databaseEngine = postgresql | mysql | sqlserver`, plus `host`, `port`, `databaseName`, `username`, `password`, `sslMode`
  - File engine: `databaseEngine = sqlite`, plus `filePath`

## Schema

- `GET /workspaces/:id/schemas`
- `GET /workspaces/:id/tables`
- `GET /workspaces/:id/tables/:table`

## Queries

- `POST /workspaces/:id/query`
- `POST /workspaces/:id/query/cancel`
- `GET /workspaces/:id/query/:executionId`
- `GET /workspaces/:id/history`
- `POST /workspaces/:id/save-query`
- Query pagination is engine-aware (SQL Server uses `OFFSET/FETCH`; other engines use `LIMIT/OFFSET`).

## AI

- `POST /ai/generate-sql`
- `POST /ai/explain-query`
- AI request config supports:
  - `provider`: `openai` | `anthropic` | `google` | `openai-compatible`
  - `model`: provider model ID (required if no `AI_DEFAULT_MODEL`)
  - `apiKey`: optional per-request override (otherwise server env is used)
  - `baseUrl`: optional, required for `openai-compatible`
  - `temperature`: optional (`0` to `2`)

## Public playground

- `POST /playground/test-connection`
- `POST /playground/schema`
- `POST /playground/query`
- Purpose:
  - powers the landing page `Connect your own` experience
  - does not persist credentials
  - supports connection testing, live table discovery, and read-only query execution
- Constraints:
  - route family is disabled unless `PUBLIC_PLAYGROUND_ENABLED=true`
  - private/local hosts are blocked unless `PUBLIC_PLAYGROUND_ALLOW_PRIVATE_HOSTS=true`
  - only read-only `SELECT`/`WITH`/`PRAGMA` queries are allowed
  - SQLite is intentionally blocked in this public flow

## Billing

- `GET /billing/plans`
- `POST /billing/checkout-session`
- `POST /billing/portal-session`
- `GET /billing/workspace/:workspaceId/subscription`
- `GET /billing/workspace/:workspaceId/usage`
- `POST /billing/webhook/polar`
- Billing provider is Polar-only.
- Billing APIs are available only when `DEPLOYMENT_MODE=cloud`.
- Checkout currently supports plan code: `cloud-pro-monthly`.

## Licensing

- `POST /licenses/activate`
- `POST /licenses/deactivate`
- `GET /licenses/workspace/:workspaceId/status`
- Enterprise license key is signature-verified using `LICENSE_VERIFICATION_SECRET`.
- Licensing APIs are available only when `DEPLOYMENT_MODE=self-host` and `SELF_HOST_EDITION=enterprise`.

## Access control

- OAuth routes are public entry points.
- Public playground routes are public entry points when enabled.
- Billing webhook routes are public (`/billing/webhook/*`).
- Workspace, schema, query, AI, and non-webhook billing routes require authenticated session middleware.
- License routes require authenticated session middleware.
- Protected routes require `Authorization: Bearer <jwt>`.
- `POST /auth/dev/session` returns a JWT for local testing using an existing `users.id`.
- Membership management routes require workspace role checks:
  - `invite/list invites`: `owner` or `admin`
  - `list members`: any active workspace member
- DB connection testing and creation routes require `owner` or `admin`.
- Schema metadata routes require any active workspace membership.
- Seat enforcement is applied on invite acceptance (`workspace_seat_limit_reached`).
- Cloud mode returns `404` for `/billing/*` in self-host deployments.
- Cloud/community modes return `404` for `/licenses/*` unless self-host enterprise mode is active.
- AI endpoints enforce workspace usage limits (`ai_requests`, `ai_tokens`) and return `usage_limit_exceeded` when quota is exceeded.
- AI entitlement checks are runtime-mode aware:
  - Cloud: active/trialing billing required
  - Self-host enterprise: active, non-expired license with AI entitlement required
  - Self-host community: BYOK provider flow
- License activation/deactivation requires `owner` or `admin`; status can be read by active workspace members.
- Responses include `x-request-id` for tracing.
- Rate limits:
  - General `/api/v1/*` limit
  - Stricter `/api/v1/ai/*` limit
  - Dedicated `/api/v1/billing/webhook/*` limit
  - Dedicated `/api/v1/playground/*` limit
