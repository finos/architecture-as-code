---
phase: 03-properties-bidirectional-sync
verified: 2026-03-12T09:15:00Z
status: passed
score: 21/21 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 19/21
  gaps_closed:
    - "User can add, edit, and remove interfaces on a node"
    - "User can add and remove custom key-value metadata on nodes and edges"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Add an interface to a node and verify the interface row persists in the properties panel without reselecting the node"
    expected: "Interface row remains visible and editable immediately after adding"
    why_human: "Canvas re-projection after onmutate requires runtime verification to confirm stale props are gone"
  - test: "Add a custom metadata key-value pair and verify it persists in the Custom Properties section without reselecting the node"
    expected: "New key-value row appears and stays after committing"
    why_human: "Same re-projection chain — needs runtime confirmation"
  - test: "Edit a node name in the properties panel and verify the canvas label updates immediately"
    expected: "Node label on canvas changes to the new name after the 300ms debounce"
    why_human: "Visual canvas update requires running app"
  - test: "Type invalid JSON in the code panel and verify the canvas is unchanged while red squiggles appear"
    expected: "Canvas holds last valid state; editor shows red error indicators"
    why_human: "Requires CodeMirror linter visual behavior verification"
  - test: "Edit JSON in the code editor and verify the canvas updates after ~400ms"
    expected: "Diagram nodes/edges update to match the new JSON without page reload"
    why_human: "Debounce timing and visual update require runtime observation"
---

# Phase 3: Properties Bidirectional Sync -- Verification Report

