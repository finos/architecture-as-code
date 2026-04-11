# Phase 5: MCP Server - Research

**Researched:** 2026-03-12
**Domain:** MCP TypeScript SDK, stdio/HTTP transports, ELK.js SVG rendering, npm publish
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tool design — Excalidraw MCP-inspired**
- Full CRUD pattern for nodes and relationships: create, get, update, delete, query, batch_create
- `create_architecture` accepts structured node/relationship data — AI client (Claude) interprets the user's description and maps to CALM types; no LLM call inside the server (pure function, zero API key dependencies)
- `validate_architecture` checks .calm file against CALM schema, returns errors/warnings
- `render_diagram` generates SVG using ELK layout (server-side, headless)
- `export_calm` / `import_calm` for file I/O
- `describe_architecture` returns structured text summary of current state
- `read_calm_guide` guidance tool — returns CALM type reference (9 node types, 5 relationship types, interfaces, controls, example architectures) so AI learns CALM vocabulary before creating

**Transport modes**
- Single `@calmstudio/mcp` package supports both modes via startup flag
- Default: stdio transport for Claude Code CLI
- `--http --port 3100`: streamable HTTP transport for Claude Cowork (MCP App pattern)
- Shared tool handlers — transport is just a startup flag

**MCP App visual rendering (Claude Cowork)**
- `create_view` / `update_view` render architecture as static SVG in Claude Cowork
- ELK layout applied server-side, styled nodes with CALM type shapes
- SVG replaced on each update (not incremental)
- Interactive editing deferred to desktop app

**Open in CalmStudio**
- MCP tools return `calmstudio://open?file=/path/to/file.calm` deep link
- Tauri 2 URL scheme registration happens in Phase 9 (Desktop App)
- MCP server generates the link now; it becomes clickable once desktop app is installed

**File & state model**
- File-backed, auto-save: every mutation reads .calm file, operates, writes back immediately
- No in-memory sessions, no background threads, no file watchers
- Default file: `./architecture.calm` if no path specified; override via `file` parameter on any tool
- `.calmstudio.json` sidecar written alongside `.calm` with ELK-computed positions, viewport, extension pack references
- `.calm` stays pure CALM JSON (FINOS spec); `.calmstudio.json` is CalmStudio-specific visual metadata
- No file watching in v1 — reads on demand, external edits picked up on next tool call

**Distribution & config**
- Published as `@calmstudio/mcp` on npm (note: current stub is `@calmstudio/mcp-server` — must rename to `@calmstudio/mcp` for publishing)
- Install: `npm install -g @calmstudio/mcp` or use `npx @calmstudio/mcp`
- Built on `@modelcontextprotocol/sdk` (official TypeScript SDK) for protocol compliance and MCP Inspector compatibility
- Zero config — no config file needed; defaults work out of the box
- Extension packs auto-detected from `.calmstudio.json` if present
- Auto-publish on merge to main via semantic-release (existing CI/CD from Phase 1)

**Error handling**
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

