---
phase: 10-docs-package-publish
plan: 01
subsystem: infra
tags: [tsup, npm-publish, calm-core, esm, cjs, dual-build, typescript]

# Dependency graph
requires: []
provides:
  - calm-core dual ESM+CJS+d.ts build via tsup
  - npm-publishable package with private:false and conditional exports
  - standalone npm README for npmjs.com display
  - release workflow already covers tsup build via pnpm -r run build
affects: [mcp-server, extensions, calmscript]

# Tech tracking
tech-stack:
  added: [tsup@8.5.1]
  patterns:
    - "tsup dual-format library build: entry src/index.ts -> dist/{esm,cjs,dts}"
    - "Conditional exports map with import/require conditions for ESM+CJS"
    - "AJV kept as runtime external dep, not bundled into dist"

key-files:
  created:
    - packages/calm-core/tsup.config.ts
    - packages/calm-core/README.md
  modified:
    - packages/calm-core/package.json

key-decisions:
  - "AJV is external (not bundled) — consumers must install it; listed as runtime dependency so it auto-installs"
  - "test-fixtures export removed from public API — not for external consumers"
  - "release.yml unchanged — pnpm -r run build already covers calm-core after build script update"

patterns-established:
  - "Library package pattern: tsup.config.ts with external runtime deps, conditional exports, files allowlist"

requirements-completed: [CORE-01]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 10 Plan 01: calm-core npm package configuration Summary

**calm-core configured for npm publish: tsup dual ESM+CJS build with type declarations, conditional exports map, AJV as external runtime dep, and standalone npmjs.com README**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-15T06:33:52Z
- **Completed:** 2026-03-15T06:37:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- tsup builds calm-core to `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` and `dist/index.d.cts` (type declarations) in one command
- `package.json` updated: `private:false`, conditional exports, `files` field limiting tarball to `dist/`, `README.md`, `CHANGELOG.md`; `build` script changed from no-op to `tsup`
- Standalone `README.md` written for npmjs.com: install instructions, quick code example, full API table, AIGF governance section, FINOS ecosystem links
- `npm pack --dry-run` confirms tarball includes only dist/ + README.md + package.json — no src/ or test-fixtures/
- All 39 existing tests pass; typecheck clean; release workflow requires no changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure tsup build and update package.json** - `f750ce5` (feat)
2. **Task 2: Write standalone calm-core README** - `d831fe2` (docs)

**Plan metadata:** _(final metadata commit — see completion message)_

## Files Created/Modified

- `packages/calm-core/tsup.config.ts` — tsup build config: ESM+CJS output, dts, sourcemap, AJV external
- `packages/calm-core/package.json` — private:false, conditional exports, files field, tsup build script, tsup devDependency
- `packages/calm-core/README.md` — standalone npm README with badges, install, quick example, API overview, AIGF section, FINOS links

## Decisions Made

- **AJV kept external:** `ajv` and `ajv-formats` are listed as runtime `dependencies` (auto-install for consumers) and marked `external` in tsup so they are not bundled in dist. This keeps the bundle lean and lets consumers use their own AJV instance if needed.
- **test-fixtures removed from exports:** The `"./test-fixtures"` conditional export was removed entirely — it was only used for internal monorepo testing and is not part of the public npm API.
- **release.yml unchanged:** The `pnpm -r run build` step in the release workflow already covers calm-core now that its build script runs `tsup`. No separate step needed.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The commit hook enforced scope-enum validation (`scope must be one of [studio, desktop, calm-core, ...]`), so commit message scopes were adjusted to `calm-core` and `docs` accordingly — minor formatting only.

## User Setup Required

None — no external service configuration required. Publishing requires `NPM_TOKEN` secret already expected in release.yml.

## Next Phase Readiness

- calm-core is npm-publish-ready; will publish automatically on next merge to main via multi-semantic-release
- Phase 10 Plan 02 (if any) can proceed immediately
- Other packages (mcp-server, extensions, calmscript) can use the same tsup pattern if they need npm publishing

---
*Phase: 10-docs-package-publish*
*Completed: 2026-03-15*
