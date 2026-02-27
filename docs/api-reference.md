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

## Schema

- `GET /workspaces/:id/schemas`
- `GET /workspaces/:id/tables`
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
- Membership management routes require workspace role checks:
  - `invite/list invites`: `owner` or `admin`
  - `list members`: any active workspace member
- DB connection testing and creation routes require `owner` or `admin`.
- Schema metadata routes require any active workspace membership.
- Seat enforcement is applied on invite acceptance (`workspace_seat_limit_reached`).
