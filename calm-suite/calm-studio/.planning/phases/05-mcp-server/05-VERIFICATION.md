---
phase: 05-mcp-server
verified: 2026-03-12T16:07:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Register MCP server in Claude Code and ask it to describe a microservices architecture"
    expected: "Claude Code uses create_architecture or add_node/add_relationship tools to produce a valid .json file"
    why_human: "Requires live Claude Code session, running server process, and MCP Inspector or real AI prompt"
  - test: "npm install -g @calmstudio/mcp and run calmstudio-mcp --version"
    expected: "Installs cleanly from npm and binary executes"
    why_human: "Package is version 0.0.0 and not yet published to npm. Cannot verify npm install path programmatically."
---

# Phase 5: MCP Server Verification Report

**Phase Goal:** Claude Code and any MCP-compatible AI assistant can create, modify, and export CALM architectures through structured tool calls
**Verified:** 2026-03-12T16:07:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MCP server exposes create_architecture, add_node/add_relationship, validate_architecture, render_diagram, export_calm/import_calm tools | VERIFIED | All 7 tool modules exist with full implementations; 21 tools registered in server.ts |
| 2 | All MCP tools return properly structured content responses (content[0].type=text, isError field) | VERIFIED | 53 tests pass including 10 integration tests with assertToolSuccess/assertToolError validation |
| 3 | Server starts in stdio mode (Claude Code) and HTTP mode (--http flag) | VERIFIED | index.ts implements both transports; --version and --help work; dist/index.js has shebang + chmod 755 |
| 4 | MCP server operates on .json/.calm files directly — no desktop app required | VERIFIED | file-io.ts reads/writes directly via node:fs; all tool handlers use read-mutate-write pattern |
| 5 | Server is installable as a standalone CLI (bin field, package name @calmstudio/mcp) | VERIFIED | package.json has name "@calmstudio/mcp", bin.calmstudio-mcp, private:false, files:["dist"] |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/mcp-server/package.json` | name @calmstudio/mcp, bin, deps, build/test scripts | VERIFIED | name="@calmstudio/mcp", private=false, bin.calmstudio-mcp=./dist/index.js, all deps present |
| `packages/mcp-server/tsconfig.json` | Node16 moduleResolution override | VERIFIED | module="Node16", moduleResolution="Node16", declaration=true |
| `packages/mcp-server/vitest.config.ts` | Vitest test config | VERIFIED | Exists with src/tests/**/*.test.ts include pattern |
| `packages/mcp-server/src/types.ts` | Zod schemas + toolSuccess/toolError helpers | VERIFIED | 17 Zod schemas exported (NodeInputSchema, RelationshipInputSchema, CreateArchitectureSchema, etc.), toolSuccess/toolError helpers present |
| `packages/mcp-server/src/file-io.ts` | readCalmFile, writeCalmFile, resolveFile, sidecar helpers | VERIFIED | All 5 exports present: resolveFile, readCalmFile, writeCalmFile, readSidecar, writeSidecar |
| `packages/mcp-server/src/validation.ts` | validateArchitecture pure function | VERIFIED | Exports validateArchitecture with all 7 validation rules (dangling refs, duplicates, orphans, self-loops) |
| `packages/mcp-server/src/tools/architecture.ts` | create_architecture, describe_architecture | VERIFIED | registerArchitectureTools + pure logic functions exported |
| `packages/mcp-server/src/tools/nodes.ts` | 6 node CRUD tools | VERIFIED | registerNodeTools + add_node, get_node, update_node, delete_node, query_nodes, batch_create_nodes |
| `packages/mcp-server/src/tools/relationships.ts` | 4 relationship CRUD tools with dangling ref validation | VERIFIED | registerRelationshipTools + dangling ref check in addRelationship |
| `packages/mcp-server/src/tools/io.ts` | export_calm, import_calm | VERIFIED | registerIOTools + pure logic functions |
| `packages/mcp-server/src/tools/render.ts` | render_diagram (ELK + SVG), validate_architecture | VERIFIED | ELK layout + custom SVG generation with CALM node type coloring; both tools registered |
| `packages/mcp-server/src/tools/guide.ts` | read_calm_guide static reference | VERIFIED | Full CALM reference: 9 node types, 5 rel types, interface types, example JSON, usage tips |
| `packages/mcp-server/src/tools/view.ts` | create_view, update_view | VERIFIED | registerViewTools + ELK layout + sidecar write |
| `packages/mcp-server/src/server.ts` | createServer() wiring all 7 tool modules | VERIFIED | All 7 registerXxxTools calls present |
| `packages/mcp-server/src/index.ts` | CLI entry with shebang, dual transport | VERIFIED | #!/usr/bin/env node shebang, --version/--help/--http/--port flags, stdio + HTTP transport |
| `packages/mcp-server/src/tests/integration.test.ts` | E2E workflow verification | VERIFIED | 10 integration tests covering full workflow: create → add node → add relationship (dangling) → validate → describe → render → export → import |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/types.ts` | `@calmstudio/calm-core` | import CalmNode/CalmRelationship/CalmArchitecture types | WIRED | `import type { CalmArchitecture } from '@calmstudio/calm-core'` in types.ts (via validation.ts re-export) |
| `src/file-io.ts` | `node:fs` | readFileSync/writeFileSync | WIRED | `import { readFileSync, writeFileSync } from 'node:fs'` |
| `src/tools/architecture.ts` | `src/file-io.ts` | readCalmFile/writeCalmFile for persistence | WIRED | `import { resolveFile, readCalmFile, writeCalmFile } from '../file-io.js'` |
| `src/tools/nodes.ts` | `src/file-io.ts` | read-mutate-write pattern | WIRED | `readCalmFile(filePath)` + `writeCalmFile(filePath, arch)` in every handler |
| `src/tools/relationships.ts` | `src/validation.ts` | dangling ref check before write | VERIFIED INLINE | Dangling ref validation implemented directly using nodeIds check, not via validateArchitecture() — same effect |
| `src/server.ts` | `src/tools/*.ts` | registerXxxTools(server) calls | WIRED | All 7 register calls: registerArchitectureTools, registerNodeTools, registerRelationshipTools, registerIOTools, registerRenderTools, registerGuideTools, registerViewTools |
| `src/index.ts` | `@modelcontextprotocol/sdk/server/stdio.js` | StdioServerTransport for default mode | WIRED | `import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'` |
| `src/tools/render.ts` | `elkjs` | ELK layout for SVG generation | WIRED | `import ELKImport from 'elkjs/lib/elk.bundled.js'` with CJS/ESM interop fallback |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MCPS-01 | 05-00-PLAN, 05-01-PLAN | MCP server exposes `create_architecture` tool | SATISFIED | createArchitecture() in architecture.ts; 6 tests in createArchitecture.test.ts pass |
| MCPS-02 | 05-00-PLAN, 05-01-PLAN | MCP server exposes `add_node` and `add_relationship` tools | SATISFIED | addNode() in nodes.ts, addRelationship() with dangling ref validation in relationships.ts; 11+9 tests pass |
| MCPS-03 | 05-00-PLAN, 05-02-PLAN | MCP server exposes `validate_architecture` tool | SATISFIED | validateArchitectureTool() in render.ts; uses validateArchitecture() pure function; 4 validate tests pass |
| MCPS-04 | 05-00-PLAN, 05-02-PLAN | MCP server exposes `render_diagram` tool (-> SVG) | SATISFIED | renderDiagram() with ELK layout + custom SVG coloring; 8 render tests pass including SVG content assertions |
| MCPS-05 | 05-00-PLAN, 05-01-PLAN | MCP server exposes `export_calm` and `import_calm` tools | SATISFIED | exportCalm() and importCalm() in io.ts; 5 io tests pass including round-trip |
| MCPS-06 | 05-00-PLAN, 05-02-PLAN | MCP server installable via `npm install -g @calmstudio/mcp` | SATISFIED (dist only) | package.json: name="@calmstudio/mcp", private=false, bin.calmstudio-mcp, files=["dist"]; binary runs; not yet published to npm (v0.0.0) |
| MCPS-07 | 05-02-PLAN, 05-03-PLAN | MCP server works with Claude Code and any MCP-compatible AI assistant | SATISFIED (human verified) | SUMMARY 05-03 documents Claude Code installation and real architecture creation; stdio transport tested; MCP SDK handles protocol compliance |

