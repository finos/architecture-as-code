# Phase 5: MCP Server - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone MCP server enabling Claude Code and any MCP-compatible AI assistant to create, modify, validate, and export CALM architectures through structured tool calls. Operates on `.calm` files directly — no desktop app required. Supports both stdio transport (Claude Code CLI) and streamable HTTP transport (Claude Cowork visual rendering).

</domain>

<decisions>
## Implementation Decisions

### Tool design — Excalidraw MCP-inspired
- Full CRUD pattern for nodes and relationships: create, get, update, delete, query, batch_create
- `create_architecture` accepts structured node/relationship data — AI client (Claude) interprets the user's description and maps to CALM types; no LLM call inside the server (pure function, zero API key dependencies)
- `validate_architecture` checks .calm file against CALM schema, returns errors/warnings
- `render_diagram` generates SVG using ELK layout (server-side, headless)
- `export_calm` / `import_calm` for file I/O
- `describe_architecture` returns structured text summary of current state
- `read_calm_guide` guidance tool — returns CALM type reference (9 node types, 5 relationship types, interfaces, controls, example architectures) so AI learns CALM vocabulary before creating

### Transport modes
- Single `@calmstudio/mcp` package supports both modes via startup flag
- Default: stdio transport for Claude Code CLI
- `--http --port 3100`: streamable HTTP transport for Claude Cowork (MCP App pattern)
- Shared tool handlers — transport is just a startup flag

### MCP App visual rendering (Claude Cowork)
- `create_view` / `update_view` render architecture as static SVG in Claude Cowork
- ELK layout applied server-side, styled nodes with CALM type shapes
- SVG replaced on each update (not incremental)
- Interactive editing deferred to desktop app

### Open in CalmStudio
- MCP tools return `calmstudio://open?file=/path/to/file.calm` deep link
- Tauri 2 URL scheme registration happens in Phase 9 (Desktop App)
- MCP server generates the link now; it becomes clickable once desktop app is installed

### File & state model
- File-backed, auto-save: every mutation reads .calm file, operates, writes back immediately
- No in-memory sessions, no background threads, no file watchers
- Default file: `./architecture.calm` if no path specified; override via `file` parameter on any tool
- `.calmstudio.json` sidecar written alongside `.calm` with ELK-computed positions, viewport, extension pack references
- `.calm` stays pure CALM JSON (FINOS spec); `.calmstudio.json` is CalmStudio-specific visual metadata
- No file watching in v1 — reads on demand, external edits picked up on next tool call

### Distribution & config
- Published as `@calmstudio/mcp` on npm
- Install: `npm install -g @calmstudio/mcp` or use `npx @calmstudio/mcp`
- Built on `@modelcontextprotocol/sdk` (official TypeScript SDK) for protocol compliance and MCP Inspector compatibility
- Zero config — no config file needed; defaults work out of the box
- Extension packs auto-detected from `.calmstudio.json` if present
- Auto-publish on merge to main via semantic-release (existing CI/CD from Phase 1)

### Error handling
- Custom node types accepted (any string) — CALM spec allows it; renders as GenericNode
- Only reject truly malformed input: missing required fields, invalid JSON structure
- Dangling relationship references rejected with clear error listing available node IDs
- Tool responses return summary + affected IDs (not full CALM JSON) — keeps token usage low
- File system errors return MCP error responses with actionable human-readable messages (path + suggested fix)
- All errors use `isError: true` in MCP response content

### Claude's Discretion
- Exact tool input/output schemas (Zod definitions)
- SVG rendering style for diagram nodes (colors, fonts, spacing)
- ELK layout options for server-side rendering
- Internal code organization (tool handlers, file I/O layer, validation layer)
- read_calm_guide content structure and examples

</decisions>

<specifics>
## Specific Ideas

- Inspired by Excalidraw MCP's tool design: element CRUD, canvas management, file I/O, guidance tools — adapted for CALM concepts (nodes, relationships, architectures)
- Excalidraw MCP's `create_view` in Claude Cowork shows diagrams being built visually — CalmStudio should offer the same experience with architecture diagrams rendered as SVG
- Deep link `calmstudio://` mirrors Excalidraw's shareable URL pattern but opens in local desktop app instead of web
- Tool response design: concise summaries with node_id/counts (not full JSON dumps) to minimize token usage

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/mcp-server/` — empty stub package with package.json, tsconfig, .releaserc.json ready
- `packages/calm-core/src/types.ts` — all CALM types (CalmNode, CalmRelationship, CalmArchitecture, CalmInterface) already defined
- `apps/studio/src/lib/io/export.ts` — export functions (CALM JSON, SVG, PNG) for reference
- `apps/studio/src/lib/io/fileSystem.ts` — file I/O utilities (read/write patterns)

### Established Patterns
- Pure TypeScript for testability (projection.ts, elkLayout.ts) — MCP server tools should follow same pattern
- CALM JSON as canonical source of truth — MCP server reads/writes the same format
- `.calmstudio.json` sidecar for extension pack metadata — already decided pre-Phase 1

### Integration Points
- `packages/calm-core` — import CALM types for validation and type safety
- ELK.js — already used in Phase 4 for layout; reuse for server-side SVG rendering
- Semantic release — `.releaserc.json` already exists in mcp-server package

</code_context>

<deferred>
## Deferred Ideas

- Interactive iframe rendering in Claude Cowork (vs static SVG) — evaluate after v1 SVG works
- File watching for external changes — evaluate based on user feedback
- Web URL fallback for "open in CalmStudio" (hosted web viewer) — v2+
- Snapshot/restore tools (like Excalidraw's snapshot_scene/restore_snapshot) — evaluate need after usage
- Config file support (.calmstudiorc) — add if zero-config proves insufficient

</deferred>

---

*Phase: 05-mcp-server*
*Context gathered: 2026-03-12*
