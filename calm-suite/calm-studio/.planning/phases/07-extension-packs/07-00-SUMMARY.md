---
phase: 07-extension-packs
plan: "00"
subsystem: extensions
tags: [vitest, typescript, extensions, pack-registry, calm-types]

requires:
  - phase: 02-calm-canvas-core
    provides: "nodeTypes.ts with 9 built-in CALM type strings and resolveNodeType()"

provides:
  - "PackDefinition, NodeTypeEntry, PackColor type interfaces"
  - "PackRegistry singleton with register/resolve/getAll/getPacksForTypes/reset"
  - "Core CALM pack wrapping all 9 built-in CALM types"
  - "initAllPacks() public API function"
  - "Test infrastructure for @calmstudio/extensions package"
  - "Studio test stubs for extension pack integration (nodeTypes, sidecar)"

affects:
  - 07-extension-packs (Plans 01-04 depend on registry API)
  - 08-c4-view-mode (may use extension pack node types)

tech-stack:
  added:
    - vitest ^4.1.0 (dev dependency in @calmstudio/extensions)
  patterns:
    - "Module-level Map registry singleton — no class, no global state wrapper"
    - "Pack-prefixed type IDs via colon separator: 'aws:lambda', 'k8s:pod'"
    - "Core CALM types remain unprefixed — resolvePackNode returns null for them"
    - "initAllPacks() registers built-in packs; caller decides when to call"

key-files:
  created:
    - packages/extensions/src/types.ts
    - packages/extensions/src/registry.ts
    - packages/extensions/src/packs/core.ts
    - packages/extensions/src/index.ts
    - packages/extensions/src/registry.test.ts
    - packages/extensions/vitest.config.ts
    - apps/studio/src/tests/nodeTypes.test.ts
    - apps/studio/src/tests/sidecar.test.ts
  modified:
    - packages/extensions/package.json

key-decisions:
  - "PackRegistry uses module-level Map singleton — avoids class instance pattern, simpler for tree-shaking"
  - "resolvePackNode returns null for unprefixed types — core type resolution stays in nodeTypes.ts resolveNodeType()"
  - "getPacksForTypes extracts pack IDs from any colon-prefixed strings regardless of registration status — useful for sidecar detection"
  - "initAllPacks() re-imports from registry/core at call time — avoids circular import at module load"
  - "Studio test stubs use test.skip with comment — makes intent clear without false positives"

patterns-established:
  - "TDD: write registry.test.ts failing first, then implement types/registry/corePack to green"
  - "Pack typeId convention: unprefixed for core (actor), colon-prefixed for extension packs (aws:lambda)"

requirements-completed:
  - EXTK-01
  - EXTK-02

duration: 3min
completed: "2026-03-12"
---

# Phase 7 Plan 00: Extension Packs Foundation Summary

**PackRegistry singleton with register/resolve/getAll API, Core CALM pack with 9 types, and vitest infrastructure for @calmstudio/extensions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T21:49:11Z
- **Completed:** 2026-03-12T21:52:54Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- PackDefinition, NodeTypeEntry, PackColor type system established in packages/extensions/src/types.ts
- PackRegistry singleton implements register/resolve/getAll/getPacksForTypes/reset with 11 passing tests
- Core CALM pack wraps all 9 built-in CALM types with SVG icons matching NodePalette.svelte
- Studio test stubs added for extension integration and sidecar functions (skipped pending Plan 03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, Registry, and Core Pack with tests** - `7984a84` (feat)
2. **Task 2: Studio-side test stubs for nodeTypes and sidecar** - `4314b35` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/extensions/src/types.ts` - PackDefinition, NodeTypeEntry, PackColor interfaces
- `packages/extensions/src/registry.ts` - Module-level Map registry with 5 exported functions
- `packages/extensions/src/packs/core.ts` - corePack with 9 CALM types and inline SVG icons
- `packages/extensions/src/index.ts` - Public API re-exports and initAllPacks()
- `packages/extensions/src/registry.test.ts` - 11 tests covering all registry behaviors
- `packages/extensions/vitest.config.ts` - Vitest config with src/**/*.test.ts include pattern
- `packages/extensions/package.json` - Updated test script, added vitest devDependency
- `apps/studio/src/tests/nodeTypes.test.ts` - Built-in type tests pass; extension tests skipped
- `apps/studio/src/tests/sidecar.test.ts` - All sidecar tests skipped pending Plan 03

## Decisions Made
- PackRegistry uses module-level Map singleton — avoids class instance pattern, simpler for tree-shaking
- resolvePackNode returns null for unprefixed types — core type resolution stays in nodeTypes.ts
- getPacksForTypes extracts pack IDs from any colon-prefixed strings regardless of registration status
- Studio test stubs use test.skip with comment — makes intent clear without false positives

## Deviations from Plan

None - plan executed exactly as written. Files in packages/extensions/src/ (types.ts, registry.ts, packs/core.ts) were partially pre-created from prior planning session; they matched plan spec and required only index.ts completion.

## Issues Encountered
- `packages/extensions/src/types.ts`, `registry.ts`, and `packs/core.ts` were already pre-created with correct content from the planning phase. Only `index.ts` needed updating to add proper exports and `initAllPacks()`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PackRegistry API is stable and ready for Plan 01 (AWS pack) and subsequent packs
- initAllPacks() will be extended in each subsequent pack plan
- Studio test stubs will be enabled in Plan 03 when resolveNodeType is wired to pack registry

---
*Phase: 07-extension-packs*
*Completed: 2026-03-12*