**Note on REQUIREMENTS.md traceability table:** The traceability table in REQUIREMENTS.md maps MCPS-01 through MCPS-07 to "Phase 8" (all marked Complete). However, ROADMAP.md assigns these requirements to Phase 5, and the phase 5 plans and summaries all claim completion of these requirements. This is a stale traceability table entry — the requirements were implemented in Phase 5 (not Phase 8 as labeled). The actual implementation in the codebase satisfies the requirements regardless of the table discrepancy.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/index.ts` | 78 | Comment "CRITICAL: No console.log after connect" (not actual violation) | Info | Comment is correct guidance; no console.log calls in source files |
| `src/tools/render.ts` | 8 | `@ts-expect-error` on elkjs-svg import | Info | CJS module with no type declarations — expected, not a logic issue |
| `src/tools/render.ts` | 7-8 | `elkjs-svg` Renderer imported but unused (custom SVG replaces it) | Warning | Dead import; does not affect correctness; SVG generation works correctly |

No blockers found. The unused elkjs-svg Renderer import is a minor warning documented in the SUMMARY as an intentional design decision (custom SVG provides CALM type coloring that elkjs-svg does not support).

### Human Verification Required

#### 1. Claude Code MCP Integration

**Test:** Register the server in Claude Code with `claude mcp add --transport stdio calmstudio -- node /path/to/dist/index.js` then prompt: "Create a simple 3-tier architecture with a web client, API service, and database"
**Expected:** Claude Code calls `read_calm_guide` then `create_architecture` producing a .json file with 3 nodes and relationships; file opens in CalmStudio
**Why human:** Requires live Claude Code session with MCP support, running server process, and real AI prompt execution

#### 2. npm install -g @calmstudio/mcp

**Test:** Publish package to npm (or `npm pack` and install locally) and verify `calmstudio-mcp --version` works from a fresh directory
**Expected:** Binary runs, returns version, exits cleanly
**Why human:** Package at version 0.0.0, not yet published; npm publish requires authentication and is outside automated verification scope

## Gaps Summary

No gaps. All automated must-haves are verified. The phase goal is achieved:

- 21 MCP tools are registered and return correctly structured responses
- All 53 tests pass (unit + integration)
- Build compiles cleanly to dist/ with shebang and executable permissions
- Binary responds to --version, --help, --http, --port flags
- stdio and HTTP transports are implemented
- Package config is npm-publish-ready (correct name, bin, files fields)
- Human verification (Plan 03 Task 2) was completed per SUMMARY-03: Claude Code installed, real architecture created, file opened in CalmStudio

Two items remain for human verification in future sessions: real-time Claude Code re-testing and npm publish verification.

---

_Verified: 2026-03-12T16:07:00Z_
_Verifier: Claude (gsd-verifier)_
