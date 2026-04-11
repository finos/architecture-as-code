# Roadmap: CalmStudio

## Overview

CalmStudio ships in 13 phases, each delivering a coherent, independently verifiable capability. The build order follows hard dependencies: governance and CI gate everything; the CALM canvas is the root dependency for all UI features; MCP server enables AI integration early; validation and extension packs enhance both the UI and MCP; C4 view mode adds hierarchical navigation after extension packs provide rich node types. Phases 1-4 deliver a standalone CALM-typed diagramming tool. Phases 5-8 add the AI-native differentiation (MCP, validation, extension packs, C4 views). Phases 9-13 complete the FINOS-ready ecosystem: testing and documentation come first (required for FINOS project acceptance), followed by calmscript DSL, desktop packaging, and ecosystem integrations.

CalmStudio is part of the Calm platform — an open-source FINOS ecosystem alongside CalmGuard (architecture governance). IaC generation, CI/CD policy enforcement, and compliance analysis are CalmGuard's responsibility, not CalmStudio's. `@calmstudio/calm-core` serves as the shared foundation consumed by both products.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Governance** - Project skeleton, Apache 2.0 licensing, FINOS governance files, and CI/CD pipeline (completed 2026-03-11)
- [ ] **Phase 2: CALM Canvas Core** - Typed drag-and-drop canvas with all 9 CALM node types, 5 relationship types, and table-stakes UX
- [x] **Phase 3: Properties & Bidirectional Sync** - Properties panel, CALM JSON code editor, and bidirectional visual-to-code sync engine (completed 2026-03-12)
- [x] **Phase 4: Import, Export & Layout** - CALM JSON import with ELK auto-layout, file export (CALM JSON, calmscript, SVG, PNG), and native file I/O (completed 2026-03-14)
- [x] **Phase 5: MCP Server** - Standalone MCP server enabling Claude Code and AI assistants to create/modify/validate architectures via structured tool calls (completed 2026-03-12)
- [x] **Phase 6: CALM Validation** - Real-time schema validation with inline indicators and severity panel (completed 2026-03-12)
- [x] **Phase 7: Extension Packs** - Dynamic pack system with AWS, GCP, Azure, Kubernetes, and AI/Agentic node types (completed 2026-03-13)
- [x] **Phase 8: C4 View Mode** - Hierarchical C4 navigation (Context, Container, Component) as zoom levels over CALM architectures (completed 2026-03-13)
- [ ] **Phase 8.1: FluxNova Templates & AIGF Governance** - FluxNova extension pack, architecture templates, CALM controls, AIGF governance panel and validation rules (INSERTED — OSFF Toronto demo April 13-14)
- [ ] **Phase 9: Testing Suite** - Comprehensive London School TDD — unit, integration, E2E, and component tests (moved up from Phase 12 — required for FINOS project acceptance)
- [ ] **Phase 10: Documentation & calm-core Publish** - Docusaurus documentation site, ADRs, and publish `@calmstudio/calm-core` as standalone package for CalmGuard and community consumers
- [ ] **Phase 11: calmscript DSL** - Mermaid-competitive text format that compiles losslessly to CALM JSON and back (deferred from original Phase 5 — evaluate need after MCP usage)
- [ ] **Phase 12: Desktop App** - Tauri 2 packaging for macOS, Windows, and Linux with native file dialogs
- [ ] **Phase 13: Ecosystem** - VS Code extension, GitHub Action for diagram rendering, web component, and flow visualization

## Phase Details

### Phase 1: Foundation & Governance
**Goal**: Project is governed, licensed, and gated by CI so every contribution from day one is FINOS-ready
**Depends on**: Nothing (first phase)
**Requirements**: GOVN-01, GOVN-02, GOVN-03, GOVN-04, GOVN-05, GOVN-06, GOVN-07, GOVN-08, CICD-01, CICD-02, CICD-03, CICD-04, CICD-05, CICD-06
**Success Criteria** (what must be TRUE):
  1. Every source file carries an Apache 2.0 SPDX header and a PR fails CI if a file is missing one
  2. A contributor can submit a PR and DCO verification runs automatically, blocking merge without sign-off
  3. All five FINOS governance files exist (CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, NOTICE, MAINTAINERS.md) and are linked from the README
  4. A git push triggers GitHub Actions: build, lint, test, license scan, CVE scan, and commitlint all run and report status
  5. Semantic release runs on merge to main and produces a versioned changelog entry
