---
phase: 07-extension-packs
plan: 02
subsystem: ui
tags: [extensions, svelte, canvas, palette, pack-registry, drag-and-drop, sidecar]

# Dependency graph
requires:
  - phase: 07-01
    provides: initAllPacks, getAllPacks, resolvePackNode, PackDefinition, NodeTypeEntry
dependency_graph:
  requires: [07-00, 07-01]
  provides: [ExtensionNode, resolveNodeType-extension, NodePalette-collapsible, sidecar-utilities]
  affects: [07-03]

tech-stack:
  added:
    - "@calmstudio/extensions workspace:* — added as dependency to apps/studio"
  patterns:
    - "ExtensionNode delegates pack lookup to resolvePackNode() at render time — nodeTypes.ts stays lightweight"
    - "resolveNodeType() uses colon-check (not registry call) — simple, fast, testable"
    - "NodePalette uses getAllPacks() with $derived to build sections — no hardcoded type lists"
    - "initAllPacks() called at module level in NodePalette — guarantees packs registered before first render"
    - "Sidecar utilities are pure TypeScript with no Svelte imports — fully testable in vitest"

key-files:
  created:
    - apps/studio/src/lib/canvas/nodes/ExtensionNode.svelte
    - apps/studio/src/lib/io/sidecar.ts
  modified:
    - apps/studio/src/lib/canvas/nodeTypes.ts
    - apps/studio/src/lib/palette/NodePalette.svelte
    - apps/studio/src/tests/nodeTypes.test.ts
    - apps/studio/src/tests/sidecar.test.ts
    - apps/studio/package.json

key-decisions:
  - "ExtensionNode resolves pack metadata via resolvePackNode(data.calmType) at render time — avoids importing registry at nodeTypes.ts module level"
  - "resolveNodeType() uses calmType.includes(':') check, not resolvePackNode() call — lightweight, no side effects on import"
  - "NodePalette calls initAllPacks() at module level — packs are always registered before any palette render"
  - "Section expand/collapse state keyed by pack.id with $state<Record<string, boolean>> — core starts expanded, others collapsed"
  - "Search flattens all packs into single filtered list with pack.color.badge attribution"
  - "DnD sends full typeId (aws:lambda) preserving colon-prefix — flows through existing DnD system unchanged"

patterns-established:
  - "Pack-aware component pattern: component receives calmType via data prop, resolves pack metadata internally"
  - "Collapsible section pattern: $state<Record<string, boolean>> keyed by ID, smart default via object spread on toggle"

requirements-completed:
  - EXTK-01
  - EXTK-08

# Metrics
duration: ~4min
completed: "2026-03-12"
tasks: 2
files: 7
---

# Phase 7 Plan 02: Studio Extension Pack Integration Summary

**Pack-prefixed node types now render via ExtensionNode with dynamic SVG icons/colors; NodePalette shows 6 collapsible pack sections (97 total types) with cross-pack search and badge attribution**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-12T16:32:04Z
- **Completed:** 2026-03-12T16:36:53Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- ExtensionNode.svelte created — single Svelte component for all extension pack node types, uses `resolvePackNode(data.calmType)` for icon/color, falls back to GenericNode styling when pack not registered
- resolveNodeType() extended to route colon-prefixed types (aws:lambda, k8s:pod) to 'extension' key — all 4 nodeTypes tests pass including previously-skipped extension stubs
- sidecar.ts created with sidecarNameFor(), detectPacksFromArch(), buildSidecarData() — 6 tests pass
- NodePalette refactored to collapsible pack sections showing all 97 node types across 6 packs (Core CALM, AWS, GCP, Azure, Kubernetes, AI/Agentic)
- Search filters across all packs with [CALM]/[AWS]/[GCP] etc. badge attribution in results
- Custom node input preserved at palette footer — no regression

## Task Commits

1. **Task 1: ExtensionNode + resolveNodeType + sidecar** - `c06e61b` (feat)
2. **Task 2: NodePalette collapsible sections** - `19b3e72` (feat)

## Files Created/Modified

- `apps/studio/src/lib/canvas/nodes/ExtensionNode.svelte` — Single component for all pack-prefixed types; resolves icon/color via resolvePackNode()
- `apps/studio/src/lib/io/sidecar.ts` — Sidecar file utilities: sidecarNameFor(), detectPacksFromArch(), buildSidecarData()
- `apps/studio/src/lib/canvas/nodeTypes.ts` — Added ExtensionNode import/mapping, colon-check in resolveNodeType()
- `apps/studio/src/lib/palette/NodePalette.svelte` — Full refactor: getAllPacks()-driven collapsible sections, search with badges
- `apps/studio/src/tests/nodeTypes.test.ts` — Un-skipped extension tests (resolveNodeType('aws:lambda') returns 'extension')
- `apps/studio/src/tests/sidecar.test.ts` — Un-skipped and implemented with real imports (6 tests)
- `apps/studio/package.json` — Added @calmstudio/extensions workspace:* dependency

## Decisions Made

- ExtensionNode calls resolvePackNode() at render time rather than having nodeTypes.ts import the registry — keeps the module lightweight and avoids side effects on import
- NodePalette calls initAllPacks() at module level — guarantees packs are registered on first use without requiring the page/app to call it separately
- Section expand/collapse state uses $state<Record<string, boolean>> keyed by pack.id — simple and Svelte-idiomatic

## Deviations from Plan

**1. [Rule 3 - Blocking] Added @calmstudio/extensions workspace dependency to studio package.json**
- **Found during:** Task 1 (before writing ExtensionNode)
- **Issue:** `@calmstudio/extensions` was not listed as a studio dependency — symlink was missing from node_modules, imports would fail
- **Fix:** Added `"@calmstudio/extensions": "workspace:*"` to studio/package.json and ran `pnpm install --filter @calmstudio/studio`
- **Files modified:** apps/studio/package.json
- **Verification:** Symlink created at apps/studio/node_modules/@calmstudio/extensions, tests pass
- **Committed in:** c06e61b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for any imports from @calmstudio/extensions to work. Standard workspace setup step.

## Issues Encountered

None beyond the missing dependency noted above.

## Next Phase Readiness

- Extension pack system fully wired into the studio UI
- Pack-prefixed node types render correctly on canvas via ExtensionNode
- NodePalette exposes all 97 node types (9 core + 88 extension) with collapsible sections
- Sidecar utilities ready for use when saving/loading architecture files
- Plan 07-03 (sidecar read/write during file save/open) can proceed

---
*Phase: 07-extension-packs*
*Completed: 2026-03-12*
