---
phase: 09-testing-suite
plan: 01
subsystem: testing-infrastructure
tags: [vitest, coverage, fixtures, testing]
dependency_graph:
  requires: []
  provides: [coverage-infrastructure, shared-test-fixtures]
  affects: [packages/calm-core, packages/extensions, packages/mcp-server, apps/studio]
tech_stack:
  added: ["@vitest/coverage-v8"]
  patterns: ["v8 coverage provider", "tiered coverage thresholds", "fixture factory pattern"]
key_files:
  created:
    - packages/calm-core/test-fixtures/index.ts
  modified:
    - packages/calm-core/vitest.config.ts
    - packages/calm-core/package.json
    - packages/extensions/vitest.config.ts
    - packages/extensions/package.json
    - packages/mcp-server/vitest.config.ts
    - packages/mcp-server/package.json
    - apps/studio/vite.config.ts
    - apps/studio/package.json
    - pnpm-lock.yaml
decisions:
  - "@vitest/coverage-v8 version pinned to match resolved vitest version per package (3.2.4 for calm-core/mcp-server/studio, 4.1.0 for extensions)"
  - "Tiered thresholds: calm-core=90% (pure logic), extensions/mcp-server=80% (service logic), studio=60% (UI-heavy)"
  - "test-fixtures/index.ts imports from ../src/index.js (internal path) not bare package name — fixture file is within the same package"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 9
---

# Phase 9 Plan 01: Coverage Infrastructure and Shared Fixtures Summary

**One-liner:** v8 coverage with tiered thresholds (90/80/80/60%) across all 4 packages plus typed fixture factories for consistent test data.

## What Was Built

### Task 1: @vitest/coverage-v8 Installation and Coverage Config

Installed `@vitest/coverage-v8` in all 4 packages (versions matched to each package's resolved vitest). Added coverage blocks to all vitest/vite configs:

| Package | Threshold | Provider | Reporters |
|---------|-----------|----------|-----------|
| calm-core | 90% (lines/fn/branch/stmt) | v8 | text, json, html, lcov |
| extensions | 80% | v8 | text, json, html, lcov |
| mcp-server | 80% | v8 | text, json, html, lcov |
| studio | 60% | v8 | text, json, html, lcov |

Added `test:coverage` script to all 4 `package.json` files. Root `.gitignore` already contained `coverage/` — no change needed.

### Task 2: Shared Test Fixture Factory Library

Created `packages/calm-core/test-fixtures/index.ts` exporting 5 typed factory functions:

- `createNode(overrides?)` — single CalmNode with defaults (service type, 'Test Service')
- `createRelationship(overrides?)` — single CalmRelationship (connects, node-1 to node-2)
- `createMinimalArch(overrides?)` — 2-node arch: API Service + Main DB with HTTPS connection
- `createFluxNovaArch(overrides?)` — 4-node FluxNova platform with deployed-in relationships; REST API node has `data-classification: 'Confidential'`
- `createAIGovernanceArch(overrides?)` — 4-node AI pipeline (orchestrator, agent, LLM, vector store) with `aigf-security-domain` control on LLM node

Added `./test-fixtures` subpath export to `packages/calm-core/package.json` enabling imports via `@calmstudio/calm-core/test-fixtures`.

## Verification Results

All 25 test suites pass (unchanged from pre-plan baseline):
- calm-core: 4 suites, 36 tests
- extensions: 2 suites, 33 tests
- mcp-server: 7 suites, 53 tests
- studio: 12 suites, 148 tests

Fixture functions verified with tsx:
- `createMinimalArch().nodes.length` = 2
- `createAIGovernanceArch().nodes.length` = 4 (with controls on LLM node)
- `createFluxNovaArch().nodes.length` = 4

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Version mismatch for @vitest/coverage-v8 peer dependency**
- **Found during:** Task 1
- **Issue:** pnpm resolved vitest to `3.2.4` in calm-core/mcp-server/studio despite package.json specifying `^3.0.8` or `^3.2.4`. Installing `@vitest/coverage-v8@3.0.8` caused peer mismatch warning.
- **Fix:** Pinned `@vitest/coverage-v8@3.2.4` to match the resolved vitest version in calm-core, mcp-server, and studio. Extensions already had `vitest@4.1.0` so `@vitest/coverage-v8@^4.1.0` was correct.
- **Files modified:** packages/calm-core/package.json, packages/mcp-server/package.json, apps/studio/package.json
- **Commit:** 10e9c1c

**2. [Rule 1 - Bug] CalmNode.description is optional in types.ts**
- **Found during:** Task 2
- **Issue:** Plan stated description is required; actual `CalmNode` type has `description?` (optional). Fixture types must match actual schema.
- **Fix:** Used optional description fields in fixtures — all populated for clarity but no TypeScript errors.
- **Files modified:** packages/calm-core/test-fixtures/index.ts (no structural change needed)

## Commits

| Commit | Task | Description |
|--------|------|-------------|
| 10e9c1c | Task 1 | chore(deps): install @vitest/coverage-v8 and configure tiered coverage |
| b0d8ef9 | Task 2 | feat(calm-core): add shared test fixture factory library |

## Self-Check: PASSED

- FOUND: packages/calm-core/test-fixtures/index.ts
- FOUND: packages/calm-core/vitest.config.ts (with thresholds)
- FOUND: packages/extensions/vitest.config.ts (with thresholds)
- FOUND: packages/mcp-server/vitest.config.ts (with thresholds)
- FOUND: apps/studio/vite.config.ts (with thresholds)
- FOUND commit 10e9c1c (Task 1)
- FOUND commit b0d8ef9 (Task 2)