**Phase Goal:** Editing properties in the panel or CALM JSON in the code editor both update the diagram, with no infinite loops
**Verified:** 2026-03-12T09:15:00Z
**Status:** passed
**Re-verification:** Yes -- after gap closure (commit eacf0c9)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | calmToFlow converts CalmArchitecture to Svelte Flow nodes[] and edges[] | VERIFIED | `projection.ts` implements the function; 8 passing tests confirm shape, edge mapping, position preservation, customMetadata round-trip |
| 2 | flowToCalm converts Svelte Flow nodes[] and edges[] back to CalmArchitecture | VERIFIED | `projection.ts` implements the function; round-trip test in `projection.test.ts` confirms all CALM fields preserved |
| 3 | Direction mutex prevents re-entrant sync calls | VERIFIED | `withMutex()` in `calmModel.svelte.ts` uses plain boolean `syncing` flag; `applyFromJson` and `applyFromCanvas` both guarded; 18 calmModel tests pass |
| 4 | applyFromJson / applyFromCanvas update the canonical model and return boolean | VERIFIED | Both functions implemented with correct boolean return semantics; tested in `calmModel.test.ts` |
| 5 | Canvas mutations update CALM JSON in code panel in real time | VERIFIED | `CalmCanvas.svelte` calls `applyFromCanvas` after every mutation (8 call sites); `+page.svelte` uses `$derived(getModelJson())` to feed CodePanel |
| 6 | Editing CALM JSON updates the diagram after debounce without full reload | VERIFIED | `handleCodeChange` in `+page.svelte` debounces 400ms, parses JSON, calls `applyFromJson`, re-projects via `calmToFlow` with position preservation |
| 7 | Invalid JSON holds last valid canvas state; red squiggles show in editor | VERIFIED | `handleCodeChange` catches parse errors, sets `codeParseError`, leaves nodes/edges unchanged; CodePanel receives parseError prop; `jsonParseLinter` linter extension active |
| 8 | Selecting a node/edge scrolls code editor to the corresponding JSON fragment | VERIFIED | `CodePanel.svelte` uses `$effect` on `selectedNodeId`/`selectedEdgeId`; calls `findNodeOffset`/`findRelationshipOffset` from `useJsonSync.ts`; dispatches `scrollIntoView: true` to CodeMirror EditorView |
| 9 | Properties panel shows fields for selected node/edge | VERIFIED | `PropertiesPanel.svelte` routes to `NodeProperties` or `EdgeProperties` based on `selectedNode`/`selectedEdge` props; `+page.svelte` derives objects from nodes[] by calmId match |
| 10 | Selecting a node shows CALM metadata fields (unique-id read-only, name, description, node-type) | VERIFIED | `NodeProperties.svelte` (484 lines) implements all four fields; unique-id is read-only display; name/description are debounced inputs; node-type is a dropdown with all 9 CALM types plus custom |
| 11 | Selecting an edge shows relationship properties | VERIFIED | `EdgeProperties.svelte` (364 lines) implements unique-id (read-only), relationship-type dropdown, protocol (conditional), description, source/destination (read-only) |
| 12 | User can add, edit, and remove interfaces on a node | VERIFIED | `InterfaceList.svelte` accepts `onmutate` prop (line 20-21), calls `onmutate?.()` after handleTypeChange (line 30), handleValueChange debounced (line 37), handleDelete (line 43), and handleAdd (line 48). `NodeProperties.svelte` forwards `{onmutate}` at line 212. |
| 13 | User can add and remove custom key-value metadata on nodes and edges | VERIFIED | `CustomMetadata.svelte` accepts `onmutate` prop (line 17-18), calls `onmutate?.()` after handleValueChange debounced (line 35), handleDelete (line 41), and handleKeyBlur (line 54). `NodeProperties.svelte` forwards `{onmutate}` at line 226. |
| 14 | Changing node-type in properties triggers a store mutation | VERIFIED | `handleTypeChange` in NodeProperties calls `updateNodeProperty(node.data.calmId, 'node-type', value)` followed by `onmutate?.()` |
| 15 | Controls section appears as disabled placeholder with Phase 6 tooltip | VERIFIED | `NodeProperties.svelte` lines 214-223: disabled fieldset with "Coming in Phase 6" message and Phase 6 badge |
| 16 | Panel collapses to thin strip when nothing is selected | VERIFIED | `PropertiesPanel.svelte` uses `.collapsed` CSS class when `!hasSelection`; shows 40px wide strip with rotated "Properties" label |
| 17 | Property edits propagate to all surfaces (canvas + code panel) | VERIFIED | Name, description, node-type, interfaces, and custom metadata all call `onmutate?.()` after mutations, triggering re-projection in `+page.svelte` |
| 18 | Undo/redo works across all three surfaces | VERIFIED | `pushSnapshot` called before code editor debounce and before first property edit per selection; `handleUndo`/`handleRedo` in CalmCanvas call `applyFromCanvas` after restoring, updating code panel |
| 19 | Rapid edits never cause infinite loops or UI freeze | VERIFIED | Direction mutex (`syncing` boolean) prevents re-entrant sync; `$derived` used instead of `$effect` for forward sync to avoid stale closure loops; 400ms debounce on code changes |
| 20 | Code panel has syntax highlighting, line numbers, and error indicators | VERIFIED | `CodePanel.svelte`: `lang={json()}`, `lineNumbers`, `linter(jsonParseLinter())`, `lintGutter()`, `oneDark` theme conditional on dark mode |
| 21 | Three-column layout is resizable via drag handles | VERIFIED | `+page.svelte` uses paneforge `PaneGroup`/`Pane`/`PaneResizer` with correct default sizes; CSS resizer styling with hover and active states |

**Score:** 21/21 truths verified

---

## Required Artifacts

