---
phase: "06-calm-validation"
plan: "02"
subsystem: "studio+mcp-server"
tags: ["validation", "svelte5", "paneforge", "navigation", "mcp-server", "calm-core"]
dependency_graph:
  requires:
    - "06-01 (validation store + badge wiring)"
    - "06-00 (validateCalmArchitecture from calm-core)"
  provides:
    - "ValidationPanel bottom drawer component"
    - "Two-way validation navigation (badge->panel, panel->canvas)"
    - "Shared validation engine between studio and MCP server"
  affects:
    - "phase 07+ (validation panel is the central UX for architecture feedback; opt-in toggle model established)"
tech_stack:
  added: []
  patterns:
    - "paneforge Pane bind:this for programmatic collapse/expand"
    - "$effect with guard check for validation data injection into nodes (no applyFromCanvas)"
    - "Re-export of type from .svelte.ts store to avoid @calmstudio/calm-core tsconfig resolution"
    - "Thin re-export wrapper pattern for shared engine (validation.ts -> calm-core)"
key_files:
  created:
    - apps/studio/src/lib/validation/ValidationPanel.svelte
  modified:
    - apps/studio/src/lib/canvas/CalmCanvas.svelte
    - apps/studio/src/lib/stores/validation.svelte.ts
    - apps/studio/src/routes/+page.svelte
    - packages/mcp-server/src/validation.ts
    - packages/mcp-server/src/tools/render.ts
    - packages/mcp-server/src/tests/validate.test.ts
    - packages/mcp-server/src/tests/render.test.ts
    - packages/mcp-server/src/tests/integration.test.ts
decisions:
  - "bind:this on Pane component for programmatic collapse/expand (not bind:pane — pane prop doesn't exist in PaneAPI)"
  - "Inject validation data into canonical nodes via $effect with change-guard instead of displayNodes approach — avoids canvas mutation routing issues"
  - "ValidationIssue re-exported from validation.svelte.ts store to avoid @calmstudio/calm-core tsconfig resolution issues in Svelte components"
  - "MCP validation.ts replaced with thin re-export of validateCalmArchitecture as validateArchitecture alias — preserves consumer interface"
  - "Test fixtures updated to include node descriptions — calm-core engine produces [INFO] issues for nodes without descriptions"
  - "Validation changed from automatic to user-triggered (toolbar Validate button) — post-checkpoint UX improvement"
  - "Validate button toggles panel on/off — second press hides panel without permanent dismiss"
  - "Toggling panel off clears node badges and edge severity colors — keeps canvas clean"
requirements-completed:
  - VALD-01
  - VALD-02
  - VALD-03
metrics:
  duration: "45min"
  completed: "2026-03-12"
  tasks_completed: 3
  files_changed: 13
---

# Phase 6 Plan 02: Validation Panel and MCP Engine Upgrade Summary

**ValidationPanel bottom drawer with two-way navigation, user-triggered validation toggle, shared calm-core engine in MCP server — all VALD requirements complete.**

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Create ValidationPanel, wire +page.svelte enrichment and bottom drawer | 5ae2426 | Done |
| 2 | Upgrade MCP server to use shared validation engine | 2df6eb6 | Done |
| 3 | Visual verification of complete CALM validation system | approved | Done |
| 4 | Add @calmstudio/calm-core workspace dependency | 9b73baa | Done (post-checkpoint) |
| 5 | Change validation from automatic to user-triggered | c9eb11e | Done (post-checkpoint) |
| 6 | Make Validate button toggle panel on/off | ca4e0ed | Done (post-checkpoint) |
| 7 | Clear node badges and edge colors when toggling validation off | 5cde923 | Done (post-checkpoint) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] bind:pane not valid — used bind:this instead**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `bind:pane={validationPane}` but paneforge Pane component does not have a `pane` prop. The pane API (`collapse()`, `expand()`, etc.) is exposed via `bind:this`.
- **Fix:** Changed to `bind:this={validationPane}` and typed as `{ collapse: () => void; expand: () => void; }`.
- **Files modified:** apps/studio/src/routes/+page.svelte
- **Commit:** 5ae2426

**2. [Rule 1 - Bug] displayNodes/bind:nodes approach would break canvas mutations**
- **Found during:** Task 1 implementation
- **Issue:** Plan suggested passing `displayNodes` as `bind:nodes` to CalmCanvas, but CalmCanvas uses bind:nodes for two-way sync (mutations come back from canvas). Using a separate displayNodes state would orphan canvas mutations (drag, connect) from the canonical nodes store.
- **Fix:** Kept `bind:nodes={nodes}` (canonical) and used an `$effect` with a change-guard to inject validation data directly into nodes. Guard (`n.data?.validationErrors === errs`) prevents infinite re-runs.
- **Files modified:** apps/studio/src/routes/+page.svelte
- **Commit:** 5ae2426

