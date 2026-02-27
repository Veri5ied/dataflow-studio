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
- Billing webhook routes are public (`/billing/webhook/*`).
- Workspace, schema, query, AI, and non-webhook billing routes require authenticated session middleware.
- Protected routes require `Authorization: Bearer <jwt>`.
- `POST /auth/dev/session` returns a JWT for local testing using an existing `users.id`.
