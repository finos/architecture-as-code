# Project Research Summary

**Project:** CalmStudio
**Domain:** Visual architecture diagramming tool with CALM-native semantics, bidirectional code-canvas sync, custom DSL, and MCP server
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

CalmStudio is a CALM-native visual architecture editor — a category that does not yet exist in any mature form. The closest competitors (Structurizr for C4, IcePanel for C4, Eraser.io for freeform) all lack the critical combination: semantically typed nodes, a human-writable DSL, and bidirectional visual-to-code synchronization. The recommended approach is to treat CALM JSON as the single canonical source of truth and derive all other representations (Svelte Flow canvas, calmscript text, validation state) from it. This architecture pattern is proven by Structurizr (single model, multiple views) and IcePanel (positions stored separately from semantics), but CalmStudio adds bidirectionality that neither tool supports. The core technology stack — Svelte 5 + SvelteKit 2 + @xyflow/svelte 1.x + Tauri 2 — is production-stable, with all versions verified and specifically chosen for interoperability.

The central engineering challenge is the bidirectional sync engine. Every feature of value (calmscript DSL, MCP server, CALM validation, extension packs) sits on top of a correctly implemented sync engine. If the sync engine allows reactive loops or bypasses the canonical CALM JSON store, the entire system becomes unmaintainable. Research from Pitfalls is unambiguous: the sync engine must be designed as a unidirectional translation layer with a single `applyCALMUpdate` entry point, with an `isApplying` guard preventing cascade. This architecture decision must be made and locked in Phase 1, before adding the code editor or any other subsystem.

The MCP server is the primary differentiator for AI-native adoption. No competitor ships a semantics-aware MCP server for architecture diagramming. The calmscript DSL is what makes this viable: 20 lines of calmscript is AI-generatable in a single context window; 462 lines of raw CALM JSON is not. The build order matters: calmscript must be stable before MCP; MCP must be stable before CI/CD integration. Extension packs (AWS, GCP, K8s, AI/Agentic) are the enterprise hook, but they must be implemented as data registries (not arbitrary code), with metadata stored in a companion `.calmstudio.json` file rather than embedded in CALM JSON, or every diagram will fail `calm validate`.

## Key Findings

### Recommended Stack

The stack is production-ready and well-integrated. Svelte 5 with @xyflow/svelte 1.5.1 (a complete Svelte 5 rewrite released May 2025) is the correct node-graph canvas — the only production-grade option with native Svelte 5 rune support. Tauri 2 provides the desktop shell with a 600KB Rust binary versus Electron's 50MB footprint, which matters for a tool that architects will install on every developer machine. The two-layer parsing strategy (Lezer grammar for CodeMirror syntax highlighting + Chevrotain parser for runtime calmscript compilation) is non-obvious but correct: Lezer handles the editor experience at build time, Chevrotain handles the semantic transform at runtime. These are independent and tested separately.

**Core technologies:**
- **Svelte 5 + SvelteKit 2:** UI framework — runes-based reactivity is leaner than React signals; SPA mode with `adapter-static` and `ssr = false` is required for Tauri
- **@xyflow/svelte 1.5.1:** Node-graph canvas — only production-grade option with Svelte 5 native support; includes subflows for CALM containment and ELK integration
- **Tauri 2.10.3:** Desktop app shell — 600KB Rust binary, native file I/O, cross-platform (macOS/Windows/Linux); Tauri 1 `@tauri-apps/api/fs` was removed in v2; use `@tauri-apps/plugin-fs`
- **Chevrotain 11.2.0:** calmscript runtime parser — pure TypeScript, typed CST, fastest pure-JS parser; Mermaid uses it; avoids WASM/Rust toolchain of tree-sitter
- **Lezer grammar + CodeMirror 6:** Editor syntax highlighting — compile-time grammar for incremental parsing; `@lezer/generator` compiles `.grammar` at build time
- **elkjs 0.11.1:** Auto-layout — actively maintained (Dagre is unmaintained since 2021); supports ports critical for CALM interface nodes; must run in Web Worker
- **AJV 8.17.1:** CALM schema validation — handles JSON Schema draft-2020-12 which CALM uses; external JSON files from FINOS; use `strict: false` for CALM's `$schema` declarations
- **@modelcontextprotocol/sdk 1.24.1:** MCP server — official Anthropic TypeScript SDK; use `StdioServerTransport` for Claude Code; never use `console.log()` in stdio MCP (corrupts JSON-RPC)

### Expected Features

