---
phase: 05-mcp-server
plan: "00"
subsystem: mcp
tags: [mcp, zod, typescript, vitest, file-io, validation, calm-core]

# Dependency graph
requires:
  - phase: 01-foundation-governance
    provides: workspace setup, pnpm monorepo, TypeScript base config
  - phase: 04-import-export-layout
    provides: CalmArchitecture types from calm-core, established file I/O patterns

provides:
  - "@calmstudio/mcp package with correct name, bin entry, and published-ready config"
  - "Node16 tsconfig override enabling standalone CLI distribution"
  - "Zod input schemas for all 17 MCP tool handlers"
  - "file-io.ts: resolveFile, readCalmFile (auto-init), writeCalmFile, sidecar helpers"
  - "validation.ts: validateArchitecture with error/warning rules"
  - "6 vitest test stubs documenting expected behaviors for all tool categories"

affects: [05-01, 05-02, 05-03]

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/sdk ^1.27.1"
    - "zod ^3.24.0"
    - "elkjs ^0.11.1"
    - "elkjs-svg latest"
    - "vitest ^3.0.8 (mcp-server package)"
  patterns:
    - "Node16 moduleResolution override for standalone CLI packages"
    - "Auto-init pattern: readCalmFile returns empty arch on ENOENT (not error)"
    - "Zod schemas as single source of truth for tool input contracts"
    - "Pure function validation: validateArchitecture(arch) returns ValidationIssue[]"
    - "SPDX Apache-2.0 header on all source files"

key-files:
  created:
    - packages/mcp-server/src/types.ts
    - packages/mcp-server/src/file-io.ts
    - packages/mcp-server/src/validation.ts
    - packages/mcp-server/vitest.config.ts
    - packages/mcp-server/src/tests/createArchitecture.test.ts
    - packages/mcp-server/src/tests/nodes.test.ts
    - packages/mcp-server/src/tests/relationships.test.ts
    - packages/mcp-server/src/tests/validate.test.ts
    - packages/mcp-server/src/tests/render.test.ts
    - packages/mcp-server/src/tests/io.test.ts
  modified:
    - packages/mcp-server/package.json
    - packages/mcp-server/tsconfig.json
    - packages/mcp-server/src/index.ts
    - pnpm-lock.yaml

key-decisions:
  - "Package name is @calmstudio/mcp (not @calmstudio/mcp-server) — public npm distribution name"
  - "Node16 moduleResolution required for CLI — bundler resolution breaks standalone Node.js binaries"
  - "readCalmFile auto-inits with empty arch on missing file — not an error per RESEARCH Pitfall 8"
  - "Zod RelationshipInputSchema uses z.enum for 5 CALM types — rejects unknown relationship types"
  - ".calmstudio.json sidecar path derived from .calm file basename — e.g. architecture.calmstudio.json"

patterns-established:
  - "All .ts files in mcp-server use .js extensions in imports (Node16 ESM requirement)"
  - "toolSuccess/toolError helpers standardize MCP response shape across all tool handlers"
  - "Test stubs: one trivial passing test + it.todo() per expected behavior"

requirements-completed: [MCPS-01, MCPS-02, MCPS-03, MCPS-04, MCPS-05, MCPS-06]

# Metrics
duration: 8min
completed: 2026-03-12
---

# Phase 5 Plan 00: MCP Server Foundation Summary

**MCP server package scaffolded with Node16 CLI config, Zod schemas for 17 tool handlers, file-io.ts with auto-init read, and validateArchitecture pure function — all test stubs passing**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-12T09:00:15Z
- **Completed:** 2026-03-12T09:08:00Z
- **Tasks:** 2 of 2
- **Files modified:** 14

## Accomplishments

- Transformed mcp-server stub into publishable @calmstudio/mcp package with bin entry, correct deps, and Node16 build config
- Created types.ts with Zod schemas covering all 17 MCP tool input contracts plus toolSuccess/toolError response helpers
- Built file-io.ts with auto-init readCalmFile (returns empty arch on ENOENT, not error), writeCalmFile, and .calmstudio.json sidecar helpers
- Built validation.ts with validateArchitecture pure function covering dangling refs, duplicate IDs, orphan nodes, and self-loops
- Added 6 vitest test stub files (30 total tests: 6 passing + 24 todos) documenting all expected behaviors for next implementation plans

## Task Commits

1. **Task 1: Package config, deps, build pipeline, Zod schemas** - `5695d3e` (feat)
2. **Task 2: File I/O layer, validation layer, and test stubs** - `08df5f6` (feat)

## Files Created/Modified

- `packages/mcp-server/package.json` - Renamed to @calmstudio/mcp, added bin, deps, build/test scripts
- `packages/mcp-server/tsconfig.json` - Node16 module/moduleResolution override for CLI
- `packages/mcp-server/vitest.config.ts` - Vitest config targeting src/tests/**
- `packages/mcp-server/src/types.ts` - 17 Zod tool schemas + toolSuccess/toolError helpers
- `packages/mcp-server/src/file-io.ts` - readCalmFile, writeCalmFile, resolveFile, sidecar helpers
- `packages/mcp-server/src/validation.ts` - validateArchitecture pure function
- `packages/mcp-server/src/index.ts` - Re-exports all foundation modules
- `packages/mcp-server/src/tests/*.test.ts` - 6 stub files with todos

## Decisions Made

- Package named @calmstudio/mcp for npm distribution (not the workspace stub name @calmstudio/mcp-server)
- Node16 moduleResolution required — bundler resolution fails for standalone Node.js CLI binaries
- readCalmFile returns `{ nodes: [], relationships: [] }` on ENOENT — auto-init per design, not an error
- Zod RelationshipInputSchema enforces z.enum for relationship types — custom types not allowed (unlike node-type which is z.string())
- Sidecar path uses basename without extension: `architecture.calm` -> `architecture.calmstudio.json`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Build and tests passed on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All foundation types, file I/O, and validation are ready for tool handler implementations
- Test stubs in src/tests/ provide clear behavioral contracts for Plans 01-03
- package.json configured for npm publish once implementations are complete
