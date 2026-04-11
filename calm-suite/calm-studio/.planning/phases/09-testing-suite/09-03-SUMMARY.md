---
phase: 09-testing-suite
plan: 03
subsystem: component-tests
tags: [testing, svelte5, testing-library, a11y, components]
dependency_graph:
  requires: [09-01]
  provides: [component-test-coverage, svelteTesting-vite-plugin]
  affects: [apps/studio]
tech_stack:
  added: ["svelteTesting vite plugin from @testing-library/svelte/vite"]
  patterns:
    - "@testing-library/svelte render() with real stores and fixture data"
    - "getByRole/getByLabelText accessibility-first queries"
    - "fireEvent for user interaction simulation"
    - "vi.fn() callback spy assertions"
key_files:
  created:
    - apps/studio/src/tests/components/NodeProperties.test.ts
    - apps/studio/src/tests/components/EdgeProperties.test.ts
    - apps/studio/src/tests/components/ControlsList.test.ts
    - apps/studio/src/tests/components/ValidationPanel.test.ts
    - apps/studio/src/tests/components/GovernancePanel.test.ts
    - apps/studio/src/tests/components/TemplatePicker.test.ts
    - apps/studio/src/tests/components/Toolbar.test.ts
  modified:
    - apps/studio/vite.config.ts
decisions:
  - "svelteTesting() vite plugin required for Svelte 5 component tests — adds browser resolve condition so Svelte uses index-client.js instead of index-server.js in jsdom"
  - "ValidationPanel takes issues as prop (not reading from store) — tests pass issues array directly without store setup"
  - "GovernancePanel tests use real governance store with refreshGovernance() setup — consistent with no-mock project pattern"
  - "Toolbar test helper makeToolbarProps() creates vi.fn() for all required callbacks — avoids prop omission errors"
metrics:
  duration: "8 minutes"
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 8
---

# Phase 9 Plan 03: Component Tests for 7 Interactive Panels Summary

**One-liner:** @testing-library/svelte component tests for all 7 interactive panels with real stores, fixture data, and accessibility assertions — enabled by svelteTesting vite plugin for Svelte 5 browser-mode rendering.

## What Was Built

### Task 1: NodeProperties, EdgeProperties, ControlsList, ValidationPanel

**NodeProperties.test.ts (9 tests)**
- Name input renders with value from CALM model (getByLabelText "Node name")
- Description textarea renders with value (getByLabelText "Node description")
- Node-type combobox renders with correct value (getByRole "combobox", name "Node type")
- Unique ID shows in read-only display field
- Name/description inputs are focusable (not disabled)
- Database node type renders correctly in select

**EdgeProperties.test.ts (8 tests)**
- Relationship type combobox renders with correct value
- Source and destination fields display read-only
- Protocol combobox renders for 'connects' type edge (a11y accessible)
- Description textarea accessible via getByRole textbox
- Protocol NOT rendered for 'deployed-in' type
- 5 standard relationship types available as options
- Unique ID shown in read-only field

**ControlsList.test.ts (9 tests)**
- Controls section toggle button renders with aria-expanded=false (collapsed by default)
- Badge shows control count (1, 2, no badge for 0)
- Click toggle expands section showing control keys
- Empty hint "No controls defined" shown when expanded with empty controls
- Add Control button visible when expanded and not readonly
- Add Control button NOT present in readonly mode

**ValidationPanel.test.ts (13 tests)**
- Problems panel header renders
- Dismiss button has accessible name "Dismiss validation panel"
- ondismiss callback invoked when close button clicked
- Empty state "No validation issues" when no issues
- Error/warning/info issue messages render from props
- Element ID badges render for issues with nodeIds
- Summary text shows "1 error, 1 warning" count format
- onnavigatetonode callback invoked with nodeId when issue row clicked

### Task 2: GovernancePanel, TemplatePicker, Toolbar

**GovernancePanel.test.ts (10 tests)**
- "AIGF Governance" panel header renders
- Empty state "Select an AI node" when selectedNodeId=null
- "No governance recommendations" for non-AI node types
- After applyFromJson(createAIGovernanceArch()) + refreshGovernance(), hasAINodes()=true
- Architecture score badge renders with percentage value
- "Applicable Risks" section renders for ai:llm selected node
- "Recommended Mitigations" section renders for ai:llm node
- Apply buttons are focusable and not disabled (a11y)
- "Unmitigated recommendation" banner renders when mitigations not applied

