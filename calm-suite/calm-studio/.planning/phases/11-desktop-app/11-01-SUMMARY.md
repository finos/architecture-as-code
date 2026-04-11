---
phase: 11-desktop-app
plan: 01
subsystem: desktop
tags: [tauri, tauri2, rust, svelte5, native-file-io, desktop-app, tdd, vitest]

# Dependency graph
requires:
  - phase: 03-properties-bidirectional-sync
    provides: fileState.svelte.ts dirty tracking and file handle store
  - phase: 10-docs-package-publish
    provides: stable studio web app as Tauri webview content
provides:
  - Tauri 2 shell scaffolded in apps/studio/src-tauri/
  - Desktop mode detection via isTauri() guard
  - Tauri-native file open/save dialogs replacing browser FSA in desktop mode
  - Unified fileSystem.ts routing to Tauri or browser implementation
  - Native OS window title with filename and dirty indicator
  - 5 unit tests for Tauri file I/O using mockIPC pattern
affects:
  - 11-02-mcp-sidecar
  - 11-03-native-menu
  - 11-04-packaging-ci

# Tech tracking
tech-stack:
  added:
    - "@tauri-apps/cli@2.10.1 (devDependency)"
    - "@tauri-apps/api@2.10.1"
    - "@tauri-apps/plugin-dialog@2.6.0"
    - "@tauri-apps/plugin-fs@2.4.5"
    - "@tauri-apps/plugin-shell@2.3.5"
    - "@tauri-apps/plugin-updater@2.10.0"
    - "@tauri-apps/plugin-process@2.3.1"
    - "@tauri-apps/plugin-store@2.4.2"
    - "Rust: tauri 2, tauri-plugin-dialog 2, tauri-plugin-fs 2, tauri-plugin-shell 2"
    - "Rust: tauri-plugin-updater 2, tauri-plugin-process 2, tauri-plugin-store 2"
    - "Rust: tauri-plugin-single-instance 2, tauri-plugin-deep-link 2"
  patterns:
    - "isTauri() guard: detect Tauri webview via window.__TAURI_INTERNALS__"
    - "Tauri path strings as file handles: string replaces FileSystemFileHandle in desktop mode"
    - "mockIPC with ArrayBuffer bytes for Tauri plugin-fs unit testing"
    - "TDD Red/Green: test scaffold committed before implementation"

key-files:
  created:
    - apps/studio/src-tauri/tauri.conf.json
    - apps/studio/src-tauri/Cargo.toml
    - apps/studio/src-tauri/build.rs
    - apps/studio/src-tauri/src/lib.rs
    - apps/studio/src-tauri/src/main.rs
    - apps/studio/src-tauri/capabilities/default.json
    - apps/studio/src-tauri/icons/ (icon.icns, icon.ico, 32x32.png, 128x128.png, 128x128@2x.png)
    - apps/studio/src/lib/desktop/isTauri.ts
    - apps/studio/src/lib/desktop/titleBar.ts
    - apps/studio/src/lib/io/fileSystemTauri.ts
    - apps/studio/src/routes/+layout.ts
    - apps/studio/src/tests/io/fileSystemTauri.test.ts
  modified:
    - apps/studio/src/lib/io/fileSystem.ts
    - apps/studio/src/lib/io/fileState.svelte.ts
    - apps/studio/src/routes/+page.svelte
    - apps/studio/package.json

key-decisions:
  - "Tauri shell co-located in apps/studio/src-tauri/ (not separate apps/desktop/) — tightly coupled to studio static build"
  - "fileHandle type widened to FileSystemFileHandle | string | null for backward compat"
  - "readTextFile mockIPC returns Array.from(Uint8Array) — Tauri returns binary bytes, TextDecoder decodes"
  - "SSR disabled at layout level (+layout.ts) in addition to page level (+page.ts)"
  - "Bundle ext includes both calm.json and json for macOS UTI compound extension compat"

patterns-established:
  - "isTauri() guard pattern: wrap all Tauri-specific calls with if (isTauri()) to preserve web mode"
  - "Tauri path-as-handle: string paths replace FSA FileSystemFileHandle in desktop; Union type in fileState"
  - "mockIPC byte encoding: plugin:fs responses must be Array<number> (bytes), not raw strings"

requirements-completed:
  - DESK-01
  - DESK-02
  - DESK-03

# Metrics
duration: 9min
completed: 2026-03-15
---

# Phase 11 Plan 01: Desktop App — Tauri Shell Scaffold Summary

**Tauri 2 shell scaffolded in apps/studio/src-tauri/ with native file dialogs replacing browser FSA, unified fileSystem.ts routing via isTauri() guard, and 5 mockIPC unit tests confirming Tauri IPC correctness**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-15T10:34:35Z
- **Completed:** 2026-03-15T10:43:43Z
- **Tasks:** 3
- **Files modified:** 15 (12 created, 3 modified)

