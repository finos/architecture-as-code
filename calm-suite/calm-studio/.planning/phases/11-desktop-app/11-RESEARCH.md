# Phase 11: Desktop App - Research

**Researched:** 2026-03-15
**Domain:** Tauri 2, SvelteKit static adapter, native file I/O, app packaging & distribution
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**File handling:**
- Register as default handler for .calm.json files (double-click opens CalmStudio)
- Drag-and-drop .calm.json files onto app window (not dock icon)
- Recent files list in File menu (last 10 opened files)
- Replace browser File System Access API with Tauri API (@tauri-apps/plugin-dialog + @tauri-apps/plugin-fs) entirely in desktop mode
- Title bar shows "CalmStudio — filename.calm.json" with dirty indicator (•) when unsaved

**Distribution:**
- GitHub Releases: DMG (macOS), NSIS installer (Windows), AppImage (Linux)
- Auto-update: silent check on launch, prompt user to download (Tauri 2 updater plugin)
- Code signing: macOS notarization only (Apple Developer cert). Windows users dismiss SmartScreen warning.
- CI builds on git tag push

**App identity:**
- App name: "CalmStudio"
- Icon: abstract/geometric style suggesting architecture/structure (Figma/Linear/Arc aesthetic)
- Full native menu bar: File (Open, Save, Save As, Recent), Edit (Undo, Redo, Cut, Copy, Paste), View (Zoom, Toggle panels), Help (About, Docs)

**Offline behavior:**
- All 7 extension packs + 6 templates bundled in app — fully offline, no network needed
- MCP server bundled as Tauri 2 sidecar process — starts with app, stops on close
- No degraded features offline — everything works without network

### Claude's Discretion
- Tauri 2 config structure (tauri.conf.json)
- Sidecar packaging details for MCP server
- Keyboard shortcut mapping between web toolbar and native menu
- Exact icon design within abstract/geometric constraint
- Window size defaults and min/max constraints

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DESK-01 | Tauri 2 app builds and runs on macOS, Windows, and Linux | Tauri 2 bundle targets (DMG, NSIS, AppImage), GitHub Actions matrix builds |
| DESK-02 | Native file open/save dialogs for .calm.json files | @tauri-apps/plugin-dialog open()/save() API, plugin-fs readTextFile/writeTextFile |
| DESK-03 | App works fully offline with no network requests for core functionality | Static SvelteKit build served from webview, all packs/templates bundled in binary, MCP sidecar |
</phase_requirements>

---

## Summary

CalmStudio Desktop is a Tauri 2 wrapper around the existing SvelteKit web app. The app's core web code requires minimal changes — the primary work is: (1) adding `src-tauri/` Rust shell to the `apps/studio/` directory, (2) replacing `fileSystem.ts` browser APIs with `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`, (3) building a native menu bar with `@tauri-apps/api/menu`, (4) packaging the MCP server as a Tauri sidecar binary, and (5) setting up GitHub Actions CI for cross-platform builds and GitHub Releases distribution.

The SvelteKit app already uses `adapter-static` with `fallback: 'index.html'` — exactly what Tauri 2 requires. SSR must be disabled project-wide by adding `export const ssr = false` to `src/routes/+layout.ts`. The existing `fileState.svelte.ts` store (dirty tracking, filename, handle) becomes the bridge between the Svelte UI and Tauri APIs — the handle type changes from `FileSystemFileHandle | null` to `string | null` (a file path).

The MCP server (`packages/mcp-server/`) is a Node.js TypeScript package. Packaging it as a Tauri sidecar requires compiling it to a self-contained binary using `pkg` (or `@yao-pkg/pkg`), naming the output with platform target triples, and declaring it in `tauri.conf.json bundle.externalBin`. The single-instance plugin (`tauri-plugin-single-instance`) is needed on Windows/Linux so double-clicking a `.calm.json` file focuses the existing window rather than launching a second instance.

