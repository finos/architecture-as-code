---
phase: 06-calm-validation
plan: 00
subsystem: validation
tags: [ajv, json-schema, calm, validation, vitest, tdd]

requires:
  - phase: 05-mcp-server
    provides: "validateArchitecture() and ValidationIssue type to migrate and supersede"
  - phase: 02-calm-canvas-core
    provides: "CalmArchitecture, CalmNode, CalmRelationship types in calm-core"

provides:
  - "validateCalmArchitecture() function in @calmstudio/calm-core"
  - "ValidationIssue type with error/warning/info severity"
  - "Ajv-based JSON schema validation against CalmStudio internal format"
  - "Semantic rules: duplicate IDs, dangling refs, orphan nodes, self-loops"
  - "Info rule: nodes missing description"
  - "CALM 2025-03 meta schema files bundled in calm-core/src/schemas/"

affects:
  - 06-01
  - 06-02

tech-stack:
  added:
    - "ajv@8.18.0 — JSON schema validation engine"
    - "ajv-formats@3.0.1 — standard format validators for Ajv"
    - "vitest@3.2.4 — test runner for calm-core package"
  patterns:
    - "Ajv instance with strict:false for CALM 2020-12 vocabulary compatibility"
    - "Flat CalmStudio instance schema separate from FINOS meta-schemas"
    - "Semantic validation layered on top of JSON Schema validation"
    - "TDD: failing tests committed before implementation"

key-files:
  created:
    - "packages/calm-core/src/validation.ts"
    - "packages/calm-core/src/validation.test.ts"
    - "packages/calm-core/vite.config.ts"
    - "packages/calm-core/src/schemas/calm.json"
    - "packages/calm-core/src/schemas/core.json"
    - "packages/calm-core/src/schemas/interface.json"
    - "packages/calm-core/src/schemas/flow.json"
    - "packages/calm-core/src/schemas/control.json"
    - "packages/calm-core/src/schemas/control-requirement.json"
    - "packages/calm-core/src/schemas/evidence.json"
    - "packages/calm-core/src/schemas/units.json"
  modified:
    - "packages/calm-core/src/index.ts"
    - "packages/calm-core/package.json"

key-decisions:
  - "CalmStudio uses flat internal schema (source/destination strings) not FINOS nested relationship-type — separate calmStudioSchema for Ajv instance validation"
  - "CALM 2025-03 calm.json is a meta-schema (validates CALM schemas), not an instance validator — registered as additional schemas only"
  - "strict:false in Ajv config handles 2020-12 vocabulary declarations without custom keyword registration"
  - "Orphan node warning fires unconditionally — empty relationships array means every node is orphaned"
  - "No $schema field in calmStudioSchema — avoids Ajv meta-schema resolution failure for draft/2020-12"

patterns-established:
  - "Validation engine: Ajv schema check first, semantic rules second, info rules always"
  - "extractIdFromPath: maps Ajv instancePath /nodes/N or /relationships/N to actual unique-id for issue attribution"
  - "TDD red-green cycle: failing test commit then implementation commit"

requirements-completed: [VALD-01, VALD-03]

duration: 5min
completed: 2026-03-12
---

# Phase 6 Plan 00: CALM Validation Engine Summary

**Ajv-based CalmArchitecture validator in calm-core with 11 passing tests covering schema violations, dangling refs, duplicate IDs, orphan nodes, self-loops, and info-level missing descriptions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T12:37:42Z
- **Completed:** 2026-03-12T12:42:47Z
- **Tasks:** 1 (TDD: 2 commits — test then implementation)
- **Files modified:** 13

## Accomplishments

- Installed ajv, ajv-formats, vitest in calm-core; downloaded all 8 CALM 2025-03 meta schema files
- Created `validateCalmArchitecture()` with Ajv JSON Schema validation + semantic rules + info rules
- 11 unit tests passing covering all required behavior: errors (missing fields, dangling refs, duplicates), warnings (orphans, self-loops), info (no description), valid cases, and Ajv type rejection
- Re-exported from `@calmstudio/calm-core` index — ready for studio reactive store and MCP server to consume in Plans 01 and 02

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for CALM validation engine** - `8af2808` (test)
2. **GREEN: Ajv-based CALM validation engine** - `0204027` (feat)