Features research is based on direct competitive analysis of 8 tools (draw.io, Lucidchart, Structurizr, IcePanel, Eraser.io, Ilograph, Cloudcraft, Mermaid). CalmStudio is the only tool combining CALM semantics + bidirectional sync + AI-native MCP integration. See `.planning/research/FEATURES.md` for the full competitor matrix.

**Must have (table stakes):**
- Drag-and-drop canvas with CALM-typed node palette (9 node types, 5 relationship types) — users expect this from every diagramming tool
- Properties panel exposing CALM fields (label, unique-id, interfaces, controls, metadata) — required to produce valid CALM output
- Bidirectional visual-to-CALM-JSON sync — the core value proposition; nothing else matters without this
- calmscript DSL with parser and compiler — prerequisite for MCP and AI adoption; 20 lines vs 462 lines of JSON
- Real-time CALM schema validation with inline indicators — instant feedback distinguishes a CALM tool from a generic canvas
- CALM JSON import with auto-layout (ELK) + export — onboards existing CALM users; enables round-tripping
- Export PNG and SVG — sharing diagrams in docs, PRs, wikis
- Undo/redo, keyboard shortcuts, zoom/pan, multi-select — missing these makes the product feel broken
- Desktop app (Tauri 2) with native file system — architecture-as-code must live in the repo, not a SaaS

**Should have (competitive differentiators, v1.x):**
- Extension packs (AWS, GCP, Azure, Kubernetes, AI/Agentic) — critical for enterprise adoption; trigger: first enterprise customer asks "where are the AWS icons?"
- MCP server for Claude Code integration — no competitor has this; trigger: calmscript stable
- Pattern library with CALM-native templates — trigger: users ask "how do I start?"
- Containment visualization (deployed-in / composed-of as nested sub-flows)
- Flow visualization (data flows as stepped overlays on architecture edges)
- CALM controls and compliance metadata UI — enterprise differentiator (Morgan Stanley use case)
- VS Code extension with live calmscript preview
- GitHub Action for PR validation and diagram rendering

**Defer (v2+):**
- Real-time multi-user collaboration — CRDT complexity is massive; async git workflow is sufficient for v1 enterprise use
- C4/ArchiMate import-export — lossy translation; focus on CALM-native onboarding
- Terraform/Pulumi IaC generation — dangerous without deep validation; keep architecture and provisioning separate
- Web component `<calm-diagram>` — needs stable rendering layer first

**Anti-features to avoid:**
- Freehand drawing / whiteboard mode — destroys typed-node semantics that make CALM valuable
- Infinite shape customization per node — breaks extension pack aesthetics and portability
- Diagram versioning inside CalmStudio — git already does this better

### Architecture Approach

The architecture follows a single-source-of-truth pattern where CALM JSON is canonical and all other representations are derived. A `CALM JSON Store` (Svelte 5 `$state.raw()`) holds the complete model; a `Sync Engine` translates between CALM JSON and Svelte Flow node/edge format; the `Canvas Layer`, `calmscript Parser/Printer`, `CALM Validation`, and `Properties Panel` all read from and write through the store. The MCP server communicates via file system (reads/writes `.calm` files) in v1, with the frontend detecting file changes and reloading the store. The four data flows (canvas drag, calmscript edit, file import, MCP tool call) all converge on `calmStore.update()` as their single write point. See `.planning/research/ARCHITECTURE.md` for full component diagrams and code examples.

**Major components:**
1. **CALM JSON Store** — `$state.raw()` module-level store; single source of truth; never bypassed
2. **Sync Engine** — pure functions `calmToFlow()` and `flowToCalm()`; no UI concerns; called by event handlers only
3. **Canvas Layer** — @xyflow/svelte with custom node/edge components per CALM type; nodes receive data via props, dispatch events upward
4. **calmscript Parser Pipeline** — Lexer → Parser → AST → Emitter (text to CALM JSON) + Printer (CALM JSON to text); pure TypeScript, zero UI dependencies
5. **Extension Pack Registry** — dynamic import registry; packs are pure data (JSON type definitions + SVG icons), not arbitrary code
6. **MCP Server** — 6-8 semantic tools via stdio transport; file-based state sharing with frontend in v1
7. **ELK Layout Engine** — always in Web Worker; async promise API; only triggered on import or explicit auto-layout, not every edit
8. **Tauri Shell** — file I/O, native dialogs, window management; all Tauri IPC calls guarded with `if (browser)` from `$app/environment`

**Recommended build order (from ARCHITECTURE.md):** CALM JSON Store → Sync Engine → Canvas Layer → calmscript Emitter → calmscript Printer → Extension Pack Registry → ELK Auto-layout → CALM Validation → Properties Panel → MCP Server → Tauri Shell → Pattern Library

