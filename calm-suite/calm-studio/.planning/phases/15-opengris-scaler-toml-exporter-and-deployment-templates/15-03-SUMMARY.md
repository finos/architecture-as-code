---
phase: 15-opengris-scaler-toml-exporter-and-deployment-templates
plan: "03"
subsystem: ui
tags: [svelte5, toolbar, export, opengris, toml, demo, vitest]

requires:
  - phase: 15-01
    provides: buildScalerToml pure function in scalerToml.ts
  - phase: 15-02
    provides: OpenGRIS deployment templates

provides:
  - exportAsScalerToml wrapper in export.ts (Blob + downloadDataUrl pattern)
  - Conditional Scaler.toml (OpenGRIS) export button in Toolbar export dropdown
  - $derived reactive OpenGRIS node detection in +page.svelte
  - opengris-local-cluster entry in Toolbar DEMOS const
  - static/demos/opengris-local-cluster.calm.json demo file
  - Toolbar test coverage for showScalerTomlExport conditional rendering (3 tests)
  - exportAsScalerToml test coverage in export.test.ts (3 tests)

affects:
  - future export format additions (follow same Blob+downloadDataUrl wrapper pattern)
  - Toolbar prop surface (pattern: conditional UI via showX boolean + onX callback)

tech-stack:
  added: []
  patterns:
    - "Vite alias for @calmstudio/calm-core/test-fixtures resolves to TS source for test imports"
    - "Conditional toolbar items via showX boolean prop + optional callback prop pattern"
    - "$derived rune for reactive model-derived UI state (not computed once at mount)"

key-files:
  created:
    - apps/studio/static/demos/opengris-local-cluster.calm.json
  modified:
    - apps/studio/src/lib/io/export.ts
    - apps/studio/src/lib/toolbar/Toolbar.svelte
    - apps/studio/src/routes/+page.svelte
    - apps/studio/src/tests/io/export.test.ts
    - apps/studio/src/tests/components/Toolbar.test.ts
    - apps/studio/vite.config.ts

key-decisions:
  - "$derived rune used for showScalerTomlExport (not a plain function call) to ensure
    reactivity when opengris nodes are added after page load"
  - "vite.config.ts resolve.alias added for @calmstudio/calm-core/test-fixtures to unblock
    Vitest test runs (pre-existing missing alias prevented export.test.ts from running)"

requirements-completed:
  - TOML-02
  - TOML-04

duration: 25min
completed: "2026-03-23"
---

# Phase 15 Plan 03: UI Wiring for Scaler.toml Export Summary

**Conditional Scaler.toml export button wired end-to-end: Toolbar shows it only when
opengris: nodes are present on canvas, reactive via $derived, with demo file and full test coverage**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-23T10:25:00Z
- **Completed:** 2026-03-23T10:50:00Z
- **Tasks:** 2
- **Files modified:** 6 (+ 1 created)

## Accomplishments

- `exportAsScalerToml(arch, filename?)` added to export.ts following the exact
  Blob + downloadDataUrl + setTimeout revoke pattern from existing exportAsCalmscript
- Toolbar.svelte gains `showScalerTomlExport` boolean prop and `onexportscalertoml`
  optional callback; export menu conditionally renders "Scaler.toml (OpenGRIS)" button
- `+page.svelte` wires `handleExportScalerToml` and uses `$derived` to reactively detect
  opengris: nodes so the export option appears immediately when a node is added to canvas
- DEMOS const in Toolbar updated with opengris-local-cluster entry
- `static/demos/opengris-local-cluster.calm.json` created: valid CALM 1.2 with scheduler,
  2 workers, object-storage, worker-manager, cluster container, all with proper relationships
- 6 new tests: 3 in export.test.ts (exportAsScalerToml), 3 in Toolbar.test.ts
  (conditional rendering + callback invocation)
- All 409 studio tests pass

## Task Commits

1. **Task 1: UI wiring + tests** - `dba0124` (feat)
2. **Task 2: Demo file + full build verify** - `f1877af` (feat)

## Files Created/Modified

- `apps/studio/src/lib/io/export.ts` - Added exportAsScalerToml + import buildScalerToml
- `apps/studio/src/lib/toolbar/Toolbar.svelte` - Added showScalerTomlExport prop,
  onexportscalertoml callback, conditional button in export menu, opengris-local-cluster demo
- `apps/studio/src/routes/+page.svelte` - Added handleExportScalerToml, $derived
  showScalerTomlExport, wired both to Toolbar
- `apps/studio/src/tests/io/export.test.ts` - Added exportAsScalerToml describe block
  (3 tests) + vi.mock for scalerToml module
- `apps/studio/src/tests/components/Toolbar.test.ts` - Added Scaler.toml export button
  describe block (3 tests)
- `apps/studio/vite.config.ts` - Added resolve.alias for test-fixtures (auto-fix)
- `apps/studio/static/demos/opengris-local-cluster.calm.json` - New demo file (created)

## Decisions Made

- Used `$derived` rune for `showScalerTomlExport` rather than a function call in the
  template. This is the correct Svelte 5 pattern for derived reactive state that depends
  on a `$state` store — calling `getModel()` directly in the template would only capture
  the initial value and not re-evaluate reactively.
- Added `vite.config.ts` resolve alias for `@calmstudio/calm-core/test-fixtures` to fix
  a pre-existing blocked test run. The alias maps to the TypeScript source since the
  package.json exports map only exposes `.` (the main entry).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vite.config.ts alias for @calmstudio/calm-core/test-fixtures**
- **Found during:** Task 1 (running export.test.ts verification)
- **Issue:** `@calmstudio/calm-core/test-fixtures` was not in package.json exports map,
  causing Vite/Vitest to fail with "Missing './test-fixtures' specifier" error. This
  pre-existing issue blocked the entire export.test.ts suite.
- **Fix:** Added `resolve.alias` entry in vite.config.ts pointing to the TS source file
  at `../../packages/calm-core/test-fixtures/index.ts`
- **Files modified:** `apps/studio/vite.config.ts`
- **Verification:** `pnpm exec vitest run src/tests/io/export.test.ts` → 19 tests pass
- **Committed in:** `dba0124` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential to unblock test verification. No scope creep — purely
a missing Vite alias for an existing test import that was already in the file.

## Issues Encountered

None beyond the auto-fixed vite alias. All planned changes executed exactly as specified.

## Next Phase Readiness

- Full end-to-end workflow complete: load OpenGRIS template → canvas renders opengris:
  nodes → Scaler.toml export button appears → click → scaler.toml downloaded
- OpenGRIS Local Cluster demo available from Demos dropdown for instant exploration
- Phase 15 is now complete (plans 01, 02, 03 all done)

---
*Phase: 15-opengris-scaler-toml-exporter-and-deployment-templates*
*Completed: 2026-03-23*

## Self-Check: PASSED

- FOUND: `apps/studio/src/lib/io/export.ts` (exportAsScalerToml present: 2 occurrences)
- FOUND: `apps/studio/src/lib/toolbar/Toolbar.svelte` (showScalerTomlExport present: 3 occurrences)
- FOUND: `apps/studio/src/routes/+page.svelte` (handleExportScalerToml present: 2 occurrences)
- FOUND: `apps/studio/static/demos/opengris-local-cluster.calm.json` (opengris:scheduler present)
- FOUND: `.planning/phases/15-.../15-03-SUMMARY.md`
- FOUND: commit `dba0124` (Task 1)
- FOUND: commit `f1877af` (Task 2)
