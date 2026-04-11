# Phase 12: Developer Tooling - Research

**Researched:** 2026-03-16
**Domain:** VS Code Extension API, GitHub Actions JavaScript Actions
**Confidence:** HIGH (VS Code APIs, bundling, GitHub Actions); MEDIUM (MCP registration exact manifest key, GitHub SVG rendering workaround)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**VS Code Preview Rendering:**
- Static SVG via existing ELK renderer (render.ts from MCP server) — reuse the same pipeline, no separate canvas build
- Read-only preview in a webview panel — not interactive (pan/zoom is out of scope)
- Preview auto-opens when a .calm.json file is the active editor — side-by-side editing
- Preview auto-updates when the .calm.json file is saved (VSCE-02)
- Build as a fresh extension with ID `opsflow.calmstudio` — do NOT fork or extend the existing `calm` Marketplace extension

**Open in CalmStudio:**
- "Open in CalmStudio" button launches the desktop app with the file path (uses Phase 11 file association)
- Falls back to web URL if desktop app is not installed

**MCP Auto-Registration:**
- Use `contributes.mcpServerDefinitionProviders` in VS Code extension package.json (native contribution point)
- Bundle the MCP server's Node.js entry point with the extension — uses VS Code's built-in Node.js runtime (`node dist/index.js`)
- All 21 MCP tools available — no curated subset, full capability for AI assistants (Copilot, Claude Code)

**GitHub Action:**
- Auto-detect changed .calm.json files in PR diff — zero config for users
- Render SVG AND run CALM validation — show errors/warnings alongside the diagram in the PR comment
- PR comment with inline SVG — bot updates the same comment on subsequent pushes (no comment spam)
- JavaScript/TypeScript Action — imports calm-core and render.ts directly, fast startup, no Docker
- Source lives in this monorepo at `packages/github-action/`

**Distribution & Identity:**
- VS Code extension publisher: `opsflow` (extension ID: `opsflow.calmstudio`)
- Extension icon: same geometric hexagon icon as the CalmStudio desktop app (consistent brand)
- GitHub Action name: `calmstudio/render-diagram` (usage: `uses: calmstudio/render-diagram@v1`)
- GitHub Action source: in this monorepo at `packages/github-action/`

### Claude's Discretion
- Webview HTML/CSS styling for the SVG preview panel
- VS Code extension activation events configuration
- GitHub Action input/output parameter naming
- esbuild/webpack bundling strategy for the extension
- How to handle large .calm.json files in the preview (if any performance concerns)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VSCE-01 | Live read-only CALM architecture diagram preview in VS Code webview panel | VS Code Webview API + render.ts reuse; `createWebviewPanel`, `postMessage` |
| VSCE-02 | Preview auto-updates when .calm.json file is saved | `workspace.onDidSaveTextDocument` event — fires after save, update webview HTML |
| VSCE-03 | Auto-registers @calmstudio/mcp server for Copilot/Claude Code in VS Code | `contributes.mcpServerDefinitionProviders` + `vscode.lm.registerMcpServerDefinitionProvider` API |
| VSCE-04 | "Open in CalmStudio" button launches desktop app or web URL with current file | `vscode.env.openExternal(Uri)` using Phase 11 custom URI scheme; web URL fallback |
| VSCE-05 | Extension installable from VS Code Marketplace | `@vscode/vsce` publish pipeline; PAT + publisher `opsflow` account |
| GHAC-01 | GitHub Action renders CALM architecture diagrams as SVG images in PR comments | TypeScript action with `@actions/core` + `@actions/github` Octokit; SVG-as-uploaded-file workaround for GitHub markdown limitations |
</phase_requirements>

---

## Summary

Phase 12 delivers two independent developer tooling artifacts: a VS Code extension (`opsflow.calmstudio`) and a JavaScript GitHub Action (`packages/github-action/`). The VS Code extension is structured as a new `packages/vscode-extension/` monorepo package using the standard VS Code Extension API — a TypeScript project bundled with esbuild into CommonJS (VS Code cannot run ESM extensions). The existing `render.ts` pure function `renderDiagram()` is the core reusable asset: it takes a `CalmArchitecture` object, runs ELK layout, and returns an SVG string — this exact function powers both the webview preview and the GitHub Action.

