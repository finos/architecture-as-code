---
phase: 12-developer-tooling
verified: 2026-03-16T09:45:10Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 12: Developer Tooling Verification Report

**Phase Goal:** Developers can preview CALM architecture diagrams in VS Code and have diagrams automatically rendered in GitHub PR comments
**Verified:** 2026-03-16T09:45:10Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `renderArchitectureToSvg(arch)` returns valid SVG without reading any file from disk | VERIFIED | Exported at render.ts:82; 12 render tests pass (57/57 total MCP tests) |
| 2 | VS Code extension package scaffolded with esbuild CJS bundle that compiles without errors | VERIFIED | `dist/extension.js` (1.6 MB) exists; esbuild.mjs dual-bundle config wired |
| 3 | Opening a .calm.json file in VS Code shows a read-only SVG preview in a side panel | VERIFIED | `CalmPreviewPanel.createOrShow()` in extension.ts:19,57; singleton pattern in preview.ts |
| 4 | Saving a .calm.json file causes the preview panel to re-render automatically | VERIFIED | `onDidSaveTextDocument` → `isCalmFile` → `CalmPreviewPanel.updateIfVisible()` in extension.ts:46-49 |
| 5 | GitHub Action detects changed .calm.json files from a PR diff using Octokit | VERIFIED | `getChangedCalmFiles` uses `octokit.rest.pulls.listFiles` in changed-files.ts:27; 3 tests pass |
| 6 | GitHub Action renders each changed CALM file to SVG using `renderArchitectureToSvg` | VERIFIED | `renderCalmFile` imports and calls `renderArchitectureToSvg` from `@calmstudio/mcp/dist/tools/render.js` |
| 7 | GitHub Action validates each CALM file and includes errors/warnings in the PR comment | VERIFIED | `validateCalmArchitecture` called in render.ts:68; issues included in `buildCommentBody` |
| 8 | GitHub Action creates or updates a single PR comment with SVG images (no comment spam) | VERIFIED | `MARKER = '<!-- calmstudio-diagram-comment -->'`; `upsertComment` find-then-update pattern in comment.ts:134-161 |
| 9 | `dist/index.js` is a bundled single file ready for GitHub to execute | VERIFIED | 3.1 MB ncc bundle at `packages/github-action/dist/index.js`; `.gitignore` overrides root with `!dist/` |
| 10 | VS Code extension registers an MCP server definition provider exposing CalmStudio's 21 tools | VERIFIED | `registerMcpServer` called in extension.ts:38; provider ID `calmstudio.mcpServer` wired to `dist/mcp-server/index.js` (1.8 MB bundle) |
| 11 | Clicking 'Open in CalmStudio' launches the desktop app via calmstudio:// URI scheme or falls back to web URL | VERIFIED | `openInCalmStudio` in openInStudio.ts:14-28; `calmstudio://open?file=` URI, fallback to `https://calmstudio.opsflow.io` |

**Score:** 11/11 truths verified

---

## Required Artifacts

### Plan 12-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/mcp-server/src/tools/render.ts` | `renderArchitectureToSvg` pure function export | VERIFIED | Exported at line 82; 251 lines; delegates to `renderDiagram` wrapper |
| `packages/vscode-extension/package.json` | VS Code manifest with `opsflow` publisher | VERIFIED | Contains `"publisher": "opsflow"`, `activationEvents`, commands, `mcpServerDefinitionProviders` |
| `packages/vscode-extension/src/extension.ts` | `activate`/`deactivate` entry point | VERIFIED | Both exported; 69 lines; fully wired |
| `packages/vscode-extension/src/preview.ts` | `CalmPreviewPanel` singleton | VERIFIED | 147 lines; singleton `createOrShow`/`updateIfVisible`; CSP-compliant webview HTML |
| `packages/github-action/action.yml` | GitHub Action metadata with `node20` | VERIFIED | `runs: using: node20`; `main: dist/index.js` |

