# Architecture Research

**Domain:** Visual architecture diagramming tool with bidirectional model-code sync
**Researched:** 2026-03-11
**Confidence:** HIGH (core patterns), MEDIUM (extension pack isolation, calmscript grammar specifics)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Tauri 2 Desktop Shell                           │
│  (Rust backend: file I/O, OS integration, Tauri IPC, MCP server host)  │
├────────────────────────────────┬────────────────────────────────────────┤
│        SvelteKit Frontend      │            MCP Server                  │
│  ┌──────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │    Canvas Layer          │  │  │  calm_create / calm_modify       │  │
│  │  @xyflow/svelte          │  │  │  calm_validate / calm_export     │  │
│  │  (nodes, edges, handles) │  │  │  calm_apply_pattern              │  │
│  └──────────┬───────────────┘  │  │  calm_list_node_types            │  │
│             │ bind:nodes       │  └──────────────┬───────────────────┘  │
│             │ bind:edges       │                 │ Tauri IPC channel    │
│  ┌──────────▼───────────────┐  │  ┌──────────────▼───────────────────┐  │
│  │     Sync Engine          │  │  │    CALM JSON Store               │  │
│  │  (canonical CALM state)  │◄─┼─►│  ($state.raw — single truth)    │  │
│  │  Graph ↔ CALM JSON       │  │  └──────────────────────────────────┘  │
│  └──────────┬───────────────┘  │                                        │
│             │                  │                                        │
│  ┌──────────▼───────────────┐  │                                        │
│  │   calmscript Parser      │  │                                        │
│  │  (text ↔ CALM JSON)      │  │                                        │
│  └──────────┬───────────────┘  │                                        │
│             │                  │                                        │
│  ┌──────────▼───────────────┐  │                                        │
│  │   Extension Pack System  │  │                                        │
│  │  (AWS, GCP, K8s, AI...)  │  │                                        │
│  └──────────────────────────┘  │                                        │
└────────────────────────────────┴────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| CALM JSON Store | Single source of truth for architecture model | Svelte 5 `$state.raw()` module-level store |
| Sync Engine | Translates between CALM JSON and Svelte Flow node/edge format; mediates all writes | Pure functions + reactive subscriptions |
| Canvas Layer | Visual editing via @xyflow/svelte; renders typed nodes/edges/containment | Svelte Flow with custom node/edge components |
| calmscript Parser | Bidirectional text ↔ CALM JSON transform; Mermaid-like DSL | Lexer + PEG parser → AST → CALM JSON emitter |
| Extension Pack System | Loads node type definitions, icons, schema extensions, default properties per domain | Dynamic import registry with typed interfaces |
| MCP Server | Exposes CALM operations as tools to Claude Code and other AI clients | stdio transport, JSON-RPC 2.0, 6-8 focused tools |
| Tauri Shell | File I/O, native file dialogs, window management, MCP server subprocess | Rust backend with `invoke` IPC commands |
| ELK Layout Engine | Auto-layout of imported CALM graphs; runs in Web Worker | elkjs Web Worker mode, async promise API |
| Properties Panel | Editing CALM metadata (interfaces, controls, flows) for selected node/edge | Reactive panel bound to selected element in CALM store |
| Pattern Library | Predefined CALM JSON templates for common architectures | Static JSON files loaded on demand |

## Recommended Project Structure