The MCP auto-registration uses the `contributes.mcpServerDefinitionProviders` contribution point paired with `vscode.lm.registerMcpServerDefinitionProvider()` at runtime. The bundled MCP server dist is launched as a stdio child process by VS Code — no manual Node.js installation needed since VS Code ships its own Node.js runtime. The GitHub Action is a standard JavaScript action (`runs: using: node20`) bundled with `@vercel/ncc` or esbuild into a single `dist/index.js` committed to the repo — this is mandatory since GitHub downloads and executes the action directly without installing dependencies.

A critical platform constraint discovered in research: **GitHub Markdown completely strips inline `<svg>` elements**. Direct SVG embedding in PR comments does not work. The workaround is to commit the SVG as a file to the repository (or upload as a workflow artifact), then reference it via `<img src="...">` pointing to the raw URL. For a self-contained action, the recommended approach is to use `@actions/github` to upload the SVG as a commit to a dedicated branch and post an `<img>` reference, or to post the SVG as a file upload attachment to the comment (GitHub supports SVG file attachments since 2022).

**Primary recommendation:** Build `packages/vscode-extension/` with esbuild (CJS output, `external:['vscode']`), reusing render.ts and validation.ts directly. For the GitHub Action SVG display in PR comments, commit the rendered SVG as a file and reference via `<img>` — do not attempt inline `<svg>` embedding.

---

## Standard Stack

### Core — VS Code Extension

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| VS Code Extension API | bundled | Extension host, webview, commands | Official API — no alternative |
| `@vscode/vsce` | latest | Package and publish VSIX to Marketplace | Official VS Code publishing tool |
| `@vscode/test-electron` | latest | Integration testing against real VS Code | Official Microsoft test runner for extensions |
| esbuild | ^0.25.0 | Bundle extension to single CJS file | Already in monorepo (mcp-server uses it); recommended by VS Code docs |
| TypeScript | ^5.7.0 | Type-safe extension code | Already established project standard |

### Core — GitHub Action

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@actions/core` | ^1.10.0 | Inputs, outputs, `setFailed`, logging | Official GitHub Actions toolkit |
| `@actions/github` | ^6.0.0 | Authenticated Octokit client, PR context | Official GitHub Actions toolkit |
| `@vercel/ncc` | ^0.38.0 | Bundle action + deps to single `dist/index.js` | GitHub's own typescript-action template uses it |
| TypeScript | ^5.7.0 | Type-safe action code | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@calmstudio/calm-core` | workspace:* | CALM types + validation | GitHub Action validation step |
| `elkjs` | ^0.11.1 | ELK layout engine | Already used in render.ts — bundled into extension |
| `elkjs-svg` | latest | SVG renderer from ELK | Already used in render.ts — bundle as external or inline |
| Mocha | ^10.x | Integration tests that need VS Code host | Required for `@vscode/test-electron` integration tests |
| vitest | ^3.x | Unit tests (pure functions, no VS Code API) | Already used in monorepo for pure logic testing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild (CJS) | webpack | esbuild is 10-100x faster and already in repo; webpack is heavier |
| `@vercel/ncc` | esbuild for action | ncc handles complex require() chains in CJS action code better for GitHub Actions context |
| `contributes.mcpServerDefinitionProviders` | mcp.servers settings update | The contribution point is native and zero-config; settings update requires write access and is not idiomatic |

**Installation — VS Code Extension:**
```bash
pnpm add -D @vscode/vsce @vscode/test-electron esbuild typescript
# (elkjs, elkjs-svg, @calmstudio/calm-core already in workspace)
```

**Installation — GitHub Action:**
```bash
pnpm add @actions/core @actions/github
pnpm add -D @vercel/ncc typescript
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/
├── vscode-extension/       # New package — VS Code extension
│   ├── package.json        # Extension manifest (contributes, activationEvents, etc.)
│   ├── tsconfig.json       # Target ES2022, module CommonJS, outDir dist/
│   ├── esbuild.mjs         # Build script — CJS bundle, external:['vscode']
│   ├── src/
│   │   ├── extension.ts    # activate() / deactivate() entry point
│   │   ├── preview.ts      # CalmPreviewPanel — webview panel logic
│   │   ├── mcp.ts          # MCP server registration (registerMcpServerDefinitionProvider)
│   │   └── openInStudio.ts # "Open in CalmStudio" command handler
│   └── dist/               # Built output (committed to git for VSIX packaging)
│       ├── extension.js    # Bundled extension (CJS)
│       └── mcp-server/     # Bundled MCP server entry point
│           └── index.js
│
└── github-action/          # New package — GitHub Action
    ├── action.yml          # Action metadata (inputs, outputs, runs: node20)
    ├── package.json        # No publisher/engines — plain Node.js package
    ├── tsconfig.json       # Target ES2022, module CommonJS
    ├── src/
    │   └── index.ts        # Entry point — detect files, render, comment
    └── dist/
        └── index.js        # Bundled single-file (committed to git — required)
```

