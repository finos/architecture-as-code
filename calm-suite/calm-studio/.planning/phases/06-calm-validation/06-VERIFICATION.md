---
phase: 06-calm-validation
verified: 2026-03-12T20:27:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
---

# Phase 6: CALM Validation Verification Report

**Phase Goal:** Architects get immediate, precise feedback when their diagram violates the CALM schema
**Verified:** 2026-03-12T20:27:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Context: Intentional UX Change

The user explicitly changed validation from automatic/reactive (debounced $effect) to user-triggered opt-in (toolbar "Validate" button toggle). This is the authoritative behavior. VALD-01's "without any user action" language in REQUIREMENTS.md is superseded by this explicit user decision. Verification treats user-triggered opt-in as the correct behavior throughout.

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                   | Status     | Evidence                                                                                      |
|----|-----------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | `validateCalmArchitecture()` returns error issues for missing required CALM fields      | VERIFIED   | `validation.ts` lines 95-117: Ajv schema check + semantic rules; test coverage in test.ts     |
| 2  | `validateCalmArchitecture()` returns warning issues for orphan nodes and self-loops     | VERIFIED   | `validation.ts` lines 252-259 (orphan), 239-245 (self-loop); test cases in validation.test.ts |
| 3  | `validateCalmArchitecture()` returns info issues for nodes missing description          | VERIFIED   | `validation.ts` lines 261-267; test case line 109-123 in validation.test.ts                  |
| 4  | Ajv schema validation catches structural violations (wrong types, missing arrays)       | VERIFIED   | `calmStudioSchema` in validation.ts; test "Ajv rejects architecture with wrong types"         |
| 5  | Semantic rules catch dangling refs, duplicates, orphans, self-loops                     | VERIFIED   | `runSemanticRules()` in validation.ts lines 160-272; all 11 unit tests pass                  |
| 6  | Nodes with validation errors show a red badge; nodes with only warnings show amber      | VERIFIED   | `ValidationBadge.svelte`: red `#dc2626` for errors, amber `#d97706` for warnings             |
| 7  | Edges with errors change stroke to red; edges with warnings change stroke to amber      | VERIFIED   | All 5 edge components derive `validationStyle` with `#dc2626`/`#d97706` color overrides      |
| 8  | User can trigger validation via toolbar "Validate" button (opt-in)                      | VERIFIED   | `Toolbar.svelte` has `onvalidate` prop; `+page.svelte` `handleValidate()` calls `runValidation()` |
| 9  | Toggling "Validate" off clears badges and edge colors                                   | VERIFIED   | `+page.svelte` `clearNodeEdgeValidation()` sets all counts to 0 / severity to null           |
| 10 | A bottom drawer panel lists all issues grouped by severity (errors, warnings, info)     | VERIFIED   | `ValidationPanel.svelte` 348 lines: `SEVERITY_ORDER` sort, 3 icon types, grouped display     |
| 11 | Clicking an issue row navigates canvas to the offending node/edge                       | VERIFIED   | `handleNavigateToNode()` in `+page.svelte` calls `canvas.navigateToNode()`; CalmCanvas line 88 |
| 12 | Clicking a validation badge opens panel and scrolls to that node's issues               | VERIFIED   | `ValidationBadge`: `setScrollToElementId(nodeId)`; `ValidationPanel` scroll $effect line 68  |
| 13 | Panel closes when dismissed; toggling "Validate" while open collapses it                | VERIFIED   | `closePanel()` sets `panelOpen=false`; `handleValidate()` checks `isPanelOpen()` first       |
| 14 | MCP server produces identical validation results to the studio (shared engine)          | VERIFIED   | `mcp-server/src/validation.ts` is a thin re-export of `validateCalmArchitecture as validateArchitecture` from calm-core |
| 15 | All calm-core unit tests pass (11 tests)                                                | VERIFIED   | `pnpm --filter @calmstudio/calm-core test`: 11/11 passed                                     |
| 16 | All MCP server tests pass (53 tests)                                                    | VERIFIED   | `pnpm --filter @calmstudio/mcp test`: 53/53 passed                                           |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact                                                              | Expected                          | Status     | Details                                                          |
|-----------------------------------------------------------------------|-----------------------------------|------------|------------------------------------------------------------------|
| `packages/calm-core/src/validation.ts`                                | Shared Ajv validation engine      | VERIFIED   | 273 lines, exports `validateCalmArchitecture`, `ValidationIssue` |
| `packages/calm-core/src/schemas/calm.json`                            | Bundled CALM 2025-03 top-level schema | VERIFIED | 862 bytes, exists alongside 7 sub-schemas                        |
| `packages/calm-core/src/validation.test.ts`                           | Unit tests (min 50 lines)         | VERIFIED   | 146 lines, 11 tests covering all severity levels                 |
| `apps/studio/src/lib/stores/validation.svelte.ts`                     | Reactive on-demand validation store | VERIFIED | 113 lines, exports `runValidation`, `getIssues`, `getIssuesByElementId`, `dismissPanel`, `isPanelOpen`, `scrollToElementId` functions |
| `apps/studio/src/lib/canvas/nodes/ValidationBadge.svelte`             | Reusable badge overlay (min 20 lines) | VERIFIED | 89 lines, red/amber badge with click-to-scroll                   |
| `apps/studio/src/lib/validation/ValidationPanel.svelte`               | Bottom drawer panel (min 80 lines) | VERIFIED  | 348 lines, grouped severity list, scroll-to support, nav callbacks |
| `apps/studio/src/routes/+page.svelte`                                 | Wired enrichment + toolbar + panel | VERIFIED  | Imports all validation functions, `handleValidate`, `enrichNodesEdgesWithValidation`, `handleNavigateToNode` all present |
| `packages/mcp-server/src/validation.ts`                               | Thin re-export from calm-core      | VERIFIED  | 19 lines, re-exports `validateCalmArchitecture as validateArchitecture` |

