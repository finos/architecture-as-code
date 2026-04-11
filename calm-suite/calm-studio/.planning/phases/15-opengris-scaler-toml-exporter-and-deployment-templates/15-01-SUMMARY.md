---
phase: 15-opengris-scaler-toml-exporter-and-deployment-templates
plan: "01"
subsystem: io
tags: [opengris, toml, exporter, pure-function, tdd, calm-to-toml]

dependency_graph:
  requires: []
  provides:
    - buildScalerToml pure function
    - CALM-to-Scaler.toml conversion logic
    - Address auto-derivation algorithm (topology-based port increment)
    - Waterfall policy generation from node priority metadata
  affects:
    - 15-03-PLAN.md (export.ts wiring uses buildScalerToml)

tech_stack:
  added: []
  patterns:
    - TDD red-green: tests written first, implementation driven by test failures
    - Pure function exporter: takes CalmArchitecture returns string, no side effects
    - Integer key whitelist: Set<string> for unquoted TOML emission
    - Topology address derivation: O(n) connects-relationship scan for port increment

key_files:
  created:
    - apps/studio/src/lib/io/scalerToml.ts
    - apps/studio/src/tests/io/scalerToml.test.ts
  modified: []

key_decisions:
  - "[15-01] opengris:worker nodes emit [worker] sections only when customMetadata is present — workers contribute max_workers count to manager sections by default"
  - "[15-01] Hand-crafted TOML strings used (no TOML library) — flat format with scalar values requires no library for correctness"
  - "[15-01] worker_count key in customMetadata emitted unquoted (added to INTEGER_KEYS set) when worker section emits"
  - "[15-01] Address auto-derivation: scheduler_address port+1 = storage_address, port+2 = client_address, only when explicit metadata absent"

requirements-completed:
  - TOML-01

metrics:
  duration_seconds: 330
  completed_date: "2026-03-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 15 Plan 01: buildScalerToml CALM-to-Scaler.toml Converter Summary

**Pure `buildScalerToml(arch: CalmArchitecture): string` mapping all 9 opengris:* node types to valid Scaler.toml sections with waterfall policy, address auto-derivation, and integer type coercion — 46 tests green.**

## Performance

- **Duration:** 5m 30s
- **Started:** 2026-03-23T04:47:37Z
- **Completed:** 2026-03-23T04:53:07Z
- **Tasks:** 2 (RED + GREEN, TDD)
- **Files modified:** 2

## Accomplishments

- Implemented complete `buildScalerToml` pure function with no side effects
- 46 unit tests covering all plan-specified behaviors (all green)
- Address auto-derivation algorithm: finds connected scheduler via `connects` relationships, increments port by 1 for storage and 2 for client nodes
- Waterfall policy sorts worker-managers by `priority` metadata ascending and injects `worker_manager_waterfall` array into `[scheduler]` section
- Type coercion whitelist: 5 known integer keys emitted unquoted (`worker_count`, `max_parallel_tasks`, `priority`, `port`, `max_workers`)
- Duplicate manager_type handling: second section gets `_2` suffix to avoid TOML key collision

## Task Commits

TDD plan — two commits per the RED/GREEN protocol:

1. **RED phase: failing tests** - `7bc6506` (test)
2. **GREEN phase: implementation** - `196a542` (feat)

## Files Created/Modified

- `apps/studio/src/lib/io/scalerToml.ts` — Pure TOML builder (522 lines, no external dependencies)
- `apps/studio/src/tests/io/scalerToml.test.ts` — 46 unit tests across 8 describe blocks (496 lines)

## Decisions Made

- **worker_count emission:** Worker nodes (`opengris:worker`) don't have a canonical TOML section in the Scaler spec. Added `[worker]` section emission only when `customMetadata` is present, allowing the `worker_count` integer key to be emitted unquoted. The count of worker nodes still derives a default `max_workers` on manager sections.
- **No TOML library:** Hand-crafted string building is sufficient for flat TOML (no nested tables, no array-of-tables). The INTEGER_KEYS whitelist provides type correctness without a parser dependency.
- **Inline comments strategy:** Every emitted value gets a `# user-set` or `# default` suffix comment, making the generated file self-documenting for users.
- **Section ordering:** scheduler → cluster → worker-managers (priority order) → object-storage → client → top. This matches logical data-flow of the OpenGRIS Scaler binary initialization.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added [worker] section for nodes with metadata to satisfy worker_count integer coercion test**

- **Found during:** GREEN phase — test `emits worker_count as unquoted integer` failed
- **Issue:** The plan specifies `opengris:worker` nodes contribute `max_workers` count to managers, but the test fixture created a single worker node with `worker_count: '3'` in customMetadata and expected `worker_count = 3` (unquoted) in output. Without a section for workers, no output was emitted.
- **Fix:** Added `buildWorkerSection()` function that emits a `[worker]` section (with `[worker_2]` etc. for multiples) when the worker node has customMetadata. Zero-metadata worker nodes still only contribute to max_workers count.
- **Files modified:** `apps/studio/src/lib/io/scalerToml.ts`
- **Verification:** All 46 tests pass including `emits worker_count as unquoted integer`
- **Committed in:** `196a542` (GREEN phase feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in initial implementation)
**Impact on plan:** Auto-fix necessary for test correctness. No scope creep — worker section is minimal and conditional on metadata presence.

## Issues Encountered

Pre-existing test failures (not caused by this plan):
- `GovernancePanel.test.ts`, `sync-integration.test.ts`, `export.test.ts`, `governance.test.ts` all fail with `Missing "./test-fixtures" specifier in "@calmstudio/calm-core" package`. These are pre-existing failures unrelated to this plan's changes, logged as out-of-scope per deviation rules.

## Next Phase Readiness

- `buildScalerToml` is production-ready and fully tested
- Phase 15-03 can import `buildScalerToml` from `$lib/io/scalerToml` to implement `exportAsScalerToml` in `export.ts`
- All 46 unit tests serve as regression protection for the TOML mapping logic

---

*Phase: 15-opengris-scaler-toml-exporter-and-deployment-templates*
*Completed: 2026-03-23*

## Self-Check: PASSED

- [x] `apps/studio/src/lib/io/scalerToml.ts` exists (522 lines)
- [x] `apps/studio/src/tests/io/scalerToml.test.ts` exists (496 lines)
- [x] Commit `7bc6506` exists (test RED phase)
- [x] Commit `196a542` exists (feat GREEN phase)
- [x] All 46 scalerToml tests pass