**Primary recommendation:** Structure the Tauri shell inside `apps/studio/src-tauri/` (co-located with the SvelteKit app it wraps). Do not create a separate `apps/desktop/` package — the Tauri build is tightly coupled to the studio's static build output.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/cli` | ^2.x | Dev/build CLI (`tauri dev`, `tauri build`) | Official Tauri toolchain |
| `@tauri-apps/api` | ^2.x | Window, menu, event JS bindings | Official JS bridge |
| `@tauri-apps/plugin-dialog` | ^2.x | Native OS open/save dialogs | Official plugin, replaces FSA API |
| `@tauri-apps/plugin-fs` | ^2.x | Read/write files by path | Official plugin, replaces FSA API |
| `@tauri-apps/plugin-shell` | ^2.x | Sidecar process spawning | Required for MCP sidecar |
| `@tauri-apps/plugin-updater` | ^2.x | Auto-update check and install | Official updater plugin |
| `@tauri-apps/plugin-process` | ^2.x | `relaunch()` after update install | Companion to updater |
| `@tauri-apps/plugin-store` | ^2.x | Persistent key-value (recent files list) | Official persistence plugin |
| `tauri-plugin-single-instance` | ^2.x | Prevent second window on file double-click | Required for Windows/Linux file association |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@yao-pkg/pkg` | latest | Compile MCP server to standalone binary | Sidecar binary creation |
| `tauri-plugin-deep-link` | ^2.x | Handle file open events on macOS at startup | macOS "open file from Finder" launch |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@yao-pkg/pkg` for sidecar | `nexe` or `bun compile` | pkg is officially recommended in Tauri docs; bun produces smaller binaries but adds a bun runtime dependency |
| `tauri-plugin-store` for recent files | `localStorage` | plugin-store persists to native app data dir, survives app reinstall; localStorage is wiped on some platforms |

### Installation

```bash
# In apps/studio/
pnpm add -D @tauri-apps/cli@latest
pnpm add @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
pnpm add @tauri-apps/plugin-shell @tauri-apps/plugin-updater @tauri-apps/plugin-process
pnpm add @tauri-apps/plugin-store

# Add tauri scripts to apps/studio/package.json
# "tauri": "tauri"
```

Rust dependencies added to `apps/studio/src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
tauri-plugin-store = "2"
tauri-plugin-single-instance = "2"
tauri-plugin-deep-link = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/studio/
├── src/                          # SvelteKit source (unchanged)
│   ├── routes/
│   │   ├── +layout.ts            # ADD: export const ssr = false
│   │   └── +page.svelte          # Modified: use Tauri file APIs in desktop mode
│   └── lib/
│       ├── io/
│       │   ├── fileSystem.ts     # REPLACE: Tauri plugin replaces browser FSA
│       │   ├── fileSystemTauri.ts # NEW: Tauri-specific file I/O
│       │   └── fileState.svelte.ts # MODIFY: handle becomes string | null (path)
│       └── desktop/              # NEW: desktop-only modules
│           ├── menu.ts           # Native menu bar construction
│           ├── titleBar.ts       # Window title updates
│           ├── recentFiles.ts    # Recent files list (plugin-store backed)
│           └── sidecarMcp.ts     # MCP sidecar lifecycle
├── src-tauri/                    # NEW: Tauri Rust shell
│   ├── src/
│   │   ├── lib.rs                # Plugin registration, menu events
│   │   └── main.rs               # Entry point (desktop)
│   ├── capabilities/
│   │   └── default.json          # Permission grants for all plugins
│   ├── icons/                    # App icons (all required sizes)
│   ├── tauri.conf.json           # Main Tauri config
│   └── Cargo.toml
├── svelte.config.js              # Already adapter-static — no change needed
└── package.json                  # Add "tauri": "tauri" script
```

### Pattern 1: Desktop Mode Detection

