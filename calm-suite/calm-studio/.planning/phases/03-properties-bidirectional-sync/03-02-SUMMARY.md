---
phase: 03-properties-bidirectional-sync
plan: "02"
subsystem: ui
tags: [svelte5, xyflow, calm-architecture, properties-panel, interfaces, custom-metadata]

# Dependency graph
requires:
  - phase: 03-properties-bidirectional-sync
    plan: "00"
    provides: "calmModel.svelte.ts mutation functions: updateNodeProperty, updateEdgeProperty, addInterface, removeInterface, updateInterface, addCustomMetadata, removeCustomMetadata"

provides:
  - "InterfaceList.svelte: compact inline rows for CALM interfaces with type dropdown, value input, add/remove"
  - "CustomMetadata.svelte: key-value pair editor with locked key after creation, debounced value updates"
  - "NodeProperties.svelte: full CALM node form — unique-id (RO), name, description, node-type, interfaces, controls placeholder, custom metadata"
  - "EdgeProperties.svelte: full CALM relationship form — unique-id (RO), rel-type, protocol, description, source/dest (RO)"
  - "PropertiesPanel.svelte: outer shell routing to node/edge forms; collapses to 40px strip when nothing selected"

affects:
  - 03-properties-bidirectional-sync (plan 03 — page layout wiring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onBeforeFirstEdit callback prop: properties components signal parent before first mutation per selection — parent provides snapshot callback"
    - "Debounce pattern: 300ms setTimeout/clearTimeout on all free-text inputs; type/select changes are immediate"
    - "firstEditSignaled flag: $state boolean reset on node/edge ID change via $effect — ensures snapshot is pushed once per selection"

key-files:
  created:
    - "apps/studio/src/lib/properties/InterfaceList.svelte"
    - "apps/studio/src/lib/properties/CustomMetadata.svelte"
    - "apps/studio/src/lib/properties/NodeProperties.svelte"
    - "apps/studio/src/lib/properties/EdgeProperties.svelte"
    - "apps/studio/src/lib/properties/PropertiesPanel.svelte"
  modified: []

key-decisions:
  - "onBeforeFirstEdit callback prop instead of calling pushSnapshot directly — properties components lack canvas nodes/edges arrays; parent (Plan 03 wiring) provides the snapshot callback"
  - "Controls section uses disabled fieldset with Phase 6 tooltip text — placeholder is non-interactive and visually distinct"
  - "PropertiesPanel collapsed state: 40px width with vertically-rotated 'Properties' label — purely visual, Pane handles actual width"
  - "isCustomType derived from calmType not in CALM_NODE_TYPES — allows display of existing custom types from loaded CALM JSON"

patterns-established:
  - "Properties panel collapse: class:collapsed on aside + width: 40px CSS — paneforge Pane handles actual resize"
  - "Read-only CALM fields: div.read-only-field with monospace font, user-select:all for copy — never a real input"

requirements-completed: [PROP-01, PROP-02, PROP-03, PROP-04, PROP-05]

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 3 Plan 02: Properties Panel Components Summary

**Five Svelte 5 properties panel components covering all CALM node and edge metadata fields, with debounced mutations, interface CRUD, custom key-value metadata, and a controls placeholder**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-11T17:42:37Z
- **Completed:** 2026-03-11T17:50:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created InterfaceList.svelte and CustomMetadata.svelte as reusable sub-components with compact rows, debounce, and dark mode
- Created NodeProperties.svelte with all 9 CalmNodeType options, custom type support, controls placeholder, and first-edit snapshot signaling
- Created EdgeProperties.svelte with relationship-type dropdown, conditional protocol field, and read-only source/destination
- Created PropertiesPanel.svelte routing to node/edge forms; collapses to 40px strip when nothing selected
- All 71 pre-existing tests continue to pass — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create InterfaceList and CustomMetadata sub-components** - `140daf8` (feat)
2. **Task 2: Create NodeProperties, EdgeProperties, and PropertiesPanel** - `e75fc5f` (feat)

## Files Created/Modified

- `apps/studio/src/lib/properties/InterfaceList.svelte` — Inline interface rows: type dropdown (url/host-port/container-image/port/custom), value input, add via nanoid, remove
- `apps/studio/src/lib/properties/CustomMetadata.svelte` — Key-value editor: key locked after creation, debounced value updates, add new row flow
- `apps/studio/src/lib/properties/NodeProperties.svelte` — Node form: unique-id (RO), name, description, node-type dropdown (9 types + custom), InterfaceList, controls placeholder, CustomMetadata
- `apps/studio/src/lib/properties/EdgeProperties.svelte` — Relationship form: unique-id (RO), rel-type, protocol (conditional), description, source/dest (RO)
- `apps/studio/src/lib/properties/PropertiesPanel.svelte` — Outer shell: routes by selection, collapses to thin strip with rotated label when nothing selected

## Decisions Made

- Used `onBeforeFirstEdit` callback prop instead of calling `pushSnapshot()` directly. The properties components do not have access to the canvas nodes/edges arrays that pushSnapshot requires. The parent page (Plan 03 wiring) will provide the callback with a closure over the canvas state.
- Controls section implemented as disabled `<fieldset>` with "Coming in Phase 6" text — non-interactive and visually grayed, matching the plan spec.
- `isCustomType` derived from whether `calmType` is not in the CALM_NODE_TYPES constant array — this correctly handles existing CALM JSON that may already have custom type strings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] onBeforeFirstEdit callback prop instead of direct pushSnapshot call**
- **Found during:** Task 2 (NodeProperties implementation)
- **Issue:** Plan specified calling `pushSnapshot()` but properties components have no access to canvas `nodes[]`/`edges[]` arrays that `pushSnapshot(nodes, edges)` requires
- **Fix:** Replaced with `onBeforeFirstEdit?: () => void` callback prop — component calls it before first mutation; parent (Plan 03) provides closure over canvas state
- **Files modified:** NodeProperties.svelte, EdgeProperties.svelte, PropertiesPanel.svelte (forwarded)
- **Verification:** Build passes, component API is clean, Plan 03 can wire correctly
- **Committed in:** e75fc5f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical wiring)
**Impact on plan:** The `onBeforeFirstEdit` callback achieves the same snapshot-before-mutation guarantee with a cleaner API. No scope creep. Plan 03 wiring is unaffected.

## Issues Encountered

The commitlint config enforces 100-character line limit on commit body lines — adjusted commit message line lengths accordingly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All five properties components are self-contained and ready to drop into Plan 03 page layout wiring
- `onBeforeFirstEdit` callback prop must be wired in Plan 03 — provide a closure calling `pushSnapshot(nodes, edges)` from the canvas
- PropertiesPanel accepts `selectedNode` and `selectedEdge` props — Plan 03 will derive these from SvelteFlow `onNodeClick`/`onEdgeClick` event handlers

---
*Phase: 03-properties-bidirectional-sync*
*Completed: 2026-03-11*