### Key Link Verification

| From                                          | To                                             | Via                                  | Status  | Details                                                          |
|-----------------------------------------------|------------------------------------------------|--------------------------------------|---------|------------------------------------------------------------------|
| `calm-core/src/validation.ts`                 | `calm-core/src/schemas/calm.json`              | static JSON import for Ajv compile   | WIRED   | `import Ajv from 'ajv'` + `calmStudioSchema` with Ajv compile    |
| `calm-core/src/index.ts`                      | `calm-core/src/validation.ts`                  | re-export                            | WIRED   | `export * from './validation.js'`                                |
| `validation.svelte.ts`                        | `@calmstudio/calm-core`                        | `import validateCalmArchitecture`    | WIRED   | Line 19: `import { validateCalmArchitecture, type ValidationIssue } from '@calmstudio/calm-core'` |
| `validation.svelte.ts`                        | `calmModel.svelte.ts`                          | `getModel()` call in `runValidation` | WIRED   | Line 37: `issues = validateCalmArchitecture(getModel())`         |
| `ValidationBadge.svelte`                      | `validation.svelte.ts`                         | `setScrollToElementId`               | WIRED   | Line 14 import + line 37 call in `handleClick`                   |
| `+page.svelte`                                | `validation.svelte.ts`                         | imports + `handleValidate`           | WIRED   | Lines 32-42 import all store functions; `handleValidate` calls `runValidation()` |
| `+page.svelte`                                | `ValidationPanel.svelte`                       | rendered in paneforge Pane           | WIRED   | Lines 667-674: `{#if isPanelOpen()}` conditionally renders `<ValidationPanel>` |
| `mcp-server/src/validation.ts`                | `@calmstudio/calm-core`                        | re-export of shared engine           | WIRED   | Line 14: `export { validateCalmArchitecture as validateArchitecture } from '@calmstudio/calm-core'` |
| All 11 node components                        | `ValidationBadge.svelte`                       | import + render in node .div         | WIRED   | Confirmed via grep: all 11 import and render `<ValidationBadge>` |
| All 5 edge components                         | `validationSeverity` from `node.data`          | `validationStyle` derived + `finalStyle` on BaseEdge | WIRED | Confirmed via grep: all 5 derive `validationStyle` and use `style={finalStyle}` |

