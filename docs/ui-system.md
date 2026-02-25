# UI System (shadcn + Base UI)

## Decision

DataFlow Studio adopts **shadcn/ui patterns with Base UI primitives**.

## Why this stack

- shadcn/ui provides composable, code-owned component patterns.
- Base UI provides accessible interaction primitives.
- Combined approach supports fast MVP UI delivery without locking into opaque UI abstractions.

## Monorepo placement

- Shared components: `packages/ui`
- App composition and page-level layouts: `apps/gui`
- Styling tokens and utility classes: Tailwind in GUI app and shared component contracts

## Implementation conventions

- Keep primitives thin and accessible.
- Build higher-level product components in `packages/ui`.
- Keep workspace/domain-specific view composition in `apps/gui`.
- Prefer controlled components for editor/forms where query state matters.
- Keep component APIs typed and stable for reuse.

## Planned component rollout

### Foundation

- Button
- Input
- Select
- Dialog
- Sheet
- Tabs
- Toast

### Data-heavy surfaces

- Schema tree
- Result table
- Query history list
- Saved query list

### AI surfaces

- Prompt composer
- SQL suggestion card
- Explanation panel

## Next implementation tasks

1. Add shadcn component scaffolding pipeline for `packages/ui`.
2. Add Base UI primitive wrappers for shared patterns.
3. Create first-pass design tokens and semantic color system.
4. Migrate landing and workspace stubs to shared components.