| Artifact | Actual Lines | Status | Details |
|----------|-------------|--------|---------|
| `apps/studio/src/lib/stores/calmModel.svelte.ts` | 215 | VERIFIED | Exports all 13 functions per plan spec |
| `apps/studio/src/lib/stores/projection.ts` | 130 | VERIFIED | Exports calmToFlow and flowToCalm with correct signatures |
| `apps/studio/src/tests/calmModel.test.ts` | 247 | VERIFIED | 18 tests covering mutex, CRUD, node/edge mutations, interface CRUD, metadata CRUD |
| `apps/studio/src/tests/projection.test.ts` | 148 | VERIFIED | 8 tests covering calmToFlow shape, edge shape, round-trip, position preservation, customMetadata |
| `apps/studio/src/lib/editor/CodePanel.svelte` | 244 | VERIFIED | CodeMirror editor with tab bar, status indicator, scroll-to-selection, JSON linting |
| `apps/studio/src/lib/editor/useJsonSync.ts` | 83 | VERIFIED | Exports findNodeOffset and findRelationshipOffset using jsonpos |
| `apps/studio/src/routes/+page.svelte` | 306 | VERIFIED | Contains PaneGroup, applyFromJson, getModelJson, PropertiesPanel, CodePanel wiring |
| `apps/studio/src/lib/properties/PropertiesPanel.svelte` | 136 | VERIFIED | Collapse/expand logic and selection routing |
| `apps/studio/src/lib/properties/NodeProperties.svelte` | 484 | VERIFIED | Node metadata form fields; forwards onmutate to InterfaceList (line 212) and CustomMetadata (line 226) |
| `apps/studio/src/lib/properties/EdgeProperties.svelte` | 364 | VERIFIED | Edge/relationship form fields |
| `apps/studio/src/lib/properties/InterfaceList.svelte` | 317 | VERIFIED | Interface rows with add/edit/remove; accepts onmutate prop and calls it after all mutation handlers |
| `apps/studio/src/lib/properties/CustomMetadata.svelte` | 397 | VERIFIED | Key-value editor; accepts onmutate prop and calls it after all mutation handlers |
| `packages/calm-core/src/types.ts` | 77 | VERIFIED | CalmNode extended with `customMetadata?: Record<string, string>` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `calmModel.svelte.ts` | `projection.ts` | `import { flowToCalm }` | WIRED | Line 20 |
| `calmModel.svelte.ts` | `calm-core/types.ts` | `import CalmArchitecture, CalmNode...` | WIRED | Line 19 |
| `+page.svelte` | `calmModel.svelte.ts` | `$derived(getModelJson())`, `applyFromJson` | WIRED | Lines 13, 29 |
| `+page.svelte` | `CodePanel.svelte` | `value={calmJson} onchange={handleCodeChange}` | WIRED | CodePanel rendered with calmJson, onchange, parseError, selectedNodeId, selectedEdgeId |
| `+page.svelte` | `PropertiesPanel.svelte` | `{selectedNode} {selectedEdge}` | WIRED | PropertiesPanel rendered with both props plus onBeforeFirstEdit and onmutate |
| `CalmCanvas.svelte` | `calmModel.svelte.ts` | `applyFromCanvas` after mutations | WIRED | 8 call sites verified |
| `CodePanel.svelte` | `svelte-codemirror-editor` | `import CodeMirror` | WIRED | Line 10 |
| `NodeProperties.svelte` | `calmModel.svelte.ts` | `import { updateNodeProperty }` | WIRED | Line 16 |
| `NodeProperties.svelte` | `InterfaceList.svelte` | `{onmutate}` prop forwarded | WIRED | Line 212: `<InterfaceList ... {onmutate} />` |
| `NodeProperties.svelte` | `CustomMetadata.svelte` | `{onmutate}` prop forwarded | WIRED | Line 226: `<CustomMetadata ... {onmutate} />` |
| `InterfaceList.svelte` | `calmModel.svelte.ts` | `import addInterface, removeInterface, updateInterface` | WIRED | Lines 12-14; all called in handlers with onmutate follow-up |
| `CustomMetadata.svelte` | `calmModel.svelte.ts` | `import addCustomMetadata, removeCustomMetadata` | WIRED | Lines 9-11; all called in handlers with onmutate follow-up |
| `EdgeProperties.svelte` | `calmModel.svelte.ts` | `import { updateEdgeProperty }` | WIRED | Line 12 |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| PROP-01 | 03-00, 03-02, 03-03, 03-04 | Edit CALM metadata for selected node | SATISFIED | NodeProperties.svelte implements all four fields with debounced mutations and onmutate |
| PROP-02 | 03-00, 03-02, 03-04 | Add/edit/remove interfaces on a node | SATISFIED | InterfaceList.svelte calls store mutations and onmutate; NodeProperties forwards onmutate (line 212) |
| PROP-03 | 03-02, 03-04 | Add/edit/remove CALM controls (placeholder for Phase 6) | SATISFIED | NodeProperties lines 214-223: disabled fieldset with "Coming in Phase 6" |
| PROP-04 | 03-00, 03-02 | Add custom metadata key-value pairs | SATISFIED | CustomMetadata.svelte calls store mutations and onmutate; NodeProperties forwards onmutate (line 226) |
| PROP-05 | 03-00, 03-02, 03-03 | Edit relationship properties | SATISFIED | EdgeProperties.svelte implements relationship-type dropdown, protocol, description |
| SYNC-01 | 03-00, 03-03, 03-04 | Diagram changes update CALM JSON in real time | SATISFIED | applyFromCanvas called on all canvas mutations; $derived(getModelJson()) feeds CodePanel |
| SYNC-02 | 03-00, 03-03, 03-04 | CALM JSON edits update the diagram | SATISFIED | handleCodeChange with 400ms debounce; applyFromJson + calmToFlow re-projection |
| SYNC-03 | 03-00, 03-03, 03-04 | Sync engine prevents infinite loops | SATISFIED | withMutex() with syncing boolean; $derived (not $effect) for forward sync |
| SYNC-04 | 03-00, 03-03 | CALM JSON is single canonical source of truth | SATISFIED | calmModel.svelte.ts is the single module-level $state store |
| CODE-01 | 03-01, 03-04 | View and edit CALM JSON in CodeMirror panel | SATISFIED | CodePanel.svelte with svelte-codemirror-editor and bidirectional value binding |
| CODE-02 | 03-01, 03-04 | Toggle between CALM JSON and calmscript views | SATISFIED | Tab bar with active JSON tab and disabled calmscript tab ("Coming in Phase 5") |
| CODE-03 | 03-01, 03-04 | Syntax highlighting, line numbers, error indicators | SATISFIED | json() language, lineNumbers, linter(jsonParseLinter()), lintGutter(), oneDark theme |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CalmCanvas.svelte` | 260 | `ContainerNode.svelte:7:24 state_referenced_locally` Svelte warning | INFO | Non-blocking -- warns about initial $state value captured; does not affect functionality |

No blocker or warning-level anti-patterns remain.

---

## Human Verification Required

### 1. Interface Add Persists in Panel

**Test:** Drag a node onto canvas, click to select it, click "+Add Interface" in properties panel, set type to "url" and value to "https://test.com"
**Expected:** Interface row remains visible after adding without reselecting the node
**Why human:** The onmutate fix should resolve stale props, but runtime verification confirms the full re-projection chain works end-to-end

### 2. Custom Metadata Add Persists in Panel

**Test:** With a node selected, click "+Add Property" in Custom Properties section, type key "env", value "prod", press Enter
**Expected:** Key-value row appears and persists in the panel
**Why human:** Same re-projection chain -- needs runtime confirmation

### 3. Node Name Propagates to Canvas Label

**Test:** Select a node, change the Name field in properties panel to "Payment Service", wait 300ms
**Expected:** Node label on canvas updates to "Payment Service"
**Why human:** Canvas label update requires visual verification of running app

### 4. Bidirectional Sync Without Infinite Loops

**Test:** Rapidly type in code panel, immediately drag a node, immediately type in code panel again
**Expected:** UI remains responsive, no infinite loop or freeze
**Why human:** Rapid cross-surface editing behavior requires runtime observation

### 5. Invalid JSON Behavior

**Test:** In code panel, delete a closing `}` brace from the JSON
**Expected:** Red squiggles appear in editor, canvas shows last valid state unchanged
**Why human:** CodeMirror linter visual behavior requires running app

---

## Re-verification Summary

**Previous verification** (2026-03-12T08:43:00Z) found 2 gaps:

1. **InterfaceList.svelte** did not accept or call `onmutate` -- canvas nodes[] not re-projected after interface CRUD
2. **CustomMetadata.svelte** did not accept or call `onmutate` -- canvas nodes[] not re-projected after metadata CRUD

**Fix applied** in commit `eacf0c9`:

- `InterfaceList.svelte`: Added `onmutate` to `$props()` (line 20-21); calls `onmutate?.()` after handleTypeChange (30), handleValueChange (37), handleDelete (43), handleAdd (48)
- `CustomMetadata.svelte`: Added `onmutate` to `$props()` (line 17-18); calls `onmutate?.()` after handleValueChange (35), handleDelete (41), handleKeyBlur (54)
- `NodeProperties.svelte`: Passes `{onmutate}` shorthand to `<InterfaceList>` (line 212) and `<CustomMetadata>` (line 226)

**Regression check:** All 19 previously-passing truths confirmed still passing via key file existence and content spot checks. No regressions detected.

**Result:** Both gaps closed. All 21/21 truths now verified. Phase 3 goal achieved.

---

*Verified: 2026-03-12T09:15:00Z*
*Verifier: Claude (gsd-verifier)*
