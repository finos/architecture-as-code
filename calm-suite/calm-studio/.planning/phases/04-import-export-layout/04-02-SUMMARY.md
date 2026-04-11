---
phase: 04-import-export-layout
plan: 02
subsystem: io
tags: [file-system-access-api, html-to-image, elkjs, svelte5, dirty-state, export, download]

requires:
  - phase: 04-import-export-layout plan 00
    provides: elkjs and html-to-image installed; CalmCanvas drag-and-drop file import callback

provides:
  - "fileSystem.ts: openFile, saveFile, saveFileAs, downloadDataUrl with FSA API + fallback"
  - "fileState.svelte.ts: $state-based dirty tracking store (filename, handle, isDirty)"
  - "export.ts: exportAsCalm, exportAsSvg, exportAsPng, exportAsCalmscript functions"

affects:
  - 04-import-export-layout (toolbar and page integration)
  - 05-calmscript-dsl (calmscript export will fully implement DSL)

tech-stack:
  added:
    - "html-to-image@1.11.11 (pinned — newer versions have export regressions)"
    - "elkjs@0.11.1 (installed in plan 00)"
  patterns:
    - "Feature detection via typeof window.fn === 'function' (not 'in' check — vitest stubs need truthiness check)"
    - "Blob download fallback for Firefox/Safari (showSaveFilePicker unavailable)"
    - "Module-level $state runes for file state store (consistent with history/clipboard/theme)"
    - "exportAsCalm uses Blob + createObjectURL then setTimeout revoke (not data URL)"

key-files:
  created:
    - "apps/studio/src/lib/io/fileSystem.ts"
    - "apps/studio/src/lib/io/fileState.svelte.ts"
    - "apps/studio/src/lib/io/export.ts"
  modified: []

key-decisions:
  - "Feature detect showOpenFilePicker/showSaveFilePicker with typeof === 'function' (not 'in window') — vitest vi.stubGlobal sets property to undefined, 'in' check still returns true"
  - "exportAsCalm uses Blob + createObjectURL rather than data URL — allows proper MIME type for JSON"
  - "exportAsCalmscript is a Phase 4 stub — downloads content string as .calmscript; Phase 5 will compile DSL"
  - "All picker calls documented as requiring user-gesture handlers (per RESEARCH Pitfall 5)"
  - "SVG/PNG viewport null-guarded per RESEARCH Pitfall 3 — logs error and returns early if .svelte-flow__viewport not found"

patterns-established:
  - "Pattern: io module under src/lib/io/ — fileSystem.ts (browser APIs), fileState.svelte.ts ($state store), export.ts (format-specific logic)"
  - "Pattern: saveFile returns handle (or null for Blob fallback) — callers update fileState after save"

requirements-completed: [IOEX-02, IOEX-03, IOEX-04, IOEX-05, IOEX-06]

duration: 4min
completed: 2026-03-12
---

# Phase 04 Plan 02: File I/O and Export Modules Summary

**File System Access API + Blob fallback for open/save, $state dirty tracking, and html-to-image SVG/PNG export via three io modules (fileSystem.ts, fileState.svelte.ts, export.ts)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T04:31:31Z
- **Completed:** 2026-03-12T04:35:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- File open/save with File System Access API (Chrome/Edge) and input/Blob download fallbacks for Firefox/Safari
- Dirty state store using Svelte 5 module-level $state runes (filename, fileHandle, isDirty)
- All five export functions: CALM JSON, SVG (transparent), PNG (2x Retina), calmscript stub
- All tests pass (80/80) and build succeeds with no type errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement file system module, file state store, CALM export** - `750e967` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: Task 2 content (SVG, PNG, calmscript export) was written in the same commit as Task 1 per the plan action (step 3 of Task 1 action). Export.ts was created as part of the unified implementation._

## Files Created/Modified

- `apps/studio/src/lib/io/fileSystem.ts` — openFile, saveFile, saveFileAs, downloadDataUrl with FSA API and browser fallbacks (162 lines)
- `apps/studio/src/lib/io/fileState.svelte.ts` — $state-based dirty tracking store with getters/mutators (73 lines)
- `apps/studio/src/lib/io/export.ts` — exportAsCalm, exportAsSvg, exportAsPng, exportAsCalmscript (127 lines)

## Decisions Made

- **typeof check for feature detection:** `typeof window.showOpenFilePicker === 'function'` instead of `'showOpenFilePicker' in window`. Vitest's `vi.stubGlobal('showOpenFilePicker', undefined)` sets the property to undefined but it still exists in the window object, causing `'in'` to return true and the fallback path to be skipped.
- **exportAsCalm uses Blob + createObjectURL:** Not a data URL. Creates proper JSON MIME type for the file. URL is revoked via setTimeout after the click microtask.
- **calmscript export stub:** Phase 4 delivers a working download of current CodePanel content. Phase 5 will replace with compiled DSL output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed feature detection for showOpenFilePicker/showSaveFilePicker**
- **Found during:** Task 1 (GREEN phase — tests failed after initial implementation)
- **Issue:** Used `'showOpenFilePicker' in window` — vitest stubs set value to undefined but key still exists, so 'in' check returned true and fallback was never reached
- **Fix:** Changed to `typeof (window as ...record)['showOpenFilePicker'] === 'function'` for truthiness check
- **Files modified:** apps/studio/src/lib/io/fileSystem.ts
- **Verification:** fileSystem.test.ts — all 4 tests pass after fix
- **Committed in:** 750e967 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in feature detection)
**Impact on plan:** Required for correct fallback behavior in both test environment and real Firefox/Safari. No scope creep.

## Issues Encountered

None beyond the feature detection bug (documented above as deviation).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three io modules ready for toolbar and page wiring (Plan 04-03 or 04-04)
- fileState.svelte.ts dirty state store ready for beforeunload handler integration
- export functions ready for Export dropdown menu integration
- calmscript export is a stub — needs Phase 5 DSL compiler to produce correct output

---
*Phase: 04-import-export-layout*
*Completed: 2026-03-12*