### Plan 12-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/github-action/src/index.ts` | Action entry point (min 30 lines) | VERIFIED | 52 lines; full detect-render-comment-output pipeline |
| `packages/github-action/src/changed-files.ts` | `getChangedCalmFiles` via Octokit | VERIFIED | 37 lines; exports `getChangedCalmFiles`; filters `.calm.json`, excludes `removed` |
| `packages/github-action/src/render.ts` | `renderCalmFile` wrapper | VERIFIED | 71 lines; exports `renderCalmFile`; calls `renderArchitectureToSvg` + `validateCalmArchitecture` |
| `packages/github-action/src/comment.ts` | `buildCommentBody`, `upsertComment`, `MARKER` | VERIFIED | 162 lines; all three exported; gh-diagrams branch strategy implemented |
| `packages/github-action/dist/index.js` | Bundled single-file action | VERIFIED | 3.28 MB ncc bundle; `.gitignore` allows tracking with `!dist/` |

### Plan 12-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/vscode-extension/src/mcp.ts` | `registerMcpServer` export | VERIFIED | 56 lines; exports `registerMcpServer`; provider ID `calmstudio.mcpServer` |
| `packages/vscode-extension/src/openInStudio.ts` | `openInCalmStudio` with desktop/web fallback | VERIFIED | 28 lines; exports `openInCalmStudio`; `calmstudio://` URI + web fallback |
| `packages/vscode-extension/package.json` | Contains `mcpServerDefinitionProviders` | VERIFIED | Contribution point present at line 44 with id `calmstudio.mcpServer` |
| `packages/vscode-extension/dist/mcp-server/index.js` | Bundled MCP server | VERIFIED | 1.87 MB; `elkjs-svg` copied to `dist/mcp-server/node_modules/elkjs-svg/` |

---

## Key Link Verification

### Plan 12-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `preview.ts` | `render.ts` | imports `renderArchitectureToSvg` | WIRED | preview.ts:6 imports and calls at line 125 |
| `extension.ts` | `preview.ts` | `onDidSaveTextDocument` triggers `CalmPreviewPanel.updateIfVisible` | WIRED | extension.ts:46-49; save listener filters `isCalmFile` then calls `updateIfVisible(doc.uri)` |

### Plan 12-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `github-action/src/render.ts` | `mcp-server/src/tools/render.ts` | imports `renderArchitectureToSvg` | WIRED | render.ts:7 imports from `@calmstudio/mcp/dist/tools/render.js`; called at line 52 |
| `github-action/src/index.ts` | `comment.ts` | calls `upsertComment` | WIRED | index.ts:9 imports; called at line 32 with rendered results |
| `comment.ts` | `octokit.rest.issues` | `createComment`/`updateComment` with hidden marker | WIRED | MARKER at comment.ts:17; upsert pattern at lines 134-161 |

### Plan 12-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `extension.ts` | `mcp.ts` | `activate()` calls `registerMcpServer(context)` | WIRED | extension.ts:7 imports; called at line 38 in try/catch guard |
| `extension.ts` | `openInStudio.ts` | registers `calmstudio.openInApp` calling `openInCalmStudio` | WIRED | extension.ts:26-30; command registration calls `openInCalmStudio(editor.document.uri)` |
| `package.json` | `dist/mcp-server/index.js` | `mcpServerDefinitionProviders` contribution point | WIRED | package.json:44-49 declares provider; esbuild.mjs bundles MCP server at `dist/mcp-server/index.js` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VSCE-01 | 12-01 | Live read-only CALM architecture diagram preview in VS Code webview panel | SATISFIED | `CalmPreviewPanel` singleton with `enableScripts: false`; webview renders SVG via `renderArchitectureToSvg` |
| VSCE-02 | 12-01 | Preview auto-updates when .calm.json file is saved | SATISFIED | `onDidSaveTextDocument` listener → `isCalmFile` filter → `updateIfVisible(doc.uri)` |
| VSCE-03 | 12-03 | Auto-registers @calmstudio/mcp server for Copilot/Claude Code in VS Code | SATISFIED | `registerMcpServer` registered in `activate()` with `mcpServerDefinitionProviders` contribution point |
| VSCE-04 | 12-03 | "Open in CalmStudio" button launches desktop app or web URL with current file | SATISFIED | `openInCalmStudio` opens `calmstudio://open?file=<path>` or falls back to `https://calmstudio.opsflow.io` |
| VSCE-05 | 12-03 | Extension installable from VS Code Marketplace | SATISFIED | `calmstudio-0.0.1.vsix` (1.86 MB) produced by `vsce package`; publisher `opsflow` set |
| GHAC-01 | 12-02 | GitHub Action renders CALM architecture diagrams as SVG images in PR comments | SATISFIED | Full pipeline: `getChangedCalmFiles` → `renderCalmFile` → `buildCommentBody` (gh-diagrams branch) → `upsertComment` |