### Deferred Ideas (OUT OF SCOPE)
- Interactive iframe rendering in Claude Cowork (vs static SVG) — evaluate after v1 SVG works
- File watching for external changes — evaluate based on user feedback
- Web URL fallback for "open in CalmStudio" (hosted web viewer) — v2+
- Snapshot/restore tools (like Excalidraw's snapshot_scene/restore_snapshot) — evaluate need after usage
- Config file support (.calmstudiorc) — add if zero-config proves insufficient
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCPS-01 | MCP server exposes `create_architecture` tool (description -> calmscript + CALM JSON) | McpServer.tool() with Zod schema; pure function mapping node/rel arrays to CalmArchitecture |
| MCPS-02 | MCP server exposes `add_node` and `add_relationship` tools | File-read-mutate-write pattern; dangling ref validation before write |
| MCPS-03 | MCP server exposes `validate_architecture` tool | CALM schema validation using type guards on CalmArchitecture; returns errors/warnings array |
| MCPS-04 | MCP server exposes `render_diagram` tool (-> SVG) | elkjs for layout + elkjs-svg for server-side SVG rendering; no DOM required |
| MCPS-05 | MCP server exposes `export_calm` and `import_calm` tools | fs.readFileSync/writeFileSync; JSON parse/stringify; no browser APIs needed |
| MCPS-06 | MCP server installable via `npm install -g @calmstudio/mcp` | package.json `bin` field + `#!/usr/bin/env node` shebang; tsc build to dist/ |
| MCPS-07 | MCP server works with Claude Code and any MCP-compatible AI assistant | StdioServerTransport (default) + NodeStreamableHTTPServerTransport (--http flag); MCP Inspector for compliance |
</phase_requirements>

## Summary

The MCP TypeScript SDK (`@modelcontextprotocol/sdk` v1.27.1) provides all primitives needed: `McpServer`, `StdioServerTransport`, and `NodeStreamableHTTPServerTransport`. The standard pattern is to create an `McpServer`, register tools with Zod schemas, then connect to the appropriate transport based on a startup flag. The existing workspace already has ELK.js (elkjs 0.11.1) installed, and `elkjs-svg` can convert ELK layout output to SVG server-side with zero DOM dependency.

The MCP server is a pure Node.js process: it reads and writes `.calm` files directly from the filesystem, imports `@calmstudio/calm-core` types for type safety, and uses ELK + elkjs-svg for server-side SVG generation. The `@calmstudio/mcp-server` stub package needs to be renamed to `@calmstudio/mcp` (the public package name) and wired up with a build pipeline (tsc + chmod), a `bin` entry, and a `#!/usr/bin/env node` shebang.

The single most important pitfall is **never writing to stdout** in stdio mode — `console.log` corrupts the JSON-RPC framing. All logging must go to `console.error` (stderr). Tool responses use `{ content: [{ type: 'text', text: '...' }], isError: false/true }` format per MCP spec v2025-11-25.

**Primary recommendation:** Use `McpServer` from `@modelcontextprotocol/sdk`, register all tools with Zod schemas, connect via `StdioServerTransport` by default or `NodeStreamableHTTPServerTransport` when `--http` flag is passed. Each tool handler follows: read file → mutate in memory → write file → return summary content response.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | ^1.27.1 | MCP server primitives (McpServer, transports, Zod integration) | Official Anthropic SDK; required for MCP Inspector compliance |
| `zod` | ^3.x (SDK peer dep) | Tool input schema definition + runtime validation | Required peer dep of MCP SDK; used throughout SDK |
| `elkjs` | ^0.11.1 (already installed) | Graph layout computation for render_diagram | Already used in Phase 4; same version in node_modules |
| `elkjs-svg` | latest | Convert ELK layout output to SVG string (server-side, no DOM) | Only library that takes layouted ELK JSON -> SVG with zero dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` | built-in | Read/write .calm and .calmstudio.json files | All file I/O in tool handlers |
| `node:path` | built-in | Path resolution for default file location | When resolving `./architecture.calm` default |
| `tsup` (optional) | latest | Bundle to single CJS/ESM output | Consider if tree-shaking matters; tsc is simpler for a CLI tool |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@modelcontextprotocol/sdk` | `fastmcp` | fastmcp adds convenience wrappers but adds dependency; official SDK is the compliance guarantee |
| tsc build | tsup | tsup bundles; tsc produces clean .d.ts files; for a published CLI tool tsc is more transparent |
| elkjs-svg | Custom SVG template strings | Custom approach is brittle for edge/label positioning; elkjs-svg handles coordinate math from ELK output |

### Installation
```bash
pnpm add @modelcontextprotocol/sdk zod elkjs-svg
# elkjs already in workspace node_modules (used by studio)
# Add to packages/mcp-server/package.json dependencies
```

---

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/
├── src/
│   ├── index.ts           # Entry point: arg parsing, transport selection, server.connect()
│   ├── server.ts          # McpServer creation + all tool registrations
│   ├── tools/
│   │   ├── architecture.ts  # create_architecture, describe_architecture, validate_architecture
│   │   ├── nodes.ts         # add_node, get_node, update_node, delete_node, query_nodes, batch_create_nodes
│   │   ├── relationships.ts # add_relationship, get_relationship, update_relationship, delete_relationship
│   │   ├── io.ts            # export_calm, import_calm
│   │   ├── render.ts        # render_diagram (ELK + elkjs-svg)
│   │   └── guide.ts         # read_calm_guide
│   ├── file-io.ts           # readCalmFile(), writeCalmFile(), readSidecar(), writeSidecar()
│   └── validation.ts        # validateArchitecture() — pure function, returns ValidationResult[]
├── package.json             # name: "@calmstudio/mcp", bin: { "calmstudio-mcp": "dist/index.js" }
├── tsconfig.json
└── .releaserc.json          # already exists
```

### Pattern 1: Tool Handler — Read-Mutate-Write
**What:** Every mutating tool reads the .calm file, operates in memory, writes back.
**When to use:** All tools that add/update/delete nodes or relationships.
**Example:**
```typescript
// Source: CONTEXT.md decisions + @modelcontextprotocol/sdk docs pattern
server.tool(
  'add_node',
  { title: 'Add Node', description: 'Add a node to the architecture', inputSchema: AddNodeSchema },
  async (args) => {
    const filePath = resolveFile(args.file);
    const arch = readCalmFile(filePath);          // throws on missing file
    const node = buildNode(args);
    arch.nodes.push(node);
    writeCalmFile(filePath, arch);
    return {
      content: [{ type: 'text', text: `Added node ${node['unique-id']} (${node['node-type']}: ${node.name})` }],
      isError: false,
    };
  }
);
```

### Pattern 2: Transport Selection via Startup Flag
**What:** Single entry point checks `--http` flag; connects to appropriate transport.
**When to use:** index.ts startup.
**Example:**
```typescript
// Source: @modelcontextprotocol/sdk server docs
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const useHttp = process.argv.includes('--http');
const port = getPortArg() ?? 3100;

if (useHttp) {
  // HTTP mode: create transport per request, attach to Express/http server
  const app = createHttpServer(server, port);
  app.listen(port, () => console.error(`[calmstudio-mcp] HTTP server on :${port}`));
} else {
  // stdio mode: connect directly
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // CRITICAL: never console.log after this point — corrupts stdio framing
}
```

### Pattern 3: MCP Tool Response Format
**What:** All tools return `CallToolResult` with `content` array.
**When to use:** Every tool handler return value.
**Example:**
```typescript
// Source: MCP spec 2025-11-25 tools page
// Success
return {
  content: [{ type: 'text', text: 'Created architecture with 3 nodes, 2 relationships. File: ./architecture.calm' }],
  isError: false,
};

// Error (application-level — not a thrown exception)
return {
  content: [{ type: 'text', text: 'Node "svc-99" not found. Available node IDs: svc-1, db-1, actor-1' }],
  isError: true,
};
```

### Pattern 4: Server-Side SVG via ELK + elkjs-svg
**What:** Layout with elkjs, then render with elkjs-svg Renderer.
**When to use:** `render_diagram` and `create_view` / `update_view` tools.
**Example:**
```typescript
// Source: elkjs-svg GitHub README
import ELK from 'elkjs/lib/elk.bundled.js';
import * as elksvg from 'elkjs-svg';

const elk = new ELK();
const layouted = await elk.layout(graph);  // same as Phase 4 elkLayout.ts
const renderer = new elksvg.Renderer();
const svgString = renderer.toSvg(
  layouted,
  customStyles,   // optional CSS string for CALM node type colors/shapes
  customDefs,     // optional SVG defs (markers, gradients)
);
// svgString is a complete <svg>...</svg> string — return as text content
```

### Pattern 5: McpServer Registration
**What:** Canonical tool registration with Zod schema on McpServer.
**When to use:** All tool definitions in server.ts.
**Example:**
```typescript
// Source: modelcontextprotocol/typescript-sdk docs/server.md
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'calmstudio',
  version: '0.1.0',
});

