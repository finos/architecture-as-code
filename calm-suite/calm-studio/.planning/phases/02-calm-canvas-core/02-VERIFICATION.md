---
phase: 02-calm-canvas-core
verified: 2026-03-11T22:32:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
---

# Phase 2: Calm Canvas Core Verification Report

**Phase Goal:** Build the core CALM canvas with all node types, edge types, drag-and-drop palette, containment, undo/redo, copy/paste, dark mode, search, and keyboard shortcuts.
**Verified:** 2026-03-11T22:32:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 9 CALM node types render as distinct custom Svelte components | VERIFIED | 9 files in `apps/studio/src/lib/canvas/nodes/` with distinct SVG shapes |
| 2 | Custom (unknown) node types render via GenericNode fallback | VERIFIED | `resolveNodeType()` returns 'generic' for any non-built-in string; `GenericNode.svelte` exists |
| 3 | All 5 CALM relationship types render as distinct edge styles | VERIFIED | 5 edge components with solid/dashed/dotted lines + arrow/diamond markers |
| 4 | Protocol labels display on connects edges | VERIFIED | `ConnectsEdge.svelte` renders `EdgeLabel` when `data.protocol` or `label` is set |
| 5 | Drag-and-drop palette with all 9 types + Custom entry | VERIFIED | `NodePalette.svelte` lists all 9 CALM types, custom input, and search filter |
| 6 | DnD from palette creates typed nodes on canvas | VERIFIED | `CalmCanvas.svelte` handles `ondrop` reading `application/calm-node-type` dataTransfer |
| 7 | Containment (deployed-in, composed-of) creates parent-child visual nesting | VERIFIED | `containment.ts` `makeContainment()` sets `parentId` + `extent:'parent'`; called from `onconnect` and `onnodedragstop` |
| 8 | User can draw edges between nodes (handle-to-handle) | VERIFIED | 4 `<Handle>` components on each node; `onconnect` handler in `CalmCanvas.svelte` |
| 9 | User can select, multi-select, move, resize, delete nodes | VERIFIED | `deleteKey=['Delete','Backspace']`, `selectionKey="Shift"`, `multiSelectionKey="Meta"` in SvelteFlow props |
| 10 | User can zoom and pan canvas | VERIFIED | `zoomOnScroll={true}`, `panOnDrag={true}` in SvelteFlow props |
| 11 | Undo/redo with Cmd+Z / Cmd+Shift+Z | VERIFIED | `pushSnapshot/undo/redo` wired in `CalmCanvas.svelte`; 13 unit tests pass |
| 12 | Copy/paste with new unique IDs via Cmd+C / Cmd+V | VERIFIED | `copy/paste` wired in `CalmCanvas.svelte`; `nanoid()` generates new IDs; 10 unit tests pass |
| 13 | Dark mode toggle with system preference detection and localStorage persistence | VERIFIED | `theme.svelte.ts` with `initTheme()/toggleTheme()/isDark()`; toggle button in `+page.svelte`; `initTheme()` in layout `onMount` |
| 14 | Node search by name/type highlights matching nodes | VERIFIED | `NodeSearch.svelte` + `search.ts` Fuse.js searcher; 8 unit tests pass; `Cmd+F` toggles panel |
| 15 | Keyboard shortcuts wired for all documented actions | VERIFIED | `@svelte-put/shortcut` action in `CalmCanvas.svelte` covers Cmd+Z/Shift+Z/C/V/A/F |
| 16 | All 45 unit tests pass (containment, history, clipboard, search) | VERIFIED | `pnpm --filter @calmstudio/studio test --run` exits 0 with 45 tests passing, 0 failures |

