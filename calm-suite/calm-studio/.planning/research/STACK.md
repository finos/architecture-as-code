# Stack Research

**Domain:** Visual architecture diagramming tool with DSL, desktop app, and MCP server
**Researched:** 2026-03-11
**Confidence:** HIGH (all versions verified against npm/official docs)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Svelte 5 | 5.45.x (latest stable) | UI framework | Runes-based reactivity is leaner than React signals; native Svelte 5 support in @xyflow/svelte 1.x requires it; faster compile output than React for canvas-heavy UIs |
| SvelteKit 2 | 2.53.x | App routing and bundling shell | Pairs with Svelte 5; Tauri 2 has an official SvelteKit integration path; SPA mode (adapter-static + ssr=false) is the correct Tauri target |
| @xyflow/svelte | 1.5.1 | Node-graph canvas | Only production-grade node-graph editor with native Svelte 5 support; built-in custom nodes, typed handles, subflows (CALM containment), and ELK layout integration; MIT licensed; rewritten from scratch for Svelte 5 in the 1.0 release (May 2025) |
| Tauri 2 | 2.10.3 | Desktop app shell | Official stable since Oct 2024; 600KB base binary vs Electron's 50MB; Rust backend for safe file I/O; supports macOS, Windows, Linux, iOS, Android from one codebase |
| Vite | 5.x (bundled with SvelteKit) | Dev server and bundler | Included by SvelteKit; Tauri's beforeDevCommand delegates directly to vite dev; no separate configuration needed |

### Canvas and Layout

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| elkjs | 0.11.1 | Automatic graph layout | Run on CALM JSON import and the "auto-layout" action; provides layered (Sugiyama), tree, force, and stress algorithms; natively supported by Svelte Flow's useLayout hook; must be run in a Web Worker to avoid blocking the canvas |
| @xyflow/svelte (subflows API) | 1.5.1 | CALM containment (deployed-in, composed-of) | Use nested SvelteFlow components for representing hierarchical CALM relationships; built in to @xyflow/svelte, no separate library needed |

### Code Editor (calmscript panel)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| codemirror | 6.0.2 | Code editor shell | The `codemirror` meta-package bundles all standard @codemirror/* packages; use as the calmscript text editor; supports theming, keyboard shortcuts, history, search |
| @codemirror/language | 6.x | Language support base | Required for defining a custom calmscript language mode |
| @lezer/generator | 1.x | Lezer grammar compiler | Compile a `.grammar` file into a Lezer parser at build time; the correct approach for a first-class calmscript language mode with syntax highlighting and error recovery |
| @lezer/highlight | 1.x | Syntax highlighting tokens | Map Lezer node types to CodeMirror highlighting classes for calmscript keywords, node types, edge types |

### DSL Parser (calmscript)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Chevrotain | 11.2.0 | calmscript parser and lexer | Use for the runtime parser that converts calmscript text to a CALM JSON AST; pure JavaScript, no code generation step, excellent TypeScript types, auto-generates CST, best performance among pure-JS parsers; Mermaid adopted Chevrotain for its parser; 2.4M weekly downloads confirms ecosystem maturity |

**DSL parser rationale:** Chevrotain over Ohm because Chevrotain defines grammar in TypeScript (no separate DSL file to maintain), produces a typed CST automatically, and is measurably faster. Ohm (17.5.0) is excellent for interactive grammar exploration but its separate grammar DSL adds friction for a production parser. Nearley uses Earley parsing which is slower and harder to write error messages for. Tree-sitter requires a Rust/C toolchain and WASM compilation step — overkill for a single custom language.

**Two-layer parsing strategy:** Use Lezer (compile-time grammar) for CodeMirror's syntax highlighting and incremental parsing. Use Chevrotain (runtime) for the actual calmscript→CALM JSON transformation. They are independent: Lezer handles the editor; Chevrotain handles the compiler.

### CALM Validation

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | 8.17.1 | JSON Schema validation | Validate CALM JSON output against the official FINOS CALM JSON Schema; supports draft-2020-12 which CALM uses; generates code-based validators for performance; use in both browser and Node.js (MCP server) |
| ajv-formats | 2.x | AJV format validators | Required plugin for `uri`, `date-time`, and other JSON Schema format keywords used in CALM schemas |

### MCP Server

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | 1.24.1 | MCP server implementation | The official Anthropic TypeScript SDK; implements the full MCP 2025-11-25 spec; handles tool/resource registration, stdio and Streamable HTTP transports, capability negotiation |
| zod | 3.25+ (or 4.x) | Schema validation for MCP tools | Required peer dependency of @modelcontextprotocol/sdk; use zod schemas to define MCP tool input shapes; SDK uses Zod v4 internally but is backwards-compatible with Zod 3.25+ |

