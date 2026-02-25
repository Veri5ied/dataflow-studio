# Contributors Guide

Thanks for contributing to DataFlow Studio.

## Before you start

- Read [README.md](./README.md) for project context.
- Check open issues and roadmap alignment before starting work.
- Keep changes scoped to one concern per pull request.

## Development setup

1. Use Node.js 22+ and pnpm 9+.
2. Copy `.env.example` to `.env`.
3. Install dependencies: `pnpm install`.
4. Run GUI/API with `pnpm dev:gui` and `pnpm dev:api`.

## Branching and commits

- Create feature branches with the prefix `codex/`.
- Use clear commit messages in imperative tense.
- Prefer small commits with isolated intent.

## Coding standards

- TypeScript first.
- Keep shared contracts in `packages/shared-types`.
- Keep reusable UI in `packages/ui`.
- Validate API input with Zod.
- Avoid adding business logic directly in route files when services can be extracted.

## Pull request checklist

- Scope and rationale are documented in PR description.
- Relevant docs are updated.
- Lint/test/build pass locally.
- New env vars are documented in `.env.example` and README.

## Definition of done

- Feature behavior matches acceptance criteria.
- Regression risk is covered by tests or explicit verification notes.
- No sensitive credentials or secrets are committed.

## Communication

- Raise architectural changes early in PR discussion.
- For breaking changes, include migration notes.