**Plans:** 2/2 plans complete
Plans:
- [ ] 01-01-PLAN.md — Monorepo scaffold, FINOS governance files, REUSE/SPDX licensing, commitlint + husky
- [ ] 01-02-PLAN.md — GitHub Actions CI/CD pipeline, semantic release, DCO App setup

### Phase 2: CALM Canvas Core
**Goal**: An architect can drag CALM-typed nodes onto a canvas, connect them with typed relationships, and navigate the diagram with professional UX
**Depends on**: Phase 1
**Requirements**: CANV-01, CANV-02, CANV-03, CANV-04, CANV-05, CANV-06, CANV-07, CANV-08, CANV-09, CALM-01, CALM-02, CALM-03, CALM-04, CALM-05, CALM-06
**Success Criteria** (what must be TRUE):
  1. User can drag any of the 9 CALM node types from a palette onto the canvas and each renders as a distinct visual component
  2. User can draw a typed edge between two nodes and the edge style reflects its CALM relationship type (connects, interacts, deployed-in, composed-of, options)
  3. User can select multiple nodes, move, resize, and delete them, and undo/redo every action with Cmd+Z/Cmd+Shift+Z
  4. Containment relationships (deployed-in, composed-of) render as Svelte Flow sub-flows with parent-child visual nesting
  5. User can toggle dark mode and light mode, and zoom, pan, and search nodes by name or type
**Plans:** 3/6 plans executed
Plans:
- [ ] 02-00-PLAN.md — Wave 0: Test infrastructure (Vitest + Playwright) and stub test files
- [ ] 02-01-PLAN.md — Scaffold SvelteKit app, install Svelte Flow + Tailwind, define CALM core types
- [ ] 02-02-PLAN.md — Create 11 custom node components (9 CALM types + GenericNode + ContainerNode) with distinct shapes
- [ ] 02-03-PLAN.md — Create 5 custom edge components with distinct line styles and SVG markers
- [ ] 02-04-PLAN.md — Wire canvas, palette (DnD + click-to-place), edge creation, and containment sub-flows
- [ ] 02-05-PLAN.md — Add undo/redo, copy/paste, dark mode, search, keyboard shortcuts, and visual verification

### Phase 3: Properties & Bidirectional Sync
**Goal**: Editing properties in the panel or CALM JSON in the code editor both update the diagram, with no infinite loops
**Depends on**: Phase 2
**Requirements**: PROP-01, PROP-02, PROP-03, PROP-04, PROP-05, SYNC-01, SYNC-02, SYNC-03, SYNC-04, CODE-01, CODE-02, CODE-03
**Success Criteria** (what must be TRUE):
  1. User can select a node and edit its CALM metadata (unique-id, name, description, type, interfaces, controls) in a properties panel and see the canvas update immediately
  2. User can edit CALM JSON directly in the code panel and the diagram updates to reflect the change without a full reload
  3. Editing the canvas (moving a node, adding an edge) updates the CALM JSON in the code panel in real time
  4. Rapid back-and-forth edits between canvas and code panel never cause an infinite update loop or UI freeze
  5. User can toggle the code panel between CALM JSON and calmscript views
**Plans:** 5/5 plans complete
Plans:
- [ ] 03-00-PLAN.md — TDD: CALM model store, projection functions, direction mutex, property mutations
- [ ] 03-01-PLAN.md — Install deps, CodeMirror code panel, paneforge resizable layout
- [ ] 03-02-PLAN.md — Properties panel components (node, edge, interfaces, custom metadata)
- [ ] 03-03-PLAN.md — Wire bidirectional sync engine (forward + reverse + selection scroll)
- [ ] 03-04-PLAN.md — Visual verification of complete Phase 3 deliverable

