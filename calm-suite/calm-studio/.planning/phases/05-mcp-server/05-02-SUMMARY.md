---
phase: 05-mcp-server
plan: "02"
subsystem: mcp
tags: [mcp, typescript, vitest, elk, svg, tdd, render, validate, guide, server, cli]

# Dependency graph
requires:
  - phase: 05-mcp-server
    plan: "01"
    provides: architecture/node/relationship/IO tool handlers, types.ts, file-io.ts, validation.ts

provides:
  - "render_diagram tool handler (ELK layout + custom SVG with node type color coding)"
  - "validate_architecture tool handler (formats ValidationIssue[] as [ERROR]/[WARNING] lines)"
  - "read_calm_guide tool handler (static CALM reference, no file I/O)"
  - "create_view / update_view tool handlers (SVG render + sidecar write)"
  - "createServer() wiring all 7 tool modules (21 tools total)"
  - "CLI entry point: --version, --help, --http, --port, stdio/HTTP dual transport"
  - "dist/index.js with shebang, executable"

affects: [05-03]

# Tech tracking
tech-stack:
  added: [elkjs-svg]
  patterns:
    - "ELK default import via esModuleInterop + runtime .default?? fallback for CJS/ESM interop"
    - "Custom SVG generation (no elkjs-svg renderer used) — direct SVG assembly for CALM type coloring"
    - "elkjs-svg imported but not used in final impl — custom SVG replaces it (see deviation)"
    - "StreamableHTTPServerTransport type cast via unknown — exactOptionalPropertyTypes conflict with internal SDK Transport interface"
    - "HTTP transport: stateless mode (no sessionIdGenerator) — one transport per request lifecycle"
    - "No console.log anywhere — only console.error for stderr logging (MCP protocol owns stdout)"

key-files:
  created:
    - packages/mcp-server/src/tools/render.ts
    - packages/mcp-server/src/tools/guide.ts
    - packages/mcp-server/src/tools/view.ts
    - packages/mcp-server/src/server.ts
  modified:
    - packages/mcp-server/src/index.ts
    - packages/mcp-server/src/tests/render.test.ts
    - packages/mcp-server/src/tests/validate.test.ts

key-decisions:
  - "ELK default import uses esModuleInterop .default?? pattern — CJS module in ESM context"
  - "Custom SVG assembly instead of elkjs-svg renderer — allows per-node-type color coding"
  - "StreamableHTTPServerTransport type cast (as unknown as StdioServerTransport) — exactOptionalPropertyTypes SDK conflict"
  - "HTTP transport stateless (no sessionIdGenerator) — simplest per-request lifecycle for v1"

requirements-completed: [MCPS-03, MCPS-04, MCPS-06, MCPS-07]

# Metrics
duration: 15min
completed: 2026-03-12
---

# Phase 5 Plan 02: Server Wiring and Remaining Tools Summary

**Complete MCP server: 21 tools wired, custom SVG render with CALM type coloring, static guide, CLI entry with dual transport (stdio/HTTP), dist/index.js executable with shebang — all 43 tests pass**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-12T09:32:25Z
- **Completed:** 2026-03-12T09:48:04Z
- **Tasks:** 2 of 2
- **Files modified:** 7

## Accomplishments

- Implemented `render_diagram` with ELK layout and custom SVG generation with CALM node type color coding (9 types, distinct colors per type)
- Implemented `validate_architecture` that formats ValidationIssue[] as `[ERROR]`/`[WARNING]` lines
- Implemented `read_calm_guide` with full static CALM reference (9 node types, 5 rel types, interface types, example JSON, usage tips)
- Implemented `create_view` and `update_view` for Claude Cowork SVG rendering + sidecar writes
- Created `server.ts` wiring all 7 tool modules (architecture, nodes, relationships, IO, render, guide, view)
- Rewrote `index.ts` as CLI entry point: shebang, --version, --help, --http/--port flags, stdio default + HTTP transport
- Build succeeds, `--version` and `--help` work, dist/index.js has shebang and is chmod 755

## Task Commits

