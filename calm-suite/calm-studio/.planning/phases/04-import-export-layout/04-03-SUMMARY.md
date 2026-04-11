---
phase: 04-import-export-layout
plan: 03
subsystem: ui
tags: [svelte5, toolbar, file-io, keyboard-shortcuts, dirty-state, beforeunload, export-dropdown, dark-mode]

requires:
  - phase: 04-import-export-layout plan 01
    provides: importCalmFile, runLayout, ELK layout, importError state already wired to canvas
  - phase: 04-import-export-layout plan 02
    provides: openFile, saveFile, saveFileAs, fileState store (getIsDirty/markDirty/markClean/resetFileState), export functions

provides:
  - "Toolbar.svelte: slim 36px top toolbar with Open, Save, New, Export dropdown, filename display, dirty dot"
  - "+page.svelte: all Phase 4 file I/O wired (handleOpen/handleSave/handleSaveAs/handleNew)"
  - "+page.svelte: Cmd+O/S/Shift+S/N keyboard shortcuts via window keydown in onMount"
  - "+page.svelte: beforeunload guard fires when getIsDirty() is true"
  - "+page.svelte: document.title reactive with filename and dirty bullet indicator"
  - "+page.svelte: full-width dismissible error banner for invalid CALM JSON imports"
  - "+page.svelte: markDirty() called on code changes and property mutations"

affects:
  - 05-calmscript-dsl (calmscript export stub will become real in Phase 5)

tech-stack:
  added: []
  patterns:
    - "Toolbar as separate Svelte component with callback props (onopen/onsave/etc.) — decoupled from page logic"
    - "svelte:window onclick for export dropdown click-outside close — no document.addEventListener in onMount needed"
    - "onMount returns cleanup function — registers and removes both keydown and beforeunload listeners"
    - "$effect for document.title — reactive to getFileName() and getIsDirty() state"
    - "app-shell flex-column layout — Toolbar + error banner + flex:1 PaneGroup"
    - "Full-width error banner in document flow (not absolute) — no layout interference with canvas"

key-files:
  created:
    - "apps/studio/src/lib/toolbar/Toolbar.svelte"
  modified:
    - "apps/studio/src/routes/+page.svelte"

key-decisions:
  - "Error banner placed in document flow below Toolbar rather than absolutely positioned — cleaner layout, no z-index conflicts with canvas"
  - "Dirty tracking via explicit markDirty() calls in handleCodeChange and handlePropertyMutation — avoids $effect watching nodes/edges (would fire on every layout run, not just mutations)"
  - "Keyboard shortcuts on window keydown in onMount — broader scope than canvas-pane onkeydown; cleaned up on component destroy"
  - "handleOpen catches cancelled file picker (user dismissed) without showing error — expected user action"
  - "handleSaveAs marks clean even on Blob download fallback — content was exported so dirty state is resolved"
  - "canvas-toolbar replaces old .toolbar class in page — renamed to avoid CSS conflicts with Toolbar component"

patterns-established:
  - "Pattern: toolbar callback props pattern (onopen/onsave/etc.) for all UI action delegation to page"
  - "Pattern: onMount cleanup returning removeEventListener — consistent with Svelte 5 lifecycle"

requirements-completed: [IOEX-02, IOEX-03, IOEX-04, IOEX-05, IOEX-06]

duration: 4min
completed: 2026-03-12
---

# Phase 04 Plan 03: Toolbar, Keyboard Shortcuts, Dirty State, and Error Banner Summary

**Slim top toolbar with Open/Save/Export dropdown, Cmd+O/S/Shift+S/N shortcuts, beforeunload guard, reactive document title, and dismissible error banner — all IO modules from Plans 01-02 fully wired into the page**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T04:41:23Z
- **Completed:** 2026-03-12T04:45:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Toolbar.svelte: slim 36px toolbar with app name (left), filename + dirty dot (center), New/Open/Save/Export dropdown (right)
- Export dropdown with CALM JSON, calmscript, SVG, PNG options; click-outside close via svelte:window
- All file operations wired: handleOpen (openFile + importCalmFile + markClean), handleSave, handleSaveAs, handleNew (confirm if dirty)
- Keyboard shortcuts on window: Cmd+O (open), Cmd+S (save), Cmd+Shift+S (save as), Cmd+N (new)
- beforeunload guard: prevents tab close when getIsDirty() is true
- document.title reactive: "filename • CalmStudio" when dirty, "filename - CalmStudio" when clean, "CalmStudio" with no file
- Full-width dismissible error banner in document flow for invalid CALM JSON import failures
- markDirty() added to handleCodeChange (successful parse path) and handlePropertyMutation
- All 80 tests pass, build succeeds with no type errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Toolbar component with file and export controls** - `e551965` (feat)
2. **Task 2: Wire toolbar, keyboard shortcuts, dirty state, beforeunload, and error banner into page** - `781a6fb` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `apps/studio/src/lib/toolbar/Toolbar.svelte` — Slim top toolbar with file controls and export dropdown (391 lines, created)
- `apps/studio/src/routes/+page.svelte` — Full Phase 4 integration: file ops, keyboard shortcuts, beforeunload, dirty state, error banner (modified, +347/-212 lines)

## Decisions Made

- **Error banner in document flow:** Placed below Toolbar as a flex row item, not absolutely positioned. Cleaner layout, no z-index conflicts, and the PaneGroup grows to fill remaining space naturally.
- **Explicit markDirty() vs $effect on nodes/edges:** Calling markDirty() explicitly in handleCodeChange and handlePropertyMutation rather than using a $effect watching nodes/edges. An $effect would fire on every layout run (which changes node positions without semantic mutations), creating false positives.
- **Window-level keydown in onMount:** Broader scope than the old canvas-pane onkeydown approach. Shortcuts now work regardless of which panel has focus.
- **handleSaveAs marks clean on Blob fallback:** When showSaveFilePicker is unavailable (Firefox/Safari), a Blob download triggers. The content was saved-as-download so the dirty state is considered resolved.
- **Renamed .toolbar to .canvas-toolbar in page:** The old `.toolbar` class conflicted conceptually with the new `<Toolbar>` component. The floating canvas overlay for layout and dark mode toggle is now `.canvas-toolbar`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full import/export/layout feature set complete (Phase 4 objective met)
- calmscript export is a stub (downloads empty .calmscript) — Phase 5 DSL compiler will provide real content
- Dirty state tracking ready; beforeunload guard active
- Toolbar provides all user-facing entry points for file operations and exports

## Self-Check: PASSED

- FOUND: apps/studio/src/lib/toolbar/Toolbar.svelte
- FOUND: apps/studio/src/routes/+page.svelte
- FOUND: .planning/phases/04-import-export-layout/04-03-SUMMARY.md
- FOUND commit: e551965 (Task 1)
- FOUND commit: 781a6fb (Task 2)

---
*Phase: 04-import-export-layout*
*Completed: 2026-03-12*
