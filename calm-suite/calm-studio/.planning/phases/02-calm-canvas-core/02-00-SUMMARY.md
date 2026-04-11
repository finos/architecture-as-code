---
phase: 02-calm-canvas-core
plan: 00
subsystem: testing
tags: [vitest, playwright, svelte, sveltekit, jsdom, testing-library]

# Dependency graph
requires: []
provides:
  - Vitest v3 configured with jsdom environment and globals in vite.config.ts
  - Playwright configured for chromium E2E with pnpm dev web server
  - Stub test files for containment, history, clipboard, and node search
  - pnpm test script wired to vitest run in apps/studio
affects:
  - 02-calm-canvas-core (all subsequent plans that use test verify blocks)
  - 02-04 (containment logic — test stubs ready)
  - 02-05 (history/clipboard/search — test stubs ready)

# Tech tracking
tech-stack:
  added:
    - vitest@^3.0.8
    - "@playwright/test@^1.50.1"
    - "@testing-library/svelte@^5.2.7"
    - jsdom@^25.0.1
    - "@sveltejs/kit@^2.x (SvelteKit scaffolding installed)"
    - svelte@^5.x
    - vite@^6.x
  patterns:
    - Vitest inline config inside vite.config.ts (not separate vitest.config.ts)
    - Test files in src/tests/*.test.ts
    - todo tests as scaffolding — pass as skipped until implemented
    - Apache 2.0 SPDX headers on all source files

key-files:
  created:
    - apps/studio/vite.config.ts
    - apps/studio/playwright.config.ts
    - apps/studio/src/tests/containment.test.ts
    - apps/studio/src/tests/history.test.ts
    - apps/studio/src/tests/clipboard.test.ts
    - apps/studio/src/tests/search.test.ts
    - .gitignore
  modified:
    - apps/studio/package.json
    - apps/studio/tsconfig.json
    - pnpm-lock.yaml

key-decisions:
  - "Used passWithNoTests:true in Vitest config so vitest exits 0 when no test files match yet"
  - "SvelteKit plugin required in vite.config.ts — not just a plain vitest/config defineConfig"
  - "tsconfig.json extends .svelte-kit/tsconfig.json directly without overriding paths (SvelteKit handles $lib aliases)"
  - "Scope studio required for all commits per commitlint.config.cjs rules"

patterns-established:
  - "All test stubs use test.todo() — they are skipped, not failing"
  - "Playwright E2E tests go in src/tests/e2e/ (separate from unit tests in src/tests/)"

requirements-completed: [CANV-01, CANV-05, CANV-07, CANV-08, CANV-09, CALM-05]

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 2 Plan 00: Test Infrastructure Setup Summary

**Vitest v3 + Playwright configured in SvelteKit studio app with 4 stub test files (20 todo tests) passing clean**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-11T11:44:42Z
- **Completed:** 2026-03-11T12:00:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Vitest v3 running in jsdom environment with globals enabled — `pnpm --filter @calmstudio/studio test --run` exits 0
- Playwright config set up for chromium E2E tests with pnpm dev web server on port 5173
- 4 stub test files (20 todo tests) scaffolding containment, history, clipboard, and node search behaviors
- Full SvelteKit + Svelte 5 dependency stack installed alongside test tooling

## Task Commits

1. **Task 1: Install test dependencies and configure Vitest + Playwright** - `11ccbc2` (chore)
2. **Task 2: Create stub test files for all unit-testable modules** - `c2b712d` (test)

## Files Created/Modified

- `apps/studio/vite.config.ts` - Vite+SvelteKit config with inline Vitest jsdom config
- `apps/studio/playwright.config.ts` - Playwright chromium E2E config with dev server
- `apps/studio/package.json` - Added test/dev scripts and all devDependencies
- `apps/studio/tsconfig.json` - Updated to extend .svelte-kit/tsconfig.json
- `apps/studio/src/tests/containment.test.ts` - 5 todo tests for containment logic
- `apps/studio/src/tests/history.test.ts` - 6 todo tests for undo/redo stack
- `apps/studio/src/tests/clipboard.test.ts` - 5 todo tests for copy/paste operations
- `apps/studio/src/tests/search.test.ts` - 4 todo tests for Fuse-based node search
- `.gitignore` - Root gitignore covering node_modules, .svelte-kit, dist, coverage

## Decisions Made

- Used `passWithNoTests: true` in Vitest config so `vitest run` exits 0 when no test files match the include glob
- SvelteKit's `@sveltejs/kit/vite` plugin must be included in vite.config.ts (plain `vitest/config` would fail to resolve `@sveltejs/kit`)
- tsconfig.json should extend `.svelte-kit/tsconfig.json` without overriding paths — SvelteKit auto-generates `$lib` aliases in its tsconfig
- All commits use scope `studio` per commitlint.config.cjs allowed scopes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed full SvelteKit stack to resolve vite.config.ts import error**
- **Found during:** Task 1 (Install test dependencies)
- **Issue:** The `vite.config.ts` formatter template uses `@sveltejs/kit/vite` plugin; `@sveltejs/kit` was not installed, causing vitest to fail at config load time with `ERR_MODULE_NOT_FOUND`
- **Fix:** Added `@sveltejs/kit`, `svelte`, `vite`, `@sveltejs/adapter-auto`, `@sveltejs/vite-plugin-svelte`, and related SvelteKit dependencies via `pnpm add`
- **Files modified:** apps/studio/package.json, pnpm-lock.yaml
- **Verification:** vitest exits 0 with no test files (passWithNoTests)
- **Committed in:** 11ccbc2 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added passWithNoTests: true to Vitest config**
- **Found during:** Task 1 (Install test dependencies)
- **Issue:** Vitest exits with code 1 when no test files match the include glob, making Task 1's done criteria unreachable without test files
- **Fix:** Added `passWithNoTests: true` to the test config block in vite.config.ts
- **Files modified:** apps/studio/vite.config.ts
- **Verification:** vitest exits 0 with "No test files found, exiting with code 0"
- **Committed in:** 11ccbc2 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed tsconfig.json path conflicts with SvelteKit auto-generated tsconfig**
- **Found during:** Task 2 (Create stub test files)
- **Issue:** tsconfig.json had explicit `paths` entries for `$lib` that conflicted with `.svelte-kit/tsconfig.json` auto-generated paths, causing a SvelteKit warning on every test run
- **Fix:** Removed `compilerOptions.paths` from tsconfig.json — `.svelte-kit/tsconfig.json` handles these automatically
- **Files modified:** apps/studio/tsconfig.json
- **Verification:** vitest runs cleanly with no tsconfig warnings
- **Committed in:** c2b712d (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug)
**Impact on plan:** All auto-fixes necessary for correct operation. No scope creep.

## Issues Encountered

The studio package was a bare TypeScript skeleton without SvelteKit scaffold — the project formatter/template populated `vite.config.ts` with SvelteKit config, requiring the full SvelteKit dependency stack to be installed. This was handled as a Rule 3 blocking deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `pnpm --filter @calmstudio/studio test --run` exits 0 — all subsequent plan verify blocks can use this command
- Stub test files ready for Plans 04 and 05 to fill in with real assertions
- Playwright configured and ready for E2E tests (no tests written yet)
- SvelteKit + Svelte 5 + @xyflow/svelte all installed and configured

## Self-Check: PASSED

All artifacts verified:
- FOUND: apps/studio/vite.config.ts
- FOUND: apps/studio/playwright.config.ts
- FOUND: apps/studio/src/tests/containment.test.ts
- FOUND: apps/studio/src/tests/history.test.ts
- FOUND: apps/studio/src/tests/clipboard.test.ts
- FOUND: apps/studio/src/tests/search.test.ts
- FOUND: commit 11ccbc2 (Task 1)
- FOUND: commit c2b712d (Task 2)

---
*Phase: 02-calm-canvas-core*
*Completed: 2026-03-11*
