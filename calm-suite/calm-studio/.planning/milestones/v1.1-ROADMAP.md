# Roadmap: CalmStudio

## Milestones

- ✅ **v1.0 MVP** - Phases 1-9 + 8.1 (shipped 2026-03-15)
- 🚧 **v1.1 Distribution & Developer Experience** - Phases 10-13 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9 + 8.1) - SHIPPED 2026-03-15</summary>

**Stats:** 220 commits, 338 files, 30K LOC (TypeScript/Svelte), 5 days (2026-03-11 → 2026-03-15)

**Key accomplishments:**
- Svelte Flow canvas with all 9 CALM node types, 5 relationship types, containment, and C4 view mode
- Bidirectional CALM JSON sync engine with direction mutex
- 7 extension packs: Core, AWS, GCP, Azure, Kubernetes, AI/Agentic, FluxNova
- MCP server with 21 tools for AI-assisted architecture generation
- AIGF v2.0 governance: 23 risks, 23 mitigations, live scoring, 10 validation rules
- 6 FluxNova architecture templates with controls and data classification
- ELK.js auto-layout, CALM JSON import/export, SVG/PNG export
- 387 tests (unit, integration, component, E2E) with vitest + Playwright
- CALM spec-aligned domain-oriented control keys with AIR-ID mapping

Phases: 01-foundation-governance, 02-calm-canvas-core, 03-properties-bidirectional-sync, 04-import-export-layout, 05-mcp-server, 06-calm-validation, 07-extension-packs, 08-c4-view-mode, 08.1-fluxnova-templates-aigf-governance, 09-testing-ci

</details>

### Phase 14: OpenGRIS Extension Pack

**Goal:** Architects modeling OpenGRIS-based distributed grid computing systems can use native node types on the CalmStudio canvas with proper icons, colors, and container semantics
**Requirements**: OGRIS-01, OGRIS-02, OGRIS-03
**Depends on:** Phase 7 (extension pack system)
**Plans:** 1/1 plans complete

Plans:
- [ ] 14-01-PLAN.md — Add OpenGRIS pack with 8 node types, icons, tests, and registration

### Phase 15: OpenGRIS Scaler.toml Exporter and Deployment Templates

**Goal:** Architects can export CALM architectures with OpenGRIS nodes as Scaler.toml configuration files and start from turnkey deployment templates covering local dev, market risk, scientific research, and multi-cloud patterns
**Requirements**: TOML-01, TOML-02, TOML-03, TOML-04
**Depends on:** Phase 14
**Plans:** 3/3 plans complete

Plans:
- [ ] 15-01-PLAN.md — TDD: buildScalerToml pure TOML builder with full test coverage
- [ ] 15-02-PLAN.md — Create 4 OpenGRIS deployment templates and register in template system
- [ ] 15-03-PLAN.md — Wire export UI, conditional toolbar, demo file, and full integration

---

### 🚧 v1.1 Distribution & Developer Experience (In Progress)

**Milestone Goal:** Reach developers where they are — documentation, desktop app, IDE, CI, and web embedding.

## Phases

- [x] **Phase 10: Docs & Package Publish** - Docusaurus documentation site live and calm-core published to npm (completed 2026-03-15)
- [x] **Phase 11: Desktop App** - Tauri 2 native app builds and runs on macOS, Windows, and Linux (completed 2026-03-15)
- [x] **Phase 12: Developer Tooling** - VS Code extension on Marketplace and GitHub Action rendering CALM diagrams in PRs (completed 2026-03-16)
- [x] **Phase 13: Embedding & Visualization** - Web component usable in any framework and flow visualization on canvas edges (completed 2026-03-23)

## Phase Details

### Phase 10: Docs & Package Publish
**Goal**: Developers can find CalmStudio documentation and consume calm-core as a standalone library
**Depends on**: Phase 9 (v1.0 shipped)
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, CORE-01
**Success Criteria** (what must be TRUE):
  1. A visitor to the documentation site can follow a getting started guide and load CalmStudio from zero
  2. A developer can look up any public calm-core API in the hosted reference documentation
  3. A contributor can read the contribution guide, run the test suite, and open a compliant PR without asking for help
  4. An external developer can install `@calmstudio/calm-core` from npm and import its types and validators in their own project
  5. All key v1.0 architectural decisions are recorded as searchable ADRs in the documentation site