1. **Task 1: Validate, render, guide, and view tool handlers** - `bc86735` (feat)
2. **Task 2: Server wiring and CLI entry point with dual transport** - `e4e9206` (feat)

## Files Created/Modified

- `packages/mcp-server/src/tools/render.ts` - render_diagram (ELK + custom SVG) + validate_architecture
- `packages/mcp-server/src/tools/guide.ts` - read_calm_guide (static CALM reference)
- `packages/mcp-server/src/tools/view.ts` - create_view / update_view (SVG + sidecar)
- `packages/mcp-server/src/server.ts` - createServer() wiring all 7 tool modules
- `packages/mcp-server/src/index.ts` - CLI entry with shebang, dual transport
- `packages/mcp-server/src/tests/render.test.ts` - 8 tests (SVG output, empty arch, direction, validate cases)
- `packages/mcp-server/src/tests/validate.test.ts` - 4 dedicated validate tests

## Decisions Made

- ELK bundled.js is CJS — `esModuleInterop: true` allows default import; runtime `.default ??` fallback handles both CJS wrapper shapes
- Custom SVG assembly used instead of `elkjs-svg` `Renderer.toSvg()` — allows per-node-type fill colors which `elkjs-svg` default styling doesn't support
- `StreamableHTTPServerTransport` requires `as unknown as StdioServerTransport` type cast due to `exactOptionalPropertyTypes: true` conflict with the SDK's internal `Transport` interface (onclose property)
- HTTP transport runs stateless (no `sessionIdGenerator` passed) — simplest v1 approach, one transport per request

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `require()` not available in ESM context for ELK import**
- **Found during:** Task 2 (CLI --version failed at runtime)
- **Issue:** `const ELK = require('elkjs/lib/elk.bundled.js')` throws ReferenceError in ESM scope (package.json has `"type": "module"`)
- **Fix:** Reverted to `import ELKImport from 'elkjs/lib/elk.bundled.js'` with `.default ??` runtime fallback
- **Files modified:** packages/mcp-server/src/tools/render.ts
- **Commit:** e4e9206 (included in task commit)

**2. [Rule 1 - Bug] `NodeStreamableHTTPServerTransport` does not exist in MCP SDK v1.27.1**
- **Found during:** Task 2 (build error)
- **Issue:** Plan specified `NodeStreamableHTTPServerTransport` but SDK v1.27.1 exports `StreamableHTTPServerTransport`
- **Fix:** Used `StreamableHTTPServerTransport` (correct name for Node.js HTTP wrapper in this SDK version)
- **Files modified:** packages/mcp-server/src/index.ts
- **Commit:** e4e9206

**3. [Rule 1 - Bug] `exactOptionalPropertyTypes` conflict with StreamableHTTPServerTransport**
- **Found during:** Task 2 (TypeScript compile error)
- **Issue:** SDK's internal `Transport` interface requires `onclose: () => void` (no undefined) but `StreamableHTTPServerTransport` has `onclose: (() => void) | undefined` — strict TS rejects assignment
- **Fix:** `as unknown as StdioServerTransport` type cast at `server.connect()` call site
- **Files modified:** packages/mcp-server/src/index.ts
- **Commit:** e4e9206

**4. [Rule 3 - Blocking] Custom SVG generation replaces elkjs-svg Renderer**
- **Found during:** Task 1 (implementation)
- **Issue:** `elkjs-svg`'s `Renderer.toSvg()` generates SVG with fixed blue fill for all nodes — plan requires CALM node type color coding. Custom SVG assembly provides full control.
- **Fix:** Generated SVG manually using ELK layout positions + per-node-type fill color map
- **Files modified:** packages/mcp-server/src/tools/render.ts
- **Impact:** `elkjs-svg` package is still declared (used for import) but not actually called in rendering

## Self-Check: PASSED

- render.ts: FOUND
- guide.ts: FOUND
- view.ts: FOUND
- server.ts: FOUND
- index.ts (rewritten): FOUND
- Task 1 commit (bc86735): FOUND
- Task 2 commit (e4e9206): FOUND
