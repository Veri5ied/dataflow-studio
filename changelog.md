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
