---
phase: 02-calm-canvas-core
plan: 04
subsystem: ui
tags: [svelte5, xyflow, svelte-flow, typescript, dnd, drag-and-drop, palette, containment, canvas]

# Dependency graph
requires:
  - phase: 02-calm-canvas-core
    plan: 02
    provides: nodeTypes map + resolveNodeType() helper
  - phase: 02-calm-canvas-core
    plan: 03
    provides: edgeTypes map + DEFAULT_EDGE_TYPE + EdgeMarkers.svelte

provides:
  - Working diagramming surface: drag-from-palette, click-to-place, handle-to-handle edge drawing
  - DnDProvider context wrapper sharing drag type between palette and canvas
  - NodePalette sidebar with 9 CALM types + Custom entry, search, drag + click
  - CalmCanvas wrapper integrating SvelteFlow with all CALM nodeTypes and edgeTypes
  - containment.ts pure functions: makeContainment, removeContainment, isContainmentType
  - Full page layout: NodePalette (240px left) + CalmCanvas (flex-1 fill)

affects:
  - 02-05 through 02-08 (all subsequent plans build on this interaction layer)
  - Phase 3 (bidirectional sync operates on the same nodes/edges state)
  - Phase 4 (import/export populates nodes/edges into this canvas)

# Tech tracking
tech-stack:
  added:
    - nanoid (node ID generation — already installed, first use here)
  patterns:
    - "DnDProvider uses Svelte context (setContext/getContext) with $state — shared drag type between siblings"
    - "HTML5 dataTransfer: setData('application/calm-node-type', type) on dragstart, getData on drop"
    - "screenToFlowPosition() converts drop screen coords to canvas flow coords"
    - "$state.raw for nodes/edges at page level — prevents double-render loops from SvelteFlow internal mutations"
    - "placeNodeAtCenter() as exported component method — enables parent-to-child imperative calls via bind:this"
    - "boundsOverlap() check on onnodedragstop for drag-into-container auto-reparenting"
    - "makeContainment called for both edge-draw (onconnect) and drag-into (onnodedragstop)"

key-files:
  created:
    - apps/studio/src/lib/palette/DnDProvider.svelte
    - apps/studio/src/lib/palette/NodePalette.svelte
    - apps/studio/src/lib/canvas/CalmCanvas.svelte
    - apps/studio/src/lib/canvas/containment.ts
  modified:
    - apps/studio/src/routes/+page.svelte
    - apps/studio/src/tests/containment.test.ts

key-decisions:
  - "DnDProvider exposes context via useDnD() module export — importable from any child without prop drilling"
  - "NodePalette fires onplacenode callback prop (not CustomEvent) — cleaner Svelte 5 pattern; parent forwards to CalmCanvas.placeNodeAtCenter()"
  - "CalmCanvas exports placeNodeAtCenter() as a component method (bind:this) — avoids state threading through page"
  - "boundsOverlap uses default 150x50 dimensions when node measured size is unavailable — pragmatic fallback"
  - "removeContainment uses destructuring rest pattern to delete fields — avoids undefined properties on returned object"

patterns-established:
  - "Pattern: Svelte context for DnD — useDnD() exposes dragType + setDragType; set on dragstart, clear on dragend"
  - "Pattern: Click-to-place — NodePalette onplacenode prop -> page handlePalettePlace -> CalmCanvas.placeNodeAtCenter()"
  - "Pattern: Containment invariant — both edge-draw and physical drag-into call makeContainment for visual nesting"

requirements-completed: [CANV-01, CANV-02, CANV-03, CANV-04, CALM-05]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 2 Plan 04: Canvas + Palette + Containment Integration Summary

**Working drag-and-drop diagramming surface — NodePalette sidebar with 9 CALM types, CalmCanvas with SvelteFlow + DnD drop + click-to-place, containment.ts pure functions (14 unit tests), and full page layout wired together**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T11:57:06Z
- **Completed:** 2026-03-11T12:00:43Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- DnDProvider.svelte wraps palette and canvas with shared Svelte context for drag-type state
- NodePalette renders 9 CALM types + Custom entry with inline SVG mini icons; search filters by substring
- Each palette item is draggable (`application/calm-node-type`) and clickable (onplacenode callback)
- CalmCanvas mounts SvelteFlow with all CALM nodeTypes + edgeTypes + EdgeMarkers
- DnD drop handler converts screen coordinates via `screenToFlowPosition()` and creates typed nodes
- `placeNodeAtCenter()` exported component method places nodes at viewport center on click-to-place
- `onconnect` creates edges defaulting to `connects`; containment edges also call `makeContainment()`
- `onnodedragstop` auto-reparents dropped nodes that overlap a container via bounds check
- containment.ts: 3 pure functions, immutable, fully tested (14 tests, all pass)
- +page.svelte: DnDProvider wraps full layout; nodes/edges managed at page level with `$state.raw`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NodePalette sidebar with DnD and click-to-place** - `e36872e` (feat)
2. **TDD RED: Failing containment unit tests** - `ba69d79` (test)
3. **TDD GREEN: containment.ts implementation** - `c78f298` (feat)
4. **Task 2: CalmCanvas, page layout, containment wired** - `0644bd8` (feat)

**Plan metadata:** to be committed after SUMMARY.md creation (docs)

## Files Created/Modified

- `apps/studio/src/lib/palette/DnDProvider.svelte` — Svelte context wrapper; `useDnD()` exports `{ dragType, setDragType }`
- `apps/studio/src/lib/palette/NodePalette.svelte` — 9 CALM types + Custom entry, search, drag + click-to-place
- `apps/studio/src/lib/canvas/CalmCanvas.svelte` — SvelteFlow wrapper with DnD drop, edge creation, containment, click-to-place
- `apps/studio/src/lib/canvas/containment.ts` — `makeContainment`, `removeContainment`, `isContainmentType` pure functions
- `apps/studio/src/routes/+page.svelte` — DnDProvider + NodePalette + CalmCanvas full layout
- `apps/studio/src/tests/containment.test.ts` — 14 unit tests covering all containment behaviors

## Decisions Made

- `NodePalette` fires `onplacenode` as a callback prop rather than a DOM `CustomEvent`. In Svelte 5, callback props are the idiomatic pattern for component-to-parent communication.
- `CalmCanvas.placeNodeAtCenter()` is exported as a component method accessed via `bind:this`. This avoids threading a placement state signal through the page when the canvas already owns the `screenToFlowPosition` function.
- `boundsOverlap()` uses default 150×50 when SvelteFlow hasn't yet measured the node dimensions. This is a pragmatic fallback — nodes are small enough that first-render placements work correctly.
- `removeContainment` uses the destructuring rest pattern (`const { parentId: _pid, extent: _ext, ...rest }`) to cleanly delete fields without leaving `undefined` values on the returned object.

## Deviations from Plan

None - plan executed exactly as written. TDD flow followed in order: RED (stub tests replaced with real assertions, import uncommented, tests fail), GREEN (containment.ts created, all 14 tests pass). CalmCanvas and page composed per spec.

## Issues Encountered

None significant. Build and tests passed on first attempt after implementation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `CalmCanvas` is fully wired and interactive — users can drag nodes, draw edges, zoom/pan, and delete
- Containment relationships work visually (parentId + extent:parent) via both edge drawing and node drag-into
- `nodes` and `edges` state at page level is ready for CALM JSON import/export (Plan 02-05+)
- Plan 02-05 (canvas state store / Fuse.js search) can bind to the nodes array directly

## Self-Check: PASSED

Files verified present and commits confirmed below.