**3. [Rule 1 - Bug] ValidationPanel @calmstudio/calm-core tsconfig resolution**
- **Found during:** Task 1 svelte-check
- **Issue:** `import type { ValidationIssue } from '@calmstudio/calm-core'` fails in svelte-check (pre-existing tsconfig resolution issue for the entire codebase). ValidationPanel had 1 new error.
- **Fix:** Added `export type { ValidationIssue }` re-export to `validation.svelte.ts`, updated ValidationPanel to import from `$lib/stores/validation.svelte`.
- **Files modified:** apps/studio/src/lib/stores/validation.svelte.ts, apps/studio/src/lib/validation/ValidationPanel.svelte
- **Commit:** 5ae2426

**4. [Rule 1 - Bug] MCP server tests fail: calm-core adds [INFO] for missing descriptions**
- **Found during:** Task 2 test run
- **Issue:** The new calm-core engine produces `[INFO] Node "X" has no description` for nodes without a description field. Existing tests created nodes without descriptions and expected "No validation issues found." — these now fail.
- **Fix:** Updated test fixtures in validate.test.ts, render.test.ts, and integration.test.ts to include `description` fields on all nodes in "should be valid" test cases.
- **Files modified:** packages/mcp-server/src/tests/validate.test.ts, render.test.ts, integration.test.ts
- **Commit:** 2df6eb6

### Post-Checkpoint User-Requested Improvements

**5. [User Request] Add @calmstudio/calm-core workspace dependency**
- **Found during:** Post-checkpoint testing
- **Issue:** MCP server package.json missing the workspace dependency for @calmstudio/calm-core
- **Fix:** Added `"@calmstudio/calm-core": "workspace:*"` to mcp-server dependencies
- **Files modified:** packages/mcp-server/package.json
- **Commit:** 9b73baa

**6. [User Request] Change validation from automatic to user-triggered**
- **Found during:** Post-checkpoint UX review
- **Issue:** Always-on debounced validation fired during typing and was intrusive
- **Fix:** Removed automatic $effect-driven validation; runs only when user clicks Validate toolbar button
- **Files modified:** apps/studio/src/routes/+page.svelte
- **Commit:** c9eb11e

**7. [User Request] Make Validate button toggle panel on/off**
- **Found during:** Post-checkpoint UX review
- **Issue:** No way to re-hide panel after showing without permanently dismissing it
- **Fix:** Validate button now toggles — first press runs validation and opens panel; second press collapses it
- **Files modified:** apps/studio/src/routes/+page.svelte
- **Commit:** ca4e0ed

**8. [User Request] Clear node badges and edge colors when toggling validation off**
- **Found during:** Testing toggle behavior
- **Issue:** Hiding the panel left stale red badges and colored edges on canvas
- **Fix:** When panel is toggled off, badge counts reset to 0 and edge severity colors clear
- **Files modified:** apps/studio/src/routes/+page.svelte
- **Commit:** 5cde923

---

**Total deviations:** 4 auto-fixed bugs (Tasks 1-2) + 4 user-requested post-checkpoint improvements
**Impact on plan:** Auto-fixes corrected implementation-detail errors. Post-checkpoint changes supersede the "Panel auto-opens on first error" plan truth with a better opt-in model at user's explicit request. All three VALD requirements are fully met.

## Self-Check: PASSED

- [x] apps/studio/src/lib/validation/ValidationPanel.svelte exists (163 lines, min 80)
- [x] +page.svelte imports getIssues, getErrorCountForElement, etc. from validation.svelte
- [x] +page.svelte contains ValidationPanel component
- [x] CalmCanvas.svelte exports navigateToNode(calmId: string) method
- [x] packages/mcp-server/src/validation.ts re-exports validateCalmArchitecture as validateArchitecture
- [x] All 53 MCP server tests pass
- [x] All 11 calm-core tests pass
- [x] svelte-check shows 42 errors (same count as pre-change — no new errors introduced)
- [x] 5ae2426 commit exists (Task 1)
- [x] 2df6eb6 commit exists (Task 2)
- [x] 9b73baa commit exists (post-checkpoint)
- [x] c9eb11e commit exists (post-checkpoint)
- [x] ca4e0ed commit exists (post-checkpoint)
- [x] 5cde923 commit exists (post-checkpoint)
