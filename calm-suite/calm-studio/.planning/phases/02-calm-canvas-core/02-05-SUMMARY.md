---
phase: 02-calm-canvas-core
plan: "05"
subsystem: ui
tags: [svelte5, xyflow, fuse.js, nanoid, undo-redo, clipboard, dark-mode, keyboard-shortcuts, node-search]

# Dependency graph
requires:
  - phase: 02-calm-canvas-core plan 04
    provides: CalmCanvas.svelte with DnD drop handling, edge creation, containment, NodePalette

provides:
  - Undo/redo snapshot store (pushSnapshot/undo/redo/canUndo/canRedo) with unlimited history
  - Copy/paste clipboard store (copy/paste with nanoid IDs + position offset)
  - Dark mode theme store (initTheme/toggleTheme/isDark with localStorage persistence)
  - Fuse.js node search (createNodeSearcher/searchNodes with 0.4 fuzzy threshold)
  - NodeSearch.svelte floating search panel (Cmd+F, result count, Escape to close)
  - Full keyboard shortcut wiring in CalmCanvas (Cmd+Z/Shift+Z, Cmd+C/V, Cmd+F, Cmd+A, Delete)
  - Unit tests for history, clipboard, and search modules

affects:
  - 02-calm-canvas-core (follow-on canvas work)
  - 03-calm-export (operates on canvas state; needs undo/redo context)
  - 05-ai-generation (programmatic node creation must call pushSnapshot)

# Tech tracking
tech-stack:
  added:
    - fuse.js (fuzzy node search)
    - @svelte-put/shortcut (declarative keyboard binding)
    - nanoid (unique ID generation for clipboard paste)
  patterns:
    - Svelte 5 module-level $state runes for stores (history, clipboard, theme)
    - Snapshot-before-mutation undo/redo pattern
    - Fuse.js with threshold 0.4 for forgiving name/type search

key-files:
  created:
    - apps/studio/src/lib/stores/history.svelte.ts
    - apps/studio/src/lib/stores/clipboard.svelte.ts
    - apps/studio/src/lib/stores/theme.svelte.ts
    - apps/studio/src/lib/search/search.ts
    - apps/studio/src/lib/search/NodeSearch.svelte
    - apps/studio/src/tests/history.test.ts
    - apps/studio/src/tests/clipboard.test.ts
    - apps/studio/src/tests/search.test.ts
  modified:
    - apps/studio/src/lib/canvas/CalmCanvas.svelte
    - apps/studio/src/routes/+page.svelte
    - apps/studio/src/routes/+layout.svelte
    - apps/studio/src/app.css

key-decisions:
  - "Svelte 5 module-level $state runes for history/clipboard/theme stores — avoids singleton class pattern, enables reactive exports"
  - "Snapshot-before-mutation undo/redo — pushSnapshot called before every mutation (ondrop, onconnect, ondelete, paste) per CALM RESEARCH Pitfall 6"
  - "paste() returns new Node[] to append — caller (CalmCanvas) decides where to insert, store has no canvas reference"
  - "theme.svelte.ts has no unit test — DOM-dependent; covered by visual verification checkpoint"
  - "Fuse.js threshold 0.4 chosen for forgiving name/type search without too many false positives"

patterns-established:
  - "Store-per-concern: history, clipboard, and theme are separate files with focused exports"
  - "Snapshot-before-mutation: always call pushSnapshot() immediately before any nodes/edges mutation"
  - "ID generation on paste: nanoid() for node.id and node.data.calmId ensures no duplicate IDs after paste"

requirements-completed: [CANV-05, CANV-06, CANV-07, CANV-08, CANV-09]

# Metrics
duration: ~20min
completed: 2026-03-11
---

# Phase 02 Plan 05: UX Stores + Keyboard Shortcuts + Search Summary

