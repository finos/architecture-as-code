# Pitfalls Research

**Domain:** Visual architecture diagramming tool with bidirectional sync, custom DSL, node-graph editor, extension/plugin system, MCP server, and Tauri desktop app
**Researched:** 2026-03-11
**Confidence:** HIGH (Tauri/SvelteKit, Svelte Flow, MCP protocol), MEDIUM (CALM schema edge cases, DSL parser, extension versioning)

---

## Critical Pitfalls

### Pitfall 1: Bidirectional Sync Infinite Update Loops

**What goes wrong:**
The visual canvas and the calmscript/CALM JSON code panel mutually observe each other for changes. A user drags a node on the canvas — the canvas state changes, triggers a CALM JSON update, the JSON change triggers a calmscript re-parse, the re-parse triggers a canvas re-render, which triggers another state change. The loop runs until the app freezes or crashes. This is the single most common cause of complete rewrites in diagram-as-code tools.

**Why it happens:**
Developers wire reactive stores in both directions simultaneously without a "who owns this update" mechanism. In Svelte 5, runes make it easy to create deeply reactive state that cascades — there's no built-in cycle detection. The symptom usually first appears in edge cases (undo/redo, paste, import) rather than simple drags.

**How to avoid:**
Adopt a single canonical source of truth: CALM JSON is the master record. All mutations go through a single `applyCALMUpdate(patch)` function. Every subsystem (canvas, code editor, properties panel) reads from CALM JSON and emits *intent patches*, never directly mutating other subsystems. Use an `isApplying` flag guard during patch application. Specifically:
- Canvas interaction produces `CanvasIntent` objects (move node X to position Y)
- Code editor produces `CodeIntent` objects (parsed AST diff)
- Both are translated to CALM JSON patches by a central `SyncEngine`
- `SyncEngine` applies the patch and notifies all subscribers once, not recursively

**Warning signs:**
- CPU usage spikes to 100% when moving a node
- Console shows the same log line repeating thousands of times
- Editor text field cursor jumps on every keystroke
- Undo history grows unbounded without user action

**Phase to address:**
Phase 1 (core canvas + CALM JSON round-trip). Establish the update pattern before adding the code editor. If you wire both directions at once in Phase 2, untangling is painful.

---

### Pitfall 2: Tauri 2 + SvelteKit SSR Mode Enabled

**What goes wrong:**
SvelteKit defaults to SSR mode. Tauri has no server — it serves a static bundle from the webview. If SSR is not explicitly disabled, the production build breaks with `window is not defined` errors, Tauri API calls fail silently, and server routes (`+page.server.ts`, `+server.ts`) are compiled into the bundle but never execute, causing cryptic runtime errors.

**Why it happens:**
SvelteKit's default config assumes a Node server exists. Developers scaffold a SvelteKit project, get it working in the browser dev server, add Tauri, and only discover the SSR incompatibility on their first production build — sometimes weeks into development.

**How to avoid:**
Configure this on day one, before writing any app code:
1. Install `@sveltejs/adapter-static` (not `adapter-auto`)
2. In `svelte.config.js`: use `adapter({ fallback: 'index.html' })`
3. In `src/routes/+layout.ts`: `export const ssr = false; export const prerender = true;`
4. In `tauri.conf.json`: `"frontendDist": "../build"`
5. Never use `+page.server.ts` or `+server.ts` files — use Tauri commands instead
6. Set `assetsInlineLimit: 0` in `vite.config.ts` — Tauri's CSP blocks base64 inlined assets smaller than 4KB (Vite's default threshold)
7. Do not configure CSP in both SvelteKit and `tauri.conf.json` — pick one, they conflict

**Warning signs:**
- App works in `npm run dev` but breaks after `npm run tauri build`
- `window is not defined` in build logs
- Blank white screen on launch of the .app/.exe
- Tauri APIs return undefined in production but work in dev

**Phase to address:**
Phase 1 (project scaffold). Non-negotiable day-one configuration. Add a smoke test: build and run the Tauri binary before writing any feature code.