### Pattern 1: VS Code Webview Panel with Live Update

**What:** Create a webview panel when a .calm.json file becomes active, register a `onDidSaveTextDocument` listener to re-render on save.
**When to use:** For any file-type-triggered preview panel in a VS Code extension.

```typescript
// Source: https://code.visualstudio.com/api/extension-guides/webview
// src/preview.ts

export class CalmPreviewPanel {
  private static currentPanel: CalmPreviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(context: vscode.ExtensionContext, uri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (CalmPreviewPanel.currentPanel) {
      CalmPreviewPanel.currentPanel._panel.reveal(column);
      CalmPreviewPanel.currentPanel._updateForUri(uri);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'calmPreview',
      'CALM Preview',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: false,  // No scripts — static SVG only
        localResourceRoots: [] // No local file access needed for SVG rendering
      }
    );
    CalmPreviewPanel.currentPanel = new CalmPreviewPanel(panel, context, uri);
  }

  private async _updateForUri(uri: vscode.Uri) {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf-8');
    try {
      const arch = JSON.parse(text);
      const svg = await renderDiagramFromArch(arch); // call render.ts pure logic
      this._panel.webview.html = getWebviewContent(svg);
    } catch {
      this._panel.webview.html = getWebviewContent('<svg><!-- parse error --></svg>');
    }
  }
}
```

### Pattern 2: File Save Listener

**What:** Listen for document saves, filter for .calm.json, trigger preview update.

```typescript
// Source: https://code.visualstudio.com/api/references/vscode-api#workspace
// src/extension.ts  activate()

context.subscriptions.push(
  vscode.workspace.onDidSaveTextDocument((doc) => {
    if (doc.fileName.endsWith('.calm.json') || doc.fileName.endsWith('.json')) {
      // Additional guard: check if it parses as a CalmArchitecture
      CalmPreviewPanel.updateIfVisible(doc.uri);
    }
  }),
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && isCalmFile(editor.document.uri)) {
      CalmPreviewPanel.createOrShow(context, editor.document.uri);
    }
  })
);
```

### Pattern 3: MCP Server Registration

**What:** Register the bundled MCP server as a stdio provider — VS Code launches it as a child process.

```typescript
// Source: https://code.visualstudio.com/api/extension-guides/ai/mcp
// package.json — contributes section
{
  "contributes": {
    "mcpServerDefinitionProviders": [
      {
        "id": "calmstudio.mcpServer",
        "label": "CalmStudio MCP"
      }
    ]
  }
}

// src/mcp.ts — runtime registration
export function registerMcpServer(context: vscode.ExtensionContext): void {
  const serverPath = vscode.Uri.joinPath(
    context.extensionUri, 'dist', 'mcp-server', 'index.js'
  ).fsPath;

  const emitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('calmstudio.mcpServer', {
      onDidChangeMcpServerDefinitions: emitter.event,
      provideMcpServerDefinitions: async () => [
        new vscode.McpStdioServerDefinition({
          label: 'CalmStudio',
          command: 'node',
          args: [serverPath],
          version: '1.0.0'
        })
      ],
      resolveMcpServerDefinition: async (server) => server
    })
  );
}
```

### Pattern 4: Open in CalmStudio Command

**What:** Use `vscode.env.openExternal` with the OS-level file association URI scheme registered in Phase 11 (Tauri custom protocol). Fall back to web URL.

```typescript
// Source: https://code.visualstudio.com/api/references/vscode-api
// src/openInStudio.ts

export async function openInCalmStudio(uri: vscode.Uri): Promise<void> {
  // Phase 11 registered the 'calmstudio' URL scheme on desktop via Tauri
  const desktopUri = vscode.Uri.parse(`calmstudio://open?file=${encodeURIComponent(uri.fsPath)}`);
  const opened = await vscode.env.openExternal(desktopUri);
  if (!opened) {
    // Fallback: open web app with encoded file content
    const webUri = vscode.Uri.parse('https://calmstudio.opsflow.io');
    await vscode.env.openExternal(webUri);
    vscode.window.showInformationMessage(
      'CalmStudio desktop app not found. Opening web version instead.'
    );
  }
}
```

### Pattern 5: esbuild Bundle Script for VS Code Extension

**What:** Bundle the extension to a single CJS file. VS Code extensions MUST use CommonJS — ESM is not supported in the extension host (as of VS Code 1.90+).

```javascript
// Source: https://code.visualstudio.com/api/working-with-extensions/bundling-extension
// esbuild.mjs
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');