### Phase 4: Import, Export & Layout
**Goal**: Architects can bring existing CALM JSON into the tool, arrange it automatically, and export diagrams in any format they need
**Depends on**: Phase 3
**Requirements**: IOEX-01, IOEX-02, IOEX-03, IOEX-04, IOEX-05, IOEX-06, LAYT-01, LAYT-02, LAYT-03
**Success Criteria** (what must be TRUE):
  1. User can open an existing CALM JSON file and the diagram renders with ELK hierarchical auto-layout applied
  2. User can save and reload a diagram and all nodes, edges, and CALM metadata are preserved exactly
  3. User can trigger auto-layout and nodes arrange cleanly; pinned nodes stay in place
  4. User can export a diagram as CALM JSON, calmscript, SVG, or PNG and the exported file opens correctly in external tools
  5. CALM JSON files from the FINOS `architecture-as-code` examples directory import without data loss
**Plans:** 5/5 plans complete
Plans:
- [ ] 04-00-PLAN.md — Install deps (elkjs, html-to-image), create test stubs for ELK layout and file system
- [ ] 04-01-PLAN.md — ELK layout engine, CALM JSON import, drag-and-drop, auto-layout button, pin toggle
- [ ] 04-02-PLAN.md — File I/O (open, save, save-as), dirty state store, export functions (CALM JSON, SVG, PNG, calmscript)
- [ ] 04-03-PLAN.md — Toolbar component, keyboard shortcuts, beforeunload, wire all features into page
- [ ] 04-04-PLAN.md — Visual verification checkpoint

### Phase 5: MCP Server
**Goal**: Claude Code and any MCP-compatible AI assistant can create, modify, and export CALM architectures through structured tool calls
**Depends on**: Phase 4
**Requirements**: MCPS-01, MCPS-02, MCPS-03, MCPS-04, MCPS-05, MCPS-06, MCPS-07
**Success Criteria** (what must be TRUE):
  1. User can install the MCP server via `npm install -g @calmstudio/mcp` and register it in Claude Code's MCP config
  2. Claude Code can create a complete 5-node architecture from a text description using the `create_architecture` tool, producing valid CALM JSON
  3. Claude Code can add nodes, add relationships, export/import CALM files, and render to SVG through dedicated MCP tools
  4. All MCP tools pass MCP Inspector compliance validation and return properly structured `content` responses
  5. The MCP server works without the desktop app running — it operates on `.calm` files directly
**Plans:** 4/4 plans complete
Plans:
- [ ] 05-00-PLAN.md — Package setup, deps, build pipeline, Zod schemas, file I/O layer, validation, test stubs
- [ ] 05-01-PLAN.md — Architecture CRUD, node CRUD, relationship CRUD, and file I/O tool handlers
- [ ] 05-02-PLAN.md — Validate, render, guide, view tools + server wiring + CLI entry point with dual transport
- [ ] 05-03-PLAN.md — End-to-end integration test + MCP Inspector compliance verification

### Phase 6: CALM Validation
**Goal**: Architects get immediate, precise feedback when their diagram violates the CALM schema
**Depends on**: Phase 5
**Requirements**: VALD-01, VALD-02, VALD-03
**Success Criteria** (what must be TRUE):
  1. Nodes and edges with CALM schema violations show inline error indicators on the canvas without any user action
  2. A validation panel lists all errors, warnings, and info messages with severity levels and the offending node/edge identified
  3. Validation runs automatically after each edit with a debounce and never blocks typing or canvas interaction
**Plans:** 3/3 plans complete
Plans:
- [ ] 06-00-PLAN.md — Install Ajv, bundle CALM 2025-03 schemas, create shared validation engine in calm-core with tests
- [ ] 06-01-PLAN.md — Validation store (debounced reactive), ValidationBadge component, wire badges into all 11 node components and color overrides into all 5 edge components
- [ ] 06-02-PLAN.md — ValidationPanel bottom drawer, +page.svelte enrichment wiring, two-way navigation, MCP server upgrade to shared engine, visual verification

