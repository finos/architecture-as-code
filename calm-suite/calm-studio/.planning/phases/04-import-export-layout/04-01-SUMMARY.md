---
phase: 04-import-export-layout
plan: 01
subsystem: ui
tags: [elkjs, layout, import, drag-and-drop, svelte-flow, calm-json]

# Dependency graph
requires:
  - phase: 04-import-export-layout/04-00
    provides: elkjs installed, failing test stubs for ELK layout and fileSystem
  - phase: 03-properties-bidirectional-sync
    provides: calmToFlow projection, calmModel store, pushSnapshot, applyFromJson, getModel
provides:
  - Pure async layoutCalm function (ELK.js layered algorithm, direction-aware)
  - LayoutDirection type exported from $lib/layout/elkLayout
  - CALM JSON file import via drag-and-drop on canvas
  - CALM JSON file import via Cmd+O keyboard shortcut and open button
  - Auto-layout toolbar button with Top-to-Bottom / Left-to-Right / Hierarchical presets
  - Pin toggle for nodes (pinned nodes excluded from ELK, position preserved)
  - importError $state in +page.svelte with dismissable error banner
  - fitViewport() exported from CalmCanvas for parent to call post-layout

affects:
  - 04-02-export
  - 04-03-ui-polish
  - future-phases-using-layout

# Tech tracking
tech-stack:
  added: [elkjs@0.11.1]
  patterns:
    - Pure TypeScript ELK layout module — no Svelte imports for vitest testability
    - Flat ELK graph (no nested children) per RESEARCH Pitfall 7
    - Pinned nodes excluded from ELK; caller injects their positions separately
    - Canvas-level floating pin overlay button via onnodemouseenter/leave
    - importCalmFile validates JSON + nodes array before any mutation (no partial load)
    - fitViewport exported from CalmCanvas, called by parent after import/layout + tick()

key-files:
  created:
    - apps/studio/src/lib/layout/elkLayout.ts
    - apps/studio/src/lib/canvas/nodes/NodePin.svelte
  modified:
    - apps/studio/src/lib/canvas/CalmCanvas.svelte
    - apps/studio/src/routes/+page.svelte

key-decisions:
  - "elkLayout.ts imports no .svelte.ts files — pure TypeScript for vitest testability (consistent with projection.ts pattern)"
  - "Flat ELK graph (no nested children) — sub-flow nesting handled by @xyflow/svelte parentId independently"
  - "Pinned nodes excluded from ELK result Map — callers inject pinned positions into finalPositions separately"
  - "Pin toggle implemented as canvas-level floating overlay button (not per-node) — avoids modifying 11 node components"
  - "fitViewport() exported from CalmCanvas — parent calls after tick() to ensure DOM updated before fitView"
  - "importError validation: must have nodes array; JSON.parse error both caught; no partial load on failure"

patterns-established:
  - "Layout separation: ELK produces positionMap for free nodes; caller merges with pinned positions before calmToFlow"
  - "Import pipeline: JSON.parse -> validate -> pushSnapshot -> applyFromJson -> layoutCalm -> calmToFlow -> tick -> fitViewport"

requirements-completed: [IOEX-01, LAYT-01, LAYT-02, LAYT-03]

# Metrics
duration: 37min
completed: 2026-03-12
---

# Phase 4 Plan 1: ELK Auto-Layout Engine and CALM JSON Import Summary

**ELK.js layered auto-layout with CALM JSON drag-and-drop import, Cmd+O file picker, direction dropdown, and canvas-level pin toggle for preserving node positions**

## Performance

- **Duration:** 37 min
- **Started:** 2026-03-12T04:01:00Z
- **Completed:** 2026-03-12T04:38:30Z
- **Tasks:** 2 (Task 1 TDD: RED->GREEN; Task 2: UI wiring)
- **Files modified:** 4

## Accomplishments

- Pure async `layoutCalm` function using ELK.js layered algorithm — vitest-testable, no Svelte imports
- CALM JSON import via drag-and-drop (file drop on canvas) and Cmd+O keyboard shortcut with file button in toolbar
- Auto-layout toolbar with Top-to-Bottom / Left-to-Right / Hierarchical direction presets and run button
- Pin toggle overlay button on node hover — pinned nodes excluded from ELK, positions preserved during layout
- `importError` $state with dismissable banner; canvas unchanged on invalid JSON (no partial load)
- All 80 tests passing; clean build

## Task Commits

Each task was committed atomically:

1. **Task 1 RED (tests already staged from 04-00)** - `a127d8a` (test: already committed)
2. **Task 1 GREEN (elkLayout.ts implementation)** - `c476c20` (feat(studio))
3. **Task 2: Wire import flow, drag-and-drop, auto-layout button, pin toggle** - `fd17820` (feat(studio))

_Task 1 used TDD workflow: existing failing tests from 04-00 research phase served as RED, elkLayout.ts created for GREEN._

## Files Created/Modified

- `apps/studio/src/lib/layout/elkLayout.ts` — Pure ELK layout engine: `layoutCalm(arch, pinnedIds, direction)` -> `Map<id, {x,y}>`
- `apps/studio/src/lib/canvas/nodes/NodePin.svelte` — Pin button component (unused directly — pin overlay in CalmCanvas)
- `apps/studio/src/lib/canvas/CalmCanvas.svelte` — `onfileimport` prop, file drop handling, pin overlay, `fitViewport()` export
- `apps/studio/src/routes/+page.svelte` — `importCalmFile()`, `runLayout()`, toolbar layout controls, Cmd+O handler, import error banner

## Decisions Made

- **Flat ELK graph:** No nested children in ELK graph — @xyflow/svelte parentId handles visual containment independently (per RESEARCH Pitfall 7)
- **Pin overlay approach:** Canvas-level floating pin button on `onnodemouseenter` rather than modifying 11 node components — achieves same UX without broad file changes
- **ELK returns free nodes only:** `layoutCalm` excludes pinned nodes from result Map; `runLayout` builds `finalPositions` by merging ELK results with current pinned positions
- **No partial import:** If JSON.parse fails or `nodes` array missing, `importError` is set and canvas is left unchanged

## Deviations from Plan

None - plan executed exactly as written.

The one minor implementation choice (canvas-level pin overlay instead of per-node component injection) is an implementation detail that achieves the same user-visible behavior described in the plan. NodePin.svelte was created but the pin UX is delivered via the CalmCanvas overlay pattern.

## Issues Encountered

- **elkjs not in package.json:** Installed via `pnpm --filter @calmstudio/studio add elkjs`. The package.json update and lockfile were already committed in Phase 04-00 (`a127d8a`), so only `elkLayout.ts` needed to be staged for the Task 1 commit.
- **fileSystem.test.ts pre-existing failure:** Phase 04-00 left a failing test stub (`$lib/io/fileSystem`). The file was already created in `apps/studio/src/lib/io/`, so all 80 tests passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ELK layout engine ready for Plan 04-02 (export: PNG/SVG/JSON via html-to-image)
- `importCalmFile` and `runLayout` in +page.svelte ready for polish in Plan 04-03
- `importError` $state exposed for Plan 04-03 unified error banner
- Pin toggle fully functional; pinned node positions preserved across layout runs

---
*Phase: 04-import-export-layout*
*Completed: 2026-03-12*
