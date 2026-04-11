---
phase: 04-import-export-layout
plan: "00"
subsystem: testing
tags: [elkjs, html-to-image, vitest, layout, file-io]

# Dependency graph
requires:
  - phase: 03-properties-bidirectional-sync
    provides: projection.ts calmToFlow/flowToCalm functions tested as model

provides:
  - elkjs and html-to-image@1.11.11 installed in studio package
  - elkLayout.test.ts with 5 verified test cases for layoutCalm()
  - fileSystem.test.ts with 4 verified test cases for openFile/saveFile/downloadDataUrl

affects: [04-import-export-layout plans 01+]

# Tech tracking
tech-stack:
  added: [elkjs@^0.11.1, html-to-image@1.11.11]
  patterns: [TDD wave-0 stub pattern — create test stubs before/alongside implementations]

key-files:
  created:
    - apps/studio/src/tests/elkLayout.test.ts
    - apps/studio/src/tests/fileSystem.test.ts
  modified:
    - apps/studio/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Both elkLayout.ts and fileSystem.ts were already implemented in a prior phase — test stubs immediately GREEN rather than RED as planned"
  - "vi.stubGlobal(fn, undefined) keeps property in window ('in' check still true) — use delete to ensure fallback path is taken in tests"

patterns-established:
  - "Mock pattern: use delete (window as Record).showOpenFilePicker to truly remove File System Access API from jsdom"
  - "fileSystem fallback tests must delete pickers from window, not stub to undefined"

requirements-completed: [IOEX-01, IOEX-06, LAYT-01, LAYT-02, LAYT-03]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 4 Plan 00: Dependencies and Test Stubs Summary

**elkjs@^0.11.1 and html-to-image@1.11.11 installed; 9 test cases across elkLayout and fileSystem test files verified passing against pre-existing implementations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T04:30:40Z
- **Completed:** 2026-03-12T04:34:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Installed elkjs and html-to-image@1.11.11 into @calmstudio/studio dependencies
- Created elkLayout.test.ts with 5 test cases covering all layoutCalm() scenarios (empty arch, pinned IDs exclusion, directional layout, full node set)
- Created fileSystem.test.ts with 4 test cases for openFile fallback, saveFile with handle, saveFile blob fallback, and downloadDataUrl anchor click
- Discovered both implementation files already existed from a prior unrecorded phase — all tests pass immediately (80 total, all green)
- Fixed test mock setup bug where `stubGlobal(fn, undefined)` left pickers detectable via `'in' window`

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create ELK layout test stubs** - `a127d8a` (test)
2. **Task 2: Create file system test stubs** - `f696af0` (test)
3. **Deviation fix: fileSystem mock correctness** - `00cc226` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/studio/src/tests/elkLayout.test.ts` - 5 test cases for layoutCalm() covering positions map, empty pinnedIds, pinned exclusion, RIGHT direction, empty architecture
- `apps/studio/src/tests/fileSystem.test.ts` - 4 test cases for openFile/saveFile/downloadDataUrl with proper jsdom mocks
- `apps/studio/package.json` - elkjs@^0.11.1 and html-to-image@1.11.11 added to dependencies
- `pnpm-lock.yaml` - lockfile updated

## Decisions Made

- `vi.stubGlobal('showOpenFilePicker', undefined)` is insufficient for jsdom fallback testing — must `delete (window as Record).showOpenFilePicker` so `'showOpenFilePicker' in window` evaluates false

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed fileSystem test mocks using delete instead of stubGlobal(fn, undefined)**
- **Found during:** Task 2 (Create file system test stubs) — verification run
- **Issue:** `vi.stubGlobal('showOpenFilePicker', undefined)` sets the property to undefined but it remains enumerable on window, so `'showOpenFilePicker' in window` returns `true`. The implementation then calls `undefined()` throwing TypeError.
- **Fix:** Changed to `delete (window as unknown as Record<string, unknown>).showOpenFilePicker` which fully removes the property, making `'in' window` return false and routing through the fallback branch.
- **Files modified:** `apps/studio/src/tests/fileSystem.test.ts`
- **Verification:** All 4 fileSystem tests pass; all 80 tests pass after fix
- **Committed in:** `00cc226`

---

**Discovered (not a deviation):** Both implementation files (`elkLayout.ts` and `fileSystem.ts`) already existed prior to this plan. Tests were GREEN immediately rather than RED. This means Wave 0 test stubs serve as regression tests going forward rather than TDD scaffolding for future plans.

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Mock fix essential for test correctness. No scope creep.

## Issues Encountered

- Implementation files pre-existed (elkLayout.ts, fileSystem.ts) — both implementations complete and correct, so test stubs serve as regression suite rather than forward-looking TDD scaffolding. No action required beyond documentation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- elkjs and html-to-image installed and available for Phase 4 implementation plans
- 80 tests passing, clean test suite baseline for Phase 4
- elkLayout tests: 5 cases verifying all layoutCalm() branches work correctly
- fileSystem tests: 4 cases verifying fallback paths and handle-based save work correctly
- Ready for Phase 4 plans 01+ (ELK layout integration, file open/save UI, PNG/SVG export)

## Self-Check: PASSED

All created files found on disk. All commits verified in git log.

---
*Phase: 04-import-export-layout*
*Completed: 2026-03-12*
