---
phase: 11-desktop-app
plan: 02
subsystem: desktop
tags: [tauri, tauri2, svelte5, native-menu, recent-files, drag-drop, mcp-sidecar, auto-update, file-association, deep-link]

# Dependency graph
requires:
  - phase: 11-desktop-app
    plan: 01
    provides: Tauri 2 shell, isTauri() guard, unified fileSystem.ts with Tauri routing
provides:
  - Native menu bar (File/Edit/View/Help) with all specified items and accelerators
  - Recent files list persisted via plugin-store (last 10, deduplicated, cross-restart)
  - Drag-and-drop .calm.json onto app window loads diagram (50ms debounce for Tauri bug)
  - MCP sidecar lifecycle: starts with app, stops on onMount cleanup
  - Auto-updater: silent check on launch, confirm dialog, download + relaunch
  - Single-instance file association (Windows/Linux): open-file event from Rust plugin
  - macOS cold-start file open: deep-link getCurrent() one-shot check
affects:
  - 11-03-packaging-ci

# Tech tracking
tech-stack:
  added:
    - "@tauri-apps/plugin-deep-link@2.4.7 (runtime dep for macOS cold-start file open)"
  patterns:
    - "MenuHandlers interface: all menu callbacks are plain functions, no Svelte reactivity"
    - "openFromPath in MenuHandlers: separate callback for path-based recent file opens (not dialog)"
    - "Desktop onMount block: single isTauri() guard wrapping all 6 feature initializations"
    - "Fire-and-forget pattern: startMcpSidecar() and checkForUpdates() use .catch() in onMount"
    - "Cleanup array pattern: collect unlisten functions in cleanups[], forEach in onMount return"
    - "StoreOptions with defaults: plugin-store load() requires defaults field in StoreOptions"

key-files:
  created:
    - apps/studio/src/lib/desktop/menu.ts
    - apps/studio/src/lib/desktop/recentFiles.ts
    - apps/studio/src/lib/desktop/sidecarMcp.ts
    - apps/studio/src/lib/desktop/dragDrop.ts
    - apps/studio/src/lib/desktop/updater.ts
    - apps/studio/src/lib/desktop/fileOpen.ts
  modified:
    - apps/studio/src/routes/+page.svelte
    - apps/studio/package.json

key-decisions:
  - "MenuHandlers.openFromPath separate from open: dialog-based open and path-based recent file open are different flows"
  - "plugin-store load() requires { autoSave: true, defaults: {...} } — autoSave alone is not valid StoreOptions"
  - "recentFilesSubmenu: module-level reference enables updateRecentFilesMenu to rebuild without re-creating the full menu"
  - "@tauri-apps/plugin-deep-link added as runtime dep: was in Cargo.toml (Rust) but missing from npm package.json"

patterns-established:
  - "MenuHandlers pattern: pure callbacks, no Svelte store refs — Svelte integration is in +page.svelte not menu.ts"
  - "Desktop onMount pattern: single isTauri() guard, cleanups array, fire-and-forget for sidecar + updater"
  - "handleOpenFromPath: unified path-based file load for drag-drop, file association, and recent files"

requirements-completed:
  - DESK-02
  - DESK-03

# Metrics
duration: 9min
completed: 2026-03-15
---

# Phase 11 Plan 02: Desktop App — Native Features Summary

**Native menu bar, recent files (plugin-store), drag-drop, MCP sidecar lifecycle, auto-updater, and OS file-open events wired into +page.svelte with isTauri() guards**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-15T10:47:05Z
- **Completed:** 2026-03-15T10:55:57Z
- **Tasks:** 2
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- 6 desktop feature modules created in `apps/studio/src/lib/desktop/` — all pure TypeScript with no Svelte store imports
- Native OS menu bar with File/Edit/View/Help, accelerators (CmdOrCtrl), and dynamic Recent Files submenu built via `@tauri-apps/api/menu`
- Recent files persisted to OS native app data directory via `plugin-store` (survives reinstall, unlike localStorage)
- MCP sidecar starts silently on app launch via `Command.sidecar('binaries/calmstudio-mcp')` and is killed on onMount cleanup
- Auto-updater checks GitHub releases endpoint on startup with confirm dialog — never blocks startup (fire-and-forget)
- Both Windows/Linux warm-start (`listen('open-file')`) and macOS cold-start (`getCurrent()`) file open paths implemented

## Task Commits

Each task was committed atomically:

1. **Task 1: Create desktop feature modules** - `43cb0e3` (feat)
2. **Task 2: Wire desktop modules into +page.svelte** - `c016c0b` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified

- `apps/studio/src/lib/desktop/menu.ts` — `MenuHandlers` interface, `buildAppMenu()`, `updateRecentFilesMenu()` with module-level submenu ref
- `apps/studio/src/lib/desktop/recentFiles.ts` — `addRecentFile()`, `getRecentFiles()`, `clearRecentFiles()` via plugin-store
- `apps/studio/src/lib/desktop/sidecarMcp.ts` — `startMcpSidecar()` / `stopMcpSidecar()` wrapping `Command.sidecar('binaries/calmstudio-mcp')`
- `apps/studio/src/lib/desktop/dragDrop.ts` — `registerFileDrop()` with 50ms debounce for Tauri 2.8.4 event duplication bug
- `apps/studio/src/lib/desktop/updater.ts` — `checkForUpdates()` with try/catch (never crashes app)
- `apps/studio/src/lib/desktop/fileOpen.ts` — `registerFileOpenHandler()` combining `listen('open-file')` + `getCurrent()` one-shot
- `apps/studio/src/routes/+page.svelte` — desktop onMount block, `handleOpenFromPath`, updated `handleOpen` with recent file tracking
- `apps/studio/package.json` — added `@tauri-apps/plugin-deep-link` (was missing npm package)

