---
phase: 09-testing-suite
plan: 04
subsystem: studio-e2e
tags: [playwright, e2e, testing, core-diagram, template, governance, c4, validation]
dependency_graph:
  requires: [09-01]
  provides: [E2E test suite for all 4 critical CalmStudio user workflows]
  affects: [apps/studio/src/tests/e2e/]
tech_stack:
  added: []
  patterns:
    - Playwright browser automation with reuseExistingServer
    - Blob URL download interception via createElement patch
    - showOpenFilePicker stub via page.addInitScript string script
    - Dialog auto-accept via page.on (not page.once) for reliability
    - Functional assertions only, no visual regression snapshots
key_files:
  created:
    - apps/studio/src/tests/e2e/core-diagram-flow.spec.ts
    - apps/studio/src/tests/e2e/template-governance.spec.ts
    - apps/studio/src/tests/e2e/c4-navigation.spec.ts
    - apps/studio/src/tests/e2e/validation-flow.spec.ts
  modified: []
decisions:
  - Use createElement patch (not showSaveFilePicker stub) for download interception — exportAsCalm uses Blob URL + anchor click, not FSA API
  - page.addInitScript string template for showOpenFilePicker stub — callback+arg form fails to load SvelteKit app due to serialization issues
  - page.on (not page.once) for dialog handler in template load helpers — more reliable when multiple tests share a helper
  - Track "first download" separately from sidecar — export triggers two downloads (CALM JSON then .calmstudio.json 200ms later)
  - aria-current="page" span for breadcrumb root assertion — "All Systems" renders as non-clickable span when not drilled in
  - Governance tab in PropertiesPanel must be clicked to see GovernancePanel — no auto-switch per locked decision
metrics:
  duration: 16min
  completed: "2026-03-15"
  tasks_completed: 2
  files_created: 4
---

# Phase 09 Plan 04: E2E Tests for Critical User Workflows Summary

4 Playwright E2E spec files covering all CalmStudio user workflows: core diagram flow (add nodes, export CALM JSON, reimport), FluxNova template + AIGF governance (load template, open Governance tab, apply mitigation, export with decorator), C4 view navigation (switch levels, breadcrumb rendering, drill-down, mode exit), and validation flow (orphaned node detection, panel toggle, issue row click, re-validation).

## What Was Built

**Task 1: core-diagram-flow.spec.ts + template-governance.spec.ts**

- `core-diagram-flow.spec.ts` (2 tests): Tests the create-add-export-reimport cycle:
  - Adds Actor + Service nodes via double-click from NodePalette
  - Intercepts Blob URL downloads via `document.createElement` patch + `URL.createObjectURL` override
  - Verifies exported CALM JSON has nodes array with at least 1 entry
  - Reimports via `showOpenFilePicker` stub (string script injection to avoid SvelteKit loading issues)
  - Verifies 2 nodes appear on canvas after import

- `template-governance.spec.ts` (5 tests): Tests the OSFF Toronto demo flow:
  - Template picker modal opens with correct heading + FluxNova category active
  - FluxNova AI Agent template loads 11 nodes onto canvas
  - AI node click reveals Governance tab in PropertiesPanel
  - Governance tab shows `AIGF Governance` header + mitigations
  - Apply/already-applied state handled gracefully
  - Export produces CALM JSON with AIGF decorator containing governance-score

**Task 2: c4-navigation.spec.ts + validation-flow.spec.ts**

- `c4-navigation.spec.ts` (3 tests): Tests C4 view mode:
  - C4 segmented control (All/Context/Container/Component) with aria-pressed state tracking
  - C4Breadcrumb appears when C4 mode is active with `role="navigation"`
  - "All Systems" shows as `aria-current="page"` span (not button) at root with no drill-down
  - Container level badge `aria-label="C4 level: container"` verification
  - Breadcrumb disappears after clicking "All" to exit C4 mode
  - Optional drill-down with conditional "All Systems" button click

- `validation-flow.spec.ts` (4 tests): Tests validation workflow:
  - Orphaned nodes produce visible issue rows (`.vp-row`) in Problems panel
  - Issue row click navigates to the problem element on canvas
  - Validate button toggles panel open/closed (two-click behavior per STATE.md decision)
  - Two orphaned nodes produce 2+ warnings with "warning" in summary text

## Test Counts

| Spec | Tests | Coverage |
|------|-------|----------|
| core-diagram-flow.spec.ts | 2 | Create, export, reimport cycle |
| template-governance.spec.ts | 5 | Template load, governance tab, export with AIGF |
| c4-navigation.spec.ts | 3 | View switch, breadcrumb, drill-down, exit |
| validation-flow.spec.ts | 4 | Detection, panel toggle, navigation, re-validation |
| **Total** | **14** | All 4 CONTEXT.md-locked workflows |

