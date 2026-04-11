---
phase: 03-properties-bidirectional-sync
plan: "00"
subsystem: ui
tags: [svelte5, xyflow, calm-architecture, projection, bidirectional-sync, tdd]

# Dependency graph
requires:
  - phase: 02-calm-canvas-core
    provides: "resolveNodeType, nodeTypes map, history store, clipboard store, test infrastructure"

provides:
  - "CalmNode type extended with optional customMetadata field"
  - "calmToFlow projection: CalmArchitecture → Svelte Flow nodes[] + edges[]"
  - "flowToCalm projection: Svelte Flow nodes[] + edges[] → CalmArchitecture"
  - "calmModel.svelte.ts canonical model store with direction mutex"
  - "All 10 mutation functions: updateNodeProperty, updateEdgeProperty, addInterface, removeInterface, updateInterface, addCustomMetadata, removeCustomMetadata"
  - "26 tests covering projections, mutex, CRUD, and custom metadata"

affects:
  - 03-properties-bidirectional-sync (plans 01+)
  - 04-calmscript-editor
  - 05-mcp-server

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Projection pattern: pure functions (no side effects) for bidirectional model<->canvas sync"
    - "Direction mutex: plain boolean syncing flag prevents re-entrant applyFromJson/applyFromCanvas calls"
    - "Spread pattern for $state reactivity: all mutations create new objects via spread to trigger Svelte 5 $state updates"
    - "Staggered position defaults: x = 100 + idx*160, y = 100 for nodes not in positionMap"

key-files:
  created:
    - "packages/calm-core/src/types.ts (modified — added customMetadata)"
    - "apps/studio/src/lib/stores/projection.ts"
    - "apps/studio/src/lib/stores/calmModel.svelte.ts"
    - "apps/studio/src/tests/projection.test.ts"
    - "apps/studio/src/tests/calmModel.test.ts"
  modified:
    - "packages/calm-core/src/types.ts"

key-decisions:
  - "projection.ts imports no .svelte.ts files — stays pure TypeScript for vitest testability without additional Svelte transform"
  - "syncing mutex uses plain boolean (not $state) — no reactivity needed, avoids overhead"
  - "Mutation functions do NOT use the mutex — they are called from UI event handlers, not sync paths"
  - "flowToCalm only sets description/interfaces/customMetadata when non-empty — keeps CALM JSON minimal"

patterns-established:
  - "Projection pattern: pure functions in projection.ts — no imports from .svelte.ts files"
  - "Mutex pattern: withMutex() helper returns boolean (not throws) for clean caller interface"
  - "Spread pattern: all model mutations use { ...model, nodes: model.nodes.map(...) } to trigger $state"

requirements-completed: [SYNC-01, SYNC-02, SYNC-03, SYNC-04, PROP-01, PROP-02, PROP-04, PROP-05]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 3 Plan 00: CALM Model Store + Projection Functions Summary

**Bidirectional CALM↔SvelteFlow projection (calmToFlow/flowToCalm) with direction mutex store and 13 typed mutation functions, backed by 26 tests**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-11T17:36:11Z
- **Completed:** 2026-03-11T17:42:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `customMetadata?: Record<string, string>` to CalmNode in calm-core types
- Created pure projection functions (calmToFlow/flowToCalm) with position map support
- Created calmModel.svelte.ts with direction mutex, read accessors, and 10 mutation functions
- 71 total tests passing (26 new + 45 pre-existing), none broken

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend CalmNode type + create projection functions with tests** - `e0d9502` (feat)
2. **Task 2: Create CALM model store with direction mutex and mutation functions** - `fa7d660` (feat)

_Note: TDD tasks — RED (import failure confirmed), GREEN (implementation), tests pass in under 7s_

## Files Created/Modified

- `packages/calm-core/src/types.ts` — Added optional `customMetadata?: Record<string, string>` to CalmNode
- `apps/studio/src/lib/stores/projection.ts` — Pure calmToFlow/flowToCalm projection functions
- `apps/studio/src/lib/stores/calmModel.svelte.ts` — Canonical model store with mutex and 10 mutation functions
- `apps/studio/src/tests/projection.test.ts` — 8 tests: calmToFlow shape, edge shape, positions, round-trip, customMetadata
- `apps/studio/src/tests/calmModel.test.ts` — 18 tests: mutex, CRUD, node/edge mutations, interface CRUD, metadata CRUD

## Decisions Made

- projection.ts must not import from .svelte.ts files — kept pure TypeScript so vitest can run without Svelte transform complications
- `syncing` uses plain boolean (not $state) since no reactivity needed for the mutex flag
- Mutation functions skip the mutex because they originate from UI handlers, not sync paths
- flowToCalm conditionally sets description/interfaces/customMetadata (omits empty values) to keep CALM JSON clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The commit scope validator rejected `03-00` as the scope. Used `calm-core` and `studio` as scopes per the project's commitlint config which defines `[studio, desktop, calm-core, calmscript, mcp-server, extensions, ci, docs, deps]`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- projection.ts and calmModel.svelte.ts are the foundation all Phase 3 plans (01, 02, 03, 04) depend on
- Plans 01+ can now import `applyFromJson`, `applyFromCanvas`, `calmToFlow` etc. directly
- All 45 pre-existing tests still pass — no regressions introduced

---
*Phase: 03-properties-bidirectional-sync*
*Completed: 2026-03-11*