await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',           // REQUIRED — VS Code extension host requires CJS
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: ['vscode'],    // REQUIRED — vscode module is provided by VS Code at runtime
  sourcemap: !production,
  minify: production,
});

// Separate bundle for bundled MCP server (also CJS for consistency)
await esbuild.build({
  entryPoints: ['../mcp-server/src/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/mcp-server/index.js',
  external: ['elkjs-svg'],  // elkjs-svg is CJS native — keep external or handle specially
  sourcemap: false,
  minify: true,
});
```

**package.json scripts:**
```json
{
  "scripts": {
    "vscode:prepublish": "node esbuild.mjs --production",
    "build": "node esbuild.mjs",
    "build:watch": "node esbuild.mjs --watch",
    "package": "vsce package --no-dependencies",
    "publish": "vsce publish --no-dependencies",
    "typecheck": "tsc --noEmit",
    "test": "vscode-test"
  }
}
```

### Pattern 6: GitHub Action Structure

**What:** JavaScript Action using node20 runtime, bundled to `dist/index.js` with `@vercel/ncc`.

```yaml
# action.yml
name: 'CalmStudio Diagram Renderer'
description: 'Renders CALM architecture diagrams as SVG images in PR comments'
inputs:
  github-token:
    description: 'GitHub token for posting PR comments'
    required: false
    default: ${{ github.token }}
  calm-files:
    description: 'Glob pattern for CALM files to render (default: auto-detect from PR diff)'
    required: false
    default: '**/*.calm.json,**/*.json'
outputs:
  comment-url:
    description: 'URL of the posted PR comment'
runs:
  using: 'node20'
  main: 'dist/index.js'
```

```typescript
// src/index.ts — GitHub Action entry
import * as core from '@actions/core';
import * as github from '@actions/github';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const context = github.context;

    // 1. Get changed .calm.json files from PR diff
    const changedFiles = await getChangedCalmFiles(octokit, context);

    // 2. Render each file to SVG using renderDiagram pure function
    const renders = await Promise.all(changedFiles.map(renderFile));

    // 3. Build markdown body with SVG references
    const body = buildCommentBody(renders);

    // 4. Create or update the existing bot comment (hidden marker pattern)
    await upsertComment(octokit, context, body);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
```

**Bundle command:**
```bash
npx @vercel/ncc build src/index.ts --out dist --no-source-map
# Outputs dist/index.js — this file MUST be committed to git
```

### Pattern 7: PR Comment Upsert (Hidden Marker)

**What:** Find existing comment by a unique HTML comment marker, update it instead of posting a new one.

```typescript
// Source: community pattern (marocchino/sticky-pull-request-comment approach)
const MARKER = '<!-- calmstudio-diagram-comment -->';

async function upsertComment(octokit, context, body: string) {
  const { owner, repo } = context.repo;
  const prNumber = context.payload.pull_request?.number;
  if (!prNumber) return;

  const fullBody = `${MARKER}\n${body}`;

  // Find existing comment
  const comments = await octokit.rest.issues.listComments({
    owner, repo, issue_number: prNumber
  });
  const existing = comments.data.find(c => c.body?.includes(MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner, repo, comment_id: existing.id, body: fullBody
    });
  } else {
    await octokit.rest.issues.createComment({
      owner, repo, issue_number: prNumber, body: fullBody
    });
  }
}
```

### Anti-Patterns to Avoid

- **Inline `<svg>` in GitHub Markdown:** GitHub strips `<svg>` elements entirely for security. Use `<img src="...">` with an external URL reference instead.
- **ESM format for VS Code extension:** VS Code extension host requires CommonJS. Setting `"type": "module"` in extension package.json will break the extension.
- **Skipping `dist/` commit in GitHub Action:** GitHub downloads and runs the action directly — if `dist/index.js` is not committed, the action fails.
- **Using `"*"` activation event:** Causes the extension to load on every VS Code startup, degrading performance for all users. Use `onLanguage` or `workspaceContains` instead.
- **Registering `onDidSaveTextDocument` for all documents:** Filter for `.calm.json` / `.json` files before triggering the preview update.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webview auto-update | Custom file watcher polling | `workspace.onDidSaveTextDocument` | VS Code fires this event; polling is unreliable and battery-expensive |
| SVG generation | Custom layout algorithm | `renderDiagram()` from render.ts | Already exists, tested, uses ELK — no reimplementation needed |
| CALM validation | Duplicate validation logic | `validateArchitecture()` from validation.ts + calm-core | Already exists in calm-core, re-exported from mcp-server |
| PR comment deduplication | Time-based or count-based comment search | Hidden HTML marker `<!-- calmstudio-diagram-comment -->` | Robust, language-independent, idiomatic GitHub Actions pattern |
| Action bundling | Custom bundler or shipping node_modules | `@vercel/ncc` | ncc creates a zero-dependency single file; shipping node_modules is slow and brittle |
| Changed files detection | Manual git diff in shell | `octokit.rest.pulls.listFiles()` | Returns structured data including filename, status, patch — no shell parsing |
| VSIX packaging | Manual zip assembly | `vsce package --no-dependencies` | Handles manifest validation, icon embedding, marketplace metadata |

**Key insight:** The MCP server's pure functions (`renderDiagram`, `validateArchitectureTool`) are already designed as importable utilities — the extension and GitHub Action are just new consumers of existing render/validation infrastructure.

---

## Common Pitfalls

### Pitfall 1: GitHub Markdown Strips Inline SVG
**What goes wrong:** Action posts a PR comment containing `<svg>...</svg>` directly — nothing renders, GitHub silently drops the element.
**Why it happens:** GitHub's markdown sanitizer removes `<svg>` for XSS protection. Base64 data URIs also don't render.
**How to avoid:** Commit the rendered SVG file to a dedicated branch (e.g., `gh-diagrams`) and reference via `<img src="https://raw.githubusercontent.com/owner/repo/gh-diagrams/diagram.svg">`. Alternatively, upload as a GitHub comment attachment (drag-and-drop API, supported since 2022 for `.svg` files) and reference the returned URL.
**Warning signs:** PR comment shows text only, no image renders.

### Pitfall 2: VS Code Extension Must Output CJS (Not ESM)
**What goes wrong:** esbuild configured with `format: 'esm'` or package.json has `"type": "module"` — extension fails to load in VS Code.
**Why it happens:** The VS Code extension host uses `require()` to load extensions. ESM extensions are explicitly not supported as of VS Code 1.90+.
**How to avoid:** Always `format: 'cjs'` in esbuild. Do not set `"type": "module"` in extension package.json.
**Warning signs:** `Error [ERR_REQUIRE_ESM]` in VS Code Developer Tools console.

### Pitfall 3: elkjs-svg ESM/CJS Interop in Bundled Extension
**What goes wrong:** esbuild tries to bundle `elkjs-svg` (a native CJS module) into an ESM bundle, or the CJS bundle fails to resolve it at runtime.
**Why it happens:** The mcp-server already uses `// @ts-expect-error — elkjs-svg is a CJS module with no type declarations` and imports it with a workaround. The same handling is needed in the extension bundle.
**How to avoid:** Either mark `elkjs-svg` as external (and include it in the extension's bundled dependencies folder) or use the same `@ts-expect-error` interop pattern from render.ts. Since the extension bundles the MCP server's dist, test the bundled output specifically.
**Warning signs:** Runtime errors about `Renderer is not a constructor` or `Cannot find module 'elkjs-svg'`.

### Pitfall 4: MCP Manifest Key Evolution
**What goes wrong:** Using `contributes.mcpServers` (a different or older key) instead of `contributes.mcpServerDefinitionProviders` — the MCP server is not discovered by VS Code.
**Why it happens:** The MCP API in VS Code has evolved. Search results show both `mcpServerDefinitionProviders` (current, documented) and `modelContextServerCollections` (mentioned as a 2025 variant in one result). The official VS Code docs use `mcpServerDefinitionProviders`.
**How to avoid:** Use `contributes.mcpServerDefinitionProviders` as documented at https://code.visualstudio.com/api/extension-guides/ai/mcp. Verify against the VS Code version targeted (`engines.vscode`).
**Warning signs:** MCP server not appearing in VS Code's MCP server list after extension install.

### Pitfall 5: `vsce publish` Requires "All accessible organizations" PAT Scope
**What goes wrong:** Publish fails with 401/403 even though PAT has "Marketplace > Manage" scope.
**Why it happens:** The PAT must be scoped to "All accessible organizations" not a specific organization. This is a common mistake.
**How to avoid:** Create PAT at https://dev.azure.com with Organization: "All accessible organizations" + Marketplace: Manage.
**Warning signs:** `Error: Failed to publish. Make sure you have access rights for this publisher.`

### Pitfall 6: GitHub Action dist/ Not Committed
**What goes wrong:** Action workflow fails with "Could not find dist/index.js" or runs from stale built code.
**Why it happens:** GitHub downloads the action repo at the tagged version — if `dist/` is in `.gitignore`, no bundle exists at runtime.
**How to avoid:** Commit `dist/` to git. The template in `actions/typescript-action` commits dist/. Add `dist/` to the action package's `.gitignore` exclusion (`!dist/`).
**Warning signs:** `Error: Cannot find module '/path/to/action/dist/index.js'`.

### Pitfall 7: webview Panel Not Persisted Across Editor Switches
**What goes wrong:** Each time user switches editor tabs, a new panel is created; multiple preview panels accumulate.
**Why it happens:** Extension calls `createWebviewPanel()` on every `onDidChangeActiveTextEditor` without checking if a panel already exists.
**How to avoid:** Use the static `currentPanel` singleton pattern — check if panel exists and call `reveal()` instead of creating a new one.

---

## Code Examples

Verified patterns from official sources:

### VS Code Extension Manifest (package.json)

```json
{
  "name": "calmstudio",
  "publisher": "opsflow",
  "displayName": "CalmStudio",
  "description": "CALM architecture diagram preview and MCP integration",
  "version": "0.0.1",
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Visualization", "Other"],
  "icon": "assets/icon.png",
  "activationEvents": [
    "workspaceContains:**/*.calm.json"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "calmstudio.openPreview",
        "title": "Open CALM Diagram Preview",
        "category": "CalmStudio"
      },
      {
        "command": "calmstudio.openInApp",
        "title": "Open in CalmStudio",
        "category": "CalmStudio"
      }
    ],
    "menus": {
      "editor/title": [
        {
          "command": "calmstudio.openPreview",
          "when": "resourceExtname == .json",
          "group": "navigation"
        }
      ]
    },
    "mcpServerDefinitionProviders": [
      {
        "id": "calmstudio.mcpServer",
        "label": "CalmStudio MCP"
      }
    ]
  }
}
```

### Webview HTML Generator (CSP-compliant)

```typescript
// Source: https://code.visualstudio.com/api/extension-guides/webview
function getWebviewContent(svg: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src data:; style-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CALM Diagram Preview</title>
  <style nonce="${nonce}">
    body { margin: 0; padding: 8px; background: var(--vscode-editor-background); overflow: auto; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${svg}
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
```

### GitHub Action — Getting Changed .calm.json Files

```typescript
// Source: https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files
async function getChangedCalmFiles(octokit: ReturnType<typeof github.getOctokit>, ctx: typeof github.context): Promise<string[]> {
  const { owner, repo } = ctx.repo;
  const prNumber = ctx.payload.pull_request?.number;
  if (!prNumber) return [];

  const files = await octokit.rest.pulls.listFiles({
    owner, repo, pull_number: prNumber, per_page: 100
  });

  return files.data
    .filter(f => f.status !== 'removed')
    .filter(f => f.filename.endsWith('.calm.json') || f.filename.endsWith('.json'))
    .map(f => f.filename);
}
```

### Adapting renderDiagram for Direct Arch Object (No File I/O)

The existing `renderDiagram()` in render.ts reads from a file path. For the extension and GitHub Action, we need a version that accepts a `CalmArchitecture` object directly (no file I/O). The pure layout+SVG logic inside `renderDiagram()` should be extracted as a separate function:

```typescript
// Proposed refactor in render.ts — extract pure render logic
export async function renderArchitectureToSvg(
  arch: CalmArchitecture,
  direction: 'DOWN' | 'RIGHT' = 'DOWN'
): Promise<string> {
  // ... (the ELK layout + SVG generation logic, no file I/O)
}
```

This avoids duplicating the ELK + SVG pipeline in the extension and action.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vscode.workspace.registerTextDocumentContentProvider` for previews | `createWebviewPanel` with postMessage | VS Code 1.30+ | Webview panels are the modern, flexible approach; custom providers are legacy |
| `contributes.modelContextServerCollections` | `contributes.mcpServerDefinitionProviders` | 2025 (VS Code MCP API stabilization) | Use the documented `mcpServerDefinitionProviders` key |
| Publishing via PAT in `~/.vsce` | `vsce login <publisher>` with explicit login step | Current | PAT stored securely via login command |
| Shipping `node_modules/` in GitHub Actions | Pre-bundled `dist/index.js` with ncc/esbuild | 2019+ | Faster checkout and execution, mandatory for marketplace actions |
| Inline `<svg>` in GitHub markdown | `<img src="raw.githubusercontent.com/...">` | GitHub sanitizes SVG for XSS | Inline SVG never worked; must use external file reference |

**Deprecated/outdated:**
- `vscode.workspace.registerTextDocumentContentProvider`: Legacy API, replaced by Webview API for rich previews
- `activationEvents: ["*"]`: Still works but discouraged — degrades startup for all users

---

## Open Questions

1. **GitHub Action SVG rendering strategy — exact approach for inline display**
   - What we know: GitHub strips `<svg>` from markdown. `<img>` with external URL works. Uploading SVG via comment attachment API works since 2022.
   - What's unclear: The attachment upload API is not part of the standard GitHub REST API docs; it's a form-upload endpoint discovered from reverse engineering. An alternative is committing SVG to a `gh-diagrams` branch — simpler but requires write permissions to the repo.
   - Recommendation: Use the `git commit SVG to branch` approach for the MVP — it uses documented APIs (`octokit.rest.repos.createOrUpdateFileContents`) and raw.githubusercontent.com URLs for display. Document that the action needs `contents: write` permission.

2. **VS Code `contributes.mcpServerDefinitionProviders` minimum VS Code version**
   - What we know: The MCP developer guide exists at code.visualstudio.com and uses `mcpServerDefinitionProviders`. One source mentioned `modelContextServerCollections` as an evolution.
   - What's unclear: Exact minimum VS Code version that supports `vscode.lm.registerMcpServerDefinitionProvider`. The MCP features require VS Code 1.99+ based on known MCP rollout timeline.
   - Recommendation: Set `engines.vscode: "^1.99.0"` and validate against the VS Code Insiders API during development. Check the VS Code extension API changelog for the exact release.

3. **render.ts refactor scope**
   - What we know: Current `renderDiagram()` couples file reading with SVG generation. Both the extension and GitHub Action need the pure SVG generation without file I/O.
   - What's unclear: Whether to refactor render.ts in-place (adds a new export to mcp-server) or duplicate the logic.
   - Recommendation: Add `renderArchitectureToSvg(arch: CalmArchitecture): Promise<string>` as a new export in render.ts (pure function, no file I/O). The extension and action import this function. The existing `renderDiagram()` becomes a thin wrapper. This is minimal change with high reuse benefit.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^3.x (pure unit tests) + Mocha/@vscode/test-electron (VS Code integration) |
| Config file | `packages/vscode-extension/vitest.config.ts` (for pure unit tests) |
| Quick run command | `pnpm --filter @calmstudio/vscode-extension test:unit` |
| Full suite command | `pnpm --filter @calmstudio/vscode-extension test` |

For GitHub Action:

| Property | Value |
|----------|-------|
| Framework | vitest ^3.x |
| Config file | `packages/github-action/vitest.config.ts` |
| Quick run command | `pnpm --filter @calmstudio/github-action test` |
| Full suite command | `pnpm --filter @calmstudio/github-action test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VSCE-01 | Webview panel opens and displays SVG for .calm.json | unit (pure render logic) | `vitest run src/tests/preview.test.ts` | ❌ Wave 0 |
| VSCE-02 | Preview updates on file save | unit (mock VS Code API) | `vitest run src/tests/preview.test.ts` | ❌ Wave 0 |
| VSCE-03 | MCP provider registration returns correct McpStdioServerDefinition | unit | `vitest run src/tests/mcp.test.ts` | ❌ Wave 0 |
| VSCE-04 | "Open in CalmStudio" opens URI via vscode.env.openExternal | unit (mock openExternal) | `vitest run src/tests/openInStudio.test.ts` | ❌ Wave 0 |
| VSCE-05 | Extension packages cleanly with vsce | smoke (build check) | `vsce package --no-dependencies 2>&1 | grep -v WARN` | ❌ Wave 0 |
| GHAC-01 | renderArchitectureToSvg produces valid SVG; upsertComment calls correct Octokit endpoints | unit (mock octokit) | `pnpm --filter @calmstudio/github-action test` | ❌ Wave 0 |

**Note:** VSCE-01 through VSCE-04 test pure TypeScript logic with mocked VS Code API — no VS Code host required. End-to-end testing of the actual extension in VS Code requires `@vscode/test-electron` and is out of scope for automated CI (manual verification only for v1.1).

### Sampling Rate

- **Per task commit:** `pnpm --filter @calmstudio/vscode-extension test:unit && pnpm --filter @calmstudio/github-action test`
- **Per wave merge:** Same, plus `vsce package --no-dependencies` to verify extension bundles
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/vscode-extension/` — entire new package (scaffold with `yo code` or manual)
- [ ] `packages/vscode-extension/src/tests/preview.test.ts` — covers VSCE-01, VSCE-02
- [ ] `packages/vscode-extension/src/tests/mcp.test.ts` — covers VSCE-03
- [ ] `packages/vscode-extension/src/tests/openInStudio.test.ts` — covers VSCE-04
- [ ] `packages/vscode-extension/vitest.config.ts` — unit test config
- [ ] `packages/github-action/` — entire new package
- [ ] `packages/github-action/src/tests/action.test.ts` — covers GHAC-01
- [ ] `packages/github-action/vitest.config.ts` — test config
- [ ] Monorepo `pnpm-workspace.yaml` — verify `packages/vscode-extension` and `packages/github-action` are included

---

## Sources

### Primary (HIGH confidence)

- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview) — `createWebviewPanel`, CSP, `asWebviewUri`, message passing
- [VS Code Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest) — `activationEvents`, `contributes.languages`, required manifest fields
- [VS Code Activation Events](https://code.visualstudio.com/api/references/activation-events) — `workspaceContains`, `onLanguage`, VS Code 1.74+ auto-activation
- [VS Code Bundling Extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) — esbuild config, `format: 'cjs'`, `external: ['vscode']`, `--no-dependencies` flag
- [VS Code Publishing Extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) — vsce, PAT setup, VSIX creation
- [VS Code MCP Developer Guide](https://code.visualstudio.com/api/extension-guides/ai/mcp) — `contributes.mcpServerDefinitionProviders`, `vscode.lm.registerMcpServerDefinitionProvider`, `McpStdioServerDefinition`
- [VS Code API Reference — workspace](https://code.visualstudio.com/api/references/vscode-api#workspace) — `onDidSaveTextDocument`, `onDidChangeActiveTextEditor`, `createFileSystemWatcher`
- [GitHub JavaScript Actions Guide](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action) — `action.yml`, `node20` runtime, `@actions/core`, `@actions/github`, dist/ commit requirement
- [SVG Rendering on GitHub (2024)](https://alexwlchan.net/notes/2024/how-to-render-svgs-on-github/) — Verified: inline `<svg>` stripped, only `<img src="...">` works

### Secondary (MEDIUM confidence)

- [Ken Muse — Adding MCP Server to VS Code Extension](https://www.kenmuse.com/blog/adding-mcp-server-to-vs-code-extension/) — confirmed `mcpServerDefinitionProviders` manifest key, `McpStdioServerDefinition` constructor signature
- [Formula Hendry — Bundle MCP Server into VS Code Extension](https://dev.to/formulahendry/bundle-mcp-server-into-vs-code-extension-3lii) — HTTP transport alternative pattern (rejected — stdio is simpler)
- [actions/typescript-action](https://github.com/actions/typescript-action) — confirmed ncc bundling, dist/ commit requirement, `@actions/core` + `@actions/github` usage

### Tertiary (LOW confidence)

- Search result mentioning `modelContextServerCollections` as a 2025 variant of the MCP manifest key — **not verified against official docs, treat as potentially stale/incorrect**. Stick with `mcpServerDefinitionProviders` per official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libraries verified via official VS Code docs and GitHub Actions docs
- Architecture: HIGH — patterns derived directly from official VS Code API samples and guides
- Pitfalls: HIGH (SVG, CJS, dist/), MEDIUM (MCP manifest key evolution) — SVG limitation verified with official source; CJS requirement verified; manifest key verified in official docs but flag the `modelContextServerCollections` discrepancy
- GitHub Action SVG strategy: MEDIUM — core constraint (no inline SVG) is HIGH confidence; recommended workaround (commit to branch) is pragmatic but adds `contents: write` permission requirement

**Research date:** 2026-03-16
**Valid until:** 2026-06-16 (VS Code extension APIs are stable; MCP API may evolve faster — check in 30 days)