### Phase 7: Extension Packs
**Goal**: Architects can diagram AWS, GCP, Azure, Kubernetes, and AI/Agentic architectures with domain-specific node types that produce valid CALM output
**Depends on**: Phase 6
**Requirements**: EXTK-01, EXTK-02, EXTK-03, EXTK-04, EXTK-05, EXTK-06, EXTK-07, EXTK-08
**Success Criteria** (what must be TRUE):
  1. User can select AWS, GCP, Azure, Kubernetes, or AI/Agentic node types from a palette organized by pack, with icons and colors distinct per pack
  2. Diagrams using extension pack node types pass `calm validate` without modification
  3. Extension pack metadata is stored in a `.calmstudio.json` sidecar file and never embedded in the `.calm` JSON
  4. A diagram created with extension pack nodes exports valid CALM JSON that round-trips correctly through import
**Plans:** 4/4 plans complete
Plans:
- [ ] 07-00-PLAN.md — Types, PackRegistry, Core CALM pack, test infrastructure for extensions package
- [ ] 07-01-PLAN.md — AWS, GCP, Azure, Kubernetes, AI/Agentic pack definitions with SVG icons
- [ ] 07-02-PLAN.md — ExtensionNode component, resolveNodeType extension, NodePalette refactor with collapsible pack sections
- [ ] 07-03-PLAN.md — App startup wiring, projection round-trip tests, sidecar file I/O, visual verification

### Phase 8: C4 View Mode
**Goal**: Architects can navigate CALM architectures at C4 zoom levels (Context, Container, Component), drilling into systems to see internal structure without losing the big picture
**Depends on**: Phase 7 (Extension Packs — richer node types make C4 views more valuable)
**Requirements**: C4VM-01, C4VM-02, C4VM-03, C4VM-04, C4VM-05
**Success Criteria** (what must be TRUE):
  1. User can switch between C4 levels (Context, Container, Component) via a view selector and the canvas filters to show only nodes appropriate to that level
  2. User can double-click a system node at Context level to drill down into its Container view, showing children linked via `composed-of` or `deployed-in` relationships
  3. User can drill from Container into Component level for any container node, and a breadcrumb trail shows the navigation path (e.g., "All Systems > Payment System > API Gateway")
  4. C4 view mode is a read/navigate overlay — the underlying CALM JSON is unchanged and all edits still go through the normal canvas/properties/code workflows
  5. C4 styling conventions are applied per level (e.g., external systems greyed out at Context level, internal containers highlighted at Container level)
**Plans:** 3/3 plans complete
Plans:
- [ ] 08-01-PLAN.md — C4 filter pure functions, C4 state store, unit tests
- [ ] 08-02-PLAN.md — CalmCanvas readonly mode, Toolbar segmented control, C4Breadcrumb component
- [ ] 08-03-PLAN.md — +page.svelte wiring, PropertiesPanel readonly, visual verification

### Phase 08.1: FluxNova Templates & AIGF Governance (INSERTED)

**Goal:** FluxNova extension pack, architecture templates with picker UI, CALM 1.2 controls/decorators/evidence support, AIGF risk/mitigation governance panel with live scoring, and AIGF validation rules — targeting OSFF Toronto demo April 13-14
**Requirements**: FLXN-01, FLXN-02, FLXN-03, TMPL-01, TMPL-02, TMPL-03, CTRL-01, CTRL-02, CTRL-03, AIGF-01, AIGF-02, AIGF-03, AIGF-04, AIGF-05
**Depends on:** Phase 8
**Success Criteria** (what must be TRUE):
  1. FluxNova extension pack appears in the NodePalette with 10 node types (including container), all drag-droppable with correct icons and orange/amber colors
  2. Template picker (full-screen modal with category tabs) loads all 6 FluxNova templates onto the canvas, accessible from toolbar button and empty canvas link
  3. CALM 1.2 controls are visible and editable in both NodeProperties and EdgeProperties as collapsible sections; data-classification renders as colored tags on canvas nodes
  4. AIGF governance panel (right sidebar tab) shows applicable risks and mitigations for selected AI nodes with "Apply mitigation" adding CALM controls; architecture-level governance score displays in panel header and toolbar badge
  5. AIGF validation rules fire in ValidationPanel alongside structural rules; governance decorator auto-generated on CALM JSON export
