# API Reference (Scaffold)

All routes are grouped under `/api/v1` in the API app.

- Auth: `/auth/oauth/github`, `/auth/oauth/google`, `/auth/oauth/callback`
- Workspaces: `/workspaces`, `/workspaces/:id/connect-db`
- Schema: `/workspaces/:id/schemas`, `/workspaces/:id/tables/:table`
- Queries: `/workspaces/:id/query`, `/workspaces/:id/history`, `/workspaces/:id/save-query`
- AI: `/ai/generate-sql`, `/ai/explain-query`
