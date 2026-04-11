# Phase 12: Developer Tooling - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

VS Code extension for live CALM architecture diagram preview with MCP server auto-registration, plus a GitHub Action that renders CALM diagrams as SVG in PR comments. Two deliverables: an extension installable from the VS Code Marketplace, and a JavaScript GitHub Action in the monorepo.

</domain>

<decisions>
## Implementation Decisions

### VS Code Preview Rendering
- Static SVG via existing ELK renderer (render.ts from MCP server) — reuse the same pipeline, no separate canvas build
- Read-only preview in a webview panel — not interactive (pan/zoom is out of scope)
- Preview auto-opens when a .calm.json file is the active editor — side-by-side editing
- Preview auto-updates when the .calm.json file is saved (VSCE-02)
- Build as a fresh extension with ID `opsflow.calmstudio` — do NOT fork or extend the existing `calm` Marketplace extension

### Open in CalmStudio
- "Open in CalmStudio" button launches the desktop app with the file path (uses Phase 11 file association)
- Falls back to web URL if desktop app is not installed

### MCP Auto-Registration
- Use `contributes.mcpServers` in VS Code extension package.json (native contribution point)
- Bundle the MCP server's Node.js entry point with the extension — uses VS Code's built-in Node.js runtime (`node dist/index.js`)
- All 21 MCP tools available — no curated subset, full capability for AI assistants (Copilot, Claude Code)

### GitHub Action
- Auto-detect changed .calm.json files in PR diff — zero config for users
- Render SVG AND run CALM validation — show errors/warnings alongside the diagram in the PR comment
- PR comment with inline SVG — bot updates the same comment on subsequent pushes (no comment spam)
- JavaScript/TypeScript Action — imports calm-core and render.ts directly, fast startup, no Docker
- Source lives in this monorepo at `packages/github-action/`

### Distribution & Identity
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

</decisions>

<specifics>
## Specific Ideas

- The MCP server's `render.ts` already has ELK layout + elkjs-svg rendering — this exact pipeline should be reused for both VS Code preview and GitHub Action SVG generation
- The desktop app's file association from Phase 11 means "Open in CalmStudio" can use OS-level `open` command with the file path
- GitHub Action should update the same PR comment (use a hidden HTML marker to find existing comment) rather than posting new comments on each push

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/mcp-server/src/tools/render.ts`: ELK layout engine + elkjs-svg renderer — produces SVG from CALM JSON. Core rendering pipeline for both VS Code and GitHub Action.
- `packages/mcp-server/src/validation.ts`: CALM schema validation — reuse for GitHub Action validation step
- `packages/mcp-server/src/types.ts`: CALM architecture types and Zod schemas
- `packages/mcp-server/src/file-io.ts`: File reading/writing utilities for .calm.json files
- `@calmstudio/calm-core`: Published npm package with CALM types and validation

### Established Patterns
- pnpm monorepo with `packages/` for shared libraries — GitHub Action goes in `packages/github-action/`
- VS Code extension is a new package, likely at `packages/vscode-extension/`
- MCP server uses ESM (`"type": "module"`) — bundling strategy must handle this (esbuild worked in Phase 11)

### Integration Points
- VS Code extension → MCP server render.ts (SVG generation)
- VS Code extension → desktop app (file association launch)
- GitHub Action → calm-core (validation) + render.ts (SVG generation)
- VS Code extension manifest → contributes.mcpServers (MCP registration)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-developer-tooling*
*Context gathered: 2026-03-16*