server.tool(
  'create_architecture',
  {
    title: 'Create Architecture',
    description: 'Create a new CALM architecture from structured node and relationship data',
    inputSchema: z.object({
      nodes: z.array(NodeInputSchema).describe('Array of nodes to create'),
      relationships: z.array(RelationshipInputSchema).optional().default([]),
      file: z.string().optional().describe('Path to .calm file (default: ./architecture.calm)'),
    }),
  },
  async (args) => { /* handler */ }
);
```

### Anti-Patterns to Avoid
- **console.log in stdio mode:** Writes to stdout and corrupts JSON-RPC framing. Use `console.error` for all server-side logging.
- **Throwing exceptions for business logic errors:** Return `{ isError: true, content: [...] }` instead. Only throw for truly unexpected errors (disk full, etc.) which become protocol-level errors.
- **Returning full CalmArchitecture JSON in every response:** Wastes tokens; return summary strings with affected IDs only (per CONTEXT.md decision).
- **In-memory session state:** The server is stateless — no Map of open files. Read from disk on every call.
- **Using `zod` v4 for inputSchema descriptions with MCP SDK 1.x:** Known issue (SDK issue #1143) — `z.string().describe()` descriptions may not propagate to JSON schema in MCP SDK 1.x with Zod v4. Use Zod v3 (the SDK peer dep) to ensure `.describe()` works.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Protocol framing (JSON-RPC) | Custom stdio reader/writer | `@modelcontextprotocol/sdk` StdioServerTransport | Binary framing, content-length headers, request/response ID matching — impossible to get right manually |
| Zod -> JSON Schema conversion | Manual schema serialization | SDK does it automatically from Zod inputSchema | MCP Inspector compliance requires exact JSON Schema 2020-12 format |
| Graph layout for SVG | Manual x/y calculation | `elkjs` + `elkjs-svg` | Edge routing, label placement, node spacing — weeks of work |
| MCP protocol negotiation | Custom handshake code | SDK's McpServer.connect() | Capability negotiation, initialization sequence, version handshake |
| Tool input validation | Custom validators | Zod schemas in inputSchema | SDK validates automatically before calling handler; type-safe args |

**Key insight:** The SDK converts Zod schemas to JSON Schema automatically, validates incoming tool calls against them, and provides type-safe `args` to handlers. Never bypass this.

---

## Common Pitfalls

### Pitfall 1: stdout Pollution in stdio Mode
**What goes wrong:** Any `console.log()`, `process.stdout.write()`, or third-party library writing to stdout silently corrupts JSON-RPC messages. The MCP client receives garbled frames and disconnects with no clear error.
**Why it happens:** stdio transport uses stdout as the protocol channel; anything else written to it breaks the framing.
**How to avoid:** Replace all `console.log` with `console.error` in the entire mcp-server package. Audit third-party deps (elkjs prints nothing; be aware of any future debug logging).
**Warning signs:** `Connection closed` errors in Claude Code immediately on startup; MCP Inspector shows "parse error" immediately.

### Pitfall 2: Package Name Mismatch
**What goes wrong:** Current stub is `@calmstudio/mcp-server` (private) but the publishable name must be `@calmstudio/mcp`. If not renamed, `npm install -g @calmstudio/mcp` will install the wrong package.
**Why it happens:** The stub was created with a different name before the public package name was decided.
**How to avoid:** Change `name` in `packages/mcp-server/package.json` from `@calmstudio/mcp-server` to `@calmstudio/mcp`, set `"private": false`, add `"bin"` field.

### Pitfall 3: Missing Shebang + Executable Bit
**What goes wrong:** `npx @calmstudio/mcp` works on install, but `calmstudio-mcp` binary is not executable on Linux/macOS.
**Why it happens:** npm sets executable bits based on the `bin` field only if the file starts with `#!/usr/bin/env node`.
**How to avoid:** First line of `dist/index.js` must be `#!/usr/bin/env node`. Build script must include `chmod 755 dist/index.js` (the standard MCP server pattern).