**Plans:** 5/5 plans complete

Plans:
- [ ] 08.1-01-PLAN.md — CALM 1.2 types (controls, decorators, evidence) + AIGF data package with node-to-risk mappings
- [ ] 08.1-02-PLAN.md — FluxNova extension pack: 10 node types, SVG icons, pack registration
- [ ] 08.1-03-PLAN.md — Template system: 4 new templates, registry, full-screen picker modal, toolbar + page wiring
- [ ] 08.1-04-PLAN.md — Controls UI in properties panel, data-classification canvas badges, AIGF validation rules
- [ ] 08.1-05-PLAN.md — Governance panel (right sidebar tab), live score store, toolbar badge, decorator export

### Phase 9: Testing Suite
**Goal**: Every feature has outside-in tests at the appropriate level so regressions are caught before they reach users — required for FINOS project acceptance
**Depends on**: Phase 8
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Moved from**: Original Phase 12 — FINOS project acceptance requires comprehensive test coverage. Testing before documentation ensures docs describe tested behavior.
**Success Criteria** (what must be TRUE):
  1. The sync engine, CALM model, CALM validation, and C4 filtering each have unit tests that run in under 30 seconds
  2. Integration tests cover bidirectional sync, MCP server tool calls, and extension pack loading end-to-end
  3. Playwright E2E tests cover the full create-diagram, edit-code, export, and import workflows
  4. Every custom Svelte node and edge component has component-level tests via @testing-library/svelte
**Plans:** 4/5 plans executed

Plans:
- [ ] 09-01-PLAN.md — Coverage infrastructure: install @vitest/coverage-v8, configure tiered thresholds, shared test fixtures
- [ ] 09-02-PLAN.md — Unit tests for untested stores (validation, governance, c4State, export, templates) + sync integration
- [ ] 09-03-PLAN.md — Component tests for 7 interactive panels (NodeProperties, EdgeProperties, ControlsList, GovernancePanel, TemplatePicker, ValidationPanel, Toolbar)
- [ ] 09-04-PLAN.md — E2E tests: 4 Playwright workflows (core diagram, template+governance, C4 navigation, validation)
- [ ] 09-05-PLAN.md — CI coverage wiring, E2E CI job, coverage badge on README

### Phase 10: Documentation & calm-core Publish
**Goal**: Contributors and users have comprehensive documentation, and `@calmstudio/calm-core` is published as a standalone package for CalmGuard and community consumers
**Depends on**: Phase 9
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, CORE-01
**Moved from**: Original Phase 11 (Pattern Library & Documentation) — documentation moved up for FINOS readiness. Pattern Library deferred to Phase 12 stretch goal.
**Success Criteria** (what must be TRUE):
  1. A Docusaurus site is live with getting started guide, extension pack development guide, MCP usage guide, and contributor guide
  2. Architecture Decision Records exist in `docs/` for all key decisions logged in PROJECT.md
  3. `@calmstudio/calm-core` is published to npm with its own README, API documentation, versioned independently, and consumable by external projects (CalmGuard, community tools)
  4. The calm-core public API is documented with TypeDoc or equivalent, covering CALM types, validation, and parsing
**Plans:** 0/TBD