**TemplatePicker.test.ts (11 tests)**
- Modal title "Start from a template" renders
- Close button has accessible name "Close template picker" (a11y)
- Close button not disabled
- oncancel invoked when close button clicked
- Category tab buttons render for all registered categories
- Tabs have aria-selected attribute (at least 1 selected — a11y tablist)
- Template cards render as buttons with "Load template: ..." accessible names
- onselect invoked with template id when card clicked
- Tablist has accessible name "Template categories" (a11y)
- Dialog has role="dialog" with aria-label="Template picker" (a11y)
- Template descriptions visible in active category cards

**Toolbar.test.ts (20 tests)**
- New button: accessible name "New diagram (⌥N)"
- Open button: accessible name "Open CALM JSON file (Cmd+O)"
- Save button: accessible name "Save diagram (Cmd+S)"
- Validate button: accessible name "Validate CALM diagram"
- Export dropdown: accessible name "Export diagram"
- Demos dropdown: accessible name "Load demo architecture"
- CalmStudio app name renders
- C4 buttons (All/Context/Container/Component) render
- onnew, onopen, onsave, onvalidate, ontemplates callbacks invoked on click
- Governance badge NOT shown when showGovernanceBadge=false
- Governance badge shows score "75%" when showGovernanceBadge=true + score=75
- Badge aria-label contains "AIGF governance score: 50%" (a11y)
- "Untitled" shown when no filename provided
- Filename shown when filename prop provided
- Dirty indicator shown when isDirty=true

## Verification Results

All 7 component test files pass:
- NodeProperties.test.ts: 9 tests
- EdgeProperties.test.ts: 8 tests
- ControlsList.test.ts: 9 tests
- ValidationPanel.test.ts: 13 tests
- GovernancePanel.test.ts: 10 tests
- TemplatePicker.test.ts: 11 tests
- Toolbar.test.ts: 20 tests
- **Total: 80 new component tests**

Full studio test suite: 339 tests pass, 7 pre-existing failures in export.test.ts (unrelated, see Deferred Issues).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Svelte 5 mount not available in test environment**
- **Found during:** Task 1 initial RED phase run
- **Issue:** All component tests failed with `lifecycle_function_unavailable: mount(...) is not available on the server`. Svelte's package.json exports map defaults to `index-server.js` when the `browser` condition is not set. jsdom environment does not set `browser` condition by default.
- **Fix:** Added `svelteTesting()` vite plugin from `@testing-library/svelte/vite` to `apps/studio/vite.config.ts`. This plugin adds the `browser` condition to `resolve.conditions` so that Svelte resolves to `index-client.js` (with `mount()` support) instead of `index-server.js`.
- **Files modified:** apps/studio/vite.config.ts
- **Commit:** 72c82ae (bundled with Task 1)

### Scope Boundary — Not Fixed

Pre-existing failures in `src/tests/io/export.test.ts` (7 tests) caused by `URL.revokeObjectURL is not a function` in jsdom. These failures existed before this plan was executed. Logged to `deferred-items.md`.

## Deferred Issues

- **src/tests/io/export.test.ts (7 tests):** Pre-existing jsdom limitation — `URL.revokeObjectURL` not implemented. Fix: add `vi.stubGlobal` for URL in export test setup. See `.planning/phases/09-testing-suite/deferred-items.md`.

## Commits

| Commit | Task | Description |
|--------|------|-------------|
| 72c82ae | Task 1 | feat(studio): NodeProperties, EdgeProperties, ControlsList, ValidationPanel component tests + svelteTesting plugin |
| e37c1e0 | Task 2 | feat(studio): GovernancePanel, TemplatePicker, Toolbar component tests |

## Self-Check: PASSED

- FOUND: apps/studio/src/tests/components/NodeProperties.test.ts
- FOUND: apps/studio/src/tests/components/EdgeProperties.test.ts
- FOUND: apps/studio/src/tests/components/ControlsList.test.ts
- FOUND: apps/studio/src/tests/components/ValidationPanel.test.ts
- FOUND: apps/studio/src/tests/components/GovernancePanel.test.ts
- FOUND: apps/studio/src/tests/components/TemplatePicker.test.ts
- FOUND: apps/studio/src/tests/components/Toolbar.test.ts
- FOUND: apps/studio/vite.config.ts (with svelteTesting() plugin)
- FOUND commit 72c82ae (Task 1)
- FOUND commit e37c1e0 (Task 2)