### Critical Pitfalls

1. **Bidirectional sync infinite loops** — wire reactive stores in both directions and the app freezes; use a single `applyCALMUpdate(patch)` entry point with `isApplying` guard; establish this in Phase 1 before wiring the code editor
2. **Tauri 2 + SvelteKit SSR enabled** — blank white screen on production build; configure `adapter-static`, `ssr = false`, `assetsInlineLimit: 0`, and no server routes on day one; build and launch the Tauri binary in CI from day one
3. **Svelte Flow node re-render cascade** — all 200 nodes re-render on every drag event; each custom node component must be self-contained (receives only its own data as props, never reads the global nodes array)
4. **calmscript parser blocking main thread** — visible keystroke latency on enterprise architectures; run parser in Web Worker, debounce at 200ms, design grammar as LL(1) or LL(2)
5. **MCP tool schema non-compliance** — Claude Code rejects tools or calls return undefined; use only `type/properties/required/description/enum/items` in schemas; avoid `anyOf/oneOf`; return `{ content: [{type: "text", text: "..."}] }` not raw objects; test with MCP Inspector before integrating with Claude Code
6. **Extension pack metadata breaking CALM validation** — store pack metadata in `.calmstudio.json` companion file, never embedded in `.calm` JSON; otherwise every diagram fails `calm validate`
7. **CALM import data loss** — importers written against own output fail on FINOS example files; preserve unknown fields in `_unknown` passthrough bag; test with files from `finos/architecture-as-code` examples directory

## Implications for Roadmap

Based on the feature dependency tree (FEATURES.md), build order (ARCHITECTURE.md), and phase-to-pitfall mapping (PITFALLS.md), a 4-phase structure is recommended.

### Phase 1: Foundation — CALM Canvas Core

**Rationale:** Every other feature depends on a correctly implemented CALM JSON store and sync engine. The bidirectional sync loop pitfall (the most catastrophic and expensive to fix late) must be addressed here. Tauri/SvelteKit SSR misconfiguration and Svelte Flow re-render cascade are also Phase 1 concerns that become expensive to retrofit. This phase proves the core value proposition: a CALM-typed visual canvas with round-trip CALM JSON fidelity.

**Delivers:** A working Tauri desktop app where architects can drag-and-drop CALM-typed nodes, connect them with typed relationships, edit properties, import/export CALM JSON with auto-layout, and undo/redo. All table stakes UX (zoom/pan, multi-select, keyboard shortcuts, dark/light mode, PNG/SVG export).

**Addresses (from FEATURES.md):** Drag-and-drop canvas, CALM-typed node palette (9 types + 5 relationship types), properties panel with CALM fields, CALM JSON import/export, auto-layout (ELK), undo/redo, zoom/pan, multi-select, keyboard shortcuts, export PNG/SVG, desktop app (Tauri 2)

**Avoids (from PITFALLS.md):**
- Bidirectional sync infinite loops — lock in the `applyCALMUpdate` single-entry pattern before Phase 2
- Tauri 2 + SvelteKit SSR — configure on day one; build binary in CI immediately
- Svelte Flow re-render cascade — establish self-contained node component pattern before writing custom node types
- CALM import data loss — implement defensive importer with `_unknown` passthrough before canvas renders anything

**Research flag:** Standard patterns — Svelte Flow, Tauri 2, and ELK are all well-documented with official examples. Skip research-phase for this phase.

---

### Phase 2: calmscript DSL + Extension Packs

**Rationale:** calmscript is the prerequisite for the MCP server (Phase 3). Extension packs are the prerequisite for pattern templates (Phase 4). Both share the same dependency: a stable CALM JSON store from Phase 1. Extension pack storage architecture (sidecar `.calmstudio.json`) must be decided before building the first pack to avoid migrating all user diagrams later. The calmscript parser Web Worker architecture must be decided before the grammar is complete.

**Delivers:** The calmscript text editor panel (CodeMirror 6 + Lezer syntax highlighting + Chevrotain runtime parser) with bidirectional sync to the canvas. Extension pack registry with AWS, GCP, Azure, Kubernetes, and AI/Agentic packs loading CALM-valid node types with icons. Real-time CALM schema validation with domain-specific error messages.

**Addresses (from FEATURES.md):** calmscript DSL, real-time CALM schema validation, extension packs (AWS/GCP/Azure/K8s/AI/Agentic), containment visualization (deployed-in / composed-of as sub-flows)

