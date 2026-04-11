---
phase: 03-properties-bidirectional-sync
plan: "01"
subsystem: ui
tags: [svelte5, codemirror, paneforge, json-editor, resizable-layout, code-panel]

# Dependency graph
requires:
  - phase: 03-properties-bidirectional-sync
    plan: "00"
    provides: "calmModel store, projection functions, direction mutex"

provides:
  - "CodePanel.svelte: CodeMirror 6 JSON editor with tab bar, lint squiggles, status indicator"
  - "useJsonSync.ts: findNodeOffset/findRelationshipOffset using jsonpos for selection scroll"
  - "Resizable three-column layout: palette | canvas+code | properties placeholder"
  - "Nested vertical split: canvas (70%) above CodePanel (30%), all panes resizable via paneforge"

affects:
  - 03-properties-bidirectional-sync (plans 02, 03, 04)

# Tech tracking
tech-stack:
  added:
    - "svelte-codemirror-editor ^2.1.0 — Svelte 5 runes-compatible CodeMirror 6 wrapper"
    - "@codemirror/lang-json ^6.0.2 — JSON language support + jsonParseLinter"
    - "@codemirror/lint ^6.9.5 — linter() and lintGutter() for red squiggles"
    - "@codemirror/theme-one-dark ^6.1.3 — dark mode theme for CodeMirror"
    - "@codemirror/view ^6.39.17 — EditorView for dispatch (scroll/selection)"
    - "@codemirror/state ^6.5.4 — Extension type for extensions array"
    - "paneforge ^1.0.2 — resizable PaneGroup/Pane/PaneResizer for SvelteKit"
    - "jsonpos ^4.1.2 — path-to-character-offset mapping for CALM JSON navigation"
  patterns:
    - "optimizeDeps.exclude for all @codemirror/* packages — required for SvelteKit/vite build"
    - "EditorView stored via onready callback — enables imperative scroll/selection dispatch"
    - "jsonpos() with path array — maps ['nodes', idx] to {start, end} character offsets"
    - "PaneResizer styled with data-resize-handle-active attribute for active drag state"

key-files:
  created:
    - "apps/studio/src/lib/editor/CodePanel.svelte"
    - "apps/studio/src/lib/editor/useJsonSync.ts"
  modified:
    - "apps/studio/src/routes/+page.svelte"
    - "apps/studio/package.json"
    - "apps/studio/vite.config.ts"

key-decisions:
  - "jsonParseLinter imported from @codemirror/lang-json not @codemirror/lint — only lang-json exports it"
  - "@codemirror/view and @codemirror/state installed as direct deps — transitive deps not resolvable by Rollup"
  - "optimizeDeps.exclude for CodeMirror packages — required per svelte-codemirror-editor docs for SvelteKit"
  - "CodePanel wired with empty string value in Task 2 — Plan 03 wires real sync to calmModel store"

# Metrics
duration: 7min
completed: 2026-03-11
---

# Phase 3 Plan 01: CodeMirror Code Panel + Paneforge Layout Summary

**CodeMirror 6 JSON editor panel with lint squiggles and tab bar wired into a paneforge three-column resizable layout**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-11T17:42:32Z
- **Completed:** 2026-03-11T17:49:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Installed 8 new packages: svelte-codemirror-editor, @codemirror/* suite, paneforge, jsonpos
- Created `useJsonSync.ts` with `findNodeOffset`/`findRelationshipOffset` using jsonpos array-path API
- Created `CodePanel.svelte` with CodeMirror 6 JSON editor, tab bar (JSON active, calmscript disabled), status indicator, lint squiggles, dark/light theme switching, and EditorView-based selection scroll
- Restructured `+page.svelte` from flex layout to paneforge PaneGroup: three-column (palette | canvas+code | properties) with nested vertical split (canvas above code panel)
- All 71 tests still pass — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create CodePanel + useJsonSync** - `6eb21f3` (feat)
2. **Task 2: Restructure page layout with paneforge resizable panels** - `bf3fdea` (feat)

## Files Created/Modified

- `apps/studio/src/lib/editor/useJsonSync.ts` — `findNodeOffset` and `findRelationshipOffset` using jsonpos
- `apps/studio/src/lib/editor/CodePanel.svelte` — CodeMirror 6 JSON editor with tab bar, linter, status, scroll sync
- `apps/studio/src/routes/+page.svelte` — Restructured to paneforge three-column resizable layout
- `apps/studio/package.json` — Added svelte-codemirror-editor, @codemirror/* suite, paneforge, jsonpos
- `apps/studio/vite.config.ts` — Added optimizeDeps.exclude for @codemirror packages

## Decisions Made

- `jsonParseLinter` is exported from `@codemirror/lang-json` not `@codemirror/lint` — corrected during implementation
- `@codemirror/view` and `@codemirror/state` must be directly installed — Rollup cannot resolve transitive deps
- All `@codemirror/*` packages added to `optimizeDeps.exclude` — required per svelte-codemirror-editor docs for SvelteKit/vite builds
- CodePanel temporarily wired with empty value in page layout — Plan 03 will wire to calmModel store

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed jsonParseLinter import source**
- **Found during:** Task 1 build verification
- **Issue:** CodePanel imported `jsonParseLinter` from `@codemirror/lint` but it's only exported from `@codemirror/lang-json`
- **Fix:** Changed import to `import { json, jsonParseLinter } from '@codemirror/lang-json'`
- **Files modified:** `apps/studio/src/lib/editor/CodePanel.svelte`
- **Commit:** `bf3fdea`

**2. [Rule 2 - Missing critical functionality] Added @codemirror/view and @codemirror/state as direct deps**
- **Found during:** Task 1/2 build — Rollup could not resolve `@codemirror/view` (transitive dep)
- **Issue:** Importing `EditorView` from `@codemirror/view` requires it to be a direct dependency
- **Fix:** `pnpm add @codemirror/view @codemirror/state` and added both to `optimizeDeps.exclude`
- **Files modified:** `apps/studio/package.json`, `apps/studio/vite.config.ts`, `pnpm-lock.yaml`
- **Commit:** `bf3fdea`

**3. [Rule 3 - Blocking issue] Added optimizeDeps.exclude for CodeMirror in vite.config.ts**
- **Found during:** Task 1 build — svelte-codemirror-editor README explicitly requires this for SvelteKit
- **Issue:** Without exclusion, Vite pre-bundling causes module resolution failures
- **Fix:** Added `optimizeDeps.exclude` block with all @codemirror packages to vite.config.ts
- **Files modified:** `apps/studio/vite.config.ts`
- **Commit:** `6eb21f3`

## Issues Encountered

Commit scope validation: Used `studio` scope (not `03-01`) per commitlint config.

## Self-Check: PASSED

All created files verified on disk. All commits verified in git log:
- `6eb21f3`: feat(studio): install CodeMirror+paneforge deps, create CodePanel and useJsonSync
- `bf3fdea`: feat(studio): restructure page layout with paneforge resizable three-column panels
- `92d05e6`: docs(studio): complete 03-01 plan — CodePanel and paneforge layout

## Next Phase Readiness

- `CodePanel.svelte` and `useJsonSync.ts` are complete and ready for Plan 03 to wire `value` from `getModelJson()` and `onchange` to the debounced `applyFromJson`
- Properties placeholder pane is in the layout ready for Plan 02 to replace with `NodeProperties`/`EdgeProperties` components
- All 71 tests pass — zero regressions from layout restructuring
