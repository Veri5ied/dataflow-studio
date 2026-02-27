# Architecture

## Monorepo model

DataFlow Studio uses an Nx monorepo with clear app/package boundaries:

- `apps/web-gui`: TanStack Start frontend (landing + workspace UI)
- `apps/api`: Hono backend API
- `packages/*`: shared contracts and runtime libraries
- `tooling/*`: delivery, deployment, and quality tooling

## Layer responsibilities

- Presentation: `apps/web-gui`
- Shared UI system: `packages/ui` (shadcn patterns + Base UI primitives)
- API and orchestration: `apps/api`
- AI orchestration: `packages/ai-engine`
- External DB abstraction: `packages/db-connectors`
- Shared contracts/config/utilities: `packages/shared-types`, `packages/config`, `packages/utils`

## UI architecture decision

The project standard is **shadcn/ui with Base UI**.

Detailed conventions and rollout plan are maintained in `docs/ui-system.md`.

## Product scope and roadmap

Full requirements and future roadmap are maintained in `docs/product-requirements.md`.