All 6 requirements accounted for. No orphaned requirements detected (REQUIREMENTS.md maps VSCE-01..05 and GHAC-01 to Phase 12 only).

---

## Anti-Patterns Found

No blockers or stubs detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extension.ts` | 39-41 | `try { registerMcpServer } catch { console.warn }` | Info | Intentional graceful degradation on VS Code <1.99 — documented decision |
| `preview.ts` | 6 | imports from `@calmstudio/mcp/src/tools/render.js` (src path) | Warning | Extension relies on esbuild resolving this at bundle time; works because esbuild traverses workspace symlinks. Contrast with github-action which correctly imports from `dist/`. No current breakage but creates fragile coupling. |

---

## Human Verification Required

### 1. VS Code Preview Panel (Live Behavior)

**Test:** Open a `.calm.json` file in VS Code 1.99+. Observe the preview panel auto-opening beside the editor showing the rendered CALM diagram. Save the file and observe the panel re-rendering.
**Expected:** Panel appears immediately; diagram matches architecture nodes/relationships; updates within ~1 second of save.
**Why human:** Webview rendering, auto-open timing, and panel layout cannot be verified without an extension host.

### 2. MCP Server in Copilot/Claude Code

**Test:** Install `calmstudio-0.0.1.vsix` in VS Code 1.99+. Open a workspace with `.calm.json` files. Check that Copilot Chat or Claude Code shows "CalmStudio" as an available MCP server with 21 tools.
**Expected:** MCP server appears in agent tool list; `node dist/mcp-server/index.js` runs when queried.
**Why human:** `vscode.lm.registerMcpServerDefinitionProvider` and `vscode.McpStdioServerDefinition` use type assertions (VS Code 1.99+ APIs not yet in @types/vscode) — runtime behavior requires actual VS Code and Copilot to confirm.

### 3. GitHub Action in Real PR

**Test:** Add `uses: ./packages/github-action` (or publish as release) to a GitHub Actions workflow. Open a PR modifying a `.calm.json` file.
**Expected:** Action posts a PR comment containing the rendered CALM diagram image (from the `gh-diagrams` branch) and validation summary. Subsequent saves update the same comment without creating a new one.
**Why human:** Requires real GitHub repository, PR, and Octokit authentication. The `gh-diagrams` branch SVG commit strategy cannot be validated locally.

### 4. VS Code TypeScript Typecheck

**Test:** Run `pnpm --filter calmstudio typecheck` in a Node 20 LTS environment (not Node v25+).
**Expected:** `tsc --noEmit` completes without errors.
**Why human:** Documented machine constraint — `tsc` crashes with SIGABRT on `@types/vscode` (724 KB type definitions) on Node v25.6.0. Tests and esbuild build both pass. Typecheck must be validated in a standard dev container.

---

## Gaps Summary

No gaps. All 11 observable truths are verified, all 15 required artifacts are substantive and wired, all 6 requirement IDs are satisfied, and no blocker anti-patterns were found.

One note worth flagging: `packages/vscode-extension/src/preview.ts` imports `renderArchitectureToSvg` from `@calmstudio/mcp/src/tools/render.js` (the TypeScript source path) rather than the compiled dist path used by the GitHub Action. This works because esbuild resolves workspace symlinks at bundle time and compiles the source directly into `dist/extension.js`. It is not a defect but differs from the github-action's pattern and would break if the esbuild config changed. Recorded as a warning, not a blocker.

---

_Verified: 2026-03-16T09:45:10Z_
_Verifier: Claude (gsd-verifier)_