The Tauri API only works inside a Tauri webview. Use a guard to detect the environment and route to the correct implementation:

```typescript
// Source: https://v2.tauri.app/develop/
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// In fileSystem.ts — route based on environment
export async function openFile(): Promise<OpenFileResult> {
  if (isTauri()) {
    return openFileTauri();   // uses @tauri-apps/plugin-dialog
  }
  return openFileBrowser();   // existing FSA / input fallback
}
```

**When to use:** Any module that calls browser-specific or Tauri-specific APIs. The pattern lets the same codebase serve both web and desktop.

### Pattern 2: Tauri File Open/Save

Replace `FileSystemFileHandle` with a path string. The dialog plugin returns a path; the fs plugin reads/writes by path:

```typescript
// Source: https://v2.tauri.app/plugin/dialog/ + https://v2.tauri.app/plugin/file-system/
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export async function openFileTauri(): Promise<OpenFileResult> {
  const path = await open({
    multiple: false,
    filters: [{ name: 'CALM JSON', extensions: ['json', 'calm.json'] }],
  });
  if (!path) throw new Error('No file selected');
  const content = await readTextFile(path);
  return { content, name: path.split('/').pop() ?? path, handle: path };
}

export async function saveFileTauri(content: string, path: string): Promise<string> {
  await writeTextFile(path, content);
  return path;
}

export async function saveFileAsTauri(content: string, suggestedName: string): Promise<string | null> {
  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: 'CALM JSON', extensions: ['json', 'calm.json'] }],
  });
  if (!path) return null;
  await writeTextFile(path, content);
  return path;
}
```

**Key change to `fileState.svelte.ts`:** The `fileHandle` field type changes from `FileSystemFileHandle | null` to `string | null` (file path). All existing callers using `handle.createWritable()` are replaced by `saveFileTauri(content, handle)`.

### Pattern 3: Native Menu Bar

Menus must be built at app startup from the Svelte `onMount` lifecycle (JavaScript-first approach):

```typescript
// Source: https://v2.tauri.app/learn/window-menu/
import { Menu, MenuItem, Submenu, PredefinedMenuItem } from '@tauri-apps/api/menu';

export async function buildAppMenu(handlers: MenuHandlers): Promise<void> {
  const fileMenu = await Submenu.new({
    text: 'File',
    items: [
      await MenuItem.new({ id: 'open', text: 'Open...', accelerator: 'CmdOrCtrl+O', action: handlers.open }),
      await MenuItem.new({ id: 'save', text: 'Save', accelerator: 'CmdOrCtrl+S', action: handlers.save }),
      await MenuItem.new({ id: 'save-as', text: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', action: handlers.saveAs }),
      { item: 'Separator' },
      // Recent files inserted dynamically here
      { item: 'Separator' },
    ],
  });
  const editMenu = await Submenu.new({
    text: 'Edit',
    items: [
      await PredefinedMenuItem.new({ item: 'Undo' }),
      await PredefinedMenuItem.new({ item: 'Redo' }),
      { item: 'Separator' },
      await PredefinedMenuItem.new({ item: 'Cut' }),
      await PredefinedMenuItem.new({ item: 'Copy' }),
      await PredefinedMenuItem.new({ item: 'Paste' }),
    ],
  });
  const menu = await Menu.new({ items: [fileMenu, editMenu] });
  await menu.setAsAppMenu();
}
```

**macOS constraint:** All items must be in submenus. Top-level items are ignored on macOS. The first submenu appears after the system app menu.

### Pattern 4: Window Title Update

```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewindow/
import { getCurrentWindow } from '@tauri-apps/api/window';

export async function updateWindowTitle(filename: string | null, isDirty: boolean): Promise<void> {
  const base = filename ?? 'Untitled';
  const dirty = isDirty ? ' •' : '';
  await getCurrentWindow().setTitle(`CalmStudio — ${base}${dirty}`);
}
```