## Decisions Made

- `MenuHandlers.openFromPath` added as a separate field from `open` — dialog-based file open (shows picker) vs path-based file open (direct load) are different flows; conflating them would require the menu module to know about file paths, breaking the pure-callback design
- `plugin-store load()` requires `{ autoSave: true, defaults: { recentFiles: [] } }` — the `autoSave` option alone throws a TypeScript error because the `StoreOptions` type requires `defaults`
- `@tauri-apps/plugin-deep-link` npm package was not in `package.json` (was only in Cargo.toml) — added via `pnpm add` per Rule 3 (blocking issue)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @tauri-apps/plugin-deep-link npm package**
- **Found during:** Task 1 (creating fileOpen.ts)
- **Issue:** `getCurrent` from `@tauri-apps/plugin-deep-link` was used in fileOpen.ts but the npm package was not in `apps/studio/package.json` (only the Rust crate was in Cargo.toml)
- **Fix:** `pnpm --filter @calmstudio/studio add @tauri-apps/plugin-deep-link` installed v2.4.7
- **Files modified:** `apps/studio/package.json`, `pnpm-lock.yaml`
- **Verification:** TypeCheck passes with no import errors
- **Committed in:** `43cb0e3` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed plugin-store StoreOptions requiring `defaults` field**
- **Found during:** Task 1 (creating recentFiles.ts)
- **Issue:** `load('settings.json', { autoSave: true })` throws TypeScript error — `StoreOptions` type requires `defaults` field, not just `autoSave`
- **Fix:** Changed to `load(STORE_FILE, { autoSave: true, defaults: { [STORE_KEY]: [] } })` in all three exported functions
- **Files modified:** `apps/studio/src/lib/desktop/recentFiles.ts`
- **Verification:** TypeCheck passes with no errors in recentFiles.ts
- **Committed in:** `43cb0e3` (Task 1 commit)

**3. [Design clarification] Added `openFromPath` to MenuHandlers interface**
- **Found during:** Task 1 (designing menu.ts)
- **Issue:** Plan specified recent file items call the file open handler with the path, but the existing `open` handler shows a file picker dialog — recent files need a path-based open that bypasses the dialog
- **Fix:** Added `openFromPath: (path: string) => void | Promise<void>` to `MenuHandlers` interface; wired to `handleOpenFromPath` in +page.svelte
- **Files modified:** `apps/studio/src/lib/desktop/menu.ts`
- **Verification:** TypeCheck passes; recent file items correctly call `handleOpenFromPath` which uses `readTextFile(path)` directly
- **Committed in:** `43cb0e3` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 design clarification)
**Impact on plan:** All auto-fixes necessary for correctness. The `openFromPath` clarification follows directly from the plan's stated behavior ("each recent file item triggers the file open handler with the path"). No scope creep.

## Issues Encountered

- Pre-existing test failures (4 files) related to `@calmstudio/calm-core/test-fixtures` module removal (from plan 10-01 decision). Not caused by this plan. Not fixed (out of scope).
- Pre-existing typecheck errors (61 total) in test files, CalmCanvas.svelte, and @svelte-put/shortcut types. Not caused by this plan. Not fixed (out of scope).

## User Setup Required

None — no external service configuration required. The deep-link plugin is runtime-only in Tauri mode.

## Next Phase Readiness

- All desktop native features are wired — app is ready for packaging
- MCP sidecar lifecycle is managed but the binary (`binaries/calmstudio-mcp`) is built separately (11-04 CI plan)
- Auto-updater pubkey and endpoint in `tauri.conf.json` still have placeholder values — must be set during 11-04 packaging setup
- Zoom menu items (Zoom In/Zoom Out) are stubbed with TODO comments — canvas `useSvelteFlow()` context is not accessible from +page.svelte; would need to expose `zoomIn/zoomOut` methods on `CalmCanvas` to implement
- Toggle panel menu items are stubbed with TODO comments — paneforge panels have no external visibility state yet

## Self-Check: PASSED

- `apps/studio/src/lib/desktop/menu.ts`: FOUND
- `apps/studio/src/lib/desktop/recentFiles.ts`: FOUND
- `apps/studio/src/lib/desktop/sidecarMcp.ts`: FOUND
- `apps/studio/src/lib/desktop/dragDrop.ts`: FOUND
- `apps/studio/src/lib/desktop/updater.ts`: FOUND
- `apps/studio/src/lib/desktop/fileOpen.ts`: FOUND
- `apps/studio/src/routes/+page.svelte`: MODIFIED (confirmed)
- Commit `43cb0e3`: FOUND (feat: 6 desktop modules)
- Commit `c016c0b`: FOUND (feat: wire modules into +page.svelte)

---
*Phase: 11-desktop-app*
*Completed: 2026-03-15*
