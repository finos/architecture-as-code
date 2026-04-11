---
status: complete
phase: 11-desktop-app
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md]
started: 2026-03-15T12:10:00Z
updated: 2026-03-16T00:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Desktop App Launches
expected: Run `cd apps/studio && pnpm tauri dev`. After compilation, a native macOS window opens showing the CalmStudio canvas. Window title shows "CalmStudio".
result: pass

### 2. Native File Open Dialog
expected: Press Cmd+O (or File > Open if menu exists). A native macOS file picker appears (not a browser dialog). Select a .calm.json file — the diagram loads on the canvas. Window title updates to show the filename.
result: pass

### 3. Native File Save Dialog
expected: After opening a file, make a change to any node. Window title shows a dirty indicator (bullet character). Press Cmd+S — a native macOS save dialog appears (first save) or saves directly (subsequent saves). After saving, the dirty indicator clears from the title.
result: pass

### 4. Native Menu Bar
expected: The macOS menu bar shows File, Edit, View, and Help menus. File menu contains: New, Open, Save, Save As, Recent (submenu), separator, Quit. Edit menu contains: Undo, Redo, Cut, Copy, Paste, Select All. View menu contains zoom and panel items.
result: issue
reported: "quit is missing from file menu. pass otherwise"
severity: minor

### 5. Recent Files List
expected: After opening a file, check File > Recent — it shows the file you just opened. Open a second file — Recent now shows both files, most recent first. Close and reopen the app — the Recent list persists across restarts.
result: pass

### 6. Drag and Drop
expected: Drag a .calm.json file from Finder onto the CalmStudio window. The diagram loads on the canvas, same as if opened via File > Open.
result: pass

### 7. Title Bar with Dirty Indicator
expected: Open a .calm.json file — title shows "CalmStudio — filename.calm.json". Make a change — title shows "CalmStudio — filename.calm.json *" (with dirty indicator). Save — dirty indicator disappears.
result: pass

### 8. Web Mode Still Works
expected: Run `pnpm dev` (not tauri dev) and open http://localhost:5173 in a browser. The CalmStudio app works exactly as before — canvas renders, file open/save uses browser dialogs (not native OS dialogs), no errors in console related to Tauri.
result: pass

### 9. CI Workflow Exists
expected: The file `.github/workflows/desktop-build.yml` exists and contains a 4-platform build matrix (macOS ARM, macOS Intel, Linux, Windows) with tauri-action. Triggered on git tag push (v*) and manual dispatch.
result: pass

### 10. MCP Sidecar Build Scripts
expected: `packages/mcp-server/package.json` contains `build:bundle` (esbuild ESM to CJS) and `build:sidecar` (pkg to standalone binary) scripts.
result: pass

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "File menu contains Quit item"
  status: failed
  reason: "User reported: quit is missing from file menu. pass otherwise"
  severity: minor
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