## Accomplishments
- Tauri 2 shell created with all 8 plugins registered in lib.rs (single-instance first per anti-pattern docs)
- File I/O unified: Tauri path-based open/save in desktop mode, FSA/fallback preserved in browser
- Native OS window title updates reactively with filename and dirty indicator via $effect
- 5 unit tests using mockIPC pattern pass (TDD GREEN) — closes DESK-02 Nyquist gap

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Tauri 2 shell and install dependencies** - `d3fa017` (feat)
2. **Task 2: Create fileSystemTauri test scaffold (TDD RED)** - `023c723` (test)
3. **Task 3: Implement Tauri file I/O and unify routing (TDD GREEN)** - `a08e694` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified
- `apps/studio/src-tauri/tauri.conf.json` — Tauri 2 app config (productName, bundle targets, file associations, updater)
- `apps/studio/src-tauri/Cargo.toml` — Rust dependencies: tauri 2 + 8 plugins
- `apps/studio/src-tauri/src/lib.rs` — Plugin registration (single-instance first)
- `apps/studio/src-tauri/src/main.rs` — Entry point
- `apps/studio/src-tauri/capabilities/default.json` — Permission grants for fs, dialog, shell, updater, store
- `apps/studio/src/lib/desktop/isTauri.ts` — Desktop mode detection via `__TAURI_INTERNALS__`
- `apps/studio/src/lib/desktop/titleBar.ts` — Native window title updates
- `apps/studio/src/lib/io/fileSystemTauri.ts` — Tauri open/save/saveAs using plugin-dialog + plugin-fs
- `apps/studio/src/lib/io/fileSystem.ts` — Unified routing with isTauri() guard
- `apps/studio/src/lib/io/fileState.svelte.ts` — handle type widened to FileSystemFileHandle | string | null
- `apps/studio/src/routes/+page.svelte` — title bar $effect + handleSaveAs string path handling
- `apps/studio/src/routes/+layout.ts` — SSR disabled project-wide
- `apps/studio/src/tests/io/fileSystemTauri.test.ts` — 5 mockIPC tests (all passing)

## Decisions Made
- Tauri shell co-located in `apps/studio/src-tauri/` (not separate `apps/desktop/`) — tightly coupled to studio static build output
- `fileHandle` type widened to `FileSystemFileHandle | string | null` for backward compat; existing callers continue to work
- `readTextFile` mockIPC mock must return `Array.from(Uint8Array)` bytes, not raw strings — Tauri returns binary, JS TextDecoder decodes
- SSR disabled at layout level (`+layout.ts`) in addition to existing page level (`+page.ts`) — covers all routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mockIPC test returning wrong type for readTextFile**
- **Found during:** Task 2/3 (TDD GREEN phase)
- **Issue:** Plan's test scaffold used `return '{"nodes":...}'` (string) for `plugin:fs|read_text_file` mock, but the real Tauri plugin returns an ArrayBuffer/byte array decoded by TextDecoder — causing the test to receive null bytes
- **Fix:** Changed mock to `return Array.from(new TextEncoder().encode(fileContent))` to match the real binary protocol
- **Files modified:** `apps/studio/src/tests/io/fileSystemTauri.test.ts`
- **Verification:** All 5 tests pass (GREEN)
- **Committed in:** `a08e694` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required fix for test correctness. The test scaffold in the plan's mockIPC pattern used string return value which doesn't match Tauri's binary-over-IPC protocol. Fixed to match actual behavior.

## Issues Encountered
- None beyond the mockIPC byte encoding deviation documented above.

## User Setup Required
None — no external service configuration required. Tauri dev can be started with `pnpm tauri dev` after Rust toolchain is installed (Rust 1.70+, rustc already at 1.93.0 on this machine).

## Next Phase Readiness
- Tauri 2 shell complete — `pnpm tauri dev` will launch CalmStudio in native window
- File open/save via native OS dialogs ready
- Title bar sync ready
- 11-02 (MCP sidecar) can now bundle the MCP server as a Tauri sidecar binary
- 11-03 (native menu) can now build the full native menu bar using @tauri-apps/api/menu

## Self-Check: PASSED

- `apps/studio/src-tauri/tauri.conf.json`: FOUND
- `apps/studio/src-tauri/src/lib.rs`: FOUND
- `apps/studio/src/lib/io/fileSystemTauri.ts`: FOUND
- `apps/studio/src/lib/desktop/isTauri.ts`: FOUND
- `apps/studio/src/routes/+layout.ts`: FOUND
- `apps/studio/src/tests/io/fileSystemTauri.test.ts`: FOUND
- Commit `d3fa017`: FOUND (feat: scaffold Tauri 2 shell)
- Commit `023c723`: FOUND (test: TDD RED test scaffold)
- Commit `a08e694`: FOUND (feat: Tauri file I/O implementation)

---
*Phase: 11-desktop-app*
*Completed: 2026-03-15*