```
src/
├── lib/
│   ├── store/                  # Global state — CALM JSON as single truth
│   │   ├── calm.svelte.ts      # Core CALM model state ($state.raw)
│   │   ├── selection.svelte.ts # Selected node/edge IDs
│   │   └── ui.svelte.ts        # Sidebar open/close, panel state
│   │
│   ├── sync/                   # Sync engine — translates representations
│   │   ├── calm-to-flow.ts     # CALM JSON → Svelte Flow nodes/edges
│   │   ├── flow-to-calm.ts     # Svelte Flow nodes/edges → CALM JSON
│   │   └── diff.ts             # Structural diffing to avoid full rebuilds
│   │
│   ├── parser/                 # calmscript DSL
│   │   ├── lexer.ts            # Tokenizer
│   │   ├── grammar.ts          # PEG grammar definitions
│   │   ├── parser.ts           # Token stream → AST
│   │   ├── emitter.ts          # AST → CALM JSON
│   │   └── printer.ts          # CALM JSON → calmscript text
│   │
│   ├── extensions/             # Extension pack system
│   │   ├── registry.ts         # Pack loader and registry
│   │   ├── types.ts            # ExtensionPack interface contract
│   │   └── packs/
│   │       ├── aws/            # AWS node types, icons, defaults
│   │       ├── gcp/
│   │       ├── azure/
│   │       ├── kubernetes/
│   │       └── ai-agentic/
│   │
│   ├── canvas/                 # Svelte Flow canvas components
│   │   ├── CalmCanvas.svelte   # Main SvelteFlow wrapper
│   │   ├── nodes/              # Custom node components per CALM type
│   │   │   ├── ServiceNode.svelte
│   │   │   ├── DatabaseNode.svelte
│   │   │   ├── SystemNode.svelte
│   │   │   └── ...
│   │   └── edges/              # Custom edge components
│   │       ├── ConnectsEdge.svelte
│   │       └── DeployedInEdge.svelte
│   │
│   ├── layout/                 # ELK auto-layout
│   │   ├── elk-worker.ts       # Web Worker wrapper for elkjs
│   │   └── transform.ts        # CALM JSON → ELK graph format
│   │
│   ├── mcp/                    # MCP server (runs in Tauri Rust or Node subprocess)
│   │   ├── server.ts           # MCP tool definitions and handlers
│   │   └── tools/              # Individual tool implementations
│   │       ├── create.ts
│   │       ├── modify.ts
│   │       └── validate.ts
│   │
│   ├── validation/             # CALM schema validation
│   │   └── validator.ts        # Wraps calm validate or Ajv
│   │
│   └── patterns/               # Pattern library
│       ├── index.ts            # Pattern registry
│       └── templates/          # CALM JSON template files
│
├── routes/                     # SvelteKit pages
│   ├── +page.svelte            # Main editor
│   └── embed/+page.svelte      # <calm-diagram> web component
│
src-tauri/
├── src/
│   ├── main.rs                 # Tauri entry, MCP subprocess spawn
│   ├── commands/               # Tauri IPC command handlers
│   │   ├── file.rs             # File open/save/watch
│   │   └── calm.rs             # calm validate CLI bridge
│   └── mcp_server/             # Optional: MCP as Rust binary
└── Cargo.toml
```

### Structure Rationale

