# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-02-25

### Added

- Initial Nx-style monorepo scaffold
- GUI and API app placeholders
- Shared package boundaries (`ui`, `db-connectors`, `ai-engine`, `shared-types`, `config`, `utils`)
- Tooling scaffold for Docker, CI/CD, k8s, and scripts
- Project documentation baseline and contributor/policy docs
- Billing model docs, Polar provider support, and billing API scaffolds
- Internal app PostgreSQL schema migration + seed scaffolding for API foundation
- Drizzle ORM integration for API schema typing and migration generation
- API domain repositories/services and DB-backed workspace/billing endpoints
- OAuth/session core with managed clients (openid-client + Octokit), callback exchange, and JWT middleware
- Auth endpoints for `/auth/me` and development JWT issuance (`/auth/dev/session`)
- Workspace membership invite/accept flow with role checks and seat-limit enforcement
- Workspace invitations table + migration (`workspace_invites`)
- External PostgreSQL connection test/save flow and live schema/table metadata endpoints
- Upgraded at-rest credential encryption to AES-256-GCM with legacy compatibility
- Query engine service with execution, cancellation, pagination, history logging, and saved queries persistence
- Multi-relational DB connector runtime for `postgresql`, `mysql`, `sqlite`, and `sqlserver` with engine-aware schema/query operations
- AI endpoints with usage quota guardrails, metering, and persistent ai_logs audit entries
- Real multi-provider AI execution via Vercel AI SDK (`openai`, `anthropic`, `google`, and `openai-compatible`) with per-request model selection
- Polar-only cloud billing runtime (Stripe paths removed from API routes/config)
- Enterprise self-host licensing scaffolding with activation/deactivation/status APIs and persisted entitlements
- Project license updated to `AGPL-3.0-only` with enterprise commercial licensing note in docs
- Runtime mode gating for commercial paths (`DEPLOYMENT_MODE`, `SELF_HOST_EDITION`) across billing, licensing, workspace bootstrap, and AI entitlement checks
- Edition capability matrix documentation (`docs/edition-matrix.md`) and setup/API docs updated for cloud vs self-host behavior
- Frontend app renamed from `apps/gui` to `apps/web-gui` and re-scaffolded with TanStack Start
- Docker deployment scaffolds replaced with runnable app images (`Dockerfile.api`, `Dockerfile.web-gui`, compose updates)
- Billing webhook verification/idempotency and subscription sync processing
- API hardening: request IDs, route rate-limiting, and automated backend tests
- TanStack landing page implementation for `apps/web-gui` with real product sections and interactive studio demo
- Public playground API for landing-page `Connect your own` flow (connection test, live schema discovery, read-only queries)
- GitHub doc/security/self-hosting links wired into the landing page footer and CTA surfaces
