---
phase: 12-developer-tooling
plan: "03"
subsystem: vscode-extension
tags: [vscode, mcp, tdd, packaging, desktop-bridge]
dependency_graph:
  requires:
    - "12-01 (VS Code extension scaffold with CalmPreviewPanel)"
  provides:
    - "registerMcpServer: stdio MCP server definition provider in VS Code extension"
    - "openInCalmStudio: desktop app bridge with web fallback"
    - "calmstudio-0.0.1.vsix: Marketplace-ready VSIX package"
    - "dist/mcp-server/index.js: bundled MCP server for extension distribution"
  affects:
    - packages/vscode-extension/src/extension.ts
    - packages/vscode-extension/src/mcp.ts
    - packages/vscode-extension/src/openInStudio.ts
    - packages/vscode-extension/package.json
    - packages/vscode-extension/esbuild.mjs
tech_stack:
  added:
    - "vscode.lm.registerMcpServerDefinitionProvider (VS Code 1.99+ API via type assertion)"
    - "vscode.McpStdioServerDefinition (VS Code 1.99+ API via type assertion)"
    - "esbuild second entry point for MCP server CJS bundle"
    - "elkjs-svg runtime copy into dist/mcp-server/node_modules"
  patterns:
    - "TDD: RED (failing tests) -> GREEN (implementation) -> commit each phase"
    - "Type assertion pattern for VS Code 1.99+ APIs not yet in @types/vscode"
    - "try/catch guard for graceful degradation on VS Code <1.99"
    - "esbuild dual-bundle: extension.js (CJS, vscode external) + mcp-server/index.js (CJS, elkjs-svg external + copied)"
key_files:
  created:
    - packages/vscode-extension/src/mcp.ts
    - packages/vscode-extension/src/openInStudio.ts
    - packages/vscode-extension/src/test/mcp.test.ts
    - packages/vscode-extension/src/test/openInStudio.test.ts
    - packages/vscode-extension/calmstudio-0.0.1.vsix
  modified:
    - packages/vscode-extension/src/extension.ts (wire registerMcpServer + openInCalmStudio command)
    - packages/vscode-extension/package.json (rename to 'calmstudio', add mcpServerDefinitionProviders, editor/title menu)
    - packages/vscode-extension/esbuild.mjs (add MCP server bundle + elkjs-svg copy)
decisions:
  - "package.json name changed from '@calmstudio/vscode-extension' to 'calmstudio' — vsce rejects scoped package names"
  - "Type assertions used for vscode.lm and McpStdioServerDefinition — @types/vscode 1.99.0 missing these APIs"
  - "MCP registration wrapped in try/catch for graceful degradation on VS Code <1.99"
  - "elkjs-svg marked external in MCP server bundle and copied to dist/mcp-server/node_modules at build time"
metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_created: 5
  files_modified: 3
  completed_date: "2026-03-16"
---

# Phase 12 Plan 03: MCP Server Registration, Open in CalmStudio, and VSIX Packaging Summary

**One-liner:** Added MCP server definition provider (VS Code 1.99+ stdio transport), "Open in CalmStudio" desktop bridge command, and dual-bundle esbuild config producing a 1.86MB VSIX for Marketplace distribution.

## What Was Built

### Task 1: MCP server registration and openInCalmStudio command (TDD)

**TDD RED:** Created failing tests for `registerMcpServer` (5 tests) and `openInCalmStudio` (5 tests) before writing any implementation. Tests verified provider ID, server label, node command, dist path, URI construction, openExternal calls, web fallback, and info message.

**TDD GREEN:** Implemented both modules:

**`packages/vscode-extension/src/mcp.ts`:** `registerMcpServer(context)` registers a `McpStdioServerDefinition` provider with ID `calmstudio.mcpServer`. Points to `dist/mcp-server/index.js` (bundled in Task 2). Uses type assertions for VS Code 1.99+ APIs not yet in `@types/vscode`:

```typescript
const lm = vscode.lm as unknown as {
  registerMcpServerDefinitionProvider(id: string, provider: unknown): vscode.Disposable;
};
```

**`packages/vscode-extension/src/openInStudio.ts`:** `openInCalmStudio(uri)` tries to open `calmstudio://open?file=<encoded-path>` via `vscode.env.openExternal`. If that returns `false` (desktop app not installed), falls back to `https://calmstudio.opsflow.io` and shows an info message.

All 21 tests (11 existing + 5 MCP + 5 openInStudio) pass.

### Task 2: Wire into activate(), bundle MCP server, package VSIX

**extension.ts updates:**
- Imports `registerMcpServer` from `./mcp.js` and `openInCalmStudio` from `./openInStudio.js`
- `calmstudio.openInApp` command calls `openInCalmStudio(editor.document.uri)`
- `registerMcpServer(context)` called in `activate()` with try/catch guard

**package.json updates:**
- Name changed from `@calmstudio/vscode-extension` to `calmstudio` (vsce requires unscoped names)
- Added `mcpServerDefinitionProviders` contribution point with `id: "calmstudio.mcpServer"`
- Added `calmstudio.openInApp` to `editor/title` menu

**esbuild.mjs updates:**
Two-bundle build:
1. `src/extension.ts` → `dist/extension.js` (CJS, `vscode` external)
2. `packages/mcp-server/src/index.ts` → `dist/mcp-server/index.js` (CJS, `elkjs-svg` external)
3. Post-build: copies `elkjs-svg` from pnpm workspace store into `dist/mcp-server/node_modules/elkjs-svg/`

**VSIX result:** `calmstudio-0.0.1.vsix` (11 files, 1.86 MB) — ready for Marketplace upload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed package from '@calmstudio/vscode-extension' to 'calmstudio'**
- **Found during:** Task 2, first vsce package attempt
- **Issue:** vsce rejects scoped package names: `Invalid extension "name": "@calmstudio/vscode-extension"`
- **Fix:** Changed `name` field in package.json to `calmstudio`
- **Files modified:** `packages/vscode-extension/package.json`
- **Commit:** 6cb99b5

**2. [Rule 3 - Blocking] Fixed elkjs-svg resolution for MCP server bundle**
- **Found during:** Task 2, esbuild MCP server bundle — elkjs-svg not in vscode-extension's direct deps
- **Issue:** `createRequire('elkjs-svg')` failed because elkjs-svg is in mcp-server's node_modules, not vscode-extension's
- **Fix:** Updated esbuild.mjs to search multiple pnpm workspace paths (`../mcp-server/node_modules/elkjs-svg`, pnpm store path) and copy the found package to `dist/mcp-server/node_modules/`
- **Files modified:** `packages/vscode-extension/esbuild.mjs`
- **Commit:** 6cb99b5

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm test` (21 tests) | 21/21 pass |
| `node esbuild.mjs` (build) | Pass — both bundles produced |
| `test -f dist/mcp-server/index.js` | FOUND |
| `node dist/mcp-server/index.js --version` | `0.0.0` (loads correctly) |
| `vsce package --no-dependencies` | `calmstudio-0.0.1.vsix` produced (1.86 MB) |
| `grep "mcpServerDefinitionProviders" package.json` | Found |
| `grep "calmstudio.openInApp" extension.ts` | Found |
| `grep "registerMcpServer" extension.ts` | Found (import + call) |

## Self-Check: PASSED
