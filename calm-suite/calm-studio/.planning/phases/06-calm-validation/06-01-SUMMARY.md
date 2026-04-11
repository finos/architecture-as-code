---
phase: "06-calm-validation"
plan: "01"
subsystem: "studio"
tags: ["validation", "svelte5", "reactive-store", "badges", "nodes", "edges"]
dependency_graph:
  requires:
    - "06-00 (validateCalmArchitecture from calm-core)"
  provides:
    - "validation.svelte.ts reactive store"
    - "ValidationBadge component"
    - "node/edge validation data wiring"
  affects:
    - "06-02 (plan must wire +page.svelte to inject data into node.data)"
tech_stack:
  added: []
  patterns:
    - "Svelte 5 $effect.root for module-level reactive effect"
    - "debounced validation via setTimeout/clearTimeout in $effect"
    - "data prop injection pattern: badges receive counts via node.data, not store imports"
    - "validationSeverity on edge data for color override via finalStyle derived"
key_files:
  created:
    - apps/studio/src/lib/stores/validation.svelte.ts
    - apps/studio/src/lib/canvas/nodes/ValidationBadge.svelte
  modified:
    - apps/studio/vite.config.ts
    - apps/studio/src/lib/canvas/nodes/ServiceNode.svelte
    - apps/studio/src/lib/canvas/nodes/ActorNode.svelte
    - apps/studio/src/lib/canvas/nodes/DatabaseNode.svelte
    - apps/studio/src/lib/canvas/nodes/DataAssetNode.svelte
    - apps/studio/src/lib/canvas/nodes/EcosystemNode.svelte
    - apps/studio/src/lib/canvas/nodes/GenericNode.svelte
    - apps/studio/src/lib/canvas/nodes/LdapNode.svelte
    - apps/studio/src/lib/canvas/nodes/NetworkNode.svelte
    - apps/studio/src/lib/canvas/nodes/SystemNode.svelte
    - apps/studio/src/lib/canvas/nodes/WebclientNode.svelte
    - apps/studio/src/lib/canvas/nodes/ContainerNode.svelte
    - apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte
    - apps/studio/src/lib/canvas/edges/InteractsEdge.svelte
    - apps/studio/src/lib/canvas/edges/DeployedInEdge.svelte
    - apps/studio/src/lib/canvas/edges/ComposedOfEdge.svelte
    - apps/studio/src/lib/canvas/edges/OptionsEdge.svelte
decisions:
  - "$effect.root at module level for validation store — ensures effect runs outside component lifecycle"
  - "Node components do NOT import validation store — receive counts via data.validationErrors/data.validationWarnings injected by +page.svelte in Plan 02"
  - "Edge finalStyle merges dasharray with validation color override — preserves visual line-type distinction while showing validation state"
  - "ContainerNode gets badge on both collapsed and expanded divs — both share the same .container wrapper"
metrics:
  duration: "19min"
  completed: "2026-03-12"
  tasks_completed: 2
  files_changed: 18
---

# Phase 6 Plan 01: Validation Store and Badge Wiring Summary

**Reactive debounced validation store + ValidationBadge component wired into all 11 node types and 5 edge types; badges dormant until +page.svelte data injection in Plan 02.**

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Create validation store and ValidationBadge component | 19d741c | Done |
| 2 | Wire validation badges into all node and edge components | 07f6e26 | Done |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 00 not executed — ran it first before Plan 01**
- **Found during:** Pre-execution check
- **Issue:** Plan 01 depends on `validateCalmArchitecture()` from calm-core (Plan 00). Plan 00 had not been run, so the function did not exist.
- **Fix:** Executed Plan 00 in full before starting Plan 01 tasks. Plan 00 completed successfully with 11 passing tests.
- **Commits:** 8af2808 (test), 0204027 (feat), 19d741c (docs/state)

**2. [Rule 1 - Bug] Added `data` prop to InteractsEdge destructure**
- **Found during:** Task 2 implementation
- **Issue:** InteractsEdge only destructured `style` from EdgeProps, not `data`. Adding `data.validationSeverity` access requires `data` in the props.
- **Fix:** Added `data` to the EdgeProps destructure in InteractsEdge.
- **Files modified:** apps/studio/src/lib/canvas/edges/InteractsEdge.svelte
- **Commit:** 07f6e26

**3. [Rule 1 - Bug] Same fix for DeployedInEdge, ComposedOfEdge, OptionsEdge**
- All three edges similarly didn't destructure `data`. Added `data` to each.
- **Commit:** 07f6e26

## Self-Check: PASSED

- [x] apps/studio/src/lib/stores/validation.svelte.ts exists and exports getIssues, getIssuesByElementId, dismissPanel, isPanelOpen, scrollToElementId functions
- [x] apps/studio/src/lib/canvas/nodes/ValidationBadge.svelte exists (min 20 lines)
- [x] vite.config.ts includes ajv and ajv-formats in optimizeDeps.include
- [x] All 11 node components import ValidationBadge
- [x] All 5 edge components derive validationStyle from data.validationSeverity
- [x] svelte-check shows 42 errors (same count as pre-change — no new errors introduced)
- [x] 07f6e26 commit exists with all 16 node/edge files
