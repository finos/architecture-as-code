---
phase: 09-testing-suite
plan: 05
subsystem: ci-coverage
tags: [ci, coverage, e2e, github-actions, readme, badges]
dependency_graph:
  requires: [09-02, 09-03, 09-04]
  provides: [CI coverage enforcement, E2E test job on main, README coverage badges]
  affects: [.github/workflows/ci.yml, README.md]
tech_stack:
  added: []
  patterns:
    - Per-package test:coverage invocation for threshold isolation
    - actions/upload-artifact@v4 for coverage report archiving
    - e2e-tests job with needs: build-lint-test and if: push to main condition
    - shields.io static badges for immediate FINOS visibility
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - README.md
decisions:
  - Use per-package coverage commands instead of pnpm -r run test:coverage — avoids aggregate config ambiguity and isolates per-package threshold failures
  - E2E job uses needs: build-lint-test — ensures unit tests pass before spending CI minutes on browser tests
  - shields.io static coverage badge instead of Codecov dynamic — no token setup required, immediately deployable
metrics:
  duration: 2min
  completed: "2026-03-15"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 09 Plan 05: CI Coverage + Badge Summary

CI pipeline updated with per-package coverage threshold enforcement, artifact upload, E2E test job on merge to main, and shields.io coverage badges added to README.md.

## What Was Built

**Task 1: Updated .github/workflows/ci.yml**

- Replaced `pnpm -r run test` with 4 per-package `test:coverage` commands that enforce the tiered thresholds configured in each package's vitest.config.ts (calm-core 90%, extensions 80%, mcp-server 80%, studio 60%)
- Added `Upload coverage reports` step using `actions/upload-artifact@v4` with `if: always()` so reports are preserved even when coverage fails; 14-day retention; covers all 4 package coverage directories
- Added new `e2e-tests` job:
  - `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` — only runs on merges to main
  - `needs: build-lint-test` — E2E cannot run if unit tests or coverage thresholds fail
  - Installs Playwright chromium via `npx playwright install --with-deps chromium`
  - Runs full SvelteKit build then `pnpm --filter @calmstudio/studio run test:e2e`
- All existing jobs unchanged: `reuse-compliance`, `cve-scan`, `commitlint`
- SPDX header, `permissions: contents: read`, triggers on push/PR to main all preserved

**Task 2: Updated README.md + Final Verification**

- Added `CI` badge (GitHub Actions workflow status badge linking to ci.yml)
- Added `Coverage` static shields.io badge with "tiered thresholds" label
- Added `## Testing` section (before Contributing) with:
  - Per-package threshold table (4 rows: calm-core 90%, extensions 80%, mcp-server 80%, studio 60%)
  - `pnpm -r run test` for quick runs
  - `pnpm -r run test:coverage` for threshold-enforced coverage runs
  - `pnpm --filter @calmstudio/studio run test:e2e` for E2E with note about dev server
  - Note that coverage reports are CI artifacts and E2E runs on merge to main

**Final Verification: Full test suite passes**

- calm-core: 36 tests (4 files) — PASSED
- extensions: 33 tests (2 files) — PASSED
- mcp-server: 53 tests (7 files) — PASSED
- studio: 348 tests (25 files) — PASSED
- Total: 470 tests across 38 test files — all green

## Test Infrastructure Summary (Phase 09 Complete)

| Plan | Deliverable | Key Outcome |
|------|------------|-------------|
| 09-01 | Test infrastructure setup | vitest + @vitest/coverage-v8, playwright config, test:coverage scripts |
| 09-02 | calm-core + mcp-server unit tests | 89 tests (types, AIGF, validation, all MCP tools) |
| 09-03 | Studio unit + integration tests | 253 tests (stores, projection, layout, export, components) |
| 09-04 | E2E Playwright specs | 14 E2E tests (core flow, template+governance, C4, validation) |
| 09-05 | CI integration + README | Coverage thresholds enforced in CI, E2E on main, badges in README |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: .github/workflows/ci.yml — has "coverage" (11+ occurrences) and "playwright" (2 occurrences)
- FOUND: README.md — has coverage badge and Testing section

Commits verified:
- 02385ac: feat(ci): add coverage reporting and E2E test jobs to CI workflow
- 797781d: feat(docs): add coverage badges and Testing section to README

All 470 unit/component/integration tests pass: `pnpm -r run test` in ~12s