**MCP server transport:** Use stdio transport for Claude Code integration (it's what Claude Desktop and Claude Code expect for local MCP servers). Never use `console.log()` in a stdio MCP server — it corrupts JSON-RPC messages. Use `console.error()` or a file logger.

**MCP server structure:** Ship as a standalone Node.js binary (`bin/calmstudio-mcp`) separate from the Tauri app. This allows it to be registered in Claude Code's MCP config without launching the full desktop app.

### Tauri Plugins

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-fs | 2.x | Native file system access | Open/save CALM JSON and calmscript files; replaces the old @tauri-apps/api/fs which was removed in Tauri 2 |
| @tauri-apps/plugin-dialog | 2.x | Native file open/save dialogs | System-native file picker for open/save operations; use instead of HTML file inputs for a desktop-quality UX |
| @tauri-apps/api | 2.x | Core Tauri JS bridge | Invoke Rust commands, access window APIs, emit/listen to events between frontend and Rust backend |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit and component testing | Official SvelteKit recommendation; native Svelte 5 rune support; use `vitest-browser-svelte` + Playwright for component tests instead of jsdom — more accurate for canvas components |
| TypeScript 5.x | Type safety | Required for Zod v4, MCP SDK, and Chevrotain typed grammars |
| Prettier + ESLint | Code formatting and linting | Standard SvelteKit scaffold includes both; use `@typescript-eslint/eslint-plugin` |
| `@sveltejs/adapter-static` | 3.0.10 | SvelteKit SSG/SPA adapter | Required for Tauri — set `fallback: 'index.html'` and `export const ssr = false` in `+layout.ts` |

## Installation

```bash
# Core framework
npm install svelte @sveltejs/kit @sveltejs/adapter-static @xyflow/svelte

# Tauri 2 CLI (Rust)
cargo install tauri-cli

# Tauri JS bindings
npm install @tauri-apps/api @tauri-apps/plugin-fs @tauri-apps/plugin-dialog

# Canvas layout
npm install elkjs

# Code editor
npm install codemirror @codemirror/language @lezer/highlight

# DSL parser
npm install chevrotain

# CALM validation
npm install ajv ajv-formats

# MCP server
npm install @modelcontextprotocol/sdk zod

# Dev tools
npm install -D vitest @vitest/browser vitest-browser-svelte playwright \
  typescript @lezer/generator \
  eslint @typescript-eslint/eslint-plugin prettier
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @xyflow/svelte 1.x | React Flow (@xyflow/react) | If the project were React-based; React Flow is more mature and has a larger example library, but Svelte 5 is the mandated framework |
| Chevrotain | Ohm-js | Ohm is better for exploratory grammar development or when a grammar file needs to be read by non-programmers; inferior for a production parser that needs TypeScript integration |
| Chevrotain | Nearley | Only if grammar has inherent ambiguity that PEG cannot handle; Earley parsing is slower and error recovery is harder |
| Lezer grammar (build-time) | Stream parser (CodeMirror) | If the language is very simple and doesn't need error recovery; stream parsers are easier to write but produce inferior editor experience |
| Tauri 2 | Electron | If team has Node.js native module dependencies; Electron has a mature ecosystem but ships a full Chromium (~150MB); wrong trade-off for a local architecture tool |
| elkjs | Dagre | Dagre is unmaintained (last release 2021); ELK has active development, supports ports (critical for CALM interface nodes), and has an official Svelte Flow example |
| AJV | Zod for CALM validation | Zod works for TypeScript-defined schemas but CALM schemas are external JSON Schema files from FINOS; AJV is the right tool for validating against external JSON Schema files |
| @modelcontextprotocol/sdk | fastmcp | fastmcp is a community wrapper that simplifies boilerplate; use if you want less ceremony, but @modelcontextprotocol/sdk is the official SDK and tracks spec updates immediately |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Excalidraw | Freehand whiteboard — no typed nodes, no handles, no containment; wrong abstraction for structured architecture diagrams | @xyflow/svelte |
| @xyflow/svelte 0.x | Pre-Svelte 5 API; uses Svelte stores instead of runes; incompatible with Svelte 5 component model | @xyflow/svelte 1.x |
| Dagre (for layout) | Unmaintained since 2021; no ports support; only basic directed graph layouts | elkjs |
| CodeMirror 5 | Legacy version, not tree-shakable, different API; CM6 is the current maintained version | codemirror (v6) |
| Nearley | Earley algorithm is slow for large inputs; error messages are difficult to produce; project has low maintenance activity | Chevrotain |
| tree-sitter (web-tree-sitter) | Requires writing grammar in a separate DSL, compiling to WASM via Rust toolchain, distributing WASM artifacts; overkill for a single custom language; better suited for editor plugins that need to parse many languages (VS Code extension phase) | Chevrotain (runtime) + Lezer (editor) |
| console.log() in MCP server | Corrupts stdio JSON-RPC transport; will break all MCP tool calls silently | console.error() or file logger |
| @tauri-apps/api/fs (Tauri 1 API) | Removed in Tauri 2; will cause runtime errors | @tauri-apps/plugin-fs |
| SSR in SvelteKit+Tauri | Tauri does not have a Node.js server; SSR will fail or silently not work | adapter-static with `ssr = false` |

## Stack Patterns by Variant

**For the Tauri desktop app:**
- Use SvelteKit SPA mode: `adapter-static`, `ssr = false`, `fallback: 'index.html'`
- Register Tauri plugins in `src-tauri/src/lib.rs` with `.plugin(tauri_plugin_fs::init())` etc.
- Keep canvas state in Svelte 5 runes (`$state`, `$derived`), not in SvelteKit load functions

**For the MCP server (standalone Node.js binary):**
- Use `@modelcontextprotocol/sdk` with `StdioServerTransport`
- Build as a separate npm workspace package (`packages/mcp-server`)
- Expose tools: `calm_create_node`, `calm_create_edge`, `calm_validate`, `calm_parse_calmscript`, `calm_export_json`
- Log only to stderr — stdout is reserved for JSON-RPC

**For the VS Code extension (deferred phase):**
- Use `web-tree-sitter` for the language server since VS Code's LSP infrastructure expects tree-sitter grammars
- The Lezer grammar written for CodeMirror does NOT automatically port to tree-sitter; plan separate grammar work

**For the calmscript DSL compiler:**
- Two-phase: Chevrotain lexer → CST → AST transformer → CALM JSON
- Inverse direction: CALM JSON → pretty-print to calmscript (no parser needed; pure serialization)
- Bidirectional sync: on canvas edit, serialize to CALM JSON, then pretty-print to calmscript; on calmscript edit, parse to CALM JSON, then render to canvas

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @xyflow/svelte 1.5.1 | svelte ^5.0.0, @sveltejs/kit ^2.0.0 | Svelte Flow 1.0+ was rewritten for Svelte 5; do NOT use with Svelte 4 |
| tauri 2.10.3 | @sveltejs/kit 2.x, adapter-static 3.x | Requires `ssr = false`; SPA mode only |
| elkjs 0.11.1 | No framework dependency | Must run in Web Worker in browser to avoid blocking main thread; Svelte Flow has a `useLayout` hook that handles this |
| codemirror 6.0.2 | Bundled @codemirror/* packages | The `codemirror` meta-package pins compatible @codemirror/* versions; do not mix individual package versions independently |
| @modelcontextprotocol/sdk 1.24.1 | zod ^3.25.0 or zod ^4.0.0 | SDK uses Zod v4 internally; imports from `zod/v4`; backwards-compatible with Zod 3.25+ |
| chevrotain 11.2.0 | Node.js 14+, modern browsers | Pure ESM-compatible; no native dependencies; works in Vite/Rollup without issues |
| ajv 8.17.1 | Standalone; no framework deps | For CALM JSON Schema draft-2020-12, use `new Ajv({ strict: false })` since CALM schemas use `$schema` declarations AJV strict mode may reject |

## Sources

- npmjs.com/@xyflow/svelte — version 1.5.1 confirmed; Svelte 5 required (HIGH confidence)
- xyflow.com/blog/svelte-flow-release — Svelte Flow 1.0 release announcement, full Svelte 5 rewrite (HIGH)
- svelteflow.dev — Custom nodes, handles, subflows, ELK layout documentation (HIGH)
- v2.tauri.app/start/frontend/sveltekit/ — Official Tauri 2 SvelteKit integration guide, adapter-static requirement (HIGH)
- npmjs.com/package/elkjs — version 0.11.1 (HIGH)
- npmjs.com/package/codemirror — version 6.0.2 (HIGH)
- npmjs.com/package/chevrotain — version 11.2.0 (HIGH)
- npmjs.com/package/ohm-js — version 17.5.0 (HIGH)
- github.com/mermaid-js/mermaid/pull/3432 — Mermaid adopted Chevrotain as its parser (MEDIUM, confirms production viability)
- npmjs.com/package/@modelcontextprotocol/sdk — version 1.24.1; MCP spec 2025-11-25 (HIGH)
- npmjs.com/package/ajv — version 8.17.1 (HIGH)
- codemirror.net/examples/lang-package/ — Lezer grammar approach for custom language modes (HIGH)
- svelte.dev/docs/svelte/testing — Official Vitest recommendation for Svelte 5 (HIGH)

---
*Stack research for: CalmStudio — visual architecture diagramming with CALM code generation*
*Researched: 2026-03-11*
