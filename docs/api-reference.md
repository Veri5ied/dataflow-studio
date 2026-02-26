# API Reference (Scaffold)

All routes are grouped under `/api/v1` in the API app.

## Auth

- `GET /auth/oauth/github`
- `GET /auth/oauth/google`
- `GET /auth/oauth/callback`

## Workspaces

- `GET /workspaces`
- `POST /workspaces`
- `POST /workspaces/:id/connect-db`

## Schema

- `GET /workspaces/:id/schemas`
- `GET /workspaces/:id/tables/:table`

## Queries

- `POST /workspaces/:id/query`
- `GET /workspaces/:id/history`
- `POST /workspaces/:id/save-query`

## AI

- `POST /ai/generate-sql`
- `POST /ai/explain-query`

## Billing

- `GET /billing/plans`
- `POST /billing/checkout-session`
- `POST /billing/portal-session`
- `GET /billing/workspace/:workspaceId/subscription`
- `GET /billing/workspace/:workspaceId/usage`
- `POST /billing/webhook/stripe`
- `POST /billing/webhook/polar`

## Access control

- OAuth routes are public entry points.
- Workspace, schema, query, AI, and billing routes require authenticated session middleware.