**Integration point:** Call this from an `$effect` that watches `getFileName()` and `getIsDirty()` in the existing `fileState.svelte.ts` store.

### Pattern 5: MCP Sidecar Lifecycle

The MCP server starts with the app and is killed on close. Use `Command.sidecar()` from `plugin-shell`:

```typescript
// Source: https://v2.tauri.app/develop/sidecar/
import { Command } from '@tauri-apps/plugin-shell';

let mcpChild: ReturnType<typeof Command.sidecar> | null = null;

export async function startMcpSidecar(): Promise<void> {
  const command = Command.sidecar('binaries/calmstudio-mcp');
  mcpChild = await command.spawn();
}

export async function stopMcpSidecar(): Promise<void> {
  if (mcpChild) {
    await mcpChild.kill();
    mcpChild = null;
  }
}
```

Call `startMcpSidecar()` from `onMount` in `+page.svelte` (after `isTauri()` guard), and register cleanup via Tauri's `window.onCloseRequested` event.

### Pattern 6: Auto-Updater

```typescript
// Source: https://v2.tauri.app/plugin/updater/
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates(): Promise<void> {
  const update = await check();
  if (!update) return;
  const confirmed = await confirm(`Version ${update.version} is available. Download now?`);
  if (confirmed) {
    await update.downloadAndInstall();
    await relaunch();
  }
}
```

Call `checkForUpdates()` in `onMount` with a try/catch — never block startup on update failure.

### Pattern 7: Recent Files (plugin-store)

```typescript
// Source: https://v2.tauri.app/reference/javascript/store/
import { load } from '@tauri-apps/plugin-store';

const RECENT_MAX = 10;

export async function addRecentFile(path: string): Promise<string[]> {
  const store = await load('settings.json', { autoSave: true });
  const current: string[] = (await store.get('recentFiles')) ?? [];
  const updated = [path, ...current.filter(p => p !== path)].slice(0, RECENT_MAX);
  await store.set('recentFiles', updated);
  return updated;
}

export async function getRecentFiles(): Promise<string[]> {
  const store = await load('settings.json', { autoSave: true });
  return (await store.get('recentFiles')) ?? [];
}
```

### Pattern 8: File Association / Single Instance

On Windows and Linux, double-clicking a `.calm.json` launches a new process with the file path as `argv[1]`. The single-instance plugin intercepts and forwards to the running instance:

```rust
// In lib.rs
app.handle().plugin(
  tauri_plugin_single_instance::init(|app, argv, _cwd| {
    // argv[1] is the file path when opened via file association
    if let Some(path) = argv.get(1) {
      app.emit("open-file", path).ok();
    }
    // Focus existing window
    if let Some(window) = app.get_webview_window("main") {
      window.set_focus().ok();
    }
  })
)?;
```

On macOS, file associations emit `tauri://file-drop` or the deep-link plugin's `onOpenUrl`. Use `tauri-plugin-deep-link` for macOS startup handling.

### Anti-Patterns to Avoid

- **Calling Tauri APIs without `isTauri()` guard:** The web build will throw at runtime when Tauri IPC is not available. Always guard with `isTauri()`.
- **Blocking `onMount` with async init:** Start sidecar and updater check asynchronously; don't `await` them in a way that delays render.
- **Using `localStorage` for recent files:** Does not persist across OS-level app reinstalls on some platforms. Use `plugin-store` which writes to the native app data directory.
- **Hard-coding window title in `tauri.conf.json`:** The title must be dynamically updated at runtime via `setTitle()`. Set a reasonable default in config, override immediately on mount.
- **Registering Rust plugins after other plugins:** `tauri_plugin_single_instance` must be the first plugin registered to intercept correctly.

---

## tauri.conf.json Reference