### Pitfall 4: ESM Module Resolution for elkjs
**What goes wrong:** `import ELK from 'elkjs'` fails with ESM/CJS interop errors when the mcp-server package is `"type": "module"`.
**Why it happens:** elkjs ships CommonJS; ESM packages need the `.bundled.js` path.
**How to avoid:** Use `import ELK from 'elkjs/lib/elk.bundled.js'` — exactly as done in `apps/studio/src/lib/layout/elkLayout.ts` (established pattern in this repo).

### Pitfall 5: Zod v4 Description Propagation Bug
**What goes wrong:** Tool parameters show in MCP Inspector without descriptions, making tools harder for AI to use.
**Why it happens:** MCP SDK 1.x has a known issue (#1143) where Zod v4 `.describe()` calls don't always propagate to the generated JSON schema.
**How to avoid:** Check that the MCP SDK is using Zod v3 as its peer dep (it is as of 1.27.1). Don't upgrade to Zod v4 until the SDK explicitly supports it.

### Pitfall 6: moduleResolution Incompatibility for Published Package
**What goes wrong:** `tsconfig.base.json` uses `"moduleResolution": "bundler"` which is a Vite/SvelteKit idiom; the mcp-server is a standalone Node.js CLI, not bundled.
**Why it happens:** Bundler resolution allows extensionless imports that Node.js doesn't support at runtime.
**How to avoid:** Override in `packages/mcp-server/tsconfig.json` with `"moduleResolution": "Node16"` and `"module": "Node16"`, add `.js` extensions to all local imports in compiled output. Alternatively use `tsup` which handles this automatically.

### Pitfall 7: Windows npx Execution
**What goes wrong:** Users on native Windows (not WSL) get "Connection closed" errors when adding the server via `claude mcp add`.
**Why it happens:** Windows cannot execute `npx` directly; needs `cmd /c` wrapper.
**How to avoid:** Document the Windows installation command in README: `claude mcp add --transport stdio calmstudio -- cmd /c npx -y @calmstudio/mcp`. This is a Claude Code limitation, not a server bug.

### Pitfall 8: File Not Found vs Empty Architecture
**What goes wrong:** Tool called on non-existent file either crashes (unhandled error becomes protocol error) or silently creates a broken state.
**Why it happens:** First-call scenario — no architecture file exists yet.
**How to avoid:** `readCalmFile()` should auto-create `{ nodes: [], relationships: [] }` when file doesn't exist (not an error). `import_calm` is the explicit import path; other tools auto-init.

---

## Code Examples

Verified patterns from official sources:

### McpServer + StdioServerTransport Setup
```typescript
// Source: modelcontextprotocol/typescript-sdk docs/server.md
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'calmstudio', version: '1.0.0' });

// ... register tools ...

const transport = new StdioServerTransport();
await server.connect(transport);
// Process stays alive; SDK handles JSON-RPC message loop
```

### Error Response (isError: true)
```typescript
// Source: MCP specification 2025-11-25 tools page
return {
  content: [{
    type: 'text',
    text: 'Relationship "rel-99" references unknown node "svc-99". Available: svc-1, db-1'
  }],
  isError: true,
};
```

### SVG Return from render_diagram
```typescript
// Source: elkjs-svg README + MCP spec content types
const svgString = renderer.toSvg(layouted, styles, defs);
return {
  content: [{
    type: 'text',
    text: svgString,  // full <svg>...</svg> string
  }],
  isError: false,
};
// Note: MCP spec has an 'image' content type but Claude Code renders text SVG inline too.
// Keep as text/svg string for broadest compatibility.
```

### Claude Code Registration Command
```bash
# Source: code.claude.com/docs/en/mcp
claude mcp add --transport stdio calmstudio -- npx -y @calmstudio/mcp

# Project-scoped (checked into .mcp.json for team sharing)
claude mcp add --transport stdio --scope project calmstudio -- npx -y @calmstudio/mcp

# With specific file path
claude mcp add --transport stdio calmstudio -- npx -y @calmstudio/mcp --file /path/to/arch.calm
```

### package.json for Published CLI
```json
{
  "name": "@calmstudio/mcp",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "bin": {
    "calmstudio-mcp": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc && node -e \"require('fs').chmodSync('dist/index.js', '755')\"",
    "prepare": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "zod": "^3.x",
    "elkjs": "^0.11.1",
    "elkjs-svg": "^latest"
  }
}
```

### ELK Layout (reuse Phase 4 pattern)
```typescript
// Source: apps/studio/src/lib/layout/elkLayout.ts (established project pattern)
// elkjs import — must use bundled path for ESM compatibility
import ELK from 'elkjs/lib/elk.bundled.js';
const elk = new ELK();
const layouted = await elk.layout(graph);
// graph structure: same flat format as elkLayout.ts (no nested children)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE transport | Streamable HTTP transport | March 2025 (MCP spec 2025-03-26) | SSE deprecated; SDK 1.10.0+ uses NodeStreamableHTTPServerTransport |
| `server.tool()` with raw JSON schema | `server.tool()` with Zod inputSchema | SDK 1.x | SDK converts Zod to JSON Schema automatically |
| Custom stdio framing | StdioServerTransport | Protocol v1 | SDK handles all framing; never hand-roll |
| `LowLevelServer` | `McpServer` high-level API | SDK 0.x → 1.x | McpServer handles capability negotiation automatically |

**Deprecated/outdated:**
- `SSEServerTransport`: deprecated in favor of `NodeStreamableHTTPServerTransport` — do not use for new servers
- Direct `process.stdin`/`process.stdout` manipulation: replaced by `StdioServerTransport`

---

## Open Questions

1. **elkjs-svg custom CALM node shapes**
   - What we know: elkjs-svg renders rectangle nodes by default; supports custom CSS classes and inline styles
   - What's unclear: Whether it supports non-rectangle shapes (hexagon for actor, cylinder for database) or only rectangles with custom fills
   - Recommendation: Use rectangle nodes with CSS class per CALM type for v1 (shape variation via fill/stroke color); non-rectangle shapes deferred. The SVG is for AI consumption (layout understanding), not presentation.

2. **`@calmstudio/mcp` package name availability on npm**
   - What we know: The npm org `@calmstudio` must be claimed; `@calmstudio/mcp` must not already be taken
   - What's unclear: Whether the npm org exists / is claimed by this project
   - Recommendation: Verify npm org ownership before the first publish; failing silently in CI is worse than a clear error.

3. **moduleResolution conflict between tsconfig.base.json and Node.js CLI**
   - What we know: `tsconfig.base.json` uses `"moduleResolution": "bundler"` which is not suitable for Node.js without a bundler
   - What's unclear: Whether tsc with bundler resolution + `"type": "module"` package.json actually works for a CLI (it may — tsup uses a bundler but raw tsc might not)
   - Recommendation: Override `moduleResolution` to `"Node16"` and `module` to `"Node16"` in the mcp-server `tsconfig.json`. Add `.js` extensions to all local imports. Alternatively, use `tsup` to bundle to a single file (eliminates all resolution issues).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.8 (already used in studio) |
| Config file | No separate config file — add `test:` block to vitest config in mcp-server package |
| Quick run command | `pnpm --filter @calmstudio/mcp test` |
| Full suite command | `pnpm -r run test` |

The MCP server is pure TypeScript with no browser DOM dependency. All tool handlers and helper functions can be unit tested with plain vitest (no jsdom needed, no SvelteKit plugin needed). The file I/O layer should be tested with mocked `fs` module.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCPS-01 | `create_architecture` builds valid CalmArchitecture from node/rel input | unit | `pnpm --filter @calmstudio/mcp test -- createArchitecture` | Wave 0 |
| MCPS-01 | `create_architecture` rejects missing required fields | unit | `pnpm --filter @calmstudio/mcp test -- createArchitecture` | Wave 0 |
| MCPS-02 | `add_node` appends node and writes file | unit (mocked fs) | `pnpm --filter @calmstudio/mcp test -- addNode` | Wave 0 |
| MCPS-02 | `add_relationship` rejects dangling node refs | unit (mocked fs) | `pnpm --filter @calmstudio/mcp test -- addRelationship` | Wave 0 |
| MCPS-03 | `validate_architecture` returns errors for invalid schema | unit | `pnpm --filter @calmstudio/mcp test -- validate` | Wave 0 |
| MCPS-03 | `validate_architecture` returns empty for valid architecture | unit | `pnpm --filter @calmstudio/mcp test -- validate` | Wave 0 |
| MCPS-04 | `render_diagram` returns SVG string for valid architecture | unit (real elkjs) | `pnpm --filter @calmstudio/mcp test -- render` | Wave 0 |
| MCPS-05 | `export_calm` writes JSON to file path | unit (mocked fs) | `pnpm --filter @calmstudio/mcp test -- io` | Wave 0 |
| MCPS-05 | `import_calm` reads and parses valid .calm file | unit (mocked fs) | `pnpm --filter @calmstudio/mcp test -- io` | Wave 0 |
| MCPS-06 | Package.json `bin` entry points to built dist/index.js | integration/smoke | `node dist/index.js --version` | Wave 0 |
| MCPS-07 | Server starts and responds to tools/list via stdio | integration | MCP Inspector manual | manual-only (requires live process) |

**Manual-only justification:** MCP Inspector compliance test (MCPS-07) requires spawning the server as a child process and running the MCP Inspector tool — too heavyweight for unit tests. Verify once manually after first working build.

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/mcp test`
- **Per wave merge:** `pnpm -r run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/mcp-server/src/tests/createArchitecture.test.ts` — covers MCPS-01
- [ ] `packages/mcp-server/src/tests/addNode.test.ts` — covers MCPS-02 (add_node)
- [ ] `packages/mcp-server/src/tests/addRelationship.test.ts` — covers MCPS-02 (add_relationship)
- [ ] `packages/mcp-server/src/tests/validate.test.ts` — covers MCPS-03
- [ ] `packages/mcp-server/src/tests/render.test.ts` — covers MCPS-04
- [ ] `packages/mcp-server/src/tests/io.test.ts` — covers MCPS-05
- [ ] `packages/mcp-server/package.json` needs: `@modelcontextprotocol/sdk`, `zod`, `elkjs-svg` deps; `test` script using vitest; `build` script with tsc; `bin` field
- [ ] `packages/mcp-server/tsconfig.json` needs `moduleResolution: Node16` override (open question 3)
- [ ] vitest config block in mcp-server (or reuse a standalone `vitest.config.ts`)

---

## Sources

### Primary (HIGH confidence)
- `modelcontextprotocol/typescript-sdk` docs/server.md (raw GitHub) — McpServer API, transport setup, Zod inputSchema, response format
- `modelcontextprotocol.io/specification/2025-11-25/server/tools` (official MCP spec) — tool response format, isError semantics, content types, error handling
- `code.claude.com/docs/en/mcp` (official Claude Code docs) — registration commands, scopes, npx pattern, Windows workaround
- `packages/mcp-server/` in this repo — confirmed: stub exists, ready for implementation
- `apps/studio/src/lib/layout/elkLayout.ts` in this repo — confirmed ELK usage pattern (bundled.js import, flat graph)
- `packages/calm-core/src/types.ts` in this repo — CalmArchitecture, CalmNode, CalmRelationship types
- `tsconfig.base.json` in this repo — base TypeScript config (moduleResolution: bundler — needs override for CLI)

### Secondary (MEDIUM confidence)
- `github.com/EmilStenstrom/elkjs-svg` — elkjs-svg API (Renderer.toSvg), Node.js headless operation confirmed
- npm search result confirming `@modelcontextprotocol/sdk` v1.27.1 as latest stable
- `hackteam.io/blog/build-your-first-mcp-server-with-typescript-in-under-10-minutes/` — package.json bin field + chmod pattern

### Tertiary (LOW confidence)
- MCP SDK GitHub issue #1143 (Zod v4 description propagation) — verify on actual SDK version used
- Claim that `v2` of MCP SDK anticipated Q1 2026 — unverified, treat as LOW; stick with 1.27.1

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK confirmed on npm (v1.27.1), elkjs already in workspace, elkjs-svg confirmed headless
- Architecture: HIGH — tool handler pattern directly from SDK docs + established project patterns (elkLayout.ts, projection.ts)
- Pitfalls: HIGH — stdout corruption is documented in official sources; module resolution issue observed from tsconfig.base.json directly
- Validation architecture: HIGH — vitest already configured in studio; mcp-server test setup mirrors established patterns

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (MCP SDK evolving; check for v2 before planning if beyond April)
