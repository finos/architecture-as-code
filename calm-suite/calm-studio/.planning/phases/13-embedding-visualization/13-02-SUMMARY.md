---
phase: 13-embedding-visualization
plan: "02"
subsystem: studio
tags: [svelte5, flow-visualization, animation, canvas, toolbar, svgfx]
dependency_graph:
  requires: ["13-01"]
  provides: [flow-selector-toolbar, flow-overlay-edges, flow-state-store, node-dimming]
  affects:
    - apps/studio/src/lib/stores/flowState.svelte.ts
    - apps/studio/src/lib/canvas/edges/FlowOverlay.svelte
    - apps/studio/src/lib/toolbar/Toolbar.svelte
    - apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte
    - apps/studio/src/lib/canvas/edges/InteractsEdge.svelte
    - apps/studio/src/lib/canvas/edges/DeployedInEdge.svelte
    - apps/studio/src/lib/canvas/edges/ComposedOfEdge.svelte
    - apps/studio/src/lib/canvas/edges/OptionsEdge.svelte
    - apps/studio/src/routes/+page.svelte
tech_stack:
  added:
    - "SVG animateMotion with mpath href for path-following dot animation"
    - "SVG foreignObject for tooltip overlay at badge position"
  patterns:
    - "Flow data injected into edges[] via $effect (mirrors validation enrichment pattern)"
    - "FlowOverlay renders as sibling outside dimmed <g> wrapper to avoid opacity inheritance"
    - "Derived flows/activeFlowId/activeFlowEdgeIds computed from reactive getModel() store"
    - "calm-core dist rebuilt to expose CalmTransition/CalmFlow types for TypeScript consumers"
key_files:
  created:
    - apps/studio/src/lib/stores/flowState.svelte.ts
    - apps/studio/src/lib/stores/flowState.svelte.test.ts
    - apps/studio/src/lib/canvas/edges/FlowOverlay.svelte
  modified:
    - apps/studio/src/lib/toolbar/Toolbar.svelte
    - apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte
    - apps/studio/src/lib/canvas/edges/InteractsEdge.svelte
    - apps/studio/src/lib/canvas/edges/DeployedInEdge.svelte
    - apps/studio/src/lib/canvas/edges/ComposedOfEdge.svelte
    - apps/studio/src/lib/canvas/edges/OptionsEdge.svelte
    - apps/studio/src/routes/+page.svelte
decisions:
  - "Flow data injected via $effect into edges[]/nodes[] state arrays — same pattern as validation enrichment, avoids needing separate display arrays"
  - "FlowOverlay is sibling to edge (not child) to avoid opacity: 0.3 inheritance from dimmed wrapper"
  - "Node dimming via inline style injection rather than class-based to avoid CSS scoping conflicts"
  - "calm-core dist rebuild unblocks CalmTransition type imports in studio app"
metrics:
  duration_seconds: 598
  completed_date: "2026-03-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 7
---

# Phase 13 Plan 02: Flow Visualization Summary

**One-liner:** Toolbar flow selector with animated SVG dots along edges, sequence badges with tooltips, and 30% opacity dimming of non-flow elements — all driven by a reactive $state store.

## What Was Built

Flow visualization transforms static architecture diagrams into dynamic sequence views. Architects can select a named flow from the toolbar dropdown to see:

- Blue animated dots travelling along active flow edges in the correct direction (source-to-destination or destination-to-source)
- Numbered sequence badges at edge midpoints showing the transition order
- Tooltip summaries on badge hover (showing CalmTransition.summary text)
- Non-flow edges and nodes dimmed to 30% opacity for focus
- "None" option to restore full-opacity canvas view

### Architecture

**Flow state store** (`flowState.svelte.ts`) — Module-level `$state` tracks the active flow ID. Pure functions (`getActiveFlowEdgeIds`, `getFlowTransitionForEdge`, `isNodeInActiveFlow`) compute derived values from the architecture without additional reactive state.

**FlowOverlay.svelte** — SVG `<g>` component with three parts: a hidden `<path>` as the animateMotion reference, an animated `<circle>` with `<animateMotion><mpath>` using keyPoints for direction control, and a sequence badge group with a foreignObject tooltip on hover.

**Toolbar flow selector** — Added `flows`, `activeFlowId`, and `onflowchange` props. Dropdown renders only when `flows.length > 0`. Selecting "None" passes `null` to `onflowchange`.

**Edge dimming pattern** — Each edge component wraps `<BaseEdge>` in a `<g style="opacity: 0.3">` when `data.dimmed` is true. `FlowOverlay` renders OUTSIDE this wrapper so animation dots maintain full opacity.

**Page wiring** — A `$effect` in `+page.svelte` watches `activeFlowId` and directly injects `flowTransition`/`dimmed` into `edges[]` and `opacity: 0.3` style into `nodes[]`, matching the existing validation enrichment pattern.

## Tasks

### Task 1: Create flow state store and FlowOverlay component (TDD)
- RED commit: `db04e56` — failing tests for flowState store
- GREEN commit: `a2e4829` — flowState.svelte.ts + FlowOverlay.svelte implementation
- 10 store tests pass: getActiveFlowId, setActiveFlowId, getActiveFlowEdgeIds, getFlowTransitionForEdge, isNodeInActiveFlow

### Task 2: Wire flow selector into toolbar and integrate flow overlays into edge rendering
- Commit: `b398404`
- Toolbar: new flow dropdown props + styled `<select>` with "None" option
- All 5 edge components: dimmed wrapper + FlowOverlay conditional render
- `+page.svelte`: flow state imports, $derived flows/activeFlowId/activeFlowEdgeIds, $effect for data injection

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| apps/studio (flowState.svelte.test.ts) | 10 | PASS |
| apps/studio (all tests) | 419 | PASS |
| packages/calm-core | 43 | PASS |
| packages/extensions | 44 | PASS |
| packages/mcp-server | 57 | PASS |
| packages/vscode-extension | 21 | PASS |
| packages/github-action | 10 | PASS |
| **Total** | **604** | **PASS** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CalmTransition not available in @calmstudio/calm-core dist**
- **Found during:** Task 2 typecheck
- **Issue:** calm-core dist was not rebuilt after Plan 01 added CalmTransition/CalmFlow to types.ts, so the TypeScript declarations were missing for consumers
- **Fix:** Rebuilt calm-core package (`pnpm --filter @calmstudio/calm-core build`)
- **Files modified:** packages/calm-core/dist/ (gitignored, not committed)
- **Commit:** No separate commit needed — dist is rebuilt during workspace setup

**2. [Rule 1 - Design] Flow data injection via $effect instead of derived display arrays**
- **Found during:** Task 2 implementation
- **Issue:** Plan spec described passing `flowDisplayEdges`/`flowDisplayNodes` to CalmCanvas, but the normal-mode CalmCanvas uses `bind:nodes` and `bind:edges` for two-way SvelteFlow sync — passing derived arrays would break drag/connect/delete mutations
- **Fix:** Used `$effect` to inject flow data directly into the live `nodes[]`/`edges[]` state, mirroring the existing `enrichNodesEdgesWithValidation()` pattern
- **Files modified:** apps/studio/src/routes/+page.svelte

## Self-Check: PASSED
