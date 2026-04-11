---
phase: 02-calm-canvas-core
plan: 03
subsystem: ui
tags: [sveltekit, svelte5, xyflow, svelte-flow, typescript, svg-markers, edge-types]

# Dependency graph
requires:
  - phase: 02-calm-canvas-core
    plan: 01
    provides: SvelteKit scaffold, @xyflow/svelte installed, CalmRelationshipType from calm-core

provides:
  - 5 custom Svelte edge components with distinct visual styles per CALM relationship type
  - EdgeMarkers.svelte with 4 shared SVG marker definitions (arrow-filled, diamond-open, diamond-filled, arrow-open)
  - edgeTypes.ts registration map for @xyflow/svelte edgeTypes prop
  - DEFAULT_EDGE_TYPE = 'connects' constant for new edge creation

affects:
  - 02-04 through 02-08 (canvas components that wire up edgeTypes and EdgeMarkers)
  - 02-07 (CALM JSON sync — edge type strings map directly to edgeTypes keys)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EdgeMarkers.svelte rendered once in canvas DOM — all edge components share markers via url(#id)"
    - "orient=auto-start-reverse on SVG markers — required for correct rotation with edge direction"
    - "currentColor fill/stroke on markers — inherits from edge color, works with dark mode"
    - "$derived() for getSmoothStepPath in edge components — reactive to source/target position changes"
    - "EdgeLabel with nodrag nopan classes for protocol labels — prevents interfering with edge interaction"

key-files:
  created:
    - apps/studio/src/lib/canvas/edges/EdgeMarkers.svelte
    - apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte
    - apps/studio/src/lib/canvas/edges/InteractsEdge.svelte
    - apps/studio/src/lib/canvas/edges/DeployedInEdge.svelte
    - apps/studio/src/lib/canvas/edges/ComposedOfEdge.svelte
    - apps/studio/src/lib/canvas/edges/OptionsEdge.svelte
    - apps/studio/src/lib/canvas/edgeTypes.ts
  modified: []

key-decisions:
  - "EdgeMarkers rendered as hidden SVG once — not inline per-edge — avoids duplicate defs and DOM bloat"
  - "orient=auto-start-reverse on all markers — required per RESEARCH Pitfall 5 for correct directional rotation"
  - "currentColor for SVG marker fill/stroke — enables edge color customization and dark mode without marker-specific color props"
  - "InteractsEdge has no protocol label — interacts edges represent human/actor relationships which have no protocol in CALM schema"
  - "style prop forwarded with prepended dasharray — preserves external style overrides while enforcing line style per edge type"

patterns-established:
  - "Pattern: Edge marker sharing — EdgeMarkers.svelte in canvas root, all edges reference by url(#marker-id)"
  - "Pattern: Edge line style — solid/dashed/dotted via stroke-dasharray prepended to forwarded style prop"
  - "Pattern: Protocol label — ConnectsEdge reads data.protocol || label, renders EdgeLabel with nodrag nopan"

requirements-completed: [CALM-03, CALM-06]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 2 Plan 03: Custom CALM Edge Components Summary

**5 custom Svelte edge components with solid/dashed/dotted line styles and arrow/diamond SVG markers registered in edgeTypes map for @xyflow/svelte**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T11:51:16Z
- **Completed:** 2026-03-11T11:56:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- EdgeMarkers.svelte defines 4 reusable SVG markers with orient="auto-start-reverse" for correct directional rendering
- 5 distinct edge components covering all CALM relationship types with unique visual styles
- ConnectsEdge renders protocol labels (HTTPS, JDBC, gRPC, etc.) centered on path via EdgeLabel
- edgeTypes.ts registration map with DEFAULT_EDGE_TYPE enables drop-in integration with SvelteFlow canvas

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EdgeMarkers SVG definitions and all 5 custom edge components** - `e3af853` (feat)
2. **Task 2: Create edgeTypes registration map** - `009f32a` (feat)

**Plan metadata:** to be committed after SUMMARY.md creation (docs)

## Files Created/Modified

- `apps/studio/src/lib/canvas/edges/EdgeMarkers.svelte` — Hidden SVG with 4 shared marker defs (arrow-filled, diamond-open, diamond-filled, arrow-open); orient=auto-start-reverse on all
- `apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte` — Solid line + filled arrow + protocol label via EdgeLabel
- `apps/studio/src/lib/canvas/edges/InteractsEdge.svelte` — Dashed (6 4) + filled arrow, no protocol label
- `apps/studio/src/lib/canvas/edges/DeployedInEdge.svelte` — Solid + open diamond marker
- `apps/studio/src/lib/canvas/edges/ComposedOfEdge.svelte` — Dashed (6 4) + filled diamond marker
- `apps/studio/src/lib/canvas/edges/OptionsEdge.svelte` — Dotted (2 4) + open arrow marker
- `apps/studio/src/lib/canvas/edgeTypes.ts` — Registers all 5 edge types, exports DEFAULT_EDGE_TYPE = 'connects'

## Decisions Made

- EdgeMarkers.svelte is a standalone component rendered once in the canvas DOM rather than inline per-edge. This avoids duplicate SVG defs and reduces DOM weight when many edges are visible.
- `orient="auto-start-reverse"` added to every marker per RESEARCH.md Pitfall 5 — without this, markers point in the wrong direction on edges with reversed source/target coordinates.
- `currentColor` used for all marker fill/stroke so markers automatically inherit the edge stroke color. This enables per-edge color customization and dark mode support without additional props.
- `InteractsEdge` intentionally has no protocol label — the CALM schema does not include protocol on interacts relationships (only connects has protocol).
- Line dasharray is prepended to the forwarded `style` prop rather than replacing it, preserving any external style overrides applied by the canvas.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- commitlint hook rejected initial commit scope `02-03` — scope must be one of the allowed set (`studio`, `calm-core`, etc.). Fixed by using `studio` scope. Line length limit (100 chars) also triggered, resolved by shortening bullet lines.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `edgeTypes` map is ready to pass to `<SvelteFlow edgeTypes={edgeTypes} />` in the canvas page
- `EdgeMarkers` component needs to be rendered inside the SvelteFlow component tree (before edge rendering)
- Plan 02-04 (custom node components) can proceed independently — nodeTypes map is the next step

## Self-Check: PASSED

All 7 key files verified on disk. Both task commits (e3af853, 009f32a) confirmed in git log.

---
*Phase: 02-calm-canvas-core*
*Completed: 2026-03-11*