### Phase 11: calmscript DSL
**Goal**: Architects and AI tools can describe an architecture in ~20 lines of text that compiles losslessly to and from CALM JSON
**Depends on**: Phase 10 (benefits from Phases 5-8 being complete)
**Requirements**: CSPT-01, CSPT-02, CSPT-03, CSPT-04, CSPT-05, CSPT-06
**Deferred from**: Original Phase 5 — MCP Server (structured tool calls) solves AI generation more reliably. calmscript value to be evaluated after real-world MCP usage. Context captured in phases/08-calmscript-dsl/08-CONTEXT.md.
**Success Criteria** (what must be TRUE):
  1. A 5-node architecture with typed relationships, interfaces, and controls is expressible in 20 lines or fewer of calmscript
  2. Compiling calmscript to CALM JSON and back to calmscript produces identical output (round-trip lossless)
  3. calmscript supports all CALM concepts: nodes, relationships, interfaces, controls, flows, metadata, and extension pack imports (`@use aws`)
  4. The CodeMirror calmscript editor provides syntax highlighting and shows inline error indicators for invalid syntax
  5. The calmscript parser runs in a Web Worker and does not block keystrokes even on large architectures
**Plans:** 0/TBD

### Phase 12: Desktop App
**Goal**: CalmStudio ships as a native desktop application on macOS, Windows, and Linux with native file system access
**Depends on**: Phase 11
**Requirements**: DESK-01, DESK-02, DESK-03
**Moved from**: Original Phase 10 — web version is sufficient for FINOS acceptance and initial adoption. Desktop packaging is polish, not a prerequisite.
**Success Criteria** (what must be TRUE):
  1. User can download and install CalmStudio on macOS, Windows, and Linux and launch it without installing Node.js or any runtime
  2. User can open and save `.calm` and `.calmscript` files using native file dialogs (not a browser file picker)
  3. CalmStudio works fully offline with no network requests required for core diagramming functionality
**Plans:** 0/TBD

### Phase 13: Ecosystem
**Goal**: CalmStudio reaches developers in their existing tools — VS Code, GitHub PRs, and any web page — and flow visualization completes the architecture story
**Depends on**: Phase 12
**Requirements**: ECOS-01, ECOS-02, ECOS-03, ECOS-04
**Success Criteria** (what must be TRUE):
  1. A VS Code extension is installable from the Marketplace and renders a live calmscript preview alongside the editor
  2. A GitHub Action renders CALM architecture diagrams as SVG images in PR comments (CALM validation in CI is CalmGuard's responsibility via `calmguard check`)
  3. A `<calm-diagram>` web component is installable via npm and renders any CALM JSON in any web page with a single HTML tag
  4. User can enable flow visualization and see data flows as stepped overlays on existing architecture edges
**Plans:** 0/TBD

### Pattern Library (Stretch Goal)
**Goal**: Architects can start from proven architecture templates
**Depends on**: Phase 10 (Documentation)
**Requirements**: PATN-01, PATN-02, PATN-03
**Note**: Separated from Documentation phase. Can be built at any point after Phase 10 or contributed by the FINOS community. Not blocking v1 release.
**Success Criteria** (what must be TRUE):
  1. User can browse architecture patterns by category and instantiate any pattern as an editable diagram with auto-layout applied
  2. The five bundled patterns (aws/microservices-eks, aws/serverless-api, kubernetes/standard-deployment, ai/rag-pipeline, ai/multi-agent) load and pass `calm validate`
**Plans:** 0/TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Governance | 2/2 | Complete    | 2026-03-11 |
| 2. CALM Canvas Core | 3/6 | In Progress|  |
| 3. Properties & Bidirectional Sync | 5/5 | Complete   | 2026-03-12 |
| 4. Import, Export & Layout | 5/5 | Complete   | 2026-03-14 |
| 5. MCP Server | 4/4 | Complete   | 2026-03-12 |
| 6. CALM Validation | 3/3 | Complete   | 2026-03-12 |
| 7. Extension Packs | 4/4 | Complete   | 2026-03-13 |
| 8. C4 View Mode | 3/3 | Complete   | 2026-03-15 |
| 8.1 FluxNova & AIGF | 0/5 | Not started | - |
| 9. Testing Suite | 4/5 | In Progress|  |
| 10. Documentation & calm-core Publish | 0/TBD | Not started | - |
| 11. calmscript DSL | 0/TBD | Not started (deferred) | - |
| 12. Desktop App | 0/TBD | Not started | - |
| 13. Ecosystem | 0/TBD | Not started | - |
| Pattern Library (stretch) | 0/TBD | Not started | - |
