# Phase 11: Desktop App - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Tauri 2 desktop application wrapping the existing SvelteKit web app. Native file system access, OS-level file association, app packaging for macOS/Windows/Linux. No new canvas features — this phase is purely about native shell, file I/O, packaging, and distribution.

</domain>

<decisions>
## Implementation Decisions

### File handling
- Register as default handler for .calm.json files (double-click opens CalmStudio)
- Drag-and-drop .calm.json files onto app window (not dock icon)
- Recent files list in File menu (last 10 opened files)
- Replace browser File System Access API with Tauri API (@tauri-apps/plugin-dialog + @tauri-apps/plugin-fs) entirely in desktop mode
- Title bar shows "CalmStudio — filename.calm.json" with dirty indicator (•) when unsaved

### Distribution
- GitHub Releases: DMG (macOS), NSIS installer (Windows), AppImage (Linux)
- Auto-update: silent check on launch, prompt user to download (Tauri 2 updater plugin)
- Code signing: macOS notarization only (Apple Developer cert). Windows users dismiss SmartScreen warning.
- CI builds on git tag push

### App identity
- App name: "CalmStudio"
- Icon: abstract/geometric style suggesting architecture/structure (Figma/Linear/Arc aesthetic)
- Full native menu bar: File (Open, Save, Save As, Recent), Edit (Undo, Redo, Cut, Copy, Paste), View (Zoom, Toggle panels), Help (About, Docs)

### Offline behavior
- All 7 extension packs + 6 templates bundled in app — fully offline, no network needed
- MCP server bundled as Tauri 2 sidecar process — starts with app, stops on close
- No degraded features offline — everything works without network

### Claude's Discretion
- Tauri 2 config structure (tauri.conf.json)
- Sidecar packaging details for MCP server
- Keyboard shortcut mapping between web toolbar and native menu
- Exact icon design within abstract/geometric constraint
- Window size defaults and min/max constraints

</decisions>

<specifics>
## Specific Ideas

- The web app already has all features — this is a packaging/wrapping phase
- Existing fileSystem.ts in apps/studio/src/lib/io/ handles File System Access API — this becomes the integration point for Tauri file APIs
- Tauri 2 sidecar for MCP server means users get Claude Code integration out of the box without npm install

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/studio/` — complete SvelteKit web app, serves as the Tauri webview content
- `apps/studio/src/lib/io/fileSystem.ts` — current File System Access API implementation, replace with Tauri plugin
- `apps/studio/src/lib/stores/calmModel.svelte.ts` — dirty state tracking, reuse for title bar indicator
- `packages/mcp-server/` — standalone MCP server package, bundle as sidecar binary

### Established Patterns
- SvelteKit with adapter-static — Tauri 2 serves static build
- Module-level $state runes for stores — no changes needed for desktop
- pnpm monorepo — add `apps/desktop/` or wrap `apps/studio/` with Tauri

### Integration Points
- `apps/studio/svelte.config.js` — may need adapter-static for Tauri (currently adapter-auto)
- `apps/studio/src/lib/io/fileSystem.ts` — Tauri file dialog/fs plugin replaces browser FSA
- `apps/studio/src/routes/+page.svelte` — dirty state, file name tracking for title bar
- `packages/mcp-server/` — sidecar binary target

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-desktop-app*
*Context gathered: 2026-03-15*