Complete skeleton for the locked decisions:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "CalmStudio",
  "version": "0.1.0",
  "identifier": "app.calmstudio.studio",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "CalmStudio",
        "width": 1400,
        "height": 900,
        "minWidth": 900,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "createUpdaterArtifacts": true,
    "externalBin": ["binaries/calmstudio-mcp"],
    "fileAssociations": [
      {
        "name": "CALM Architecture",
        "ext": ["calm.json"],
        "mimeType": "application/json",
        "description": "CALM Architecture File",
        "role": "Editor"
      }
    ]
  },
  "plugins": {
    "updater": {
      "pubkey": "REPLACE_WITH_GENERATED_PUBKEY",
      "endpoints": [
        "https://github.com/YOUR_ORG/calmstudio/releases/latest/download/latest.json"
      ]
    },
    "deep-link": {
      "desktop": {
        "schemes": []
      }
    }
  }
}
```

**Capabilities file** (`src-tauri/capabilities/default.json`):

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for CalmStudio desktop",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$HOME/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$HOME/**" }]
    },
    "shell:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [{ "name": "binaries/calmstudio-mcp", "sidecar": true }]
    },
    "updater:default",
    "store:default"
  ]
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native file picker | Custom HTML file input | `@tauri-apps/plugin-dialog` | OS-native path resolution, recent dirs, proper file type filtering |
| File read/write | `fetch()` + data URIs | `@tauri-apps/plugin-fs` | Security scoping, path validation, binary/text modes |
| App settings persistence | `localStorage` | `@tauri-apps/plugin-store` | Survives reinstall, OS-appropriate location, atomic writes |
| Sidecar binary compilation | Shell scripts | `@yao-pkg/pkg` | Cross-platform, produces single executable, no Node.js required on target machine |
| Auto-update mechanism | Custom HTTP polling | `@tauri-apps/plugin-updater` | Cryptographic signature verification, delta updates, rollback support |
| Prevent duplicate windows | IPC message passing | `tauri-plugin-single-instance` | Platform-specific single-instance locking (DBus on Linux, mutex on Windows) |

**Key insight:** Tauri 2's plugin ecosystem covers every native integration CalmStudio needs. The only custom Rust code required is plugin registration in `lib.rs` and the menu event handler.

---

## Common Pitfalls

### Pitfall 1: `ssr = false` Missing in +layout.ts

**What goes wrong:** Tauri APIs (`window.__TAURI_INTERNALS__`) are not available during SSR. SvelteKit will throw on server-side render if any Tauri import is evaluated.
**Why it happens:** `adapter-static` does not automatically disable SSR; it must be explicitly disabled.
**How to avoid:** Add `src/routes/+layout.ts` with `export const ssr = false; export const prerender = false;`.
**Warning signs:** `ReferenceError: window is not defined` during `pnpm build`.

### Pitfall 2: Sidecar Binary Naming

**What goes wrong:** Tauri silently fails to bundle the sidecar if the binary filename doesn't include the exact target triple suffix.
**Why it happens:** Tauri requires each platform binary named as `calmstudio-mcp-{target-triple}`. The triple must match `rustc --print host-tuple` output exactly.
**How to avoid:** After building with `pkg`, rename output: `calmstudio-mcp-aarch64-apple-darwin`, `calmstudio-mcp-x86_64-pc-windows-msvc.exe`, `calmstudio-mcp-x86_64-unknown-linux-gnu`. CI matrix must produce all three.
**Warning signs:** Sidecar binary missing from `.app` bundle, `No such file or directory` at runtime.

### Pitfall 3: `fileHandle` Type Change Breaking Callers

**What goes wrong:** `fileState.svelte.ts` currently stores `FileSystemFileHandle | null`. After migration, it stores `string | null` (path). Any code that calls `handle.createWritable()` will fail silently or throw.
**Why it happens:** The Tauri pattern uses paths, not opaque file handles.
**How to avoid:** Change `fileHandle` to `filePath: string | null` in `fileState.svelte.ts`. Search all callers of `getFileHandle()` and update to use `saveFileTauri(content, path)`.
**Warning signs:** TypeScript strict mode will catch this at compile time — rely on `pnpm typecheck`.

### Pitfall 4: File Associations on Windows/Linux Not Triggering onOpenUrl

**What goes wrong:** On Windows and Linux, double-clicking a `.calm.json` file launches a new app instance with the path as CLI argv, not via the deep-link plugin's `onOpenUrl`.
**Why it happens:** macOS uses Apple Events; Windows/Linux use process argv. These are different mechanisms.
**How to avoid:** Use `tauri-plugin-single-instance` callback (which receives `argv`) on Windows/Linux. Use `tauri-plugin-deep-link` `getCurrent()` on macOS. Handle both paths.
**Warning signs:** Second window appears on double-click instead of focusing the first.

### Pitfall 5: Plugin Version Mismatch

**What goes wrong:** Tauri plugin npm package and Cargo crate must be the same semver. Mismatches cause IPC serialization failures at runtime.
**Why it happens:** The JS and Rust halves of each plugin are a matched pair.
**How to avoid:** When installing a plugin, always install both npm and Cargo versions simultaneously. Pin exact versions in `Cargo.lock`.
**Warning signs:** IPC calls return unexpected errors, capabilities not recognized.

### Pitfall 6: MCP Server Using pkg with ESM Modules

**What goes wrong:** `@yao-pkg/pkg` has limited ESM support. The MCP server uses `"type": "module"` in its `package.json`.
**Why it happens:** pkg bundles CJS by default; ESM requires explicit transpilation first.
**How to avoid:** Add a build step: compile TypeScript to CJS with `tsc --module commonjs` before running `pkg`. Or use `esbuild --bundle --platform=node --format=cjs` as a pre-step. Alternatively, evaluate `bun build --compile` which handles ESM natively.
**Warning signs:** `SyntaxError: Cannot use import statement in a module` at sidecar startup.

### Pitfall 7: `fs:allow-*` Scope Missing for User-Chosen Paths

**What goes wrong:** After the user selects a file via the dialog plugin, `readTextFile(path)` throws a permission denial because the capabilities scope only allows `$APPDATA/*`.
**Why it happens:** Tauri 2's fs plugin enforces capability scopes; dialog-returned paths may be outside the allowed scope.
**How to avoid:** Add `{ "path": "$HOME/**" }` (and `$DOCUMENT/**` for common user paths) to the fs capability's `allow` list. For maximum flexibility, add `{ "path": "/**" }` with care (review security implications).
**Warning signs:** `fs operation denied` error when trying to read a file the user just selected.

---

## Code Examples

### SSR Disable (required)

```typescript
// src/routes/+layout.ts
// Source: https://v2.tauri.app/start/frontend/sveltekit/
export const ssr = false;
export const prerender = false;
```

### Tauri File Open (complete)

```typescript
// Source: https://v2.tauri.app/plugin/dialog/ + https://v2.tauri.app/plugin/file-system/
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

export async function openFileTauri(): Promise<{ content: string; name: string; handle: string }> {
  const path = await open({
    multiple: false,
    filters: [{ name: 'CALM JSON', extensions: ['json'] }],
  });
  if (!path || typeof path !== 'string') throw new Error('No file selected');
  const content = await readTextFile(path);
  const name = path.split(/[\\/]/).pop() ?? path;
  return { content, name, handle: path };
}
```

### Drag-and-Drop Handler

```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespaceevent/
import { getCurrentWebview } from '@tauri-apps/api/webview';

export function registerFileDrop(onFile: (path: string) => void): () => void {
  let unlisten: (() => void) | null = null;
  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === 'drop') {
      const paths = event.payload.paths;
      const calm = paths.find(p => p.endsWith('.json') || p.endsWith('.calm.json'));
      if (calm) onFile(calm);
    }
  }).then(fn => { unlisten = fn; });
  return () => unlisten?.();
}
```

### Single Instance + File Open (Rust)

```rust
// src-tauri/src/lib.rs
// Source: https://v2.tauri.app/plugin/single-instance/
.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
  if let Some(path) = argv.get(1) {
    let _ = app.emit("open-file", path);
  }
  if let Some(w) = app.get_webview_window("main") {
    let _ = w.set_focus();
  }
}))
```

### GitHub Actions Build Matrix (skeleton)

```yaml
# Source: https://v2.tauri.app/distribute/pipelines/github/
strategy:
  matrix:
    include:
      - platform: macos-latest
        args: --target aarch64-apple-darwin
      - platform: macos-latest
        args: --target x86_64-apple-darwin
      - platform: ubuntu-22.04
        args: ''
      - platform: windows-latest
        args: ''
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `@tauri-apps/api/fs` | `@tauri-apps/plugin-fs` (separate npm package) | Tauri 2.0 (Oct 2024) | Import path changed; must install as separate dep |
| Tauri v1 `@tauri-apps/api/shell` | `@tauri-apps/plugin-shell` | Tauri 2.0 | Same |
| Tauri v1 `@tauri-apps/api/dialog` | `@tauri-apps/plugin-dialog` | Tauri 2.0 | Same |
| `tauri-plugin-store` returns `Store` instance directly | v2 uses `load()` async API | plugin-store 2.x | `await load(path)` required before get/set |
| SvelteKit `adapter-auto` | `adapter-static` with `fallback: 'index.html'` | Already done in this project | No change needed |

**Deprecated/outdated:**
- `@tauri-apps/api/fs`, `@tauri-apps/api/shell`, `@tauri-apps/api/dialog`: Removed in Tauri 2; use the plugin packages.
- `window.__TAURI__` namespace: Replaced by `window.__TAURI_INTERNALS__` in Tauri 2.
- Tauri v1 menu system: Completely replaced; v2 menu uses `@tauri-apps/api/menu` with async builder pattern.

---

## Open Questions

1. **MCP sidecar: pkg vs bun compile**
   - What we know: `@yao-pkg/pkg` is officially documented; MCP server uses ESM (`"type": "module"`)
   - What's unclear: Whether pkg's CJS transpilation step is acceptable or if bun produces a smaller, simpler binary
   - Recommendation: Start with `tsc --module commonjs` + pkg in CI. If binary size exceeds 100MB, evaluate `bun build --compile`.

2. **macOS file association: UTI for `.calm.json`**
   - What we know: `fileAssociations.ext` accepts `['calm.json']` — but `.calm.json` is a compound extension and macOS UTI registration typically uses single extensions
   - What's unclear: Whether `ext: ['calm.json']` correctly registers as `.calm.json` or only `.json`
   - Recommendation: Register both `calm.json` and `json` in `ext[]`. Test on macOS with a real `.calm.json` file before release.

3. **Drag-and-drop event duplication bug**
   - What we know: Tauri 2.8.4 has a reported bug where drag-drop events fire twice with different IDs
   - What's unclear: Whether this is fixed in current 2.x or requires a workaround
   - Recommendation: Implement a 50ms debounce on the drop handler, or deduplicate by path.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/studio/vite.config.ts` (test section) |
| Quick run command | `pnpm --filter @calmstudio/studio test` |
| Full suite command | `pnpm test` (workspace-wide) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DESK-01 | Tauri app builds on macOS/Windows/Linux | smoke (CI matrix build) | GitHub Actions `tauri build` | ❌ Wave 0 (CI workflow) |
| DESK-02 | Native open dialog returns path + reads content | unit (mockIPC) | `pnpm --filter @calmstudio/studio test -- fileSystem` | ❌ Wave 0 |
| DESK-02 | Native save dialog writes content to path | unit (mockIPC) | `pnpm --filter @calmstudio/studio test -- fileSystem` | ❌ Wave 0 |
| DESK-03 | App runs with no outbound network calls | smoke (offline) | manual-only: launch with network disabled | manual-only |

**Manual-only justification for DESK-03:** Offline verification requires launching the packaged app binary with network blocked — not automatable in unit/integration tests. CI build success (DESK-01) plus inspecting that no external URLs are referenced in the bundle is the automated proxy.

### Tauri API Mocking Pattern for Unit Tests

```typescript
// Source: https://v2.tauri.app/develop/tests/mocking/
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { mockWindows } from '@tauri-apps/api/mocks';

beforeAll(() => mockWindows('main'));
afterEach(() => clearMocks());

it('openFileTauri resolves with content', async () => {
  mockIPC((cmd, args) => {
    if (cmd === 'plugin:dialog|open') return '/home/user/arch.calm.json';
    if (cmd === 'plugin:fs|read_text_file') return '{"nodes":[],"relationships":[]}';
  });
  const result = await openFileTauri();
  expect(result.content).toBe('{"nodes":[],"relationships":[]}');
});
```

### Wave 0 Gaps

- [ ] `apps/studio/src/tests/io/fileSystemTauri.test.ts` — covers DESK-02 with mockIPC
- [ ] `apps/studio/src/tests/desktop/menu.test.ts` — covers menu construction (mockWindows)
- [ ] `apps/studio/src/tests/desktop/recentFiles.test.ts` — covers plugin-store recent files
- [ ] `.github/workflows/release.yml` — CI build matrix for DESK-01 (macOS/Windows/Linux)
- [ ] Install mocks package: `pnpm add -D @tauri-apps/api` (already used for runtime, but mocks are in the same package)

---

## Sources

### Primary (HIGH confidence)

- https://v2.tauri.app/start/frontend/sveltekit/ — SvelteKit setup, adapter-static requirement, SSR disable
- https://v2.tauri.app/develop/sidecar/ — sidecar configuration, binary naming, cross-platform triples
- https://v2.tauri.app/plugin/dialog/ — open/save dialog API, permissions
- https://v2.tauri.app/plugin/file-system/ — readTextFile/writeTextFile API, scope configuration
- https://v2.tauri.app/learn/window-menu/ — Menu, Submenu, MenuItem, PredefinedMenuItem, accelerators
- https://v2.tauri.app/plugin/updater/ — updater plugin, signing keys, GitHub releases endpoint
- https://v2.tauri.app/distribute/pipelines/github/ — GitHub Actions matrix, tauri-action setup
- https://v2.tauri.app/distribute/sign/macos/ — macOS notarization, required secrets
- https://v2.tauri.app/plugin/single-instance/ — single-instance plugin, argv handling
- https://v2.tauri.app/plugin/deep-link/ — deep-link plugin, macOS file open at startup
- https://v2.tauri.app/learn/sidecar-nodejs/ — Node.js sidecar with pkg
- https://v2.tauri.app/develop/tests/mocking/ — mockIPC, mockWindows, clearMocks pattern
- https://v2.tauri.app/reference/javascript/api/namespacewindow/ — setTitle, getCurrentWindow

### Secondary (MEDIUM confidence)

- WebSearch results on file association known issues (Windows/Linux not triggering onOpenUrl) — confirmed via GitHub issue #1990
- WebSearch results on drag-drop event duplication bug in 2.8.4 — confirmed via GitHub issue #14134
- WebSearch results on pkg ESM limitation — confirmed via pkg GitHub docs

### Tertiary (LOW confidence)

- `ext: ['calm.json']` for compound extension UTI registration — not explicitly verified in official docs; needs empirical testing on macOS

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries from official Tauri 2 docs
- Architecture: HIGH — patterns verified against official API references
- Pitfalls: HIGH (code) / MEDIUM (edge cases) — sourced from official docs + confirmed GitHub issues
- File association compound extension: LOW — needs macOS testing

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (Tauri 2.x stable; plugin APIs change slowly)
