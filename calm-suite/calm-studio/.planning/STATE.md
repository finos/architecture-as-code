---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Distribution & Developer Experience
status: verifying
stopped_at: Completed 13-embedding-visualization/13-02-PLAN.md
last_updated: "2026-03-24T04:18:07.667Z"
last_activity: "2026-03-15 — completed Phase 11: Tauri desktop app with native file I/O, menu, sidecar, CI"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 16
  completed_plans: 16
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Make architecture diagrams the source of truth — draw visually, get validated CALM code automatically, let AI generate architectures via MCP.
**Current focus:** Phase 12 — Developer Tooling (next)

## Current Position

Phase: 11 of 13 (Desktop App) — COMPLETE
Plan: 03 completed (CI workflow + checkpoint approved)
Status: Phase 11 complete — all 3 plans done, Tauri dev build verified
Last activity: 2026-03-15 — completed Phase 11: Tauri desktop app with native file I/O, menu, sidecar, CI

Progress: [█████░░░░░] 50%

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- [v1.1 roadmap]: Phase 12 splits user's "Ecosystem" group into Developer Tooling (VS Code + GitHub Action) and Embedding & Visualization (Web Component + Flow Viz) for cleaner delivery boundaries at fine granularity
- [10-01]: AJV is external (not bundled in dist) — consumers install it via package.json dependencies; tsup marks it external
- [10-01]: test-fixtures export removed from calm-core public API — internal-only, not for npm consumers
- [10-01]: release.yml unchanged — pnpm -r run build already covers calm-core now that build script runs tsup
- [Phase 10-docs-package-publish]: Docusaurus docs site scaffolded: typedoc 0.28.x for TS5.9 compat; out: docs/api for correct sidebar IDs; sidebars.ts loads typedoc-sidebar.cjs dynamically
- [10-03]: MADR 4.0 format adopted for ADRs — status/date/decision-makers frontmatter, 3 options, Good/Neutral/Bad consequences
- [10-03]: Contributing guide links to root governance files rather than duplicating content
- [Phase 11-desktop-app]: Tauri shell co-located in apps/studio/src-tauri/ (not separate apps/desktop/)
- [Phase 11-01]: fileHandle type widened to FileSystemFileHandle | string | null for backward compat with Tauri path-as-handle pattern
- [Phase 11-01]: readTextFile mockIPC must return byte array (Array.from Uint8Array), not raw strings — Tauri returns binary bytes
- [Phase 11-02]: MenuHandlers.openFromPath separate from open: dialog-based open and path-based recent file open are different flows
- [Phase 11-02]: plugin-store load() requires defaults field in StoreOptions alongside autoSave — missing defaults causes TypeScript error
- [Phase 11-03]: tauri-plugin-store and tauri-plugin-updater use Builder pattern, not init() — API mismatch from other Tauri plugins
- [Phase 11-03]: Tauri 2.10 requires explicit use tauri::{Emitter, Manager} trait imports for emit() and get_webview_window()
- [Phase 11-03]: externalBin validated at compile time — placeholder sidecar binary needed for local dev builds
- [Phase 12-developer-tooling]: renderArchitectureToSvg extracted as pure function in mcp-server — renderDiagram becomes thin file-reading wrapper
- [Phase 12-developer-tooling]: VS Code extension unit tests use vitest alias mock for vscode module — no @vscode/test-electron needed for pure function tests
- [Phase 12-developer-tooling]: Import renderArchitectureToSvg from @calmstudio/mcp/dist/tools/render.js — ncc cannot bundle TypeScript source outside rootDir
- [Phase 12-developer-tooling]: SVG committed to gh-diagrams branch — GitHub does not render inline SVG or base64 data URIs in PR comments
- [Phase 12-developer-tooling]: package.json name changed from '@calmstudio/vscode-extension' to 'calmstudio' — vsce rejects scoped package names
- [Phase 12-developer-tooling]: Type assertions used for vscode.lm and McpStdioServerDefinition — @types/vscode 1.99.0 missing these APIs
- [Phase 12-developer-tooling]: elkjs-svg marked external in MCP server bundle and copied to dist/mcp-server/node_modules at build time
- [Phase 14-opengris-extension-pack]: openGrisPack.id is 'opengris' (lowercase, no hyphens) — registry splits on ':' for namespace resolution
- [Phase 14-opengris-extension-pack]: Green color family (#f0fdf4 bg, #16a34a border) for OpenGRIS pack to differentiate from other packs
- [Phase 15]: [15-02] opengris template IDs use prefixes ogld/ogmr/ogsr/ogmc for unique-id uniqueness across CALM nodes
- [Phase 15]: [15-02] TCP protocol used for all ZeroMQ connections; customMetadata keys match exact TOML field names
- [Phase 15]: [15-01] opengris:worker nodes emit [worker] sections only when customMetadata is present
- [Phase 15]: [15-01] Hand-crafted TOML strings (no TOML library) - flat format sufficient for correctness
- [Phase 15]: [15-01] Address auto-derivation: scheduler port+1=storage, port+2=client via connects relationships
- [Phase 15]: $derived rune used for showScalerTomlExport in +page.svelte to ensure reactive re-evaluation when opengris nodes are added after page load
- [Phase 15]: vite.config.ts resolve.alias for @calmstudio/calm-core/test-fixtures unblocks Vitest - maps to TS source since package.json exports only exposes '.'
- [Phase 13-embedding-visualization]: CalmTransition/CalmFlow added to calm-core types.ts alongside CalmArchitecture for co-location
- [Phase 13-embedding-visualization]: Svelte 5 custom element uses shadow DOM open mode for CSS isolation; role=application+tabindex for a11y
- [Phase 13-embedding-visualization]: Bundle everything (no rollupOptions.external) for zero-dependency CDN use
- [Phase 13-embedding-visualization]: Flow overlay SVG group appended after node layer so animated dots are never subject to dimming
- [Phase 13-embedding-visualization]: edgeLayouts Map populated during edge render loop (single pass) reused for flow overlay
- [Phase 13-embedding-visualization]: Flow data injected via $effect into edges[]/nodes[] state arrays — same pattern as validation enrichment, avoids needing separate display arrays
- [Phase 13-embedding-visualization]: FlowOverlay is sibling to edge (not child) to avoid opacity: 0.3 inheritance from dimmed wrapper

### Roadmap Evolution

- Phase 14 added: OpenGRIS Extension Pack — FINOS OpenGRIS node types (scheduler, worker, worker-manager, client, object-storage, cluster, task-graph, parallel-function) for CalmStudio
- Phase 15 added: OpenGRIS Scaler.toml Exporter and Deployment Templates — CALM-to-TOML exporter plugin + starter templates (local dev, market risk, scientific research, multi-cloud)

### Blockers/Concerns

- [Research]: VS Code extension — audit existing `calm` Marketplace extension before building to determine extend vs rebuild
- [Research]: File watch latency for MCP-to-frontend state sharing on Windows needs empirical validation — Tauri IPC channel is the fallback

### Pending Todos

None yet.

## Session Continuity

Last session: 2026-03-23T06:34:39.070Z
Stopped at: Completed 13-embedding-visualization/13-02-PLAN.md
Resume file: None
