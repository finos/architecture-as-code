---
phase: 03-properties-bidirectional-sync
plan: "03"
subsystem: studio-sync
tags: [bidirectional-sync, canvas, code-panel, properties, undo-redo]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: ["bidirectional-sync-engine"]
  affects: ["apps/studio/src/routes/+page.svelte", "apps/studio/src/lib/canvas/CalmCanvas.svelte", "apps/studio/src/lib/properties/PropertiesPanel.svelte"]
tech_stack:
  added: []
  patterns:
    - "$derived(getModelJson()) for forward sync — no $effect needed, avoids stale closure bugs"
    - "handlePropertyMutation callback pattern — PropertiesPanel calls parent callback to re-project canvas"
    - "400ms debounce on code editor changes before JSON parse and canvas update"
    - "Position preservation via Map<calmId, {x,y}> during reverse sync"
    - "onselectionchange prop on CalmCanvas — emits first selected nodeId/edgeId"
key_files:
  created: []
  modified:
    - "apps/studio/src/routes/+page.svelte"
    - "apps/studio/src/lib/canvas/CalmCanvas.svelte"
    - "apps/studio/src/lib/properties/PropertiesPanel.svelte"
    - "apps/studio/src/lib/properties/NodeProperties.svelte"
    - "apps/studio/src/lib/properties/EdgeProperties.svelte"
decisions:
  - "All three surfaces (canvas, code, properties) are wired through the canonical calmModel store"
  - "onmutate callback propagates through PropertiesPanel to NodeProperties/EdgeProperties — called after each debounced store mutation"
  - "applyFromCanvas called on every canvas mutation including undo/redo — ensures code panel always reflects canvas state"
metrics:
  duration: "10min"
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_modified: 5
requirements_covered: [SYNC-01, SYNC-02, SYNC-03, SYNC-04, PROP-01, PROP-05]
---

# Phase 03 Plan 03: Bidirectional Sync Engine Summary

**One-liner:** Full bidirectional sync wired — canvas mutations update CALM JSON in code panel in real time; code edits update canvas after 400ms debounce; property edits propagate to all three surfaces via onmutate callback.

## What Was Built

The integration plan connecting all Phase 3 components into a working bidirectional sync system:

**Forward sync (canvas -> model -> code panel):**
- `CalmCanvas.svelte` now imports `applyFromCanvas` and calls it after every mutation: drop, place-at-center, connect, changeEdgeType, dragStop (both containment and position), undo, redo, and paste
- `+page.svelte` uses `$derived(getModelJson())` to derive the canonical JSON string reactively — no `$effect` needed, per RESEARCH Pitfall guidance
- `CodePanel` receives the derived `calmJson` as its `value` prop

**Reverse sync (code editor -> model -> canvas):**
- `handleCodeChange` in `+page.svelte` debounces 400ms before parsing JSON
- Valid JSON: pushes undo snapshot, calls `applyFromJson`, projects to Svelte Flow nodes/edges with position preservation
- Invalid JSON: sets `codeParseError` string, canvas unchanged (CodeMirror's built-in `jsonParseLinter` shows red squiggles)

**Selection sync:**
- `CalmCanvas` adds `onselectionchange` prop; wired to SvelteFlow's `onselectionchange` event
- `+page.svelte` tracks `selectedNodeId` and `selectedEdgeId` state; derives `selectedNode` and `selectedEdge` objects for PropertiesPanel
- `CodePanel` receives `selectedNodeId` and `selectedEdgeId` — scrolls to the corresponding JSON block via `findNodeOffset`/`findRelationshipOffset`

**Properties sync:**
- `PropertiesPanel`, `NodeProperties`, `EdgeProperties` all accept `onmutate` prop
- Each debounced mutation handler calls `onmutate?.()` after committing to the store
- `handlePropertyMutation` in `+page.svelte` re-projects the canonical model back to Svelte Flow, preserving node positions

**Unified undo/redo:**
- `applyFromCanvas` called after undo/redo restores a snapshot — code panel reflects the undone state
- `pushSnapshot` called before code editor debounce commits — gives one undo step per debounce window
- `handleBeforeFirstEdit` (wired to `onBeforeFirstEdit` prop) pushes snapshot before first property edit per selection

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1+2 | Wire forward + reverse sync (combined in single page.svelte rewrite) | 817ec38 | +page.svelte, CalmCanvas.svelte, PropertiesPanel.svelte, NodeProperties.svelte, EdgeProperties.svelte |

## Deviations from Plan

### Auto-combined Tasks 1 and 2

**Found during:** Task 1 implementation
**Issue:** Both tasks modify `+page.svelte` and the reverse sync code is logically inextricable from the forward sync wiring (both live in the same file and depend on the same imported functions)
**Fix:** Implemented both Task 1 and Task 2 changes in the single `+page.svelte` rewrite, committed together
**Impact:** Single commit covers both tasks; tests pass; build succeeds

## Test Results

All 71 existing tests pass after changes:
- containment.test.ts (14 tests)
- search.test.ts (8 tests)
- history.test.ts (13 tests)
- clipboard.test.ts (10 tests)
- projection.test.ts (8 tests)
- calmModel.test.ts (18 tests)

## Self-Check: PASSED
