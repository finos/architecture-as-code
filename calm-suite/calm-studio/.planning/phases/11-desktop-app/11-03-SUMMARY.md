---
phase: 11-desktop-app
plan: 03
subsystem: ci
tags: [tauri, ci, github-actions, sidecar, mcp, esbuild, pkg, cross-platform]

# Dependency graph
requires:
  - phase: 11-desktop-app
    plan: 01
    provides: Tauri 2 shell with tauri.conf.json externalBin config
provides:
  - GitHub Actions desktop-build.yml with 4-platform matrix (macOS ARM, macOS Intel, Linux, Windows)
  - MCP sidecar build pipeline (esbuild CJS bundle + pkg standalone binary)
  - Tauri-action integration for signed release builds
  - Placeholder sidecar binary for local dev builds
affects: []

# Tech tracking
tech-stack:
  added:
    - "esbuild (devDep in mcp-server)"
    - "@yao-pkg/pkg (CI only, via pnpm dlx)"
  patterns:
    - "Two-stage sidecar build: esbuild ESM→CJS bundle, then pkg CJS→standalone binary"
    - "CI sidecar→desktop pipeline: sidecar job uploads artifact, desktop job downloads by triple"
    - "Placeholder sidecar for dev: shell script at binaries/calmstudio-mcp-{triple}"

key-files:
  created:
    - .github/workflows/desktop-build.yml
    - apps/studio/src-tauri/binaries/calmstudio-mcp-aarch64-apple-darwin
  modified:
    - packages/mcp-server/package.json
    - apps/studio/src-tauri/tauri.conf.json
    - apps/studio/src-tauri/src/lib.rs

key-decisions:
  - "Desktop CI separate from npm release.yml — different triggers (tag push vs main push)"
  - "Sidecar built per-platform in separate CI job, downloaded as artifact by desktop build job"
  - "Placeholder sidecar shell script for local dev — Tauri validates externalBin at compile time"
  - "tauri-plugin-store uses Builder::default().build(), not init() — API difference from other plugins"
  - "tauri-plugin-updater uses Builder::new().build(), not init() — same pattern"
  - "lib.rs requires use tauri::{Emitter, Manager} for emit() and get_webview_window()"

patterns-established:
  - "Dev sidecar placeholder: shell script at binaries/ path satisfies Tauri compile-time validation"

requirements-completed:
  - DESK-01
  - DESK-03

# Metrics
duration: split across sessions
completed: 2026-03-15
---

# Phase 11 Plan 03: Desktop App — CI & Sidecar Summary

**GitHub Actions CI workflow for cross-platform desktop builds, MCP sidecar compilation pipeline, and Rust build fixes for Tauri 2 trait imports and plugin init patterns**

## Performance

- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- GitHub Actions `desktop-build.yml` with 4-platform matrix: macOS ARM (macos-latest), macOS Intel (macos-13), Linux (ubuntu-22.04), Windows (windows-latest)
- Two-job pipeline: sidecar job builds MCP server per-platform with esbuild+pkg, desktop job downloads and bundles with tauri-action
- MCP server build scripts: `build:bundle` (esbuild ESM→CJS), `build:sidecar` (pkg CJS→binary), `build:sidecar-local` (current platform only)
- Fixed Rust compilation: added missing `use tauri::{Emitter, Manager}` imports, corrected plugin init patterns for store and updater
- Created placeholder sidecar binary for local dev builds
- Human checkpoint: `pnpm tauri dev` launches CalmStudio native window successfully

## Task Commits

1. **Task 1: Configure MCP sidecar build and create CI workflow** - `1a4ad47` (feat)
2. **Task 2: Verify desktop app end-to-end** - checkpoint approved
3. **Build fixes** - `6efdbd3` (fix: Rust trait imports + dev sidecar placeholder)

## Files Created/Modified

- `.github/workflows/desktop-build.yml` — 4-platform CI with sidecar→desktop two-job pipeline
- `packages/mcp-server/package.json` — added build:bundle, build:sidecar, build:sidecar-local scripts
- `apps/studio/src-tauri/tauri.conf.json` — updater endpoint updated to opsflo/calmstudio GitHub URL
- `apps/studio/src-tauri/src/lib.rs` — added Emitter/Manager trait imports, fixed store/updater init patterns
- `apps/studio/src-tauri/binaries/calmstudio-mcp-aarch64-apple-darwin` — placeholder shell script for dev

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Rust trait imports in lib.rs**
- **Issue:** `app.emit()` requires `use tauri::Emitter` and `app.get_webview_window()` requires `use tauri::Manager` — Tauri 2.10 moved these to explicit trait imports
- **Fix:** Added `use tauri::{Emitter, Manager}` at top of lib.rs
- **Committed in:** `6efdbd3`

**2. [Rule 3 - Blocking] Fixed tauri-plugin-store init pattern**
- **Issue:** `tauri_plugin_store::init()` does not exist — plugin uses Builder pattern
- **Fix:** Changed to `tauri_plugin_store::Builder::default().build()`
- **Committed in:** `6efdbd3`

**3. [Rule 3 - Blocking] Fixed tauri-plugin-updater init pattern**
- **Issue:** `tauri_plugin_updater::init()` does not exist — plugin uses Builder pattern
- **Fix:** Changed to `tauri_plugin_updater::Builder::new().build()`
- **Committed in:** `6efdbd3`

**4. [Rule 3 - Blocking] Created dev sidecar placeholder**
- **Issue:** Tauri validates `externalBin` paths at compile time — `binaries/calmstudio-mcp-aarch64-apple-darwin` must exist even in dev mode
- **Fix:** Created shell script placeholder at the expected path
- **Committed in:** `6efdbd3`

---

**Total deviations:** 4 auto-fixed (all Rule 3 - Blocking)
**Impact on plan:** All fixes necessary for Tauri build to compile. Plan's lib.rs Rust code was generated by LLM without testing against Tauri 2.10's actual API surface.

## Checkpoint Result

**Status:** APPROVED
**Verified:** `pnpm tauri dev` compiles Tauri 2.10 successfully (468 crates, 51s) and launches CalmStudio native window. Debug build produces CalmStudio.app and DMG.

## Self-Check: PASSED

- `.github/workflows/desktop-build.yml`: FOUND (145 lines, 4-platform matrix)
- `packages/mcp-server/package.json`: FOUND (has build:bundle, build:sidecar scripts)
- `apps/studio/src-tauri/src/lib.rs`: FOUND (Emitter+Manager imports, Builder patterns)
- `apps/studio/src-tauri/binaries/calmstudio-mcp-aarch64-apple-darwin`: FOUND (placeholder)
- Commit `1a4ad47`: FOUND (feat: CI workflow + sidecar build)
- Commit `6efdbd3`: FOUND (fix: Rust trait imports + dev placeholder)

---
*Phase: 11-desktop-app*
*Completed: 2026-03-15*
