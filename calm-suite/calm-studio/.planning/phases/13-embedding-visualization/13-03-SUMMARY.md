---
phase: 13-embedding-visualization
plan: "03"
subsystem: ui
tags: [svg, animation, web-component, flow-visualization, elk, svelte5]

requires:
  - phase: 13-01
    provides: CalmFlow/CalmTransition types in calm-core, flow prop on CalmDiagram, ELK render pipeline

provides:
  - flowOverlay.ts module with renderFlowOverlay, applyFlowDimming, getFlowNodeIds exports
  - Animated SVG dots travelling along flow edges (animateMotion + mpath)
  - Numbered sequence badge circles with SVG <title> tooltips
  - Direction-aware keyPoints ('0;1' vs '1;0') for transition direction field
  - 30% opacity dimming for edges and nodes not in the active flow
  - Flow overlay integrated into elkRender.ts pipeline via flow option
  - CalmDiagram.svelte passes flow prop through to renderELKDiagram
  - test.html with side-by-side visual verification (light no-flow + dark auth-flow)

affects: [13-04, future embedding consumers, documentation examples]

tech-stack:
  added: []
  patterns:
    - "SVG animateMotion + mpath pattern for path-following dot animation without JS"
    - "Flow overlay appended ABOVE edge/node layers to avoid double-dimming animated dots"
    - "applyFlowDimming returns string opacity value ('1'/'0.3') for SVG opacity attribute"
    - "edgeLayouts Map built during ELK edge render pass for reuse by flow overlay"

key-files:
  created:
    - packages/web-component/src/render/flowOverlay.ts
    - packages/web-component/src/render/flowOverlay.test.ts
    - packages/web-component/test.html
  modified:
    - packages/web-component/src/render/elkRender.ts
    - packages/web-component/src/CalmDiagram.svelte

key-decisions:
  - "Flow overlay SVG group appended after node layer — animated dots always on top, never dimmed"
  - "applyFlowDimming returns string ('1'/'0.3') not number — directly usable as SVG opacity attribute value"
  - "Nodes not connected to flow edges are dimmed to 0.3 via getFlowNodeIds lookup, same as edges"
  - "edgeLayouts Map populated during edge render loop (single pass) — reused for flow overlay without second ELK traversal"
  - "commitlint scope is 'web-component' not '13-03' — project uses package-name scopes"

patterns-established:
  - "SVG flow overlay: renderFlowOverlay(flow, edgeLayouts) => SVG string appended after all layers"
  - "TDD RED/GREEN workflow: failing test commit first, then implementation commit"

requirements-completed:
  - FLOW-01

duration: 5min
completed: "2026-03-23"
---

# Phase 13 Plan 03: Flow Overlay Web Component Summary

**SVG animateMotion flow overlay for `<calm-diagram>` — animated dots on flow edges, numbered sequence badges with tooltips, and 30% opacity dimming for non-flow elements, direction-aware via `CalmTransition.direction` field**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T06:22:21Z
- **Completed:** 2026-03-23T06:27:36Z
- **Tasks:** 1 (+ checkpoint)
- **Files modified:** 5

## Accomplishments

- Created `flowOverlay.ts` with three exports: `renderFlowOverlay` (animated dots + sequence badges), `applyFlowDimming` (opacity for edges), `getFlowNodeIds` (node set for dimming)
- Integrated into `elkRender.ts`: `flow` option resolves matching `CalmFlow`, builds `edgeLayouts` map during edge render, applies opacity wrapping, appends overlay group at top of SVG layer stack
- `CalmDiagram.svelte` now passes `currentFlow` to `renderELKDiagram` — `flow` attribute on `<calm-diagram>` activates overlay
- 11 unit tests covering all 7 behavioral specs from plan plus edge cases (empty flow, empty set, node opacity)
- Both IIFE and ESM bundles build cleanly; `test.html` opens in browser for visual verification

## Task Commits

1. **TDD RED — failing tests** - `0b228b8` (test)
2. **TDD GREEN — flowOverlay.ts + elkRender.ts + CalmDiagram.svelte** - `67519a6` (feat)
3. **test.html visual verification file** - `d02bd3e` (chore)

## Files Created/Modified

- `packages/web-component/src/render/flowOverlay.ts` — SVG flow overlay renderer: `renderFlowOverlay`, `applyFlowDimming`, `getFlowNodeIds`, `EdgeLayout` type
- `packages/web-component/src/render/flowOverlay.test.ts` — 11 tests covering all behavioral specs
- `packages/web-component/src/render/elkRender.ts` — Added `flow` to `RenderOptions`; flow overlay integration with dimming
- `packages/web-component/src/CalmDiagram.svelte` — Pass `currentFlow` to `renderELKDiagram`; flow-badge CSS
- `packages/web-component/test.html` — Visual test: side-by-side plain vs auth-flow diagrams

## Decisions Made

- Flow overlay SVG group appended after node layer so animated dots are never subject to dimming — avoids Pitfall 6 from 13-RESEARCH.md
- `applyFlowDimming` returns string `'1'`/`'0.3'` directly usable as SVG `opacity` attribute value
- Single pass builds `edgeLayouts` Map during edge rendering loop — no second ELK result traversal
- commitlint requires `web-component` scope (package-name convention), not plan ID scope

## Deviations from Plan

None - plan executed exactly as written. All 7 behavioral test specs implemented, integration matches plan action steps 1-5.

## Issues Encountered

- First commit attempt used wrong scope `13-03` — commitlint requires package-name scopes (`web-component`). Fixed immediately before commit landed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Flow overlay fully operational in web component via `flow="<flow-id>"` attribute
- `<calm-diagram flow="auth-flow" data='...'>` renders animated dots, badges, dimming
- Ready for Task 2 checkpoint: human visual verification via `test.html`
- After checkpoint approval: plan 13-03 complete, phase 13 complete

## Self-Check: PASSED

- flowOverlay.ts: FOUND
- flowOverlay.test.ts: FOUND
- test.html: FOUND
- 13-03-SUMMARY.md: FOUND
- Commit 0b228b8 (TDD RED): FOUND
- Commit 67519a6 (feat GREEN): FOUND
- Commit d02bd3e (test.html): FOUND

---
*Phase: 13-embedding-visualization*
*Completed: 2026-03-23*