All 14 tests pass in ~25 seconds using 4 workers with `reuseExistingServer`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FSA API stub serialization breaks SvelteKit app loading**
- **Found during:** Task 1 (core-diagram-flow reimport test)
- **Issue:** `page.addInitScript(fn, arg)` with a JSON string arg as `arg` silently caused the SvelteKit app to fail loading (body empty, Components text never appeared) — likely a serialization edge case in Playwright
- **Fix:** Used `page.addInitScript(scriptString)` with template literal embedding the JSON content directly; reliable across all tests
- **Files modified:** apps/studio/src/tests/e2e/core-diagram-flow.spec.ts

**2. [Rule 1 - Bug] Export intercepted sidecar instead of CALM JSON**
- **Found during:** Task 1 (template-governance export test)
- **Issue:** `exportAsCalm` triggers TWO downloads: main CALM JSON immediately, then `.calmstudio.json` sidecar 200ms later. Capturing "last download" picked up the sidecar which has no nodes/decorators
- **Fix:** Track first download separately (`__firstDownloadHref`) — main CALM JSON always fires first
- **Files modified:** apps/studio/src/tests/e2e/template-governance.spec.ts

**3. [Rule 1 - Bug] `getByText('Start from a template')` strict mode violation**
- **Found during:** Task 1 (template picker modal test)
- **Issue:** The text exists in two places: empty canvas button AND the TemplatePicker modal heading
- **Fix:** Used `getByRole('heading', { name: 'Start from a template' })` to target only the modal heading
- **Files modified:** apps/studio/src/tests/e2e/template-governance.spec.ts

**4. [Rule 1 - Bug] GovernancePanel not directly accessible — requires tab click**
- **Found during:** Task 1 (governance panel test)
- **Issue:** GovernancePanel is inside a "Governance" tab in PropertiesPanel, not directly in the page layout. The "AIGF Governance" text is only visible after: (a) clicking an AI node, (b) clicking the "Governance" tab
- **Fix:** Added explicit tab-click step; verified both Properties and Governance tabs work correctly
- **Files modified:** apps/studio/src/tests/e2e/template-governance.spec.ts

**5. [Rule 1 - Bug] FluxNova Platform template name mismatch in C4 test**
- **Found during:** Task 2 (C4 navigation)
- **Issue:** Template aria-label is "Load template: FluxNova: Platform" but test used regex `/fluxnova platform/i` (missing colon)
- **Fix:** Updated regex to `/fluxnova: platform/i`
- **Files modified:** apps/studio/src/tests/e2e/c4-navigation.spec.ts

**6. [Rule 1 - Bug] "All Systems" breadcrumb renders as span not button**
- **Found during:** Task 2 (C4 breadcrumb assertion)
- **Issue:** C4Breadcrumb renders the last segment as `<span aria-current="page">` not a `<button>`. When not drilled in, "All Systems" is the only and therefore last segment — always a span
- **Fix:** Used `locator('[aria-current="page"]').toHaveText(/all systems/i)` for root assertion; conditional button click only attempted if "All Systems" is a button (drilled state)
- **Files modified:** apps/studio/src/tests/e2e/c4-navigation.spec.ts

**7. [Rule 1 - Bug] `.svelte-flow__nodes` container hidden when empty**
- **Found during:** Task 1 (node count verification)
- **Issue:** Playwright `toBeVisible` fails on `.svelte-flow__nodes` when it has zero height (empty container)
- **Fix:** Changed all container checks to `.svelte-flow__node` (individual node elements) which are always visible when they exist
- **Files modified:** apps/studio/src/tests/e2e/core-diagram-flow.spec.ts, template-governance.spec.ts

**8. [Rule 1 - Bug] `toHaveCountGreaterThan` not a Playwright method**
- **Found during:** Task 2 (validation panel)
- **Issue:** Used non-existent Playwright method — should be `.first().toBeVisible()`
- **Fix:** Replaced with `await expect(issueRows.first()).toBeVisible()`
- **Files modified:** apps/studio/src/tests/e2e/validation-flow.spec.ts

**9. [Rule 2 - Missing Functionality] Dialog handler should use page.on not page.once**
- **Found during:** Task 1+2 (template load helpers)
- **Issue:** `page.once('dialog')` registered after `templateCard.click()` is unreliable when test ordering causes the dialog to fire at an unexpected time; also when tests share a page, once fires only for first dialog
- **Fix:** Changed to `page.on('dialog', dialog => dialog.accept())` registered at start of load helper, before any action that could trigger a dialog
- **Files modified:** apps/studio/src/tests/e2e/template-governance.spec.ts, c4-navigation.spec.ts

## Self-Check: PASSED

All files exist:
- FOUND: apps/studio/src/tests/e2e/core-diagram-flow.spec.ts (191 lines)
- FOUND: apps/studio/src/tests/e2e/template-governance.spec.ts (280 lines)
- FOUND: apps/studio/src/tests/e2e/c4-navigation.spec.ts (190 lines)
- FOUND: apps/studio/src/tests/e2e/validation-flow.spec.ts (153 lines)

Commits verified:
- 74eef29: feat(studio): add E2E tests for core diagram flow and template+governance
- 1d89dc8: feat(studio): add E2E tests for C4 navigation and validation flow

All 14 E2E tests pass: `npx playwright test --reporter=list` in 25s with 4 workers.