_TDD task: test commit first, then implementation commit._

## Files Created/Modified

- `packages/calm-core/src/validation.ts` — Ajv instance, calmStudioSchema, validateCalmArchitecture(), semantic + info rules
- `packages/calm-core/src/validation.test.ts` — 11 unit tests for all severity levels
- `packages/calm-core/vite.config.ts` — vitest config (node env, include src/**/*.test.ts)
- `packages/calm-core/src/index.ts` — added `export * from './validation.js'`
- `packages/calm-core/package.json` — test script changed to `vitest run`, deps added
- `packages/calm-core/src/schemas/` — 8 CALM 2025-03 JSON schema files downloaded from FINOS GitHub

## Decisions Made

- **Separate instance schema from FINOS meta-schemas:** calm.json from FINOS is a meta-schema that validates CALM schema documents, not CALM architecture instances. Created a flat `calmStudioSchema` matching the studio's internal `CalmRelationship` format (source/destination as strings).
- **Ajv strict:false:** CALM 2025-03 schemas use `$vocabulary` with 2020-12 identifiers — Ajv strict mode rejects unknown keywords/vocabularies; `strict: false` suppresses this cleanly per plan guidance.
- **Orphan node rule unconditional:** Removed `arch.relationships.length > 0` guard from linter-generated code — a single node with no relationships should always warn as orphan.
- **No $schema in calmStudioSchema:** Including `$schema: 'https://json-schema.org/draft/2020-12/schema'` caused Ajv to try to resolve that URL as a validator meta-schema; removed to avoid "no schema with key" error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed $schema from calmStudioSchema**
- **Found during:** Task 1 (GREEN phase - first test run)
- **Issue:** `$schema: 'https://json-schema.org/draft/2020-12/schema'` caused Ajv compile to throw "no schema with key or ref" error
- **Fix:** Removed `$schema` from calmStudioSchema
- **Files modified:** packages/calm-core/src/validation.ts
- **Committed in:** 0204027

**2. [Rule 1 - Bug] Fixed orphan node warning with empty relationships**
- **Found during:** Task 1 (GREEN phase - test failures)
- **Issue:** Linter-generated implementation had `arch.relationships.length > 0` guard, silencing orphan warning when relationships array is empty
- **Fix:** Removed the guard — a node is an orphan whenever it has no relationships
- **Files modified:** packages/calm-core/src/validation.ts
- **Committed in:** 0204027

**3. [Rule 1 - Bug] Fixed test helper to use flat CalmRelationship format**
- **Found during:** Task 1 (GREEN phase - test failures)
- **Issue:** Test helper `makeConnectsRel` created nested CALM JSON format but CalmStudio schema expects flat format
- **Fix:** Replaced `makeConnectsRel` with `makeRel` using flat format matching CalmRelationship type
- **Files modified:** packages/calm-core/src/validation.test.ts
- **Committed in:** 0204027

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs found during TDD GREEN phase)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered

- The linter created both `vite.config.ts` and `validation.ts` automatically during the RED commit phase. The linter-generated `validation.ts` had the `$schema` and orphan guard bugs — both caught and fixed in the GREEN phase via TDD.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `validateCalmArchitecture()` and `ValidationIssue` now exported from `@calmstudio/calm-core`
- Plan 01 can import and wire validation into the studio reactive store (validationStore.svelte.ts)
- Plan 02 can replace MCP server's `validateArchitecture()` with the shared `validateCalmArchitecture()`
- The CALM 2025-03 meta-schemas are bundled and ready if future plans need them for more granular CALM instance validation

## Self-Check: PASSED

- [x] packages/calm-core/src/validation.ts exists
- [x] packages/calm-core/src/index.ts exports from validation.js
- [x] All 11 unit tests pass (`pnpm --filter @calmstudio/calm-core test`)
- [x] validateCalmArchitecture() exported with ValidationIssue type including 'info' severity
- [x] 8af2808 RED commit exists
- [x] 0204027 GREEN commit exists

---
*Phase: 06-calm-validation*
*Completed: 2026-03-12*
