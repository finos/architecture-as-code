---
phase: 02-calm-canvas-core
plan: 02
subsystem: ui
tags: [svelte5, xyflow, svelte-flow, svg, typescript, calm-nodes, node-components]

# Dependency graph
requires:
  - phase: 02-calm-canvas-core
    plan: 01
    provides: SvelteKit scaffold, @xyflow/svelte canvas, CalmInterface type from calm-core

provides:
  - 11 Svelte 5 node components with distinct SVG shapes for all CALM node types
  - nodeTypes map registering all 11 components for use with <SvelteFlow nodeTypes={nodeTypes} />
  - resolveNodeType() helper mapping custom/unknown CALM types to 'generic' fallback
  - ContainerNode with collapse/expand toggle dispatching 'node:toggle-collapse' DOM event

affects:
  - 02-03 through 02-08 (all subsequent Phase 2 plans use nodeTypes map)
  - Phase 3 bidirectional sync (creates nodes using resolveNodeType)
  - Phase 4 import/export (CALM JSON -> node data shape established here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline SVG shapes inside Svelte node components — shape differentiates type, not color (monochrome per user decision)"
    - "NodeResizer with isVisible={selected} — resize handle appears only when node is selected"
    - "4 default Handles per node (top=target, bottom=source, left=target, right=source) + optional per-interface named Handles"
    - "ContainerNode toggle-collapse dispatched as DOM CustomEvent bubbling from node to canvas — decoupled from Svelte Flow internals"
    - "resolveNodeType(calmType) provides safe fallback from CalmNodeType | string to nodeTypes key"

key-files:
  created:
    - apps/studio/src/lib/canvas/nodes/ActorNode.svelte
    - apps/studio/src/lib/canvas/nodes/SystemNode.svelte
    - apps/studio/src/lib/canvas/nodes/ServiceNode.svelte
    - apps/studio/src/lib/canvas/nodes/DatabaseNode.svelte
    - apps/studio/src/lib/canvas/nodes/NetworkNode.svelte
    - apps/studio/src/lib/canvas/nodes/WebclientNode.svelte
    - apps/studio/src/lib/canvas/nodes/EcosystemNode.svelte
    - apps/studio/src/lib/canvas/nodes/LdapNode.svelte
    - apps/studio/src/lib/canvas/nodes/DataAssetNode.svelte
    - apps/studio/src/lib/canvas/nodes/GenericNode.svelte
    - apps/studio/src/lib/canvas/nodes/ContainerNode.svelte
    - apps/studio/src/lib/canvas/nodeTypes.ts
  modified: []

key-decisions:
  - "Monochrome-only node styling — shape alone differentiates types (no per-type coloring), per pre-existing user decision"
  - "ContainerNode collapse state uses local $state + DOM CustomEvent — avoids tight coupling to Svelte Flow node update API"
  - "resolveNodeType uses a Set for O(1) built-in type lookup and returns 'generic' for any unknown string"
  - "Scope `studio` used for conventional commits — commitlint requires scopes from allowed list, 02-02 is not a valid scope"

patterns-established:
  - "Pattern: CALM node components — NodeProps destructure, NodeResizer isVisible={selected}, 4 default Handles, optional interface Handles loop"
  - "Pattern: Interface Handles — loop data.interfaces array, position=Right with top offset via inline style, id=iface['unique-id']"
  - "Pattern: Fallback node — GenericNode with dashed border for custom CALM node-type strings not in the 9 built-ins"

requirements-completed: [CALM-01, CALM-02, CALM-04]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 2 Plan 02: CALM Node Components Summary

**11 Svelte 5 node components with distinct SVG shapes registered in nodeTypes map — actor/person, system/double-border, service/gear, database/cylinder, network/cloud, webclient/browser, ecosystem/hexagon, ldap/shield-key, data-asset/document, generic/dashed-rect, container/collapsible-boundary**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T11:51:15Z
- **Completed:** 2026-03-11T11:54:18Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- All 11 node components built with inline SVG shapes that differentiate CALM types at a glance without color
- Each component includes NodeResizer, 4 default Handle connectors, and optional per-interface named Handles
- ContainerNode supports collapse/expand via chevron button dispatching a `node:toggle-collapse` DOM event
- nodeTypes.ts exports both the registration map and a `resolveNodeType()` helper for safe CALM type mapping
- `pnpm --filter @calmstudio/studio build` passes cleanly after all files created

## Task Commits

Each task was committed atomically:

1. **Task 1: Create all 11 custom node Svelte components with distinct shapes** - `5106674` (feat)
2. **Task 2: Create nodeTypes registration map** - `a582f60` (feat)

**Plan metadata:** to be committed after SUMMARY.md creation (docs)

## Files Created/Modified

- `apps/studio/src/lib/canvas/nodes/ActorNode.svelte` — Person silhouette: head circle + trapezoid body + arm line
- `apps/studio/src/lib/canvas/nodes/SystemNode.svelte` — Double border rectangle (outer + inner border, both 2px/1px)
- `apps/studio/src/lib/canvas/nodes/ServiceNode.svelte` — Rounded rect with gear/cog SVG path
- `apps/studio/src/lib/canvas/nodes/DatabaseNode.svelte` — Cylinder: top ellipse + side lines + bottom ellipse + mid dashed ring
- `apps/studio/src/lib/canvas/nodes/NetworkNode.svelte` — Cloud shape via single SVG path with arcs
- `apps/studio/src/lib/canvas/nodes/WebclientNode.svelte` — Browser window: rect + toolbar divider + 3 dots + URL bar + content lines
- `apps/studio/src/lib/canvas/nodes/EcosystemNode.svelte` — Regular hexagon via SVG polygon points
- `apps/studio/src/lib/canvas/nodes/LdapNode.svelte` — Shield outline with embedded key icon (circle + stem + teeth)
- `apps/studio/src/lib/canvas/nodes/DataAssetNode.svelte` — Document with folded corner + 3 horizontal content lines
- `apps/studio/src/lib/canvas/nodes/GenericNode.svelte` — Dashed-border rectangle showing custom type label below name
- `apps/studio/src/lib/canvas/nodes/ContainerNode.svelte` — Collapsible boundary: collapsed=compact rect, expanded=dashed boundary box with header bar + chevron button
- `apps/studio/src/lib/canvas/nodeTypes.ts` — nodeTypes map + resolveNodeType() helper with O(1) Set lookup

## Decisions Made

- Monochrome styling throughout — shape is the only visual differentiator. This was a pre-existing user decision carried forward.
- ContainerNode collapse toggle dispatches a DOM CustomEvent (`node:toggle-collapse`) so the parent canvas can respond without tight coupling to Svelte Flow internal APIs.
- `resolveNodeType` uses a `Set<string>` for O(1) lookup of the 9 built-in types; unknown types return `'generic'`.
- Used `studio` as conventional commit scope — commitlint enforces a scopes allowlist; the plan ID `02-02` is not in that list.

## Deviations from Plan

None — plan executed exactly as written. All 11 components created with specified shapes and behaviors, nodeTypes.ts created with the exact export structure from the plan.

## Issues Encountered

None significant. The commitlint `scope-enum` hook rejected the `02-02` scope on first commit attempt — switched to `studio` (valid per the project's allowed scopes list).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `nodeTypes` is ready to be wired into `<SvelteFlow nodeTypes={nodeTypes} />` in `+page.svelte` (Plan 02-03)
- `resolveNodeType()` is ready for use in Plan 02-03 (canvas state store) and Plan 04 (CALM JSON import)
- ContainerNode `node:toggle-collapse` event needs a handler in the canvas page to hide/show children (Plan 02-03)
- All CALM visual types are now distinct and recognizable; next step is connecting them to real CALM data

## Self-Check: PASSED

Files verified present on disk. Both task commits (5106674, a582f60) confirmed in git log.

---
*Phase: 02-calm-canvas-core*
*Completed: 2026-03-11*