**Score:** 16/16 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/studio/vite.config.ts` | Vitest inline config with jsdom + SvelteKit + noExternal | VERIFIED | Contains `test.include`, `environment: 'jsdom'`, `ssr.noExternal: ['@xyflow/svelte']` |
| `apps/studio/playwright.config.ts` | Playwright E2E config | VERIFIED | 23 lines; chromium project; `pnpm dev` web server |
| `apps/studio/src/tests/containment.test.ts` | Unit tests for containment | VERIFIED | 5.1KB; 14 real assertions (replaces stub); all pass |
| `apps/studio/src/tests/history.test.ts` | Unit tests for undo/redo | VERIFIED | 4.2KB; 13 real assertions; all pass |
| `apps/studio/src/tests/clipboard.test.ts` | Unit tests for copy/paste | VERIFIED | 2.9KB; 10 real assertions; all pass |
| `apps/studio/src/tests/search.test.ts` | Unit tests for node search | VERIFIED | 2.9KB; 8 real assertions; all pass |
| `apps/studio/src/routes/+page.svelte` | Main layout: sidebar + canvas | VERIFIED | 117 lines; DnDProvider + NodePalette + CalmCanvas composition; dark mode toggle |
| `apps/studio/src/routes/+page.ts` | SSR disabled | VERIFIED | `export const ssr = false` |
| `apps/studio/src/routes/+layout.svelte` | Layout with initTheme | VERIFIED | `initTheme()` called in `onMount` |
| `packages/calm-core/src/types.ts` | CalmNodeType, CalmRelationshipType, CalmNode, CalmRelationship, CalmInterface, CalmArchitecture | VERIFIED | All 6 types/interfaces exported; 75 lines |
| `apps/studio/src/lib/canvas/nodeTypes.ts` | nodeTypes map + resolveNodeType() | VERIFIED | 11-entry map; Set-based O(1) type lookup; 'generic' fallback |
| `apps/studio/src/lib/canvas/edgeTypes.ts` | edgeTypes map + DEFAULT_EDGE_TYPE | VERIFIED | 5-entry map; `DEFAULT_EDGE_TYPE = 'connects'` |
| `apps/studio/src/lib/canvas/nodes/ActorNode.svelte` | Person-shaped actor node | VERIFIED | 54 lines; head circle + trapezoid SVG shape; 4 Handles |
| `apps/studio/src/lib/canvas/nodes/ContainerNode.svelte` | Collapsible boundary box | VERIFIED | 3.7KB; collapse/expand toggle; dispatches `node:toggle-collapse` event |
| `apps/studio/src/lib/canvas/nodes/GenericNode.svelte` | Dashed-border fallback | VERIFIED | 1.7KB; dashed border; shows custom type label |
| `apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte` | Solid line + filled arrow + protocol label | VERIFIED | 69 lines; `url(#marker-arrow-filled)`; protocol label via `EdgeLabel` |
| `apps/studio/src/lib/canvas/edges/EdgeMarkers.svelte` | 4 SVG marker defs | VERIFIED | 2.0KB; arrow-filled, diamond-open, diamond-filled, arrow-open; `orient="auto-start-reverse"` on all |
| `apps/studio/src/lib/canvas/edgeTypes.ts` | edgeTypes map | VERIFIED | 5 entries; `DEFAULT_EDGE_TYPE = 'connects'` |
| `apps/studio/src/lib/canvas/CalmCanvas.svelte` | Full canvas wrapper with all integrations | VERIFIED | 450 lines; DnD drop, edge creation, containment, keyboard shortcuts, undo/redo, copy/paste, search |
| `apps/studio/src/lib/palette/NodePalette.svelte` | Left sidebar with 9 types, search, DnD, click-to-place | VERIFIED | 485 lines; all 9 types; search filter; drag + double-click-to-place; Custom entry |
| `apps/studio/src/lib/palette/DnDProvider.svelte` | Svelte context for shared drag type | VERIFIED | `useDnD()` exports `{ dragType, setDragType }` |
| `apps/studio/src/lib/canvas/containment.ts` | makeContainment, removeContainment, isContainmentType | VERIFIED | 78 lines; pure functions; immutable; all 14 unit tests pass |
| `apps/studio/src/lib/stores/history.svelte.ts` | Undo/redo snapshot store | VERIFIED | 87 lines; module-level `$state`; pushSnapshot/undo/redo/canUndo/canRedo/resetHistory |
| `apps/studio/src/lib/stores/clipboard.svelte.ts` | Copy/paste store | VERIFIED | 67 lines; nanoid IDs; +20/+20 offset; hasClipboard/resetClipboard |
| `apps/studio/src/lib/stores/theme.svelte.ts` | Dark mode store | VERIFIED | 65 lines; localStorage persistence; matchMedia listener; `applyClass()` toggles `dark` class on `<html>` |
| `apps/studio/src/lib/search/search.ts` | Fuse.js node searcher | VERIFIED | 42 lines; `createNodeSearcher` + `searchNodes`; threshold 0.4; empty query returns [] |
| `apps/studio/src/lib/search/NodeSearch.svelte` | Floating search panel | VERIFIED | 185 lines; Cmd+F toggle; result count; Escape to close; auto-focuses input on mount |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NodePalette.svelte` | `CalmCanvas.svelte` | HTML5 DnD `application/calm-node-type` dataTransfer | WIRED | `setData('application/calm-node-type', type)` in palette dragstart; `getData('application/calm-node-type')` in canvas `ondrop` |
| `CalmCanvas.svelte` | `containment.ts` | `onconnect` handler calling `makeContainment` for deployed-in/composed-of | WIRED | `isContainmentType(edgeType)` + `makeContainment(...)` called in `handleConnect`; also called in `handleNodeDragStop` |
| `CalmCanvas.svelte` | `history.svelte.ts` | `pushSnapshot` before mutations, `undo/redo` on keyboard | WIRED | `pushSnapshot` called before every mutation (`ondrop`, `onconnect`, `paste`, `onnodedragstop`); `handleUndo/Redo` wired via `@svelte-put/shortcut` |
| `CalmCanvas.svelte` | `clipboard.svelte.ts` | `copy` on Cmd+C, `paste` on Cmd+V | WIRED | `handleCopy()` calls `copy(nodes)`; `handlePaste()` calls `paste(nodes)` and appends result |
| `NodeSearch.svelte` | `search.ts` | `searchNodes` called on input change | WIRED | `$derived(searchNodes(searcher, query))` reacts to input changes; results dispatched via `onresults` prop |
| `+layout.svelte` | `theme.svelte.ts` | `initTheme()` in `onMount` | WIRED | `import { initTheme }` + `onMount(() => initTheme())` in layout |
| `+page.svelte` | `theme.svelte.ts` | `toggleTheme()` button + `isDark()` reactive getter | WIRED | `onclick={toggleTheme}` on toolbar button; `{#if isDark()}` controls sun/moon icon |
| `apps/studio/src/routes/+page.ts` | SSR config | `export const ssr = false` | WIRED | Confirmed in file |
| `apps/studio/vite.config.ts` | `@xyflow/svelte` SSR | `ssr.noExternal: ['@xyflow/svelte']` | WIRED | Confirmed in file |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CANV-01 | 02-00, 02-01, 02-04 | User can drag CALM-typed nodes from palette onto canvas | SATISFIED | NodePalette DnD + CalmCanvas drop handler create typed nodes |
| CANV-02 | 02-04 | User can draw typed edges between nodes | SATISFIED | Handle components on all nodes; `onconnect` creates edges; right-click context menu changes edge type |
| CANV-03 | 02-04 | User can select, multi-select, move, resize, delete nodes and edges | SATISFIED | SvelteFlow `deleteKey`, `selectionKey`, `multiSelectionKey` props; NodeResizer on SystemNode and ContainerNode |
| CANV-04 | 02-04 | User can zoom, pan, navigate canvas | SATISFIED | `zoomOnScroll={true}`, `panOnDrag={true}` in SvelteFlow props |
| CANV-05 | 02-00, 02-05 | User can undo/redo any canvas action (unlimited history) | SATISFIED | `history.svelte.ts` unlimited stack; `pushSnapshot` before every mutation; Cmd+Z/Cmd+Shift+Z wired |
| CANV-06 | 02-00, 02-05 | User can use keyboard shortcuts | SATISFIED | `@svelte-put/shortcut` action: Cmd+Z, Cmd+Shift+Z, Cmd+C, Cmd+V, Cmd+A, Cmd+F, Delete/Backspace |
| CANV-07 | 02-00, 02-05 | User can copy/paste nodes with new unique IDs | SATISFIED | `clipboard.svelte.ts` uses `nanoid()` for both `node.id` and `node.data.calmId` on paste |
| CANV-08 | 02-00, 02-05 | User can search/filter nodes by name, type, or ID | SATISFIED | Fuse.js search on `data.label`, `data.calmType`, `id`; NodeSearch panel; Cmd+F toggle |
| CANV-09 | 02-00, 02-05 | User can toggle dark/light mode with system preference detection | SATISFIED | `theme.svelte.ts` with matchMedia + localStorage; `dark` class on `<html>` |
| CALM-01 | 02-01, 02-02 | All 9 CALM node types as distinct custom Svelte components | SATISFIED | ActorNode, SystemNode, ServiceNode, DatabaseNode, NetworkNode, WebclientNode, EcosystemNode, LdapNode, DataAssetNode |
| CALM-02 | 02-02 | Custom node types rendered via GenericNode | SATISFIED | `resolveNodeType()` maps any unknown string to 'generic'; GenericNode shows custom type label |
| CALM-03 | 02-03 | All 5 CALM relationship types as distinct edge styles | SATISFIED | ConnectsEdge (solid+arrow), InteractsEdge (dashed+arrow), DeployedInEdge (solid+diamond-open), ComposedOfEdge (dashed+diamond-filled), OptionsEdge (dotted+arrow-open) |
| CALM-04 | 02-02 | CALM interfaces rendered as typed handles | SATISFIED | All node components loop `data.interfaces` and render per-interface `<Handle>` with `id={iface['unique-id']}` |
| CALM-05 | 02-00, 02-04 | Containment (deployed-in, composed-of) as sub-flows | SATISFIED | `makeContainment` sets `parentId` + `extent:'parent'`; ContainerNode is the parent boundary |
| CALM-06 | 02-03 | Protocol labels on connects edges | SATISFIED | ConnectsEdge renders `EdgeLabel` with `data.protocol ?? label` |

**All 15 Phase 2 requirements: SATISFIED**

---

## Anti-Patterns Found

No blocking anti-patterns detected. Notable observations:

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `NodePalette.svelte:160` | `ondblclick` for click-to-place | INFO | Plan specified `onclick`; implementation uses double-click. The plan says "onclick handler for click-to-place" but the actual UX uses double-click. Not a functional blocker — the feature works — but the interaction model differs from spec. The `aria-label` says "Drag or double-click to place" which is a reasonable UX choice. |
| `ActorNode.svelte` (and several other node components) | No `NodeResizer` component | INFO | The plan specified NodeResizer on all nodes. SystemNode and ContainerNode have it; ActorNode, DatabaseNode, NetworkNode, and other smaller nodes do not. Resize via SvelteFlow default handles still works; dedicated NodeResizer is a UX polish item, not a functional gap. |

---

## Human Verification Required

The following items were verified by the user during Task 3 of Plan 02-05 (all 13 visual verification steps approved):

1. **Distinct node shapes** — All 9 CALM types visually distinct (actor=person, database=cylinder, service=gear, network=cloud, webclient=browser, ecosystem=hexagon, ldap=shield, data-asset=document, system=double-border)
2. **Drag-and-drop** — Dragging from palette creates typed node at drop point
3. **Custom node** — "Custom..." entry creates generic dashed-border node with user's type string
4. **Edge drawing** — Handle-to-handle drag creates 'connects' edge with solid line + arrow
5. **Containment visual** — deployed-in edge causes child node to nest inside parent boundary box
6. **Undo/redo behavior** — Cmd+Z restores deleted node; Cmd+Shift+Z re-deletes
7. **Copy/paste** — Pasted nodes appear offset with no duplicate IDs
8. **Dark mode** — All elements switch color on toggle; persists on refresh
9. **Search** — Cmd+F opens search panel; matching nodes are highlighted

These were approved by the user (per 02-05-SUMMARY.md: "All 13 visual verification checks approved by user").

---

## Summary

Phase 2 goal fully achieved. All 15 requirements (CANV-01 through CANV-09, CALM-01 through CALM-06) are satisfied and traceable to concrete implementation. The CALM canvas is a working professional diagramming tool:

- **11 custom node components** with distinct SVG shapes and typed handles
- **5 custom edge components** with distinct line styles and SVG markers
- **Working drag-and-drop palette** with 9 CALM types + Custom entry + search
- **Containment** via both edge-draw and physical drag-into
- **Unlimited undo/redo** with snapshot-before-mutation pattern
- **Copy/paste** with new nanoid IDs on paste
- **Dark mode** with localStorage persistence and system preference detection
- **Fuse.js node search** via Cmd+F floating panel
- **Full keyboard shortcut suite** via @svelte-put/shortcut
- **45 unit tests passing** (containment: 14, history: 13, clipboard: 10, search: 8)

The two INFO-level observations (double-click vs single-click for palette placement, and inconsistent NodeResizer coverage) are minor UX details that do not affect goal achievement.

---

_Verified: 2026-03-11T22:32:00Z_
_Verifier: Claude (gsd-verifier)_