**Undo/redo (unlimited), copy/paste (nanoid IDs), dark mode (localStorage), and Fuse.js node search wired into CalmCanvas via @svelte-put/shortcut keyboard bindings**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-11
- **Completed:** 2026-03-11
- **Tasks:** 3 (2 auto + 1 visual verification checkpoint)
- **Files modified:** 12

## Accomplishments

- History store with snapshot-before-mutation undo/redo, unlimited stack depth, TDD-verified (push/undo/redo/canUndo/canRedo)
- Clipboard store with nanoid ID generation on paste and +20/+20 position offset, TDD-verified
- Dark mode theme store with localStorage persistence, system preference detection via matchMedia
- Fuse.js node search with 0.4 threshold, `NodeSearch.svelte` floating panel, toggled via Cmd+F
- Full keyboard shortcut wiring in CalmCanvas: Cmd+Z, Cmd+Shift+Z, Cmd+C, Cmd+V, Cmd+F, Cmd+A, Delete
- All 13 visual verification checks approved by user (node shapes, edges, palette, containment, undo/redo, copy/paste, dark mode, search)

## Task Commits

Each task was committed atomically:

1. **Task 1: History, clipboard, and theme stores with unit tests** - `683579e` (feat)
2. **Task 2: Node search + keyboard shortcuts + canvas + layout** - `b6989ac` (feat)
3. **Task 3: Visual verification checkpoint** - No code commit (user approved all 13 checks)

## Files Created/Modified

- `apps/studio/src/lib/stores/history.svelte.ts` - Undo/redo snapshot store with pushSnapshot/undo/redo/canUndo/canRedo
- `apps/studio/src/lib/stores/clipboard.svelte.ts` - Copy/paste store, nanoid IDs, +20/+20 offset
- `apps/studio/src/lib/stores/theme.svelte.ts` - Dark mode with localStorage + matchMedia listener
- `apps/studio/src/lib/search/search.ts` - Fuse.js createNodeSearcher/searchNodes with threshold 0.4
- `apps/studio/src/lib/search/NodeSearch.svelte` - Floating search panel, result count, Escape to close
- `apps/studio/src/tests/history.test.ts` - Unit tests: push/undo/redo/canUndo/canRedo behaviors
- `apps/studio/src/tests/clipboard.test.ts` - Unit tests: copy/paste/new IDs/offset/hasClipboard
- `apps/studio/src/tests/search.test.ts` - Unit tests: createNodeSearcher/searchNodes by name and type
- `apps/studio/src/lib/canvas/CalmCanvas.svelte` - Full keyboard shortcut wiring, history/clipboard integration
- `apps/studio/src/routes/+page.svelte` - Dark mode toggle button (sun/moon icon)
- `apps/studio/src/routes/+layout.svelte` - initTheme() in onMount for pre-render theme init
- `apps/studio/src/app.css` - Dark mode CSS custom properties for canvas and Svelte Flow vars

## Decisions Made

- Svelte 5 module-level `$state` runes for history/clipboard/theme stores — enables reactive exports without singleton class boilerplate
- Snapshot-before-mutation pattern strictly enforced: `pushSnapshot()` called immediately before every `nodes`/`edges` mutation (ondrop, onconnect, ondelete, paste) to avoid capturing already-changed state
- `paste()` returns new Node[] array rather than mutating canvas — CalmCanvas appends returned nodes, keeping store free of canvas references
- `theme.svelte.ts` has no unit test by design — DOM-dependent API (matchMedia, document.documentElement) covered by visual verification checkpoint instead
- Fuse.js threshold 0.4 allows forgiving typos without excessive false positives for CALM node names

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete CALM canvas is production-ready for Phase 03 (CALM export/validation)
- All table-stakes UX features verified: undo/redo, copy/paste, dark mode, search, keyboard shortcuts
- History store integration point documented: any future code that mutates nodes/edges must call `pushSnapshot()` first
- No blockers for Phase 03

---
*Phase: 02-calm-canvas-core*
*Completed: 2026-03-11*