---

### Pitfall 3: Svelte Flow Node Re-render Cascade on Every Store Update

**What goes wrong:**
With 100+ nodes, every user interaction (drag, pan, zoom, select) triggers a state update. If custom node components are not properly isolated from the global nodes array, every node re-renders on every state change — not just the moved node. At 200 nodes this produces 200 re-renders per pointer event, causing visible jank and dropped frames.

**Why it happens:**
Svelte Flow stores the full nodes array in a reactive store. Custom node components that derive any data from the full array (e.g., to look up connected nodes) subscribe to the entire array and re-render whenever any node changes. This is the same pattern that kills React Flow apps without `React.memo`.

**How to avoid:**
- Each custom node component must be self-contained: receive only its own node data as a prop, never read the global nodes store
- Store per-node metadata (CALM node type, metadata, connection status) on the node's `data` field at creation time — do not compute it from the nodes array at render time
- For derived state (e.g., "is this node selected?"), use Svelte 5 `$derived` with fine-grained inputs, not a derivation from the full nodes array
- Use `hidden: true` on collapsed subflow children — do not render nodes outside the visible viewport
- Run ELK layout in a Web Worker (elkjs ships with built-in worker support) — layout for 100 nodes can take 500ms+ and will freeze the UI if run on the main thread

**Warning signs:**
- Svelte DevTools shows all nodes re-rendering when one moves
- Frame rate drops below 30fps with 50+ nodes
- ELK layout call blocks the UI thread (main thread CPU spike during import)
- Adding a node to a subflow causes the entire graph to flash

**Phase to address:**
Phase 1 (canvas foundation). Establish node component boundaries before implementing custom node types. Retrofitting this after Phase 2 requires rewriting every custom node component.

---

### Pitfall 4: calmscript Parser Blocks the Main Thread on Large Files

**What goes wrong:**
A synchronous parser running on the main thread blocks the UI while parsing. For typical calmscript files (50-node architectures), even a slow parser finishes in under 10ms. But enterprise architectures with 200+ nodes, 500+ relationships, and deeply nested containment can push parse times to 100-300ms — making every keystroke feel laggy.

**Why it happens:**
Parser choice matters: naive recursive descent parsers with backtracking have O(n²) or worse behavior on pathological inputs. Developers test with small examples and don't discover the performance cliff until integrating real enterprise architectures.

**How to avoid:**
- Use a PEG parser (Peggy.js) or hand-written recursive descent with no backtracking — avoid ambiguous grammars (nearley allows ambiguous grammars by design, which is wrong for a DSL)
- Run the parser in a Web Worker — parse happens on every keystroke, must never block the UI thread
- Implement incremental re-parsing: only re-parse the changed line/block, not the full document. Store a parse cache keyed by content hash
- Debounce parse triggers: 200ms after last keystroke, not on every character
- Keep calmscript grammar LL(1) or LL(2) — lookahead > 2 is a grammar design smell, not a parser performance problem to optimize around

**Warning signs:**
- Typing in the code editor has visible latency
- `performance.mark()` shows parse time > 20ms for a 100-node file
- The grammar has more than 3 levels of optional/repeating alternatives for the same production
- Test corpus includes only files with < 20 nodes

**Phase to address:**
Phase 2 (calmscript DSL). Parser architecture choices are not easily changed after the grammar is complete. Decide on Web Worker strategy before writing the grammar.

---

### Pitfall 5: MCP Server Returns Non-Compliant Tool Schemas

**What goes wrong:**
The MCP server registers tools with JSON schemas that are valid JSON Schema but violate vendor-specific constraints. Claude Code (and other MCP clients) reject tools at registration time or fail calls silently. Common failure modes: using `anyOf`/`oneOf` in tool input schemas (Claude strips these), returning tool results as plain text instead of the `content` array format, or throwing JavaScript exceptions instead of returning proper MCP error responses.