**Plans:** 3/3 plans complete
Plans:
- [ ] 10-01-PLAN.md — Configure calm-core for npm publishing with tsup dual ESM+CJS build
- [ ] 10-02-PLAN.md — Scaffold Docusaurus site with FINOS branding, TypeDoc, and deploy workflow
- [ ] 10-03-PLAN.md — Write all documentation content: guides, ADRs, architecture overview

### Phase 11: Desktop App
**Goal**: Architects can run CalmStudio as a native desktop application with full filesystem access and no browser required
**Depends on**: Phase 10
**Requirements**: DESK-01, DESK-02, DESK-03
**Success Criteria** (what must be TRUE):
  1. A user on macOS, Windows, or Linux can download and launch the CalmStudio desktop app without installing a browser or Node.js
  2. A user can open a .calm.json file from their local filesystem using the native OS file picker
  3. A user can save changes to a .calm.json file using the native OS save dialog, with no network request required
**Plans:** 3/3 plans complete
Plans:
- [ ] 11-01-PLAN.md — Scaffold Tauri 2 shell and implement native file I/O with isTauri() routing
- [ ] 11-02-PLAN.md — Wire native menu bar, recent files, drag-drop, MCP sidecar, and auto-updater
- [ ] 11-03-PLAN.md — Configure MCP sidecar binary build and cross-platform CI release workflow

### Phase 12: Developer Tooling
**Goal**: Developers can preview CALM architecture diagrams in VS Code and have diagrams automatically rendered in GitHub PR comments
**Depends on**: Phase 10
**Requirements**: VSCE-01, VSCE-02, VSCE-03, VSCE-04, VSCE-05, GHAC-01
**Success Criteria** (what must be TRUE):
  1. A developer can install the CalmStudio extension from the VS Code Marketplace and immediately see a live diagram preview for any open .calm.json file
  2. When a developer saves a .calm.json file, the preview panel updates automatically without any manual refresh
  3. A developer can click "Open in CalmStudio" in VS Code and the diagram opens in the desktop app or web URL
  4. A repository maintainer can add the CalmStudio GitHub Action to a workflow and see CALM architecture diagrams rendered as SVG images in PR comments
  5. VS Code registers the MCP server automatically, making CALM architecture tools available to Copilot and Claude Code
**Plans:** 3/3 plans complete
Plans:
- [ ] 12-01-PLAN.md — Extract renderArchitectureToSvg, scaffold packages, implement VS Code preview panel
- [ ] 12-02-PLAN.md — Implement GitHub Action with PR comment rendering and validation
- [ ] 12-03-PLAN.md — Add MCP registration, Open in CalmStudio, and VSIX packaging

### Phase 13: Embedding & Visualization
**Goal**: Any developer can embed a CALM diagram in a webpage with a single HTML tag, and architects can visualize data flows as animated overlays on canvas edges
**Depends on**: Phase 10
**Requirements**: WEBC-01, WEBC-02, FLOW-01
**Success Criteria** (what must be TRUE):
  1. A developer can add `<calm-diagram src="arch.calm.json">` to any HTML page and see a rendered CALM architecture diagram without any framework or build tool
  2. A developer can install the web component via npm and use it inside a React, Vue, Angular, or SvelteKit application
  3. An architect can enable flow visualization on a CALM diagram and see data flows displayed as stepped animated overlays on the relevant architecture edges
**Plans:** 3/3 plans complete

Plans:
- [ ] 13-01-PLAN.md — Add flow types to calm-core, scaffold web-component package, implement ELK SVG renderer with pack support
- [ ] 13-02-PLAN.md — Add flow visualization to studio: flow state store, FlowOverlay component, toolbar selector, edge/node dimming
- [ ] 13-03-PLAN.md — Add flow overlay to web component SVG renderer, integration checkpoint

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12 → 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Docs & Package Publish | 3/3 | Complete    | 2026-03-15 | - |
| 11. Desktop App | 3/3 | Complete   | 2026-03-15 | - |
| 12. Developer Tooling | 3/3 | Complete    | 2026-03-16 | - |
| 13. Embedding & Visualization | 3/3 | Complete    | 2026-03-24 | - |
