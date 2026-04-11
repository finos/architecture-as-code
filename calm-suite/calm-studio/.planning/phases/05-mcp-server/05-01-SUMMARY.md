---
phase: 05-mcp-server
plan: "01"
subsystem: mcp
tags: [mcp, typescript, vitest, file-io, crud, tdd, zod]

# Dependency graph
requires:
  - phase: 05-mcp-server
    plan: "00"
    provides: Zod schemas, file-io.ts, types.ts, toolSuccess/toolError helpers

provides:
  - "create_architecture, describe_architecture tool handlers"
  - "add_node, get_node, update_node, delete_node, query_nodes, batch_create_nodes tool handlers"
  - "add_relationship, get_relationship, update_relationship, delete_relationship tool handlers"
  - "export_calm, import_calm tool handlers"
  - "All tools follow read-mutate-write pattern against .calm files"
  - "Dangling relationship references rejected with available node IDs in error"

affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "z.infer<typeof Schema> for function param types — avoids exactOptionalPropertyTypes conflicts with Zod output"
    - "server.tool(name, description, schema.shape, cb) — MCP SDK tool registration pattern"
    - "Pure logic functions exported separately from registerXxxTools — enables direct testing without MCP server"
    - "Type assertions (as CalmNode) for Zod->CalmInterface bridge — required fields guaranteed by schema"
    - "Cascade delete: delete_node removes all relationships referencing the deleted node"

key-files:
  created:
    - packages/mcp-server/src/tools/architecture.ts
    - packages/mcp-server/src/tools/nodes.ts
    - packages/mcp-server/src/tools/relationships.ts
    - packages/mcp-server/src/tools/io.ts
  modified:
    - packages/mcp-server/src/tests/createArchitecture.test.ts
    - packages/mcp-server/src/tests/nodes.test.ts
    - packages/mcp-server/src/tests/relationships.test.ts
    - packages/mcp-server/src/tests/io.test.ts

key-decisions:
  - "z.infer<typeof Schema> used for all tool handler param types — ensures Zod exactOptionalPropertyTypes compatibility"
  - "server.tool(name, description, schema.shape, cb) — not registerTool — avoids complex generics"
  - "Pure functions exported + MCP registration function exported — tests call logic directly"
  - "Type cast (as CalmNode) at arch.nodes.push() boundary — Zod includes | undefined in optional fields, CalmInterface doesn't"

patterns-established:
  - "All tool handler modules export both register function AND pure logic functions"
  - "TDD: write failing tests, implement, verify green — used for both tasks"
  - "! non-null assertions on result.content[0]! in tests — required by noUncheckedIndexedAccess"

requirements-completed: [MCPS-01, MCPS-02, MCPS-05]

# Metrics
duration: 12min
completed: 2026-03-12
---

# Phase 5 Plan 01: MCP Core Tool Handlers Summary

**All 14 MCP tool handlers implemented with TDD: architecture CRUD, node CRUD (6 tools), relationship CRUD (4 tools), and file I/O — all tests green, TypeScript clean, build succeeds**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-12T09:06:33Z
- **Completed:** 2026-03-12T09:18:45Z
- **Tasks:** 2 of 2
- **Files modified:** 8

## Accomplishments

- Implemented `create_architecture` and `describe_architecture` with deep link (`calmstudio://open?file=...`) in create response
- Implemented 6 node CRUD tools following read-mutate-write pattern; `delete_node` cascades to remove orphaned relationships
- Implemented 4 relationship CRUD tools with critical dangling ref validation in `add_relationship`
- Implemented `export_calm` and `import_calm` for file I/O with JSON validation in import
- Filled in all test stubs — 33 passing tests covering core behaviors, error cases, cascade delete, and round-trip I/O

## Task Commits

1. **Task 1: Architecture and node CRUD tool handlers with tests** - `43c14fa` (feat)
2. **Task 2: Relationship CRUD and file I/O tool handlers with tests** - `c957c64` (feat)

## Files Created/Modified

- `packages/mcp-server/src/tools/architecture.ts` - create_architecture, describe_architecture handlers + registerArchitectureTools
- `packages/mcp-server/src/tools/nodes.ts` - 6 node CRUD handlers + registerNodeTools
- `packages/mcp-server/src/tools/relationships.ts` - 4 relationship CRUD handlers (with dangling ref validation) + registerRelationshipTools
- `packages/mcp-server/src/tools/io.ts` - export_calm, import_calm handlers + registerIOTools
- `packages/mcp-server/src/tests/createArchitecture.test.ts` - 6 tests covering create and describe
- `packages/mcp-server/src/tests/nodes.test.ts` - 11 tests covering all node CRUD operations
- `packages/mcp-server/src/tests/relationships.test.ts` - 9 tests covering relationship CRUD + dangling ref
- `packages/mcp-server/src/tests/io.test.ts` - 5 tests covering export, import, and round-trip

## Decisions Made

- `z.infer<typeof Schema>` used for all function param types to avoid `exactOptionalPropertyTypes: true` conflicts with Zod's output types (which include `| undefined` for optional fields while `CalmNode/CalmRelationship` interfaces do not)
- `server.tool(name, description, schema.shape, cb)` chosen over `server.registerTool()` — avoids the complex generic type resolution the new API requires
- Pure logic functions are exported alongside `registerXxxTools()` — this allows test files to call business logic directly without spinning up an MCP server
- Type cast `as CalmNode` at the `arch.nodes.push()` boundary — Zod-parsed objects satisfy the structural contract; the cast is safe

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript exactOptionalPropertyTypes mismatch with Zod inferred types**
- **Found during:** Task 1 (typecheck phase)
- **Issue:** `CalmNode.description?: string` (no undefined) but Zod infers `description?: string | undefined` — TypeScript strict mode rejected assignments
- **Fix:** Changed function parameter types from `{ node: CalmNode }` to `z.infer<typeof AddNodeSchema>` and added `as CalmNode` cast at push boundary
- **Files modified:** architecture.ts, nodes.ts, relationships.ts
- **Commit:** 43c14fa (included in task commit)

**2. [Rule 1 - Bug] Test files using raw index access without null check**
- **Found during:** Task 1 (typecheck phase)
- **Issue:** `result.content[0].text` raises TS2532 under `noUncheckedIndexedAccess: true`
- **Fix:** Changed to `result.content[0]!.text` (non-null assertion) in all test files
- **Files modified:** createArchitecture.test.ts, nodes.test.ts, relationships.test.ts, io.test.ts
- **Commit:** 43c14fa, c957c64 (included in task commits)

## Self-Check: PASSED

- architecture.ts: FOUND
- nodes.ts: FOUND
- relationships.ts: FOUND
- io.ts: FOUND
- Task 1 commit (43c14fa): FOUND
- Task 2 commit (c957c64): FOUND