**Avoids (from PITFALLS.md):**
- calmscript parser blocking main thread — Web Worker from the start; LL(1) grammar design
- Extension pack breaking CALM validation — `.calmstudio.json` sidecar metadata before building any pack
- Svelte Flow re-render from extension pack node registration — pack types registered before canvas renders

**Research flag:** Needs deeper research for the calmscript grammar design (DSL syntax, operator precedence, handling all 5 relationship types with their sub-properties). The Lezer + Chevrotain two-layer approach is documented but the grammar specifics for CALM are novel.

---

### Phase 3: MCP Server + AI Integration

**Rationale:** The MCP server requires stable calmscript (calmscript text is what Claude Code will generate). The 6-8 tool surface must be designed as semantic tools (not fine-grained property setters) per ARCHITECTURE.md anti-patterns. MCP schema compliance is a known failure mode — test with MCP Inspector before any Claude Code integration.

**Delivers:** A standalone `bin/calmstudio-mcp` Node.js binary registerable in Claude Code's MCP config without launching the full desktop app. Tools: `calm_create_node`, `calm_connect`, `calm_apply_pattern`, `calm_validate`, `calm_export`, `calm_list_types`, `calm_get_diagram`, `calm_import`. File-based state sharing with the desktop frontend (desktop detects `.calm` file changes and reloads).

**Addresses (from FEATURES.md):** MCP server for AI integration, CALM controls and compliance metadata (exposed via MCP tool inputs)

**Avoids (from PITFALLS.md):**
- MCP tool schema non-compliance — MCP Inspector compliance test in CI before merging
- MCP server accepting arbitrary file paths — restrict all file operations to workspace root
- Too many fine-grained tools — 6-8 semantic tools maximum per ARCHITECTURE.md guidance

**Research flag:** Standard patterns — @modelcontextprotocol/sdk is well-documented. Needs one end-to-end tool compliance test before building the full surface. The file-based MCP↔frontend state sharing via file watch is an architectural decision to validate in this phase.

---

### Phase 4: Ecosystem — Patterns, Flows, CI/CD

**Rationale:** Pattern library, flow visualization, VS Code extension, and GitHub Action all build on the stable CALM-typed canvas (Phase 1), calmscript (Phase 2), and MCP server (Phase 3). These are additive features that do not require architectural changes to the core. They extend reach into CI/CD pipelines and editor-native workflows.

**Delivers:** Pattern library with CALM-native architecture templates (microservices on K8s, serverless API, RAG pipeline) validated against `calm validate`. Flow visualization as stepped overlays on existing architecture edges. VS Code extension with live calmscript preview (share parser + types from Phase 2). GitHub Action that validates calmscript on PRs and renders diff-able diagram comments.

**Addresses (from FEATURES.md):** Pattern library/architecture templates, flow visualization, VS Code extension with live preview, GitHub Action for CI/CD validation, CALM controls and compliance metadata UI

**Avoids (from PITFALLS.md):**
- Extension pack nodes showing as empty boxes when pack not installed — show "pack not installed" indicator with install instructions
- Auto-layout destroying manual positions on re-import — preserve `metadata.position` from CALM JSON; apply ELK only on first import or explicit trigger

**Research flag:** VS Code extension may need research-phase — the existing CALM VS Code extension is a potential base. Confirm whether to extend it or build fresh. GitHub Action is standard Node.js + CLI tooling, skip research.

---

### Phase Ordering Rationale

- **CALM JSON Store must precede everything:** The feature dependency tree in FEATURES.md shows CALM-typed nodes as the root dependency for 8+ downstream features. The build order in ARCHITECTURE.md confirms store → sync engine → canvas as the mandatory sequence.
- **Pitfall prevention drives Phase 1 scope:** 4 of the 7 critical pitfalls are Phase 1 concerns. Starting with a broad Phase 1 that establishes all foundational invariants (sync pattern, Tauri config, node isolation, import normalization) prevents costly rewrites.
- **calmscript before MCP:** The FEATURES.md dependency tree is explicit: `[calmscript DSL] → required-by → [MCP Server]`. An MCP server that emits raw CALM JSON defeats the AI-native story.
- **Extension packs before pattern library:** Patterns compose existing node types from packs. Building patterns before packs means patterns using only the 9 built-in CALM types, which limits enterprise adoption.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** calmscript grammar design — DSL syntax for all 5 CALM relationship types, containment syntax, how to handle CALM `interfaces` and `controls` inline vs referenced; no prior art for CALM-specific DSL syntax
- **Phase 3:** File-based MCP↔frontend state sharing via file watch — validate latency and reliability on Windows (file watch behavior differs); consider Tauri IPC channel as fallback
- **Phase 4:** VS Code extension base — audit the existing CALM VS Code extension (`calm` on Marketplace) to determine extend vs rebuild

