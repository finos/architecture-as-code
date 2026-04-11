---
phase: 02-calm-canvas-core
plan: 01
subsystem: ui
tags: [sveltekit, svelte5, xyflow, svelte-flow, tailwindcss, typescript, calm-types]

# Dependency graph
requires:
  - phase: 01-foundation-governance
    provides: pnpm monorepo, tsconfig.base.json, Apache 2.0 SPDX headers, commitlint
provides:
  - SvelteKit app scaffold in apps/studio with Svelte 5, Vite, and SvelteFlow rendering an empty canvas
  - SSR disabled on canvas route via ssr=false and vite.config noExternal workaround
  - Tailwind v4 and @xyflow/svelte CSS imported via app.css
  - CALM type definitions (CalmNodeType, CalmRelationshipType, CalmNode, CalmRelationship, CalmInterface, CalmArchitecture) in @calmstudio/calm-core
affects:
  - 02-02 through 02-08 (all subsequent Phase 2 plans depend on this scaffold and the CALM types)
  - packages/calm-core consumers in future phases (Phase 3 bidirectional sync, Phase 4 import/export)

# Tech tracking
tech-stack:
  added:
    - "@xyflow/svelte ^1.5.1 — graph canvas engine"
    - "tailwindcss ^4.x — utility CSS"
    - "nanoid ^5.x — unique ID generation"
    - "fuse.js ^7.x — fuzzy search"
    - "@sveltejs/kit ^2.x — SvelteKit framework"
    - "svelte ^5.x — Svelte 5 with runes"
    - "@svelte-put/shortcut ^3.x — keyboard shortcut Svelte action"
    - "svelte-check — SvelteKit typecheck"
    - "vitest ^3.x — test runner"
    - "@testing-library/svelte ^5.x — component testing"
    - "@playwright/test ^1.x — E2E testing"
  patterns:
    - "$state.raw([]) for nodes/edges — prevents double-render loops from Svelte Flow internal mutations"
    - "ssr.noExternal: ['@xyflow/svelte'] in vite.config.ts — prevents SSR import errors"
    - "export const ssr = false in +page.ts — canvas route is client-only"
    - "Workspace package with exports field pointing to src/index.ts — TypeScript-first, no build step needed"

key-files:
  created:
    - apps/studio/src/app.html
    - apps/studio/src/app.css
    - apps/studio/src/routes/+layout.svelte
    - apps/studio/src/routes/+page.ts
    - apps/studio/src/routes/+page.svelte
    - apps/studio/svelte.config.js
    - packages/calm-core/src/types.ts
  modified:
    - apps/studio/package.json
    - apps/studio/tsconfig.json
    - apps/studio/vite.config.ts
    - packages/calm-core/package.json
    - packages/calm-core/src/index.ts

key-decisions:
  - "Use $state.raw() not $state() for Svelte Flow nodes/edges — avoids deep reactivity proxy intercepting internal mutations"
  - "tsconfig.json extends .svelte-kit/tsconfig.json (not ../../tsconfig.base.json directly) — SvelteKit generates its own tsconfig with required paths"
  - "CALM types defined as TypeScript interfaces/type aliases in src/types.ts with string fallback on node-type — allows custom types beyond the 9 built-in"
  - "calm-core package exports point to src/index.ts directly — no build step, TypeScript-first workspace package pattern"

patterns-established:
  - "Pattern: Svelte Flow canvas route — ssr=false in +page.ts + noExternal in vite.config.ts (both required)"
  - "Pattern: $state.raw for graph state — all canvas data uses shallow reactivity"
  - "Pattern: Apache 2.0 SPDX headers on all source files — required by project governance"

requirements-completed: [CANV-01, CALM-01]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 2 Plan 01: SvelteKit + Svelte Flow Scaffold Summary

**SvelteKit 2 + Svelte 5 app scaffolded with @xyflow/svelte canvas rendering a blank CALM diagram, SSR disabled, Tailwind v4 configured, and CALM data model types exported from @calmstudio/calm-core**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T11:44:47Z
- **Completed:** 2026-03-11T11:47:51Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- SvelteKit app in apps/studio builds successfully with `vite build` — 474 modules transformed, SSR bundle generated
- Svelte Flow (@xyflow/svelte 1.5.1) renders empty canvas with ssr=false and noExternal workaround applied
- CALM data model types (6 types/interfaces) exported from @calmstudio/calm-core, pass strict TypeScript typecheck

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold SvelteKit app with Svelte Flow, Tailwind v4, and dev dependencies** - `11ccbc2` (chore)
2. **Task 2: Define CALM core types in packages/calm-core** - `29a7ee7` (feat)

**Plan metadata:** to be committed after SUMMARY.md creation (docs)

## Files Created/Modified

- `apps/studio/package.json` — Updated with @xyflow/svelte, tailwindcss, nanoid, fuse.js, @sveltejs/kit dependencies
- `apps/studio/vite.config.ts` — SvelteKit plugin + ssr.noExternal: ['@xyflow/svelte'] + vitest config
- `apps/studio/svelte.config.js` — adapter-auto with Apache 2.0 header
- `apps/studio/tsconfig.json` — Extends .svelte-kit/tsconfig.json
- `apps/studio/src/app.html` — SvelteKit HTML shell with %sveltekit.head% and %sveltekit.body%
- `apps/studio/src/app.css` — Tailwind v4 @import + @xyflow/svelte CSS import
- `apps/studio/src/routes/+layout.svelte` — Imports app.css, renders {@render children()}
- `apps/studio/src/routes/+page.ts` — export const ssr = false
- `apps/studio/src/routes/+page.svelte` — SvelteFlow with $state.raw nodes/edges, full viewport
- `packages/calm-core/src/types.ts` — CalmNodeType, CalmRelationshipType, CalmInterface, CalmNode, CalmRelationship, CalmArchitecture
- `packages/calm-core/src/index.ts` — Re-exports from types.ts
- `packages/calm-core/package.json` — Added exports field pointing to src/index.ts

## Decisions Made

- Used `$state.raw([])` for nodes and edges per RESEARCH Pitfall 1 — deep `$state()` causes Svelte proxy to intercept Svelte Flow internal mutations leading to double-render loops
- tsconfig.json extends `.svelte-kit/tsconfig.json` (not `../../tsconfig.base.json`) — SvelteKit generates its own tsconfig with required path aliases; extending base directly caused build warnings
- calm-core exports point directly to TypeScript source — no build step required for workspace package consumption; TypeScript-first pattern aligns with SvelteKit's bundler module resolution

## Deviations from Plan

None — plan executed exactly as written. All 10 action steps for Task 1 and 3 action steps for Task 2 completed as specified.

Note: Prior execution (commits 11ccbc2, c2b712d) had already partially completed this work including test stub files. Current execution verified all artifacts, updated the tsconfig, and completed the calm-core package.

## Issues Encountered

None significant. The build produced Rollup circular dependency warnings related to Svelte internals and `@xyflow/svelte` — these are known upstream issues that do not affect runtime behavior. The `adapter-auto` "Could not detect production environment" message is expected during local development.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SvelteKit dev server is ready to start with `pnpm --filter @calmstudio/studio dev`
- Svelte Flow canvas renders at localhost:5173 after dev server starts
- CALM types are importable as `import type { CalmNode } from '@calmstudio/calm-core'`
- Plan 02-02 (custom node components) can proceed immediately — nodeTypes map scaffolding is the next step

## Self-Check: PASSED

All key files verified present on disk. Both task commits (11ccbc2, 29a7ee7) confirmed in git log.

---
*Phase: 02-calm-canvas-core*
*Completed: 2026-03-11*