**Why it happens:**
The MCP specification and individual client implementations diverge. A schema that validates correctly in JSON Schema validators may fail when the MCP client normalizes it for its internal LLM. The MCP spec says tool results should be `{ content: [{ type: "text", text: "..." }] }` but developers naturally return `{ result: "..." }`.

**How to avoid:**
- Tool input schemas: use only `type`, `properties`, `required`, `description`, `enum`, and `items` — avoid `anyOf`, `oneOf`, `allOf`, `$ref`
- Tool results: always return `{ content: [{ type: "text" | "image", text?: string, data?: string, mimeType?: string }] }`
- Validation errors inside a tool: return `{ content: [...], isError: true }` — do NOT throw a JavaScript exception (that's a protocol error, not a tool error; clients handle them differently)
- Limit total tool count: 30+ tools creates context bloat that degrades AI agent reliability. Group related operations (e.g., `calm_node` with a `action` enum rather than `calm_add_node`, `calm_remove_node`, `calm_update_node` as separate tools)
- Always include the `Accept: text/event-stream` header handling in the SSE transport — clients that enforce strict spec compliance will reject connections without it
- Test MCP compliance with the official MCP Inspector tool before integration testing with Claude Code

**Warning signs:**
- Claude Code shows the server connected but lists 0 tools
- Tool calls return undefined instead of content
- MCP Inspector shows schema validation errors on `tools/list`
- Claude hallucinates tool signatures rather than using the registered ones

**Phase to address:**
Phase 3 (MCP server). Write one complete tool end-to-end with compliance testing before implementing the full tool surface. The compliance issues compound with tool count.

---

### Pitfall 6: Extension Pack Schema Breaks Core CALM Validation

**What goes wrong:**
Extension packs add AWS, GCP, K8s, and other node types to the visual palette. A developer adds an extension pack node to a diagram, exports to CALM JSON, and `calm validate` fails because the CALM schema doesn't know about `aws-s3-bucket` as a valid node type. Worse: different extension pack versions define conflicting `node-type` strings, so a diagram created with `aws-pack@1.0` fails to load with `aws-pack@2.0` installed.

**Why it happens:**
CALM node types are `string` (any value is valid for the `node-type` field), but extension packs need to provide metadata (icon, allowed interfaces, display label) for those strings. If the metadata is bundled into the CALM JSON as non-standard fields, `calm validate` rejects it. If it's stored in a registry outside CALM JSON, the diagram becomes unrenderable without the pack installed.

**How to avoid:**
- Store extension pack metadata in a separate sidecar structure, not embedded in CALM JSON nodes. The CALM JSON remains CALM-spec-compliant (using standard node types or custom string types per spec)
- Extension pack registry: use a `calmstudio.extensions` key in a companion `.calmstudio.json` file alongside the `.calm.json` — never pollute the CALM file with rendering metadata
- Version extension packs with a `compatibleCALMSpec` range (e.g., `">=1.0.0 <2.0.0"`) — check at load time, warn if range doesn't include installed CALM spec version
- Node type strings must be stable across pack versions — treat them as public API. Rename nodes with deprecation (keep old string as alias), never delete

**Warning signs:**
- `calm validate` passes in isolation but fails after adding extension pack nodes
- Diagram looks correct in CalmStudio but loses node metadata when opened in another CALM tool
- Pack upgrade breaks existing diagrams
- Two packs define the same node type string with different metadata

**Phase to address:**
Phase 2 (extension pack foundation). The storage separation decision must be made before building the first pack. Retrofitting it after 4 packs exist means migrating all diagram files.

---

### Pitfall 7: CALM JSON Source-of-Truth Assumption Breaks on Import

**What goes wrong:**
The application treats CALM JSON as the canonical representation. But CALM JSON imported from external tools (CALM Hub, `calm generate`, CI pipeline outputs) may have: non-canonical node ordering, extra `$schema` fields, `metadata` fields with unknown keys, or `interfaces` arrays with partial data. The importer crashes or silently drops data when encountering these cases, corrupting the architecture on first open.

**Why it happens:**
CALM is an evolving spec. The JSON schema uses `additionalProperties` permissively in some versions. Developers write importers against the subset of CALM JSON their own tool generates, not against the full range of valid CALM JSON that real users will bring in.

**How to avoid:**
- Import defensively: parse and validate the incoming CALM JSON against the versioned schema, then normalize to CalmStudio's internal representation
- Preserve unknown fields in a `_unknown` passthrough bag — round-trip them back on export. Never silently drop data
- Test import with real CALM files from the `finos/architecture-as-code` repo's example directory, not just files CalmStudio generated
- Validate with Ajv (strict mode) before rendering — surface validation errors to the user as warnings, not crashes

**Warning signs:**
- Import works only for files CalmStudio exported
- `console.error` shows "unknown property X" on import
- Nodes disappear after import round-trip
- Controls or flows data lost after open-save cycle

**Phase to address:**
Phase 1 (CALM JSON round-trip). Define the import normalization layer before the visual canvas so canvas never receives invalid data.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store CALM JSON as a Svelte `$state` string and `JSON.parse` on every render | Simple to implement | Re-parses 462-line JSON on every frame, causes jank at scale | Never — use a structured store with parsed representation |
| Use `$effect` to sync canvas → code and code → canvas symmetrically | Easy to wire up | Creates the infinite loop (Pitfall 1) | Never |
| Run ELK layout on the main thread | No Worker setup required | Freezes UI for 300-600ms on 100+ node import | Acceptable only for < 20 nodes (prototype phase) |
| Hardcode CALM spec version in all validation logic | No versioning complexity | Breaks when CALM spec releases v2 | Only acceptable in Phase 1 with a TODO comment |
| Bundle extension pack icons as inline SVG strings in JS | No asset pipeline needed | Increases bundle size exponentially, slow cold start | Only for the first 3-5 icons in early prototype |
| Use SvelteKit server routes for MCP server | Standard SvelteKit pattern | Incompatible with Tauri 2 (no SSR) — entire MCP server must move to Tauri Rust backend | Never for Tauri target |
| Implement parser synchronously in-thread | Simple code, no Worker overhead | Blocks UI on large files (Pitfall 4) | Only while building the grammar, before beta |

---

## Integration Gotchas

Common mistakes when connecting components and external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tauri IPC + SvelteKit | Calling `invoke()` in `+page.server.ts` or during SSR | Always call `invoke()` only in browser context; guard with `if (browser)` from `$app/environment` |
| ELK.js + Svelte Flow | Running layout on every nodes store update | Run layout only on explicit triggers (import, auto-layout button, node add); cache results |
| CodeMirror 6 + Vite/SvelteKit | Missing `optimizeDeps.exclude` config | Add all `@codemirror/*` packages to `vite.config.ts` `optimizeDeps.exclude` or builds break in production |
| MCP + Claude Code | Using `stdio` transport during Tauri desktop app | Use `stdio` only for CLI/local MCP; for desktop, use HTTP+SSE transport on localhost |
| CALM JSON + Ajv | Using Ajv's default (draft-07) for CALM schema | CALM uses JSON Schema draft-2020-12; configure Ajv with `addFormats`, use `ajv-formats`, not the default instance |
| Extension packs + dynamic import | `import()` paths in Tauri's webview | Use Tauri's `asset://` protocol for dynamically loaded pack assets, not relative file paths |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all nodes always | Smooth at 20 nodes, jank at 100+ | Use Svelte Flow's built-in virtualization; set `hidden: true` for collapsed subflow children | ~80-100 nodes |
| Synchronous CALM JSON stringify on every edit | Unnoticeable at 5 nodes | Debounce serialization; only re-serialize on explicit save or export | ~50 node files (~30KB JSON) |
| JSON Schema validation on every keypress in code editor | Fine with small schemas | Validate on debounce (500ms) or on blur; run in Worker | Any file > 100 lines |
| Loading all extension pack icons at startup | Imperceptible with 1 pack | Lazy-load pack icons; only load the active pack on startup | 3+ packs installed |
| ELK layout on main thread | Fine for < 20 nodes | Always use `elkjs` Web Worker mode | 50+ node import |
| Full re-parse of calmscript on every character | Unnoticeable for 10-line files | Debounce 200ms + incremental parse cache | Files > 200 lines |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| MCP server accepting arbitrary file paths for read/write | Path traversal: AI agent can read `/etc/passwd` or overwrite system files | Restrict all file operations to a configurable workspace root; validate all paths against the root before Tauri `fs` calls |
| Extension pack loaded from arbitrary URL | Supply chain attack: malicious pack injects code into the diagram editor | Only load extension packs from local filesystem or a curated registry with content hash verification |
| calmscript parser executing arbitrary JS | Code injection if parser uses `eval()` or `new Function()` | Never use dynamic code execution in the parser; PEG parsers like Peggy.js compile to safe code |
| CALM JSON export containing user-injected HTML in description fields | XSS in the diagram viewer or generated docs | Sanitize all string fields before rendering in HTML contexts; use a sanitizer (DOMPurify) for any rendered markdown/HTML |
| MCP tool inputs without validation | Prompt injection via malformed diagram names | Validate and sanitize all string parameters in MCP tool handlers before passing to Tauri commands |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw CALM JSON validation errors | "additionalProperties must not exist at path #/nodes/0" means nothing to an architect | Translate JSON Schema errors to domain-specific messages: "Node 'auth-service' is missing required interface definitions" |
| Auto-layout on every import without preserving manual positions | Users spend time arranging diagrams; import destroys their layout | Apply auto-layout only on first import or when user explicitly requests it; preserve `x/y` positions from CALM JSON when present |
| Synchronous code editor: user types, canvas updates instantly | Canvas jumping while typing is disorienting | Buffer code editor changes; only update canvas on parse success, not on every character |
| Extension pack nodes showing as empty boxes when pack not installed | Silent degradation, user thinks the tool is broken | Show a clear "pack not installed" indicator with the pack name and install instructions |
| calmscript errors shown only as red underlines | User doesn't know what's wrong | Show an error panel with line numbers, error message, and a one-click fix suggestion where possible |
| Properties panel shows all CALM fields for every node | Overwhelming for simple use cases | Progressive disclosure: show core fields by default, advanced fields (controls, flows, metadata) behind expansion |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Bidirectional sync:** Works for add/move/delete but often breaks on undo/redo — verify that undo history creates CALM JSON patches, not canvas mutations
- [ ] **CALM JSON export:** Passes `calm validate` against the current CALM spec version, not just against CalmStudio's internal schema subset
- [ ] **Extension pack nodes:** Round-trip correctly through export-import-export without losing pack metadata or node type information
- [ ] **MCP server:** Tested with actual Claude Code (not just unit tests) — Claude Code's JSON schema interpretation differs from spec
- [ ] **calmscript parser:** Handles all 5 CALM relationship types (`connects`, `interacts`, `deployed-in`, `composed-of`, `options`) and all 9 built-in node types, not just the common 3
- [ ] **Tauri build:** Tested on all three target platforms (macOS, Windows, Linux) — CSP and file path separators differ
- [ ] **Auto-layout (ELK):** Handles disconnected subgraphs (nodes with no edges) without crashing — ELK requires at least one connected component
- [ ] **CALM import:** Handles CALM files with `$schema` references to older spec versions, not just the current version

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Bidirectional sync infinite loop discovered in production | HIGH | Freeze the update pipeline (disable reactive wiring), add `isApplying` guard pattern, rewrite sync engine; all features built on top may need re-testing |
| Tauri SSR misconfiguration discovered post-scaffold | MEDIUM | Switch adapter, set `ssr = false`, remove all server routes; migrate any server-side logic to Tauri commands; 1-2 days of rework |
| Svelte Flow re-render cascade at scale | MEDIUM | Isolate each custom node component to self-contained props; profile with Svelte DevTools; usually 1-2 days per node type |
| MCP schema non-compliance discovered at integration | LOW-MEDIUM | Tool schemas are declarative — update type definitions and re-test; typically 2-4 hours per tool |
| Extension pack breaks `calm validate` | HIGH | Requires migrating all stored diagram files to new metadata structure; define a migration script; painful with user data in the field |
| Parser blocks main thread discovered at scale | MEDIUM | Wrap existing parser in a Worker; API stays the same (postMessage in/out); typically 1 day of refactoring |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Bidirectional sync infinite loops | Phase 1 (canvas + CALM round-trip) | Write a test that performs 100 rapid canvas mutations and verifies store update count equals mutation count, not more |
| Tauri 2 + SvelteKit SSR | Phase 1 (project scaffold) | Build and launch Tauri binary in CI from day one; fail CI if binary doesn't launch |
| Svelte Flow re-render cascade | Phase 1 (canvas foundation) | Svelte DevTools render count test: move one node, verify only that node's component re-renders |
| calmscript parser blocking main thread | Phase 2 (calmscript DSL) | Parse a 200-node calmscript file in a Worker; verify main thread frame rate stays > 55fps during parse |
| MCP tool schema non-compliance | Phase 3 (MCP server) | Run MCP Inspector against all tools before merging; include compliance test in CI |
| Extension pack schema breaking CALM validation | Phase 2 (extension packs) | Run `calm validate` against every exported diagram in CI; fail on any validation error |
| CALM import data loss | Phase 1 (CALM round-trip) | Export a CALM file, import it, export again; assert byte-for-byte equality on meaningful fields |
| ELK blocking main thread | Phase 1 (canvas foundation) | Assert ELK runs in a Worker; import a 100-node file and verify main thread never exceeds 16ms frame time |

---

## Sources

- [How To Stop Infinite Loops In Bidirectional Syncs — Valence documentation](https://docs.valence.app/en/latest/guides/stop-infinite-loops.html)
- [How to prevent infinite loops in bi-directional data syncs — Workato](https://www.workato.com/product-hub/how-to-prevent-infinite-loops-in-bi-directional-data-syncs/)
- [SvelteKit + Tauri 2 official guide](https://v2.tauri.app/start/frontend/sveltekit/)
- [Tauri + SvelteKit community experience discussion](https://github.com/tauri-apps/tauri/discussions/6423)
- [SvelteKit `window is not defined` issue](https://github.com/tauri-apps/tauri/issues/6554)
- [Performance — React Flow / Svelte Flow](https://reactflow.dev/learn/advanced-use/performance)
- [Svelte Flow 1.0 release notes](https://xyflow.com/blog/svelte-flow-release)
- [Why your MCP server fails — Agentica / DEV Community](https://dev.to/samchon/why-your-mcp-server-fails-how-to-make-100-successful-mcp-server-iem)
- [MCP Tool Validation Fails Due to Missing Accept Header — open-webui discussion](https://github.com/open-webui/open-webui/discussions/19568)
- [MCP Key Changes — modelcontextprotocol.io changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog)
- [CALM validate documentation — calm.finos.org](https://calm.finos.org/working-with-calm/validate/)
- [CALM Pattern Validation issue — finos/architecture-as-code](https://github.com/finos/architecture-as-code/issues/73)
- [ELK.js GitHub — kieler/elkjs](https://github.com/kieler/elkjs)
- [Incremental Parsing with Tree-sitter](https://dasroot.net/posts/2026/02/incremental-parsing-tree-sitter-code-analysis/)
- [CodeMirror + Vite production build issue in Tauri](https://discuss.codemirror.net/t/tauri-sveltekit-vite-codemirror-6-works-in-dev-breaks-in-production-build/9339)

---
*Pitfalls research for: CalmStudio — visual architecture diagramming tool with CALM JSON, calmscript DSL, Svelte Flow, Tauri 2, MCP server, and extension packs*
*Researched: 2026-03-11*