Phases with standard patterns (skip research-phase):
- **Phase 1:** Svelte Flow, Tauri 2, ELK — all have official integration examples with Svelte; well-documented pitfalls with known solutions
- **Phase 3 (MCP tooling):** @modelcontextprotocol/sdk, stdio transport, Zod schemas — official SDK with clear documentation
- **Phase 4 (GitHub Action):** Standard Node.js + `calm validate` CLI wrapper; well-trodden pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npmjs.com and official docs; Tauri 2 + SvelteKit integration path is documented by Tauri team directly; @xyflow/svelte 1.0 rewrite for Svelte 5 confirmed |
| Features | HIGH | Competitive analysis covered 8 direct competitors; CALM spec is authoritative from FINOS; MVP definition grounded in feature dependencies, not speculation |
| Architecture | HIGH (core), MEDIUM (extension isolation) | Sync engine pattern, CALM JSON store, MCP tool design are well-researched; extension pack versioning and calmscript grammar specifics are more novel |
| Pitfalls | HIGH (Tauri/SvelteKit/Svelte Flow/MCP), MEDIUM (CALM schema edge cases, DSL parser) | Most pitfalls sourced from documented real failures; CALM spec edge cases need validation against FINOS example corpus |

**Overall confidence:** HIGH

### Gaps to Address

- **calmscript grammar specifics:** No prior art for a CALM-native DSL. Grammar design must accommodate all 5 relationship types (connects, interacts, deployed-in, composed-of, options) and their sub-properties (source interface, destination interface, protocol). Recommend a grammar spike before Phase 2 planning.
- **CALM spec version targeting:** The CALM spec is evolving. Research hardcoded the current version; implementation should parameterize the target spec version so the tool doesn't need a rewrite when CALM v2 ships. Acceptable to defer until Phase 1 is complete, with a TODO comment.
- **MCP desktop integration mode:** The research recommends `stdio` transport for Claude Code but notes the Tauri desktop integration needs live preview (file watch → frontend reload). File watch latency on Windows needs validation. Alternative: Tauri IPC channel for MCP↔frontend in v1.x.
- **Extension pack marketplace security:** Research defers community pack marketplace to v2+, but the security model for pack loading (local filesystem only, content hash verification) needs to be locked in Phase 2 before the first pack ships, to avoid retrofitting it.

## Sources

### Primary (HIGH confidence)
- npmjs.com/@xyflow/svelte — version 1.5.1; Svelte 5 required
- xyflow.com/blog/svelte-flow-release — Svelte Flow 1.0 release announcement; Svelte 5 rewrite
- v2.tauri.app/start/frontend/sveltekit/ — Tauri 2 official SvelteKit integration guide
- svelteflow.dev — custom nodes, handles, subflows, ELK layout documentation
- npmjs.com/package/chevrotain — version 11.2.0
- npmjs.com/package/codemirror — version 6.0.2
- npmjs.com/package/elkjs — version 0.11.1
- npmjs.com/package/ajv — version 8.17.1
- npmjs.com/package/@modelcontextprotocol/sdk — version 1.24.1; MCP spec 2025-11-25
- calm.finos.org/introduction/key-features/ — official CALM documentation
- github.com/finos/architecture-as-code — CALM spec source of truth
- modelcontextprotocol.io/docs/learn/architecture — MCP architecture overview
- svelte.dev/docs/svelte/testing — Vitest recommendation for Svelte 5

### Secondary (MEDIUM confidence)
- github.com/mermaid-js/mermaid/pull/3432 — Mermaid adopted Chevrotain (confirms production viability)
- icepanel.medium.com/comparison-icepanel-vs-structurizr — model sync approaches (vendor-authored)
- generativeprogrammer.com — architecture diagramming tools and AI gap (independent analysis)
- blog.whiteprompt.com — MCP server for visual architecture (practitioner writeup)
- dev.to/samchon — why MCP servers fail (compliance failures documented)
- codemirror.net/examples/lang-package/ — Lezer grammar approach for custom language modes

### Tertiary (LOW confidence — needs validation)
- CALM schema draft-2020-12 edge cases in `additionalProperties` handling — needs testing against full FINOS example corpus
- File watch latency for MCP↔frontend state sharing on Windows — needs empirical testing

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