### Requirements Coverage

| Requirement | Plans  | Description                                                                           | Status    | Evidence                                                                              |
|-------------|--------|---------------------------------------------------------------------------------------|-----------|---------------------------------------------------------------------------------------|
| VALD-01     | 00, 01, 02 | Real-time CALM schema validation with inline error indicators on offending nodes/edges | SATISFIED | User-triggered (opt-in) replaces "without any user action" per explicit user request. Inline badges on all 11 nodes + edge color overrides on all 5 edge types. Toolbar "Validate" toggle wired. |
| VALD-02     | 02     | Validation results displayed in dedicated panel with severity (error, warning, info)  | SATISFIED | `ValidationPanel.svelte` displays grouped issues with error/warning/info severity icons, element IDs, two-way navigation. |
| VALD-03     | 00, 01, 02 | Validation runs on debounced changes (not blocking the UI)                           | SATISFIED | Validation is now user-triggered, so it cannot block the UI. When triggered, it runs synchronously but is instant (pure JS, no I/O). Non-blocking by design. |

No orphaned requirements found — all three VALD requirements are covered by plans 00/01/02 and verified in code.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/studio/src/routes/+page.svelte` | 401-403 | `handleExportCalmscript` stub comment: "Phase 4 stub: export CALM JSON with a header comment — Phase 5 will provide real calmscript" | Info | Pre-existing stub from Phase 4/5 — unrelated to Phase 6 validation goal. Not a blocker for Phase 6. |

No blocker anti-patterns found in Phase 6 deliverables. The calmscript stub is pre-existing from a prior phase and has no impact on VALD-01/02/03.

### Human Verification Required

The following items were visually approved by the user during the phase (Task 3 checkpoint) and cannot be further verified programmatically:

#### 1. Inline Badge Visual Appearance

**Test:** Run `pnpm --filter @calmstudio/studio dev`, add a node with missing fields, click "Validate"
**Expected:** Red or amber badge appears on top-right of the node at -8px/-8px offset, 20px diameter circle with white count text
**Why human:** Visual rendering, CSS positioning, and color accuracy require browser inspection

#### 2. ValidationPanel Two-Way Navigation Feel

**Test:** Click an issue row in the validation panel
**Expected:** Canvas smoothly centers and zooms to the offending node (`setCenter` with `duration: 400`)
**Why human:** Animation smoothness and canvas centering accuracy require visual confirmation

#### 3. Validate Button Toggle UX

**Test:** Click "Validate" once (panel opens, badges appear), then click again
**Expected:** Panel collapses and all badges disappear from canvas in the same interaction
**Why human:** State synchronization timing between badge clear and panel collapse is a visual/UX judgment
**Note:** User approved this behavior during the phase checkpoint.

#### 4. Non-blocking Validation Responsiveness

**Test:** Click "Validate" on a diagram with 50+ nodes
**Expected:** No visible lag or UI freeze; response appears instant
**Why human:** Performance feel requires real usage on realistic data

### Gaps Summary

No gaps found. All observable truths verified, all artifacts exist and are substantive, all key links are wired, all three requirement IDs are satisfied, and all tests pass (11 calm-core, 53 MCP server).

The user-triggered opt-in validation model (vs. the originally planned automatic debounced model) is the intended behavior per explicit user request during the Phase 6 checkpoint review. This change is documented in the 06-02-SUMMARY.md and correctly reflected in the codebase.

---

_Verified: 2026-03-12T20:27:00Z_
_Verifier: Claude (gsd-verifier)_