- **store/**: Single source of truth lives here. All other modules read from or write to these stores. Never bypass the store.
- **sync/**: Deliberately isolated as pure transforms. No UI concerns, no store writes — called by store update handlers only.
- **parser/**: Separated into pipeline stages (lexer → parser → emitter) so each stage can be tested independently and the printer (CALM → text) is symmetric.
- **extensions/**: Registry pattern with a typed interface so third-party packs can be loaded at runtime without modifying core code.
- **canvas/**: Svelte Flow concerns only. Custom nodes receive data from the store via props; they dispatch events upward, never mutate shared state directly.
- **mcp/**: Thin tool handlers that delegate to the CALM store and validation layer. MCP server should have no UI dependencies.

## Architectural Patterns

### Pattern 1: CALM JSON as Single Authoritative State

**What:** One `$state.raw()` module-level object holds the complete CALM JSON model. All three representations (Svelte Flow nodes/edges, calmscript text, CALM JSON) are derived from or synchronized back to this one store.

**When to use:** Always. This is the foundational invariant of the entire system.

**Trade-offs:** Requires disciplined routing of all writes through the store; prevents "shortcutting" by having canvas mutations directly update nodes without going through CALM format.

**Example:**
```typescript
// src/lib/store/calm.svelte.ts
import type { CalmModel } from '$lib/types/calm';

let _model = $state.raw<CalmModel>({ nodes: [], relationships: [], metadata: {} });

export const calmStore = {
  get current() { return _model; },
  update(patch: Partial<CalmModel>) {
    _model = { ..._model, ...patch };
  },
  replaceAll(model: CalmModel) {
    _model = model;
  }
};
```

### Pattern 2: Sync Engine as Unidirectional Translation Layer

**What:** The Sync Engine has two pure functions: `calmToFlow(model)` and `flowToCalm(nodes, edges)`. These are called by event handlers, never by components. The Canvas Layer uses Svelte Flow's `bind:nodes` and `bind:edges` to expose node/edge state, which the sync engine reads when a change event fires.

**When to use:** Whenever the visual canvas or the text editor produce a change — translate to CALM JSON and write to the store. The store then triggers downstream reactive updates.

**Trade-offs:** Requires careful change event handling in Svelte Flow to avoid infinite loops (canvas change → sync → store update → derived nodes → canvas change). Use a "syncing" flag or compare before writing.

**Example:**
```typescript
// src/lib/sync/calm-to-flow.ts
export function calmToFlow(model: CalmModel): { nodes: Node[], edges: Edge[] } {
  const nodes = model.nodes.map(n => ({
    id: n['unique-id'],
    type: n['node-type'],   // maps to custom Svelte Flow node component
    position: n.metadata?.position ?? { x: 0, y: 0 },
    data: n,                // full CALM node as Svelte Flow data payload
  }));
  const edges = model.relationships.map(r => ({
    id: r['unique-id'],
    source: r.relationship?.['connects']?.source?.['node'] ?? '',
    target: r.relationship?.['connects']?.destination?.['node'] ?? '',
    type: detectEdgeType(r),
    data: r,
  }));
  return { nodes, edges };
}
```

### Pattern 3: calmscript Parser Pipeline (Lexer → Parser → AST → Emitter)

**What:** A four-stage pipeline mirroring how Mermaid is built. The lexer tokenizes calmscript text, the parser builds a typed AST, the emitter transforms AST → CALM JSON, and the printer goes in reverse (CALM JSON → calmscript text).

**When to use:** For the calmscript text editor pane. The printer runs on every store update to refresh the text editor. The emitter runs when the user edits calmscript and saves.

**Trade-offs:** Building a parser is non-trivial. Use a parser combinator library (nearley.js or ohm-js) rather than hand-rolling a PEG parser — this keeps the grammar declarative and testable. A hand-written recursive descent parser is also viable for a simple DSL and avoids a dependency.

**Example pipeline:**
```
"service api-gateway\n  connects payment-service\n  deployed-in k8s-cluster"
     │
     ▼ Lexer
[KEYWORD:"service"] [IDENT:"api-gateway"] [NEWLINE]
[INDENT] [KEYWORD:"connects"] [IDENT:"payment-service"] [NEWLINE]
[INDENT] [KEYWORD:"deployed-in"] [IDENT:"k8s-cluster"]
     │
     ▼ Parser (builds typed AST)
{ type: "node", nodeType: "service", id: "api-gateway",
  relationships: [
    { type: "connects", target: "payment-service" },
    { type: "deployed-in", target: "k8s-cluster" }
  ]
}
     │
     ▼ Emitter (produces CALM JSON)
{ "unique-id": "api-gateway", "node-type": "service", ... }
```

### Pattern 4: Extension Pack Registry

**What:** Extension packs are plain JavaScript modules that export an `ExtensionPack` object. The registry dynamically imports them, validates the interface, and merges their node type definitions into the global type registry.

**When to use:** At app startup for bundled packs; on-demand for user-installed packs. Packs should be pure data + icon SVGs — no arbitrary code execution at load time.

**Trade-offs:** Dynamic import means packs cannot be tree-shaken. For the desktop app this is acceptable. For the web component, packs should be explicitly imported.

**Example interface:**
```typescript
interface ExtensionPack {
  id: string;                      // "aws", "kubernetes"
  version: string;
  nodeTypes: NodeTypeDefinition[];  // maps CALM node-type strings to display info
  edgeTypes?: EdgeTypeDefinition[];
  patterns?: PatternTemplate[];     // pre-built architectures using these types
}

interface NodeTypeDefinition {
  type: string;           // "aws-s3-bucket" — used as CALM node-type value
  label: string;          // "S3 Bucket"
  icon: string;           // SVG string or URL
  component?: string;     // name of custom Svelte component to use
  defaultProperties?: Record<string, unknown>;
}
```

### Pattern 5: MCP Server — Minimal Tools, Delegate to Store

**What:** The MCP server exposes 6-8 focused tools (`calm_create_node`, `calm_connect`, `calm_apply_pattern`, `calm_validate`, `calm_export`, `calm_list_types`, `calm_get_diagram`, `calm_import`). Each tool handler deserializes inputs, applies them to the CALM JSON model, runs validation, and returns the updated model or validation results as text.

**When to use:** The MCP server runs as a subprocess (stdio transport) for local use with Claude Code and similar tools.

**Trade-offs:** The MCP server needs access to the live diagram state, which means it either (a) reads/writes files as the canonical store (simpler, works for desktop), or (b) communicates via Tauri IPC to the frontend store (more complex, needed for live preview). Start with file-based for v1.

**Example tool definition:**
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'calm_create_node') {
    const { nodeType, id, label, packId } = request.params.arguments;
    const newNode = buildCalmNode({ nodeType, id, label, packId });
    const model = loadCurrentModel();       // reads from .calm file
    model.nodes.push(newNode);
    saveModel(model);                       // writes .calm file
    return { content: [{ type: 'text', text: JSON.stringify(newNode) }] };
  }
});
```

## Data Flow

### Flow 1: User Drags New Node onto Canvas

```
User drops node from palette
    │
    ▼
Canvas Layer (onDrop handler)
    │  creates CALM-typed node with generated unique-id
    ▼
flow-to-calm.ts (translate new node to CALM node object)
    │
    ▼
calmStore.update({ nodes: [...existing, newCalmNode] })
    │
    ├──► calmToFlow() re-derives Svelte Flow nodes → canvas re-renders
    ├──► printer() re-derives calmscript text → text editor refreshes
    └──► validator() runs async CALM schema check → badge updates
```

### Flow 2: User Edits calmscript Text

```
User types in calmscript editor (debounced ~300ms)
    │
    ▼
Lexer → Parser → AST
    │  (on parse error: show inline error, stop)
    ▼
Emitter → CALM JSON model
    │
    ▼
calmStore.replaceAll(newModel)
    │
    ├──► calmToFlow() → canvas re-renders with ELK auto-layout if structural change
    └──► validator() → updates validation badge
```

### Flow 3: CALM JSON Import (File Open)

```
User opens .calm file (Tauri file dialog)
    │
    ▼
Tauri IPC: invoke('read_calm_file', { path })
    │  returns raw CALM JSON string
    ▼
JSON.parse → validate schema (Ajv or calm CLI)
    │
    ▼
calmStore.replaceAll(parsed)
    │
    ▼
ELK layout engine (Web Worker)
    │  runs hierarchical layout on full graph
    │  returns positioned nodes
    ▼
calmToFlow(positionedModel) → Svelte Flow renders
```

### Flow 4: MCP Tool Call from Claude Code

```
Claude Code: calm_create_node({ nodeType: "aws-s3-bucket", id: "user-uploads" })
    │
    ▼ stdio transport
MCP Server (subprocess or Tauri Rust command)
    │
    ▼
Read current .calm file from disk
    │
    ▼
Build new CALM node with extension pack defaults (aws pack)
    │
    ▼
Validate node against CALM schema
    │
    ▼
Write updated .calm file
    │
    ▼ file system watch trigger
Frontend detects file change → reload → store update → canvas refresh
    │
    ▼
Return { content: [{ type: "text", text: updated_node_json }] }
```

### State Management

```
CALM JSON Store ($state.raw)
    │
    ├──► $derived: calmToFlow()    →  bind:nodes / bind:edges → SvelteFlow
    ├──► $derived: printer()       →  calmscript text editor content
    ├──► $derived: validator()     →  validation badge / errors panel
    └──► $effect: writeFile()      →  auto-save to .calm file (debounced)

User action (canvas, text editor, MCP, file open)
    └──► writes to CALM JSON Store only
         (never writes directly to derived representations)
```

## Suggested Build Order

Dependencies determine order. Each phase unlocks the next.

| Order | Component | Depends On | Rationale |
|-------|-----------|------------|-----------|
| 1 | CALM JSON Store + types | nothing | Everything else reads/writes this |
| 2 | Sync Engine (calm↔flow) | CALM store types | Canvas needs this to display anything |
| 3 | Canvas Layer (Svelte Flow nodes/edges) | Sync engine | Core editing surface |
| 4 | calmscript Parser (emitter only) | CALM types | Needed to generate text from model |
| 5 | calmscript Printer (CALM → text) | Parser AST types | Text pane reads from store |
| 6 | Extension Pack Registry | CALM types, Canvas node components | AWS/K8s nodes need to register before canvas renders them |
| 7 | ELK Auto-layout | Sync engine | Required for import; optional for manual editing |
| 8 | CALM Validation | CALM store | Needed for real-time error feedback |
| 9 | Properties Panel | CALM store, selection state | Edits CALM metadata for selected elements |
| 10 | MCP Server | All above (reads .calm files) | Can be developed independently once file format stable |
| 11 | Tauri Shell | All frontend complete | File system integration wraps working web app |
| 12 | Pattern Library | Extension packs, CALM store | Templates compose existing capabilities |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single-user desktop | Current architecture is correct. CALM store is in-memory, file is source of truth on disk. |
| VS Code extension / web embed | Extract sync engine and parser as framework-agnostic packages. Canvas layer stays Svelte. |
| Multi-user collaboration (v2+) | Replace file-based sync with CRDT (Yjs or Automerge) on the CALM JSON model. Store becomes a CRDT document, not $state.raw. |
| Large diagrams (500+ nodes) | ELK sub-layouts per sub-graph (partial layout). Svelte Flow virtualization for off-screen nodes. $state.raw already avoids deep reactivity. |

### Scaling Priorities

1. **First bottleneck:** ELK layout on large graphs (blocking even in Web Worker for 200+ nodes). Mitigation: incremental layout — only re-layout the sub-graph affected by a change, not the full graph.
2. **Second bottleneck:** Full model re-derive on every keystroke in calmscript editor. Mitigation: debounce at 300ms, parse only the changed statement (incremental parsing).

## Anti-Patterns

### Anti-Pattern 1: Two-Way Binding Without a Single Source of Truth

**What people do:** Store CALM JSON in one place, Svelte Flow nodes/edges in another, and try to keep them in sync with watchers/effects on both sides.

**Why it's wrong:** Sync loops, conflicts, divergence when one side crashes mid-update. Every tool (canvas, text editor, MCP, file import) becomes responsible for syncing all other tools.

**Do this instead:** CALM JSON store is the single source of truth. Canvas nodes are `$derived` from it. Text editor content is `$derived` from it. All mutations go through `calmStore.update()`.

### Anti-Pattern 2: Extension Packs as Arbitrary Code with Schema Modifications

**What people do:** Allow packs to modify the CALM JSON Schema or run arbitrary Svelte components bundled by the pack author.

**Why it's wrong:** Security risk (arbitrary code execution), schema conflicts between packs, impossible to validate CALM compatibility.

**Do this instead:** Packs are pure data (JSON node type definitions + SVG icons). Custom visual rendering uses a fixed set of parameterizable base node components. Schema stays CALM-compliant; extension types are `node-type` string values, not new JSON Schema fields.

### Anti-Pattern 3: MCP Server with Too Many Fine-Grained Tools

**What people do:** Expose every CALM property as a separate MCP tool (`set_node_label`, `set_node_type`, `add_interface`, `add_control`, `set_flow_name`...).

**Why it's wrong:** AI models struggle with tool selection overhead; 40 tools means 40 descriptions to parse. Security audit of 43% of early MCP servers found injection vulnerabilities when input surface is large.

**Do this instead:** 6-8 semantic tools with rich JSON input schemas: `calm_create_node` accepts a full node definition object, `calm_connect` accepts source/target/relationship-type. Fewer tools, richer inputs.

### Anti-Pattern 4: Coupling calmscript Parser to Svelte Components

**What people do:** Put parsing logic inside Svelte components or make parser depend on extension pack registry at parse time.

**Why it's wrong:** Parser can't be tested in isolation, can't run in MCP server subprocess, can't be used in VS Code extension without a Svelte runtime.

**Do this instead:** Parser is a plain TypeScript module with zero UI dependencies. Extension pack types are passed in as a configuration argument (`parse(text, { knownTypes: registry.allTypes() })`), not imported directly.

### Anti-Pattern 5: Synchronous ELK Layout on the Main Thread

**What people do:** Call `elk.layout()` without a Web Worker on import of a large diagram.

**Why it's wrong:** ELK is GWT-compiled Java — layout computation for 50+ nodes can block the main thread for hundreds of milliseconds, freezing the UI.

**Do this instead:** Always use elkjs in Web Worker mode. Show a loading state on the canvas during layout. The elkjs library has official Web Worker support.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| CALM CLI (`calm validate`) | Tauri IPC spawns subprocess; result returned via channel | Requires CALM CLI installed; provide bundled fallback using Ajv + CALM schema JSON |
| Claude Code / AI clients | MCP stdio server, JSON-RPC 2.0 | Local-only for desktop v1; HTTP for future web/remote use |
| ELK Layout Engine | Web Worker + Promise API | Ship elkjs in bundle; no network call needed |
| VS Code Extension | Iframe or custom editor contribution; communicates via postMessage | Separate package sharing parser and types from core |
| GitHub Actions | Node.js script using calmscript parser + CALM validator | No UI dependency; parser module exports work in Node |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Canvas ↔ CALM Store | Svelte Flow bind:nodes/bind:edges + onNodesChange event → sync engine | Sync engine is the only thing that writes to store from canvas events |
| MCP Server ↔ CALM Store | File system (.calm file as shared state) for v1; Tauri IPC channel for live preview | File-based is simpler and correct for desktop; enables MCP and frontend to be independent processes |
| Extension Packs ↔ Canvas | Registry provides NodeTypeDefinition; canvas maps type string to Svelte component | Canvas has a fixed set of base node components; pack icons are rendered via SVG data in the component |
| Tauri Rust ↔ SvelteKit | Tauri IPC commands (`invoke`); Raw Requests for large CALM JSON payloads | Use Tauri 2's raw request mode for payloads >4KB to avoid JSON serialization overhead |
| Parser ↔ All | Pure function import — no shared state, no side effects | Parser is a TypeScript library, not a service |

## How Existing Tools Handle Visual-to-Model Sync

### Structurizr: Code as Master, Views as Projections

Structurizr defines a **single code model** (workspace DSL) from which multiple diagram views are generated. There is no bidirectional sync — the model is the master, diagrams are read-only projections. Layout positions are stored separately.

**Lesson for CalmStudio:** The single-model approach is correct. CALM JSON is the master; canvas and calmscript are projections. However, CalmStudio needs bidirectionality (canvas and text can both edit), which Structurizr avoids by making views read-only.

### IcePanel: Object Model with Visual Positions Stored Separately

IcePanel maintains an object model (elements and relationships) and stores visual layout positions as a separate concern. Drag events update positions without touching the semantic model; model changes (add/remove elements) trigger canvas updates.

**Lesson for CalmStudio:** Store element positions in CALM `metadata.position` (separate from semantic data) so layout changes don't dirty the architecture model. This is the right pattern.

### Ilograph: YAML as Master, Auto-Layout Always

Ilograph uses YAML as the authoritative model; the visual canvas is always auto-generated from the YAML. No manual positioning — the tool optimizes for keeping the model clean over giving users layout control.

**Lesson for CalmStudio:** Auto-layout on import is correct. For ongoing editing, users need position persistence (IcePanel's approach) because architecture diagrams are communication artifacts and layout choice carries meaning.

## Sources

- [Svelte Flow Quickstart — $state.raw pattern](https://svelteflow.dev/learn)
- [Svelte Flow 1.0 release — runes migration, $state.raw for nodes/edges](https://xyflow.com/blog/svelte-flow-release)
- [xyflow/xyflow GitHub — SvelteFlow internal architecture](https://github.com/xyflow/xyflow)
- [MCP Architecture Overview — tools, resources, prompts, stdio transport](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP Design Patterns — "Less is More" tool design](https://www.klavis.ai/blog/less-is-more-mcp-design-patterns-for-ai-agents)
- [elkjs GitHub — GWT-compiled ELK, Web Worker mode](https://github.com/kieler/elkjs)
- [ELK.js Layout example — Svelte Flow integration](https://svelteflow.dev/examples/layout/elkjs)
- [Mermaid Architecture Deep Dive — Lexer → Parser → AST → Renderer pipeline](https://www.mostlylucid.net/blog/en/mermaid-js-deep-dive)
- [IcePanel vs Structurizr comparison — model sync approaches](https://icepanel.medium.com/comparison-icepanel-vs-structurizr-7036c8762147)
- [Structurizr Getting Started — single model, multiple views pattern](https://deepwiki.com/structurizr/structurizr.github.io/2-getting-started)
- [Tauri 2 SvelteKit Integration — IPC, raw requests, adapter-static](https://v2.tauri.app/start/frontend/sveltekit/)
- [Designing a JavaScript Plugin System — dynamic import, registry pattern](https://dev.to/omriluz1/designing-a-robust-plugin-system-for-javascript-applications-1hj3)
- [Bidirectional transformation framework for visual editing (academic)](https://link.springer.com/content/pdf/10.1007/s11432-013-4919-1.pdf)

---
*Architecture research for: CalmStudio — visual CALM architecture diagramming tool*
*Researched: 2026-03-11*
